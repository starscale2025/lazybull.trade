"use client";

// The age gate + consent dialog. The first thing on the site, and the reason
// every product event exists at all.
//
// WHY THIS EXISTS. The diligence memo, verbatim: "DPDP rules (full compliance
// 13 May 2027) ban behavioural monitoring of minors and require verifiable
// parental consent; the target demographic captures under-18s. Age-gate at
// signup; consent screens with purpose (product improvement and AI training)."
// And: "an un-consented dataset is an un-sellable dataset". So this dialog is
// not a cookie banner — it is the thing that makes the decision-trace moat an
// asset rather than a liability, and it ships before the traces do.
//
// THREE ANSWERS, ONE RECORD. Age (required, no default), product analytics and
// AI-training use of decision traces — both offered OFF. Analytics used to be
// pre-ticked; the 2026-11 verification found that fails the "clear affirmative
// action" DPDP asks for, so each purpose is now a separate opt-in, and the
// consent text version was bumped so every yes the pre-tick produced is asked
// again (lib/consent.ts). All three land in the
// single lib/consent.ts record; there is no second consent shape anywhere.
//
// UNDER 18 IS A FULL STOP. Not "tracking off, carry on" — the product is 18+,
// so the answer closes the workbench and shows why. Nothing is queued, nothing
// is posted (lib/consent.ts: minors are never posted — shipping a "child said
// no" record with a device id would itself be processing a child's data), and
// no device id is even created.
//
// THE SERVER COPY IS AN AUDIT TRAIL, NOT A SWITCH. Local consent is written
// first and applies whether the POST lands or not. With no MONGODB_URI the
// route answers 503 and the app keeps working — this repo runs with zero env
// vars set, and a consent gate that needs a database is a consent gate that
// fails open on the day the database is down.
//
// STACKING. z-index 170: above --z-dialog (150) so it covers the first-visit
// risk briefing, and above --z-palette (160) — the command deck outranks a
// normal dialog "because it is how you escape one", and this is the one dialog
// there is no escaping. Below .skip-link (200), which the focus trap keeps
// unreachable anyway.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CONSENT_TEXT_VERSION,
  CONSENT_VERSION,
  clearConsent,
  consentGateNeeded,
  isMinor,
  readConsent,
  subscribeConsent,
  writeConsent,
  type ConsentRecord,
} from "@/lib/consent";
import { deviceId, track } from "@/lib/track";

// ── the "manage consent" entry point ────────────────────────────────────────
// Module-level so any button anywhere can call it without prop-drilling a
// context through the whole tree. A call before the gate mounts is remembered,
// so a deep link that opens settings on load still works.

let openSettingsImpl: (() => void) | null = null;
let openPending = false;

/**
 * Re-open the consent dialog with the current answers pre-filled.
 * Wire this to a "manage consent" control (the footer is the obvious home).
 */
export function openConsentSettings(): void {
  if (openSettingsImpl) openSettingsImpl();
  else openPending = true;
}

/**
 * The current consent record, live. Re-renders on this tab's writes and on
 * another tab's (lib/consent.ts wires the storage event).
 *
 * `ready` is false until the first client render — during SSR and hydration
 * there is no localStorage, so "no consent" and "not read yet" are the same
 * value and must not be allowed to render as a decision.
 */
export function useConsent() {
  const consent = useSyncExternalStore<ConsentRecord | null>(
    subscribeConsent,
    readConsent,
    () => null
  );
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return {
    consent,
    ready,
    adult: !!consent?.adult,
    analytics: !!consent?.adult && !!consent.analytics,
    training: !!consent?.adult && !!consent.training,
    open: openConsentSettings,
  };
}

type View = "ask" | "blocked";

export function ConsentGate() {
  const { consent, ready } = useConsent();
  const [settings, setSettings] = useState(false);
  const [adult, setAdult] = useState(false);
  const [analytics, setAnalytics] = useState(false); // offered off, like training
  const [training, setTraining] = useState(false); // offered off
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    openSettingsImpl = () => {
      const rec = readConsent();
      setAdult(!!rec?.adult);
      setAnalytics(rec ? rec.analytics : false);
      setTraining(rec ? rec.training : false);
      setSettings(true);
    };
    if (openPending) {
      openPending = false;
      openSettingsImpl();
    }
    return () => {
      openSettingsImpl = null;
    };
  }, []);

  const needsGate = ready && consentGateNeeded(consent);
  const blocked = ready && !settings && isMinor(consent);
  // Pages a visitor may need to read BEFORE answering: what we collect, the
  // terms, who we are, and what the safety rails do. On these the gate becomes
  // a one-line bar instead of an overlay; nothing leaks meanwhile, because
  // lib/track.ts drops every event until an answer exists.
  const pathname = usePathname();
  const legal = ["/privacy", "/terms", "/about", "/safety"].includes(pathname ?? "");
  const open = settings || (!legal && (needsGate || blocked));
  const view: View = blocked ? "blocked" : "ask";

  // Focus trap + scroll lock. Escape deliberately does NOT dismiss: a consent
  // dialog you can flick away is a consent dialog that records nothing and
  // then lets you in anyway. Settings mode gets an explicit "cancel" instead.
  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    const restore = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      );
    (focusables()[0] ?? el).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusables();
      if (!nodes.length) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && el.contains(active);
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    // A class on <html>, not body overflow: globals.css sets
    // `html, body { overflow-x: clip }`, which stops a body lock from ever
    // reaching the viewport (the old lock never worked).
    const root = document.documentElement;
    root.classList.add("lb-modal-open");
    return () => {
      document.removeEventListener("keydown", onKey, true);
      root.classList.remove("lb-modal-open");
      restore?.focus?.();
    };
  }, [open, view]);

  const record = useCallback(
    (isAdult: boolean, wantsAnalytics: boolean, wantsTraining: boolean) => {
      const rec: ConsentRecord = {
        v: CONSENT_VERSION,
        adult: isAdult,
        analytics: isAdult && wantsAnalytics,
        training: isAdult && wantsTraining,
        at: new Date().toISOString(), // matches ConsentRecord's ISO_DATETIME
        text: CONSENT_TEXT_VERSION,
      };
      // LOCAL FIRST. The device is the source of truth; the server copy is the
      // audit trail and must never be able to block the decision.
      writeConsent(rec);
      setSettings(false);

      if (!isAdult) return; // minors: nothing posted, no device id created
      // A decline of both purposes stays on the device too: lib/track.ts
      // promises a device id is "never created for a device that declined",
      // and the POST below is what used to mint one.
      if (!rec.analytics && !rec.training) return;

      // Fire-and-forget. A 503 (no database locally) is a normal outcome.
      try {
        void fetch("/api/consent", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...rec, device: deviceId() }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        /* the local record already stands */
      }

      // The landing page_view. The Tracker fired one on mount and track()
      // correctly dropped it — the answer had not been given yet. This is the
      // replacement, emitted while document.referrer and the ?utm_* on the
      // address bar are still the ones the visitor arrived with, which is what
      // makes first-touch attribution possible at all (lib/track.ts).
      if (rec.analytics) track("page_view");
    },
    []
  );

  if (!open) {
    if (legal && (needsGate || blocked)) {
      return (
        <div role="region" aria-label="Privacy choices" className="fixed inset-x-0 bottom-0 z-[170] border-t border-border bg-bg/95 py-3 backdrop-blur">
          <div className="shell flex flex-wrap items-center justify-between gap-3 t-chrome text-fg-dim">
            <span>Nothing is recorded until you answer the age and privacy questions.</span>
            <button
              type="button"
              onClick={openConsentSettings}
              className="border border-bull/40 px-3 py-2 text-bull transition-colors hover:bg-bull/10"
            >
              answer now
            </button>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
      // Not a click-outside-to-close overlay. There is no outside.
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="consent-title"
        aria-describedby="consent-intro"
        tabIndex={-1}
        className="max-h-[calc(100vh/var(--ui-zoom)-2rem)] w-full max-w-xl overflow-y-auto border border-bull/40 bg-bg shadow-[0_30px_100px_-20px_rgba(0,255,135,0.45)] outline-none transition-opacity duration-200 motion-reduce:transition-none"
      >
        {view === "blocked" ? (
          <BlockedPanel onStartOver={() => clearConsent()} />
        ) : (
          <>
            <div className="border-b border-border bg-bg-soft px-4 py-2 t-eyebrow text-bull">
              ⟢ {settings ? "your privacy choices" : "before you start · 1 of 1"}
            </div>
            <div className="p-6">
              <h2
                id="consent-title"
                className="font-display text-3xl leading-tight tracking-tightest text-fg"
              >
                {settings ? "Your privacy choices." : "One check, two choices."}
              </h2>
              <p id="consent-intro" className="t-body-sm mt-3 text-fg-dim">
                lazybull is a paper-only options workbench. No real money moves, and nothing here is
                advice. Before anything is recorded we need to confirm your age, then ask two
                optional questions. Both are off unless you turn them on.
              </p>

              {/* (a) the age gate — required, no default */}
              <label className="mt-5 flex cursor-pointer items-start gap-3 border border-border bg-bg p-3 transition-colors hover:border-bull/40">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-bull"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                />
                <span>
                  <span className="t-body-sm block text-fg">I am 18 or older.</span>
                  <span className="mt-1 block text-[0.8125rem] leading-relaxed text-fg-dim">
                    This product is 18+. India&rsquo;s DPDP rules ban behavioural monitoring of
                    under-18s without verifiable parental consent — we don&rsquo;t collect a
                    parent&rsquo;s consent, so we don&rsquo;t let minors in.
                  </span>
                </span>
              </label>

              {/* (b) + (c) the two purposes, separately */}
              <div className="mt-3 divide-y divide-border border border-border">
                <Toggle
                  label="Product analytics"
                  description="What you do in the app — pages, paper trades, explanations asked — so we can improve it. Never sold, never advertising."
                  checked={analytics}
                  onChange={setAnalytics}
                />
                <Toggle
                  label="Help train the teacher"
                  description="Your decision traces — drags, undos, re-asks — keyed to a random device id, not your name, may be used to improve the AI teacher."
                  checked={training}
                  onChange={setTraining}
                />
              </div>

              <p className="mt-3 t-chrome text-fg-dim">
                saved on this device · if you are 18+ and turn either on, a copy goes to our server as
                your consent record, with a random device id, your country and browser type · if we
                change what this dialog says, we ask again rather than assume
              </p>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <Link
                    href="/privacy"
                    target="_blank"
                    rel="noopener"
                    className="font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim underline-offset-4 hover:text-bull hover:underline"
                  >
                    privacy policy ↗
                  </Link>
                  {settings ? (
                    <button
                      type="button"
                      onClick={() => setSettings(false)}
                      className="font-mono text-[0.6875rem] uppercase tracking-wider text-fg-faint hover:text-fg-dim"
                    >
                      cancel
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => record(false, false, false)}
                      className="font-mono text-[0.6875rem] uppercase tracking-wider text-fg-faint hover:text-fg-dim"
                    >
                      I&rsquo;m under 18
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => record(true, analytics, training)}
                  disabled={!adult}
                  className="inline-flex items-center gap-2 bg-bull px-5 py-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-bg transition-opacity hover:bg-bull-dim disabled:opacity-30 lg:py-2.5"
                >
                  continue →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** A labelled switch. Native checkbox underneath, so keyboard and AT get the
 *  real thing; the track is decoration. */
function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  // No disabled state: both purposes work from the first frame. record() stores
  // `isAdult && wants…`, so a tick made before the age box is never recorded.
  return (
    <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-surface">
      <input
        type="checkbox"
        role="switch"
        // sr-only, so the visible track below carries the focus ring via `peer`
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={`mt-0.5 inline-flex h-4 w-7 shrink-0 items-center border p-px transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-bull motion-reduce:transition-none ${
          checked ? "border-bull/60 bg-bull/20" : "border-border bg-bg"
        }`}
      >
        <span
          className={`size-3 transition-transform duration-150 motion-reduce:transition-none ${
            checked ? "translate-x-3 bg-bull" : "translate-x-0 bg-fg-faint"
          }`}
        />
      </span>
      <span>
        <span className="t-body-sm block text-fg">{label}</span>
        <span className="mt-1 block text-[0.8125rem] leading-relaxed text-fg-dim">
          {description}
        </span>
      </span>
    </label>
  );
}

/** The under-18 answer. A full stop, not a downgrade — and it explains why. */
function BlockedPanel({ onStartOver }: { onStartOver: () => void }) {
  return (
    <>
      <div className="border-b border-border bg-bg-soft px-4 py-2 t-eyebrow text-amber">
        ⟢ age gate
      </div>
      <div className="p-6">
        <h2 id="consent-title" className="font-display text-3xl leading-tight tracking-tightest text-fg">
          Come back at 18.
        </h2>
        <p id="consent-intro" className="t-body-sm mt-3 text-fg-dim">
          lazybull is an 18+ product. India&rsquo;s DPDP rules ban behavioural monitoring of minors
          and require verifiable parental consent; we don&rsquo;t collect a parent&rsquo;s consent,
          so we don&rsquo;t collect anything at all. Nothing was tracked and nothing was sent — your
          answer stayed on this device.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/privacy"
            className="font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim underline-offset-4 hover:text-bull hover:underline"
          >
            privacy policy ↗
          </Link>
          <button
            type="button"
            onClick={onStartOver}
            className="border border-border px-4 py-2.5 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim transition-colors hover:border-bull/50 hover:text-bull"
          >
            I picked the wrong one — start over
          </button>
        </div>
      </div>
    </>
  );
}

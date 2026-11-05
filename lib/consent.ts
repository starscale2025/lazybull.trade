// Consent — the record, its schema, and the client-side store. Isomorphic and
// dependency-free on purpose: lib/track.ts reads it before every event (so it
// must be importable from the zustand stores, on the server, during SSR),
// components/ConsentGate.tsx writes it, and lib/db/consent.ts + the API route
// validate the same schema server-side. ONE shape, three readers.
//
// WHY THIS EXISTS. India's DPDP rules (full compliance 13 May 2027) ban
// behavioural monitoring of minors and require verifiable parental consent, and
// the target demographic captures under-18s. The diligence memo put the stakes
// plainly: "an un-consented dataset is an un-sellable dataset" — the
// decision-trace moat "starts the day this ships and not before". So every
// product event is gated on this record, and the record itself carries a
// schema version and a consent-TEXT version so a future re-wording can
// re-prompt instead of silently inheriting a stale yes.
//
// TWO PERSISTENCE LAYERS, DELIBERATELY. localStorage `lb-consent` is the
// source of truth on this device; a same-named cookie mirrors the flags so a
// cleared localStorage (or a future server render) still finds the decision.
// The server copy (lib/db/consent.ts) is the AUDIT TRAIL — it must never be
// required: with no MONGODB_URI the gate still works and local consent still
// applies (the app runs with zero env vars set).
//
// MINORS ARE NEVER POSTED. An under-18 answer is kept on the device only:
// shipping a "child said no" record with a device id and user agent to the
// server would itself be processing a child's data. Locally it just closes the
// workbench and turns tracking off.

import { z } from "zod";

export const CONSENT_VERSION = 1 as const;
/** Bump when the consent COPY changes materially; the gate re-prompts on mismatch. */
// 2026-11-05: analytics went from pre-ticked to opt-in and the notice now names
// the server copy. Bumping this re-asks everyone, so no yes produced by the old
// pre-tick stays in force.
export const CONSENT_TEXT_VERSION = "2026-11-05";
export const CONSENT_KEY = "lb-consent";
export const CONSENT_COOKIE = "lb-consent";
/** Written after a successful server upsert for a signed-in user (their id). */
export const CONSENT_LINKED_KEY = "lb-consent-linked";

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

/** The record as stored on the device: `{v:1, adult, analytics, training, at}`. */
export const ConsentRecord = z.object({
  v: z.literal(CONSENT_VERSION),
  adult: z.boolean(),
  analytics: z.boolean(),
  training: z.boolean(),
  /** ISO timestamp of the choice, client clock. */
  at: z.string().regex(ISO_DATETIME),
  /** Which wording was agreed to (see CONSENT_TEXT_VERSION). Optional for v1 records written before it existed. */
  text: z.string().max(16).optional(),
});
export type ConsentRecord = z.infer<typeof ConsentRecord>;

/** What the client POSTs to /api/consent — adults only (see the header). */
export const ConsentInput = ConsentRecord.extend({
  adult: z.literal(true),
  /** Anonymous device id (lib/track.ts) — links the record to the events it governs. */
  device: z.string().min(4).max(64).optional(),
});
export type ConsentInput = z.infer<typeof ConsentInput>;

/** Largest POST body /api/consent accepts (chars) — the record is ~120 bytes. */
export const MAX_CONSENT_BODY_BYTES = 2_000;

// ── the client store ────────────────────────────────────────────────────────
// A memo over storage plus a subscriber list, so the gate, track() and any
// "manage consent" button agree without each re-parsing localStorage.

type Listener = () => void;
const listeners = new Set<Listener>();
let cached: ConsentRecord | null | undefined; // undefined = not read yet
let storageWired = false;

const hasWindow = () => typeof window !== "undefined";

function notify() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* a listener must never break the store */
    }
  }
}

/**
 * Serialise the flags into the mirror cookie: v.adult.analytics.training.epochS.text
 *
 * The trailing text version (2026-11-05 → 20261105) is what lets a record
 * rebuilt from the cookie be judged by consentIsCurrent(). Without it every
 * cookie-rebuilt yes came back text-less and was waved through as legacy.
 */
function cookieValue(rec: ConsentRecord): string {
  const b = (x: boolean) => (x ? "1" : "0");
  const at = Math.floor(new Date(rec.at).getTime() / 1000);
  const text = rec.text && /^\d{4}-\d{2}-\d{2}$/.test(rec.text) ? `.${rec.text.replace(/-/g, "")}` : "";
  return `${rec.v}.${b(rec.adult)}.${b(rec.analytics)}.${b(rec.training)}.${Number.isFinite(at) ? at : 0}${text}`;
}

/** Rebuild a record from the mirror cookie (localStorage cleared, cookie kept). */
export function parseConsentCookie(raw: string | null | undefined): ConsentRecord | null {
  if (!raw) return null;
  const m = /^1\.([01])\.([01])\.([01])\.(\d{1,12})(?:\.(\d{4})(\d{2})(\d{2}))?$/.exec(raw.trim());
  if (!m) return null;
  const at = new Date(Number(m[4]) * 1000);
  return {
    v: 1,
    adult: m[1] === "1",
    analytics: m[2] === "1",
    training: m[3] === "1",
    at: Number.isFinite(at.getTime()) ? at.toISOString() : new Date(0).toISOString(),
    ...(m[5] ? { text: `${m[5]}-${m[6]}-${m[7]}` } : {}),
  };
}

function readCookie(): string | null {
  try {
    const hit = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
    return hit ? decodeURIComponent(hit.slice(CONSENT_COOKIE.length + 1)) : null;
  } catch {
    return null;
  }
}

function readStorage(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw) {
      const parsed = ConsentRecord.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
      localStorage.removeItem(CONSENT_KEY); // junk → treat as undecided, never as a yes
    }
  } catch {
    /* storage blocked → fall through to the cookie */
  }
  return parseConsentCookie(readCookie());
}

function wireStorageEvents() {
  if (storageWired || !hasWindow()) return;
  storageWired = true;
  // Another tab decided → this tab follows, without a reload.
  window.addEventListener("storage", (e) => {
    if (e.key === CONSENT_KEY || e.key === null) {
      cached = undefined;
      notify();
    }
  });
}

/**
 * The current record, or null when undecided. Cheap after the first call
 * (memoised until a write or a cross-tab change). Always null on the server.
 */
export function readConsent(): ConsentRecord | null {
  if (!hasWindow()) return null;
  wireStorageEvents();
  if (cached === undefined) cached = readStorage();
  return cached;
}

/** Persist a decision on this device (localStorage + mirror cookie) and notify. */
export function writeConsent(rec: ConsentRecord): void {
  if (!hasWindow()) return;
  cached = rec;
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(rec));
  } catch {
    /* private mode — the cookie still carries it */
  }
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(cookieValue(rec))}; path=/; max-age=31536000; SameSite=Lax${secure}`;
  } catch {
    /* cookies blocked — localStorage carries it */
  }
  notify();
}

/** Forget the decision (the "start over" path). Tracking stays off until a new yes. */
export function clearConsent(): void {
  if (!hasWindow()) return;
  cached = null;
  try {
    localStorage.removeItem(CONSENT_KEY);
    localStorage.removeItem(CONSENT_LINKED_KEY);
  } catch {}
  try {
    document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {}
  notify();
}

/** Subscribe to changes (same tab writes + cross-tab storage events). */
export function subscribeConsent(cb: Listener): () => void {
  listeners.add(cb);
  wireStorageEvents();
  return () => {
    listeners.delete(cb);
  };
}

/** True when the current record is an adult yes to product analytics. */
export function analyticsAllowed(rec = readConsent()): boolean {
  return !!rec && rec.adult && rec.analytics;
}

/** True when the current record is an adult yes to training-data use. */
export function trainingAllowed(rec = readConsent()): boolean {
  return !!rec && rec.adult && rec.training;
}

/**
 * A YES written under an older consent text must be re-asked, not inherited.
 *
 * A record with no yes in it (a decline, or an under-18 answer) carries
 * nothing forward, so it stands under any text. Records from before the text
 * version existed used to be waved through whatever they said, which meant the
 * 2026-11-05 bump re-asked nobody whose yes came from the pre-ticked boxes.
 */
export function consentIsCurrent(rec: ConsentRecord | null): boolean {
  if (!rec) return false;
  if (rec.text === CONSENT_TEXT_VERSION) return true;
  return !rec.analytics && !rec.training;
}

/**
 * Does the gate have to open? Three cases, one answer: no record at all, junk
 * that failed the schema (readStorage() already dropped it), or a decision
 * made under an OLDER consent text. The last one is the point — the memo's
 * "an un-consented dataset is an un-sellable dataset" cuts both ways, and a
 * re-worded purpose that silently inherits the old yes is exactly the un-
 * consented case. Pure: pass a record to test it without a browser.
 */
export function consentGateNeeded(rec: ConsentRecord | null = readConsent()): boolean {
  return !rec || !consentIsCurrent(rec);
}

/**
 * The device answered "under 18". The workbench closes and NOTHING is tracked
 * (see the header: minors are never posted either). Kept separate from
 * consentGateNeeded() on purpose — a minor record IS a current, valid record,
 * so the gate must not re-prompt; it must show the blocked state instead.
 */
export function isMinor(rec: ConsentRecord | null = readConsent()): boolean {
  return !!rec && !rec.adult;
}

/** Test-only: drop the memo and listeners between cases. */
export function __resetConsentStore(): void {
  cached = undefined;
  listeners.clear();
}

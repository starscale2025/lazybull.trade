"use client";

// THE SYNTHETIC TRUTH BADGE (Phoenix Protocol P5) — a live provenance chip in
// the product header: SYNTHETIC CHAIN · REAL QUOTES (DELAYED) · $0 REAL RISK.
//
// It mounts with a 400ms glitch that RESOLVES into a checkmark — deliberately
// the site's ONE glitch effect, reserved for the one claim that matters: the
// moment the noise settles into truth. Reduced motion (and any later mount)
// goes straight to the ✓.
//
// Click opens the Honesty Ledger: three columns — WHAT'S REAL, WHAT'S
// SYNTHETIC, WHAT'S YOURS. The Executioner called honesty our best asset;
// this makes it furniture.

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

function Label({ compact = false }: { compact?: boolean }) {
  return (
    <>
      {/* Collapse thresholds are one step higher than the raw breakpoint maths
          suggests because the whole UI now renders at --ui-zoom (globals.css):
          a 1440px screen gives the nav ~1285 CSS px of room, not ~1416. The
          nav's children are all shrink-0, so if this badge does not give way
          the pill overflows and the primary CTA is clipped off the right edge.
          Verified at 1440×900: full-width badge made the nav 1414px wide. */}
      {/* COLLAPSE ORDER IS THE POINT, not just the widths.
          This used to drop "synthetic chain" FIRST and keep "$0 real risk"
          last — so as the viewport narrowed the disclosure disappeared and the
          flattering half was what survived, over a synthetic tape. Inverted:
          "synthetic chain" is now the clause that never leaves.

          The widths matter too. Every child of the nav is shrink-0, so an
          over-wide badge does not squeeze — it pushes the primary CTA off the
          right edge. Measured at 1280px the nav needed 1301px and "OPEN THE
          CHAIN" was a green sliver. "$0 real risk" is dropped from the bar
          entirely: it is stated verbatim in the hero status pill and again in
          the footer status bar, so the bar spends its pixels on the claim that
          is NOT repeated anywhere else. */}
      <span>synthetic chain</span>
      <span className={`text-fg-faint ${compact ? "hidden 2xl:inline" : ""}`}>·</span>
      <span className={compact ? "hidden 2xl:inline" : ""}>real quotes (delayed)</span>
    </>
  );
}

export function TruthBadge() {
  const [resolved, setResolved] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setResolved(true);
      return;
    }
    setGlitching(true);
    const t = setTimeout(() => {
      setGlitching(false);
      setResolved(true);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="What's real, what's synthetic, what's yours — open the honesty ledger"
        className="relative flex h-7 items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 font-mono text-[10px] uppercase tracking-wider text-fg-dim hover:border-fg-dim hover:text-fg"
      >
        {resolved && (
          <span className="truth-check-in font-semibold text-bull" aria-hidden>
            ✓
          </span>
        )}
        <span className="relative flex items-center gap-1.5">
          <span className={`flex items-center gap-1.5 ${glitching ? "truth-glitch-base" : ""}`}>
            <Label compact />
          </span>
          {glitching && (
            <>
              <span className="truth-glitch-a absolute inset-0 flex items-center gap-1.5 text-bull" aria-hidden>
                <Label compact />
              </span>
              <span className="truth-glitch-b absolute inset-0 flex items-center gap-1.5 text-cyan" aria-hidden>
                <Label compact />
              </span>
            </>
          )}
        </span>
      </button>
      {open && <HonestyLedger onClose={() => { setOpen(false); btnRef.current?.focus(); }} />}
    </>
  );
}

/* ── the ledger ──────────────────────────────────────────────────────── */

const COLUMNS: {
  key: string;
  title: string;
  accent: string;
  border: string;
  items: { lead: string; detail: string }[];
}[] = [
  {
    key: "real",
    title: "what's real",
    accent: "text-bull",
    border: "border-bull/30",
    items: [
      { lead: "Quotes & bars", detail: "Yahoo Finance, polled every 15–30s. A delayed feed we label as delayed — never fabricated." },
      { lead: "The neural models", detail: "11 nets trained on real market history, served from a Python service. When it's down, we say so." },
      { lead: "The volatility", detail: "VIX is live — it literally bends the headline type on the landing. Calm days set it straight." },
      { lead: "Your decisions", detail: "Every entry, exit, and hold is genuinely yours. That's the only edge this site can't give you." },
    ],
  },
  {
    key: "synthetic",
    title: "what's synthetic",
    accent: "text-cyan",
    border: "border-cyan/30",
    items: [
      { lead: "The options chain", detail: "Black-Scholes output. Strikes, premiums, and greeks are computed from the live spot — not exchange data." },
      { lead: "The fills", detail: "Instant at the mark: no queue, no slippage, no partial fills. Kinder than any real market will ever be." },
      { lead: "Seed tapes", detail: "/quant's SEED mode runs deterministic mulberry32 tapes, so experiments reproduce exactly. Clearly labeled." },
    ],
  },
  {
    key: "yours",
    title: "what's yours",
    accent: "text-fg",
    border: "border-border",
    items: [
      { lead: "The $5,000", detail: "A paper stake. Every trade, every ledger row, the whole P&L history — yours, synced to your sign-in." },
      { lead: "The reset button", detail: "Blow it up, start over, tracked honestly (we count your resets). $0 real dollars at risk, ever." },
      { lead: "The receipts", detail: "Verified-math ✓ on every indicator — and when we shipped one wrong, we published the autopsy." },
    ],
  },
];

function HonestyLedger({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // setTimeout, not rAF — rAF never fires in hidden/backgrounded tabs (the
    // Narrator lesson), and focus is a11y-critical.
    setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("button, [href]")?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // PORTAL, not an in-place render. <Nav> carries `.glass-strong`, whose
  // `backdrop-filter: blur(26px)` makes it a CONTAINING BLOCK for any
  // `position: fixed` descendant — so rendered in place, this "full-screen"
  // backdrop was sized to the nav pill itself (measured 1398×54 at y=47).
  // The consequences were all one bug: the 820×478 panel centred inside a
  // 54px strip landed at y=-165 with its ✕ button off-screen, the dimmer
  // only covered the nav bar, and the click-outside target was a 54px band
  // — so clicking anywhere on the page never closed it. Portalling to
  // <body> restores the viewport as the containing block, and keeps this
  // immune to any future filter/transform added to an ancestor.
  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="honesty-ledger-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="w-[820px] max-w-full surface-instrument border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 id="honesty-ledger-title" className="t-eyebrow font-semibold text-fg">
            <span className="text-bull">✓</span> the honesty ledger
          </h2>
          <button
            onClick={onClose}
            aria-label="Close the honesty ledger"
            className="size-7 border border-border bg-bg font-mono text-[11px] text-fg-dim hover:text-fg"
          >
            ✕
          </button>
        </div>

        <div className="grid gap-px bg-border sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.key} className="bg-surface p-4">
              <div className={`border-b ${col.border} pb-2 t-eyebrow font-semibold ${col.accent}`}>
                {col.title}
              </div>
              <ul className="mt-3 space-y-3">
                {col.items.map((it) => (
                  <li key={it.lead} className="font-mono text-[11px] leading-relaxed text-fg-dim">
                    <span className="font-semibold text-fg">{it.lead} — </span>
                    {it.detail}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 t-chrome text-fg-faint">
          <span>the glitch you just watched resolve is the only one on this site</span>
          <span className="flex gap-3 normal-case tracking-normal">
            <Link href="/learn/broken-vwap" className="text-[11px] text-fg-dim underline decoration-border underline-offset-2 hover:text-fg">
              the autopsy of our own bug
            </Link>
            <Link href="/graveyard" className="text-[11px] text-fg-dim underline decoration-border underline-offset-2 hover:text-fg">
              the graveyard
            </Link>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

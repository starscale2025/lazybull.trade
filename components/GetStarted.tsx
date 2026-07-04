"use client";

import Link from "next/link";
import { MagneticCTA } from "./atmosphere/MagneticCTA";

// The single landing the cinema hands off to (and the page's real, crawlable
// content now that the marketing sections are replaced by the animation).
const FEATURES = [
  "Visual options chain",
  "27 quant bots · 13 models",
  "AI crash detection",
  "$100K paper account",
];

export function GetStarted() {
  return (
    <section
      data-getstarted
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden border-t border-border bg-bg px-6 text-center"
    >
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[440px] w-[560px] -translate-x-1/2 rounded-full bg-bull/10 blur-[150px]" />

      <div className="relative flex flex-col items-center gap-8">
        <span className="inline-flex items-center gap-2 border border-bull/40 bg-bull/5 px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-bull">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" /> paper-only · $0 at risk, ever
        </span>

        <h2
          className="font-display text-fg"
          style={{ fontSize: "clamp(2.5rem, 7vw, 5.5rem)", lineHeight: 0.95, letterSpacing: "-0.02em" }}
        >
          Options you can <span className="italic font-light text-bull">see.</span>
        </h2>

        <p className="max-w-xl font-mono text-sm leading-relaxed text-fg-dim md:text-base">
          27 bots, 13 models and 8 live demos in one terminal. Learn it, backtest it,
          and only then trade it — on a $100K paper account, with an AI teacher over
          every Greek and a kill switch under everything.
        </p>

        <div className="mt-1 flex flex-col items-center gap-4 sm:flex-row">
          <MagneticCTA>
            <Link
              href="/trade"
              className="inline-flex items-center gap-2 bg-bull px-8 py-4 font-mono text-sm font-bold uppercase tracking-wider text-bg transition-transform"
            >
              Get started <span aria-hidden>→</span>
            </Link>
          </MagneticCTA>
          <Link
            href="/auth/signin"
            className="font-mono text-sm uppercase tracking-wider text-fg-dim underline-offset-4 hover:text-fg hover:underline"
          >
            or sign in
          </Link>
        </div>

        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-mono text-[11px] uppercase tracking-wider text-fg-faint">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-bull/60" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

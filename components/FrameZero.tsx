"use client";

/**
 * FRAME ZERO, the matter (2026-11-06).
 *
 * The first frame used to be the payoff instrument itself, with the H1 standing
 * on its P&L axis. It read as a chart on a grid: correct, and flat. The matter
 * (components/ui/anomalous-matter-hero.tsx, from 21st.dev) is the first thing
 * a visitor meets now, in the 2026-11 palette, and the instrument moved into
 * the landing (components/PayoffInstrument.tsx), where it has room to be
 * played with.
 *
 * Still the curtain: opaque and stacked above the film (z-30 over z-20), at
 * least one viewport tall, so scrolling lifts it off the pinned film exactly
 * as before (see CinemaGate).
 */

import Link from "next/link";
import { useSession } from "next-auth/react";
import { MagneticCTA } from "./atmosphere/MagneticCTA";
import { AnomalousMatterHero } from "./ui/anomalous-matter-hero";

export function FrameZero() {
  const { status } = useSession();
  const authed = status === "authenticated";

  return (
    <AnomalousMatterHero
      data-frame-zero
      aria-labelledby="fz-title"
      headingId="fz-title"
      className="z-30"
      title={
        <span className="border-grad inline-flex items-center gap-2 rounded-full bg-bg/75 px-3.5 py-1.5 t-chrome backdrop-blur-md">
          <span aria-hidden className="size-1.5 rounded-full bg-bull pulse-dot" />
          <span className="text-grad">paper-only · $0 at risk, ever</span>
        </span>
      }
      subtitle={
        <>
          Options you can <span className="t-accent">see</span>.
        </>
      }
      description={
        <>
          Build a position and watch its payoff, its Greeks and its worst case draw themselves,
          with an AI teacher explaining it in plain English. Then paper-trade it. Nothing real at
          risk, ever.
        </>
      }
    >
      <div className="matter-in mt-9 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 [animation-delay:320ms] [@media(max-height:760px)]:mt-6">
        <MagneticCTA>
          <Link
            href="/trade"
            className="btn-primary-glass group relative inline-flex items-center gap-2 px-9 py-4 font-mono text-sm font-bold uppercase tracking-wider"
          >
            <span className="relative z-10">{authed ? "Open the builder" : "Get started"}</span>
            <span
              aria-hidden
              className="relative z-10 transition-transform duration-300 [transition-timing-function:var(--ease-settle)] group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </MagneticCTA>
        <Link
          href={authed ? "/portfolio" : "/auth/signin"}
          className="inline-flex items-center py-3 font-mono text-sm uppercase tracking-wider text-fg-dim underline decoration-fg-faint/40 underline-offset-4 transition-[color,text-decoration-color] duration-300 [transition-timing-function:var(--ease-settle)] hover:text-fg hover:decoration-brand-ink"
        >
          {authed ? "your portfolio →" : "or sign in"}
        </Link>
      </div>

      {/* The problem, once, in the smallest voice. Quoted from SEBI's study
          of 20 Aug 2026 (FY26), linked, and never paired with an implied fix:
          it is the reason the product is paper-only. */}
      <p className="matter-in mt-10 max-w-md text-balance font-mono text-[0.6875rem] leading-relaxed text-fg-faint [animation-delay:440ms] [@media(max-height:760px)]:mt-5">
        87.7% of India&apos;s individual F&amp;O traders lost money in FY26 — 89% of those under 30.{" "}
        <a
          href="https://www.sebi.gov.in/reports-and-statistics/research/aug-2026/study-profitability-of-individual-traders-in-the-equity-derivatives-segment-fy25-fy26-_103835.html"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-fg-faint/50 underline-offset-2 transition-colors hover:text-fg-dim"
        >
          Source: SEBI, August 2026
        </a>
        .
      </p>
      <span aria-hidden className="matter-in mt-6 t-chrome text-fg-faint [animation-delay:560ms] [@media(max-height:760px)]:mt-3">
        scroll to watch the film ↓
      </span>
    </AnomalousMatterHero>
  );
}

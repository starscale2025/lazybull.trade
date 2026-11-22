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
import { useState } from "react";
import { useSession } from "next-auth/react";
import { MagneticCTA } from "./atmosphere/MagneticCTA";
import { AnomalousMatterHero } from "./ui/anomalous-matter-hero";
import { HeroPosition } from "./HeroPosition";

const FRAME_MAP = [
  { label: "Learn", href: "/learn" },
  { label: "Practice", href: "/practice" },
  { label: "Builder", href: "/trade" },
  { label: "Pricing", href: "/pricing" },
] as const;

export function FrameZero() {
  const { status } = useSession();
  const authed = status === "authenticated";
  // /start carries the market map, so it is fetched on intent (hover or focus),
  // not with the first frame: prefetched on sight it added ~56 KB to frame zero.
  const [warmStart, setWarmStart] = useState(false);

  return (
    <AnomalousMatterHero
      data-frame-zero
      aria-labelledby="fz-title"
      headingId="fz-title"
      className="z-30"
      // Nothing above the headline (2026-11-22): the pill that sat here said
      // what the paragraph says. The H1's "see." is this frame's one gradient.
      subtitle={
        <>
          Options you can <span className="t-accent">see</span>.
        </>
      }
      // The position, on the headline's own axis and as wide as it: frame zero's option (M12).
      beneath={<HeroPosition />}
      description={
        <>
          Build a position and watch its payoff, its Greeks and its worst case draw themselves,
          with an AI teacher explaining it in plain English. Then paper-trade it.
        </>
      }
      foot={
        // One quiet row along the foot of the frame: the rooms and the film in
        // the middle and, on a wide screen, the problem in the corner opposite
        // the shortcut dial. Narrower, the two stack in the middle as before.
        <div className="matter-in relative mt-10 w-full [animation-delay:440ms] [@media(max-height:760px)]:mt-6">
          {/* The problem, once, in the smallest voice. Quoted from SEBI's study
              of 20 Aug 2026 (FY26), linked, and never paired with an implied fix. */}
          <p className="mx-auto max-w-md text-balance text-[0.8125rem] leading-relaxed text-fg-faint xl:absolute xl:bottom-0 xl:right-2 xl:mx-0 xl:max-w-[20rem] xl:text-right">
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
          {/* Frame zero is also the map (M30): the four rooms, quietly, and the
              film as the last item, so the first screen carries the brand, the
              way in and the way past. One line, in the footnote's voice (M33).
              On a phone the rooms are one line and the film cue the next, so
              the row stays clear of the shortcut puck in the corner. */}
          <nav
            aria-label="Sections"
            className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[0.8125rem] text-fg-faint sm:gap-x-5 xl:mt-0 [@media(max-height:760px)]:mt-3"
          >
            {FRAME_MAP.map((m) => (
              // No prefetch: four rooms prefetched on sight cost frame zero
              // ~130 KB the visitor has not asked for (the budget caught it).
              <Link key={m.href} href={m.href} prefetch={false} className="py-1 transition-colors hover:text-fg">
                {m.label}
              </Link>
            ))}
            {/* Gone once the film has played and collapsed (ScrollCinema sets
                html[data-film-done]): there is no film below any more. */}
            <span className="fz-film-cue block w-full sm:contents">
              <span aria-hidden className="hidden sm:inline">
                ·
              </span>
              <span>or scroll for the film ↓</span>
            </span>
          </nav>
        </div>
      }
    >
      <div className="matter-in mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 [animation-delay:320ms] [@media(max-height:760px)]:mt-6">
        <MagneticCTA>
          {/* To /start, every page in one place over a live market map (owner, 2026-11-20). */}
          <Link
            href="/start"
            prefetch={warmStart ? null : false}
            onMouseEnter={() => setWarmStart(true)}
            onFocus={() => setWarmStart(true)}
            onTouchStart={() => setWarmStart(true)}
            className="btn-primary-glass tracking-[-0.01em] group relative inline-flex h-12 items-center rounded-full px-8 text-base font-semibold"
          >
            <span className="relative z-10">{authed ? "Explore lazybull" : "Get started"}</span>
          </Link>
        </MagneticCTA>
        {/* In the page's ink, not the brand's: the button is this frame's one green action. */}
        <Link href={authed ? "/portfolio" : "/auth/signin?callbackUrl=/"} className="calm-link py-3 !text-fg-dim hover:!text-fg">
          {authed ? "Your portfolio" : "Sign in"} <span aria-hidden>›</span>
        </Link>
      </div>
    </AnomalousMatterHero>
  );
}

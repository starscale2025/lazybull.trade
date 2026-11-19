"use client";

// The right rail of /practice: the streak month, the solved ring with three
// badges, and the way into the weekly set. Flat deck panes (slide 7's). Not
// sticky: the three panes stand taller than a laptop screen, so pinned they
// would hide their own lower half for the whole length of the problem set.
// Today's problem moved up beside the headline (TodayCard).
//
// Everything date-shaped comes from the progress hook's `today`, which is the
// build-time fallback on the server and the real calendar day after mount —
// no Date.now() in a render path here. The streak and the ring are computed
// from the solver's own ledger (lib/practice/progress.ts): this device's, or
// the server's once signed in.

import Link from "next/link";
import { useMemo } from "react";
import { SolvedRing } from "@/components/practice/SolvedRing";
import { StreakCalendar } from "@/components/practice/StreakCalendar";
import { BadgeGrid } from "@/components/practice/Badges";
import { usePracticeProgress } from "@/lib/practice/progress";
import { activityFor, computeBadges } from "@/lib/practice/summary";

function RailPane({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <section className="deck-pane p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">{title}</h3>
        {right && <span className="deck-label">{right}</span>}
      </div>
      {children}
    </section>
  );
}

export function PracticeRail() {
  const { state, summary, today, signedIn, source } = usePracticeProgress();
  const activity = useMemo(() => activityFor(state), [state]);
  const badges = computeBadges(summary).slice(0, 3);
  const solved = {
    easy: summary.byDifficulty.easy.solved,
    medium: summary.byDifficulty.medium.solved,
    hard: summary.byDifficulty.hard.solved,
  };
  const total = {
    easy: summary.byDifficulty.easy.total,
    medium: summary.byDifficulty.medium.total,
    hard: summary.byDifficulty.hard.total,
  };

  return (
    <aside aria-label="Your practice" className="space-y-4 lg:self-start">
      <RailPane title="Streak" right={source === "server" ? "Your account" : "This device"}>
        <div className="mt-5 grid grid-cols-2 border-y border-border">
          <div className="py-3 pr-3">
            <div className="deck-label">Current</div>
            <div className="deck-figure mt-1.5 text-[2.25rem] text-fg">
              {summary.streak.current}
              <span className="ml-1 font-sans text-[0.875rem] not-italic text-fg-faint">d</span>
            </div>
          </div>
          <div className="border-l border-border py-3 pl-4">
            <div className="deck-label">Longest</div>
            <div className="deck-figure mt-1.5 text-[2.25rem] text-fg">
              {summary.streak.longest}
              <span className="ml-1 font-sans text-[0.875rem] not-italic text-fg-faint">d</span>
            </div>
          </div>
        </div>
        <StreakCalendar activity={activity} today={today} className="mt-4" />
        {!signedIn && <p className="mt-3 text-[0.8125rem] leading-snug text-fg-faint">Sign in to keep the streak on every device.</p>}
      </RailPane>

      <RailPane title="Progress" right="All tracks">
        <SolvedRing solved={solved} total={total} size={96} caption="solved, by level" className="mt-5" />
        <BadgeGrid badges={badges} cols={3} compact className="mt-5 border-t border-border pt-4" />
        <Link href="/practice/profile" className="deck-link mt-5 text-[0.875rem]">
          Your profile
          <span aria-hidden className="deck-arrow">
            →
          </span>
        </Link>
      </RailPane>

      <RailPane title="Weekly set" right="Sundays">
        <p className="mt-3 text-[0.875rem] leading-relaxed text-fg-dim">
          Four problems, ninety minutes. Ranked on solves and time, never on money.
        </p>
        <Link href="/practice/contest" className="deck-link mt-4 text-[0.875rem]">
          See this week’s set
          <span aria-hidden className="deck-arrow">
            →
          </span>
        </Link>
      </RailPane>
    </aside>
  );
}

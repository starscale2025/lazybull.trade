"use client";

// The right rail of /practice: today's problem, the streak month, the solved
// ring with three badges. Three stacked ./Panel.tsx frames — the panel skeleton
// from components/quant/OutputPanel.tsx (lines 46-60). Sticky from lg so the
// daily card stays in view while the table scrolls.
//
// Everything date-shaped comes from the progress hook's `today`, which is the
// build-time fallback on the server and the real calendar day after mount —
// no Date.now() in a render path here. The streak and the ring are computed
// from the solver's own ledger (lib/practice/progress.ts): this device's, or
// the server's once signed in.

import Link from "next/link";
import { useMemo } from "react";
import { Panel } from "@/components/practice/Panel";
import { DifficultyPill, TrackChip } from "@/components/practice/Chips";
import { Stat } from "@/components/practice/Table";
import { SolvedRing } from "@/components/practice/SolvedRing";
import { StreakCalendar } from "@/components/practice/StreakCalendar";
import { BadgeGrid } from "@/components/practice/Badges";
import { DAILY_SLUG, getMeta } from "@/lib/practice/problems";
import { usePracticeProgress } from "@/lib/practice/progress";
import { activityFor, computeBadges } from "@/lib/practice/summary";

/** The one primary control in the rail — the ▶ run button's dress from the
    workspace, as a link. */
const PRIMARY =
  "inline-flex h-7 items-center gap-2 border border-bull bg-bull/10 px-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-bull hover:bg-bull hover:text-bg";

export function PracticeRail() {
  const { state, summary, today, signedIn, source } = usePracticeProgress();
  const daily = getMeta(DAILY_SLUG);
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
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <Panel as="div" title="Daily problem" sub="one a day keeps the streak" bodyClassName="p-3">
        {daily && (
          <>
            <Link
              href={`/practice/${daily.id}`}
              className="font-display text-base tracking-tightest text-fg hover:text-bull"
            >
              {daily.title}
            </Link>
            {/* Lowercase mono micro-copy (the GetStarted.tsx index blurb), not
                t-chrome: a two-sentence blurb is body, and t-chrome uppercases. */}
            <p className="mt-1 font-mono text-[0.6875rem] leading-relaxed text-fg-dim">{daily.blurb}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TrackChip track={daily.track} />
              <DifficultyPill difficulty={daily.difficulty} />
              <span className="t-chrome text-fg-faint">{daily.minutes} min</span>
            </div>
            <Link href={`/practice/${daily.id}`} className={`mt-3 ${PRIMARY}`}>
              ▶ solve
            </Link>
          </>
        )}
      </Panel>

      <Panel
        as="div"
        title="Streak"
        right={source === "server" ? "your account" : signedIn ? "this device" : "this device · sign in to keep it"}
        bodyClassName="p-3"
      >
        <StreakCalendar activity={activity} today={today} />
        <div className="mt-3 grid grid-cols-2 gap-px border border-border bg-border">
          <Stat label="current" value={`${summary.streak.current}d`} />
          <Stat label="longest" value={`${summary.streak.longest}d`} />
        </div>
      </Panel>

      <Panel as="div" title="Progress" bodyClassName="p-3">
        <SolvedRing solved={solved} total={total} size={96} caption="all tracks" />
        <BadgeGrid badges={badges} cols={3} compact className="mt-3" />
        <Link href="/practice/profile" className="mt-3 inline-block t-chrome text-fg-faint hover:text-bull">
          profile →
        </Link>
      </Panel>
    </aside>
  );
}

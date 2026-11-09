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
import { CalmLink, CalmPanel, PillLink, Stats } from "@/components/calm/kit";
import { DifficultyPill, TrackChip } from "@/components/practice/Chips";
import { SolvedRing } from "@/components/practice/SolvedRing";
import { StreakCalendar } from "@/components/practice/StreakCalendar";
import { BadgeGrid } from "@/components/practice/Badges";
import { DAILY_SLUG, getMeta } from "@/lib/practice/problems";
import { usePracticeProgress } from "@/lib/practice/progress";
import { activityFor, computeBadges } from "@/lib/practice/summary";


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
      {/* Calm (S1, 2026-11-09): the daily card is a calm panel, and its
          button the quiet pill: the page's one primary, "Start today's
          problem", is in the header above. */}
      <CalmPanel title="Today’s problem" aside="one a day keeps the streak">
        {daily && (
          <>
            <Link href={`/practice/${daily.id}`} className="font-display text-xl tracking-tightest text-fg hover:text-brand-ink">
              {daily.title}
            </Link>
            <p className="mt-1.5 text-[0.875rem] leading-relaxed text-fg-dim">{daily.blurb}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TrackChip track={daily.track} />
              <DifficultyPill difficulty={daily.difficulty} />
              <span className="text-[0.75rem] text-fg-faint">{daily.minutes} min</span>
            </div>
            <PillLink href={`/practice/${daily.id}`} size="sm" className="mt-4">
              Solve it
            </PillLink>
          </>
        )}
      </CalmPanel>

      <Panel
        as="div"
        calm
        title="Streak"
        right={source === "server" ? "Your account" : signedIn ? "This device" : "This device · sign in to keep it"}
        bodyClassName="px-5 pb-5 pt-4"
      >
        <StreakCalendar activity={activity} today={today} />
        <Stats
          className="mt-5"
          items={[
            { value: `${summary.streak.current} d`, label: "current" },
            { value: `${summary.streak.longest} d`, label: "longest" },
          ]}
        />
      </Panel>

      <Panel as="div" calm title="Progress" bodyClassName="px-5 pb-5 pt-4">
        <SolvedRing solved={solved} total={total} size={96} caption="all tracks" />
        <BadgeGrid badges={badges} cols={3} compact className="mt-3" />
        <CalmLink href="/practice/profile" className="mt-4">
          Your profile
        </CalmLink>
      </Panel>
    </aside>
  );
}

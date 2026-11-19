"use client";

// Today's problem, beside the /practice headline: no box, set large and
// centred, the whole of it a link into the workspace. A client component only
// for the status circle, read from the solver's ledger
// (lib/practice/progress.ts) — its first render is the empty ledger,
// identical on the server and the client.

import Link from "next/link";
import type { CSSProperties } from "react";
import { DifficultyPill, StatusGlyph, TrackChip } from "@/components/practice/Chips";
import { DAILY_SLUG, getMeta } from "@/lib/practice/problems";
import { usePracticeProgress } from "@/lib/practice/progress";

export function TodayCard({ className = "", style }: { className?: string; style?: CSSProperties }) {
  const { statusOf } = usePracticeProgress();
  const daily = getMeta(DAILY_SLUG);
  if (!daily) return null;
  const status = statusOf(daily.id);

  return (
    <Link
      href={`/practice/${daily.id}`}
      style={style}
      className={`group flex flex-col items-center self-center rounded-[14px] text-center focus-visible:!outline-offset-8 ${className}`}
    >
      <span className="deck-eyebrow text-[0.8125rem] text-fg">Today’s problem</span>
      <span className="mt-7 deck-label text-[0.8125rem]">
        №&nbsp;{String(daily.num).padStart(2, "0")} · {daily.minutes} min
      </span>
      <h2 className="deck-display mt-3 text-[clamp(2.25rem,3.6vw,3rem)] leading-[1.05] tracking-[-0.025em] text-fg transition-colors group-hover:text-bull">
        {daily.title}
      </h2>
      <p className="mt-4 max-w-[26rem] text-[1.125rem] leading-[1.6] text-fg-dim">{daily.blurb}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <DifficultyPill difficulty={daily.difficulty} className="h-7 px-2.5 text-[0.875rem]" />
        <TrackChip track={daily.track} className="h-7 px-2.5 text-[0.875rem]" />
      </div>
      <div className="mt-8 flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-border pt-6">
        <span className="flex items-center gap-2.5 text-[0.9375rem] text-fg-faint">
          <StatusGlyph status={status} size={16} />
          {status === "solved" ? "Solved · on your record" : "One a day keeps the streak"}
        </span>
        <span className="deck-link text-[1rem]">
          {status === "solved" ? "Open" : "Solve"}
          <span aria-hidden className="deck-arrow">
            →
          </span>
        </span>
      </div>
    </Link>
  );
}

"use client";

// The ordered path down a track: a vertical connector, one numbered row per
// problem with its status glyph, pill and minutes, and the first unsolved row
// lit with an inline `start →`. The numbered-steps feel is the workspace's
// reorder rail; the row grid is the hairline `border-b border-border-soft`
// list idiom from components/quant/BotLibrary.tsx (line 62).
//
// Three client exports share the progress hook so the page can stay a server
// component: TrackPath (the list), TrackAside (the ring + outcomes) and
// TrackStartLink (the hero CTA, pointed at the solver's next unsolved problem
// rather than the first row, which may already be ticked).

import Link from "next/link";
import type { ReactNode } from "react";
import { Panel } from "@/components/practice/Panel";
import { DifficultyPill, LockPill, StatusGlyph } from "@/components/practice/Chips";
import { SolvedRing } from "@/components/practice/SolvedRing";
import { problemsByTrack } from "@/lib/practice/problems";
import { usePracticeProgress } from "@/lib/practice/progress";
import { TRACK_META } from "@/lib/practice/tracks";
import type { Difficulty, ProblemMeta, TrackId } from "@/lib/practice/types";

/** The ▶ run button's dress from the workspace, as a link. */
const PRIMARY =
  "inline-flex h-7 items-center gap-2 border border-bull bg-bull/10 px-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-bull hover:bg-bull hover:text-bg";

/** What finishing the track leaves you able to do. Three lines each; the
    `›` marker follows the GlassPoints rule (marker in bull, text dim). */
export const TRACK_OUTCOMES: Record<TrackId, string[]> = {
  finance: [
    "price a European option and say who pays the strike, and when",
    "turn a coupon ladder into a price and a duration",
    "read a drawdown off an equity curve without flinching",
  ],
  quant: [
    "annualise a Sharpe and know what the √252 is doing",
    "run a Kalman filter over a noisy price level",
    "size a tail with Monte Carlo VaR and say what it misses",
  ],
  ml: [
    "label a series with triple barriers and zero lookahead",
    "split time series without leaking the future into a fold",
    "turn quantile outputs into a signal you can defend",
  ],
  maths: [
    "evaluate a normal CDF with hand-rolled numerics",
    "generate correlated shocks from a Cholesky factor",
    "find a root with Newton and know when it will not converge",
  ],
  trading: [
    "compute a session VWAP tick by tick",
    "size a position from a stop, not from a feeling",
    "backtest a long-only rule with costs that bite",
  ],
};

export function TrackPath({ track, problems }: { track: TrackId; problems: ProblemMeta[] }) {
  const { statusOf } = usePracticeProgress();
  const nextSlug = problems.find((p) => statusOf(p.id) !== "solved")?.id ?? null;

  return (
    <ol aria-label={`${TRACK_META[track].label} problems, in order`} className="relative">
      {/* the connector — runs behind the status nodes, which mask it with bg-bg */}
      <span aria-hidden className="absolute bottom-0 left-5 top-0 w-px bg-border" />
      {problems.map((p) => {
        const status = statusOf(p.id);
        const isNext = p.id === nextSlug;
        return (
          <li
            key={p.id}
            aria-current={isNext ? "step" : undefined}
            className={`relative grid grid-cols-[1.5rem_1fr_auto] items-center gap-3 border-b border-border-soft px-2 py-3 ${
              isNext ? "bg-bull/[0.04]" : ""
            }`}
          >
            <span className="relative grid size-6 place-items-center bg-bg">
              <StatusGlyph status={status} />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="t-data t-chrome text-fg-faint">{String(p.num).padStart(2, "0")}</span>
                <Link
                  href={`/practice/${p.id}`}
                  className="font-display text-[0.9375rem] tracking-tightest text-fg hover:text-bull"
                >
                  {p.title}
                </Link>
                {p.lock && <LockPill lock={p.lock} />}
              </div>
              {/* Lowercase mono micro-copy (the GetStarted.tsx index blurb), not
                  t-chrome: a blurb is a sentence, and t-chrome uppercases. */}
              <p className="mt-0.5 font-mono text-[0.6875rem] leading-relaxed text-fg-dim">{p.blurb}</p>
            </div>
            <div className="flex items-center gap-2">
              <DifficultyPill difficulty={p.difficulty} />
              <span className="whitespace-nowrap t-chrome text-fg-faint">{p.minutes} min</span>
              {isNext && (
                <Link href={`/practice/${p.id}`} className={PRIMARY}>
                  start →
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** The track page's aside: this track's solved ring, then what you leave with. */
export function TrackAside({ track }: { track: TrackId }) {
  const { statusOf } = usePracticeProgress();
  const meta = TRACK_META[track];
  const solved: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const total: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  for (const p of problemsByTrack(track)) {
    total[p.difficulty]++;
    if (statusOf(p.id) === "solved") solved[p.difficulty]++;
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      <Panel as="div" title="Progress" bodyClassName="p-3">
        <SolvedRing solved={solved} total={total} size={96} caption={meta.label} />
      </Panel>
      <Panel as="div" title="You leave able to" bodyClassName="p-3">
        <ul className="space-y-2">
          {TRACK_OUTCOMES[track].map((line) => (
            <li key={line} className="flex gap-2 font-mono text-[0.6875rem] leading-relaxed text-fg-dim">
              <span aria-hidden className="text-bull">
                ›
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </aside>
  );
}

/** The hero CTA — a link to the track's next unsolved problem, falling back to
    the first row once the track is complete. Progress comes from the hook, so
    the server and the first client render both point at the first row and the
    effect moves it. */
export function TrackStartLink({
  track,
  fallback,
  className,
  children,
}: {
  track: TrackId;
  fallback: string;
  className: string;
  children: ReactNode;
}) {
  const { summary } = usePracticeProgress();
  const slug = summary.byTrack[track].nextSlug ?? fallback;
  return (
    <Link href={`/practice/${slug}`} className={className}>
      {children}
    </Link>
  );
}

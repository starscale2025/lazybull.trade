"use client";

// The ordered path down a track, in the pitch deck's hand (2026-11-17): one
// flat pane (the Playground mockup's), a row per problem ruled off by
// hairlines, and down the left the deck's circle legend (slide 15) — ● solved,
// ◐ attempted, ○ not yet — strung on a thin connector. The first unsolved row
// is lit the way slide 15 lights its one highlighted row: a faint green wash,
// here with an inline Start. The legend itself sits under the list.
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

/** What finishing the track leaves you able to do. Three lines each; the
    `›` marker is the deck's green, the line itself the reading grey. */
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

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The next row's wash, and the same wash made opaque for its status node,
    which has to mask the connector it sits on. */
const NEXT_ROW = "bg-[color-mix(in_srgb,var(--bull)_7%,transparent)]";
const NEXT_NODE = "bg-[color-mix(in_srgb,var(--bull)_7%,var(--deck-pane))]";

export function TrackPath({ track, problems }: { track: TrackId; problems: ProblemMeta[] }) {
  const { statusOf } = usePracticeProgress();
  const nextSlug = problems.find((p) => statusOf(p.id) !== "solved")?.id ?? null;

  return (
    <div className="deck-pane min-w-0 p-2 md:p-3">
      <ol aria-label={`${TRACK_META[track].label} problems, in order`}>
        {problems.map((p, i) => {
          const status = statusOf(p.id);
          const isNext = p.id === nextSlug;
          return (
            <li
              key={p.id}
              aria-current={isNext ? "step" : undefined}
              className={`relative grid grid-cols-[1.5rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-2.5 border-b border-border px-2 py-4 last:border-b-0 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto] sm:gap-x-4 ${
                isNext ? NEXT_ROW : ""
              }`}
            >
              {/* The connector, one segment a row: from this node's centre to
                  the next one's, which masks the end of it. Every node sits the
                  same distance below its row's top (1.75rem; 2.375rem on a
                  touch screen, where the title link is 44px tall), so the
                  segment needs no measuring however tall a row grows. */}
              {i < problems.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -bottom-7 left-5 top-7 w-px bg-[var(--deck-rule)] pointer-coarse:-bottom-[2.375rem] pointer-coarse:top-[2.375rem]"
                />
              )}
              <span
                className={`relative grid size-6 place-items-center self-start rounded-full pointer-coarse:mt-2.5 ${
                  isNext ? NEXT_NODE : "bg-[var(--deck-pane)]"
                }`}
              >
                <StatusGlyph status={status} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="t-data text-[0.75rem] text-fg-faint">{String(p.num).padStart(2, "0")}</span>
                  <Link
                    href={`/practice/${p.id}`}
                    className="font-sans text-[0.9375rem] font-medium tracking-[-0.005em] text-fg transition-colors hover:text-bull"
                  >
                    {p.title}
                  </Link>
                  {p.lock && <LockPill lock={p.lock} />}
                </div>
                <p className="mt-1 max-w-[40rem] text-[0.8125rem] leading-relaxed text-fg-faint">{p.blurb}</p>
              </div>
              {/* Under the title on a phone, where the row has no third column. */}
              <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-2 sm:col-start-3 sm:justify-end">
                <DifficultyPill difficulty={p.difficulty} />
                <span className="whitespace-nowrap t-data text-[0.75rem] text-fg-faint">{p.minutes} min</span>
                {/* -my-1: the pill is taller than the line it sits on; this keeps
                    it from pushing the row's baseline down. */}
                {isNext && (
                  <Link href={`/practice/${p.id}`} className="deck-btn deck-btn-sm -my-1">
                    Start
                    <span aria-hidden className="deck-arrow">
                      →
                    </span>
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {/* The key to the circles, as slide 15 sets it under its table. Each row's
          circle already carries its own label for a screen reader. */}
      <div
        aria-hidden
        className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border px-2 pb-1 pt-3.5 text-[0.75rem] text-fg-faint"
      >
        <span className="inline-flex items-center gap-2">
          <StatusGlyph status="solved" />
          Solved
        </span>
        <span className="inline-flex items-center gap-2">
          <StatusGlyph status="attempted" />
          Attempted
        </span>
        <span className="inline-flex items-center gap-2">
          <StatusGlyph status="todo" />
          Not started
        </span>
      </div>
    </div>
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
      <Panel as="div" calm title="Progress" bodyClassName="px-5 pb-5 pt-5">
        <SolvedRing solved={solved} total={total} size={96} caption={meta.label} />
      </Panel>
      <Panel as="div" calm title="You leave able to" bodyClassName="px-5 pb-3 pt-2">
        <ul className="divide-y divide-border">
          {TRACK_OUTCOMES[track].map((line) => (
            <li key={line} className="flex gap-3 py-3 text-[0.875rem] leading-relaxed text-fg-dim">
              <span aria-hidden className="font-mono text-bull">
                ›
              </span>
              <span>{cap(line)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </aside>
  );
}

/** The hero CTA — the page's one primary, a link to the track's next
    unsolved problem, falling back to the first row once the track is complete.
    Progress comes from the hook, so the server and the first client render both
    point at the first row and the effect moves it. */
export function TrackStartLink({
  track,
  fallback,
  className = "",
  children,
}: {
  track: TrackId;
  fallback: string;
  className?: string;
  children: ReactNode;
}) {
  const { summary } = usePracticeProgress();
  const slug = summary.byTrack[track].nextSlug ?? fallback;
  return (
    <Link href={`/practice/${slug}`} className={`deck-btn deck-btn-primary deck-btn-lg ${className}`}>
      {children}
      <span aria-hidden className="deck-arrow">
        →
      </span>
    </Link>
  );
}

"use client";

// The ordered path down a track: a vertical connector, one numbered row per
// problem with its status glyph, chip and minutes, and the first unsolved row
// lit with an inline Start pill. The rows are plain, inside one calm panel; the
// numbered-steps feel is the workspace's reorder rail.
//
// Three client exports share the progress hook so the page can stay a server
// component: TrackPath (the list), TrackAside (the ring + outcomes) and
// TrackStartLink (the hero CTA, pointed at the solver's next unsolved problem
// rather than the first row, which may already be ticked).

import Link from "next/link";
import type { ReactNode } from "react";
import { PillLink } from "@/components/calm/kit";
import { Panel } from "@/components/practice/Panel";
import { DifficultyPill, LockPill, StatusGlyph } from "@/components/practice/Chips";
import { SolvedRing } from "@/components/practice/SolvedRing";
import { problemsByTrack } from "@/lib/practice/problems";
import { usePracticeProgress } from "@/lib/practice/progress";
import { TRACK_META } from "@/lib/practice/tracks";
import type { Difficulty, ProblemMeta, TrackId } from "@/lib/practice/types";

/** What finishing the track leaves you able to do. Three lines each; the
    `›` marker follows the GlassPoints rule (marker in the reading colour,
    text dim). */
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
    <div className="calm-panel min-w-0 p-2 md:p-3">
      <i aria-hidden className="lit-aura" />
      <ol aria-label={`${TRACK_META[track].label} problems, in order`} className="relative">
        {/* the connector — runs behind the status nodes, which mask it with
            bg-bg; it starts and ends inside the first and last node */}
        <span aria-hidden className="absolute bottom-7 left-5 top-7 w-px bg-border" />
        {problems.map((p) => {
          const status = statusOf(p.id);
          const isNext = p.id === nextSlug;
          return (
            <li
              key={p.id}
              aria-current={isNext ? "step" : undefined}
              className={`relative grid grid-cols-[1.5rem_1fr] items-center gap-3 border-b px-2 py-3 last:border-b-0 sm:grid-cols-[1.5rem_1fr_auto] ${
                isNext ? "rounded-[14px] border-transparent bg-brand-ink/[0.07]" : "border-[color-mix(in_srgb,var(--fg)_6%,transparent)]"
              }`}
            >
              <span className="relative grid size-6 place-items-center rounded-full bg-bg">
                <StatusGlyph status={status} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="t-data text-[0.75rem] text-fg-faint">{String(p.num).padStart(2, "0")}</span>
                  <Link
                    href={`/practice/${p.id}`}
                    className="font-sans text-[0.9375rem] font-medium tracking-[-0.01em] text-fg hover:text-brand-ink"
                  >
                    {p.title}
                  </Link>
                  {p.lock && <LockPill lock={p.lock} />}
                </div>
                <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-fg-dim">{p.blurb}</p>
              </div>
              {/* Under the title on a phone, where the row has no third column. */}
              <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3">
                <DifficultyPill difficulty={p.difficulty} />
                <span className="whitespace-nowrap t-label text-fg-faint">{p.minutes} min</span>
                {isNext && (
                  <PillLink href={`/practice/${p.id}`} size="sm">
                    Start
                  </PillLink>
                )}
              </div>
            </li>
          );
        })}
      </ol>
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
      <Panel as="div" calm title="Progress" bodyClassName="px-5 pb-5 pt-4">
        <SolvedRing solved={solved} total={total} size={96} caption={meta.label} />
      </Panel>
      <Panel as="div" calm title="You leave able to" bodyClassName="px-5 pb-5 pt-3">
        <ul className="space-y-2">
          {TRACK_OUTCOMES[track].map((line) => (
            <li key={line} className="flex gap-2 text-[0.875rem] leading-relaxed text-fg-dim">
              <span aria-hidden className="text-brand-ink">
                ›
              </span>
              <span>{line.charAt(0).toUpperCase() + line.slice(1)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </aside>
  );
}

/** The hero CTA — the page's one primary pill, a link to the track's next
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
    <PillLink href={`/practice/${slug}`} kind="primary" className={className}>
      {children}
    </PillLink>
  );
}

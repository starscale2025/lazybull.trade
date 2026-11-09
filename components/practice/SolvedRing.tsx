// The solved donut — a pure SVG instrument, hand-rolled the way the sparkline
// in components/admin/KpiStrip.tsx (lines 4-26) and the rail curve in
// components/learn/ChapterNav.tsx are: no chart library, colours as CSS vars
// so the ring follows the theme. Three arcs — easy, medium, hard — laid end
// to end from 12 o'clock, each proportional to solved / total-of-everything,
// so the empty remainder of the track is the work still to do. The legend
// under it is three plain columns, each with its arc's swatch.
//
// PURE — props in, markup out. The container computes the counts.

import { DIFFICULTY_META } from "@/lib/practice/types";
import type { Difficulty } from "@/lib/practice/types";

const ORDER: Difficulty[] = ["easy", "medium", "hard"];

/** One hue at three strengths: a difficulty is not a gain or a loss. */
const ARC: Record<Difficulty, string> = {
  easy: "color-mix(in srgb, var(--brand-ink) 42%, transparent)",
  medium: "color-mix(in srgb, var(--brand-ink) 70%, transparent)",
  hard: "var(--brand-ink)",
};

/** Stroke and centre-text geometry per size. The dy values seat the big count
    and the "/total" line either side of centre without the glyphs touching. */
const GEO = {
  96: { stroke: 8, big: "text-[1.25rem]", bigDy: -5, smallDy: 9 },
  160: { stroke: 12, big: "text-[2rem]", bigDy: -6, smallDy: 16 },
} as const;

export type SolvedRingProps = {
  solved: Record<Difficulty, number>;
  total: Record<Difficulty, number>;
  size?: 96 | 160;
  /** A `t-label` line under the ring — "all tracks", "this week". */
  caption?: string;
  className?: string;
};

export function SolvedRing({ solved, total, size = 160, caption, className = "" }: SolvedRingProps) {
  const geo = GEO[size];
  const c = size / 2;
  const r = c - geo.stroke / 2;
  const circ = 2 * Math.PI * r;
  const solvedAll = ORDER.reduce((n, d) => n + solved[d], 0);
  const totalAll = ORDER.reduce((n, d) => n + total[d], 0);

  // Each arc is a dash of its own length followed by a gap of the rest of the
  // ring; a negative dashoffset walks the dash's start forward past the arcs
  // already drawn. Guarded against a zero total so nothing divides to NaN.
  let walked = 0;
  const arcs = ORDER.map((d) => {
    const len = totalAll > 0 ? (solved[d] / totalAll) * circ : 0;
    const arc = { d, len, offset: walked };
    walked += len;
    return arc;
  });

  // The compact ring is just the ring unless a caption asks for the fuller instrument.
  const showLegend = !(size === 96 && !caption);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`${solvedAll} of ${totalAll} solved`}
        className="block shrink-0"
      >
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border)" strokeWidth={geo.stroke} />
        <g transform={`rotate(-90 ${c} ${c})`}>
          {arcs.map(({ d, len, offset }) =>
            len > 0 ? (
              <circle
                key={d}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={ARC[d]}
                strokeWidth={geo.stroke}
                strokeLinecap="butt"
                strokeDasharray={`${len.toFixed(2)} ${(circ - len).toFixed(2)}`}
                strokeDashoffset={(-offset).toFixed(2)}
              />
            ) : null
          )}
        </g>
        <text
          x={c}
          y={c + geo.bigDy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--fg)"
          className={`t-data ${geo.big}`}
        >
          {solvedAll}
        </text>
        <text
          x={c}
          y={c + geo.smallDy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--fg-faint)"
          className="t-data text-[0.6875rem]"
        >
          /{totalAll}
        </text>
      </svg>
      {caption && <div className="mt-2 t-label text-fg-faint">{caption.charAt(0).toUpperCase() + caption.slice(1)}</div>}
      {showLegend && (
        <div className="mt-4 grid w-full grid-cols-3 gap-3">
          {ORDER.map((d) => (
            <div key={d}>
              <div className="flex items-center gap-1.5 t-label text-fg-faint">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: ARC[d] }} />
                {DIFFICULTY_META[d].label.charAt(0).toUpperCase() + DIFFICULTY_META[d].label.slice(1)}
              </div>
              <div className="mt-0.5 t-data text-[0.8125rem] text-fg">
                {solved[d]}
                <span className="text-fg-faint">/{total[d]}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

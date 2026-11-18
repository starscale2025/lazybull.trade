// THE FIGURE KIT, part one: the frame every figure stands in, and the small
// marks that go in it (plan A5, Stage 3). Server-renderable SVG with no hooks,
// so a static figure ships no JavaScript. The rules it enforces:
//  - hairline axes and solid hairline grids (never dashed), tracked-caps labels;
//  - a title and a description on every figure (role="img"), so it reads
//    without colour and without sight;
//  - one y axis per figure; ticks on nice steps, zero drawn when it is in range;
//  - text in the text colours, never in a data colour;
//  - it keeps its aspect ratio: a figure never stretches its lines to fill a box.

import type { ReactNode } from "react";
import { linear, sqrt, tickLabel, niceStep, type Scale } from "@/lib/viz/scale";

export type Axis = {
  domain: [number, number];
  label?: string;
  ticks?: number[];
  format?: (v: number) => string;
  /** Square-root spacing, for a height that runs to a spike. */
  sqrt?: boolean;
};
export type Box = { l: number; r: number; t: number; b: number; w: number; h: number };
export type Plot = { x: Scale; y: Scale; box: Box };

const MONO = "var(--font-jetbrains), ui-monospace, monospace";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export function Frame({
  title,
  desc,
  x,
  y,
  width = 640,
  height = 280,
  margin = {},
  id,
  className = "",
  children,
}: {
  title: string;
  /** What the figure shows, in a sentence or two: its text alternative. */
  desc: string;
  x: Axis;
  y: Axis;
  width?: number;
  height?: number;
  margin?: Partial<Omit<Box, "w" | "h">>;
  id?: string;
  className?: string;
  children: (p: Plot) => ReactNode;
}) {
  const fid = id ?? `fig-${slug(title)}`;
  const l = margin.l ?? 52;
  const r = margin.r ?? 20;
  const t = margin.t ?? 16;
  const b = margin.b ?? (x.label ? 46 : 30);
  const box: Box = { l, r, t, b, w: width - l - r, h: height - t - b };
  const xs = (x.sqrt ? sqrt : linear)(x.domain, [l, l + box.w]);
  const ys = (y.sqrt ? sqrt : linear)(y.domain, [t + box.h, t]);
  const xt = x.ticks ?? xs.ticks(5);
  const yt = y.ticks ?? ys.ticks(4);
  const xf = x.format ?? ((v: number) => tickLabel(v, niceStep((x.domain[1] - x.domain[0]) / 5)));
  const yf = y.format ?? ((v: number) => tickLabel(v, niceStep((y.domain[1] - y.domain[0]) / 4)));
  const [y0, y1] = [Math.min(...y.domain), Math.max(...y.domain)];
  const zero = y0 < 0 && y1 > 0 ? ys(0) : null;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${fid}-t ${fid}-d`}
      className={`block h-auto w-full overflow-visible ${className}`}
    >
      <title id={`${fid}-t`}>{title}</title>
      <desc id={`${fid}-d`}>{desc}</desc>
      {/* grid: solid hairlines at the y ticks */}
      {yt.map((v) => (
        <line key={`g${v}`} x1={l} x2={l + box.w} y1={ys(v)} y2={ys(v)} stroke="var(--viz-grid)" strokeWidth={1} />
      ))}
      {zero !== null && <line x1={l} x2={l + box.w} y1={zero} y2={zero} stroke="var(--viz-axis)" strokeWidth={1} />}
      <line x1={l} x2={l + box.w} y1={t + box.h} y2={t + box.h} stroke="var(--viz-axis)" strokeWidth={1} />
      <g fontFamily={MONO} fontSize={11} fill="var(--fg-dim)" style={{ fontVariantNumeric: "tabular-nums" }}>
        {xt.map((v) => (
          <text key={`x${v}`} x={xs(v)} y={t + box.h + 17} textAnchor="middle">
            {xf(v)}
          </text>
        ))}
        {yt.map((v) => (
          <text key={`y${v}`} x={l - 8} y={ys(v) + 3.5} textAnchor="end">
            {yf(v)}
          </text>
        ))}
      </g>
      <g fontFamily={MONO} fontSize={10} fill="var(--fg-faint)" letterSpacing="0.08em">
        {x.label && (
          <text x={l + box.w / 2} y={height - 8} textAnchor="middle">
            {x.label.toUpperCase()}
          </text>
        )}
        {y.label && (
          <text x={l} y={t - 4} textAnchor="start">
            {y.label.toUpperCase()}
          </text>
        )}
      </g>
      {children({ x: xs, y: ys, box })}
    </svg>
  );
}

/** A point on a line: at least 8 px across, with a ring in the ground colour. */
export function Marker({ cx, cy, color = "var(--viz-model)", r = 4.5 }: { cx: number; cy: number; color?: string; r?: number }) {
  return <circle cx={cx} cy={cy} r={r} fill={color} stroke="var(--bg)" strokeWidth={2} />;
}

/** The value at a line's end: its marker, and the number in the text colour beside it. */
export function LastValue({ cx, cy, text, color, side = "right" }: { cx: number; cy: number; text: string; color?: string; side?: "left" | "right" }) {
  return (
    <g>
      <Marker cx={cx} cy={cy} color={color} />
      <text
        x={cx + (side === "right" ? 9 : -9)}
        y={cy + 4}
        textAnchor={side === "right" ? "start" : "end"}
        fontFamily={MONO}
        fontSize={11}
        fill="var(--fg)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {text}
      </text>
    </g>
  );
}

/** A line's name, written on the line (direct labelling beats a legend). */
export function LineLabel({ x, y, text, anchor = "start" }: { x: number; y: number; text: string; anchor?: "start" | "end" | "middle" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontFamily={MONO} fontSize={10} letterSpacing="0.04em" fill="var(--fg-dim)">
      {text}
    </text>
  );
}

/**
 * The ramp's legend bar, mandatory wherever the ramp appears (rule 3): the
 * nine steps the figure actually uses, low to high, with the two ends named.
 */
export function RampLegend({ x, y, height = 120, lo, hi, label, size = 1 }: { x: number; y: number; height?: number; lo: string; hi: string; label?: string; /** scale for a large viewBox */ size?: number }) {
  const n = 9;
  const step = height / n;
  const w = 10 * size;
  return (
    <g aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={x} y={y + height - (i + 1) * step} width={w} height={step + 0.5} fill={`var(--viz-ramp-${i})`} />
      ))}
      <g fontFamily={MONO} fontSize={10 * size} fill="var(--fg-dim)" style={{ fontVariantNumeric: "tabular-nums" }}>
        <text x={x + w + 6 * size} y={y + 8 * size}>{hi}</text>
        <text x={x + w + 6 * size} y={y + height}>{lo}</text>
        {label && (
          <text x={x} y={y - 8 * size} fill="var(--fg-faint)" letterSpacing="0.08em">
            {label.toUpperCase()}
          </text>
        )}
      </g>
    </g>
  );
}

export type LegendItem = { label: string; color: string; kind?: "line" | "dot" | "band" | "dash" };

/** A row of keys, for figures whose lines cannot all be labelled where they end. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-fg-dim">
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <svg width="18" height="10" viewBox="0 0 18 10" aria-hidden>
            {it.kind === "dot" ? (
              <circle cx="9" cy="5" r="3.5" fill={it.color} />
            ) : it.kind === "band" ? (
              <rect x="1" y="1" width="16" height="8" rx="2" fill={it.color} opacity="0.35" />
            ) : (
              <line x1="1" x2="17" y1="5" y2="5" stroke={it.color} strokeWidth="2" strokeDasharray={it.kind === "dash" ? "3 3" : undefined} />
            )}
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

export type Source = "SIM" | "LIVE" | "DELAYED";

/** Where a figure's numbers come from, on every figure: simulated, live or delayed. */
export function SourceChip({ source, note }: { source: Source; note?: string }) {
  const dot = source === "LIVE" ? "var(--brand-ink)" : source === "DELAYED" ? "var(--amber)" : "var(--fg-faint)";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-fg/[0.06] px-2 py-0.5 font-mono text-[0.625rem] tracking-[0.08em] text-fg-dim">
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: dot }} />
      {source}
      {note && <span className="tracking-normal text-fg-faint">· {note}</span>}
    </span>
  );
}

/** SVG path through points, breaking at gaps (null or non-finite y). */
export function pathOf(points: readonly (readonly [number, number | null])[], x: Scale, y: Scale): string {
  let d = "";
  let pen = false;
  for (const [px, py] of points) {
    if (py === null || !Number.isFinite(py)) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${x(px).toFixed(1)},${y(py).toFixed(1)}`;
    pen = true;
  }
  return d;
}

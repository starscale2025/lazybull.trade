// THE FIGURE KIT, part two: the nine templates every practice problem and
// model figure is drawn from (plan A5, Stages 3 and 5). Each takes data, not
// styling: the grammar decides the colours.
//  - "model": a model's output, blue. "ref": a reference, grey, named on the line.
//  - "single": one series on its own, violet. Never the only thing telling it from a blue line.
//  - "gain" / "loss" / "pnl": money, and only money. A pnl line is mint above
//    zero and red below, and the zero line and the sign say the same thing.
//  - the ramp only for height, with its legend bar.

import { Frame, LastValue, LineLabel, Marker, RampLegend, pathOf, type Axis } from "./frame";
import { niceDomain, niceStep, tickLabel } from "@/lib/viz/scale";
import { rampVar } from "@/lib/viz/ramp";

export type Role = "model" | "ref" | "single" | "gain" | "loss";
const ROLE: Record<Role, string> = {
  model: "var(--viz-model)",
  ref: "var(--viz-ref)",
  single: "var(--viz-ramp-0)",
  gain: "var(--viz-gain)",
  loss: "var(--viz-loss)",
};
const MONO = "var(--font-jetbrains), ui-monospace, monospace";
const signed = (v: number, d = 2) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;
const extent = (vs: number[]): [number, number] => [Math.min(...vs), Math.max(...vs)];

type Common = { title: string; desc: string; id?: string; width?: number; height?: number };

// ── 1. Curve: payoff, price or probability against one input ───────────────
export type CurveLine = {
  points: [number, number][];
  role: Role | "pnl";
  label?: string;
  /** where to name the line, in data units, when its end is crowded: dy is pixels (−8 sits above) */
  labelAt?: { x: number; y: number; anchor?: "start" | "end"; dy?: number };
};
export function CurveFigure({
  lines,
  x,
  y,
  markers = [],
  verticals = [],
  ...common
}: Common & {
  lines: CurveLine[];
  x: Axis;
  y?: Partial<Axis>;
  markers?: { x: number; y: number; text?: string; role?: Role }[];
  verticals?: { x: number; label: string }[];
}) {
  const ys = lines.flatMap((l) => l.points.map((p) => p[1]));
  const yAxis: Axis = { domain: y?.domain ?? niceDomain(...extent(ys), 4, lines.some((l) => l.role === "pnl")), ...y };
  const fid = common.id ?? `fig-${common.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`;
  return (
    <Frame {...common} id={fid} x={x} y={yAxis}>
      {({ x: X, y: Y, box }) => (
        <g>
          {verticals.map((v) => (
            <g key={`v${v.x}`}>
              <line x1={X(v.x)} x2={X(v.x)} y1={box.t} y2={box.t + box.h} stroke="var(--viz-axis)" strokeWidth={1} />
              <LineLabel x={X(v.x) + 4} y={box.t + 10} text={v.label} />
            </g>
          ))}
          {lines.map((l, i) => {
            const d = pathOf(l.points, X, Y);
            const last = l.points[l.points.length - 1];
            if (l.role === "pnl") {
              const zy = Y(0);
              return (
                <g key={i}>
                  <clipPath id={`${fid}-up${i}`}>
                    <rect x={box.l} y={box.t - 4} width={box.w} height={Math.max(0, zy - box.t + 4)} />
                  </clipPath>
                  <clipPath id={`${fid}-dn${i}`}>
                    <rect x={box.l} y={zy} width={box.w} height={Math.max(0, box.t + box.h - zy + 4)} />
                  </clipPath>
                  <path d={d} fill="none" stroke={ROLE.gain} strokeWidth={2} clipPath={`url(#${fid}-up${i})`} strokeLinejoin="round" />
                  <path d={d} fill="none" stroke={ROLE.loss} strokeWidth={2} clipPath={`url(#${fid}-dn${i})`} strokeLinejoin="round" />
                  {l.label && last && <LineLabel x={X(last[0]) - 4} y={Y(last[1]) - 8} text={l.label} anchor="end" />}
                </g>
              );
            }
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={ROLE[l.role]} strokeWidth={l.role === "ref" ? 1.5 : 2} strokeLinejoin="round" />
                {/* a reference is named under its end, anything else over it, so two lines that end together do not collide */}
                {l.label && l.labelAt ? (
                  <LineLabel x={X(l.labelAt.x) + (l.labelAt.anchor === "start" ? 4 : -4)} y={Y(l.labelAt.y) + (l.labelAt.dy ?? -8)} text={l.label} anchor={l.labelAt.anchor ?? "end"} />
                ) : (
                  l.label && last && <LineLabel x={X(last[0]) - 4} y={Y(last[1]) + (l.role === "ref" ? 16 : -8)} text={l.label} anchor="end" />
                )}
              </g>
            );
          })}
          {markers.map((m, i) =>
            m.text ? (
              <LastValue key={i} cx={X(m.x)} cy={Y(m.y)} text={m.text} color={ROLE[m.role ?? "model"]} side={X(m.x) > box.l + box.w * 0.75 ? "left" : "right"} />
            ) : (
              <Marker key={i} cx={X(m.x)} cy={Y(m.y)} color={ROLE[m.role ?? "model"]} />
            )
          )}
        </g>
      )}
    </Frame>
  );
}

// ── 2. Series with overlay: a tape, and what a function adds to it ─────────
export function SeriesFigure({
  values,
  role = "ref",
  overlays = [],
  band,
  brackets = [],
  yLabel,
  xLabel = "Day",
  digits = 2,
  ...common
}: Common & {
  values: number[];
  /** decimals on the tape's last value */
  digits?: number;
  /** the tape is a grey reference unless it is the subject itself */
  role?: Role;
  /** a measured gap at one step, such as a drawdown from its peak */
  brackets?: { i: number; from: number; to: number; label: string; role?: Role }[];
  overlays?: { values: (number | null)[]; role: Role; label: string }[];
  band?: { lo: (number | null)[]; hi: (number | null)[]; label: string };
  yLabel?: string;
  xLabel?: string;
}) {
  const all = [...values, ...overlays.flatMap((o) => o.values), ...(band ? [...band.lo, ...band.hi] : [])].filter((v): v is number => v !== null && Number.isFinite(v));
  const n = values.length;
  const at = <T,>(vs: T[]) => vs.map((v, i) => [i, v] as [number, T]);
  // a line on the frame's top edge runs into the axis label above it: give it headroom
  const [lo, hi] = extent(all);
  let yDomain = niceDomain(lo, hi, 4);
  if (hi >= yDomain[1] - (yDomain[1] - yDomain[0]) * 0.02) yDomain = niceDomain(lo, hi + (hi - lo) * 0.05, 4);
  return (
    <Frame {...common} x={{ domain: [0, n - 1], label: xLabel }} y={{ domain: yDomain, label: yLabel }}>
      {({ x: X, y: Y, box }) => {
        let area = "";
        if (band) {
          const top = band.hi.map((v, i) => (v === null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`)).filter(Boolean);
          const bot = band.lo.map((v, i) => (v === null ? null : `${X(i).toFixed(1)},${Y(v).toFixed(1)}`)).filter(Boolean).reverse();
          if (top.length && bot.length) area = `M${top.join("L")}L${bot.join("L")}Z`;
        }
        const lastOf = (vs: (number | null)[]) => {
          for (let i = vs.length - 1; i >= 0; i--) if (vs[i] !== null) return [i, vs[i] as number] as const;
          return null;
        };
        return (
          <g>
            {band && area && <path d={area} fill={ROLE.model} opacity={0.14} />}
            <path d={pathOf(at(values), X, Y)} fill="none" stroke={ROLE[role]} strokeWidth={role === "ref" ? 1.5 : 2} strokeLinejoin="round" />
            {overlays.map((o) => {
              const end = lastOf(o.values);
              return (
                <g key={o.label}>
                  <path d={pathOf(at(o.values), X, Y)} fill="none" stroke={ROLE[o.role]} strokeWidth={2} strokeLinejoin="round" />
                  {end && <LineLabel x={X(end[0]) - 4} y={Y(end[1]) - 8} text={o.label} anchor="end" />}
                </g>
              );
            })}
            {brackets.map((b) => {
              const bx = X(b.i);
              const right = bx < box.l + box.w * 0.7;
              const c = ROLE[b.role ?? "ref"];
              return (
                <g key={`b${b.i}`}>
                  <path d={`M${bx - 4},${Y(b.from)}H${bx + 4}M${bx},${Y(b.from)}V${Y(b.to)}M${bx - 4},${Y(b.to)}H${bx + 4}`} stroke={c} strokeWidth={1.5} fill="none" />
                  <LineLabel x={bx + (right ? 8 : -8)} y={(Y(b.from) + Y(b.to)) / 2 + 4} text={b.label} anchor={right ? "start" : "end"} />
                </g>
              );
            })}
            {(() => {
              // where a named line ends on top of the tape, the name wins: the tape keeps its dot, not its number
              const cy = Y(values[n - 1]);
              const crowded = overlays.some((o) => {
                const end = lastOf(o.values);
                return end !== null && end[0] >= n - 2 && Math.abs(Y(end[1]) - cy) < 14;
              });
              return crowded ? (
                <Marker cx={X(n - 1)} cy={cy} color={ROLE[role]} />
              ) : (
                <LastValue cx={X(n - 1)} cy={cy} text={values[n - 1].toFixed(digits)} color={ROLE[role]} side="left" />
              );
            })()}
          </g>
        );
      }}
    </Frame>
  );
}

// ── 3. Histogram, with a shaded tail or a marker ───────────────────────────
export function HistogramFigure({
  bins,
  tail,
  marker,
  xLabel,
  yLabel = "Count",
  ...common
}: Common & {
  yLabel?: string;
  bins: { x0: number; x1: number; count: number }[];
  tail?: { below: number; role: Role; label: string };
  marker?: { x: number; label: string };
  xLabel?: string;
}) {
  const top = Math.max(...bins.map((b) => b.count));
  return (
    <Frame {...common} x={{ domain: [bins[0].x0, bins[bins.length - 1].x1], label: xLabel }} y={{ domain: niceDomain(0, top, 4, true), label: yLabel }}>
      {({ x: X, y: Y, box }) => (
        <g>
          {bins.map((b, i) => {
            const inTail = tail && b.x1 <= tail.below;
            const w = Math.max(0.5, X(b.x1) - X(b.x0) - 2); // a 2 px gap between bars
            return <rect key={i} x={X(b.x0) + 1} y={Y(b.count)} width={w} height={Math.max(0, Y(0) - Y(b.count))} rx={1.5} fill={inTail ? ROLE[tail.role] : ROLE.ref} opacity={inTail ? 0.9 : 0.55} />;
          })}
          {tail && <LineLabel x={X(tail.below) - 4} y={box.t + 10} text={tail.label} anchor="end" />}
          {marker && (
            <g>
              <line x1={X(marker.x)} x2={X(marker.x)} y1={box.t} y2={box.t + box.h} stroke="var(--viz-axis)" strokeWidth={1} />
              <LineLabel x={X(marker.x) + 4} y={box.t + 24} text={marker.label} />
            </g>
          )}
        </g>
      )}
    </Frame>
  );
}

// ── 4. Lattice: a binomial tree, its early-exercise nodes lit ──────────────
export function LatticeFigure({ steps, lit = [], litLabel, ...common }: Common & { steps: number; lit?: [number, number][]; /** names the lit nodes in a key */ litLabel?: string }) {
  const isLit = new Set(lit.map(([i, j]) => `${i},${j}`));
  return (
    <Frame {...common} x={{ domain: [0, steps], label: "Step", ticks: Array.from({ length: steps + 1 }, (_, i) => i) }} y={{ domain: [-steps - 0.5, steps + 0.5], ticks: [] }} margin={{ l: 24 }}>
      {({ x: X, y: Y, box }) => {
        const pos = (i: number, j: number) => [X(i), Y(2 * j - i)] as const;
        const edges: string[] = [];
        const nodes: { i: number; j: number }[] = [];
        for (let i = 0; i <= steps; i++)
          for (let j = 0; j <= i; j++) {
            nodes.push({ i, j });
            if (i < steps) {
              const [x0, y0] = pos(i, j);
              for (const k of [j, j + 1]) {
                const [x1, y1] = pos(i + 1, k);
                edges.push(`M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}`);
              }
            }
          }
        return (
          <g>
            <path d={edges.join("")} stroke="var(--viz-axis)" strokeWidth={1} fill="none" />
            {litLabel && lit.length > 0 && (
              <g>
                <Marker cx={box.l + 5} cy={box.t + 6} color={ROLE.model} r={5} />
                <LineLabel x={box.l + 16} y={box.t + 10} text={litLabel} />
              </g>
            )}
            {nodes.map(({ i, j }) => {
              const [cx, cy] = pos(i, j);
              return isLit.has(`${i},${j}`) ? <Marker key={`${i},${j}`} cx={cx} cy={cy} color={ROLE.model} r={5} /> : <circle key={`${i},${j}`} cx={cx} cy={cy} r={3} fill="var(--viz-ref)" />;
            })}
          </g>
        );
      }}
    </Frame>
  );
}

// ── 5. Fold strips: train, test, purge and embargo as bands ────────────────
export type FoldKind = "train" | "test" | "purge" | "embargo";
const FOLD: Record<FoldKind, { fill: string; label: string }> = {
  train: { fill: ROLE.ref, label: "Train" },
  test: { fill: ROLE.model, label: "Test" },
  purge: { fill: "url(#viz-hatch)", label: "Purged" },
  embargo: { fill: "url(#viz-dots)", label: "Embargo" },
};
export function FoldStripsFigure({ length, folds, ...common }: Common & { length: number; folds: { label: string; segments: { from: number; to: number; kind: FoldKind }[] }[] }) {
  const rows = folds.length;
  const kinds = [...new Set(folds.flatMap((f) => f.segments.map((s) => s.kind)))];
  return (
    <Frame {...common} height={common.height ?? 100 + rows * 26} x={{ domain: [0, length], label: "Time" }} y={{ domain: [rows, 0], ticks: [] }} margin={{ l: 64, b: 76 }}>
      {({ x: X, y: Y, box }) => (
        <g>
          <defs>
            <pattern id="viz-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--viz-axis)" strokeWidth="2" />
            </pattern>
            <pattern id="viz-dots" width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="2.5" cy="2.5" r="1" fill="var(--viz-axis)" />
            </pattern>
          </defs>
          {folds.map((f, r) => (
            <g key={f.label}>
              <text x={box.l - 8} y={Y(r + 0.5) + 4} textAnchor="end" fontFamily={MONO} fontSize={10} fill="var(--fg-dim)">
                {f.label}
              </text>
              {f.segments.map((s, k) => (
                <rect key={k} x={X(s.from)} y={Y(r) + 4} width={Math.max(0, X(s.to) - X(s.from) - 1)} height={Math.abs(Y(r + 1) - Y(r)) - 8} rx={2} fill={FOLD[s.kind].fill} opacity={s.kind === "train" ? 0.45 : 1} />
              ))}
            </g>
          ))}
          <g fontFamily={MONO} fontSize={10} fill="var(--fg-dim)">
            {kinds.map((k, i) => (
              <g key={k} transform={`translate(${box.l + i * 92},${box.t + box.h + 30})`}>
                <rect width={14} height={10} rx={2} fill={FOLD[k].fill} opacity={k === "train" ? 0.45 : 1} />
                <text x={20} y={9}>{FOLD[k].label}</text>
              </g>
            ))}
          </g>
        </g>
      )}
    </Frame>
  );
}

// ── 6. Cash-flow ladder: money in and out over time ────────────────────────
// "money" bars are mint in and red out; "neutral" is for signed values that are
// not money (an autocorrelation, a feature), drawn in the model's blue.
export function CashLadderFigure({
  flows,
  xLabel = "Year",
  yLabel = "Cash flow",
  tone = "money",
  digits = 2,
  ...common
}: Common & { flows: { t: number; amount: number }[]; xLabel?: string; yLabel?: string; tone?: "money" | "neutral"; digits?: number }) {
  const ts = flows.map((f) => f.t);
  const pad = (Math.max(...ts) - Math.min(...ts)) / Math.max(1, flows.length) || 1;
  // a bar that reaches the frame's edge has no room for its value: give both ends headroom
  const [lo, hi] = extent(flows.map((f) => f.amount));
  let yDomain = niceDomain(lo, hi, 4, true);
  const span = yDomain[1] - yDomain[0];
  if ((hi > 0 && hi >= yDomain[1] - span * 0.06) || (lo < 0 && lo <= yDomain[0] + span * 0.06))
    yDomain = niceDomain(lo < 0 && lo <= yDomain[0] + span * 0.06 ? lo - span * 0.1 : lo, hi > 0 && hi >= yDomain[1] - span * 0.06 ? hi + span * 0.1 : hi, 4, true);
  return (
    <Frame {...common} x={{ domain: [Math.min(...ts) - pad / 2, Math.max(...ts) + pad / 2], label: xLabel, ticks: ts, format: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(2)) }} y={{ domain: yDomain, label: yLabel }}>
      {({ x: X, y: Y }) => {
        const w = Math.max(6, Math.min(36, (X(ts[1] ?? ts[0] + 1) - X(ts[0])) * 0.55));
        return (
          <g>
            {flows.map((f) => {
              const y0 = Y(0);
              const y1 = Y(f.amount);
              const up = f.amount >= 0;
              // The value sits past the bar's end; an outflow that runs down to
              // the axis labels carries it inside its end, in the ground colour.
              const inside = !up && Math.abs(y1 - y0) > 22 && y1 + 14 > Y(Y.domain[0]) - 4;
              return (
                <g key={f.t}>
                  <rect x={X(f.t) - w / 2} y={Math.min(y0, y1)} width={w} height={Math.abs(y1 - y0)} rx={2} fill={tone === "neutral" ? ROLE.model : up ? ROLE.gain : ROLE.loss} opacity={0.85} />
                  <text
                    x={X(f.t)}
                    y={up || inside ? y1 - 6 : y1 + 14}
                    textAnchor="middle"
                    fontFamily={MONO}
                    fontSize={10}
                    fill={inside ? "var(--bg)" : "var(--fg)"}
                  >
                    {signed(f.amount, digits)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      }}
    </Frame>
  );
}

// ── 7. Iteration: steps closing on an answer ───────────────────────────────
export function IterationFigure({ steps, answer, xLabel, ...common }: Common & { steps: { lo?: number; hi?: number; x: number }[]; answer: number; xLabel?: string }) {
  const xsAll = steps.flatMap((s) => [s.lo ?? s.x, s.hi ?? s.x, s.x]).concat(answer);
  const n = steps.length;
  return (
    <Frame {...common} height={common.height ?? 60 + n * 24} x={{ domain: niceDomain(...extent(xsAll), 5), label: xLabel }} y={{ domain: [n - 0.5, -0.5], ticks: steps.map((_, i) => i), format: (v) => `${v + 1}`, label: "Step" }} margin={{ l: 40, t: 28 }}>
      {({ x: X, y: Y, box }) => (
        <g>
          <line x1={X(answer)} x2={X(answer)} y1={box.t} y2={box.t + box.h} stroke="var(--viz-axis)" strokeWidth={1} />
          <LineLabel x={X(answer)} y={box.t - 4} text={`answer ${tickLabel(answer, niceStep(Math.abs(answer) / 50 || 0.01))}`} anchor="middle" />
          {steps.map((s, i) => (
            <g key={i}>
              {s.lo !== undefined && s.hi !== undefined && <line x1={X(s.lo)} x2={X(s.hi)} y1={Y(i)} y2={Y(i)} stroke={ROLE.ref} strokeWidth={2} strokeLinecap="round" />}
              <Marker cx={X(s.x)} cy={Y(i)} color={ROLE.model} />
            </g>
          ))}
        </g>
      )}
    </Frame>
  );
}

// ── 8. Matrix or heat strip: values on the ramp, beside its legend ─────────
export function MatrixFigure({
  rows,
  cols,
  values,
  domain,
  format = (v) => v.toFixed(2),
  showValues = false,
  ...common
}: Common & { rows: string[]; cols: string[]; values: number[][]; domain?: [number, number]; format?: (v: number) => string; showValues?: boolean }) {
  const [lo, hi] = domain ?? extent(values.flat());
  const cell = showValues ? 46 : 34;
  const l = 72;
  const t = 28;
  const width = common.width ?? l + cols.length * cell + 90;
  const height = common.height ?? t + rows.length * cell + 16;
  const fid = common.id ?? `fig-${common.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`;
  return (
    // drawn at its own size, never blown up to the column: its type matches every other figure's
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${fid}-t ${fid}-d`} className="mx-auto block h-auto w-full overflow-visible" style={{ maxWidth: width }}>
      <title id={`${fid}-t`}>{common.title}</title>
      <desc id={`${fid}-d`}>{common.desc}</desc>
      <g fontFamily={MONO} fontSize={10} fill="var(--fg-dim)">
        {cols.map((c, j) => (
          <text key={c} x={l + j * cell + cell / 2} y={t - 8} textAnchor="middle">
            {c}
          </text>
        ))}
        {rows.map((r, i) => (
          <text key={r} x={l - 8} y={t + i * cell + cell / 2 + 4} textAnchor="end">
            {r}
          </text>
        ))}
      </g>
      {values.map((row, i) =>
        row.map((v, j) => (
          <g key={`${i},${j}`}>
            <rect x={l + j * cell + 1} y={t + i * cell + 1} width={cell - 2} height={cell - 2} rx={3} fill={rampVar((v - lo) / (hi - lo || 1))} />
            {showValues && (
              <text x={l + j * cell + cell / 2} y={t + i * cell + cell / 2 + 4} textAnchor="middle" fontFamily={MONO} fontSize={10} fill="var(--bg)">
                {format(v)}
              </text>
            )}
          </g>
        ))
      )}
      <RampLegend x={l + cols.length * cell + 18} y={t} height={Math.max(60, rows.length * cell)} lo={format(lo)} hi={format(hi)} />
    </svg>
  );
}

// ── 9. Depth ladder: a price ladder with sizes ─────────────────────────────
export function DepthLadderFigure({ levels, micro, ...common }: Common & { levels: { price: number; bid?: number; ask?: number }[]; micro?: number }) {
  const sorted = [...levels].sort((a, b) => b.price - a.price);
  const most = Math.max(...sorted.map((l) => Math.max(l.bid ?? 0, l.ask ?? 0)));
  const row = 22;
  const width = common.width ?? 520;
  const mid = width / 2;
  const half = mid - 60;
  const t = 26;
  const height = common.height ?? t + sorted.length * row + 12;
  const fid = common.id ?? `fig-${common.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)}`;
  const priceY = (p: number) => {
    const i = sorted.findIndex((l) => l.price <= p);
    return t + (i < 0 ? sorted.length : i) * row;
  };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${fid}-t ${fid}-d`} className="block h-auto w-full overflow-visible">
      <title id={`${fid}-t`}>{common.title}</title>
      <desc id={`${fid}-d`}>{common.desc}</desc>
      <g fontFamily={MONO} fontSize={10} letterSpacing="0.08em" fill="var(--fg-faint)">
        <text x={mid - 34} y={14} textAnchor="end">BID SIZE</text>
        <text x={mid + 34} y={14}>ASK SIZE</text>
      </g>
      {sorted.map((l, i) => {
        const y = t + i * row;
        return (
          <g key={l.price}>
            {l.bid ? <rect x={mid - 30 - (l.bid / most) * half} y={y + 3} width={(l.bid / most) * half} height={row - 6} rx={2} fill={ROLE.model} opacity={0.75} /> : null}
            {l.ask ? <rect x={mid + 30} y={y + 3} width={(l.ask / most) * half} height={row - 6} rx={2} fill={ROLE.ref} opacity={0.75} /> : null}
            <text x={mid} y={y + row / 2 + 4} textAnchor="middle" fontFamily={MONO} fontSize={11} fill="var(--fg)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {l.price.toFixed(2)}
            </text>
          </g>
        );
      })}
      {micro !== undefined && (
        <g>
          <line x1={24} x2={width - 24} y1={priceY(micro)} y2={priceY(micro)} stroke="var(--viz-axis)" strokeWidth={1} />
          <LineLabel x={24} y={priceY(micro) - 4} text={`micro-price ${micro.toFixed(3)}`} />
        </g>
      )}
    </svg>
  );
}

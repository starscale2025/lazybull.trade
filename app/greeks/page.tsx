"use client";

// The Greek Surface lab — the product's showpiece interactive. A real
// Black-Scholes surface for a call (its price or any Greek, plotted with its
// sign) over strike × days-to-expiry for a chosen
// symbol (live spot via /api/quote, synthetic $100 fallback), rendered as a
// low-camera SVG wireframe with a draggable glowing handle. Drag it (or use
// the sliders) and all five Greeks recompute live from lib/pricing.
// Design ref: docs/design-refs/05-learn-greeks.png. Educational — not advice.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CalmLink, CalmPanel, PageHeader } from "@/components/calm/kit";
import { priceOption } from "@/lib/pricing";

// ── Model params (house defaults; strike range is spot-relative) ─────────────
const FALLBACK_IV = 0.32; // used until real bars land, and when they can't
const R = 0.045;
const M_LO = 0.8; // strike = spot × moneyness
const M_HI = 1.2;
const D_MIN = 0;
const D_MAX = 90;
// Near expiry gamma and theta run to infinity inside a strike band narrower
// than a coarse grid's spacing, which drew them as needles. So strikes are
// sampled finely (every other one is drawn as a column), expiries crowd toward
// the front where the surface bends fastest, and the mesh stops three quarters
// of a day before expiry.
const NK = 73; // strike samples
const COL_EVERY = 2;
const ND = 27; // expiry samples
const D_MESH = 0.75;
const dayAt = (j: number) => D_MESH + (D_MAX - D_MESH) * Math.pow(j / (ND - 1), 1.5);
const SYMBOLS = ["AMZN", "AAPL", "TSLA", "NVDA", "SPY", "MSFT"] as const;
const FALLBACK_SPOT = 100;

const yearsOf = (days: number) => Math.max(0.0005, days / 365);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

// Annualized realized vol from daily closes: 60 log returns, stdev × √252.
function realizedVol(closes: number[]): number | null {
  const tail = closes.filter((c) => typeof c === "number" && Number.isFinite(c) && c > 0).slice(-61);
  if (tail.length < 21) return null;
  const rets: number[] = [];
  for (let i = 1; i < tail.length; i++) rets.push(Math.log(tail[i] / tail[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (rets.length - 1);
  return clamp(Math.sqrt(variance) * Math.sqrt(252), 0.1, 1.2);
}

// ── Fixed low-camera oblique projection (squashed floor, tall price axis) ────
const VB_W = 1200;
const VB_H = 640;
const O = { x: 96, y: 490 }; // origin: moneyness 0.8, d=0, price=0
const AXIS_K = { x: 516, y: 96 }; // strike direction (down-right), u ∈ [0,1]
const AXIS_D = { x: 556, y: -88 }; // days direction (up-right), v ∈ [0,1]
const H_PX = 360; // full price height — vertical exaggeration is the drama

function project(u: number, v: number, h: number) {
  return {
    x: O.x + u * AXIS_K.x + v * AXIS_D.x,
    y: O.y + u * AXIS_K.y + v * AXIS_D.y - h * H_PX,
  };
}

// ── Selectable z-axis: price or a Greek, all from the same pricing engine ────
// Every surface plots with its sign. A call's theta is negative everywhere (it
// is what the option loses each day), so it hangs below a zero line as a
// valley and agrees with the Theta card instead of mirroring it.
type SurfaceKey = "price" | "delta" | "gamma" | "theta" | "vega";
const SURFACE_ORDER: SurfaceKey[] = ["price", "delta", "gamma", "theta", "vega"];
type SurfaceDef = {
  label: string;
  /** What the surface shows, for its title, aria-label and teacher copy. */
  name: string;
  caption: string;
  /** What height means on this surface, in one or two sentences. */
  reads: string;
  fmt: (v: number) => string;
  pick: (price: number, g: { delta: number; gamma: number; theta: number; vega: number }) => number;
};
const SURFACE_DEFS: Record<SurfaceKey, SurfaceDef> = {
  price: {
    label: "Price",
    name: "price",
    caption: "CALL PRICE",
    reads: "Height is what the call costs: it climbs toward low strikes and long expiries.",
    fmt: (v) => v.toFixed(2),
    pick: (p) => p,
  },
  delta: {
    label: "Delta",
    name: "delta",
    caption: "DELTA",
    reads: "Height is delta, how much the call moves for a $1 move in the stock: near 1 deep in the money, near 0 far out of it.",
    fmt: (v) => v.toFixed(2),
    pick: (_, g) => g.delta,
  },
  gamma: {
    label: "Gamma",
    name: "gamma",
    caption: "GAMMA",
    reads: "Height is gamma, how fast delta changes: it crests where the strike meets the stock price and sharpens as expiry gets close.",
    fmt: (v) => v.toFixed(4),
    pick: (_, g) => g.gamma,
  },
  theta: {
    label: "Theta",
    name: "theta",
    caption: "THETA PER DAY",
    reads: "Height is theta, what the call loses each day. It sits below the zero line everywhere, and the valley deepens where the strike meets the stock price as expiry gets close.",
    fmt: (v) => v.toFixed(3),
    pick: (_, g) => g.theta,
  },
  vega: {
    label: "Vega",
    name: "vega",
    caption: "VEGA",
    reads: "Height is vega, what the call gains if volatility rises one point: largest near the stock price far from expiry, fading to nothing at expiry.",
    fmt: (v) => v.toFixed(3),
    pick: (_, g) => g.vega,
  },
};

// ── Surface grid — real Black-Scholes, recomputed per spot & surface ─────────
type SurfaceData = {
  spot: number;
  surfaceKey: SurfaceKey;
  /** The scale's ends. It always holds zero, so a negative surface keeps its sign. */
  lo: number;
  hi: number;
  priceStep: number;
  rows: { key: string; d: string; opacity: number; width: number }[];
  cols: { key: string; d: string; opacity: number; width: number }[];
  /** Where the expiry spike leaves the scale and is cut flat, if it does. */
  clip: { u: number; v: number; dir: "up" | "down" } | null;
};

// Height in the box (0 floor, 1 ceiling) for a value on the scale [lo, hi].
// Whatever leaves the scale is held at the edge and labelled "off scale".
const heightOf = (z: number, lo: number, hi: number) => clamp((z - lo) / (hi - lo), 0, 1);

// One mesh line through grid points, as an svg path. Where the surface leaves
// the scale the line ends at the scale's edge instead of being cut flat along
// it, and starts again where the surface comes back.
type GridPt = { u: number; v: number; z: number };
function lineThrough(pts: GridPt[], lo: number, hi: number) {
  const at = (p: GridPt) => {
    const q = project(p.u, p.v, (p.z - lo) / (hi - lo));
    return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  };
  const edgeOf = (z: number) => (z > hi ? hi : z < lo ? lo : null);
  const cross = (a: GridPt, b: GridPt, bound: number): GridPt => {
    const t = (bound - a.z) / (b.z - a.z);
    return { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t, z: bound };
  };
  let d = "";
  pts.forEach((p, k) => {
    const prev = k > 0 ? pts[k - 1] : null;
    const pEdge = edgeOf(p.z);
    const prevEdge = prev ? edgeOf(prev.z) : null;
    if (pEdge === null) {
      if (!prev) d += `M${at(p)}`;
      else if (prevEdge !== null) d += `M${at(cross(prev, p, prevEdge))}L${at(p)}`;
      else d += `L${at(p)}`;
    } else if (prev && prevEdge === null) {
      d += `L${at(cross(prev, p, pEdge))}`;
    }
  });
  return d;
}

// Smallest "nice" (1/2/2.5/5 × 10^n) step ≥ raw.
function niceStep(raw: number) {
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  const norm = raw / mag;
  const factor = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return factor * mag;
}

function buildSurface(spot: number, surfaceKey: SurfaceKey, vol: number): SurfaceData {
  const pick = SURFACE_DEFS[surfaceKey].pick;
  const vals: number[][] = [];
  // The scale's ends come from d ≥ 7: gamma and theta spike toward expiry at
  // the money, and scaling to the spike would flatten everything else.
  let loAll = 0;
  let hiAll = 0;
  let loStable = 0;
  let hiStable = 0;
  for (let j = 0; j < ND; j++) {
    const d = dayAt(j);
    const row: number[] = [];
    for (let i = 0; i < NK; i++) {
      const k = spot * (M_LO + (i / (NK - 1)) * (M_HI - M_LO));
      const r = priceOption(spot, k, yearsOf(d), R, vol, "C");
      const z = pick(r.price, r.greeks);
      row.push(z);
      loAll = Math.min(loAll, z);
      hiAll = Math.max(hiAll, z);
      if (d >= 7) {
        loStable = Math.min(loStable, z);
        hiStable = Math.max(hiStable, z);
      }
    }
    vals.push(row);
  }
  let lo = loStable * 1.02;
  let hi = hiStable * 1.02;
  if (hi - lo < 1e-12) [lo, hi] = [loAll * 1.02, hiAll * 1.02];
  if (hi - lo < 1e-12) hi = lo + 1;
  const priceStep = niceStep((hi - lo) / 6); // ~5–6 labelled ticks at any scale

  // The spike near expiry leaves the scale and is cut flat: at the ceiling as
  // a crest, at the floor as a valley. Its farthest point gets the label.
  let clip: SurfaceData["clip"] = null;
  let worst = 0.01; // ignore a cut too small to see
  for (let j = 0; j < ND; j++) {
    for (let i = 0; i < NK; i++) {
      const z = vals[j][i];
      const over = Math.max(z - hi, lo - z) / (hi - lo);
      if (over > worst) {
        worst = over;
        clip = { u: i / (NK - 1), v: dayAt(j) / D_MAX, dir: z > hi ? "up" : "down" };
      }
    }
  }

  // Rows (constant expiry): the wave the viewer reads. Near rows are
  // thick and bright; far rows recede hard.
  const rows = vals.map((row, j) => {
    const v = dayAt(j) / D_MAX;
    const depth = Math.pow(1 - v, 1.7);
    return {
      key: `r${j}`,
      opacity: 0.2 + 0.78 * depth,
      width: 0.7 + 1.05 * depth,
      d: lineThrough(row.map((z, i) => ({ u: i / (NK - 1), v, z })), lo, hi),
    };
  });
  const cols: SurfaceData["cols"] = [];
  for (let i = 0; i < NK; i += COL_EVERY) {
    const u = i / (NK - 1);
    cols.push({
      key: `c${i}`,
      opacity: 0.24 + 0.14 * u,
      width: 0.65,
      d: lineThrough(vals.map((row, j) => ({ u, v: dayAt(j) / D_MAX, z: row[i] })), lo, hi),
    });
  }

  return { spot, surfaceKey, lo, hi, priceStep, rows, cols, clip };
}

const fmtStrike = (k: number, spot: number) => (spot < 50 ? k.toFixed(1) : Math.round(k).toString());

// ── Greek copy (exact house one-liners, same as the learn-page cards) ────────
type GreekKey = "delta" | "gamma" | "theta" | "vega" | "rho";
const GREEK_ORDER: GreekKey[] = ["delta", "gamma", "theta", "vega", "rho"];
const GREEK_COPY: Record<GreekKey, { label: string; letter: string; line: string }> = {
  delta: { label: "Delta", letter: "Δ", line: "How much the option price changes for a $1 move in the underlying." },
  gamma: { label: "Gamma", letter: "Γ", line: "How much Delta changes for a $1 move in the underlying." },
  theta: { label: "Theta", letter: "Θ", line: "How much time decay reduces the option price each day." },
  vega: { label: "Vega", letter: "V", line: "How much the option price changes for a 1% move in implied volatility." },
  rho: { label: "Rho", letter: "ρ", line: "How much the option price changes for a 1% move in interest rates." },
};

// ── Static-per-spot wireframe + axes: never re-renders while dragging ────────
const Wireframe = memo(function Wireframe({ surface }: { surface: SurfaceData }) {
  const { spot, surfaceKey, lo, hi, priceStep, rows, cols } = surface;
  const def = SURFACE_DEFS[surfaceKey];
  const kAngle = (Math.atan2(AXIS_K.y, AXIS_K.x) * 180) / Math.PI;
  const dAngle = (Math.atan2(AXIS_D.y, AXIS_D.x) * 180) / Math.PI;
  const c00 = project(0, 0, 0);
  const c10 = project(1, 0, 0);
  const c11 = project(1, 1, 0);
  const c01 = project(0, 1, 0);
  const kMid = project(0.5, 0, 0);
  const dMid = project(1, 0.5, 0);
  const glowMid = project(0.5, 0.5, 0);

  const priceTicks: number[] = [];
  for (let i = Math.ceil(lo / priceStep - 1e-9); i * priceStep <= hi + 1e-12; i++) priceTicks.push(i * priceStep);
  // A surface with a sign gets its zero drawn: a dashed plane the valley hangs below.
  const zeroH = lo < 0 ? heightOf(0, lo, hi) : null;
  const zero =
    zeroH === null ? null : [project(0, 0, zeroH), project(1, 0, zeroH), project(1, 1, zeroH), project(0, 1, zeroH)];

  const mesh = (pass: "glow" | "crisp") => (
    <g
      filter={pass === "glow" ? "url(#meshGlow)" : undefined}
      opacity={pass === "glow" ? 0.85 : 1}
    >
      {cols.map((c) => (
        <path
          key={c.key}
          d={c.d}
          fill="none"
          stroke="var(--bull)"
          strokeWidth={pass === "glow" ? c.width + 1.6 : c.width}
          opacity={c.opacity}
        />
      ))}
      {[...rows].reverse().map((r) => (
        <path
          key={r.key}
          d={r.d}
          fill="none"
          stroke="var(--bull)"
          strokeWidth={pass === "glow" ? r.width + 1.6 : r.width}
          opacity={r.opacity}
        />
      ))}
    </g>
  );

  return (
    <g>
      {/* ambient floor glow — the scene light */}
      <ellipse cx={glowMid.x} cy={glowMid.y - 60} rx={470} ry={150} fill="url(#floorGlow)" />

      {/* floor edges */}
      <path
        d={`M${c01.x},${c01.y} L${c00.x},${c00.y} M${c01.x},${c01.y} L${c11.x},${c11.y}`}
        stroke="var(--fg-faint)"
        strokeWidth="0.8"
        strokeDasharray="2 5"
        opacity="0.5"
        fill="none"
      />
      <path
        d={`M${c00.x},${c00.y} L${c10.x},${c10.y} L${c11.x},${c11.y}`}
        stroke="var(--fg-faint)"
        strokeWidth="1"
        fill="none"
      />

      {zero && (
        <path
          data-zero-line
          d={`M${zero.map((p) => `${p.x},${p.y}`).join(" L")} Z`}
          stroke="var(--fg-dim)"
          strokeWidth="1"
          strokeDasharray="5 5"
          opacity="0.7"
          fill="none"
        />
      )}

      {/* the mesh: blurred bloom pass underneath, crisp pass on top */}
      {mesh("glow")}
      {mesh("crisp")}

      {/* STRIKE axis ticks (front-left edge) — spot-relative */}
      {/* The last strike and the first day share the front corner, so there the
          strike's label leans left and the day's leans right. */}
      {[0.8, 0.9, 1.0, 1.1, 1.2].map((mm) => {
        const p = project((mm - M_LO) / (M_HI - M_LO), 0, 0);
        const corner = mm === M_HI;
        return (
          <g key={`kt${mm}`}>
            <line x1={p.x} y1={p.y} x2={p.x - 1.3} y2={p.y + 7} stroke="var(--fg-faint)" strokeWidth="0.8" />
            <text
              data-axis="strike"
              className="hidden md:[display:unset]"
              x={corner ? p.x - 6 : p.x - 3}
              y={p.y + 22}
              textAnchor={corner ? "end" : "middle"}
              fontFamily="var(--font-jetbrains)"
              fontSize="11"
              fill="var(--fg-dim)"
            >
              {fmtStrike(mm * spot, spot)}
            </text>
          </g>
        );
      })}
      <text
        x={kMid.x - 8}
        y={kMid.y + 44}
        textAnchor="middle"
        fontFamily="var(--font-jetbrains)"
        fontSize="11"
        letterSpacing="4"
        fill="var(--bull)"
        opacity="0.85"
        transform={`rotate(${kAngle.toFixed(1)} ${kMid.x - 8} ${kMid.y + 44})`}
      >
        STRIKE
      </text>

      {/* DAYS TO EXPIRY axis ticks (front-right edge) */}
      {[0, 15, 30, 45, 60, 75, 90].map((d) => {
        const p = project(1, d / D_MAX, 0);
        return (
          <g key={`dt${d}`}>
            <line x1={p.x} y1={p.y} x2={p.x + 1.1} y2={p.y + 7} stroke="var(--fg-faint)" strokeWidth="0.8" />
            <text
              data-axis="days"
              className="hidden md:[display:unset]"
              x={d === 0 ? p.x + 6 : p.x + 2}
              y={p.y + 22}
              textAnchor={d === 0 ? "start" : "middle"}
              fontFamily="var(--font-jetbrains)"
              fontSize="11"
              fill="var(--fg-dim)"
            >
              {d}
            </text>
          </g>
        );
      })}
      <text
        x={dMid.x + 10}
        y={dMid.y + 56} // 12 px lower than it was: its rotated box no longer touches the "45" tick
        textAnchor="middle"
        fontFamily="var(--font-jetbrains)"
        fontSize="11"
        letterSpacing="4"
        fill="var(--bull)"
        opacity="0.85"
        transform={`rotate(${dAngle.toFixed(1)} ${dMid.x + 10} ${dMid.y + 56})`}
      >
        DAYS TO EXPIRY
      </text>

      {/* z axis (vertical, at the near-left corner) — caption follows the selected surface */}
      <line x1={O.x} y1={O.y} x2={O.x} y2={O.y - H_PX} stroke="var(--fg-faint)" strokeWidth="1" />
      {priceTicks.map((t) => {
        const y = O.y - heightOf(t, lo, hi) * H_PX;
        return (
          <g key={`pt${t}`}>
            <line x1={O.x - 5} y1={y} x2={O.x} y2={y} stroke="var(--fg-faint)" strokeWidth="0.8" />
            <text
              data-axis="price"
              className="hidden md:[display:unset]"
              x={O.x - 10}
              y={y + 3.5}
              textAnchor="end"
              fontFamily="var(--font-jetbrains)"
              fontSize="10"
              fill="var(--fg-dim)"
            >
              {def.fmt(t)}
            </text>
          </g>
        );
      })}
      <text
        data-ycaption
        x={O.x - 70}
        y={O.y - H_PX / 2}
        textAnchor="middle"
        fontFamily="var(--font-jetbrains)"
        fontSize="11"
        letterSpacing="4"
        fill="var(--bull)"
        opacity="0.85"
        transform={`rotate(-90 ${O.x - 70} ${O.y - H_PX / 2})`}
      >
        {def.caption}
      </text>
    </g>
  );
});

// ── Stat card — same pattern as the learn-page Greek cards ───────────────────
function GreekStatCard({
  greek,
  value,
  series,
  showLine,
}: {
  greek: GreekKey;
  value: string;
  series: number[];
  showLine: boolean;
}) {
  const step = Math.max(1, Math.floor(series.length / 15));
  const pts = series.filter((_, i) => i % step === 0);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const points = pts
    .map((v, i) => `${((i / (pts.length - 1)) * 90).toFixed(1)},${(2 + (1 - (v - min) / range) * 16).toFixed(1)}`)
    .join(" ");

  return (
    <div className="calm-panel p-3 md:p-4">
      <i aria-hidden className="lit-aura" />
      <div className="t-label flex items-baseline gap-1.5 text-fg-dim">
        {/* The words used to be replaced by bare Greek letters below md, because
            five cards across 375px left no room for them — so the page that
            teaches the Greeks stopped naming them on the device most people
            read it on. The grid reflows to 2-up now, so the name always fits
            and the letter rides alongside it as the glyph, not as a substitute. */}
        <span className="text-brand-ink">{GREEK_COPY[greek].letter}</span>
        <span>{GREEK_COPY[greek].label}</span>
      </div>
      <div className="mt-1 flex items-end justify-between gap-2 md:mt-2">
        <div
          data-greek={greek}
          className="font-display text-sm tracking-tightest tabular-nums text-fg md:text-2xl lg:text-3xl"
        >
          {value}
        </div>
        {/* The sparkline and the teacher line are the two things that push a
            card past ~55px; both are detail, so they wait for the wider grid. */}
        <svg viewBox="0 0 90 20" className="mb-1 hidden h-4 w-[4.5rem] shrink-0 text-brand-ink md:block" fill="none" aria-hidden>
          <polyline points={points} stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
      {showLine && (
        <div
          data-teacher-line
          className="mt-3 hidden border-t border-border-soft pt-2 text-[0.6875rem] leading-relaxed text-fg-dim md:block"
        >
          {GREEK_COPY[greek].line}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function GreeksLabPage() {
  const [symbol, setSymbol] = useState<(typeof SYMBOLS)[number]>("AMZN");
  const [spot, setSpot] = useState(FALLBACK_SPOT);
  const [source, setSource] = useState<"loading" | "live" | "synthetic">("loading");
  const [surfaceKey, setSurfaceKey] = useState<SurfaceKey>("gamma"); // the coolest wave by default
  const [vol, setVol] = useState(FALLBACK_IV);
  const [volSource, setVolSource] = useState<"realized" | "synthetic">("synthetic");
  const [m, setM] = useState(1.04); // moneyness — the handle keeps its relative position when spot changes
  const [days, setDays] = useState(30);
  const [teacher, setTeacher] = useState(true);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ id: number; x: number; y: number; m: number; d: number } | null>(null);

  // Live spot + realized vol for the chosen symbol via the existing quote
  // proxy, re-polled every 30s (same pattern as /trade). Paused while hidden.
  useEffect(() => {
    let cancelled = false;
    setSource("loading");
    const load = async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${symbol}&tf=D`);
        const j = await r.json();
        if (cancelled) return;
        const bars: { c: number }[] = Array.isArray(j?.bars) ? j.bars : [];
        const px: unknown = j?.ok ? j?.meta?.regularMarketPrice ?? bars[bars.length - 1]?.c : null;
        if (typeof px === "number" && Number.isFinite(px) && px > 0) {
          setSpot(px);
          setSource("live");
          const rv = realizedVol(bars.map((b) => b.c));
          if (rv !== null) {
            setVol(rv);
            setVolSource("realized");
          } else {
            setVol(FALLBACK_IV);
            setVolSource("synthetic");
          }
        } else {
          setSpot(FALLBACK_SPOT);
          setSource("synthetic");
          setVol(FALLBACK_IV);
          setVolSource("synthetic");
        }
      } catch {
        if (!cancelled) {
          setSpot(FALLBACK_SPOT);
          setSource("synthetic");
          setVol(FALLBACK_IV);
          setVolSource("synthetic");
        }
      }
    };
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  const surface = useMemo(() => buildSurface(spot, surfaceKey, vol), [spot, surfaceKey, vol]);
  const kMin = spot * M_LO;
  const kMax = spot * M_HI;
  const strike = m * spot;
  // An <input type="range"> only accepts values on the `min + n*step` lattice.
  // With min = spot*0.8 (an arbitrary float) and a "nice" step, the top of the
  // range was unreachable (SPY: a $7.32 dead band) and the initial thumb value
  // snapped away from the real strike. Drive the slider in normalized ticks and
  // map to a strike instead, so every strike in [kMin, kMax] is reachable.
  const STRIKE_TICKS = 500;
  const strikeTick = Math.round(((strike - kMin) / Math.max(1e-9, kMax - kMin)) * STRIKE_TICKS);

  // Live point — the real pricing engine, every render.
  const { price, greeks } = priceOption(spot, strike, yearsOf(days), R, vol, "C");
  const u = (m - M_LO) / (M_HI - M_LO);
  const v = days / D_MAX;
  const zNow = SURFACE_DEFS[surfaceKey].pick(price, greeks); // handle rides the selected surface
  const mTop = project(u, v, heightOf(zNow, surface.lo, surface.hi));
  const mBase = project(u, v, 0);
  const surfaceTitle = `Black-Scholes ${SURFACE_DEFS[surfaceKey].name} surface for a call`;

  // Where the spike near expiry leaves the scale, a label says so: above a
  // crest's opening, or on the clear floor to the left of a valley's, with a
  // short leader. It gives way when the handle comes near.
  const clip = surface.clip;
  const clipAt = clip ? project(clip.u, clip.v, clip.dir === "up" ? 1 : 0) : null;
  const clipLabel =
    clip && clipAt
      ? clip.dir === "up"
        ? { x: clipAt.x, y: clipAt.y - 14, mid: clipAt.x, anchor: "middle" as const }
        : { x: clipAt.x - 36, y: clipAt.y - 44, mid: clipAt.x - 110, anchor: "end" as const }
      : null;
  const clipShown = clipLabel !== null && Math.hypot(mTop.x - clipLabel.mid, mTop.y - clipLabel.y) > 80;

  // Each Greek across strikes at the current expiry — feeds the sparklines.
  const sparks = useMemo(() => {
    const t = yearsOf(days);
    const out: Record<GreekKey, number[]> = { delta: [], gamma: [], theta: [], vega: [], rho: [] };
    for (let i = 0; i <= 40; i++) {
      const k = spot * (M_LO + (i / 40) * (M_HI - M_LO));
      const g = priceOption(spot, k, t, R, vol, "C").greeks;
      for (const key of GREEK_ORDER) out[key].push(g[key]);
    }
    return out;
  }, [days, spot, vol]);

  // Pointer coords → viewBox units (uniform scale; offsets cancel in deltas).
  function svgPoint(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / VB_W, rect.height / VB_H) || 1;
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic events have no active pointer — drag still works via move events */
    }
    dragRef.current = { id: e.pointerId, ...svgPoint(e), m, d: days };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.id) return;
    const p = svgPoint(e);
    // The floor is an OBLIQUE basis: the days axis runs mostly sideways
    // (AXIS_D = {556, -88}), so decomposing pointer travel as "screen-x = strike,
    // screen-y = days" was wrong — a straight-up drag moved the handle up to
    // 420px to the RIGHT and, on the gamma surface, slightly DOWN. Invert the
    // 2x2 basis instead so the grabbed point tracks the cursor in any direction.
    const dx = p.x - drag.x;
    const dy = p.y - drag.y;
    const det = AXIS_K.x * AXIS_D.y - AXIS_K.y * AXIS_D.x;
    const du = (dx * AXIS_D.y - dy * AXIS_D.x) / det;
    const dv = (-dx * AXIS_K.y + dy * AXIS_K.x) / det;
    setM(clamp(drag.m + du * (M_HI - M_LO), M_LO, M_HI));
    setDays(clamp(Math.round(drag.d + dv * D_MAX), D_MIN, D_MAX));
  }

  function onPointerEnd(e: React.PointerEvent<SVGSVGElement>) {
    if (dragRef.current?.id === e.pointerId) {
      dragRef.current = null;
      setDragging(false);
    }
  }

  return (
    <div className="page-aura min-h-screen bg-bg">
      <Nav />
      <main>
        {/* The header's padding is cut from PageHeader's default: this is a lab,
            and the headline asks you to drag something that sits below it. */}
        <PageHeader
          className="!pb-6 !pt-[clamp(2rem,4vw,3.25rem)]"
          eyebrow="The Greek surface · lab"
          title="Drag the strike."
          accent="Watch all five Greeks move."
          actions={
            <>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label htmlFor="symbol-select" className="t-label text-fg-faint">
                  Symbol
                </label>
                <div className="relative">
                  <select
                    id="symbol-select"
                    aria-label="Symbol"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value as (typeof SYMBOLS)[number])}
                    className="calm-input appearance-none !pr-8"
                  >
                    {SYMBOLS.map((s) => (
                      <option key={s} value={s} className="bg-bg text-fg">
                        {s}
                      </option>
                    ))}
                  </select>
                  <svg
                    width="8"
                    height="6"
                    viewBox="0 0 8 6"
                    fill="none"
                    className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-fg-dim"
                  >
                    <path d="M1 1l3 3.5L7 1" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="t-label text-fg-faint">Surface</span>
                {/* By hand, not TogglePill: the kit's pill takes no data attributes. */}
                <div className="flex flex-wrap gap-1.5">
                  {SURFACE_ORDER.map((k) => (
                    <button
                      key={k}
                      data-surface-btn={k}
                      aria-pressed={surfaceKey === k}
                      onClick={() => setSurfaceKey(k)}
                      className="calm-toggle !h-10 md:!h-8"
                    >
                      {SURFACE_DEFS[k].label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                role="switch"
                aria-checked={teacher}
                aria-label="Teacher mode"
                onClick={() => setTeacher((t) => !t)}
                className="calm-pill-secondary inline-flex h-10 items-center gap-2.5 rounded-full pl-3.5 pr-2.5 text-[0.8125rem] font-medium tracking-[-0.005em] transition-colors md:h-8"
              >
                <span className={teacher ? "text-fg" : "text-fg-dim"}>Teacher mode {teacher ? "on" : "off"}</span>
                <span className={`relative h-4 w-7 rounded-full transition-colors ${teacher ? "bg-brand-ink" : "bg-fg/15"}`}>
                  <span
                    className={`absolute top-1/2 size-3 -translate-y-1/2 rounded-full transition-all ${
                      teacher ? "left-3.5 bg-bg" : "left-0.5 bg-fg-dim"
                    }`}
                  />
                </span>
              </button>
            </>
          }
        >
          {teacher && (
            <CalmPanel as="aside" title="What am I seeing?" className="mt-6">
              {/* All five readings share one grid cell, so switching the surface
                  never changes the panel's height and the surface below stays put. */}
              <div className="grid max-w-[90ch] text-[0.875rem] leading-relaxed text-fg-dim">
                {SURFACE_ORDER.map((k) => (
                  <p
                    key={k}
                    data-teach={k}
                    aria-hidden={k !== surfaceKey}
                    className={`col-start-1 row-start-1 ${k === surfaceKey ? "" : "invisible"}`}
                  >
                    This surface shows the {SURFACE_DEFS[k].name} of a call at every strike and every
                    expiry up to {D_MAX} days, computed with Black-Scholes. Strike runs along one edge
                    and days to expiry along the other. {SURFACE_DEFS[k].reads} Drag the glowing handle
                    to move the point, and the five Greek cards below follow it.
                  </p>
                ))}
              </div>
            </CalmPanel>
          )}
        </PageHeader>

        <div className="shell pb-16">
          {/* the surface */}
          <div>
            <svg
              id="surface-svg"
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              className={`mx-auto block h-auto max-h-[66vh] w-full select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
              style={{ touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
              aria-label={`${surfaceTitle}. Drag the handle across the floor to change strike and days to expiry; use the sliders below for precise values.`}
            >
              <title>{surfaceTitle}</title>
              <defs>
                <filter id="meshGlow" x="-8%" y="-8%" width="116%" height="116%">
                  <feGaussianBlur stdDeviation="3.4" />
                </filter>
                <radialGradient id="floorGlow">
                  <stop offset="0%" stopColor="var(--bull)" stopOpacity="0.1" />
                  <stop offset="60%" stopColor="var(--bull)" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="var(--bull)" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="handleHalo">
                  <stop offset="0%" stopColor="var(--bull)" stopOpacity="0.55" />
                  <stop offset="45%" stopColor="var(--bull)" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="var(--bull)" stopOpacity="0" />
                </radialGradient>
              </defs>
              <Wireframe surface={surface} />
              {clip && clipAt && clipLabel && clipShown && (
                <g data-off-scale={clip.dir} fontFamily="var(--font-jetbrains)" fontSize="11" fill="var(--fg-dim)">
                  {clip.dir === "down" && (
                    <line
                      x1={clipLabel.x + 6}
                      y1={clipLabel.y - 4}
                      x2={clipAt.x - 4}
                      y2={clipAt.y - 8}
                      stroke="var(--fg-dim)"
                      strokeWidth="1"
                      opacity="0.6"
                    />
                  )}
                  <text x={clipLabel.x} y={clipLabel.y} textAnchor={clipLabel.anchor}>
                    off scale near expiry{clip.dir === "up" ? " ↑" : ""}
                  </text>
                </g>
              )}
              {/* handle: floor shadow + dotted drop-line + glowing ring on the surface */}
              <g>
                <ellipse cx={mBase.x} cy={mBase.y} rx={20} ry={6} fill="url(#handleHalo)" />
                <line
                  x1={mBase.x}
                  y1={mBase.y}
                  x2={mTop.x}
                  y2={mTop.y + 13}
                  stroke="var(--bull)"
                  strokeWidth="1.6"
                  strokeDasharray="3 5"
                  opacity="0.9"
                />
                <circle cx={mBase.x} cy={mBase.y} r="2.6" fill="var(--bull)" />
                <circle cx={mTop.x} cy={mTop.y} r="34" fill="url(#handleHalo)" />
                <circle
                  cx={mTop.x}
                  cy={mTop.y}
                  r="10.5"
                  fill="var(--bg)"
                  stroke="var(--bull)"
                  strokeWidth="2.6"
                  style={{ filter: "drop-shadow(0 0 8px var(--bull))" }}
                />
                <circle cx={mTop.x} cy={mTop.y} r="4" fill="var(--bull)" />
                <circle cx={mTop.x} cy={mTop.y} r="1.5" fill="var(--fg)" />
              </g>
            </svg>
          </div>

          {/* sliders — accessible fallback for the same state */}
          <div className="calm-panel mt-6 grid items-center gap-x-8 gap-y-5 p-5 md:grid-cols-[1fr_1fr_auto]">
            <i aria-hidden className="lit-aura" />
            <div>
              <div className="flex items-center justify-between t-label text-fg-dim">
                <span>Strike</span>
                <span className="tabular-nums text-fg">${fmtStrike(strike, spot)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={STRIKE_TICKS}
                step={1}
                value={strikeTick}
                aria-label="Strike"
                aria-valuetext={`$${fmtStrike(strike, spot)}`}
                onChange={(e) =>
                  setM(clamp(M_LO + (Number(e.target.value) / STRIKE_TICKS) * (M_HI - M_LO), M_LO, M_HI))
                }
                className="mt-2 h-1 w-full accent-brand-ink"
              />
            </div>
            <div>
              <div className="flex items-center justify-between t-label text-fg-dim">
                <span>Days to expiry</span>
                <span className="tabular-nums text-fg">{days}d</span>
              </div>
              <input
                type="range"
                min={D_MIN}
                max={D_MAX}
                step={1}
                value={days}
                aria-label="Days to expiry"
                onChange={(e) => setDays(clamp(parseInt(e.target.value), D_MIN, D_MAX))}
                className="mt-2 h-1 w-full accent-brand-ink"
              />
            </div>
            <div className="flex items-center gap-5 md:border-l md:border-border-soft md:pl-4">
              <div>
                <div className="t-label text-fg-dim">Call price</div>
                <div className="mt-1 font-display text-2xl tracking-tightest tabular-nums text-fg">
                  ${price.toFixed(2)}
                </div>
              </div>
              <div className="t-label text-fg-faint">
                <span className="text-fg-dim">{symbol}</span> spot{" "}
                <span data-spot-strip className="tabular-nums text-fg-dim">${spot.toFixed(2)}</span>
                <br />
                IV {(vol * 100).toFixed(1)}%{volSource === "realized" ? " (realized 60d)" : " (synthetic)"} · R 4.5%
              </div>
            </div>
          </div>

          {/* five live Greek cards */}
          {/* Was grid-cols-2 on mobile: five cards wrapped to three rows (~400px),
              so the drag surface and the readouts could never be on screen
              together at 375x812 — the exact thing the headline asks you to do.
              One compact row on mobile, full cards from md up. */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {GREEK_ORDER.map((g) => (
              <GreekStatCard
                key={g}
                greek={g}
                value={greeks[g].toFixed(g === "gamma" ? 4 : 3)}
                series={sparks[g]}
                // one sentence at a time: only the Greek matching the selected surface teaches
                showLine={teacher && g === surfaceKey}
              />
            ))}
          </div>

          {/* provenance strip */}
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
            <div className="t-label text-fg-faint">
              Black-Scholes · Computed live in your browser ·{" "}
              {source === "live"
                ? volSource === "realized"
                  ? "Live spot · Realized 60d vol as IV"
                  : "Live spot · Synthetic IV"
                : "Synthetic data"}{" "}
              · Educational — not advice
            </div>
            <CalmLink href="/learn#greeks">Part of §06 in the primer</CalmLink>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

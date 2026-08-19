"use client";

// The Greek Surface lab — the product's showpiece interactive. A real
// Black-Scholes call-price surface over strike × days-to-expiry for a chosen
// symbol (live spot via /api/quote, synthetic $100 fallback), rendered as a
// low-camera SVG wireframe with a draggable glowing handle. Drag it (or use
// the sliders) and all five Greeks recompute live from lib/pricing.
// Design ref: docs/design-refs/05-learn-greeks.png. Educational — not advice.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { priceOption } from "@/lib/pricing";

// ── Model params (house defaults; strike range is spot-relative) ─────────────
const FALLBACK_IV = 0.32; // used until real bars land, and when they can't
const R = 0.045;
const M_LO = 0.8; // strike = spot × moneyness
const M_HI = 1.2;
const D_MIN = 0;
const D_MAX = 90;
const NK = 36; // strike samples
const ND = 27; // expiry samples
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
type SurfaceKey = "price" | "delta" | "gamma" | "theta" | "vega";
const SURFACE_ORDER: SurfaceKey[] = ["price", "delta", "gamma", "theta", "vega"];
const SURFACE_DEFS: Record<
  SurfaceKey,
  { label: string; caption: string; fmt: (v: number) => string; pick: (price: number, g: { delta: number; gamma: number; theta: number; vega: number }) => number }
> = {
  price: { label: "Price", caption: "OPTION PRICE", fmt: (v) => v.toFixed(2), pick: (p) => p },
  delta: { label: "Delta", caption: "DELTA", fmt: (v) => v.toFixed(2), pick: (_, g) => g.delta },
  gamma: { label: "Gamma", caption: "GAMMA", fmt: (v) => v.toFixed(4), pick: (_, g) => g.gamma },
  theta: { label: "Theta", caption: "THETA (ABS)", fmt: (v) => v.toFixed(3), pick: (_, g) => Math.abs(g.theta) },
  vega: { label: "Vega", caption: "VEGA", fmt: (v) => v.toFixed(3), pick: (_, g) => g.vega },
};

// ── Surface grid — real Black-Scholes, recomputed per spot & surface ─────────
type SurfaceData = {
  spot: number;
  surfaceKey: SurfaceKey;
  yMax: number;
  priceStep: number;
  rows: { key: string; pts: string; opacity: number; width: number }[];
  cols: { key: string; pts: string; opacity: number; width: number }[];
};

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
  let maxAll = 0;
  let maxStable = 0; // max over d ≥ 7 — gamma/theta spike toward expiry at the money
  for (let j = 0; j < ND; j++) {
    const d = D_MIN + (j / (ND - 1)) * (D_MAX - D_MIN);
    const row: number[] = [];
    for (let i = 0; i < NK; i++) {
      const k = spot * (M_LO + (i / (NK - 1)) * (M_HI - M_LO));
      const r = priceOption(spot, k, yearsOf(d), R, vol, "C");
      const z = pick(r.price, r.greeks);
      row.push(z);
      if (z > maxAll) maxAll = z;
      if (d >= 7 && z > maxStable) maxStable = z;
    }
    vals.push(row);
  }
  // Normalize to the stable max so every surface fills the height; the real
  // expiry singularity clips at the ceiling as an off-scale crest.
  const yMax = (maxStable || maxAll || 1) * 1.02;
  const priceStep = niceStep(yMax / 6); // ~5–6 labelled ticks at any scale
  const h = (z: number) => Math.min(z / yMax, 1);

  // Rows (constant expiry): the wave the viewer reads. Near rows are
  // thick and bright; far rows recede hard.
  const rows = vals.map((row, j) => {
    const v = j / (ND - 1);
    const depth = Math.pow(1 - v, 1.7);
    return {
      key: `r${j}`,
      opacity: 0.2 + 0.78 * depth,
      width: 0.7 + 1.05 * depth,
      pts: row
        .map((z, i) => {
          const q = project(i / (NK - 1), v, h(z));
          return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        })
        .join(" "),
    };
  });
  const cols = Array.from({ length: NK }, (_, i) => {
    const u = i / (NK - 1);
    return {
      key: `c${i}`,
      opacity: 0.24 + 0.14 * u,
      width: 0.65,
      pts: vals
        .map((row, j) => {
          const q = project(u, j / (ND - 1), h(row[i]));
          return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
        })
        .join(" "),
    };
  });

  return { spot, surfaceKey, yMax, priceStep, rows, cols };
}

const fmtStrike = (k: number, spot: number) => (spot < 50 ? k.toFixed(1) : Math.round(k).toString());

// ── Greek copy (exact house one-liners, same as the learn-page cards) ────────
type GreekKey = "delta" | "gamma" | "theta" | "vega" | "rho";
const GREEK_ORDER: GreekKey[] = ["delta", "gamma", "theta", "vega", "rho"];
const GREEK_COPY: Record<GreekKey, { label: string; line: string }> = {
  delta: { label: "Delta", line: "How much the option price changes for a $1 move in the underlying." },
  gamma: { label: "Gamma", line: "How much Delta changes for a $1 move in the underlying." },
  theta: { label: "Theta", line: "How much time decay reduces the option price each day." },
  vega: { label: "Vega", line: "How much the option price changes for a 1% move in implied volatility." },
  rho: { label: "Rho", line: "How much the option price changes for a 1% move in interest rates." },
};

// ── Static-per-spot wireframe + axes: never re-renders while dragging ────────
const Wireframe = memo(function Wireframe({ surface }: { surface: SurfaceData }) {
  const { spot, surfaceKey, yMax, priceStep, rows, cols } = surface;
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
  for (let i = 0; i * priceStep <= yMax; i++) priceTicks.push(i * priceStep);

  const mesh = (pass: "glow" | "crisp") => (
    <g
      filter={pass === "glow" ? "url(#meshGlow)" : undefined}
      opacity={pass === "glow" ? 0.85 : 1}
    >
      {cols.map((c) => (
        <polyline
          key={c.key}
          points={c.pts}
          fill="none"
          stroke="var(--bull)"
          strokeWidth={pass === "glow" ? c.width + 1.6 : c.width}
          opacity={c.opacity}
        />
      ))}
      {[...rows].reverse().map((r) => (
        <polyline
          key={r.key}
          points={r.pts}
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

      {/* the mesh: blurred bloom pass underneath, crisp pass on top */}
      {mesh("glow")}
      {mesh("crisp")}

      {/* STRIKE axis ticks (front-left edge) — spot-relative */}
      {[0.8, 0.9, 1.0, 1.1, 1.2].map((mm) => {
        const p = project((mm - M_LO) / (M_HI - M_LO), 0, 0);
        return (
          <g key={`kt${mm}`}>
            <line x1={p.x} y1={p.y} x2={p.x - 1.3} y2={p.y + 7} stroke="var(--fg-faint)" strokeWidth="0.8" />
            <text
              data-axis="strike"
              x={p.x - 3}
              y={p.y + 22}
              textAnchor="middle"
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
              x={p.x + 2}
              y={p.y + 22}
              textAnchor="middle"
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
        y={dMid.y + 44}
        textAnchor="middle"
        fontFamily="var(--font-jetbrains)"
        fontSize="11"
        letterSpacing="4"
        fill="var(--bull)"
        opacity="0.85"
        transform={`rotate(${dAngle.toFixed(1)} ${dMid.x + 10} ${dMid.y + 44})`}
      >
        DAYS TO EXPIRY
      </text>

      {/* z axis (vertical, at the near-left corner) — caption follows the selected surface */}
      <line x1={O.x} y1={O.y} x2={O.x} y2={O.y - H_PX} stroke="var(--fg-faint)" strokeWidth="1" />
      {priceTicks.map((t) => {
        const y = O.y - (t / yMax) * H_PX;
        return (
          <g key={`pt${t}`}>
            <line x1={O.x - 5} y1={y} x2={O.x} y2={y} stroke="var(--fg-faint)" strokeWidth="0.8" />
            <text
              data-axis="price"
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
        x={O.x - 58}
        y={O.y - H_PX / 2}
        textAnchor="middle"
        fontFamily="var(--font-jetbrains)"
        fontSize="11"
        letterSpacing="4"
        fill="var(--bull)"
        opacity="0.85"
        transform={`rotate(-90 ${O.x - 58} ${O.y - H_PX / 2})`}
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
  teacher,
}: {
  greek: GreekKey;
  value: string;
  series: number[];
  teacher: boolean;
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
    <div className="border border-border bg-surface p-2 md:p-4">
      <div className="t-chrome text-fg-dim md:text-[10px]">
        {GREEK_COPY[greek].label}
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
        <svg viewBox="0 0 90 20" className="mb-1 hidden h-4 w-[72px] shrink-0 text-bull md:block" fill="none" aria-hidden>
          <polyline points={points} stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </div>
      {teacher && (
        <div
          data-teacher-line
          className="mt-3 hidden border-t border-border-soft pt-2 text-[11px] leading-relaxed text-fg-dim md:block"
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
  const mTop = project(u, v, Math.min(zNow / surface.yMax, 1));
  const mBase = project(u, v, 0);

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

  const sourceChip =
    source === "live" ? (
      <span
        data-source="live"
        className="inline-flex items-center gap-1.5 border border-bull/40 bg-bull/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-bull"
      >
        <span className="size-1 rounded-full bg-bull" />
        Live
      </span>
    ) : source === "synthetic" ? (
      <span
        data-source="synthetic"
        className="inline-flex items-center gap-1.5 border border-border bg-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint"
      >
        <span className="size-1 rounded-full bg-fg-faint" />
        Synthetic
      </span>
    ) : (
      <span
        data-source="loading"
        className="inline-flex items-center gap-1.5 border border-border bg-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint"
      >
        ···
      </span>
    );

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="shell pb-16 pt-10 lg:pt-14">
        {/* header row: kicker · symbol selector · teacher-mode switch */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="t-eyebrow text-bull">
            The Greek surface · lab
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label
                htmlFor="symbol-select"
                className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint"
              >
                Symbol
              </label>
              <div className="relative">
                <select
                  id="symbol-select"
                  aria-label="Symbol"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value as (typeof SYMBOLS)[number])}
                  className="h-10 appearance-none border border-border bg-surface pl-3 pr-8 font-mono text-[11px] uppercase tracking-wider text-fg transition-colors hover:border-fg-faint focus:border-bull focus:outline-none md:h-8"
                >
                  {SYMBOLS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <svg
                  width="8"
                  height="6"
                  viewBox="0 0 8 6"
                  fill="none"
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-dim"
                >
                  <path d="M1 1l3 3.5L7 1" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </div>
              <span data-spot className="t-data text-[12px] text-fg">
                ${spot.toFixed(2)}
              </span>
              {sourceChip}
              <span
                data-vol
                className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] ${
                  volSource === "realized"
                    ? "border-border bg-surface text-fg-dim"
                    : "border-border bg-bg text-fg-faint"
                }`}
              >
                IV {(vol * 100).toFixed(1)}% · {volSource === "realized" ? "Realized 60d" : "Synthetic"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">Surface</span>
              <div className="flex border border-border bg-surface">
                {SURFACE_ORDER.map((k, i) => (
                  <button
                    key={k}
                    data-surface-btn={k}
                    aria-pressed={surfaceKey === k}
                    onClick={() => setSurfaceKey(k)}
                    className={`h-10 px-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors md:h-8 ${
                      i > 0 ? "border-l border-border-soft" : ""
                    } ${surfaceKey === k ? "bg-bull/10 text-bull" : "text-fg-dim hover:bg-bg hover:text-fg"}`}
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
              className={`inline-flex items-center gap-3 rounded-full border px-4 py-3 transition-colors md:py-2 ${
                teacher
                  ? "border-bull/60 bg-bull/10 shadow-[0_0_28px_-10px_var(--bull)]"
                  : "border-border bg-surface hover:border-fg-faint"
              }`}
            >
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.25em] ${teacher ? "text-bull" : "text-fg-dim"}`}
              >
                Teacher mode {teacher ? "on" : "off"}
              </span>
              <span
                className={`relative h-4 w-8 rounded-full border transition-colors ${
                  teacher ? "border-bull/60 bg-bull/20" : "border-border bg-bg"
                }`}
              >
                <span
                  className={`absolute top-1/2 size-3 -translate-y-1/2 rounded-full transition-all ${
                    teacher ? "left-[18px] bg-bull shadow-[0_0_8px_var(--bull)]" : "left-0.5 bg-fg-dim"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* headline + what-am-i-seeing card */}
        <div className="mt-8 flex flex-col items-start justify-between gap-8 lg:flex-row">
          <h1 className="t-title text-fg">
            Drag the strike.
            <br />
            Watch all five Greeks move.
          </h1>
          <aside className="w-full max-w-sm shrink-0 border border-border bg-surface p-5 lg:w-[320px]">
            <div className="t-eyebrow text-bull">What am I seeing?</div>
            <p className="mt-3 text-[12px] leading-relaxed text-fg-dim">
              This is an option pricing surface. Drag the glowing handle to explore how the
              price changes — and watch all five Greeks update in real time. Strike runs
              along one edge, days to expiry along the other; height is whichever surface
              you select — Gamma&apos;s wave crests at the money.
            </p>
          </aside>
        </div>

        {/* the surface */}
        <div className="mt-6">
          <svg
            id="surface-svg"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            className={`mx-auto block h-auto max-h-[66vh] w-full select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            aria-label="Black-Scholes call price surface. Drag the handle across the floor to change strike and days to expiry; use the sliders below for precise values."
          >
            <title>Black-Scholes call price surface</title>
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
        <div className="mt-6 grid items-center gap-x-8 gap-y-5 border border-border bg-surface p-4 md:grid-cols-[1fr_1fr_auto]">
          <div>
            <div className="flex items-center justify-between t-chrome text-fg-dim">
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
              className="mt-2 h-1 w-full accent-bull"
            />
          </div>
          <div>
            <div className="flex items-center justify-between t-chrome text-fg-dim">
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
              className="mt-2 h-1 w-full accent-bull"
            />
          </div>
          <div className="flex items-center gap-5 md:border-l md:border-border-soft md:pl-4">
            <div>
              <div className="t-chrome text-fg-dim">Call price</div>
              <div className="mt-1 font-display text-2xl tracking-tightest tabular-nums text-fg">
                ${price.toFixed(2)}
              </div>
            </div>
            <div className="t-chrome leading-relaxed text-fg-faint">
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
        <div className="mt-4 grid grid-cols-5 gap-1.5 md:grid-cols-5 md:gap-3">
          {GREEK_ORDER.map((g) => (
            <GreekStatCard
              key={g}
              greek={g}
              value={greeks[g].toFixed(g === "gamma" ? 4 : 3)}
              series={sparks[g]}
              teacher={teacher}
            />
          ))}
        </div>

        {/* provenance strip */}
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
            Black-Scholes · Computed live in your browser ·{" "}
            {source === "live"
              ? volSource === "realized"
                ? "Live spot · Realized 60d vol as IV"
                : "Live spot · Synthetic IV"
              : "Synthetic data"}{" "}
            · Educational — not advice
          </div>
          <Link
            href="/learn#greeks"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-dim transition-colors hover:text-bull"
          >
            part of §06 in the primer →
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

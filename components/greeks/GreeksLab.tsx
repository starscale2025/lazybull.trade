"use client";

// THE GREEKS LAB (plan A5, Stage 4), ported from the approved preview onto
// the figure kit. One surface at a time, coloured by height on the brand
// ramp beside its legend bar; a white handle you drag, or move with the
// arrow keys; the price and all five Greeks for the point you chose; and the
// two flat slices through it. /greeks shows all of it; /learn chapter 06
// shows the compact lab (surface, cards, sliders).
//
// Drawing rules it keeps: opaque quads painted back to front so the near
// surface hides the far one; a crest that leaves the scale fades out and is
// labelled instead of being cut flat; a negative Greek (theta) hangs below
// its zero plane; text in the text colours; nothing moves under reduced
// motion. The mesh is memoised, so a drag redraws only the handle, the two
// cuts, the cards and the slices.

import { memo, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { priceOption } from "@/lib/pricing";
import { niceDomain, niceTicks } from "@/lib/viz/scale";
import { rampVar } from "@/lib/viz/ramp";
import { shareUrl } from "@/lib/share-trade";
import { CurveFigure } from "@/components/viz";

export type LabGreek = "price" | "delta" | "gamma" | "theta" | "vega" | "rho";
export const LAB_GREEKS: LabGreek[] = ["price", "delta", "gamma", "theta", "vega", "rho"];
const DEF: Record<LabGreek, { name: string; sym: string; dec: number }> = {
  price: { name: "Price", sym: "$", dec: 2 },
  delta: { name: "Delta", sym: "Δ", dec: 3 },
  gamma: { name: "Gamma", sym: "Γ", dec: 4 },
  theta: { name: "Theta", sym: "Θ", dec: 3 },
  vega: { name: "Vega", sym: "ν", dec: 3 },
  rho: { name: "Rho", sym: "ρ", dec: 3 },
};

// the grid: strikes across, days left going back, crowded toward expiry
const KLO = 0.8;
const KHI = 1.2;
const DMIN = 0.75; // the mesh stops three quarters of a day before expiry
const DMAX = 90;
const NK = 36;
const ND = 27;
const DAYS = Array.from({ length: ND + 1 }, (_, j) => DMIN + (DMAX - DMIN) * (j / ND) ** 2);
const HMAX = 1.35; // how far a crest may rise past the scale before it has faded out
const HMIN = -0.3;

// the camera: u = strike along the front edge, v = days left going back, h = height
const O = { x: 88, y: 404 };
const AK = { x: 361, y: 67 };
const AD = { x: 389, y: -62 };
const HP = 250;
const P = (u: number, v: number, h = 0) => ({ x: O.x + AK.x * u + AD.x * v, y: O.y + AK.y * u + AD.y * v - HP * h });
type Pt = { x: number; y: number };
const n1 = (v: number) => Math.round(v * 10) / 10;
const pathOf = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${n1(p.x)} ${n1(p.y)}`).join("");
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const MINUS = "−";
const num = (v: number, d: number) => (v < 0 ? MINUS : "") + Math.abs(v).toFixed(d);
const fmtDays = (d: number) => `${Number.isInteger(d) ? d : d.toFixed(2).replace(/0$/, "")} ${d === 1 ? "day" : "days"}`;
const MONO = "var(--font-jetbrains), ui-monospace, monospace";

export type Market = { S: number; r: number; vol: number; put: boolean };
const strikeAt = (m: Market, u: number) => m.S * (KLO + (KHI - KLO) * u);
function valueOf(g: LabGreek, m: Market, u: number, d: number, vol = m.vol) {
  const o = priceOption(m.S, strikeAt(m, u), Math.max(0.0005, d / 365), m.r, vol, m.put ? "P" : "C");
  return g === "price" ? o.price : o.greeks[g];
}
const gridOf = (g: LabGreek, m: Market, vol: number) => DAYS.map((d) => Array.from({ length: NK + 1 }, (_, i) => valueOf(g, m, i / NK, d, vol)));

type Mesh = {
  quads: { d: string; t: number; fade: number }[];
  lo: number;
  hi: number;
  ticks: number[];
  h: (z: number) => number;
  over: [number, number] | null;
  under: [number, number] | null;
  ghost: string | null;
};

// The scale holds every value from 7 days out (and the reference surface, when
// it shows), and zero; the spike nearer expiry leaves it and fades.
function buildMesh(g: LabGreek, m: Market, vol0: number): Mesh {
  const Z = gridOf(g, m, m.vol);
  const ref = Math.abs(m.vol - vol0) > 1e-9 ? gridOf(g, m, vol0) : null;
  let lo = 0;
  let hi = 0;
  for (const grid of ref ? [Z, ref] : [Z])
    grid.forEach((row, j) => {
      if (DAYS[j] >= 7) for (const z of row) [lo, hi] = [Math.min(lo, z), Math.max(hi, z)];
    });
  [lo, hi] = niceDomain(lo, hi, 4, true);
  const h = (z: number) => (z - lo) / (hi - lo || 1);
  const N = Z.map((row, j) => row.map((z, i) => ({ h: h(z), p: P(i / NK, DAYS[j] / DMAX, clamp(h(z), HMIN, HMAX)) })));
  const quads: Mesh["quads"] = [];
  let over: Mesh["over"] = null;
  let under: Mesh["under"] = null;
  const grow = (r: [number, number] | null, x: number): [number, number] => (r ? [Math.min(r[0], x), Math.max(r[1], x)] : [x, x]);
  for (let j = ND - 1; j >= 0; j--)
    for (let i = 0; i < NK; i++) {
      const q = [N[j][i], N[j][i + 1], N[j + 1][i + 1], N[j + 1][i]];
      const hs = q.map((c) => c.h);
      const hx = Math.max(...hs);
      const hn = Math.min(...hs);
      for (const c of q) {
        if (c.h > 1) over = grow(over, c.p.x);
        if (c.h < 0) under = grow(under, c.p.x);
      }
      const fade = hx > 1 ? 1 - (hx - 1) / (HMAX - 1) : hn < 0 ? 1 - hn / HMIN : 1;
      if (fade < 0.05) continue;
      quads.push({ d: `${pathOf(q.map((c) => c.p))}Z`, t: clamp((hs[0] + hs[1] + hs[2] + hs[3]) / 4, 0, 1), fade });
    }
  // the reference: the surface at the starting volatility, as grey lines that stop at the box
  let ghost: string | null = null;
  if (ref) {
    const curve = (pts: [number, number, number][]) => {
      let d = "";
      let pen = false;
      for (const [u, v, z] of pts) {
        const hz = h(z);
        if (hz > 1.02 || hz < -0.02) {
          pen = false;
          continue;
        }
        const p = P(u, v, hz);
        d += `${pen ? "L" : "M"}${n1(p.x)} ${n1(p.y)}`;
        pen = true;
      }
      return d;
    };
    ghost = "";
    for (let i = 0; i <= NK; i += 6) ghost += curve(DAYS.map((dd, j) => [i / NK, dd / DMAX, ref[j][i]]));
    for (let j = 0; j <= ND; j += 9) ghost += curve(ref[j].map((z, i) => [i / NK, DAYS[j] / DMAX, z]));
  }
  return { quads, lo, hi, ticks: niceTicks(lo, hi, 4), h, over, under, ghost };
}

// The mesh and its box: they change with the Greek, the type, the volatility,
// the rate and the stock, never with the handle.
const SurfaceBack = memo(function SurfaceBack({ mesh, m, g }: { mesh: Mesh; m: Market; g: LabGreek }) {
  const dec = Math.max(0, Math.min(4, -Math.floor(Math.log10((mesh.ticks[1] ?? 1) - (mesh.ticks[0] ?? 0) || 1) + 1e-9)));
  const kTicks = niceTicks(strikeAt(m, 0), strikeAt(m, 1), 5);
  return (
    <g>
      <path d={`${pathOf([P(0, 0), P(1, 0), P(1, 1), P(0, 1)])}Z`} fill="none" stroke="var(--viz-axis)" />
      {kTicks.map((K) => {
        const u = (K / m.S - KLO) / (KHI - KLO);
        const a = P(u, 0);
        const blocked = mesh.under && a.x - 4 > mesh.under[0] - 6 && a.x - 26 < mesh.under[1] + 6;
        return (
          <g key={`k${K}`}>
            <line x1={a.x} y1={a.y} x2={P(u, 1).x} y2={P(u, 1).y} stroke="var(--viz-grid)" />
            {!blocked && (
              <text x={n1(a.x - 4)} y={n1(a.y + 16)} textAnchor="end" fontFamily={MONO} fontSize={10} fill="var(--fg-dim)">
                {K.toFixed(0)}
              </text>
            )}
          </g>
        );
      })}
      {[0, 30, 60, 90].map((d) => {
        const a = P(1, d / DMAX);
        return (
          <g key={`d${d}`}>
            {d % 90 !== 0 && <line x1={P(0, d / DMAX).x} y1={P(0, d / DMAX).y} x2={a.x} y2={a.y} stroke="var(--viz-grid)" />}
            <text x={n1(a.x + 8)} y={n1(a.y + 14)} fontFamily={MONO} fontSize={10} fill="var(--fg-dim)">
              {d}
            </text>
          </g>
        );
      })}
      {mesh.ticks.map((z) => {
        const h = mesh.h(z);
        const y = n1(O.y - HP * h);
        return (
          <g key={`z${z}`}>
            <path d={pathOf([P(0, 0, h), P(0, 1, h), P(1, 1, h)])} fill="none" stroke={Math.abs(z) < 1e-12 ? "var(--viz-axis)" : "var(--viz-grid)"} />
            <line x1={72} x2={76} y1={y} y2={y} stroke="var(--viz-axis)" />
            <text x={68} y={y + 4} textAnchor="end" fontFamily={MONO} fontSize={10} fill="var(--fg-dim)">
              {num(z, dec)}
            </text>
          </g>
        );
      })}
      <line x1={P(0, 0).x} y1={P(0, 0).y} x2={P(0, 0, 1).x} y2={P(0, 0, 1).y} stroke="var(--viz-axis)" />
      <line x1={P(0, 1).x} y1={P(0, 1).y} x2={P(0, 1, 1).x} y2={P(0, 1, 1).y} stroke="var(--viz-grid)" />
      <line x1={P(1, 1).x} y1={P(1, 1).y} x2={P(1, 1, 1).x} y2={P(1, 1, 1).y} stroke="var(--viz-grid)" />
      {/* the ramp's legend bar, on the height axis it explains */}
      {Array.from({ length: 9 }, (_, i) => (
        <rect key={i} x={76} y={O.y - (HP * (i + 1)) / 9} width={8} height={HP / 9 + 0.5} fill={`var(--viz-ramp-${i})`} />
      ))}
      <g fontFamily={MONO} fontSize={10} letterSpacing="0.08em" fill="var(--fg-faint)">
        <text x={84} y={O.y - HP - 12} textAnchor="end">
          {DEF[g].name.toUpperCase()}
        </text>
        <text x={88} y={470}>STRIKE</text>
        <text x={838} y={448} textAnchor="end">
          DAYS LEFT
        </text>
      </g>
      {mesh.quads.map((q, k) => (
        <path
          key={k}
          d={q.d}
          style={{ fill: `color-mix(in srgb, ${rampVar(q.t)} 16%, var(--bg))` }}
          stroke={rampVar(q.t)}
          strokeWidth={1}
          opacity={q.fade < 1 ? +q.fade.toFixed(2) : undefined}
        />
      ))}
      {mesh.ghost && <path d={mesh.ghost} fill="none" stroke="var(--viz-ref)" strokeWidth={1.2} opacity={0.7} />}
      <g fontFamily={MONO} fontSize={10} fill="var(--fg-dim)">
        {mesh.over && (
          <text x={n1(mesh.over[0] - 12)} y={112} textAnchor="end">
            off scale: grows without limit at expiry
          </text>
        )}
        {mesh.under && (
          <text x={n1(mesh.under[1] + 12)} y={505}>
            off scale: falls without limit at expiry
          </text>
        )}
      </g>
    </g>
  );
});

function Teach({ g, m, u, d, value }: { g: LabGreek; m: Market; u: number; d: number; value: number }) {
  const K = strikeAt(m, u);
  const a = Math.abs(value);
  const kind = m.put ? "put" : "call";
  const usd = (v: number, dp = 2) => `$${v.toFixed(dp)}`;
  const b = (s: string) => <b className="font-semibold text-fg">{s}</b>;
  let t: ReactNode;
  if (g === "price") {
    const iv = Math.max(m.put ? K - m.S : m.S - K, 0);
    t = (
      <>
        this {kind} is worth {b(usd(value))} a share.{" "}
        {iv < 0.005
          ? "All of it is time value: it would pay nothing if it expired right now, so the price is only the chance that this changes."
          : value < iv - 0.005
            ? `That is ${usd(iv - value)} less than the ${usd(iv)} it would pay if exercised today. The formula assumes exercise only at expiry, and waiting for the strike money costs interest.`
            : `${usd(iv)} of that is what it would pay if it expired right now. The other ${usd(value - iv)} is time value, the part theta takes away.`}
      </>
    );
  } else if (g === "delta") {
    t = (
      <>
        a $1 rise in the stock {m.put ? "takes about" : "adds about"} {b(usd(a))} {m.put ? "off" : "to"} this {kind}. Close to {m.put ? `${MINUS}1` : "1"} it moves almost dollar for dollar {m.put ? "against" : "with"} the stock; close to 0 it barely moves.
      </>
    );
  } else if (g === "gamma") {
    t = <>a $1 move in the stock changes delta by about {b(value.toFixed(4))}. Gamma peaks where the strike meets the stock price, and it grows as expiry gets close: the ridge at the front of the surface.</>;
  } else if (g === "theta") {
    t =
      value < 0 ? (
        <>this {kind} loses about {b(usd(a, 3))} a share each day if nothing else changes. The loss speeds up as expiry gets close: the valley at the front of the surface.</>
      ) : (
        <>this put gains about {b(usd(a, 3))} a share each day. That happens only deep in the money, where a put that cannot be exercised early is priced below what it would pay today and climbs toward it.</>
      );
  } else if (g === "vega") {
    const v = Math.round(m.vol * 100);
    t = <>if volatility rises one point, from {v}% to {v + 1}%, this {kind} gains about {b(usd(value, 3))} a share. Vega is largest far from expiry with the strike near the stock price, and fades to nothing at expiry.</>;
  } else {
    t = <>if interest rates rise one point, this {kind} {m.put ? "loses" : "gains"} about {b(usd(a, 3))} a share. Rho matters most for long-dated options, which is why the surface {m.put ? "falls" : "climbs"} toward the back.</>;
  }
  return (
    <>
      At a strike of {b(K.toFixed(0))} with {b(fmtDays(d))} left, {t}
    </>
  );
}

export function GreeksLab({
  symbol,
  spot,
  vol0,
  source,
  compact = false,
}: {
  symbol: string;
  spot: number;
  /** The starting volatility: the stock's realised vol, or the tape's. Reset returns here. */
  vol0: number;
  source: "LIVE" | "SIM";
  /** /learn's version: the surface, the cards and the sliders, without the slices. */
  compact?: boolean;
}) {
  const [g, setG] = useState<LabGreek>("gamma");
  const [put, setPut] = useState(false);
  const [u, setU] = useState(0.5);
  const [d, setD] = useState(30);
  const [vol, setVol] = useState(vol0);
  const [r, setR] = useState(0.045);
  const [more, setMore] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [said, setSaid] = useState("");
  const uid = useId().replace(/:/g, "");
  useEffect(() => setVol(vol0), [vol0]);

  const m: Market = useMemo(() => ({ S: spot, r, vol, put }), [spot, r, vol, put]);
  const mesh = useMemo(() => buildMesh(g, m, vol0), [g, m, vol0]);
  const value = valueOf(g, m, u, d);
  const K = strikeAt(m, u);
  const v = d / DMAX;
  const hv = mesh.h(value);
  const hc = clamp(hv, HMIN, HMAX);
  const foot = P(u, v);
  const head = P(u, v, clamp(hv, -0.02, 1.02));

  // the two cuts through the chosen point, drawn on the surface while they stay on the scale
  const cuts = useMemo(() => {
    const along = (pts: [number, number, number][]) => {
      let s = "";
      let pen = false;
      for (const [uu, vv, z] of pts) {
        const h = mesh.h(z);
        if (h > 1.02 || h < -0.02) {
          pen = false;
          continue;
        }
        const p = P(uu, vv, h);
        s += `${pen ? "L" : "M"}${n1(p.x)} ${n1(p.y)}`;
        pen = true;
      }
      return s;
    };
    const ku = Array.from({ length: 73 }, (_, i) => [i / 72, v, valueOf(g, m, i / 72, d)] as [number, number, number]);
    const dv = Array.from({ length: 61 }, (_, i) => {
      const dd = DMIN + (DMAX - DMIN) * (i / 60) ** 2;
      return [u, dd / DMAX, valueOf(g, m, u, dd)] as [number, number, number];
    });
    return along(ku) + along(dv);
  }, [g, m, u, d, v, mesh]);

  // drag: the pointer moves the handle's point on the floor; the handle rides the surface above it
  const svgRef = useRef<SVGSVGElement>(null);
  const grab = useRef<{ dx: number; dy: number; id: number } | null>(null);
  const toSvg = (e: React.PointerEvent) => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const det = AK.x * AD.y - AD.x * AK.y;
  const onDown = (e: React.PointerEvent<SVGGElement>) => {
    setPlaying(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus({ preventScroll: true });
    const p = toSvg(e);
    grab.current = { dx: p.x - foot.x, dy: p.y - foot.y, id: e.pointerId };
    e.preventDefault();
  };
  const onMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!grab.current || grab.current.id !== e.pointerId) return;
    const p = toSvg(e);
    const fx = p.x - grab.current.dx - O.x;
    const fy = p.y - grab.current.dy - O.y;
    setU(Math.round(clamp((fx * AD.y - AD.x * fy) / det, 0, 1) * 200) / 200);
    setD(clamp(Math.round(((AK.x * fy - AK.y * fx) / det) * DMAX * 4) / 4, DMIN, DMAX));
  };
  const onUp = () => {
    grab.current = null;
  };
  const onKey = (e: React.KeyboardEvent) => {
    const s = e.shiftKey ? 5 : 1;
    let nu = u;
    let nd = d;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") nu = Math.round(clamp(u + (e.key === "ArrowRight" ? 0.01 : -0.01) * s, 0, 1) * 200) / 200;
    else if (e.key === "ArrowUp") nd = clamp(Math.floor(d) + s, DMIN, DMAX);
    else if (e.key === "ArrowDown") nd = clamp(Math.ceil(d) - s, DMIN, DMAX);
    else return;
    e.preventDefault();
    setPlaying(false);
    setU(nu);
    setD(nd);
    setSaid(`Strike ${strikeAt(m, nu).toFixed(0)}, ${fmtDays(nd)} left, ${DEF[g].name} ${num(valueOf(g, m, nu, nd), DEF[g].dec)}`);
  };

  // play: time runs toward expiry and slows there, where the Greeks change fastest
  const calm = useRef(false);
  useEffect(() => {
    calm.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const dRef = useRef(d);
  dRef.current = d;
  useEffect(() => {
    if (!playing) return;
    const from = dRef.current < 2 ? DMAX : dRef.current;
    const t0 = performance.now();
    const dur = 1500 + (4000 * (from - DMIN)) / (DMAX - DMIN);
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      setD(Math.max(DMIN, Math.round((DMIN + (from - DMIN) * (1 - k) ** 2) * 4) / 4));
      if (k < 1) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
  const play = () => {
    if (calm.current) setD((x) => (x <= DMIN ? DMAX : Math.max(DMIN, x - 7)));
    else setPlaying((p) => !p);
  };

  const label = `${DEF[g].sym} ${num(value, DEF[g].dec)}${hv !== hc || hv > 1.02 || hv < -0.02 ? " · off scale" : ""}`;
  const right = head.x < 690;
  const builder = shareUrl(
    {
      underlying: symbol,
      spot: Math.round(spot * 100) / 100,
      daysToExpiry: Math.max(1, Math.round(d)),
      legs: [{ type: put ? "P" : "C", side: "long", strike: Math.round(K * 2) / 2, qty: 1, premium: Math.max(0.01, Math.round(valueOf("price", m, u, d) * 100) / 100) }],
    },
    ""
  );
  const what = g === "price" ? "the option's price" : DEF[g].name.toLowerCase();

  return (
    <div className="space-y-4">
      <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}`}>
        {/* the surface, with its reading underneath */}
        <section className="calm-panel p-4 md:p-5" aria-labelledby={`${uid}-title`}>
          <i aria-hidden className="lit-aura" />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`${uid}-title`} className="font-display text-xl tracking-tightest text-fg">
              {DEF[g].name} surface · {put ? "put" : "call"}
            </h2>
            <span className="t-label text-fg-faint">
              {symbol} · stock {spot.toFixed(2)} · {source === "LIVE" ? "live" : "synthetic"}
            </span>
          </div>
          <svg ref={svgRef} viewBox="0 52 860 482" role="group" aria-labelledby={`${uid}-title`} className="mt-2 block h-auto w-full select-none" style={{ touchAction: "pan-y" }}>
            <SurfaceBack mesh={mesh} m={m} g={g} />
            <g pointerEvents="none">
              <path d={`${pathOf([P(u, 0), P(u, 1)])}${pathOf([P(0, v), P(1, v)])}`} fill="none" stroke="var(--viz-axis)" />
              <path d={cuts} fill="none" stroke="var(--fg)" strokeWidth={1.6} opacity={0.65} strokeLinecap="round" strokeLinejoin="round" />
              <line x1={foot.x} y1={foot.y} x2={head.x} y2={head.y} stroke="var(--fg)" opacity={0.5} />
              <circle cx={foot.x} cy={foot.y} r={2.5} fill="var(--fg)" opacity={0.65} />
              <text x={n1(head.x + (right ? 14 : -14))} y={n1(head.y - 12)} textAnchor={right ? "start" : "end"} fontFamily={MONO} fontSize={12} fill="var(--fg)" style={{ fontVariantNumeric: "tabular-nums" }}>
                {label}
              </text>
            </g>
            {/* the handle: white with a dark ring, a 36 px target; only here does a drag stop the page scrolling */}
            <g
              transform={`translate(${n1(head.x)} ${n1(head.y)})`}
              tabIndex={0}
              role="slider"
              aria-label="Chosen strike and days left"
              aria-valuemin={Math.round(strikeAt(m, 0))}
              aria-valuemax={Math.round(strikeAt(m, 1))}
              aria-valuenow={Math.round(K)}
              aria-valuetext={`Strike ${K.toFixed(0)}, ${fmtDays(d)} left, ${DEF[g].name} ${num(value, DEF[g].dec)}`}
              className="group cursor-grab outline-none active:cursor-grabbing"
              style={{ touchAction: "none" }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onKeyDown={onKey}
            >
              <circle r={18} fill="transparent" />
              <circle className="opacity-0 group-focus-visible:opacity-100" r={12} fill="none" stroke="var(--fg)" strokeWidth={1.5} />
              <circle r={6.5} fill="var(--fg)" stroke="var(--bg)" strokeWidth={2.5} />
            </g>
          </svg>
          <p aria-live="polite" className="sr-only">
            {said}
          </p>
          {/* three lines, always: the panel does not jump while the handle moves */}
          <p className="mt-3 min-h-[4.65em] text-[0.9375rem] leading-[1.55] text-fg-dim">
            <Teach g={g} m={m} u={u} d={d} value={value} />
          </p>
          <p className="mt-2 min-h-[3em] text-[0.75rem] leading-[1.5] text-fg-faint">
            Height and colour both show {what}, read against the bar on the left. The mesh stops three quarters of a day before expiry.
            {mesh.over || mesh.under ? " Close to expiry it leaves the scale, so it fades out instead of being cut flat." : ""}
            {mesh.ghost ? ` Grey lines: the surface at ${Math.round(vol0 * 100)}% volatility.` : ""}
          </p>
        </section>

        <div className="flex flex-col gap-4">
          {/* the price and the five Greeks at the chosen point; a card picks the surface */}
          <section className="calm-panel p-3 md:p-4" aria-label="Choose a surface">
            <i aria-hidden className="lit-aura" />
            <div className="grid grid-cols-2 gap-2.5">
              {LAB_GREEKS.map((k) => {
                const z = valueOf(k, m, u, d);
                const ys = Array.from({ length: 41 }, (_, i) => valueOf(k, m, i / 40, d));
                const lo = Math.min(...ys);
                const sp = Math.max(...ys) - lo || 1;
                const X = (q: number) => 5 + q * 94;
                const Y = (y: number) => 34 - ((y - lo) / sp) * 28;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={k === g}
                    onClick={() => setG(k)}
                    className="grid grid-cols-[1fr_auto] items-end gap-2 rounded-2xl border border-border-soft px-3 py-2.5 text-left transition-colors hover:border-fg/40 aria-pressed:border-fg aria-pressed:bg-fg/[0.05]"
                  >
                    <span>
                      <span className="t-label block text-fg-dim">
                        {k !== "price" && <span className="text-brand-ink">{DEF[k].sym} </span>}
                        {DEF[k].name}
                      </span>
                      <span className="mt-1 block font-display text-xl tracking-tightest tabular-nums text-fg">
                        {k === "price" ? "$" : ""}
                        {num(z, DEF[k].dec)}
                      </span>
                    </span>
                    <svg viewBox="0 0 104 40" className="h-8 w-20" aria-hidden>
                      <path d={ys.map((y, i) => `${i ? "L" : "M"}${n1(X(i / 40))} ${n1(Y(y))}`).join("")} fill="none" stroke="var(--viz-model)" strokeWidth={1.6} />
                      <circle cx={X(u)} cy={Y(z)} r={3.5} fill="var(--viz-model)" stroke="var(--bg)" strokeWidth={1.5} />
                    </svg>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="calm-panel flex flex-1 flex-col gap-3.5 p-4" aria-label="Controls">
            <i aria-hidden className="lit-aura" />
            <div className="flex items-center justify-between gap-3">
              <div role="group" aria-label="Option type" className="inline-flex rounded-full bg-fg/[0.06] p-1">
                {(["Call", "Put"] as const).map((t) => (
                  <button key={t} type="button" aria-pressed={(t === "Put") === put} onClick={() => setPut(t === "Put")} className="calm-toggle !h-8 !px-4">
                    {t}
                  </button>
                ))}
              </div>
              <button type="button" onClick={play} className="calm-pill-secondary inline-flex h-9 items-center rounded-full px-4 text-[0.8125rem] font-medium">
                {playing ? "❚❚ Pause" : "▶ Play time decay"}
              </button>
            </div>
            <Slider label="Strike" min={0} max={1} step={0.005} value={u} onChange={setU} out={`$${K.toFixed(0)}`} />
            <Slider label="Days left" min={DMIN} max={DMAX} step={0.25} value={d} onChange={(x) => (setPlaying(false), setD(x))} out={fmtDays(d)} />
            <Slider label="Volatility" min={0.1} max={0.8} step={0.01} value={vol} onChange={setVol} out={`${Math.round(vol * 100)}%`} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem]">
              <button type="button" disabled={Math.abs(vol - vol0) < 1e-9} onClick={() => setVol(vol0)} className="calm-link disabled:opacity-40">
                Reset volatility
              </button>
              <button type="button" aria-expanded={more} onClick={() => setMore((x) => !x)} className="calm-link">
                {more ? "Less" : "More"}
              </button>
              {!compact && (
                <a href={builder} className="calm-link ml-auto">
                  Open this strike in the builder ›
                </a>
              )}
            </div>
            {more && <Slider label="Rate" min={0} max={0.1} step={0.0025} value={r} onChange={setR} out={`${(r * 100).toFixed(2)}%`} />}
          </section>
        </div>
      </div>

      {!compact && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="calm-panel p-4">
            <i aria-hidden className="lit-aura" />
            <CurveFigure
              title={`${DEF[g].name} across strikes, ${fmtDays(d)} left`}
              desc={`How ${what} changes with the strike at ${fmtDays(d)} to expiry; the dot is your point.`}
              x={{ domain: [strikeAt(m, 0), strikeAt(m, 1)], label: "Strike" }}
              y={{ domain: niceDomain(...minmax(Array.from({ length: 73 }, (_, i) => valueOf(g, m, i / 72, d)).concat(value)), 4, true) }}
              lines={[{ points: Array.from({ length: 73 }, (_, i) => [strikeAt(m, i / 72), valueOf(g, m, i / 72, d)] as [number, number]), role: "model" }]}
              verticals={[{ x: spot, label: `stock ${spot.toFixed(0)}` }]}
              markers={[{ x: K, y: value, text: `${g === "price" ? "$" : ""}${num(value, DEF[g].dec)}` }]}
              height={240}
            />
            <p className="mt-1 t-label text-fg-faint">{DEF[g].name} across strikes, {fmtDays(d)} left</p>
          </section>
          <section className="calm-panel p-4">
            <i aria-hidden className="lit-aura" />
            <CurveFigure
              title={`${DEF[g].name} as time passes, strike ${K.toFixed(0)}`}
              desc={`How ${what} changes as expiry gets close, at a strike of ${K.toFixed(0)}; time runs left to right.`}
              x={{ domain: [DMAX, 0], label: "Days left", ticks: [90, 60, 30, 0] }}
              y={{ domain: niceDomain(...minmax(DAYS.map((dd) => valueOf(g, m, u, dd)).concat(value)), 4, true) }}
              lines={[{ points: Array.from({ length: 81 }, (_, i) => { const dd = DMIN + (DMAX - DMIN) * (i / 80) ** 2; return [dd, valueOf(g, m, u, dd)] as [number, number]; }), role: "model" }]}
              markers={[{ x: d, y: value, text: `${g === "price" ? "$" : ""}${num(value, DEF[g].dec)}` }]}
              height={240}
            />
            <p className="mt-1 t-label text-fg-faint">{DEF[g].name} as time passes, strike {K.toFixed(0)}</p>
          </section>
        </div>
      )}
    </div>
  );
}

const minmax = (vs: number[]): [number, number] => [Math.min(...vs), Math.max(...vs)];

function Slider({ label, min, max, step, value, onChange, out }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; out: string }) {
  return (
    <label className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-3 text-[0.8125rem] text-fg-dim">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="h-1 w-full accent-brand-ink" />
      <output className="text-right tabular-nums text-fg">{out}</output>
    </label>
  );
}

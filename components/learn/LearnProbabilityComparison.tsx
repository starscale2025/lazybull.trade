"use client";

// Three probability models compute "P(price lands in band by expiry)" given
// the same inputs — Black-Scholes, Monte Carlo, Empirical. Drag the band
// and watch them disagree. Visceral demo of model risk.

import { useMemo, useState } from "react";

const SPOT = 100;

function ncdf(x: number) {
  // Abramowitz-Stegun normal CDF approximation
  const a1 = 0.319381530, a2 = -0.356563782, a3 = 1.781477937, a4 = -1.821255978, a5 = 1.330274429;
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const ndf = Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
  const w = 1 - ndf * (a1 * k + a2 * k ** 2 + a3 * k ** 3 + a4 * k ** 4 + a5 * k ** 5);
  return x >= 0 ? w : 1 - w;
}

// Black-Scholes "in band" prob under risk-neutral lognormal
function probBS(spot: number, low: number, high: number, t: number, iv: number) {
  const sig = iv * Math.sqrt(t);
  const d2lo = (Math.log(low / spot) - 0.5 * sig * sig) / sig;
  const d2hi = (Math.log(high / spot) - 0.5 * sig * sig) / sig;
  return ncdf(d2hi) - ncdf(d2lo);
}

// Monte Carlo: simulate paths under GBM, count how many land inside.
function probMC(spot: number, low: number, high: number, t: number, iv: number, seed = 7) {
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let r = s; r = Math.imul(r ^ (r >>> 15), r | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  const norm = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
  const N = 4000;
  let inside = 0;
  for (let i = 0; i < N; i++) {
    const z = norm();
    const x = spot * Math.exp(-0.5 * iv * iv * t + iv * Math.sqrt(t) * z);
    if (x >= low && x <= high) inside++;
  }
  return inside / N;
}

// Empirical: assume returns drawn from a fat-tailed mixture (Gaussian + Cauchy).
// This intentionally disagrees with BS to make model risk visible.
function probEmpirical(spot: number, low: number, high: number, t: number, iv: number, seed = 13) {
  let s = seed >>> 0;
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let r = s; r = Math.imul(r ^ (r >>> 15), r | 1); r ^= r + Math.imul(r ^ (r >>> 7), r | 61); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  const norm = () => Math.sqrt(-2 * Math.log(Math.max(1e-9, rand()))) * Math.cos(2 * Math.PI * rand());
  const cauchy = () => Math.tan(Math.PI * (rand() - 0.5));
  const N = 4000;
  let inside = 0;
  for (let i = 0; i < N; i++) {
    const z = rand() < 0.85 ? norm() : cauchy() * 0.4;
    const x = spot * Math.exp(-0.5 * iv * iv * t + iv * Math.sqrt(t) * z);
    if (x >= low && x <= high) inside++;
  }
  return inside / N;
}

export function LearnProbabilityComparison() {
  const [low, setLow] = useState(94);
  const [high, setHigh] = useState(108);
  const [days, setDays] = useState(35);
  const [iv, setIv] = useState(0.30);

  const t = days / 365;
  const bs = useMemo(() => probBS(SPOT, low, high, t, iv), [low, high, t, iv]);
  const mc = useMemo(() => probMC(SPOT, low, high, t, iv), [low, high, t, iv]);
  const emp = useMemo(() => probEmpirical(SPOT, low, high, t, iv), [low, high, t, iv]);

  const W = 720, H = 220, padL = 20, padR = 60, padT = 16, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xMin = SPOT * 0.6, xMax = SPOT * 1.6;
  const xOf = (p: number) => padL + ((p - xMin) / (xMax - xMin)) * innerW;

  // Compute the lognormal density across the price axis for the band visualization.
  const sig = iv * Math.sqrt(t);
  const density = (p: number) => {
    const z = (Math.log(p / SPOT) + 0.5 * sig * sig) / sig;
    return Math.exp(-0.5 * z * z) / (Math.sqrt(2 * Math.PI) * sig * p);
  };
  const xs = Array.from({ length: 80 }, (_, i) => xMin + (i / 79) * (xMax - xMin));
  const dens = xs.map((p) => density(p));
  const dMax = Math.max(...dens);
  const yOf = (d: number) => padT + (1 - d / dMax) * innerH;
  const path = xs.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p).toFixed(1)},${yOf(dens[i]).toFixed(1)}`).join(" ");
  // Band fill path
  const bandLeft = xOf(Math.max(low, xMin));
  const bandRight = xOf(Math.min(high, xMax));

  return (
    <div className="space-y-4">
      <div className="border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          <span>price distribution at expiry · spot ${SPOT}</span>
          <span>iv {(iv * 100).toFixed(0)}% · {days}d</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
          {/* x-axis ticks */}
          {[70, 80, 90, 100, 110, 120, 130, 140].map((p) => (
            <g key={p}>
              <line x1={xOf(p)} x2={xOf(p)} y1={padT + innerH} y2={padT + innerH + 4} stroke="rgba(245,245,240,0.2)" />
              <text x={xOf(p)} y={padT + innerH + 16} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-faint)">${p}</text>
            </g>
          ))}
          {/* spot reference */}
          <line x1={xOf(SPOT)} x2={xOf(SPOT)} y1={padT} y2={padT + innerH} stroke="rgba(245,245,240,0.25)" strokeDasharray="3 3" />

          {/* Band shaded green */}
          <rect x={bandLeft} y={padT} width={Math.max(0, bandRight - bandLeft)} height={innerH} fill="var(--bull)" fillOpacity="0.12" />
          <line x1={bandLeft} x2={bandLeft} y1={padT} y2={padT + innerH} stroke="var(--bull)" strokeWidth="1.5" />
          <line x1={bandRight} x2={bandRight} y1={padT} y2={padT + innerH} stroke="var(--bull)" strokeWidth="1.5" />

          {/* density curve */}
          <path d={path} fill="none" stroke="var(--fg)" strokeWidth="1.5" pathLength={1} className="svg-draw-fast" />

          {/* labels */}
          <text x={bandLeft - 4} y={padT + 10} textAnchor="end" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--bull)">${low.toFixed(0)}</text>
          <text x={bandRight + 4} y={padT + 10} fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--bull)">${high.toFixed(0)}</text>
        </svg>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Sliders */}
        <div className="lg:col-span-5 space-y-3">
          <div className="border border-border bg-surface p-4">
            <Slider label="Low strike" value={low} setValue={(v) => setLow(Math.min(v, high - 1))} min={70} max={130} step={0.5} suffix="" />
            <Slider label="High strike" value={high} setValue={(v) => setHigh(Math.max(v, low + 1))} min={70} max={140} step={0.5} suffix="" />
            <Slider label="Days to expiry" value={days} setValue={setDays} min={5} max={120} step={1} suffix="d" />
            <Slider label="Implied vol" value={iv * 100} setValue={(v) => setIv(v / 100)} min={5} max={120} step={1} suffix="%" />
          </div>
        </div>

        {/* Three probability cards */}
        <div className="lg:col-span-7 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ProbCard
            label="Black-Scholes"
            value={bs}
            tone="bull"
            subtitle="closed-form analytical"
            note="Assumes returns are perfectly lognormal. Fast, deterministic, ignores fat tails."
          />
          <ProbCard
            label="Monte Carlo"
            value={mc}
            tone="cyan"
            subtitle="4,000 simulated paths"
            note="Same lognormal assumption as BS but via simulation. Will eventually converge to BS at infinite paths."
          />
          <ProbCard
            label="Empirical"
            value={emp}
            tone="amber"
            subtitle="fat-tailed mixture"
            note="85% Gaussian + 15% Cauchy — simulates real-market kurtosis. Disagrees with BS at the wings."
          />
        </div>
      </div>

      <div className="border border-dashed border-border bg-bg p-3 font-mono text-[11px] tracking-wide text-fg-dim leading-relaxed">
        <span className="text-fg-faint">read this →</span> the three numbers should be close near the
        center, but as you push the band into the wings (deep OTM), <span className="text-amber">empirical</span> tends to
        give a higher probability than <span className="text-bull">BS</span> because real markets have
        fatter tails than lognormal admits. Stack <span className="text-fg">probAll()</span> in the
        Wedge tools to see all three at once on real positions.
      </div>
    </div>
  );
}

function ProbCard({ label, value, tone, subtitle, note }: { label: string; value: number; tone: "bull" | "cyan" | "amber"; subtitle: string; note: string }) {
  const color = tone === "bull" ? "var(--bull)" : tone === "cyan" ? "var(--cyan)" : "var(--amber)";
  return (
    <div className="border border-border bg-surface p-4 flex flex-col">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
        <span>{label}</span>
        <span className="text-fg-faint">{subtitle}</span>
      </div>
      <div className="mt-3 font-display text-4xl tabular-nums" style={{ color }}>
        {(value * 100).toFixed(1)}%
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-fg-dim">{note}</p>
    </div>
  );
}

function Slider({ label, value, setValue, min, max, step, suffix }: { label: string; value: number; setValue: (n: number) => void; min: number; max: number; step: number; suffix: string }) {
  return (
    <label className="flex flex-col gap-1 mb-3 last:mb-0">
      <span className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <span>{label}</span>
        <span className="font-mono text-[12px] tabular-nums text-fg">${typeof value === "number" ? value.toFixed(step < 1 ? 1 : 0) : value}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => setValue(parseFloat(e.target.value))} className="h-1 w-full accent-bull" />
    </label>
  );
}

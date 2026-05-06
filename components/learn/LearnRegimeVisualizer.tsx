"use client";

// Hurst-exponent-controlled chart: a single slider morphs the market between
// mean-reverting (H<0.5), random-walk (H=0.5), and trending (H>0.5). The
// "winning bot family" badge updates live so beginners SEE why regime
// detection matters.

import { useMemo, useState } from "react";

const BARS = 140;
const SEED = 42;

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate price series with controlled return autocorrelation.
// alpha > 0 → trending (positive AR(1) on returns)
// alpha < 0 → mean-reverting
// alpha = 0 → random walk
function generateRegimeSeries(hurst: number) {
  const rand = mulberry32(SEED);
  const alpha = (hurst - 0.5) * 2; // -1 .. +1
  const out: { i: number; c: number }[] = [];
  let price = 100;
  let prevRet = 0;
  for (let i = 0; i < BARS; i++) {
    const noise = (rand() - 0.5) * 0.025;
    const ret = alpha * prevRet * 0.85 + noise;
    price = Math.max(20, price * (1 + ret));
    out.push({ i, c: price });
    prevRet = ret;
  }
  return out;
}

function regimeLabel(h: number) {
  if (h > 0.6) return { kind: "TRENDING", color: "var(--bull)", desc: "Moves keep going. Trend bots win." };
  if (h > 0.55) return { kind: "WEAK TREND", color: "var(--bull)", desc: "Mild momentum. Trend bots have an edge." };
  if (h > 0.45) return { kind: "RANDOM", color: "var(--fg-faint)", desc: "Coin flip. No bot has an edge today — sit it out." };
  if (h > 0.4) return { kind: "WEAK REVERSION", color: "var(--cyan)", desc: "Mild snap-back. Reversion bots have an edge." };
  return { kind: "MEAN-REVERTING", color: "var(--cyan)", desc: "Prices snap back. Reversion bots win." };
}

function recommendedBot(h: number) {
  if (h > 0.55) return { name: "SMA Crossover", id: "sma-cross", reason: "Catches the early lean and rides the trend." };
  if (h > 0.45) return { name: "Hurst Exponent", id: "hurst", reason: "Confirms the regime — don't trade for edge today." };
  return { name: "Z-Score Reversion", id: "zscore", reason: "Fades the extremes back to the mean." };
}

export function LearnRegimeVisualizer() {
  const [h, setH] = useState(0.5);
  const series = useMemo(() => generateRegimeSeries(h), [h]);
  const label = regimeLabel(h);
  const bot = recommendedBot(h);

  const W = 720, H = 280, padL = 40, padR = 40, padT = 20, padB = 30;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const min = Math.min(...series.map((p) => p.c));
  const max = Math.max(...series.map((p) => p.c));
  const range = max - min || 1;
  const xOf = (i: number) => padL + (i / (BARS - 1)) * innerW;
  const yOf = (c: number) => padT + (1 - (c - min) / range) * innerH;
  const path = series.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.i).toFixed(1)},${yOf(p.c).toFixed(1)}`).join(" ");
  const ret = (series[series.length - 1].c - series[0].c) / series[0].c;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Chart */}
        <div className="lg:col-span-8 border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            <span>simulated · {BARS} bars</span>
            <span style={{ color: label.color }}>● {label.kind}</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
            <defs>
              <linearGradient id="rg-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={label.color} stopOpacity="0.35" />
                <stop offset="100%" stopColor={label.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* gridlines */}
            {[0.25, 0.5, 0.75].map((t) => (
              <line key={t} x1={padL} x2={W - padR} y1={padT + t * innerH} y2={padT + t * innerH} stroke="rgba(245,245,240,0.05)" />
            ))}
            {/* fill */}
            <path
              key={`fill-${h.toFixed(2)}`}
              d={`${path} L${xOf(BARS - 1)},${padT + innerH} L${xOf(0)},${padT + innerH} Z`}
              fill="url(#rg-fill)"
              className="svg-fade-in"
            />
            {/* line */}
            <path
              key={`line-${h.toFixed(2)}`}
              d={path}
              fill="none"
              stroke={label.color}
              strokeWidth="1.6"
              pathLength={1}
              className="svg-draw-fast"
            />
            {/* end cap */}
            <circle cx={xOf(BARS - 1)} cy={yOf(series[series.length - 1].c)} r={4} fill={label.color} />
          </svg>
          <div className="grid grid-cols-3 gap-px border-t border-border bg-border">
            <Stat label="hurst" value={h.toFixed(2)} tone={label.color} />
            <Stat label="net move" value={`${ret >= 0 ? "+" : ""}${(ret * 100).toFixed(1)}%`} tone={ret >= 0 ? "var(--bull)" : "var(--bear)"} />
            <Stat label="regime" value={label.kind} tone={label.color} />
          </div>
        </div>

        {/* Slider + recommendation */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="border border-border bg-surface p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">drag the regime knob</div>
            <div className="mt-3 font-display text-3xl tracking-tightest tabular-nums" style={{ color: label.color }}>
              H = {h.toFixed(2)}
            </div>
            <div className="mt-1 text-[12px] text-fg-dim leading-relaxed">{label.desc}</div>
            <input
              type="range"
              min={0.3}
              max={0.7}
              step={0.01}
              value={h}
              onChange={(e) => setH(parseFloat(e.target.value))}
              className="mt-4 h-1 w-full accent-bull"
            />
            <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-fg-faint">
              <span>0.3 reverting</span>
              <span>0.5 random</span>
              <span>0.7 trending</span>
            </div>
          </div>

          <a
            href={`/learn/bots/${bot.id}`}
            className="group block border border-border bg-bg p-4 hover:border-bull hover:bg-bull/[0.04]"
          >
            <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">recommended bot</div>
            <div className="mt-2 font-display text-xl tracking-tightest text-fg group-hover:text-bull">
              {bot.name}
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-fg-dim">{bot.reason}</p>
            <div className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-fg-faint group-hover:text-bull">
              learn this bot →
            </div>
          </a>
        </div>
      </div>

      <div className="border border-dashed border-border bg-bg p-3 font-mono text-[11px] tracking-wide text-fg-dim">
        <span className="text-fg-faint">how it works →</span> we synthesize a price path with controllable
        autocorrelation. Hurst &gt; 0.5 means today&apos;s up-move makes tomorrow&apos;s up-move more likely
        (trending). Hurst &lt; 0.5 means it makes tomorrow&apos;s down-move more likely (mean-reverting).
        The Lazybull <span className="text-fg">Hurst Exponent</span> bot reads this number off real markets.
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-bg p-2.5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">{label}</div>
      <div className="mt-1 font-mono text-base tabular-nums" style={{ color: tone }}>{value}</div>
    </div>
  );
}

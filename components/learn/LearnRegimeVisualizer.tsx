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
  // The descriptions say what the SERIES did, not what to do about it — an
  // H reading is a description of a window that has already happened.
  if (h > 0.6) return { kind: "Trending", color: "var(--bull)", desc: "Moves kept going. Trend rules scored better here." };
  if (h > 0.55) return { kind: "Weak trend", color: "var(--bull)", desc: "Mild momentum. Trend rules scored a little better." };
  // --fg-dim, not --fg-faint. H opens at 0.50, so RANDOM is the DEFAULT state of
  // the flagship chart on a page titled "Trading, visualized." — and --fg-faint
  // is the site's lowest ink, measured near-invisible against the panel. Three
  // other surfaces already draw the random regime in --fg-dim; this was the
  // outlier.
  if (h > 0.45) return { kind: "Random", color: "var(--fg-dim)", desc: "Coin flip. No rule showed measurable predictive lift historically." };
  if (h > 0.4) return { kind: "Weak reversion", color: "var(--cyan)", desc: "Mild snap-back. Reversion rules scored a little better." };
  return { kind: "Mean-reverting", color: "var(--cyan)", desc: "Prices snapped back. Reversion rules scored better here." };
}

// Which teaching instrument is worth OPENING for a series shaped like this —
// a pointer to another page, never a trade. The reasons say what each rule
// does, in the present tense of a tool rather than of a market.
function recommendedBot(h: number) {
  if (h > 0.55) return { name: "SMA Crossover", id: "sma-cross", reason: "Marks the early lean and holds it while the trend runs." };
  if (h > 0.45) return { name: "Hurst Exponent", id: "hurst", reason: "Describes the regime itself — the one instrument for a coin-flip window." };
  return { name: "Z-Score Reversion", id: "zscore", reason: "Marks the extremes and measures the snap back." };
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
      <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-12">
        {/* Chart */}
        <div className="@2xl:col-span-8 rounded-xl bg-fg/[0.05]">
          <div className="flex items-center justify-between px-3.5 pt-3 t-label text-fg-dim">
            <span>Simulated · {BARS} bars</span>
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
              <line key={t} x1={padL} x2={W - padR} y1={padT + t * innerH} y2={padT + t * innerH} stroke="var(--fg)" strokeOpacity="0.05" />
            ))}
            {/* fill */}
            <path
              key={`fill-${h.toFixed(2)}`}
              d={`${path} L${xOf(BARS - 1)},${padT + innerH} L${xOf(0)},${padT + innerH} Z`}
              fill="url(#rg-fill)"
              className="svg-fade-in"
            />
            {/* line */}
            {/* non-scaling-stroke at 2: the chart sits in a ~370px sticky column
                inside a 720-wide viewBox, so the old 1.6 rendered sub-pixel and
                washed out entirely. */}
            <path
              key={`line-${h.toFixed(2)}`}
              d={path}
              fill="none"
              stroke={label.color}
              vectorEffect="non-scaling-stroke"
              strokeWidth="2"
              pathLength={1}
              className="svg-draw-fast"
            />
            {/* end cap */}
            <circle cx={xOf(BARS - 1)} cy={yOf(series[series.length - 1].c)} r={4} fill={label.color} />
          </svg>
          <div className="grid grid-cols-3 gap-3 px-3.5 pb-3.5 pt-1">
            <Stat label="Hurst" value={h.toFixed(2)} tone={label.color} />
            <Stat label="Net move" value={`${ret >= 0 ? "+" : ""}${(ret * 100).toFixed(1)}%`} tone={ret >= 0 ? "var(--bull)" : "var(--bear)"} />
            <Stat label="Regime" value={label.kind} tone={label.color} />
          </div>
        </div>

        {/* Slider + recommendation */}
        <div className="@2xl:col-span-4 flex flex-col gap-3">
          <div className="rounded-xl bg-fg/[0.05] p-4">
            <div className="t-label text-fg-faint">Drag the regime knob</div>
            <div className="mt-3 font-display text-3xl tracking-tightest tabular-nums" style={{ color: label.color }}>
              H = {h.toFixed(2)}
            </div>
            <div className="mt-1 text-[0.75rem] text-fg-dim leading-relaxed">{label.desc}</div>
            <input
              type="range"
              min={0.3}
              max={0.7}
              step={0.01}
              value={h}
              onChange={(e) => setH(parseFloat(e.target.value))}
              className="mt-4 h-1 w-full accent-brand-ink"
            />
            <div className="mt-1 flex justify-between t-label text-fg-faint">
              <span>0.3 reverting</span>
              <span>0.5 random</span>
              <span>0.7 trending</span>
            </div>
          </div>

          <a
            href={`/learn/bots/${bot.id}`}
            className="group block rounded-xl bg-fg/[0.05] p-4 transition-colors hover:bg-fg/[0.08]"
          >
            <div className="t-label text-fg-faint">Recommended bot</div>
            <div className="mt-2 font-display text-xl tracking-tightest text-fg group-hover:text-brand-ink">
              {bot.name}
            </div>
            <p className="mt-2 text-[0.75rem] leading-relaxed text-fg-dim">{bot.reason}</p>
            <div className="mt-3 inline-flex items-center gap-1 t-label text-fg-faint group-hover:text-brand-ink">
              Learn this bot ›
            </div>
          </a>
        </div>
      </div>

      <div className="text-[0.8125rem] leading-relaxed text-fg-dim">
        <span className="text-fg-faint">How it works →</span> we synthesize a price path with controllable
        autocorrelation. Hurst &gt; 0.5 means today’s up-move makes tomorrow’s up-move more likely
        (trending). Hurst &lt; 0.5 means it makes tomorrow’s down-move more likely (mean-reverting).
        The Lazybull <span className="text-fg">Hurst Exponent</span> bot reads this number off real markets.
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="t-label text-fg-faint">{label}</div>
      <div className="mt-0.5 font-mono text-base tabular-nums" style={{ color: tone }}>{value}</div>
    </div>
  );
}

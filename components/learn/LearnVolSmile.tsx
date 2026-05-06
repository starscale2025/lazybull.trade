"use client";

// The vol smile / skew animator. Real options markets don't have one flat
// implied volatility — the curve smiles, and on equity markets it tilts.
// Drag the correlation slider to morph the curve and see why OTM puts
// cost more than equidistant OTM calls.

import { useMemo, useState } from "react";

const SPOT = 100;
const STRIKES = Array.from({ length: 41 }, (_, i) => 70 + i);
const ATM_IV = 0.30;

// Synthesize an IV smile. The center IV is fixed at ATM. Each wing's height
// scales with kurtosis (smile depth). The tilt scales with skew (rho-like).
// Negative skew = OTM puts (low strikes) get a fatter IV. This is what
// equity markets look like in practice.
function smileIV(K: number, skew: number, kurt: number) {
  const m = Math.log(K / SPOT); // log-moneyness
  // Quadratic component (smile, both sides up).
  const smile = ATM_IV + kurt * m * m;
  // Linear component (tilt). Negative skew → low strikes higher.
  const tilt = -skew * m;
  return Math.max(0.05, smile + tilt);
}

export function LearnVolSmile() {
  const [skew, setSkew] = useState(0.6);   // 0 = flat, +ve = put-side richer (typical)
  const [kurt, setKurt] = useState(0.5);   // 0 = no smile, +ve = wings fatter

  const points = useMemo(
    () => STRIKES.map((K) => ({ K, iv: smileIV(K, skew, kurt) })),
    [skew, kurt]
  );

  // Find IV at the mirror strikes for explainer.
  const ivOTMPut = smileIV(85, skew, kurt);
  const ivOTMCall = smileIV(115, skew, kurt);
  const skewPercent = ((ivOTMPut - ivOTMCall) / ATM_IV) * 100;

  const W = 720, H = 280, padL = 50, padR = 30, padT = 20, padB = 36;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const ivMin = 0.10, ivMax = 0.65;
  const xOf = (K: number) => padL + ((K - STRIKES[0]) / (STRIKES[STRIKES.length - 1] - STRIKES[0])) * innerW;
  const yOf = (iv: number) => padT + (1 - (iv - ivMin) / (ivMax - ivMin)) * innerH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.K).toFixed(1)},${yOf(p.iv).toFixed(1)}`).join(" ");

  // Quote panel
  const formatIv = (iv: number) => `${(iv * 100).toFixed(1)}%`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Smile chart */}
        <div className="lg:col-span-8 border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            <span>implied vol surface · spot ${SPOT}</span>
            <span className="tabular-nums">
              skew {skew.toFixed(2)} · kurt {kurt.toFixed(2)}
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
            {/* y-axis ticks */}
            {[0.15, 0.25, 0.35, 0.45, 0.55].map((iv) => (
              <g key={iv}>
                <line x1={padL} x2={W - padR} y1={yOf(iv)} y2={yOf(iv)} stroke="rgba(245,245,240,0.05)" />
                <text x={padL - 6} y={yOf(iv) + 3} textAnchor="end" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-faint)">
                  {(iv * 100).toFixed(0)}%
                </text>
              </g>
            ))}
            {/* spot line */}
            <line x1={xOf(SPOT)} x2={xOf(SPOT)} y1={padT} y2={H - padB} stroke="rgba(245,245,240,0.15)" strokeDasharray="3 4" />
            <text x={xOf(SPOT)} y={H - padB + 14} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-faint)">SPOT $100</text>
            <text x={xOf(85)} y={H - padB + 14} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--bear)">$85 put</text>
            <text x={xOf(115)} y={H - padB + 14} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--bull)">$115 call</text>

            {/* smile fill */}
            <defs>
              <linearGradient id="vs-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--plasma)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--plasma)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              key={`fill-${skew.toFixed(2)}-${kurt.toFixed(2)}`}
              d={`${path} L${xOf(STRIKES[STRIKES.length - 1])},${padT + innerH} L${xOf(STRIKES[0])},${padT + innerH} Z`}
              fill="url(#vs-fill)"
              className="svg-fade-in"
            />
            {/* the curve */}
            <path
              key={`line-${skew.toFixed(2)}-${kurt.toFixed(2)}`}
              d={path}
              fill="none"
              stroke="var(--plasma)"
              strokeWidth="2"
              pathLength={1}
              className="svg-draw-fast"
            />

            {/* ATM marker */}
            <circle cx={xOf(SPOT)} cy={yOf(smileIV(SPOT, skew, kurt))} r={5} fill="var(--fg)" />
            {/* OTM put marker */}
            <circle cx={xOf(85)} cy={yOf(ivOTMPut)} r={4} fill="var(--bear)" />
            {/* OTM call marker */}
            <circle cx={xOf(115)} cy={yOf(ivOTMCall)} r={4} fill="var(--bull)" />
          </svg>
        </div>

        {/* Controls */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="border border-border bg-surface p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">skew (ρ)</div>
            <div className="mt-2 font-display text-2xl tabular-nums text-fg">{skew.toFixed(2)}</div>
            <input type="range" min={-1} max={1} step={0.05} value={skew} onChange={(e) => setSkew(parseFloat(e.target.value))} className="mt-3 h-1 w-full accent-bull" />
            <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-fg-faint">
              <span>− call-rich</span><span>flat</span><span>+ put-rich</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-fg-dim">
              In real equity markets, ρ is almost always positive — when the stock drops, vol jumps. So OTM puts get bid up, OTM calls get bid down. The Heston model parameter has the opposite sign convention; same idea.
            </p>
          </div>

          <div className="border border-border bg-surface p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">smile depth (kurtosis)</div>
            <div className="mt-2 font-display text-2xl tabular-nums text-fg">{kurt.toFixed(2)}</div>
            <input type="range" min={0} max={1.5} step={0.05} value={kurt} onChange={(e) => setKurt(parseFloat(e.target.value))} className="mt-3 h-1 w-full accent-bull" />
            <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-fg-faint">
              <span>flat</span><span>deep smile</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-fg-dim">
              The "wings" — far OTM strikes — sell for richer IV than the textbook flat-vol BS model predicts. The market is pricing in fat tails.
            </p>
          </div>
        </div>
      </div>

      {/* Comparison panel */}
      <div className="border border-border bg-surface">
        <div className="border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          comparison · same distance from spot
        </div>
        <div className="grid grid-cols-3 gap-px bg-border">
          <div className="bg-bg p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-bear">$85 put (15% OTM)</div>
            <div className="mt-2 font-display text-3xl tabular-nums text-bear">{formatIv(ivOTMPut)}</div>
            <div className="mt-1 font-mono text-[10px] text-fg-faint">implied vol the market is asking</div>
          </div>
          <div className="bg-bg p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">ATM</div>
            <div className="mt-2 font-display text-3xl tabular-nums text-fg">{formatIv(smileIV(SPOT, skew, kurt))}</div>
            <div className="mt-1 font-mono text-[10px] text-fg-faint">reference</div>
          </div>
          <div className="bg-bg p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-bull">$115 call (15% OTM)</div>
            <div className="mt-2 font-display text-3xl tabular-nums text-bull">{formatIv(ivOTMCall)}</div>
            <div className="mt-1 font-mono text-[10px] text-fg-faint">implied vol the market is asking</div>
          </div>
        </div>
        <div className="border-t border-border-soft p-3 font-mono text-[11px] tracking-wide text-fg-dim leading-relaxed">
          <span className="text-fg-faint">read this →</span>{" "}
          <span className="text-fg">{Math.abs(skewPercent).toFixed(1)}%</span> {" "}
          {skewPercent > 0 ? "richer IV on the put side" : skewPercent < 0 ? "richer IV on the call side" : "no skew"}.
          {" "}A flat-IV Black-Scholes pricer mispriced both contracts. That&apos;s why our{" "}
          <a href="/learn/bots/ai-heston" className="text-cyan hover:underline">Heston SV bot</a> exists — it captures this skew.
        </div>
      </div>
    </div>
  );
}

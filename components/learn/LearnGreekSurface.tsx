"use client";

// Five Greeks plotted across strike, all driven by real Black-Scholes math.
// Drag the strike marker; every chart updates simultaneously. Hover any
// chart for a plain-English explanation of what that Greek means.

import { useMemo, useState } from "react";
import { priceOption } from "@/lib/pricing";

const SPOT = 100;
const T = 30 / 365;
const R = 0.045;
const IV = 0.30;
const STRIKES = Array.from({ length: 61 }, (_, i) => 70 + i); // 70..130

type GreekKey = "delta" | "gamma" | "theta" | "vega" | "rho";

const GREEK_DEFS: Record<
  GreekKey,
  { label: string; symbol: string; color: string; oneLiner: string; tldr: string }
> = {
  delta: {
    label: "Delta",
    symbol: "Δ",
    color: "var(--bull)",
    oneLiner: "How much the option price moves when the stock moves $1.",
    tldr: "Delta tells you how 'stock-like' your option is. ATM call ≈ 0.5 delta — it moves about 50¢ for every $1 in the stock. Deep ITM ≈ 1. Far OTM ≈ 0.",
  },
  gamma: {
    label: "Gamma",
    symbol: "Γ",
    color: "var(--cyan)",
    oneLiner: "How fast Delta changes as the stock moves.",
    tldr: "Gamma is highest right at the money. That's why ATM options 'come alive' near expiry — small spot moves swing delta dramatically.",
  },
  theta: {
    label: "Theta",
    symbol: "Θ",
    color: "var(--amber)",
    oneLiner: "How much value the option loses each day, all else equal.",
    tldr: "The 'rent' you pay for owning an option. Always negative for long options, gets brutal in the last week before expiry.",
  },
  vega: {
    label: "Vega",
    symbol: "ν",
    color: "var(--plasma)",
    oneLiner: "How much the option price moves per 1% change in IV.",
    tldr: "Buy options when IV is low, sell when high. Vega is highest for long-dated ATM options — they're vol bets.",
  },
  rho: {
    label: "Rho",
    symbol: "ρ",
    color: "var(--bear)",
    oneLiner: "How much the option price moves per 1% change in interest rates.",
    tldr: "Mostly ignored on monthly options because rates barely move week-to-week. Matters for LEAPs and high-rate environments.",
  },
};

export function LearnGreekSurface() {
  const [strike, setStrike] = useState(100);
  const [type, setType] = useState<"C" | "P">("C");
  const [hovered, setHovered] = useState<GreekKey | null>(null);

  // Compute call & put Greeks across all strikes once, memoized.
  const surface = useMemo(() => {
    return STRIKES.map((K) => {
      const r = priceOption(SPOT, K, T, R, IV, type);
      return { K, ...r.greeks, price: r.price };
    });
  }, [type]);

  const current = surface.find((s) => s.K === strike) ?? surface[Math.floor(surface.length / 2)];

  return (
    <div className="space-y-4">
      {/* Top controls */}
      <div className="flex flex-wrap items-center gap-3 border border-border bg-surface p-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">underlying spot</span>
        <span className="font-mono text-[12px] tabular-nums text-fg">${SPOT}</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">·</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">expiry</span>
        <span className="font-mono text-[12px] text-fg">30d</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">·</span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">iv</span>
        <span className="font-mono text-[12px] text-fg">{(IV * 100).toFixed(0)}%</span>

        <div className="ml-auto flex items-center gap-1">
          {(["C", "P"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`h-7 border px-2 font-mono text-[10px] uppercase tracking-wider ${
                t === type ? "border-bull bg-bull/10 text-bull" : "border-border bg-bg text-fg-dim hover:border-fg-dim hover:text-fg"
              }`}
            >
              {t === "C" ? "Calls" : "Puts"}
            </button>
          ))}
        </div>
      </div>

      {/* Strike picker */}
      <div className="border border-border bg-bg p-4">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          <span>strike (drag)</span>
          <span className="text-fg tabular-nums">${strike}</span>
        </div>
        <input
          type="range"
          min={STRIKES[0]}
          max={STRIKES[STRIKES.length - 1]}
          step={1}
          value={strike}
          onChange={(e) => setStrike(parseInt(e.target.value))}
          className="mt-2 h-1 w-full accent-bull"
        />
        <div className="mt-1 flex justify-between font-mono text-[9px] uppercase tracking-wider text-fg-faint">
          <span>$70 deep ITM put / OTM call</span>
          <span>$100 ATM</span>
          <span>$130 OTM put / ITM call</span>
        </div>
      </div>

      {/* Five Greek mini-charts */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(GREEK_DEFS) as GreekKey[]).map((g) => (
          <GreekChart
            key={g}
            greek={g}
            surface={surface}
            strike={strike}
            highlight={hovered === g}
            onEnter={() => setHovered(g)}
            onLeave={() => setHovered(null)}
          />
        ))}
        {/* Sixth tile: explanation card */}
        <div className="border border-bull/40 bg-bull/[0.04] p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-bull">teacher</div>
          <div className="mt-2 font-display text-base tracking-tightest text-fg">
            {hovered ? GREEK_DEFS[hovered].label : "Hover any Greek"}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-fg-dim">
            {hovered ? GREEK_DEFS[hovered].tldr : "Each chart shows how that Greek changes across strikes. The vertical line is your selected strike. Drag the strike slider above and watch all five update."}
          </p>
        </div>
      </div>

      {/* Current strike's exact values */}
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-6">
        <ValueTile label="Price" value={`$${current.price.toFixed(2)}`} tone="var(--fg)" />
        <ValueTile label="Δ Delta" value={current.delta.toFixed(3)} tone={GREEK_DEFS.delta.color} />
        <ValueTile label="Γ Gamma" value={current.gamma.toFixed(4)} tone={GREEK_DEFS.gamma.color} />
        <ValueTile label="Θ Theta /day" value={current.theta.toFixed(3)} tone={GREEK_DEFS.theta.color} />
        <ValueTile label="ν Vega /1%" value={current.vega.toFixed(3)} tone={GREEK_DEFS.vega.color} />
        <ValueTile label="ρ Rho /1%" value={current.rho.toFixed(3)} tone={GREEK_DEFS.rho.color} />
      </div>
    </div>
  );
}

function ValueTile({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-bg p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">{label}</div>
      <div className="mt-1 font-mono text-[14px] tabular-nums" style={{ color: tone }}>{value}</div>
    </div>
  );
}

type Surface = Array<{ K: number; delta: number; gamma: number; theta: number; vega: number; rho: number; price: number }>;

function GreekChart({
  greek, surface, strike, highlight, onEnter, onLeave,
}: {
  greek: GreekKey; surface: Surface; strike: number; highlight: boolean;
  onEnter: () => void; onLeave: () => void;
}) {
  const def = GREEK_DEFS[greek];
  const W = 320, H = 140, padL = 8, padR = 8, padT = 14, padB = 18;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const values = surface.map((s) => s[greek]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xOf = (K: number) => padL + ((K - surface[0].K) / (surface[surface.length - 1].K - surface[0].K)) * innerW;
  const yOf = (v: number) => padT + (1 - (v - min) / range) * innerH;
  const path = surface.map((s, i) => `${i === 0 ? "M" : "L"}${xOf(s.K).toFixed(1)},${yOf(s[greek]).toFixed(1)}`).join(" ");
  const cur = surface.find((s) => s.K === strike) ?? surface[Math.floor(surface.length / 2)];

  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={`relative border bg-surface transition-colors ${highlight ? "border-bull/60 bg-bull/[0.03]" : "border-border"}`}
    >
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <span>
          <span style={{ color: def.color }}>{def.symbol}</span> {def.label}
        </span>
        <span className="tabular-nums" style={{ color: def.color }}>
          {cur[greek].toFixed(greek === "gamma" ? 4 : 3)}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        {/* zero line if greek crosses zero */}
        {min < 0 && max > 0 && (
          <line x1={padL} x2={W - padR} y1={yOf(0)} y2={yOf(0)} stroke="rgba(245,245,240,0.15)" strokeDasharray="2 3" />
        )}
        {/* the curve */}
        <path d={path} fill="none" stroke={def.color} strokeWidth={1.5} pathLength={1} className="svg-draw-fast" />
        {/* strike vertical marker */}
        <line x1={xOf(strike)} x2={xOf(strike)} y1={padT} y2={H - padB} stroke="var(--fg-dim)" strokeDasharray="2 4" />
        <circle cx={xOf(strike)} cy={yOf(cur[greek])} r={4} fill={def.color} />
        {/* spot reference */}
        <line x1={xOf(SPOT)} x2={xOf(SPOT)} y1={padT} y2={H - padB} stroke="rgba(245,245,240,0.1)" strokeWidth="1" />
        <text x={xOf(SPOT) + 3} y={padT + 9} fontFamily="var(--font-jetbrains)" fontSize="8" fill="var(--fg-faint)">SPOT</text>
      </svg>
      <div className="border-t border-border-soft bg-bg/50 px-3 py-1 text-[10px] leading-snug text-fg-dim">
        {def.oneLiner}
      </div>
    </div>
  );
}

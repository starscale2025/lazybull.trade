"use client";

import type { Strategy } from "@/lib/models";
import { priceOption } from "@/lib/pricing";

export function PlainGreeks({ s, spot, daysToExpiry, iv }: { s: Strategy | null; spot: number; daysToExpiry: number; iv: number }) {
  if (!s) {
    return (
      <div className="border border-border bg-bg p-4 font-mono text-[11px] text-fg-faint">
        Pick a strategy to see plain-English greeks.
      </div>
    );
  }
  // aggregate net greeks across legs
  const t = Math.max(0.001, daysToExpiry / 365);
  const net = { delta: 0, gamma: 0, theta: 0, vega: 0 };
  for (const l of s.legs) {
    const { greeks } = priceOption(spot, l.strike, t, 0.045, iv, l.type);
    const sign = l.side === "long" ? 1 : -1;
    net.delta += sign * greeks.delta * l.qty * 100;
    net.gamma += sign * greeks.gamma * l.qty * 100;
    net.theta += sign * greeks.theta * l.qty * 100;
    net.vega += sign * greeks.vega * l.qty * 100;
  }

  const lines: { icon: string; tone: string; text: React.ReactNode }[] = [];

  // Delta
  const deltaDir = net.delta > 0 ? "rises" : "falls";
  lines.push({
    icon: "Δ",
    tone: net.delta > 0 ? "var(--bull)" : "var(--bear)",
    text: (
      <>
        Your bet <span className="text-fg">{deltaDir} ${Math.abs(net.delta).toFixed(0)}</span> for every <span className="text-fg">$1</span> the stock moves up.
      </>
    ),
  });

  // Gamma
  lines.push({
    icon: "Γ",
    tone: "var(--cyan)",
    text: (
      <>
        That sensitivity itself <span className="text-fg">accelerates by ${Math.abs(net.gamma * 1).toFixed(2)}</span> per dollar — biggest near the strike.
      </>
    ),
  });

  // Theta — most important for retail
  const thetaDay = net.theta;
  lines.push({
    icon: "Θ",
    tone: thetaDay >= 0 ? "var(--bull)" : "var(--amber)",
    text: thetaDay >= 0 ? (
      <>
        Time is <span className="text-fg">on your side</span>: you earn about <span className="text-bull">${Math.abs(thetaDay).toFixed(0)}/day</span> if nothing moves.
      </>
    ) : (
      <>
        Time is <span className="text-fg">against you</span>: you lose about <span className="text-amber">${Math.abs(thetaDay).toFixed(0)}/day</span> if you wait.
      </>
    ),
  });

  // Vega
  lines.push({
    icon: "ν",
    tone: net.vega >= 0 ? "var(--plasma)" : "var(--bear)",
    text: net.vega >= 0 ? (
      <>
        If implied vol jumps <span className="text-fg">+5 points</span>, you make about <span className="text-plasma">${(net.vega * 5).toFixed(0)}</span>.
      </>
    ) : (
      <>
        If implied vol drops <span className="text-fg">−5 points</span>, you earn about <span className="text-bull">${(-net.vega * 5).toFixed(0)}</span>.
      </>
    ),
  });

  return (
    <div className="border border-border bg-bg p-5">
      <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <span className="size-1.5 rounded-full bg-bull pulse-dot" />
        plain-english greeks · live
      </div>
      <ul className="space-y-2.5">
        {lines.map((l, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex size-7 items-center justify-center border border-border bg-surface font-display text-base" style={{ color: l.tone }}>
              {l.icon}
            </span>
            <div className="flex-1 text-sm leading-snug text-fg-dim">{l.text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

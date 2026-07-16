"use client";

// Plain-English greeks, terminal style: icon · name · net value · one-line
// meaning. Values are the net across all legs of the selected strategy,
// priced with the same Black-Scholes engine as the chain. The meaning column
// speaks dollars ("Moves $32 per $1 move in the stock"), the value column
// speaks per-share greeks — same relationship a broker chain shows.

import type { Strategy } from "@/lib/models";
import { priceOption } from "@/lib/pricing";
import { GreekMeta, type GreekKey } from "@/components/ai-teacher/GreekIcons";

export function PlainGreeks({
  s,
  spot,
  daysToExpiry,
  iv,
  onDetails,
}: {
  s: Strategy | null;
  spot: number;
  daysToExpiry: number;
  iv: number;
  onDetails?: () => void;
}) {
  // aggregate net greeks across legs (unchanged math, rho added — the pricer
  // already returns it)
  const t = Math.max(0.001, daysToExpiry / 365);
  const net = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  if (s) {
    for (const l of s.legs) {
      const { greeks } = priceOption(spot, l.strike, t, 0.045, iv, l.type);
      const sign = l.side === "long" ? 1 : -1;
      net.delta += sign * greeks.delta * l.qty * 100;
      net.gamma += sign * greeks.gamma * l.qty * 100;
      net.theta += sign * greeks.theta * l.qty * 100;
      net.vega += sign * greeks.vega * l.qty * 100;
      net.rho += sign * greeks.rho * l.qty * 100;
    }
  }

  const usd = (v: number) => `$${Math.abs(v) >= 10 ? Math.abs(v).toFixed(0) : Math.abs(v).toFixed(2)}`;
  const perShare = (v: number) => {
    const p = v / 100;
    const abs = Math.abs(p);
    const s0 = abs < 0.05 ? abs.toFixed(3) : abs.toFixed(2);
    return p < 0 ? `−${s0}` : s0;
  };

  const rows: { key: GreekKey; name: string; value: number; meaning: string }[] = s
    ? [
        {
          key: "delta",
          name: "delta",
          value: net.delta,
          meaning: `${net.delta >= 0 ? "Gains" : "Loses"} ${usd(net.delta)} per $1 move up in the stock`,
        },
        {
          key: "theta",
          name: "theta",
          value: net.theta,
          meaning: `${net.theta >= 0 ? "Earns" : "Loses"} ${usd(net.theta)} per day from time decay`,
        },
        {
          key: "gamma",
          name: "gamma",
          value: net.gamma,
          meaning: `Delta changes ${usd(net.gamma)} for each $1 move`,
        },
        {
          key: "vega",
          name: "vega",
          value: net.vega,
          meaning: `${net.vega >= 0 ? "Gains" : "Loses"} ${usd(net.vega)} per 1% rise in implied vol`,
        },
        {
          key: "rho",
          name: "rho",
          value: net.rho,
          meaning: `${net.rho >= 0 ? "Gains" : "Loses"} ${usd(net.rho)} per 1% rise in rates`,
        },
      ]
    : [];

  return (
    <section className="border border-border bg-surface lg:shrink-0">
      <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-dim">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          plain english greeks
        </span>
        {onDetails && (
          <button
            type="button"
            onClick={onDetails}
            className="font-mono text-[9px] uppercase tracking-wider text-fg-dim transition-colors hover:text-bull"
          >
            details →
          </button>
        )}
      </div>

      {!s ? (
        <div className="p-4 font-mono text-[11px] text-fg-faint">
          Pick a strategy to see plain-English greeks.
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border-soft">
            {rows.map((r) => {
              const meta = GreekMeta[r.key];
              const Icon = meta.Icon;
              return (
                <li key={r.key} className="flex items-center gap-3 px-3 py-2">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center border border-border bg-bg"
                    style={{ color: meta.color }}
                    aria-hidden
                  >
                    <Icon size={16} color={meta.color} />
                  </span>
                  <span className="w-12 shrink-0 font-mono text-[10px] uppercase tracking-wider text-fg">
                    {r.name}
                  </span>
                  <span
                    className="w-14 shrink-0 text-right font-mono text-sm tabular-nums"
                    style={{ color: meta.color }}
                  >
                    {perShare(r.value)}
                  </span>
                  <span className="flex-1 text-right text-[12px] leading-snug text-fg-dim">
                    {r.meaning}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="border-t border-border-soft px-3 py-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-fg-faint">
            net across {s.legs.length} leg{s.legs.length > 1 ? "s" : ""} · black-scholes · live
          </div>
        </>
      )}
    </section>
  );
}

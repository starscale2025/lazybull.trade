"use client";

import { useMemo, useState } from "react";
import type { Strategy } from "@/lib/models";
import { priceOption } from "@/lib/pricing";

// At a given (spot, daysFromNow), value the strategy by re-pricing each option leg
function valueStrategy(s: Strategy, spotAt: number, daysFromNowToExpiry: number, iv: number) {
  const t = Math.max(0.0001, daysFromNowToExpiry / 365);
  let value = 0;
  for (const l of s.legs) {
    const { price } = priceOption(spotAt, l.strike, t, 0.045, iv, l.type);
    const sign = l.side === "long" ? 1 : -1;
    value += sign * (price - l.premium) * l.qty * 100;
  }
  return value;
}

export function TimeMachine({ s, spot, daysToExpiry, iv }: { s: Strategy | null; spot: number; daysToExpiry: number; iv: number }) {
  const [spotAt, setSpotAt] = useState(spot);
  const [daysGone, setDaysGone] = useState(0);

  // reset when strategy / spot change
  const range = useMemo(() => ({ lo: spot * 0.7, hi: spot * 1.3 }), [spot]);
  const remaining = Math.max(1, daysToExpiry - daysGone);
  const value = s ? valueStrategy(s, spotAt, remaining, iv) : 0;
  const initial = s ? valueStrategy(s, spot, daysToExpiry, iv) : 0;
  const change = value - initial;

  if (!s) {
    return (
      <div className="border border-border bg-bg p-4 font-mono text-[11px] text-fg-faint">
        Pick a strategy to time-machine its P&L.
      </div>
    );
  }

  return (
    <div className="border border-border bg-bg p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          <span className="size-1.5 rounded-full bg-cyan" />
          time machine · what-if simulator
        </div>
        <button
          onClick={() => { setSpotAt(spot); setDaysGone(0); }}
          className="font-mono text-[10px] uppercase tracking-wider text-fg-faint hover:text-fg"
        >
          ↺ reset
        </button>
      </div>

      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">scenario value</div>
          <div className={`font-display text-4xl tracking-tightest tabular-nums ${value >= 0 ? "text-bull" : "text-bear"}`}>
            {value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(0)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">vs entry</div>
          <div className={`font-mono text-base tabular-nums ${change >= 0 ? "text-bull" : "text-bear"}`}>
            {change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(0)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            <span>stock price</span>
            <span className="text-fg tabular-nums">${spotAt.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={range.lo}
            max={range.hi}
            step={0.5}
            value={spotAt}
            onChange={(e) => setSpotAt(parseFloat(e.target.value))}
            className="w-full accent-bull"
          />
          <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-fg-faint">
            <span>${range.lo.toFixed(0)}</span>
            <span>spot ${spot.toFixed(2)}</span>
            <span>${range.hi.toFixed(0)}</span>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            <span>days from now</span>
            <span className="text-fg tabular-nums">{daysGone}d / {daysToExpiry}d</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(1, daysToExpiry - 1)}
            step={1}
            value={daysGone}
            onChange={(e) => setDaysGone(parseInt(e.target.value))}
            className="w-full accent-amber"
          />
          <div className="mt-1 flex items-center justify-between font-mono text-[9px] text-fg-faint">
            <span>now</span>
            <span>{remaining}d to expiry</span>
            <span>expiry</span>
          </div>
        </div>
      </div>
    </div>
  );
}

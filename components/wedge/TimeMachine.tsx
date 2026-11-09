"use client";

import { useMemo, useState } from "react";
import type { Strategy } from "@/lib/models";
import { priceOption } from "@/lib/pricing";
import { ToolButton } from "@/components/calm/kit";

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
      <div className="bg-bg p-3 t-label text-fg-faint">
        Pick a strategy to time-machine its P&L.
      </div>
    );
  }

  return (
    <div className="bg-bg p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="t-label text-fg-dim">Time machine · what-if simulator</div>
        <ToolButton onClick={() => { setSpotAt(spot); setDaysGone(0); }} className="!h-6 !px-2.5 !text-[0.75rem]">
          ↺ Reset
        </ToolButton>
      </div>

      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="t-label text-fg-faint">Scenario value</div>
          <div className={`font-display text-3xl tracking-tightest tabular-nums ${value >= 0 ? "text-bull" : "text-bear"}`}>
            {value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(0)}
          </div>
        </div>
        <div className="text-right">
          <div className="t-label text-fg-faint">Vs entry</div>
          <div className={`t-data text-base ${change >= 0 ? "text-bull" : "text-bear"}`}>
            {change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(0)}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between t-label text-fg-dim">
            <span>Stock price</span>
            <span className="t-data text-fg">${spotAt.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={range.lo}
            max={range.hi}
            step={0.5}
            value={spotAt}
            onChange={(e) => setSpotAt(parseFloat(e.target.value))}
            className="w-full accent-brand-ink"
          />
          <div className="mt-1 flex items-center justify-between t-label text-fg-faint">
            <span>${range.lo.toFixed(0)}</span>
            <span>Spot ${spot.toFixed(2)}</span>
            <span>${range.hi.toFixed(0)}</span>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between t-label text-fg-dim">
            <span>Days from now</span>
            <span className="t-data text-fg">{daysGone}d / {daysToExpiry}d</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(1, daysToExpiry - 1)}
            step={1}
            value={daysGone}
            onChange={(e) => setDaysGone(parseInt(e.target.value))}
            className="w-full accent-brand-ink"
          />
          <div className="mt-1 flex items-center justify-between t-label text-fg-faint">
            <span>Now</span>
            <span>{remaining}d to expiry</span>
            <span>Expiry</span>
          </div>
        </div>
      </div>
    </div>
  );
}

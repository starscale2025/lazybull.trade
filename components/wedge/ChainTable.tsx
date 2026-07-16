"use client";

// Ref-style options chain for the bet builder: CALLS | STRIKE | PUTS with
// DELTA / BID / ASK / IV / OI per side. Reuses the same in-process
// Black-Scholes chain (`priceChain`) that powers /trade/chain — synthetic
// quotes/OI, labelled as such in the footer. The expiry stepper drives the
// page's `days` state, so the cone and the chain always agree.

import { useMemo } from "react";
import Link from "next/link";
import { priceChain, type ChainCell } from "@/lib/pricing";

type Props = {
  symbol: string;
  spot: number;
  iv: number; // base IV (annualised, synthetic)
  days: number; // days to expiry — shared with the probability cone
  perSide: number; // strikes each side of ATM
  onStepDays?: (delta: number) => void;
};

const kFmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : `${v}`);

export function ChainTable({ symbol, spot, iv, days, perSide, onStepDays }: Props) {
  const expiry = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return {
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }).toUpperCase(),
      daysToExpiry: days,
    };
  }, [days]);

  const strikes = useMemo(() => {
    const step = spot < 50 ? 1 : spot < 200 ? 2.5 : spot < 500 ? 5 : 10;
    const atm = Math.round(spot / step) * step;
    const arr: number[] = [];
    for (let i = -perSide; i <= perSide; i++) arr.push(+(atm + i * step).toFixed(2));
    return arr;
  }, [spot, perSide]);

  const byStrike = useMemo(() => {
    const cells = priceChain({ spot, expiries: [expiry], strikes, baseIv: iv })[0];
    const map = new Map<number, { call: ChainCell; put: ChainCell }>();
    for (const c of cells) {
      const m = map.get(c.strike) ?? ({} as { call: ChainCell; put: ChainCell });
      if (c.type === "C") m.call = c;
      else m.put = c;
      map.set(c.strike, m);
    }
    return map;
  }, [spot, expiry, strikes, iv]);

  const atmStrike = useMemo(
    () =>
      strikes.reduce(
        (best, k) => (Math.abs(k - spot) < Math.abs(best - spot) ? k : best),
        strikes[0] ?? spot
      ),
    [strikes, spot]
  );

  const strikeFmt = (k: number) => (k < 100 ? k.toFixed(2) : k % 1 ? k.toFixed(1) : k.toFixed(0));

  const cellGrid = "grid grid-cols-[repeat(5,minmax(0,1fr))_88px_repeat(5,minmax(0,1fr))]";

  return (
    <section
      className="border border-border bg-surface lg:flex lg:min-h-0 lg:flex-1 lg:flex-col"
      aria-label={`${symbol} options chain`}
    >
      {/* header — CALLS | expiry stepper | PUTS */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] lg:shrink-0">
        <span className="text-bull">calls</span>
        <div className="flex items-center gap-2 text-fg">
          <button
            type="button"
            onClick={() => onStepDays?.(-7)}
            aria-label="earlier expiry"
            className="border border-border px-1.5 leading-4 text-fg-dim transition-colors hover:border-bull/50 hover:text-bull"
          >
            ‹
          </button>
          <span className="tabular-nums tracking-[0.15em]">
            {expiry.label} <span className="text-fg-dim">({days}d)</span>
          </span>
          <button
            type="button"
            onClick={() => onStepDays?.(7)}
            aria-label="later expiry"
            className="border border-border px-1.5 leading-4 text-fg-dim transition-colors hover:border-bull/50 hover:text-bull"
          >
            ›
          </button>
        </div>
        <span className="text-right text-bear">puts</span>
      </div>

      {/* body — internal scroll inside the app shell; the footer below stays pinned */}
      <div className="overflow-x-auto lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        <div className="min-w-[840px]">
          {/* column headers — stick to the top of the internal scrollport */}
          <div className={`${cellGrid} border-b border-border-soft bg-bg px-3 font-mono text-[9px] uppercase tracking-wider text-fg-faint lg:sticky lg:top-0 lg:z-20 [&>span]:py-1.5`}>
            <span>delta</span>
            <span className="text-right">bid</span>
            <span className="text-right">ask</span>
            <span className="text-right">iv</span>
            <span className="pr-2 text-right">oi</span>
            <span className="border-x border-border-soft bg-bg-soft/60 text-center text-fg-dim">strike</span>
            <span className="pl-2">delta</span>
            <span className="text-right">bid</span>
            <span className="text-right">ask</span>
            <span className="text-right">iv</span>
            <span className="text-right">oi</span>
          </div>

          {strikes.map((K) => {
            const row = byStrike.get(K);
            if (!row) return null;
            const atm = K === atmStrike;
            return (
              <div
                key={K}
                className={`${cellGrid} relative items-stretch border-b border-border-soft px-3 font-mono text-[11px] tabular-nums transition-colors last:border-b-0 hover:bg-bg-soft/60 [&>span]:flex [&>span]:items-center [&>span]:py-2`}
              >
                {/* nearest-the-money row ring, ref-style */}
                {atm && (
                  <span
                    className="pointer-events-none absolute inset-0 z-10 border border-bull/60 !py-0"
                    aria-hidden
                  />
                )}
                {/* calls */}
                <span className="text-fg-dim">{row.call.greeks.delta.toFixed(2)}</span>
                <span className="justify-end text-bull">{row.call.bid.toFixed(2)}</span>
                <span className="justify-end text-bull">{row.call.ask.toFixed(2)}</span>
                <span className="justify-end text-fg-dim">{(row.call.iv * 100).toFixed(1)}%</span>
                <span className="justify-end pr-2 text-fg-faint">{kFmt(row.call.oi)}</span>
                {/* strike ladder */}
                <span
                  className={`justify-center border-x border-border-soft bg-bg-soft/60 font-display text-sm tracking-tightest ${
                    atm ? "text-bull" : "text-fg"
                  }`}
                >
                  {strikeFmt(K)}
                </span>
                {/* puts */}
                <span className="pl-2 text-fg-dim">{row.put.greeks.delta.toFixed(2)}</span>
                <span className="justify-end text-bear">{row.put.bid.toFixed(2)}</span>
                <span className="justify-end text-bear">{row.put.ask.toFixed(2)}</span>
                <span className="justify-end text-fg-dim">{(row.put.iv * 100).toFixed(1)}%</span>
                <span className="justify-end text-fg-faint">{kFmt(row.put.oi)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* footer — provenance + link to the full builder; pinned to the column bottom on lg */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider lg:shrink-0">
        <div className="flex items-center gap-2 text-fg-dim">
          <span>mark mid · black-scholes · in-process</span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-faint">{strikes.length} strikes</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 border border-amber/30 bg-amber/10 px-1.5 py-0.5 text-[9px] tracking-[0.2em] text-amber">
            <span className="size-1 rounded-full bg-amber" />
            synthetic chain · illustrative
          </span>
          <Link href="/trade/chain" className="text-bull hover:underline">
            configure chain →
          </Link>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { priceChain, type ChainCell } from "@/lib/pricing";
import { useStrategy } from "@/lib/stores";
import { GreekChip, GreekTrigger } from "@/components/ai-teacher/SpeechBubble";

type Props = {
  underlying: string;
  spot: number;
};

const STRIKES_NEAR_ATM = 11; // strikes either side of ATM

function formatExpiry(daysOut: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysOut);
  return {
    iso: d.toISOString().slice(0, 10),
    label: d.toLocaleDateString("en-US", { month: "short", day: "2-digit" }),
    daysToExpiry: daysOut,
  };
}

function ivToHeat(iv: number, min: number, max: number) {
  const t = Math.max(0, Math.min(1, (iv - min) / (max - min)));
  // green (low IV) → amber → red (high IV)
  if (t < 0.5) {
    const k = t * 2;
    const r = Math.round(0 + (255 - 0) * k);
    const g = Math.round(255 - 75 * k);
    return `rgba(${r}, ${g}, 100, ${0.06 + t * 0.18})`;
  } else {
    const k = (t - 0.5) * 2;
    const r = 255;
    const g = Math.round(180 - 134 * k);
    return `rgba(${r}, ${g}, 30, ${0.12 + k * 0.18})`;
  }
}

export function OptionsChain({ underlying, spot }: Props) {
  const expiries = useMemo(() => [7, 14, 30, 45, 90].map((d) => formatExpiry(d)), []);
  const [expiryIdx, setExpiryIdx] = useState(2);
  const expiry = expiries[expiryIdx];

  const strikes = useMemo(() => {
    const step = spot < 50 ? 1 : spot < 200 ? 2.5 : spot < 500 ? 5 : 10;
    const atm = Math.round(spot / step) * step;
    const arr: number[] = [];
    for (let i = -STRIKES_NEAR_ATM; i <= STRIKES_NEAR_ATM; i++) arr.push(+(atm + i * step).toFixed(2));
    return arr;
  }, [spot]);

  const [perfMs, setPerfMs] = useState(0);
  const { chain, lastMs } = useMemo(() => {
    const t0 = performance.now();
    const c = priceChain({ spot, expiries: [expiry], strikes });
    const t1 = performance.now();
    return { chain: c[0], lastMs: t1 - t0 };
  }, [spot, expiry, strikes]);
  useEffect(() => {
    setPerfMs(lastMs);
  }, [lastMs]);

  // Build a quick lookup by strike for grid rendering
  const byStrike = useMemo(() => {
    const map = new Map<number, { call: ChainCell; put: ChainCell }>();
    for (const cell of chain) {
      const m = map.get(cell.strike) ?? ({} as { call: ChainCell; put: ChainCell });
      if (cell.type === "C") m.call = cell;
      else m.put = cell;
      map.set(cell.strike, m);
    }
    return map;
  }, [chain]);

  // IV range for heatmap normalization
  const ivRange = useMemo(() => {
    const ivs = chain.map((c) => c.iv);
    return { min: Math.min(...ivs), max: Math.max(...ivs) };
  }, [chain]);

  // Strategy store
  const selected = useStrategy((s) => s.selected);
  const toggle = useStrategy((s) => s.toggle);

  // Drag selection
  const dragRef = useRef<{ active: boolean; touched: Set<string> }>({ active: false, touched: new Set() });
  const onDragStart = (cell: ChainCell, side: "long" | "short") => {
    dragRef.current.active = true;
    dragRef.current.touched.clear();
    const key = `${cell.expiry}|${cell.strike}|${cell.type}`;
    dragRef.current.touched.add(key);
    toggle(cell, side);
  };
  const onDragEnter = (cell: ChainCell, side: "long" | "short") => {
    if (!dragRef.current.active) return;
    const key = `${cell.expiry}|${cell.strike}|${cell.type}`;
    if (dragRef.current.touched.has(key)) return;
    dragRef.current.touched.add(key);
    toggle(cell, side);
  };
  useEffect(() => {
    const stop = () => (dragRef.current.active = false);
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);
    return () => {
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  // Tooltip state (hover)
  const [hover, setHover] = useState<{ cell: ChainCell; x: number; y: number } | null>(null);

  return (
    <div className="border border-border bg-bg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
        <div className="flex items-center gap-3">
          <span className="text-bull">●</span>
          <span className="text-fg">{underlying}</span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-dim">spot ${spot.toFixed(2)}</span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-dim">23 strikes · 5 expiries</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`${perfMs < 100 ? "text-bull" : "text-amber"}`}>
            chain priced in {perfMs.toFixed(1)}ms
          </span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-dim">black-scholes · in-process</span>
        </div>
      </div>

      {/* Expiry tabs + legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft px-3 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {expiries.map((e, i) => (
            <button
              key={e.iso}
              onClick={() => setExpiryIdx(i)}
              className={`border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                i === expiryIdx
                  ? "border-bull bg-bull/10 text-bull"
                  : "border-border bg-bg text-fg-dim hover:border-fg-dim hover:text-fg"
              }`}
            >
              {e.label} <span className="text-fg-faint ml-1">{e.daysToExpiry}d</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          <span>IV heatmap</span>
          <span className="flex items-center gap-1">
            low
            <span
              className="h-3 w-24"
              style={{
                background: "linear-gradient(to right, rgba(0,255,100,0.25), rgba(255,184,30,0.4), rgba(255,46,99,0.55))",
              }}
            />
            high
          </span>
          <span className="text-fg-faint">{(ivRange.min * 100).toFixed(0)}–{(ivRange.max * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Chain grid */}
      <div className="overflow-x-auto" onMouseLeave={() => setHover(null)}>
        <div className="grid min-w-[780px] grid-cols-[repeat(11,minmax(0,1fr))] border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
          <span className="col-span-5 text-center text-bull">— calls —</span>
          <span className="text-center text-fg">strike</span>
          <span className="col-span-5 text-center text-bear">— puts —</span>
        </div>
        <div className="grid min-w-[780px] grid-cols-[repeat(11,minmax(0,1fr))] border-b border-border-soft bg-bg px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
          <span>iv</span>
          <span className="text-right">vol</span>
          <span className="text-right">oi</span>
          <span className="text-right">bid</span>
          <span className="text-right">ask</span>
          <span className="text-center text-fg-dim">$</span>
          <span>bid</span>
          <span className="text-right">ask</span>
          <span className="text-right">oi</span>
          <span className="text-right">vol</span>
          <span className="text-right">iv</span>
        </div>

        <div role="grid" aria-label="options chain" className="select-none">
          {strikes.map((K, rowIdx) => {
            const row = byStrike.get(K)!;
            const atm = Math.abs(K - spot) < 1.2;
            const callKey = `${row.call.expiry}|${row.call.strike}|C`;
            const putKey = `${row.put.expiry}|${row.put.strike}|P`;
            const callSelected = selected.includes(callKey);
            const putSelected = selected.includes(putKey);
            const callBg = ivToHeat(row.call.iv, ivRange.min, ivRange.max);
            const putBg = ivToHeat(row.put.iv, ivRange.min, ivRange.max);

            return (
              <div
                key={K}
                role="row"
                className={`grid min-w-[780px] grid-cols-[repeat(11,minmax(0,1fr))] border-b border-border-soft px-3 py-2 font-mono text-[11px] tabular-nums transition-colors ${
                  atm ? "bg-bull/[0.04]" : ""
                }`}
              >
                {/* CALL side cell (one button covering bid/ask area for selection) */}
                <button
                  onMouseDown={() => onDragStart(row.call, "long")}
                  onMouseEnter={(e) =>
                    setHover({ cell: row.call, x: e.currentTarget.offsetLeft, y: e.currentTarget.offsetTop })
                  }
                  onMouseOver={() => onDragEnter(row.call, "long")}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onDragStart(row.call, "short");
                  }}
                  className={`col-span-5 grid grid-cols-5 items-center gap-1 border px-2 py-1 text-left transition-all ${
                    callSelected
                      ? "border-bull bg-bull/15 text-fg"
                      : "border-transparent text-fg-dim hover:border-bull/40 hover:text-fg"
                  }`}
                  style={{ backgroundColor: callSelected ? undefined : callBg }}
                >
                  <span className="text-fg-faint">{(row.call.iv * 100).toFixed(0)}%</span>
                  <span className="text-right">{row.call.vol}</span>
                  <span className="text-right">{row.call.oi}</span>
                  <span className="text-right text-bull">{row.call.bid.toFixed(2)}</span>
                  <span className="text-right text-bull">{row.call.ask.toFixed(2)}</span>
                </button>

                {/* Strike */}
                <span
                  className={`flex items-center justify-center border-x border-border-soft font-display text-sm tracking-tightest ${
                    atm ? "text-bull" : "text-fg"
                  }`}
                >
                  {K.toFixed(K < 100 ? 2 : 0)}
                </span>

                {/* PUT side cell */}
                <button
                  onMouseDown={() => onDragStart(row.put, "long")}
                  onMouseEnter={(e) =>
                    setHover({ cell: row.put, x: e.currentTarget.offsetLeft, y: e.currentTarget.offsetTop })
                  }
                  onMouseOver={() => onDragEnter(row.put, "long")}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onDragStart(row.put, "short");
                  }}
                  className={`col-span-5 grid grid-cols-5 items-center gap-1 border px-2 py-1 text-left transition-all ${
                    putSelected
                      ? "border-bear bg-bear/15 text-fg"
                      : "border-transparent text-fg-dim hover:border-bear/40 hover:text-fg"
                  }`}
                  style={{ backgroundColor: putSelected ? undefined : putBg }}
                >
                  <span className="text-bear">{row.put.bid.toFixed(2)}</span>
                  <span className="text-right text-bear">{row.put.ask.toFixed(2)}</span>
                  <span className="text-right">{row.put.oi}</span>
                  <span className="text-right">{row.put.vol}</span>
                  <span className="text-right text-fg-faint">{(row.put.iv * 100).toFixed(0)}%</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Hover tooltip with greek chips */}
        <AnimatePresence>
          {hover && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="pointer-events-none sticky bottom-0 left-0 right-0 z-10 border-t border-bull/30 bg-surface/95 px-3 py-2 backdrop-blur"
            >
              <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-fg-dim">
                <span className="text-fg">
                  {hover.cell.type === "C" ? "Call" : "Put"} {hover.cell.strike.toFixed(hover.cell.strike < 100 ? 2 : 0)}
                </span>
                <span className="text-fg-faint">·</span>
                <span>mid ${hover.cell.mid.toFixed(2)}</span>
                <span className="text-fg-faint">·</span>
                <GreekChip greek="delta" value={hover.cell.greeks.delta.toFixed(3)} />
                <GreekChip greek="gamma" value={hover.cell.greeks.gamma.toFixed(4)} />
                <GreekChip greek="theta" value={hover.cell.greeks.theta.toFixed(3)} />
                <GreekChip greek="vega" value={hover.cell.greeks.vega.toFixed(3)} />
                <GreekChip greek="iv" value={`${(hover.cell.iv * 100).toFixed(1)}%`} />
                <span className="ml-auto text-fg-faint hidden md:inline">
                  ⌘ click to add long · right-click to add short · drag for spreads
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hover-greek hint row (with hover triggers for the AI teacher) */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <span className="text-fg-faint">hover any greek →</span>
        <GreekTrigger greek="delta">delta</GreekTrigger>
        <GreekTrigger greek="gamma">gamma</GreekTrigger>
        <GreekTrigger greek="theta">theta</GreekTrigger>
        <GreekTrigger greek="vega">vega</GreekTrigger>
        <GreekTrigger greek="rho">rho</GreekTrigger>
        <GreekTrigger greek="iv">iv</GreekTrigger>
      </div>
    </div>
  );
}

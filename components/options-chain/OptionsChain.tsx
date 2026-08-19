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

  // key → cell lookup for elementFromPoint hit-testing during drag-select
  const cellByKey = useMemo(() => {
    const m = new Map<string, ChainCell>();
    for (const cell of chain) m.set(`${cell.expiry}|${cell.strike}|${cell.type}`, cell);
    return m;
  }, [chain]);

  // IV range for heatmap normalization
  const ivRange = useMemo(() => {
    const ivs = chain.map((c) => c.iv);
    return { min: Math.min(...ivs), max: Math.max(...ivs) };
  }, [chain]);

  // Strategy store
  const selected = useStrategy((s) => s.selected);
  const toggle = useStrategy((s) => s.toggle);

  // ── the selection grammar, pointer-native (WCAG 2.5.1: the gesture is never
  // the only path — the LONG/SHORT control below arms the tap side):
  //   tap                 → toggle leg with the ARMED side
  //   drag across cells   → multi-select with the armed side (elementFromPoint
  //                         hit-testing; the old mouseover wiring was a corpse
  //                         on touch)
  //   drag DOWN on a cell → SHORT that leg — you literally pull the strike
  //                         under the line (fine pointers; touch scrolls, so
  //                         touch shorts via the armed control)
  //   right-click         → short (desktop bonus, kept)
  //   Enter / Shift+Enter → armed side / opposite (keyboard)
  const [armedSide, setArmedSide] = useState<"long" | "short">("long");
  const cellKey = (c: ChainCell) => `${c.expiry}|${c.strike}|${c.type}`;
  const gestureRef = useRef<{
    origin: ChainCell;
    startX: number;
    startY: number;
    fine: boolean;
    touched: Set<string>;
    multi: boolean;
    done: boolean;
  } | null>(null);

  const SHORT_DRAG_PX = 26;

  const onCellPointerDown = (cell: ChainCell, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* capture is an optimization (keeps moves flowing off-element); a
         browser refusing it must not kill the gesture */
    }
    gestureRef.current = {
      origin: cell,
      startX: e.clientX,
      startY: e.clientY,
      fine: e.pointerType !== "touch",
      touched: new Set([cellKey(cell)]),
      multi: false,
      done: false,
    };
  };

  const onCellPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (!g || g.done) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    // drag-to-short: pull the origin cell downward past the threshold
    if (g.fine && !g.multi && dy > SHORT_DRAG_PX && Math.abs(dx) < 40) {
      g.done = true;
      toggle(g.origin, "short");
      navigator.vibrate?.(12);
      return;
    }
    // cross-cell drag-select (any pointer type)
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.("[data-ck]") as HTMLElement | null;
    const ck = el?.dataset.ck;
    if (ck && !g.touched.has(ck)) {
      const target = cellByKey.get(ck);
      if (target) {
        if (!g.multi) {
          // entering multi mode: the origin cell joins the selection too
          g.multi = true;
          toggle(g.origin, armedSide);
        }
        g.touched.add(ck);
        toggle(target, armedSide);
      }
    }
  };

  const onCellPointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g || g.done || g.multi) return;
    const moved = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
    if (moved < 10) toggle(g.origin, armedSide); // a tap
  };

  const onCellPointerCancel = () => {
    gestureRef.current = null;
  };

  // Tooltip state (hover)
  const [hover, setHover] = useState<{ cell: ChainCell; x: number; y: number } | null>(null);

  return (
    <div className="border border-border bg-bg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-soft px-3 py-2 t-chrome">
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
        <div className="flex items-center gap-2 t-chrome text-fg-dim">
          {/* the ARMED side for taps/keyboard — the drag-down-to-short gesture
              is a shortcut, never the only path (WCAG 2.5.1) */}
          <span className="text-fg-faint">tap =</span>
          <span className="inline-flex border border-border" role="group" aria-label="Side armed for tap">
            <button
              onClick={() => setArmedSide("long")}
              aria-pressed={armedSide === "long"}
              className={`px-2 py-0.5 font-semibold transition-colors ${
                armedSide === "long" ? "bg-bull text-bg" : "bg-bg text-fg-faint hover:text-fg"
              }`}
            >
              LONG
            </button>
            <button
              onClick={() => setArmedSide("short")}
              aria-pressed={armedSide === "short"}
              className={`px-2 py-0.5 font-semibold transition-colors ${
                armedSide === "short" ? "bg-bear text-bg" : "bg-bg text-fg-faint hover:text-fg"
              }`}
            >
              SHORT
            </button>
          </span>
          <span className="hidden text-fg-faint lg:inline" title="On mouse/pen: press a cell and pull it downward past ~26px to short it directly">
            · drag ↓ = short
          </span>
        </div>
        <div className="flex items-center gap-3 t-chrome text-fg-dim">
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
        <div className="grid min-w-[780px] grid-cols-[repeat(11,minmax(0,1fr))] border-b border-border-soft bg-bg-soft px-3 py-2 t-chrome text-fg-faint">
          <span className="col-span-5 text-center text-bull">— calls —</span>
          <span className="text-center text-fg">strike</span>
          <span className="col-span-5 text-center text-bear">— puts —</span>
        </div>
        <div className="grid min-w-[780px] grid-cols-[repeat(11,minmax(0,1fr))] border-b border-border-soft bg-bg px-3 py-1 t-chrome text-fg-faint">
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

        <div aria-label="options chain" className="select-none">
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
                className={`grid min-w-[780px] grid-cols-[repeat(11,minmax(0,1fr))] border-b border-border-soft px-3 py-2 t-data text-[11px] transition-colors ${
                  atm ? "bg-bull/[0.04]" : ""
                }`}
              >
                {/* CALL side cell (one button covering bid/ask area for selection).
                    Keyboard is first-class (WCAG 2.1.1): Enter/Space toggles a
                    long leg, Shift+Enter shorts — mousedown alone made these
                    <button>s announce as buttons and then answer to nothing. */}
                <button
                  data-ck={`${row.call.expiry}|${row.call.strike}|C`}
                  onPointerDown={(e) => onCellPointerDown(row.call, e)}
                  onPointerMove={onCellPointerMove}
                  onPointerUp={onCellPointerUp}
                  onPointerCancel={onCellPointerCancel}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(row.call, e.shiftKey ? (armedSide === "long" ? "short" : "long") : armedSide);
                    }
                  }}
                  aria-label={`${underlying} ${K.toFixed(K < 100 ? 2 : 0)} call, bid ${row.call.bid.toFixed(2)}, ask ${row.call.ask.toFixed(2)}${callSelected ? ", selected" : ""}. Enter to go ${armedSide}, Shift+Enter for the opposite.`}
                  aria-pressed={callSelected}
                  style={{ touchAction: "pan-y", backgroundColor: callSelected ? undefined : callBg }}
                  onMouseEnter={(e) =>
                    setHover({ cell: row.call, x: e.currentTarget.offsetLeft, y: e.currentTarget.offsetTop })
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggle(row.call, "short");
                  }}
                  className={`col-span-5 grid grid-cols-5 items-center gap-1 border px-2 py-1 text-left transition-all ${
                    callSelected
                      ? "border-bull bg-bull/15 text-fg"
                      : "border-transparent text-fg-dim hover:border-bull/40 hover:text-fg"
                  }`}
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
                  data-ck={`${row.put.expiry}|${row.put.strike}|P`}
                  onPointerDown={(e) => onCellPointerDown(row.put, e)}
                  onPointerMove={onCellPointerMove}
                  onPointerUp={onCellPointerUp}
                  onPointerCancel={onCellPointerCancel}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(row.put, e.shiftKey ? (armedSide === "long" ? "short" : "long") : armedSide);
                    }
                  }}
                  aria-label={`${underlying} ${K.toFixed(K < 100 ? 2 : 0)} put, bid ${row.put.bid.toFixed(2)}, ask ${row.put.ask.toFixed(2)}${putSelected ? ", selected" : ""}. Enter to go ${armedSide}, Shift+Enter for the opposite.`}
                  aria-pressed={putSelected}
                  style={{ touchAction: "pan-y", backgroundColor: putSelected ? undefined : putBg }}
                  onMouseEnter={(e) =>
                    setHover({ cell: row.put, x: e.currentTarget.offsetLeft, y: e.currentTarget.offsetTop })
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggle(row.put, "short");
                  }}
                  className={`col-span-5 grid grid-cols-5 items-center gap-1 border px-2 py-1 text-left transition-all ${
                    putSelected
                      ? "border-bear bg-bear/15 text-fg"
                      : "border-transparent text-fg-dim hover:border-bear/40 hover:text-fg"
                  }`}
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
      <div className="flex flex-wrap items-center gap-2 border-t border-border-soft bg-bg-soft px-3 py-2 t-chrome text-fg-dim">
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

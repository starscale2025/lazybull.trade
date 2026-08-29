"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
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
  //                         on touch). On touch this holds only while the chain
  //                         fits its column — once it overflows, the browser
  //                         gets the horizontal drag so the puts stay reachable
  //                         (see cellTouchAction below); tapping still builds
  //                         every leg.
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
      pick(g.origin);
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
        pick(target);
        toggle(target, armedSide);
      }
    }
  };

  const onCellPointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g || g.done || g.multi) return;
    const moved = Math.hypot(e.clientX - g.startX, e.clientY - g.startY);
    if (moved < 10) {
      // a tap — pin the readout before toggling, so a phone (which has no
      // mouseenter to fire) still gets the greeks it came for
      pick(g.origin);
      toggle(g.origin, armedSide);
    }
  };

  const onCellPointerCancel = () => {
    gestureRef.current = null;
  };

  // ── the greeks readout ───────────────────────────────────────────────────
  // Two sources, because a mouse is not the only way to point at a strike:
  //   hover → the pointer is over a cell (desktop, unchanged)
  //   pick  → a tap, a drag, or keyboard focus
  // Binding it to onMouseEnter alone meant a touch device saw the chain's
  // prices and not one greek — no mouseenter, no delta/gamma/theta/vega, ever,
  // on the page whose whole claim is that you can see them. Newest signal wins:
  // ranking hover above pick let a stale hover — one a finger left behind,
  // since touch never fires mouseleave — sit on top of the cell just tapped.
  const [readoutCell, setReadoutCell] = useState<ChainCell | null>(null);
  const [picked, setPicked] = useState<ChainCell | null>(null);
  const pick = (cell: ChainCell) => {
    setPicked(cell);
    setReadoutCell(cell);
  };
  // Re-resolve against the current chain. The readout now stays up after the
  // pointer leaves, and the spot reprices every 10s, so a held cell would sit
  // there quoting greeks from a spot that has moved on.
  const readout = readoutCell ? cellByKey.get(cellKey(readoutCell)) ?? readoutCell : null;

  // Is any of the 640px grid off-screen right now? This depends on the column
  // width, not the viewport — at lg the chain sits in 7 of 12 columns and
  // overflows on a 1024px laptop too — so measure the scroller itself.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [chainOverflows, setChainOverflows] = useState(false);
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setChainOverflows(el.scrollWidth > el.clientWidth + 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // `pan-y` on a cell hands every horizontal touch drag to the drag-select
  // gesture above — that is what it was for. It also meant a 375px phone could
  // never pan the 640px grid: the scroll container existed, but the only thing
  // a finger could land on refused to move it, so the entire put side was
  // unreachable. Hand the browser the x-axis only while there is something
  // off-screen to reach. Where the chain fits, touch drag-select still works;
  // where it doesn't, panning to the puts wins and taps (with LONG/SHORT armed)
  // build the same legs. Vertical page scroll is untouched either way.
  const cellTouchAction = chainOverflows ? "pan-x pan-y" : "pan-y";

  return (
    <div className="border border-border bg-bg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-soft px-3 py-2 t-chrome">
        <div className="flex items-center gap-3">
          {/* perf/engine telemetry lives in the dot's tooltip — spot is already
              read out in the symbol-switcher row above */}
          <span
            className={perfMs < 100 ? "text-bull" : "text-amber"}
            title={`chain priced in ${perfMs.toFixed(1)}ms · black-scholes · in-process`}
          >
            ●
          </span>
          <span className="text-fg">{underlying}</span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-dim">23 strikes · 5 expiries</span>
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
          {/* xl: below that the expiry tabs + toggle already fill the row */}
          <span className="hidden text-fg-faint xl:inline" title="On mouse/pen: press a cell and pull it downward past ~26px to short it directly">
            · drag ↓ = short
          </span>
        </div>
      </div>

      {/* Chain grid */}
      <div onMouseLeave={() => setReadoutCell(picked)}>
      {/* overscroll-x-contain: panning to the puts must not hand the swipe to
          the browser's back gesture */}
      <div ref={scrollerRef} className="overflow-x-auto overscroll-x-contain">
        <div className="grid min-w-[640px] grid-cols-[repeat(9,minmax(0,1fr))] border-b border-border-soft bg-bg-soft px-3 py-2 t-chrome text-fg-faint">
          <span className="col-span-4 text-center text-bull">— calls —</span>
          <span className="text-center text-fg">strike</span>
          <span className="col-span-4 text-center text-bear">— puts —</span>
        </div>
        <div className="grid min-w-[640px] grid-cols-[repeat(9,minmax(0,1fr))] border-b border-border-soft bg-bg px-3 py-1 t-chrome text-fg-faint">
          {/* iv text columns dropped — the value paints the cell heat and the
              exact figure lives in the greeks readout under the grid */}
          <span>vol</span>
          <span className="text-right">oi</span>
          <span className="text-right">bid</span>
          <span className="text-right">ask</span>
          <span className="text-center text-fg-dim">$</span>
          <span>bid</span>
          <span className="text-right">ask</span>
          <span className="text-right">oi</span>
          <span className="text-right">vol</span>
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
                className={`grid min-w-[640px] grid-cols-[repeat(9,minmax(0,1fr))] border-b border-border-soft px-3 py-2 t-data text-[11px] transition-colors ${
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
                  style={{ touchAction: cellTouchAction, backgroundColor: callSelected ? undefined : callBg }}
                  onMouseEnter={() => setReadoutCell(row.call)}
                  onFocus={() => pick(row.call)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggle(row.call, "short");
                  }}
                  className={`col-span-4 grid grid-cols-4 items-center gap-1 border px-2 py-1 text-left transition-all ${
                    callSelected
                      ? "border-bull bg-bull/15 text-fg"
                      : "border-transparent text-fg-dim hover:border-bull/40 hover:text-fg"
                  }`}
                >
                  <span>{row.call.vol}</span>
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
                  style={{ touchAction: cellTouchAction, backgroundColor: putSelected ? undefined : putBg }}
                  onMouseEnter={() => setReadoutCell(row.put)}
                  onFocus={() => pick(row.put)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggle(row.put, "short");
                  }}
                  className={`col-span-4 grid grid-cols-4 items-center gap-1 border px-2 py-1 text-left transition-all ${
                    putSelected
                      ? "border-bear bg-bear/15 text-fg"
                      : "border-transparent text-fg-dim hover:border-bear/40 hover:text-fg"
                  }`}
                >
                  <span className="text-bear">{row.put.bid.toFixed(2)}</span>
                  <span className="text-right text-bear">{row.put.ask.toFixed(2)}</span>
                  <span className="text-right">{row.put.oi}</span>
                  <span className="text-right">{row.put.vol}</span>
                </button>
              </div>
            );
          })}
        </div>

      </div>

        {/* Greeks readout — one fixed line, in flow. As an absolute overlay it
            sat on the grid's bottom edge and hid data: 46px over the last row
            at 1280, and 113px over the last TWO rows at 375, where it wrapped
            to three lines. Its own row can't cover a strike; a fixed height
            can't make the card twitch as the readout changes; and it scrolls
            sideways so a phone reaches every chip. h-10, not h-9: the project's
            8px scrollbar eats into the box and would clip the chips. */}
        <div
          className={`flex h-10 items-center gap-2 overflow-x-auto overscroll-x-contain border-t bg-surface/95 px-3 font-mono text-[10px] text-fg-dim backdrop-blur ${
            readout ? "border-bull/30" : "border-border-soft"
          }`}
        >
          {/* no key on the readout: it must update in place. Keying it on the
              cell remounted the chips and replayed their fade on every row the
              mouse crossed — a strobe on a 23-row sweep. */}
          {readout ? (
            <motion.div
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.12 }}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              {/* strike, then the greeks, then mid. mid used to sit second and
                  cost ~85px, which on a 375px screen pushed every chip past the
                  right edge — the greeks have to be the part you see first. */}
              <span className="text-fg">
                {readout.type === "C" ? "Call" : "Put"} {readout.strike.toFixed(readout.strike < 100 ? 2 : 0)}
              </span>
              <GreekChip greek="delta" value={readout.greeks.delta.toFixed(3)} />
              <GreekChip greek="gamma" value={readout.greeks.gamma.toFixed(4)} />
              <GreekChip greek="theta" value={readout.greeks.theta.toFixed(3)} />
              <GreekChip greek="vega" value={readout.greeks.vega.toFixed(3)} />
              <GreekChip greek="iv" value={`${(readout.iv * 100).toFixed(1)}%`} />
              <span className="text-fg-faint">·</span>
              <span>mid ${readout.mid.toFixed(2)}</span>
            </motion.div>
          ) : (
            <span className="whitespace-nowrap text-fg-faint">hover or tap a strike → greeks</span>
          )}
        </div>
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
        <span className="ml-auto flex items-center gap-2">
          <span>iv heat</span>
          <span className="flex items-center gap-1">
            low
            <span
              className="h-2.5 w-16"
              style={{
                background: "linear-gradient(to right, rgba(0,255,100,0.25), rgba(255,184,30,0.4), rgba(255,46,99,0.55))",
              }}
            />
            high
          </span>
          <span className="text-fg-faint">{(ivRange.min * 100).toFixed(0)}–{(ivRange.max * 100).toFixed(0)}%</span>
        </span>
      </div>
    </div>
  );
}

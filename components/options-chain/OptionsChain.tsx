"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { priceChain, type ChainCell } from "@/lib/pricing";
import { expiryOn, useToday } from "@/lib/expiry";
import { useStrategy } from "@/lib/stores";
import { GreekChip, GreekTrigger } from "@/components/ai-teacher/SpeechBubble";

type Props = {
  underlying: string;
  spot: number;
};

const STRIKES_NEAR_ATM = 11; // strikes either side of ATM

const DAYS_OUT = [7, 14, 30, 45, 90];

// IV heat, in the deck's data colour (THE DECK SKIN, globals.css): one hue,
// cyan, from a whisper at the chain's lowest IV to a clear tint at its
// highest. It says "more" or "less", never "good" or "bad" — green and red
// are spent on the legs you pick (long / short, below), so the heat can never
// be read as one. The percentage is rounded so the server's string and the
// browser's agree at hydration.
const HEAT_LO = 3; // % of --cyan at the lowest IV
const HEAT_HI = 22; // % of --cyan at the highest
const heat = (pct: number) => `color-mix(in srgb, var(--cyan) ${pct.toFixed(1)}%, transparent)`;
function ivToHeat(iv: number, min: number, max: number) {
  const t = Math.max(0, Math.min(1, (iv - min) / (max - min || 1)));
  return heat(HEAT_LO + t * (HEAT_HI - HEAT_LO));
}
// The legend under the grid draws the same ramp the cells are painted from.
const HEAT_RAMP = `linear-gradient(to right, ${heat(HEAT_LO)}, ${heat(HEAT_HI)})`;

// A picked cell wears its side: long in the deck's green, short in its red —
// the same pair the LONG / SHORT control arms, so the control previews the
// colour a tap will paint. Idle cells are bone figures over the heat.
const SIDE_CELL = {
  long: "bg-[var(--deck-green-tint)] text-bull shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--bull)_45%,transparent)]",
  short: "bg-[var(--deck-red-tint)] text-bear shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--bear)_45%,transparent)]",
} as const;
const IDLE_CELL = "text-fg hover:shadow-[inset_0_0_0_1px_var(--deck-rule-hi)]";
// Open interest and volume are simulated (see the provenance line under the
// grid), so on an idle cell they sit a step under the prices: fg-dim, not
// fg-faint, which would drop under 4.5:1 on the hottest cells. A picked cell
// sets all four figures in its side's colour, at full strength for contrast.
const PLACEHOLDER = "text-fg-dim";

const ARMED = {
  long: "bg-[var(--deck-green-tint)] text-bull",
  short: "bg-[var(--deck-red-tint)] text-bear",
} as const;

// The chain's columns, one grid for the heads and the rows alike, so a head
// sits exactly over its figures.
const ROW = "grid min-w-[40rem] grid-cols-[repeat(9,minmax(0,1fr))] px-3";
const SIDE_GRID = "col-span-4 grid grid-cols-4 items-center gap-1 px-2";

export function OptionsChain({ underlying, spot }: Props) {
  // Days-out on the server, calendar labels after hydration (lib/expiry.ts).
  const today = useToday();
  const expiries = useMemo(() => DAYS_OUT.map((d) => expiryOn(today, d)), [today]);
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
  // Which side each picked leg is on, read from the same store (a leg's id is
  // its cell key), so a cell can wear long-green or short-red and follow a
  // flip made on the strategy card.
  const legs = useStrategy((s) => s.legs);
  const sideByKey = useMemo(() => new Map(legs.map((l) => [l.id, l.side] as const)), [legs]);

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
    <div className="deck-pane">
      {/* Pane head, the mockup's file tab: what is on the table, and which
          side a tap builds. min-h-12 py-2, the strategy card's own head, so
          at lg the two head rules sit on one line across the columns. */}
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-2.5 text-[0.8125rem]">
          {/* perf/engine telemetry lives in the dot's tooltip — spot is already
              read out in the symbol-switcher row above */}
          <span
            className={`text-[0.625rem] ${perfMs < 100 ? "text-fg-faint" : "text-amber"}`}
            title={`chain priced in ${perfMs.toFixed(1)}ms · black-scholes · in-process`}
          >
            ●
          </span>
          <span className="font-mono text-fg">{underlying}</span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-faint">23 strikes · 5 expiries</span>
        </div>
        <div className="flex items-center gap-2.5">
          {/* the ARMED side for taps/keyboard — the drag-down-to-short gesture
              is a shortcut, never the only path (WCAG 2.5.1) */}
          <span className="deck-label">Tap =</span>
          <span
            className="inline-flex gap-0.5 rounded-full p-0.5 shadow-[inset_0_0_0_1px_var(--deck-rule)]"
            role="group"
            aria-label="Side armed for tap"
          >
            {(["long", "short"] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-pressed={armedSide === side}
                onClick={() => setArmedSide(side)}
                className={`inline-flex h-7 items-center rounded-full px-3 font-mono text-[0.6875rem] uppercase tracking-[0.12em] transition-colors ${
                  armedSide === side ? ARMED[side] : "text-fg-faint hover:text-fg"
                }`}
              >
                {side === "long" ? "Long" : "Short"}
              </button>
            ))}
          </span>
          {/* xl: below that the head is already full */}
          <span
            className="hidden text-[0.75rem] text-fg-faint xl:inline"
            title="On mouse/pen: press a cell and pull it downward past ~26px to short it directly"
          >
            · drag ↓ = short
          </span>
        </div>
      </div>

      {/* Expiry tabs, the mockup's pane tabs: the chosen one bone with the
          green rule under it. They scroll sideways on a phone instead of
          wrapping; py-1 keeps the focus ring inside the scroller. */}
      <div className="flex gap-5 overflow-x-auto overscroll-x-contain border-b border-border px-4 py-1">
        {expiries.map((e, i) => {
          const on = i === expiryIdx;
          return (
            <button
              key={e.daysToExpiry}
              type="button"
              aria-pressed={on}
              onClick={() => setExpiryIdx(i)}
              className={`relative inline-flex h-9 shrink-0 items-center whitespace-nowrap text-[0.8125rem] font-medium transition-colors after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full ${
                on ? "text-fg after:bg-brand" : "text-fg-faint hover:text-fg-dim"
              }`}
            >
              {e.label && <>{e.label} </>}
              <span className={`t-data text-[0.75rem] ${e.label ? "ml-1 text-fg-faint" : ""}`}>{e.daysToExpiry}d</span>
            </button>
          );
        })}
      </div>

      {/* Chain grid */}
      <div onMouseLeave={() => setReadoutCell(picked)}>
      {/* overscroll-x-contain: panning to the puts must not hand the swipe to
          the browser's back gesture */}
      <div ref={scrollerRef} className="overflow-x-auto overscroll-x-contain bg-[var(--deck-sunk)]">
        {/* the deck's table head: the two sides named, the columns under
            them, and the strong rule beneath */}
        <div className={`${ROW} pt-3`}>
          <span className="col-span-4 flex items-center gap-3 px-2">
            <span aria-hidden className="h-px flex-1 bg-[var(--deck-rule)]" />
            <span className="deck-label">calls</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--deck-rule)]" />
          </span>
          <span className="deck-label text-center">strike</span>
          <span className="col-span-4 flex items-center gap-3 px-2">
            <span aria-hidden className="h-px flex-1 bg-[var(--deck-rule)]" />
            <span className="deck-label">puts</span>
            <span aria-hidden className="h-px flex-1 bg-[var(--deck-rule)]" />
          </span>
        </div>
        <div className={`${ROW} border-b border-[var(--deck-rule)] pb-2 pt-2`}>
          {/* iv text columns dropped — the value paints the cell heat and the
              exact figure lives in the greeks readout under the grid */}
          <span className={`${SIDE_GRID} deck-label`}>
            <span>vol</span>
            <span className="text-right">oi</span>
            <span className="text-right">bid</span>
            <span className="text-right">ask</span>
          </span>
          <span className="deck-label text-center">$</span>
          <span className={`${SIDE_GRID} deck-label`}>
            <span>bid</span>
            <span className="text-right">ask</span>
            <span className="text-right">oi</span>
            <span className="text-right">vol</span>
          </span>
        </div>

        <div aria-label="options chain" className="select-none pb-1">
          {strikes.map((K) => {
            const row = byStrike.get(K)!;
            const atm = Math.abs(K - spot) < 1.2;
            const callKey = `${row.call.expiry}|${row.call.strike}|C`;
            const putKey = `${row.put.expiry}|${row.put.strike}|P`;
            const callSelected = selected.includes(callKey);
            const putSelected = selected.includes(putKey);
            const callSide = callSelected ? sideByKey.get(callKey) ?? "long" : null;
            const putSide = putSelected ? sideByKey.get(putKey) ?? "long" : null;
            const callBg = ivToHeat(row.call.iv, ivRange.min, ivRange.max);
            const putBg = ivToHeat(row.put.iv, ivRange.min, ivRange.max);

            return (
              // the at-the-money row is marked quietly: a raised band the
              // heat sits over, and a bone strike. The last row drops its
              // hairline: the readout's rule closes the table, and two rules
              // 4px apart read as a slip.
              <div
                key={K}
                className={`${ROW} t-data border-b border-border text-[0.75rem] last:border-b-0 ${atm ? "bg-[var(--deck-raised)]" : ""}`}
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
                  className={`${SIDE_GRID} py-2.5 text-left transition-[background-color,box-shadow,color] duration-150 ${
                    callSide ? SIDE_CELL[callSide] : IDLE_CELL
                  }`}
                >
                  <span className={callSide ? undefined : PLACEHOLDER}>{row.call.vol}</span>
                  <span className={`text-right ${callSide ? "" : PLACEHOLDER}`}>{row.call.oi}</span>
                  <span className="text-right">{row.call.bid.toFixed(2)}</span>
                  <span className="text-right">{row.call.ask.toFixed(2)}</span>
                </button>

                {/* Strike — the row's name, set in the display face */}
                <span
                  className={`flex items-center justify-center border-x border-border font-display text-[0.9375rem] tracking-tightest ${
                    atm ? "text-fg" : "text-fg-dim"
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
                  className={`${SIDE_GRID} py-2.5 text-left transition-[background-color,box-shadow,color] duration-150 ${
                    putSide ? SIDE_CELL[putSide] : IDLE_CELL
                  }`}
                >
                  <span>{row.put.bid.toFixed(2)}</span>
                  <span className="text-right">{row.put.ask.toFixed(2)}</span>
                  <span className={`text-right ${putSide ? "" : PLACEHOLDER}`}>{row.put.oi}</span>
                  <span className={`text-right ${putSide ? "" : PLACEHOLDER}`}>{row.put.vol}</span>
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
          className="flex h-10 items-center gap-2 overflow-x-auto overscroll-x-contain border-t border-border px-4 text-[0.75rem] text-fg-dim"
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
              <span className="t-data text-fg">
                {readout.type === "C" ? "Call" : "Put"} {readout.strike.toFixed(readout.strike < 100 ? 2 : 0)}
              </span>
              <GreekChip greek="delta" value={readout.greeks.delta.toFixed(3)} />
              <GreekChip greek="gamma" value={readout.greeks.gamma.toFixed(4)} />
              <GreekChip greek="theta" value={readout.greeks.theta.toFixed(3)} />
              <GreekChip greek="vega" value={readout.greeks.vega.toFixed(3)} />
              <GreekChip greek="iv" value={`${(readout.iv * 100).toFixed(1)}%`} />
              <span className="text-fg-faint">·</span>
              <span className="t-data">Mid ${readout.mid.toFixed(2)}</span>
            </motion.div>
          ) : (
            <span className="whitespace-nowrap text-fg-faint">Hover or tap a strike → greeks</span>
          )}
        </div>
      </div>

      {/* Hover-greek hint row (with hover triggers for the AI teacher) */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-t border-border px-4 py-2.5 text-[0.75rem] text-fg-dim">
        <span className="text-fg-faint">Hover any greek →</span>
        <GreekTrigger greek="delta">Delta</GreekTrigger>
        <GreekTrigger greek="gamma">Gamma</GreekTrigger>
        <GreekTrigger greek="theta">Theta</GreekTrigger>
        <GreekTrigger greek="vega">Vega</GreekTrigger>
        <GreekTrigger greek="rho">Rho</GreekTrigger>
        <GreekTrigger greek="iv">IV</GreekTrigger>
        <span className="ml-auto flex items-center gap-2">
          <span>IV heat</span>
          <span className="flex items-center gap-1.5 text-fg-faint">
            Low
            <span
              aria-hidden
              className="h-2 w-16 rounded-[3px] shadow-[inset_0_0_0_1px_var(--border)]"
              style={{ background: HEAT_RAMP }}
            />
            High
          </span>
          <span className="t-data text-fg-faint">{(ivRange.min * 100).toFixed(0)}–{(ivRange.max * 100).toFixed(0)}%</span>
        </span>
      </div>

      {/* WHERE EVERY NUMBER IN THIS TABLE COMES FROM.
          The 2026-09 diligence memo, verbatim: "Open interest and volume on the
          chain are hashed fakes presented in the same typography as prices.
          'Source: Mock' labelling must be everywhere a fake number appears,
          especially the chain."
          It is exactly right. Bid, ask, mid, IV and the Greeks are real
          Black-Scholes output over a modelled skew (lib/pricing.ts
          skewedIv/priceOption) — arithmetic anyone can check. The oi and vol
          columns are `hash(expiry|strike|type)` scaled into a plausible range
          (lib/pricing.ts, buildChain): stable, plausible, and completely
          invented. Set in the same face and weight as the prices beside them,
          they read as market data, and a beginner learning to read a chain
          learns to trust a number nobody measured.
          This line is the cheapest honest fix and it stays until those two
          columns carry a real feed. The deck pass also sets those two columns
          a step quieter than the prices (fg-dim against bone), so the
          invented figures no longer wear the measured ones' weight. */}
      <div className="border-t border-border px-4 py-2.5 font-mono text-[0.6875rem] leading-relaxed text-fg-faint">
        Chain: Black-Scholes with a modelled skew · open interest and volume are
        simulated placeholders
      </div>
    </div>
  );
}

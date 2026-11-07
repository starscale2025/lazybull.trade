"use client";

/**
 * THE INSTRUMENT — the thing the product does, on the landing.
 *
 * Until 2026-11-06 this was frame zero: the H1 stood on its P&L zero axis. The
 * first frame is the matter now (components/FrameZero.tsx), and the instrument
 * opens the landing, right after the eye band, with its headline still on the
 * axis: "See it." is the line where the position stops losing and starts
 * making.
 *
 * A bull call spread on a synthetic underlying, priced by the same
 * Black-Scholes engine as /trade (lib/pricing). Drag either strike and the
 * payoff, the breakeven, the most it can lose and the most it can make redraw.
 * Nothing here names a real security or a target, and the frame says
 * ILLUSTRATIVE · PAPER-ONLY in its own chrome.
 *
 * Two curves, because the gap between them is the lesson: the solid line is the
 * position at expiry, the dashed one is what it is worth today with the time
 * value still in it.
 *
 * HYDRATION: every coordinate and figure is rounded before it reaches the DOM.
 * Black-Scholes runs Math.log/Math.exp, which are not specified to the last ULP,
 * so Node and the browser can disagree in the final digits (the 2026-11
 * sparkline mismatch on /trade was exactly this).
 *
 * ACCESSIBILITY (Gate A2 tribunal, 2026-11-06). A drag is one way to move a
 * strike, never the only one (WCAG 2.2 SC 2.5.7): a tap anywhere on the plot
 * moves the nearer strike to that price, and − / + steppers under the plot
 * move either strike with the arrow keys' bounds and step. Each slider speaks
 * the consequence, not just the number ("lower strike 96, most it can lose
 * $483"), and the live region describes the position once, when a gesture
 * ends, instead of re-reading a whole sentence on every detent of a drag.
 */

import Link from "next/link";
import { useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { payoff, priceOption, type Leg } from "@/lib/pricing";
import { setHeroPosition } from "@/lib/hero-position";

// ── the synthetic underlying, stated in the caption ─────────────────────────
const SPOT = 100;
const DAYS = 30;
const IV = 0.22;
const RATE = 0.045;
const T = DAYS / 365;

// ── geometry, in viewBox units. ZERO is the axis the H1 sits on. ─────────────
const S_MIN = 76;
const S_MAX = 116;
const K_MIN = 80;
const K_MAX = 114;
const GAP = 2; // narrowest spread the handles allow
const VW = 1000;
const VH = 400;
const ZERO = 250;
const PNL_TOP = 1100; // dollars that reach y = 20
const SCALE = (ZERO - 20) / PNL_TOP;

// ── the live region ─────────────────────────────────────────────────────────
// A run of arrow presses or stepper clicks is described once it pauses this
// long, so key auto-repeat (~30 a second) and a quick run of clicks read as
// one move. A drag's release and a tap are described at once.
const SETTLE_MS = 600;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const xOf = (s: number) => ((s - S_MIN) / (S_MAX - S_MIN)) * VW;
const yOf = (pnl: number) => clamp(ZERO - pnl * SCALE, 6, VH - 6);
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
const pts = (a: Array<[number, number]>) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const money = (v: number) => `$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;

const call = (s: number, k: number, t = T) => priceOption(s, k, t, RATE, IV, "C").price;

// The three numbers the decision turns on. spread() adds the curves to them;
// the live region needs only these.
function figures(k1: number, k2: number) {
  const c1 = call(SPOT, k1);
  const c2 = call(SPOT, k2);
  const debit = c1 - c2;
  return { c1, c2, debit, maxLoss: debit * 100, maxProfit: (k2 - k1 - debit) * 100, breakeven: k1 + debit };
}

function spread(k1: number, k2: number) {
  const { c1, c2, debit, maxLoss, maxProfit, breakeven } = figures(k1, k2);
  const legs: Leg[] = [
    { id: "k1", type: "C", side: "long", strike: k1, qty: 1, premium: c1 },
    { id: "k2", type: "C", side: "short", strike: k2, qty: 1, premium: c2 },
  ];
  // At expiry the payoff is piecewise linear, so the four corners are exact.
  const expiry: Array<[number, number]> = [S_MIN, k1, k2, S_MAX].map((s) => [xOf(s), yOf(payoff(legs, s))]);
  // Today: the same spread marked to Black-Scholes with 30 days still on it.
  const today: Array<[number, number]> = Array.from({ length: 61 }, (_, i) => {
    const s = S_MIN + (i / 60) * (S_MAX - S_MIN);
    return [xOf(s), yOf((call(s, k1) - call(s, k2) - debit) * 100)];
  });
  return { maxLoss, maxProfit, breakeven, expiry, today };
}

// What the live region says, in the plot's own order and words: the loss
// first, the upside with its condition.
function describe(k1: number, k2: number) {
  const f = figures(k1, k2);
  return `Lower strike ${k1}, upper strike ${k2}. The most this position can lose is ${money(f.maxLoss)}. It makes up to ${money(f.maxProfit)} only if SIM ends above ${k2} at expiry, and breaks even at ${f.breakeven.toFixed(2)}.`;
}

type Handle = "k1" | "k2";

// ── the position: one reducer for every way in ──────────────────────────────
// A drag, a tap, a key and a stepper all clamp against the strikes as they are
// NOW, not as the last render saw them, and the live region reads the position
// a gesture really left, even when its last move has not rendered yet.
type Strikes = { k1: number; k2: number };
type State = Strikes & {
  /** False until the visitor moves a strike: until then the spread is ours. */
  touched: boolean;
  /** The strikes the live region last described. */
  said: Strikes;
};
type Move =
  | { t: "to"; h: Handle; v: number } // to a price: a drag, Home / End
  | { t: "near"; v: number } // the nearer strike to a price: a tap
  | { t: "by"; h: Handle; d: number } // by whole strikes: the arrows, the steppers
  | { t: "say" }; // a gesture ended: describe the position it left

const START: State = { k1: 100, k2: 108, touched: false, said: { k1: 100, k2: 108 } };

function reshape(st: State, m: Move): State {
  if (m.t === "say") {
    return st.said.k1 === st.k1 && st.said.k2 === st.k2 ? st : { ...st, said: { k1: st.k1, k2: st.k2 } };
  }
  if (m.t === "near") {
    return reshape(st, { t: "to", h: Math.abs(m.v - st.k1) <= Math.abs(m.v - st.k2) ? "k1" : "k2", v: m.v });
  }
  const n = Math.round(m.t === "to" ? m.v : st[m.h] + m.d);
  const k1 = m.h === "k1" ? clamp(n, K_MIN, st.k2 - GAP) : st.k1;
  const k2 = m.h === "k2" ? clamp(n, st.k1 + GAP, K_MAX) : st.k2;
  // Any move counts as touching it, even one a bound swallowed: the
  // setStrike this replaced did the same.
  return k1 === st.k1 && k2 === st.k2 && st.touched ? st : { ...st, k1, k2, touched: true };
}

export function PayoffInstrument() {
  // "chosen" is only true once the visitor has moved a strike; until then the
  // spread on screen is ours, and the copy says so.
  const [{ k1, k2, touched, said }, dispatch] = useReducer(reshape, START);
  const [dragging, setDragging] = useState<Handle | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const clipId = useId().replace(/:/g, "");
  const s = useMemo(() => spread(k1, k2), [k1, k2]);
  // The live region's sentence: the position as the last gesture left it,
  // never the one under a moving finger.
  const told = useMemo(() => describe(said.k1, said.k2), [said]);

  // The film's safety act draws this position when there is one
  // (lib/hero-position.ts); until a strike moves it is the example spread.
  useEffect(() => {
    setHeroPosition({
      k1,
      k2,
      maxLoss: s.maxLoss,
      maxProfit: s.maxProfit,
      breakeven: s.breakeven,
      chosen: touched,
    });
  }, [k1, k2, s, touched]);

  // Let the live region speak: now (a drag's release, a tap), or once a run of
  // keys or stepper clicks has paused for `after` ms. The Gate A2 tribunal
  // heard the old region re-read its whole sentence on every detent of a drag.
  const settleTimer = useRef<number | undefined>(undefined);
  const settle = (after = 0) => {
    window.clearTimeout(settleTimer.current);
    if (after > 0) settleTimer.current = window.setTimeout(() => dispatch({ t: "say" }), after);
    else dispatch({ t: "say" });
  };
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  const priceAt = (clientX: number) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return null;
    return S_MIN + ((clientX - r.left) / r.width) * (S_MAX - S_MIN);
  };

  const fromPointer = (h: Handle, clientX: number) => {
    const v = priceAt(clientX);
    if (v !== null) dispatch({ t: "to", h, v });
  };

  const release = () => {
    setDragging(null);
    settle();
  };

  // SC 2.5.7's single-pointer path: a tap or a click on the plot moves the
  // NEARER strike to that price, through the same rounding and clamp as a drag.
  // `click`, not pointerdown, so a finger that scrolls the page across the plot
  // never moves a strike: the browser drops the click once a touch turns into
  // a pan. Two clicks are not taps: the one that ends a handle's drag (it can
  // land on the plot when the pointer comes up off the handle), and one that
  // no pointer made (detail 0: a keyboard, or assistive technology).
  const pressedHandle = useRef(false);
  const onPlotPointerDown = (e: React.PointerEvent) => {
    pressedHandle.current = (e.target as Element).closest('[role="slider"]') !== null;
  };
  const onPlotClick = (e: React.MouseEvent) => {
    if (e.detail === 0 || pressedHandle.current) return;
    const v = priceAt(e.clientX);
    if (v === null) return;
    dispatch({ t: "near", v });
    settle();
  };

  const onKey = (h: Handle) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1;
    const move: Move | null =
      e.key === "ArrowLeft" || e.key === "ArrowDown" ? { t: "by", h, d: -step }
        : e.key === "ArrowRight" || e.key === "ArrowUp" ? { t: "by", h, d: step }
          : e.key === "PageDown" ? { t: "by", h, d: -5 }
            : e.key === "PageUp" ? { t: "by", h, d: 5 }
              // The clamp stops K2 at K1 + GAP on Home, and K1 at K2 − GAP on End.
              : e.key === "Home" ? { t: "to", h, v: K_MIN }
                : e.key === "End" ? { t: "to", h, v: K_MAX }
                  : null;
    if (move === null) return;
    e.preventDefault();
    dispatch(move);
    settle(SETTLE_MS);
  };

  const area = `${pts(s.expiry)} ${VW},${ZERO} 0,${ZERO}`;
  const beX = xOf(s.breakeven);
  const beText = `B/E ${s.breakeven.toFixed(2)}`;
  const upside = `only if SIM ends above ${k2} at expiry`;

  // THE B/E LABEL'S HEIGHT (m46). It lifts off the K1 handle when it has to,
  // and never into the "most it can make" block. Worked out in CSS, against
  // the plot's own width in cqw, so the first paint is right at every width
  // before any script runs.
  //   want: --pi-lift once the label's left end (its width in ch plus its
  //     0.45rem gap to the tick) comes within 1.75rem of K1's centre, which is
  //     the handle's half-width plus the site's focus ring; nothing otherwise.
  //     The ×999 makes the clamp a step, not a slide.
  //   room: the space up to that block's bottom edge, which a narrow spread
  //     brings down to the axis; unlimited when the label ends left of the
  //     block (its widest line, 0.65em a character at the coarse-pointer
  //     chrome size, the wider of the two).
  const axis = pct(ZERO, VH);
  const beGap = (((beX - xOf(k1)) / VW) * 100).toFixed(3);
  const beWant = `clamp(0rem, (${beText.length}ch + 2.2rem - ${beGap}cqw) * 999, var(--pi-lift))`;
  const beRoom = `max(0rem, ${axis} - 1.45rem - ${pct(yOf(s.maxProfit), VH)} + 0.6rem, (${(((VW - beX) / VW) * 100).toFixed(3)}cqw + 0.45rem - ${(upside.length * 0.65 * 0.6875).toFixed(3)}rem) * 999)`;

  const handle = (h: Handle, k: number, label: string) => (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={h === "k1" ? K_MIN : k1 + GAP}
      aria-valuemax={h === "k1" ? k2 - GAP : K_MAX}
      aria-valuenow={k}
      // What the strike does, not just where it is: this is what a screen
      // reader says on every step. The upside keeps its condition, in the
      // plot's own words.
      aria-valuetext={
        h === "k1"
          ? `lower strike ${k}, most it can lose ${money(s.maxLoss)}`
          : `upper strike ${k}, most it can make ${money(s.maxProfit)} ${upside}`
      }
      onKeyDown={onKey(h)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        // A key run still waiting to be described is overtaken by this drag;
        // its release describes both.
        window.clearTimeout(settleTimer.current);
        setDragging(h);
      }}
      onPointerMove={(e) => dragging === h && fromPointer(h, e.clientX)}
      onPointerUp={release}
      onPointerCancel={release}
      className="pi-handle group absolute z-20 flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center outline-none"
      style={{ left: pct(xOf(k), VW), top: pct(ZERO, VH) }}
    >
      <span
        aria-hidden
        className="block size-3.5 rotate-45 border border-cyan bg-bg transition-transform duration-200 [transition-timing-function:var(--ease-settle)] group-hover:scale-125 group-focus-visible:scale-125"
        style={{ boxShadow: dragging === h ? "0 0 0 4px color-mix(in srgb, var(--cyan) 25%, transparent)" : undefined }}
      />
      <span aria-hidden className="t-data pointer-events-none absolute top-full mt-0.5 whitespace-nowrap text-[0.6875rem] text-cyan">
        {h === "k1" ? "K1" : "K2"} {k}
      </span>
    </div>
  );

  // The steppers: the drag's other single-pointer path (SC 2.5.7), and the
  // easy one on glass. The arrow keys' bounds and step (Shift for five).
  // size-6 is 26.4px at the site's 110% root, over SC 2.5.8's 24px; 44px on a
  // coarse pointer, matching .tap-floor's min-height. One at its bound stays
  // focusable and says so with aria-disabled: a disabled button would throw
  // the focus of whoever just pressed it back to the top of the document.
  const stepper = (h: Handle, k: number, label: string) => {
    const lo = h === "k1" ? K_MIN : k1 + GAP;
    const hi = h === "k1" ? k2 - GAP : K_MAX;
    const step = (d: -1 | 1, blocked: boolean) => (
      <button
        type="button"
        aria-label={`${label} ${d < 0 ? "down" : "up"}`}
        aria-disabled={blocked || undefined}
        onClick={(e) => {
          if (blocked) return;
          dispatch({ t: "by", h, d: e.shiftKey ? d * 5 : d });
          settle(SETTLE_MS);
        }}
        className={`t-data flex size-6 items-center justify-center border text-sm leading-none pointer-coarse:size-10 ${
          blocked ? "cursor-not-allowed border-border text-fg-faint" : "border-cyan/40 text-cyan hover:border-cyan hover:bg-cyan/10"
        }`}
      >
        <span aria-hidden>{d < 0 ? "−" : "+"}</span>
      </button>
    );
    return (
      <div className="flex items-center gap-2">
        {step(-1, k <= lo)}
        {/* A fixed width, so "K1 99" and "K1 100" leave every button where
            the last press found it (7ch: 6ch for six glyphs wrapped on a
            sub-pixel). */}
        <span className="t-data w-[7ch] whitespace-nowrap text-center text-[0.6875rem] text-cyan">
          {h === "k1" ? "K1" : "K2"} {k}
        </span>
        {step(1, k >= hi)}
      </div>
    );
  };

  return (
    <section
      aria-labelledby="pi-title"
      className="relative overflow-hidden bg-bg py-20 md:py-28"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-40" />

      <div className="shell relative flex flex-col gap-6">
        <span className="inline-flex w-fit items-center gap-2 border border-cyan/40 bg-cyan/5 px-3 py-1 t-chrome text-cyan">
          <span className="size-1.5 rounded-full bg-cyan" /> try it · drag either strike
        </span>

        {/* THE INSTRUMENT. The plot is one box: the SVG stretches to it, the H1
            and the handles are positioned in the same percentages, so the
            headline's baseline and the P&L axis stay one line at every width.
            A tap anywhere on it places the nearer strike (onPlotClick), and it
            is the size container the B/E label measures itself against. */}
        <div
          ref={plotRef}
          onPointerDown={onPlotPointerDown}
          onClick={onPlotClick}
          className="@container relative h-[clamp(15rem,46vh,30rem)] w-full cursor-crosshair select-none"
        >
          <svg
            viewBox={`0 0 ${VW} ${VH}`}
            preserveAspectRatio="none"
            aria-hidden
            className="absolute inset-0 h-full w-full overflow-visible"
          >
            <defs>
              <clipPath id={`${clipId}-up`}><rect x="0" y="0" width={VW} height={ZERO} /></clipPath>
              <clipPath id={`${clipId}-dn`}><rect x="0" y={ZERO} width={VW} height={VH - ZERO} /></clipPath>
            </defs>
            {/* strikes */}
            {[k1, k2].map((k) => (
              <line key={k} x1={xOf(k).toFixed(1)} x2={xOf(k).toFixed(1)} y1="0" y2={VH} stroke="var(--border)" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
            ))}
            {/* profit above the axis, loss below it: the same area, two clips */}
            <polygon points={area} fill="var(--bull)" opacity="0.1" clipPath={`url(#${clipId}-up)`} />
            <polygon points={area} fill="var(--bear)" opacity="0.12" clipPath={`url(#${clipId}-dn)`} />
            {/* the P&L zero axis — the H1 stands on it */}
            <line x1="0" x2={VW} y1={ZERO} y2={ZERO} stroke="var(--fg-faint)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            {/* today, with the time value still in it */}
            <polyline points={pts(s.today)} fill="none" stroke="var(--fg-dim)" strokeWidth="1.25" strokeDasharray="5 6" vectorEffect="non-scaling-stroke" />
            {/* at expiry: green above zero, red below */}
            <polyline points={pts(s.expiry)} fill="none" stroke="var(--bull)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" clipPath={`url(#${clipId}-up)`} />
            <polyline points={pts(s.expiry)} fill="none" stroke="var(--bear)" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" clipPath={`url(#${clipId}-dn)`} />
            {/* breakeven */}
            <line x1={beX.toFixed(1)} x2={beX.toFixed(1)} y1={ZERO - 10} y2={ZERO + 10} stroke="var(--fg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>

          {/* The headline's second line sits ON the zero axis: the baseline of
              "See it." is the line where the position stops losing and starts
              making, and the red floor sits just under it. */}
          <h2
            id="pi-title"
            className="wonk-type pointer-events-none absolute left-0 z-10 font-display text-fg"
            style={{
              bottom: pct(VH - ZERO, VH),
              fontSize: "clamp(2.75rem, 6.2vw, 6rem)",
              lineHeight: 0.92,
              letterSpacing: "-0.02em",
              transform: "translateY(0.19em)",
            }}
          >
            {/* Short on purpose: the headline has to stay left of the
                strikes, where the curve rises, at every width. */}
            Drag it.
            <br />
            See <span className="t-accent">it</span>.
          </h2>

          {handle("k1", k1, "Lower strike")}
          {handle("k2", k2, "Upper strike")}

          <span
            aria-hidden
            // Right-aligned to the LEFT of the tick: the curve crosses the axis
            // exactly at the breakeven, and the space above the loss segment is
            // the one patch near it that the curve never enters.
            //
            // Unless the K1 handle stands in it (m46: on a phone, and on a
            // desktop at the default spread, "B/E" sat on the diamond and the
            // focus ring cut through it). Then it lifts (beWant, beRoom above)
            // by --pi-lift: 1.2rem from md, clear of the handle, ring and all;
            // 0.9rem on a phone, where "Drag it." stands only 41px above the
            // axis and a 1.2rem lift ran into its "it." (measured 2026-11-06:
            // 0.9rem leaves 2px to the headline and clears the diamond, its
            // drag glow and its cyan ring; under keyboard focus the tail of
            // the "/" grazes the site-wide focus box, the one thing a 12px slot
            // cannot fit).
            className="t-data pointer-events-none absolute z-10 whitespace-nowrap text-[0.6875rem] text-fg-dim transition-[top] duration-300 [--pi-lift:0.9rem] [transition-timing-function:var(--ease-settle)] motion-reduce:transition-none md:[--pi-lift:1.2rem]"
            style={{
              right: `calc(${pct(VW - beX, VW)} + 0.45rem)`,
              top: `calc(${axis} - 1.45rem - min(${beWant}, ${beRoom}))`,
            }}
          >
            {beText}
          </span>

          {/* The two figures the decision turns on, loss first: it is the
              number that is certain, so it gets the colour and the weight. The
              upside is conditional and is drawn neutral, with its condition. */}
          <div
            className="pointer-events-none absolute left-0 z-10 flex flex-col"
            style={{ top: `calc(${pct(yOf(-s.maxLoss), VH)} + 0.6rem)` }}
          >
            <span className="t-figure text-bear">−{money(s.maxLoss)}</span>
            <span className="t-chrome text-fg-dim">
              most it can lose · {touched ? "you set it before the trade" : "an example spread"}
            </span>
          </div>
          <div
            className="pointer-events-none absolute right-0 z-10 flex flex-col items-end text-right"
            style={{ bottom: `calc(${pct(VH - yOf(s.maxProfit), VH)} + 0.6rem)` }}
          >
            <span className="t-chrome text-fg-faint">most it can make</span>
            <span className="t-data text-lg text-fg-dim">+{money(s.maxProfit)}</span>
            <span className="t-chrome text-fg-faint">{upside}</span>
          </div>
        </div>

        {/* The legend, and the steppers beside it from md (under it on a
            phone). Not straight under the plot: a deep enough loss hangs the
            "most it can lose" figure below the plot's floor, and it must never
            land on a control. It lands on the legend, as it always did. */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-10">
          <p className="t-chrome flex flex-wrap gap-x-3 gap-y-1 text-fg-faint">
            <span className="text-fg-dim">illustrative · paper-only</span>
            <span>bull call spread on SIM, a synthetic index at {SPOT}</span>
            <span>{DAYS} days · IV {Math.round(IV * 100)}% · Black-Scholes</span>
            <span>solid: at expiry · dashed: today</span>
          </p>
          <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3">
            {stepper("k1", k1, "Lower strike")}
            {stepper("k2", k2, "Upper strike")}
          </div>
        </div>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {told}
        </p>

        <div className="mt-1 flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-10">
          <p className="max-w-xl font-mono text-sm leading-relaxed text-fg-dim md:text-base">
            Drag either strike and the payoff, the breakeven and the most it can
            lose redraw as you move. The builder does the same for any position,
            with the Greeks and an AI teacher explaining it in plain English.
          </p>
          <Link
            href="/trade"
            className="group inline-flex shrink-0 items-center gap-2 py-2 font-mono text-sm uppercase tracking-wider text-brand-ink underline decoration-brand-ink/40 underline-offset-4 transition-[color,text-decoration-color] duration-300 [transition-timing-function:var(--ease-settle)] hover:text-fg hover:decoration-fg"
          >
            open the strategy builder
            <span aria-hidden className="transition-transform duration-300 [transition-timing-function:var(--ease-settle)] group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </div>

      <style>{`
        .pi-handle:focus-visible > span:first-child { outline: 2px solid var(--cyan); outline-offset: 4px; }
      `}</style>
    </section>
  );
}

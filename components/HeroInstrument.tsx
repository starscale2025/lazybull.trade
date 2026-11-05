"use client";

/**
 * FRAME ZERO — the hero is the instrument.
 *
 * The 2026-11 tribunal (five seats, 43/100) found the site's one belief, "make
 * options visible", whispered in a 16px footer line, while the first thing a
 * visitor met was a consent wall, a scroll-locked loader and an empty laptop,
 * with the H1 13,500px away. Four of five seats asked for the same fix
 * independently: make the first frame the thing the product does.
 *
 * So the H1 sits on the P&L zero axis of a real position: a bull call spread on
 * a synthetic underlying, priced by the same Black-Scholes engine as /trade
 * (lib/pricing). Drag either strike and the payoff, the breakeven, the most it
 * can lose and the most it can make redraw. Nothing here names a real security
 * or a target, and the frame says ILLUSTRATIVE · PAPER-ONLY in its own chrome.
 *
 * Two curves, because the gap between them is the lesson: the solid line is the
 * position at expiry, the dashed one is what it is worth today with the time
 * value still in it.
 *
 * It is server-rendered and it is the LCP. The film sits UNDER it (see
 * CinemaGate): this section is opaque and stacked above the film's pinned
 * stage, so scrolling lifts it off the film like a curtain, and when the film
 * collapses this is the top of the page again.
 *
 * HYDRATION: every coordinate and figure is rounded before it reaches the DOM.
 * Black-Scholes runs Math.log/Math.exp, which are not specified to the last ULP,
 * so Node and the browser can disagree in the final digits (the 2026-11
 * sparkline mismatch on /trade was exactly this).
 */

import Link from "next/link";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { MagneticCTA } from "./atmosphere/MagneticCTA";
import { payoff, priceOption, type Leg } from "@/lib/pricing";

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

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const xOf = (s: number) => ((s - S_MIN) / (S_MAX - S_MIN)) * VW;
const yOf = (pnl: number) => clamp(ZERO - pnl * SCALE, 6, VH - 6);
const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
const pts = (a: Array<[number, number]>) => a.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const money = (v: number) => `$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;

const call = (s: number, k: number, t = T) => priceOption(s, k, t, RATE, IV, "C").price;

function spread(k1: number, k2: number) {
  const c1 = call(SPOT, k1);
  const c2 = call(SPOT, k2);
  const debit = c1 - c2;
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
  return {
    maxLoss: debit * 100,
    maxProfit: (k2 - k1 - debit) * 100,
    breakeven: k1 + debit,
    expiry,
    today,
  };
}

type Handle = "k1" | "k2";

export function HeroInstrument() {
  const { status: authStatus } = useSession();
  const [k1, setK1] = useState(100);
  const [k2, setK2] = useState(108);
  const [dragging, setDragging] = useState<Handle | null>(null);
  // "chosen" is only true once the visitor has moved a strike; until then the
  // spread on screen is ours, and the copy says so.
  const [touched, setTouched] = useState(false);
  const plotRef = useRef<HTMLDivElement>(null);
  const clipId = useId().replace(/:/g, "");
  const s = useMemo(() => spread(k1, k2), [k1, k2]);

  const setStrike = useCallback((h: Handle, v: number) => {
    const n = Math.round(v);
    setTouched(true);
    if (h === "k1") setK1(clamp(n, K_MIN, k2 - GAP));
    else setK2(clamp(n, k1 + GAP, K_MAX));
  }, [k1, k2]);

  const fromPointer = (h: Handle, clientX: number) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setStrike(h, S_MIN + ((clientX - r.left) / r.width) * (S_MAX - S_MIN));
  };

  const onKey = (h: Handle) => (e: React.KeyboardEvent) => {
    const cur = h === "k1" ? k1 : k2;
    const step = e.shiftKey ? 5 : 1;
    const next =
      e.key === "ArrowLeft" || e.key === "ArrowDown" ? cur - step
        : e.key === "ArrowRight" || e.key === "ArrowUp" ? cur + step
          : e.key === "PageDown" ? cur - 5
            : e.key === "PageUp" ? cur + 5
              : e.key === "Home" ? (h === "k1" ? K_MIN : k1 + GAP)
                : e.key === "End" ? (h === "k1" ? k2 - GAP : K_MAX)
                  : null;
    if (next === null) return;
    e.preventDefault();
    setStrike(h, next);
  };

  const area = `${pts(s.expiry)} ${VW},${ZERO} 0,${ZERO}`;
  const beX = xOf(s.breakeven);

  const handle = (h: Handle, k: number, label: string) => (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={h === "k1" ? K_MIN : k1 + GAP}
      aria-valuemax={h === "k1" ? k2 - GAP : K_MAX}
      aria-valuenow={k}
      aria-valuetext={`${label} ${k}`}
      onKeyDown={onKey(h)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(h);
      }}
      onPointerMove={(e) => dragging === h && fromPointer(h, e.clientX)}
      onPointerUp={() => setDragging(null)}
      onPointerCancel={() => setDragging(null)}
      className="fz-handle group absolute z-20 flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center outline-none"
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

  return (
    <section
      data-frame-zero
      aria-labelledby="fz-title"
      className="relative z-30 flex min-h-screen flex-col justify-center overflow-hidden bg-bg pb-12 pt-8"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid opacity-40" />

      <div className="shell relative flex flex-col gap-6">
        <span className="inline-flex w-fit items-center gap-2 border border-bull/40 bg-bull/5 px-3 py-1 t-chrome text-bull">
          <span className="size-1.5 rounded-full bg-bull" /> paper-only · $0 at risk, ever
        </span>

        {/* THE INSTRUMENT. The plot is one box: the SVG stretches to it, the H1
            and the handles are positioned in the same percentages, so the
            headline's baseline and the P&L axis stay one line at every width. */}
        <div ref={plotRef} className="relative h-[clamp(15rem,46vh,30rem)] w-full select-none">
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

          {/* The H1. Its second line sits ON the zero axis: the baseline of
              "see." is the line where the position stops losing and starts
              making, and the red floor sits just under the word. */}
          <h1
            id="fz-title"
            className="wonk-type pointer-events-none absolute left-0 z-10 font-display text-fg"
            style={{
              bottom: pct(VH - ZERO, VH),
              fontSize: "clamp(2.75rem, 6.2vw, 6rem)",
              lineHeight: 0.92,
              letterSpacing: "-0.02em",
              transform: "translateY(0.19em)",
            }}
          >
            {/* Three short lines on a phone, two on desktop: the headline has
                to stay left of the strikes, where the curve rises. */}
            Options<br className="md:hidden" /> you can
            <br />
            <span className="t-accent">see</span>.
          </h1>

          {handle("k1", k1, "Lower strike")}
          {handle("k2", k2, "Upper strike")}

          <span
            aria-hidden
            // Right-aligned to the LEFT of the tick: the curve crosses the axis
            // exactly at the breakeven, and the space above the loss segment is
            // the one patch near it that the curve never enters.
            className="t-data pointer-events-none absolute z-10 whitespace-nowrap text-[0.6875rem] text-fg-dim"
            style={{ right: `calc(${pct(VW - beX, VW)} + 0.45rem)`, top: `calc(${pct(ZERO, VH)} - 1.45rem)` }}
          >
            B/E {s.breakeven.toFixed(2)}
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
            <span className="t-chrome text-fg-faint">only if SIM ends above {k2} at expiry</span>
          </div>
        </div>

        <p className="t-chrome flex flex-wrap gap-x-3 gap-y-1 text-fg-faint">
          <span className="text-fg-dim">illustrative · paper-only</span>
          <span>bull call spread on SIM, a synthetic index at {SPOT}</span>
          <span>{DAYS} days · IV {Math.round(IV * 100)}% · Black-Scholes</span>
          <span>solid: at expiry · dashed: today</span>
        </p>
        <p className="sr-only" aria-live="polite">
          {`Lower strike ${k1}, upper strike ${k2}. The most this position can lose is ${money(s.maxLoss)}. It makes up to ${money(s.maxProfit)} only if SIM ends above ${k2} at expiry, and breaks even at ${s.breakeven.toFixed(2)}.`}
        </p>

        <div className="mt-1 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end md:gap-8">
          <div className="flex max-w-xl flex-col gap-3">
            <p className="font-mono text-sm leading-relaxed text-fg-dim md:text-base">
              Drag two strikes and the payoff, the Greeks and the worst case draw
              themselves, with an AI teacher explaining the position in plain
              English. Then paper-trade it — nothing real at risk, ever.
            </p>
            {/* The problem, once, in the smallest voice. Quoted from SEBI's
                study of 20 Aug 2026 (FY26), linked, and never paired with an
                implied fix: it is the reason the product is paper-only. */}
            <p className="text-balance font-mono text-[0.6875rem] leading-relaxed text-fg-faint">
              87.7% of India&apos;s individual F&amp;O traders lost money in FY26 — 89% of
              those under 30.{" "}
              <a
                href="https://www.sebi.gov.in/reports-and-statistics/research/aug-2026/study-profitability-of-individual-traders-in-the-equity-derivatives-segment-fy25-fy26-_103835.html"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-fg-faint/50 underline-offset-2 transition-colors hover:text-fg-dim"
              >
                Source: SEBI, August 2026
              </a>
              .
            </p>
          </div>
          {/* On a phone the action comes straight after the instrument, so
              the H1 and the CTA share the first screen. */}
          <div className="order-first flex flex-col items-start gap-3 md:order-none md:items-end">
            <div className="flex flex-wrap items-center gap-6">
              <MagneticCTA>
                <Link
                  href="/trade"
                  className="fz-cta btn-primary-glass group relative inline-flex items-center gap-2 px-9 py-4 font-mono text-sm font-bold uppercase tracking-wider"
                >
                  <span className="relative z-10">{authStatus === "authenticated" ? "Open the builder" : "Get started"}</span>
                  <span className="relative z-10 transition-transform duration-300 [transition-timing-function:var(--ease-settle)] group-hover:translate-x-1" aria-hidden>→</span>
                </Link>
              </MagneticCTA>
              <Link
                href={authStatus === "authenticated" ? "/portfolio" : "/auth/signin"}
                className="inline-flex items-center py-3 font-mono text-sm uppercase tracking-wider text-fg-dim underline decoration-fg-faint/40 underline-offset-4 transition-[color,text-decoration-color] duration-300 [transition-timing-function:var(--ease-settle)] hover:text-fg hover:decoration-bull"
              >
                {authStatus === "authenticated" ? "your portfolio →" : "or sign in"}
              </Link>
            </div>
            <span aria-hidden className="t-chrome text-fg-faint">scroll to watch the film ↓</span>
          </div>
        </div>
      </div>

      <style>{`
        /* The primary key's seat, moved here with the hero from GetStarted:
           one hairline ring at the border over pooled layers that all carry a
           NEGATIVE spread, so nothing unblurred crosses the edge. */
        .fz-cta {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.25),
            inset 0 -1px 0 rgba(4,20,11,0.22),
            0 0 0 1px color-mix(in srgb, var(--bull) 38%, transparent),
            0 10px 26px -12px color-mix(in srgb, var(--bull) 62%, transparent),
            0 22px 60px -28px color-mix(in srgb, var(--bull) 52%, transparent);
        }
        .fz-cta:hover {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.3),
            inset 0 -1px 0 rgba(4,20,11,0.22),
            0 0 0 1px color-mix(in srgb, var(--bull) 66%, transparent),
            0 14px 34px -14px color-mix(in srgb, var(--bull) 78%, transparent),
            0 24px 62px -30px color-mix(in srgb, var(--bull) 55%, transparent);
        }
        .fz-cta:active {
          box-shadow:
            inset 0 2px 5px -2px rgba(4,20,11,0.38),
            inset 0 1px 0 rgba(255,255,255,0.14),
            0 0 0 1px color-mix(in srgb, var(--bull) 55%, transparent),
            0 4px 14px -10px color-mix(in srgb, var(--bull) 60%, transparent);
        }
        .fz-handle:focus-visible > span:first-child { outline: 2px solid var(--cyan); outline-offset: 4px; }
      `}</style>
    </section>
  );
}

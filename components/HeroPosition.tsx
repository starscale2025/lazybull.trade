"use client";

/**
 * THE POSITION UNDER THE HEADLINE (Phase 3, M12 as the Gate A3 chief rewrote
 * it: "the matter becomes the position").
 *
 * Frame zero lost its option when the instrument moved down the page: the
 * first screen showed a sphere and a promise, and nothing to touch. This puts
 * the position back under "Options you can see.", small and quiet: the
 * example bull call spread on its $0 axis, the floor you lose at most, the
 * breakeven, the capped upside, and the two strikes as handles. Move one and
 * the spread is yours: it publishes to lib/hero-position.ts, so the film's
 * safety act ("a number you chose"), the landing's instrument and the Island
 * all carry it before the film has even started.
 *
 * The same single-pointer and keyboard model as the instrument (WCAG 2.5.7):
 * a drag, a tap that moves the nearer strike, or a focused handle's arrows
 * (Shift for 5, Home / End). Each handle speaks the consequence, not just the
 * number.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getHeroPosition, onHeroPosition, setHeroPosition } from "@/lib/hero-position";
import { K_MAX, K_MIN, S_MAX, S_MIN, START_STRIKES, figures, money, placeStrike } from "@/lib/hero-spread";

type Handle = "k1" | "k2";

// The strip's own geometry, in viewBox units: a wide, low plot.
const W = 600;
const H = 96;
const Y0 = 50; // the $0 axis
const REACH = 38; // the larger of the floor and the cap is drawn this far off the axis

export function HeroPosition() {
  const [k, setK] = useState<{ k1: number; k2: number }>({ ...START_STRIKES });
  const [touched, setTouched] = useState(false);
  const kRef = useRef(k);
  kRef.current = k;
  const plotRef = useRef<HTMLDivElement>(null);
  const f = useMemo(() => figures(k.k1, k.k2), [k]);
  const clip = useId().replace(/:/g, "");

  // The visitor's spread, once they have moved a strike, is THE spread.
  useEffect(() => {
    if (!touched) return;
    setHeroPosition({ k1: k.k1, k2: k.k2, maxLoss: f.maxLoss, maxProfit: f.maxProfit, breakeven: f.breakeven, chosen: true });
  }, [touched, k, f]);

  // And one set on the instrument further down is this one too.
  useEffect(() => {
    const take = () => {
      const p = getHeroPosition();
      if (!p?.chosen) return;
      setTouched(true);
      if (p.k1 !== kRef.current.k1 || p.k2 !== kRef.current.k2) setK({ k1: p.k1, k2: p.k2 });
    };
    take();
    return onHeroPosition(take);
  }, []);

  const move = (h: Handle, v: number) => {
    setK((cur) => placeStrike(cur, h, v));
    setTouched(true);
  };

  const xOf = (s: number) => ((s - S_MIN) / (S_MAX - S_MIN)) * W;
  const scale = REACH / Math.max(f.maxLoss, f.maxProfit, 1);
  const yOf = (pnl: number) => Y0 - pnl * scale;
  const line = [
    [0, yOf(-f.maxLoss)],
    [xOf(k.k1), yOf(-f.maxLoss)],
    [xOf(k.k2), yOf(f.maxProfit)],
    [W, yOf(f.maxProfit)],
  ]
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const pct = (x: number) => `${((x / W) * 100).toFixed(3)}%`;

  const priceAt = (clientX: number) => {
    const r = plotRef.current?.getBoundingClientRect();
    if (!r || !r.width) return null;
    return S_MIN + ((clientX - r.left) / r.width) * (S_MAX - S_MIN);
  };

  const dragging = useRef<Handle | null>(null);
  const onHandleDown = (h: Handle) => (e: React.PointerEvent) => {
    dragging.current = h;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    const h = dragging.current;
    if (!h) return;
    const v = priceAt(e.clientX);
    if (v !== null) move(h, v);
  };
  const onHandleUp = () => {
    dragging.current = null;
  };
  // A tap on the strip moves the nearer strike (not one that ends a drag, and
  // not one no pointer made).
  const onStripClick = (e: React.MouseEvent) => {
    if (e.detail === 0 || (e.target as Element).closest('[role="slider"]')) return;
    const v = priceAt(e.clientX);
    if (v === null) return;
    move(Math.abs(v - k.k1) <= Math.abs(v - k.k2) ? "k1" : "k2", v);
  };
  const onKey = (h: Handle) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1;
    const to =
      e.key === "ArrowLeft" || e.key === "ArrowDown" ? k[h] - step
        : e.key === "ArrowRight" || e.key === "ArrowUp" ? k[h] + step
          : e.key === "PageDown" ? k[h] - 5
            : e.key === "PageUp" ? k[h] + 5
              : e.key === "Home" ? K_MIN
                : e.key === "End" ? K_MAX
                  : null;
    if (to === null) return;
    e.preventDefault();
    move(h, to);
  };

  const handle = (h: Handle) => {
    const v = k[h];
    const text =
      h === "k1"
        ? `lower strike ${v}, most it can lose ${money(f.maxLoss)}`
        : `upper strike ${v}, most it can make ${money(f.maxProfit)}, only if SIM ends above ${v} at expiry`;
    return (
      <button
        type="button"
        role="slider"
        aria-label={h === "k1" ? "Lower strike" : "Upper strike"}
        aria-valuemin={K_MIN}
        aria-valuemax={K_MAX}
        aria-valuenow={v}
        aria-valuetext={text}
        onPointerDown={onHandleDown(h)}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        onKeyDown={onKey(h)}
        className="hp-handle absolute top-0 flex h-full w-8 -translate-x-1/2 touch-none cursor-ew-resize items-start justify-center outline-none"
        style={{ left: pct(xOf(v)) }}
      >
        {/* On the $0 axis: `top` is a share of the strip's height (a margin's
            percentage would be a share of its width). */}
        <span
          aria-hidden
          className="absolute block size-2.5 rotate-45 border border-cyan bg-bg transition-[scale] duration-200 [transition-timing-function:var(--ease-settle)]"
          style={{ top: `calc(${((Y0 / H) * 100).toFixed(3)}% - 5px)` }}
        />
        <span aria-hidden className="absolute bottom-0 t-data text-[0.6875rem] text-cyan">
          {v}
        </span>
      </button>
    );
  };

  return (
    <div
      role="group"
      aria-label="An example position: a bull call spread on SIM, a synthetic index at 100. Move either strike to make it yours."
      className="matter-in mt-4 w-full max-w-[36rem] [animation-delay:120ms]"
    >
      <div ref={plotRef} onClick={onStripClick} className="relative w-full touch-pan-y" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg aria-hidden viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <clipPath id={`${clip}-up`}>
              <rect x="0" y="0" width={W} height={Y0} />
            </clipPath>
            <clipPath id={`${clip}-dn`}>
              <rect x="0" y={Y0} width={W} height={H - Y0} />
            </clipPath>
          </defs>
          <line x1="0" y1={Y0} x2={W} y2={Y0} stroke="var(--fg-faint)" strokeOpacity="0.35" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <polyline points={line} fill="none" stroke="var(--bear)" strokeWidth="1.75" clipPath={`url(#${clip}-dn)`} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <polyline points={line} fill="none" stroke="var(--bull)" strokeWidth="1.75" clipPath={`url(#${clip}-up)`} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          <line x1={xOf(f.breakeven)} y1={Y0 - 4} x2={xOf(f.breakeven)} y2={Y0 + 4} stroke="var(--fg-dim)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </svg>
        {handle("k1")}
        {handle("k2")}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-4 text-[0.75rem] leading-tight">
        <span className="text-left text-fg-faint">
          <span className="t-data text-bear">−{money(f.maxLoss)}</span> most it can lose ·{" "}
          {touched ? "you set it before the trade" : "an example, move a strike"}
        </span>
        <span className="hidden text-right text-fg-faint sm:inline">
          B/E <span className="t-data">{f.breakeven.toFixed(2)}</span> ·{" "}
          <span className="t-data text-fg-dim">+{money(f.maxProfit)}</span> only above {k.k2} at expiry
        </span>
      </div>
    </div>
  );
}

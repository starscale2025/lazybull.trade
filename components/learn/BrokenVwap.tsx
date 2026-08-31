"use client";

// The live cell of "Anatomy of a Broken VWAP". One tape, two lines:
// BROKEN — the bug we shipped, reproduced verbatim (vwapBroken), which
//          degenerates into per-bar typical price;
// FIXED  — the REAL `vwap` from components/pro/indicators, the exact module
//          rendering on /pro right now. Not a copy. That's the point.
//
// The toggle tweens the drawn line between the two series (house quint,
// ~500ms) so the fix physically SNAPS into place. The tween writes the path
// `d` imperatively via refs on the shared ambient clock — zero React renders
// per frame, per the Phase-4 durability rules. Reduced motion snaps.

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { vwap } from "@/components/pro/indicators";
import { subscribeFrame } from "@/lib/ambient-clock";
import { makeLessonTape, vwapBroken } from "./broken-vwap-math";

const W = 760;
const H = 300;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 26;
const quint = (t: number) => 1 - Math.pow(1 - t, 5);

export function BrokenVwap() {
  const [mode, setMode] = useState<"broken" | "fixed">("broken");
  const pathRef = useRef<SVGPathElement>(null);
  const displayRef = useRef<number[] | null>(null);

  const { bars, broken, fixed, geom } = useMemo(() => {
    const bars = makeLessonTape();
    const broken = vwapBroken(bars).map((v) => v ?? 0);
    const fixed = vwap(bars).map((v) => v ?? 0);
    let lo = Infinity;
    let hi = -Infinity;
    for (const b of bars) {
      if (b.l < lo) lo = b.l;
      if (b.h > hi) hi = b.h;
    }
    const span = hi - lo || 1;
    const x = (i: number) => PAD_L + (i / (bars.length - 1)) * (W - PAD_L - PAD_R);
    const y = (p: number) => PAD_T + (1 - (p - lo) / span) * (H - PAD_T - PAD_B);
    return { bars, broken, fixed, geom: { lo, hi, x, y } };
  }, []);

  const toPath = (series: number[]) =>
    series.map((v, i) => `${i ? "L" : "M"}${geom.x(i).toFixed(1)} ${geom.y(v).toFixed(1)}`).join("");

  // Tween the displayed series toward the selected one. useLayoutEffect so
  // the from-state lands BEFORE paint — React's re-render writes the target
  // `d`, and without the pre-paint reset the line would flash at its
  // destination for one frame before tweening from the start.
  useLayoutEffect(() => {
    const target = mode === "broken" ? broken : fixed;
    const node = pathRef.current;
    if (!node) return;
    const from = displayRef.current ?? target;
    displayRef.current = target;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from === target) {
      node.setAttribute("d", toPath(target));
      return;
    }
    node.setAttribute("d", toPath(from));
    let start = 0;
    const unsub = subscribeFrame((now) => {
      if (!start) start = now;
      const k = quint(Math.min(1, (now - start) / 500));
      const mixed = target.map((v, i) => from[i] + (v - from[i]) * k);
      node.setAttribute("d", toPath(mixed));
      if (k >= 1) unsub();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, broken, fixed]);

  // Facts for the caption, computed once from the same series the SVG draws.
  const day1Close = 77; // last bar of session 1
  const gapAtClose = Math.abs(fixed[day1Close] - broken[day1Close]);
  const sessionX = geom.x(78) - (geom.x(78) - geom.x(77)) / 2;

  return (
    <figure className="surface-card border border-border bg-surface/60">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.25em] text-fg-faint">
          exhibit a · two sessions · 5-min bars · same tape
        </span>
        <div className="flex" role="group" aria-label="Choose which VWAP to draw">
          <button
            onClick={() => setMode("broken")}
            aria-pressed={mode === "broken"}
            className={`h-7 border px-3 font-mono text-[0.625rem] font-semibold uppercase tracking-wider transition-colors ${
              mode === "broken"
                ? "border-bear/60 bg-bear/15 text-bear"
                : "border-border bg-bg text-fg-dim hover:text-fg"
            }`}
          >
            broken
          </button>
          <button
            onClick={() => setMode("fixed")}
            aria-pressed={mode === "fixed"}
            className={`-ml-px h-7 border px-3 font-mono text-[0.625rem] font-semibold uppercase tracking-wider transition-colors ${
              mode === "fixed"
                ? "border-bull/60 bg-bull/15 text-bull"
                : "border-border bg-bg text-fg-dim hover:text-fg"
            }`}
          >
            fixed
          </button>
        </div>
      </figcaption>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full min-w-[35rem]"
          role="img"
          aria-label={
            mode === "broken"
              ? "Broken VWAP: the line hugs every candle because it is just each bar's typical price."
              : "Fixed VWAP: a session-anchored line that hangs below the afternoon rally, weighted by morning volume."
          }
        >
          {/* price gridlines */}
          {[0.25, 0.5, 0.75].map((f) => {
            const p = geom.lo + (geom.hi - geom.lo) * f;
            return (
              <g key={f}>
                <line x1={PAD_L} x2={W - PAD_R} y1={geom.y(p)} y2={geom.y(p)} stroke="var(--border)" strokeDasharray="2 4" />
                <text x={PAD_L - 6} y={geom.y(p) + 3} textAnchor="end" fontSize="9" fill="var(--fg-faint)" fontFamily="var(--font-mono)">
                  {p.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* session boundary */}
          <line x1={sessionX} x2={sessionX} y1={PAD_T} y2={H - PAD_B} stroke="var(--fg-faint)" strokeDasharray="3 5" opacity="0.6" />
          <text x={sessionX + 5} y={PAD_T + 9} fontSize="9" fill="var(--fg-faint)" fontFamily="var(--font-mono)">
            DAY 2 OPENS — the anchor must reset here
          </text>

          {/* candles — deliberately faint; the star witness is the line */}
          {bars.map((b, i) => {
            const cx = geom.x(i);
            const up = b.c >= b.o;
            const col = up ? "var(--bull)" : "var(--bear)";
            return (
              <g key={i} opacity="0.45">
                <line x1={cx} x2={cx} y1={geom.y(b.h)} y2={geom.y(b.l)} stroke={col} strokeWidth="1" />
                <line x1={cx} x2={cx} y1={geom.y(b.o)} y2={geom.y(b.c)} stroke={col} strokeWidth="2.6" />
              </g>
            );
          })}

          {/* THE line */}
          <path
            ref={pathRef}
            d={toPath(mode === "broken" ? broken : fixed)}
            fill="none"
            stroke={mode === "broken" ? "var(--bear)" : "var(--bull)"}
            strokeWidth="2"
            style={{ transition: "stroke 300ms" }}
          />

          {/* day labels */}
          <text x={geom.x(38)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--fg-faint)" fontFamily="var(--font-mono)">
            MON · SESSION 1
          </text>
          <text x={geom.x(116)} y={H - 8} textAnchor="middle" fontSize="9" fill="var(--fg-faint)" fontFamily="var(--font-mono)">
            TUE · SESSION 2
          </text>
        </svg>
      </div>

      <div className="border-t border-border px-3 py-2.5 font-mono text-[0.6875rem] leading-relaxed text-fg-dim" aria-live="polite">
        {mode === "broken" ? (
          <>
            <span className="font-semibold text-bear">BROKEN — </span>
            the line hugs every candle, because it IS every candle: with the anchor resetting each
            bar, Σ(tp·v)/Σv collapses to (H+L+C)/3 of that bar alone. It looks plausible. It teaches
            nothing. By the day-1 close it sits{" "}
            <span className="text-fg">${gapAtClose.toFixed(2)}</span> from the true VWAP.
          </>
        ) : (
          <>
            <span className="font-semibold text-bull">FIXED — </span>
            anchored at the session open, the line hangs below the afternoon price because the
            morning's heavy volume traded lower — that gap is the actual information VWAP carries.
            And at DAY 2 it resets exactly once, on the real session boundary. This is the same{" "}
            <code className="text-fg">vwap()</code> drawing on /pro right now.
          </>
        )}
      </div>
    </figure>
  );
}

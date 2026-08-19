"use client";

// CHAPTER NAV (/learn redesign L4) — one navigator to replace the pile. It
// supersedes SectionIndex's 14 anonymous ticks with NAMED chapters + jump,
// folds in the top scroll bar and the LIVE pill, and draws the learning
// progress as a little equity curve that climbs as you call your shots.
//
// Left gutter on lg+; on mobile it collapses to a single thin top progress
// bar. Active chapter and scroll fraction come from one passive scroll read
// (nearest-center) — no IntersectionObserver (frozen while hidden) and no
// rAF loop.
//
// GEOMETRY CONTRACT — this rail is `position: fixed`, so it is NOT in flow and
// nothing reflows around it. It occupies left 0.75rem → 0.75rem + 172px, i.e.
// a RIGHT EDGE AT 184px, at every viewport ≥ lg (1024px). The page measure is
// centred, so it only cleared this rail above ~1770px and the flush-left
// SplitDesk column never cleared it at all — the rail sat on top of live copy.
// The column is therefore RESERVED, not hoped for, by the consumers:
//   · centred .shell containers in app/learn/page.tsx carry
//     lg:pl-[max(1.25rem,13rem - max(0px,(100vw - 1400px)/2))] — 208px of
//     content-left while the natural centring is short, decaying back to the
//     plain 1.25rem gutter once the viewport is wide enough (≥1776px).
//   · the flush-left SplitDesk sections carry a flat lg:pl-[13rem].
//   · TickerStrip widens its left edge-fade to 15rem at lg+.
// 13rem = 208px = 184px + a 24px gutter. If you change `left-3` or `w-[172px]`
// here, change those three call sites in the same commit.

import { useEffect, useState } from "react";
import { LEARN_CHAPTERS, CONCEPT_IDS, useLearnProgress } from "@/lib/learn-progress";

const CONCEPT_SET = new Set<string>(CONCEPT_IDS);

export function ChapterNav() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const { predicts, answeredCount, correctCount, total } = useLearnProgress();

  useEffect(() => {
    const onScroll = () => {
      const mid = window.innerHeight / 2;
      let best = 0;
      let bd = Infinity;
      LEARN_CHAPTERS.forEach((c, i) => {
        const el = document.getElementById(c.id);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < bd) {
          bd = d;
          best = i;
        }
      });
      setActive((a) => (a === best ? a : best));
      const h = document.documentElement;
      setProgress(h.scrollTop / (h.scrollHeight - h.clientHeight || 1));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });

  // equity curve over the 8 concepts — correct +1.4, answered +0.6.
  let cum = 0;
  const maxY = total * 1.4;
  const pts = CONCEPT_IDS.map((id, i) => {
    const p = predicts[id];
    if (p) cum += p.correct ? 1.4 : 0.6;
    return { x: (i / (total - 1)) * 100, y: 34 - (cum / maxY) * 30, on: !!p };
  });
  const earned = pts.filter((p) => p.on);
  const curveD = earned.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  return (
    <>
      {/* mobile: one thin progress bar (folds ScrollProgressBar) */}
      <div
        className="fixed left-0 top-0 z-[60] h-0.5 bg-bull transition-[width] duration-150 lg:hidden"
        style={{ width: `${(progress * 100).toFixed(1)}%` }}
        aria-hidden
      />

      {/* desktop: the named gutter */}
      <nav
        aria-label="Chapters"
        className="fixed left-3 top-1/2 z-40 hidden w-[172px] -translate-y-1/2 lg:block"
      >
        <div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-fg-faint">
          <span className="size-1 rounded-full bg-bull pulse-dot" />
          <span className="text-bull">live</span>
          <span>· learn</span>
        </div>

        {/* equity curve of concepts unlocked */}
        <svg viewBox="0 0 100 40" className="mb-1 h-9 w-full" aria-hidden preserveAspectRatio="none">
          <line x1="0" y1="34" x2="100" y2="34" stroke="var(--border)" strokeWidth="0.5" />
          {earned.length > 0 && (
            <path d={curveD} fill="none" stroke="var(--bull)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          )}
          {earned.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="1.6" fill="var(--bull)" />
          ))}
        </svg>
        <div className="mb-3 font-mono text-[9px] uppercase tracking-[0.2em] text-fg-faint">
          <span className="text-fg-dim">{correctCount}</span>/{total} called right ·{" "}
          <span className="text-fg-dim">{answeredCount}</span> unlocked
        </div>

        <ol className="flex flex-col gap-0.5">
          {LEARN_CHAPTERS.map((c, i) => {
            const isActive = i === active;
            const p = predicts[c.id];
            const isConcept = CONCEPT_SET.has(c.id);
            return (
              <li key={c.id}>
                <button
                  onClick={() => jump(c.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={`group flex w-full items-center gap-2 py-0.5 text-left font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    isActive ? "text-bull" : "text-fg-faint hover:text-fg-dim"
                  }`}
                >
                  <span className={`h-px transition-all ${isActive ? "w-4 bg-bull" : "w-2 bg-border group-hover:w-3"}`} />
                  <span className="tabular-nums">{c.num}</span>
                  <span className="truncate">{c.short}</span>
                  {isConcept && (
                    <span className={`ml-auto text-[9px] ${p ? (p.correct ? "text-bull" : "text-amber") : "text-fg-faint/40"}`}>
                      {p ? (p.correct ? "✓" : "•") : "◦"}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

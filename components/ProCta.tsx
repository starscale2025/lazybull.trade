"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

const FEATURES = [
  { k: "Drawing tools", v: "11 incl. fib · channels · brush" },
  { k: "Indicators", v: "EMA · RSI · MACD · BB · VWAP · …" },
  { k: "Layouts", v: "1 / 2 / 3 / 4 panes" },
  { k: "Symbol search", v: "Stocks · ETFs · futures · crypto" },
  { k: "Replay mode", v: "Scrub through history" },
  { k: "Workspace", v: "Persists drawings & studies" },
];

export function ProCta() {
  const [open, setOpen] = useState(false);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group relative inline-flex items-center gap-3 border border-bull bg-bull px-5 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-bull-dim"
      >
        <span className="size-2 rounded-full bg-bg pulse-dot" />
        Try our professional version
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl border border-bull/40 bg-bg shadow-[0_30px_100px_-20px_rgba(0,255,135,0.5)]"
            >
              <div className="flex items-center justify-between border-b border-border bg-bg-soft px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em]">
                <span className="text-bull">⚡ lazybull.pro · godmode</span>
                <button onClick={() => setOpen(false)} className="text-fg-faint hover:text-fg">✕</button>
              </div>

              <div className="grid grid-cols-12 gap-0">
                {/* preview chart */}
                <div className="relative col-span-12 md:col-span-7 overflow-hidden border-b border-border md:border-b-0 md:border-r">
                  <PreviewChart />
                </div>
                {/* copy */}
                <div className="col-span-12 md:col-span-5 p-6">
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint mb-2">
                    Pro workspace
                  </div>
                  <h2 className="font-display text-3xl tracking-tightest leading-[0.95] text-fg">
                    The full
                    <br />
                    <span className="italic font-light text-bull">trading desk</span>.
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-fg-dim">
                    Real candles, every drawing tool, layered indicators, multi-pane layouts,
                    a full watchlist, and a symbol detail rail — all in your browser.
                  </p>

                  <ul className="mt-4 space-y-1">
                    {FEATURES.map((f) => (
                      <li key={f.k} className="flex items-center justify-between border-b border-border-soft py-1.5 font-mono text-[11px]">
                        <span className="text-fg-dim">{f.k}</span>
                        <span className="text-fg">{f.v}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 flex flex-col gap-2">
                    <Link
                      href="/pro"
                      onClick={() => setOpen(false)}
                      className="group relative inline-flex items-center justify-between border border-bull bg-bull px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim"
                    >
                      <span className="flex items-center gap-2">
                        <span className="size-1.5 rounded-full bg-bg pulse-dot" />
                        Open the pro workspace
                      </span>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </Link>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                      free during beta · no card · saves locally
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// Tiny scrolling candle preview — uses the same generator as /pro
function PreviewChart() {
  return (
    <div className="relative h-[320px] w-full bg-bg">
      <svg viewBox="0 0 600 320" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {/* faint grid */}
        {[0.2, 0.4, 0.6, 0.8].map((p) => (
          <line key={p} x1="0" x2="600" y1={p * 320} y2={p * 320} stroke="rgba(245,245,240,0.05)" />
        ))}
        {/* generated candles */}
        {Array.from({ length: 60 }).map((_, i) => {
          const o = 100 + Math.sin(i * 0.18) * 28 + Math.sin(i * 0.51) * 8;
          const c = 100 + Math.sin((i + 1) * 0.18) * 28 + Math.sin((i + 1) * 0.51) * 8;
          const isUp = c >= o;
          const colour = isUp ? "var(--bull)" : "var(--bear)";
          const yO = 280 - o * 1.2;
          const yC = 280 - c * 1.2;
          const yH = Math.min(yO, yC) - 6;
          const yL = Math.max(yO, yC) + 6;
          const x = 10 + i * 9.7;
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={yH} y2={yL} stroke={colour} strokeWidth="1" />
              <rect x={x - 3.2} y={Math.min(yO, yC)} width="6.4" height={Math.max(2, Math.abs(yC - yO))} fill={colour} />
            </g>
          );
        })}
        {/* drawn fib lines */}
        {[0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].map((lv, i) => {
          const colours = ["#9aa0a6", "#ff2e63", "#ffb800", "#22c55e", "#22d3ee", "#06b6d4", "#9aa0a6"];
          const y = 80 + lv * 160;
          return (
            <g key={lv}>
              <line x1="40" x2="560" y1={y} y2={y} stroke={colours[i]} strokeOpacity="0.6" />
              <text x="44" y={y - 3} fontFamily="var(--font-jetbrains)" fontSize="9" fill={colours[i]}>
                {lv}
              </text>
            </g>
          );
        })}
        {/* trend line */}
        <line x1="60" y1="240" x2="540" y2="80" stroke="var(--cyan)" strokeWidth="1.4" strokeDasharray="4 3" />
        {/* watermark */}
        <text x="300" y="170" textAnchor="middle" fontFamily="var(--font-fraunces)" fontSize="60" fill="rgba(245,245,240,0.04)">
          .pro
        </text>
      </svg>

      {/* tool overlay — fake toolbar */}
      <div className="absolute left-0 top-0 flex h-full w-8 flex-col items-center gap-1 border-r border-border bg-bg-soft py-2 font-mono text-[10px] text-fg-faint">
        {["+", "/", "↗", "—", "▭", "F", "✎", "⌖"].map((s, i) => (
          <span key={i} className={`flex size-6 items-center justify-center ${i === 1 ? "border border-bull text-bull" : ""}`}>
            {s}
          </span>
        ))}
      </div>
      {/* fake legend */}
      <div className="pointer-events-none absolute left-12 top-2 font-mono text-[10px] text-fg-dim">
        NIFTY · NSE · 1W <span className="text-fg">25,448.95</span> <span className="text-bear">−180.10 −0.74%</span>
      </div>
    </div>
  );
}

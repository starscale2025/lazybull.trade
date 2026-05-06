"use client";

import { useEffect, useState } from "react";

// Quick CRT-boot intro that types four lines, fills a progress bar, then
// dissolves. Sets the editorial-terminal tone before the user even reads
// the headline.

const LINES = [
  "▮ initializing learn.lazybull",
  "// 14 chapters loaded",
  "// 8 live demos armed",
  "// 27 bots registered",
  "// connecting to yahoo feed ◜◝",
  "▮ ready ▮",
];

export function BootSequence() {
  const [phase, setPhase] = useState<"booting" | "fading" | "gone">("booting");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fading"), 1500);
    const t2 = setTimeout(() => setPhase("gone"), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-bg ${
        phase === "fading" ? "boot-fade-out" : ""
      }`}
      style={{ pointerEvents: phase === "fading" ? "none" : "auto" }}
      aria-hidden
    >
      <div className="pointer-events-none absolute inset-0 bg-grid-fine opacity-30" />
      <div className="pointer-events-none absolute inset-0 scanlines opacity-50" />

      {/* Centered terminal card */}
      <div className="relative w-full max-w-[520px] px-6">
        {/* Logo */}
        <div className="hero-fade-up-soft mb-8 flex items-center gap-3" style={{ animationDelay: "0s" }}>
          <div className="relative flex size-7 items-center justify-center border border-fg/40 bg-bg">
            <div className="absolute inset-0.75 bg-bull" />
            <span className="relative font-mono text-[9px] font-bold text-bg">LB</span>
          </div>
          <span className="font-display text-base tracking-tightest text-fg">
            lazybull<span className="text-bull">.</span>learn
          </span>
        </div>

        {/* Lines */}
        <div className="space-y-1.5 font-mono text-[11px] uppercase tracking-[0.2em]">
          {LINES.map((line, i) => (
            <div
              key={i}
              className="hero-fade-up-soft"
              style={{
                animationDelay: `${0.1 + i * 0.18}s`,
                color: i === 0 || i === LINES.length - 1 ? "var(--bull)" : "var(--fg-dim)",
              }}
            >
              {line}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-6 h-[2px] w-full overflow-hidden bg-border">
          <div
            className="h-full bg-bull"
            style={{ animation: "boot-progress 1.5s linear forwards", boxShadow: "0 0 16px rgba(0,255,135,0.7)" }}
          />
        </div>

        {/* Cursor */}
        <div className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-bull">
          <span className="boot-cursor">▊</span>
          <span className="text-fg-faint">awaiting input</span>
        </div>
      </div>

      {/* Corners */}
      <div className="pointer-events-none absolute left-4 top-4 font-mono text-[9px] uppercase tracking-[0.3em] text-fg-faint">
        TERMINAL · 80×24
      </div>
      <div className="pointer-events-none absolute right-4 top-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em] text-bull">
        <span className="size-1 rounded-full bg-bull pulse-dot" />
        LIVE
      </div>
      <div className="pointer-events-none absolute left-4 bottom-4 font-mono text-[9px] uppercase tracking-[0.3em] text-fg-faint">
        v0.1 · 2026 edition
      </div>
      <div className="pointer-events-none absolute right-4 bottom-4 font-mono text-[9px] uppercase tracking-[0.3em] text-fg-faint">
        ▰▰▰▰▰▰▰▱▱▱
      </div>
    </div>
  );
}

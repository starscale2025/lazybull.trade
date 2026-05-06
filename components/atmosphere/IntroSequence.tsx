"use client";

import { useEffect, useState } from "react";

const LINES = [
  "BOOT  · lazybull.os v1.4.0",
  "INIT  · pricing engine ……… 0.4ms",
  "INIT  · ai teacher ……………  online",
  "INIT  · safety wheels ………  on",
  "READY · drag · build · learn",
];

export function IntroSequence() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = sessionStorage.getItem("lb_intro_seen_v1");
    if (seen) return;
    setShow(true);
    sessionStorage.setItem("lb_intro_seen_v1", "1");
    const t = setTimeout(() => setShow(false), 3500);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="boot-overlay" aria-hidden>
      <div className="boot-scanlines" />
      <div className="boot-flash" />
      <div className="pointer-events-none absolute -left-40 top-1/3 h-[420px] w-[420px] rounded-full bg-bull/20 blur-[140px]" />
      <div className="pointer-events-none absolute right-0 bottom-1/4 h-[360px] w-[360px] rounded-full bg-cyan/10 blur-[140px]" />

      <div className="relative w-[min(640px,90vw)] px-6">
        <div className="boot-line flex items-center gap-3 font-display text-3xl tracking-tightest text-fg">
          <span className="relative flex size-8 items-center justify-center border border-fg/40 bg-bg">
            <span className="absolute inset-1 bg-bull" />
            <span className="relative font-mono text-[10px] font-bold text-bg">LB</span>
          </span>
          <span>
            lazybull
            <span className="text-bull phosphor">.</span>
          </span>
        </div>

        <div className="mt-8 space-y-1.5 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
          {LINES.map((l, i) => (
            <div
              key={l}
              className="boot-line flex items-center gap-3"
              style={{ animationDelay: `${0.25 + i * 0.18}s` }}
            >
              <span className="text-bull">›</span>
              <span>{l}</span>
              {i === LINES.length - 1 && (
                <span className="ml-1 size-2 bg-bull boot-cursor" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 border border-border-soft bg-surface">
          <div className="boot-bar" />
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          <span>signed-by · lazybull labs</span>
          <span className="text-bull">paper · 100k</span>
        </div>
      </div>
    </div>
  );
}

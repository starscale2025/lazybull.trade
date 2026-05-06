"use client";

import { useEffect, useState } from "react";

// 2px sticky bar at the very top of the page that fills with --bull as the
// reader scrolls. Shimmer overlay keeps it alive even when scrolling pauses.

export function ScrollProgressBar() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      setPct(docH > 0 ? Math.min(1, Math.max(0, window.scrollY / docH)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed left-0 right-0 top-0 z-[80] h-[2px] bg-border/40" aria-hidden>
      <div
        className="progress-shimmer h-full"
        style={{
          width: `${pct * 100}%`,
          transition: "width 120ms cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow: "0 0 14px rgba(0,255,135,0.7)",
        }}
      />
      <div
        className="absolute right-2 top-2 flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.3em] text-bull"
        style={{ opacity: pct > 0.02 ? 1 : 0, transition: "opacity 220ms" }}
      >
        <span className="size-[3px] rounded-full bg-bull pulse-dot" />
        <span className="tabular-nums">{Math.round(pct * 100).toString().padStart(2, "0")}%</span>
      </div>
    </div>
  );
}

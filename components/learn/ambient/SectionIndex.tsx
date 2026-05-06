"use client";

import { useEffect, useState } from "react";

// Floating right-rail chapter index. 14 horizontal tick marks, the active
// one elongates into a labeled dash. Smooth-scrolls on click.

const SECTIONS = [
  { id: "hero", label: "00 · INTRO" },
  { id: "regime", label: "01 · REGIMES" },
  { id: "three-pieces", label: "02 · THREE PIECES" },
  { id: "live-demo", label: "03 · LIVE DEMO" },
  { id: "backtest", label: "04 · BACKTEST" },
  { id: "consensus", label: "05 · CONSENSUS" },
  { id: "greeks", label: "06 · GREEKS" },
  { id: "volsmile", label: "07 · VOL SMILE" },
  { id: "probability", label: "08 · PROBABILITY" },
  { id: "families", label: "09 · FAMILIES" },
  { id: "dataset", label: "10 · DATASET" },
  { id: "teacher", label: "11 · TEACHER" },
  { id: "byob", label: "12 · BYO BOT" },
  { id: "ai-quants", label: "13 · AI QUANTS" },
  { id: "now-go", label: "14 · GO" },
];

export function SectionIndex() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      let found = 0;
      const trigger = window.innerHeight * 0.35;
      for (let i = 0; i < SECTIONS.length; i++) {
        const el = document.getElementById(SECTIONS[i].id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= trigger) found = i;
        }
      }
      setActive(found);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed right-4 top-1/2 z-[40] hidden -translate-y-1/2 xl:block"
      aria-label="Chapter navigation"
    >
      <div className="border border-border bg-bg/70 backdrop-blur-md px-2 py-3">
        <div className="mb-2 px-1 font-mono text-[8px] uppercase tracking-[0.3em] text-fg-faint">
          INDEX
        </div>
        <ul className="space-y-1.5">
          {SECTIONS.map((s, i) => {
            const isActive = i === active;
            const isPassed = i < active;
            return (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="group flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.25em] transition-colors"
                  style={{ color: isActive ? "var(--bull)" : isPassed ? "var(--fg-dim)" : "var(--fg-faint)" }}
                >
                  <span
                    className="block h-px transition-all duration-300"
                    style={{
                      width: isActive ? "32px" : "10px",
                      background: isActive ? "var(--bull)" : isPassed ? "var(--fg-dim)" : "var(--fg-faint)",
                      boxShadow: isActive ? "0 0 8px rgba(0,255,135,0.6)" : "none",
                    }}
                  />
                  <span
                    className="whitespace-nowrap transition-opacity duration-300"
                    style={{ opacity: isActive ? 1 : 0 }}
                  >
                    {s.label}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 border-t border-border pt-2 px-1 font-mono text-[8px] uppercase tracking-[0.3em] text-fg-faint">
          {String(active + 1).padStart(2, "0")} / {SECTIONS.length}
        </div>
      </div>
    </nav>
  );
}

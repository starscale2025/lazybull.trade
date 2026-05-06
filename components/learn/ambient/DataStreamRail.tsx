"use client";

import { useEffect, useState } from "react";

// Decorative left-rail "telemetry" panel. 8 fake-but-plausible trader metrics
// that tick every ~850ms with small drift. Pure ambient texture; helps the
// page feel alive even when the user is reading.

const SEEDS: Array<{ label: string; value: number; range: number; decimals: number }> = [
  { label: "P(UP)",    value: 0.62,  range: 0.04, decimals: 2 },
  { label: "HURST",    value: 0.58,  range: 0.02, decimals: 2 },
  { label: "IV",       value: 0.32,  range: 0.02, decimals: 2 },
  { label: "VOL/30D",  value: 1.42,  range: 0.05, decimals: 2 },
  { label: "SHARPE",   value: 1.28,  range: 0.05, decimals: 2 },
  { label: "KELLY F*", value: 0.18,  range: 0.02, decimals: 3 },
  { label: "RHO",      value: -0.71, range: 0.02, decimals: 2 },
  { label: "GAMMA",    value: 0.018, range: 0.001, decimals: 4 },
];

export function DataStreamRail() {
  const [vals, setVals] = useState<number[]>(SEEDS.map((s) => s.value));
  const [prev, setPrev] = useState<number[]>(SEEDS.map((s) => s.value));

  useEffect(() => {
    const id = setInterval(() => {
      setPrev(vals);
      setVals((curr) =>
        curr.map((v, i) => {
          const seed = SEEDS[i];
          const drift = (Math.random() - 0.5) * seed.range;
          // Pull back toward seed value to prevent wandering.
          const pullBack = (seed.value - v) * 0.15;
          return v + drift + pullBack;
        })
      );
    }, 850);
    return () => clearInterval(id);
  }, [vals]);

  return (
    <aside
      className="fixed left-3 top-1/2 z-[40] hidden -translate-y-1/2 2xl:block"
      aria-hidden
    >
      <div className="border border-border bg-bg/80 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 font-mono text-[8px] uppercase tracking-[0.3em] text-fg-faint">
          <span className="size-1 rounded-full bg-bull pulse-dot" />
          <span>TELEMETRY</span>
          <span className="ml-auto text-bull">{SEEDS.length}</span>
        </div>
        <ul className="font-mono text-[9px] tabular-nums">
          {SEEDS.map((s, i) => {
            const v = vals[i];
            const dir = v > prev[i] ? "up" : v < prev[i] ? "down" : "flat";
            const color = dir === "up" ? "var(--bull)" : dir === "down" ? "var(--bear)" : "var(--fg-dim)";
            const arrow = dir === "up" ? "▲" : dir === "down" ? "▼" : "·";
            return (
              <li
                key={s.label}
                className="flex items-center justify-between gap-3 border-t border-border-soft/30 px-3 py-1.5"
              >
                <span className="text-fg-faint uppercase tracking-[0.2em]">{s.label}</span>
                <span className="flex items-center gap-1.5">
                  <span style={{ color }}>{arrow}</span>
                  <span style={{ color }}>{v.toFixed(s.decimals)}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border px-3 py-2 font-mono text-[8px] uppercase tracking-[0.3em] text-fg-faint">
          REFRESH 0.85s
        </div>
      </div>
    </aside>
  );
}

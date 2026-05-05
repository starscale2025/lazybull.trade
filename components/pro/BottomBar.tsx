"use client";

import { useEffect, useState } from "react";

const PRESETS = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"];

function fmtIST(d: Date): string {
  const ist = new Date(d.getTime() + (5.5 * 60 - d.getTimezoneOffset()) * 60_000);
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  const ss = String(ist.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function BottomBar({ preset, onPreset, status }: { preset: string; onPreset: (p: string) => void; status: string }) {
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    setClock(fmtIST(new Date()));
    const id = setInterval(() => setClock(fmtIST(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-9 items-center justify-between border-t border-border bg-bg-soft px-3 font-mono text-[10px] uppercase tracking-wider">
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => onPreset(p)}
            className={`h-6 min-w-7 border px-1.5 transition-colors ${
              p === preset
                ? "border-bull bg-bull/10 text-bull"
                : "border-transparent text-fg-dim hover:border-border hover:text-fg"
            }`}
          >
            {p}
          </button>
        ))}
        <span
          className="ml-2 inline-flex items-center gap-1 border border-border bg-bg px-1.5 py-0.5 text-fg-dim"
          title="Y-axis auto-scales to the visible range. Linear scale (log scale not yet supported)."
        >
          <span className="size-1 rounded-full bg-bull" />
          AUTO Y
        </span>
      </div>
      <div className="flex items-center gap-3 text-fg-faint">
        <span>{status}</span>
        <span>·</span>
        <span className="tabular-nums text-fg-dim">{clock || "--:--:--"} UTC+5:30</span>
      </div>
    </div>
  );
}

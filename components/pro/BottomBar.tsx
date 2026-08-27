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

export function BottomBar({
  preset,
  onPreset,
  status,
  log = false,
  onToggleLog,
}: {
  preset: string;
  onPreset: (p: string) => void;
  status: string;
  log?: boolean;
  onToggleLog?: () => void;
}) {
  const [clock, setClock] = useState<string>("");
  useEffect(() => {
    setClock(fmtIST(new Date()));
    const id = setInterval(() => setClock(fmtIST(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  // .dock-clear-x reserves the Dock's bottom-right footprint via --dock-gutter
  // — the hand-rolled pr-16 was 8px short, so the mic orb sat ON the clock.
  return (
    <div className="dock-clear-x flex h-9 items-center justify-between border-t border-border bg-bg-soft px-3 t-chrome">
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
          title="Y-axis auto-scales to the visible range."
        >
          <span className="size-1 rounded-full bg-bull" />
          AUTO Y
        </span>
        {onToggleLog && (
          <button
            onClick={onToggleLog}
            aria-pressed={log}
            title={log ? "Log price scale — click for linear" : "Linear price scale — click for log"}
            className={`inline-flex h-6 items-center border px-1.5 transition-colors ${
              log ? "border-bull bg-bull/10 text-bull" : "border-transparent text-fg-dim hover:border-border hover:text-fg"
            }`}
          >
            LOG
          </button>
        )}
      </div>
      <div className="hidden items-center gap-3 text-fg-faint md:flex">
        <span>{status}</span>
        <span>·</span>
        <span className="tabular-nums text-fg-dim">{clock || "--:--:--"} UTC+5:30</span>
      </div>
    </div>
  );
}

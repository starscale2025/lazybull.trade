"use client";

import { useEffect, useState } from "react";
import { Chip, TogglePill } from "@/components/calm/kit";
import { RANGE_PRESETS } from "@/lib/pro/ranges";
import { fmtIST } from "@/lib/pro/clock";

// What each range shows, and in which bar size, is lib/pro/ranges.ts.
const PRESETS = RANGE_PRESETS;

/** The kit's toggle at this strip's height: nine presets have to fit a phone. */
const COMPACT = "!h-6 !px-1.5 !text-[0.6875rem] min-w-7 justify-center";

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
    <div className="dock-clear-x flex h-9 items-center justify-between border-t border-border bg-bg-soft px-3 t-label">
      <div className="flex items-center gap-1">
        {PRESETS.map((p) => (
          <TogglePill key={p} on={p === preset} onClick={() => onPreset(p)} className={COMPACT}>
            {p}
          </TogglePill>
        ))}
        <span className="ml-2" title="Y-axis auto-scales to the visible range.">
          <Chip className="!py-0">Auto Y</Chip>
        </span>
        {onToggleLog && (
          // calm-toggle by hand: TogglePill has no title.
          <button
            type="button"
            onClick={onToggleLog}
            aria-pressed={log}
            title={log ? "Log price scale — click for linear" : "Linear price scale — click for log"}
            className={`calm-toggle ${COMPACT}`}
          >
            Log
          </button>
        )}
      </div>
      <div className="hidden items-center gap-3 text-fg-faint md:flex">
        <span>{status}</span>
        <span>·</span>
        <span data-pro-clock className="t-data text-fg-dim">{clock || "--:--:--"} UTC+5:30</span>
      </div>
    </div>
  );
}

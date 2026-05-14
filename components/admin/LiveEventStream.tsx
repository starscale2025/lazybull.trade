"use client";

import { useEffect, useRef, useState } from "react";
import type { EventRow } from "@/lib/admin-data";

const LEVEL_COLOR: Record<EventRow["level"], { bg: string; fg: string; dot: string }> = {
  info:  { bg: "border-border bg-surface text-fg-dim", fg: "text-fg",     dot: "bg-fg-faint" },
  warn:  { bg: "border-amber/40 bg-amber/5 text-amber", fg: "text-amber", dot: "bg-amber" },
  err:   { bg: "border-bear/40 bg-bear/5 text-bear",    fg: "text-bear",  dot: "bg-bear" },
  trade: { bg: "border-bull/40 bg-bull/5 text-bull",    fg: "text-bull",  dot: "bg-bull" },
  auth:  { bg: "border-cyan/40 bg-cyan/5 text-cyan",    fg: "text-cyan",  dot: "bg-cyan" },
  kill:  { bg: "border-bear bg-bear/10 text-bear",      fg: "text-bear",  dot: "bg-bear" },
  ai:    { bg: "border-plasma/40 bg-plasma/5 text-plasma", fg: "text-plasma", dot: "bg-plasma" },
};

function relTime(ms: number): string {
  const d = (Date.now() - ms) / 1000;
  if (d < 60) return `${Math.floor(d)}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export function LiveEventStream({ initial }: { initial: EventRow[] }) {
  const [events, setEvents] = useState<EventRow[]>(initial);
  const [paused, setPaused] = useState(false);
  const [filter, setFilter] = useState<"all" | EventRow["level"]>("all");
  const tickRef = useRef(0);

  // Synthetic live tail — every ~2.5s, emit a new event by recycling a
  // recent template slot so the feed feels alive without a backend.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      tickRef.current += 1;
      setEvents((prev) => {
        if (!prev.length) return prev;
        const recycled = prev[(tickRef.current * 7) % prev.length];
        const fresh: EventRow = {
          ...recycled,
          id: `live_${Date.now()}_${tickRef.current}`,
          t: Date.now(),
        };
        return [fresh, ...prev].slice(0, 120);
      });
    }, 2500);
    return () => clearInterval(id);
  }, [paused]);

  const visible = filter === "all" ? events : events.filter((e) => e.level === filter);

  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          <span className="text-bull">event stream</span>
          <span className="text-fg-faint">·</span>
          <span className="tabular-nums">{events.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {(["all", "trade", "ai", "auth", "warn", "err", "kill"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`border px-1.5 py-0.5 text-[9px] transition-colors ${
                filter === f
                  ? "border-bull bg-bull/10 text-bull"
                  : "border-border text-fg-dim hover:text-fg"
              }`}
            >
              {f}
            </button>
          ))}
          <button
            onClick={() => setPaused(!paused)}
            className={`ml-2 border px-1.5 py-0.5 text-[9px] transition-colors ${
              paused ? "border-amber bg-amber/10 text-amber" : "border-border text-fg-dim hover:text-fg"
            }`}
          >
            {paused ? "resume" : "pause"}
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto font-mono text-[11px]">
        <div className="divide-y divide-border-soft">
          {visible.map((e, i) => {
            const c = LEVEL_COLOR[e.level];
            const isFresh = i === 0 && !paused;
            return (
              <div
                key={e.id}
                className={`grid grid-cols-[68px_72px_1fr_auto] items-center gap-2 px-3 py-1.5 transition-colors hover:bg-surface ${
                  isFresh ? "bg-bull/5" : ""
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`size-1 rounded-full ${c.dot} ${isFresh ? "pulse-dot" : ""}`} />
                  <span className="text-fg-faint tabular-nums">{relTime(e.t)}</span>
                </div>
                <span className={`border px-1 py-0 text-[9px] uppercase tracking-wider ${c.bg}`}>
                  {e.level}
                </span>
                <div className="truncate">
                  <span className="text-fg-dim">{e.who}</span>
                  <span className="mx-1.5 text-fg-faint">·</span>
                  <span className={c.fg}>{e.msg}</span>
                </div>
                <span className="text-right text-fg-faint tabular-nums">{e.meta}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

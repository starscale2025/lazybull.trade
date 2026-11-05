"use client";

import { useMemo, useState } from "react";
import type { EventLevel, EventRow } from "@/lib/admin-data";
import { rel } from "./Tile";

// The last 80 rows of the events collection, exactly as they were written.
//
// What was here before deserves naming: twelve message templates ("paper ·
// iron condor on TSLA", "teacher explained Θ decay on NVDA"), a NAMES array
// that invented the person who did it, and a setInterval that recycled a
// random row every 2.5 seconds so the feed would look alive. None of those
// events happened. This tile now shows event TYPES — the real vocabulary — and
// does not move on its own: the page is server-rendered per request, so the
// honest verb is "refresh", not a fake tail.

const LEVEL_COLOR: Record<EventLevel, { chip: string; fg: string; dot: string }> = {
  info:  { chip: "border-border bg-surface text-fg-dim",     fg: "text-fg-dim",  dot: "bg-fg-faint" },
  warn:  { chip: "border-amber/40 bg-amber/5 text-amber",    fg: "text-amber",   dot: "bg-amber" },
  err:   { chip: "border-bear/40 bg-bear/5 text-bear",       fg: "text-bear",    dot: "bg-bear" },
  trade: { chip: "border-bull/40 bg-bull/5 text-bull",       fg: "text-bull",    dot: "bg-bull" },
  auth:  { chip: "border-cyan/40 bg-cyan/5 text-cyan",       fg: "text-cyan",    dot: "bg-cyan" },
  kill:  { chip: "border-bear bg-bear/10 text-bear",         fg: "text-bear",    dot: "bg-bear" },
  ai:    { chip: "border-plasma/40 bg-plasma/5 text-plasma", fg: "text-plasma",  dot: "bg-plasma" },
};

const FILTERS = ["all", "trade", "ai", "auth", "warn", "kill", "info"] as const;

export function LiveEventStream({ rows }: { rows: EventRow[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of rows) m.set(e.level, (m.get(e.level) ?? 0) + 1);
    return m;
  }, [rows]);
  const visible = filter === "all" ? rows : rows.filter((e) => e.level === filter);

  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between gap-2 border-b border-border-soft bg-bg-soft px-3 py-2 t-chrome text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="text-bull">event stream</span>
          <span className="text-fg-faint">·</span>
          <span className="tabular-nums">{rows.length} newest</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {FILTERS.map((f) => {
            const n = f === "all" ? rows.length : (counts.get(f) ?? 0);
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                disabled={n === 0 && f !== "all"}
                className={`border px-1.5 py-0.5 text-[0.625rem] transition-colors ${
                  filter === f
                    ? "border-bull bg-bull/10 text-bull"
                    : n === 0 && f !== "all"
                      ? "border-border/50 text-fg-faint/50"
                      : "border-border text-fg-dim hover:text-fg"
                }`}
              >
                {f} {n > 0 && <span className="tabular-nums">{n}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex-1 overflow-y-auto font-mono text-[0.6875rem]">
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-[0.6875rem] text-fg-faint">
            {rows.length === 0
              ? "no event has been written in the last 7 days — the tracker only fires for consented visitors (lib/track.ts)."
              : `no ${filter} event in the newest ${rows.length}.`}
          </div>
        ) : (
          <div className="divide-y divide-border-soft">
            {visible.map((e) => {
              const c = LEVEL_COLOR[e.level];
              return (
                <div
                  key={e.id}
                  className="grid grid-cols-[52px_60px_1fr] items-center gap-2 px-3 py-1.5 transition-colors hover:bg-surface md:grid-cols-[52px_60px_150px_1fr_auto]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`size-1 rounded-full ${c.dot}`} />
                    <span className="tabular-nums text-fg-faint">{rel(e.t)}</span>
                  </div>
                  <span className={`border px-1 py-0 text-center t-chrome ${c.chip}`}>{e.level}</span>
                  <span className={`truncate ${c.fg}`}>{e.type}</span>
                  <span className="hidden truncate text-fg-faint md:block">{e.page ?? "—"}</span>
                  <span className="hidden text-right text-fg-dim md:block">
                    {e.meta ?? ""} <span className="ml-2 text-fg-faint">{e.who}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-border-soft bg-bg-soft px-3 py-1.5 t-chrome text-fg-faint">
        snapshot at page load · refresh for newer · actors are hashed, never named
      </div>
    </div>
  );
}

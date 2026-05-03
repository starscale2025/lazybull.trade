"use client";

import { useMemo, useState } from "react";
import type { BotDef, BotCategory } from "@/lib/quant/types";
import { CATEGORY_META } from "@/lib/quant/types";

export function BotLibrary({
  bots,
  customBots,
  activeIds,
  onAdd,
  onImport,
}: {
  bots: BotDef[];
  customBots: BotDef[];
  activeIds: string[];
  onAdd: (def: BotDef) => void;
  onImport: () => void;
}) {
  const [filter, setFilter] = useState<BotCategory | "all">("all");
  const [q, setQ] = useState("");
  const all = useMemo(() => [...bots, ...customBots], [bots, customBots]);

  const visible = useMemo(() => {
    return all.filter((b) => {
      if (filter !== "all" && b.category !== filter) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        return (
          b.name.toLowerCase().includes(needle) ||
          b.tagline.toLowerCase().includes(needle) ||
          b.id.includes(needle)
        );
      }
      return true;
    });
  }, [all, filter, q]);

  const categories: (BotCategory | "all")[] = ["all", "trend", "stats", "risk", "options", "custom"];

  return (
    <aside className="flex h-full flex-col border border-border bg-surface">
      {/* header */}
      <div className="border-b border-border bg-bg-soft px-3 py-2">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-base tracking-tightest text-fg">Bot library</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            {bots.length + customBots.length} loaded
          </span>
        </div>
        <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          click → add to workspace
        </div>
      </div>

      {/* search */}
      <div className="border-b border-border-soft p-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search bots…"
          className="h-8 w-full border border-border bg-bg px-2 font-mono text-[11px] text-fg placeholder:text-fg-faint focus:border-bull focus:outline-none"
        />
      </div>

      {/* filter chips */}
      <div className="flex flex-wrap gap-1 border-b border-border-soft p-2">
        {categories.map((c) => {
          const meta = c === "all" ? null : CATEGORY_META[c];
          const isOn = filter === c;
          return (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`h-7 border px-2 font-mono text-[10px] uppercase tracking-wider ${
                isOn ? "border-bull bg-bull text-bg" : "border-border bg-bg text-fg-dim hover:border-fg-dim hover:text-fg"
              }`}
              style={!isOn && meta ? { color: meta.color } : undefined}
            >
              {c === "all" ? "all" : meta?.label.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 && (
          <div className="grid h-32 place-items-center font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            no bots match
          </div>
        )}
        {visible.map((b) => {
          const cat = CATEGORY_META[b.category];
          return (
            <button
              key={b.id}
              onClick={() => onAdd(b)}
              className="group block w-full border-b border-border-soft px-3 py-2.5 text-left transition-colors hover:bg-bg"
            >
              <div className="flex items-start gap-3">
                <span
                  className="grid size-7 shrink-0 place-items-center border border-border bg-bg font-mono text-[12px]"
                  style={{ color: cat.color }}
                >
                  {b.glyph}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-[14px] tracking-tightest text-fg">
                      {b.name}
                    </span>
                    {activeIds.includes(b.id) && (
                      <span className="size-1.5 rounded-full bg-bull pulse-dot" title="in workspace" />
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: cat.color }}>
                    {cat.label}
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] text-fg-dim">{b.tagline}</div>
                </div>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-fg-faint group-hover:text-bull">
                  +
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* footer: import */}
      <div className="border-t border-border bg-bg-soft p-2">
        <button
          onClick={onImport}
          className="group flex w-full items-center justify-between border border-dashed border-border bg-bg px-3 py-3 transition-colors hover:border-bull hover:bg-bull/5"
        >
          <div>
            <div className="font-display text-sm tracking-tightest text-fg">+ Import your bot</div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              .ts · .js · paste code
            </div>
          </div>
          <span className="font-mono text-base text-fg-dim group-hover:text-bull">↗</span>
        </button>
      </div>
    </aside>
  );
}

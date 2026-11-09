"use client";

import { useMemo, useState } from "react";
import type { BotDef, BotCategory } from "@/lib/quant/types";
import { CATEGORY_META } from "@/lib/quant/types";
import { Chip, TogglePill } from "@/components/calm/kit";

export function BotLibrary({
  bots,
  customBots,
  activeIds,
  onAdd,
  onRemove,
  onImport,
}: {
  bots: BotDef[];
  customBots: BotDef[];
  activeIds: string[];
  onAdd: (def: BotDef) => void;
  onRemove: (defId: string) => void;
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

  const categories: (BotCategory | "all")[] = ["all", "ai", "trend", "stats", "risk", "options", "custom"];

  return (
    <aside className="calm-panel flex h-full flex-col">
      <i aria-hidden className="lit-aura" />
      {/* header */}
      <div className="px-4 pb-2.5 pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">Bot library</span>
          <span className="t-label text-fg-faint">
            {bots.length + customBots.length} loaded
          </span>
        </div>
        <div className="mt-1 t-label text-fg-faint">
          Click → add to workspace
        </div>
      </div>

      {/* search */}
      <div className="px-3 pb-2.5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search bots…"
          className="calm-input w-full"
        />
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-1.5 px-3 pb-3">
        {categories.map((c) => (
          <TogglePill key={c} on={filter === c} onClick={() => setFilter(c)}>
            {c === "all" ? "All" : CATEGORY_META[c].label.split(" ")[0]}
          </TogglePill>
        ))}
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto border-t border-border-soft">
        {visible.length === 0 && (
          <div className="grid h-32 place-items-center t-label text-fg-faint">
            No bots match
          </div>
        )}
        {visible.map((b) => {
          const cat = CATEGORY_META[b.category];
          const isActive = activeIds.includes(b.id);
          return (
            <div
              key={b.id}
              className={`group relative border-b border-border-soft transition-colors ${
                isActive ? "bg-brand-ink/[0.07]" : ""
              }`}
            >
              <button
                onClick={() => (isActive ? onRemove(b.id) : onAdd(b))}
                title={isActive ? "click to remove from workspace" : "click to add to workspace"}
                className="block w-full px-4 py-2.5 pb-7 pr-9 text-left transition-colors hover:bg-fg/5"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-fg/[0.07] text-[0.75rem] text-brand-ink">
                    {b.glyph}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="line-clamp-2 text-[0.875rem] font-medium leading-tight tracking-[-0.01em] text-fg">
                        {b.name}
                      </span>
                      {b.category === "ai" && (
                        <span className="inline-flex" title={b.endpoint ?? "ai quants"}>
                          <Chip tone="brand">AI</Chip>
                        </span>
                      )}
                      {isActive && (
                        <span className="size-1.5 shrink-0 rounded-full bg-brand-ink" title="in workspace" />
                      )}
                    </div>
                    <div className="mt-0.5 t-label text-fg-faint">
                      {cat.label}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[0.75rem] leading-snug text-fg-dim">{b.tagline}</div>
                  </div>
                  <span
                    className={`t-label shrink-0 ${
                      isActive
                        ? "text-brand-ink group-hover:text-fg"
                        : "text-fg-faint group-hover:text-brand-ink"
                    }`}
                  >
                    {isActive ? (
                      <>
                        <span className="group-hover:hidden">✓ Added</span>
                        <span className="hidden group-hover:inline">− Remove</span>
                      </>
                    ) : (
                      /* only surfaces on hover/focus — an always-on label in
                         every row stole ~50px from the bot name (Q5) */
                      <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        + Add
                      </span>
                    )}
                  </span>
                </div>
              </button>
              <a
                href={`/learn/bots/${b.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`Read about ${b.name} — math, code, when it works, when it fails`}
                onClick={(e) => e.stopPropagation()}
                className="t-label absolute bottom-1.5 right-3 z-10 inline-flex items-center gap-1 text-fg-faint transition-colors hover:text-brand-ink"
              >
                ⓘ About
              </a>
            </div>
          );
        })}
      </div>

      {/* footer: import */}
      <div className="p-3">
        <button
          onClick={onImport}
          className="calm-pill-secondary group flex w-full items-center justify-between rounded-2xl px-4 py-2.5 text-left transition-colors"
        >
          <div>
            <div className="text-[0.875rem] font-medium tracking-[-0.01em] text-fg">+ Import your bot</div>
            <div className="mt-0.5 t-label text-fg-faint">
              .ts · .js · paste code
            </div>
          </div>
          <span className="text-base text-fg-dim group-hover:text-brand-ink">↗</span>
        </button>
      </div>
    </aside>
  );
}

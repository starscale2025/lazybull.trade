"use client";

import { useEffect, useRef, useState } from "react";

type Command = { id: string; label: string; group: string; hint?: string };

const COMMANDS: Command[] = [
  { id: "kill",       label: "Arm platform-wide kill switch",         group: "safety", hint: "danger" },
  { id: "drill",      label: "Run kill-switch drill (5s)",            group: "safety" },
  { id: "ban",        label: "Ban user by id",                        group: "users" },
  { id: "promote",    label: "Promote user to Pro (manual)",          group: "users" },
  { id: "rotate",     label: "Rotate AI teacher API key",             group: "ops" },
  { id: "purge",      label: "Purge stale paper sessions (>30d)",     group: "ops" },
  { id: "rebuild",    label: "Rebuild quant bot registry",            group: "ops" },
  { id: "broadcast",  label: "Broadcast banner to all users",         group: "comms" },
  { id: "exportcsv",  label: "Export today's trades · CSV",           group: "data" },
  { id: "exportdb",   label: "Snapshot mongo · all collections",      group: "data" },
  { id: "graph",      label: "Open knowledge graph (graphify)",       group: "tools" },
  { id: "logs",       label: "Tail live error log",                   group: "tools" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (open && e.key === "Escape") {
        setOpen(false);
      } else if (open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        setActive((i) => {
          const max = filtered.length - 1;
          if (e.key === "ArrowDown") return Math.min(max, i + 1);
          return Math.max(0, i - 1);
        });
      } else if (open && e.key === "Enter") {
        const cmd = filtered[active];
        if (cmd) {
          // eslint-disable-next-line no-console
          console.log("[admin] dispatch:", cmd.id);
          setOpen(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  const filtered = COMMANDS.filter((c) =>
    !q.trim() || c.label.toLowerCase().includes(q.toLowerCase()) || c.group.includes(q.toLowerCase())
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 border border-border bg-bg/90 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim shadow-[0_8px_28px_-12px_rgba(0,0,0,0.6)] backdrop-blur transition-colors hover:border-bull hover:text-fg"
      >
        <span className="text-fg-faint">⌘</span>K · admin actions
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-bg/80 px-4 pt-24 backdrop-blur">
      <div className="w-full max-w-2xl border border-border bg-surface shadow-[0_24px_120px_-24px_rgba(0,0,0,0.8)]">
        <div className="flex items-center gap-3 border-b border-border-soft px-4 py-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-bull">⌘K</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            placeholder="run command…"
            className="flex-1 bg-transparent font-mono text-sm text-fg placeholder:text-fg-faint outline-none"
          />
          <button
            onClick={() => setOpen(false)}
            className="border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim hover:text-fg"
          >
            esc
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto py-1">
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onMouseEnter={() => setActive(i)}
              onClick={() => { console.log("[admin] dispatch:", c.id); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left font-mono text-[12px] transition-colors ${
                i === active ? "bg-bull/10 text-fg" : "text-fg-dim hover:bg-surface"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-fg-faint text-[10px] uppercase tracking-wider w-14">{c.group}</span>
                <span>{c.label}</span>
              </div>
              {c.hint && (
                <span className="font-mono text-[9px] uppercase tracking-wider text-bear">
                  {c.hint}
                </span>
              )}
            </button>
          ))}
          {!filtered.length && (
            <div className="px-4 py-6 text-center font-mono text-[11px] uppercase tracking-wider text-fg-faint">
              no commands match
            </div>
          )}
        </div>
        <div className="border-t border-border-soft px-4 py-2 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
          ↑↓ navigate · ↵ run · esc close
        </div>
      </div>
    </div>
  );
}

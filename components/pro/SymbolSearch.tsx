"use client";

// The keystroke-driven command box — the single most recognizable terminal
// flow: start typing anywhere on the chart and this opens with your keystroke
// already in the field. Type a symbol and Enter to switch; type an interval
// ("5", "1h", "d") and Enter to change timeframe. Arrows navigate, Escape
// closes. The page owns the "any printable key opens me" wiring.

import { useEffect, useMemo, useRef, useState } from "react";
import { SEED_SYMBOLS, type SymbolDef } from "./TopBar";

type Props = {
  open: boolean;
  /** The keystroke that opened the box, pre-filled so no input is lost. */
  seed: string;
  onClose: () => void;
  onPickSymbol: (s: SymbolDef) => void;
  onPickInterval: (tf: string) => void;
};

/**
 * "5" -> 5m, "60"/"1h" -> 1h, "d" -> D … the terminal convention: digits mean
 * minutes, a trailing h means hours, bare d/w/m mean day/week/month. Returns
 * null when the query does not read as an interval.
 */
export function parseInterval(q: string): { tf: string; label: string } | null {
  const t = q.trim().toLowerCase();
  if (!t) return null;
  if (t === "d" || t === "1d") return { tf: "D", label: "1 day" };
  if (t === "w" || t === "1w") return { tf: "W", label: "1 week" };
  if (t === "m" || t === "1mo") return { tf: "M", label: "1 month" };
  const m = t.match(/^(\d+)(h)?$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (m[2] === "h") {
    if (n === 1) return { tf: "1h", label: "1 hour" };
    if (n === 4) return { tf: "4h", label: "4 hours" };
    return null;
  }
  // minutes; only the timeframes the data feed actually serves
  if (n === 1) return { tf: "1m", label: "1 minute" };
  if (n === 5) return { tf: "5m", label: "5 minutes" };
  if (n === 15) return { tf: "15m", label: "15 minutes" };
  if (n === 60) return { tf: "1h", label: "1 hour" };
  if (n === 240) return { tf: "4h", label: "4 hours" };
  return null;
}

export function SymbolSearch({ open, seed, onClose, onPickSymbol, onPickInterval }: Props) {
  const [query, setQuery] = useState(seed);
  const [remote, setRemote] = useState<SymbolDef[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Re-seed on every open so the keystroke that opened the box is the query.
  useEffect(() => {
    if (open) {
      setQuery(seed);
      setHighlight(0);
      // Focus after paint; autoFocus alone loses the race with the animation.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open, seed]);

  // Debounced remote search. The seed list answers instantly; Yahoo fills in
  // the long tail 220ms later, which is fast enough to feel live without
  // hammering the API on every keystroke.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setRemote([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/symbol-search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (j?.ok && Array.isArray(j.items)) setRemote(j.items as SymbolDef[]);
      } catch {
        /* keep the seed matches on a failed lookup */
      }
    }, 220);
    return () => clearTimeout(id);
  }, [open, query]);

  const interval = useMemo(() => parseInterval(query), [query]);

  const symbols = useMemo(() => {
    const q = query.trim().toUpperCase();
    const seedHits = q
      ? SEED_SYMBOLS.filter((s) => s.sym.toUpperCase().includes(q) || s.name.toUpperCase().includes(q))
      : SEED_SYMBOLS;
    // Seed list first (instant + familiar), then remote rows it doesn't cover.
    const seen = new Set(seedHits.map((s) => s.sym));
    return [...seedHits, ...remote.filter((r) => !seen.has(r.sym))].slice(0, 12);
  }, [query, remote]);

  // One flat list for keyboard navigation: interval row (if any) then symbols.
  const rowCount = (interval ? 1 : 0) + symbols.length;
  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, rowCount - 1)));
  }, [rowCount]);

  const pick = (idx: number) => {
    if (interval && idx === 0) {
      onPickInterval(interval.tf);
      onClose();
      return;
    }
    const s = symbols[idx - (interval ? 1 : 0)];
    if (s) {
      onPickSymbol(s);
      onClose();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, rowCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(highlight);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-dialog)] flex items-start justify-center bg-black/60 pt-[calc(12vh/var(--ui-zoom))] backdrop-blur-sm"
      onMouseDown={(e) => {
        // Click on the veil closes; clicks inside the box do not.
        if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose();
      }}
    >
      <div ref={boxRef} className="w-[440px] max-w-[calc(92vw/var(--ui-zoom))] surface-instrument border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <span className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">Symbol search</span>
          <button
            onClick={onClose}
            aria-label="Close symbol search"
            className="ml-auto font-mono text-xs text-fg-faint hover:text-fg"
          >
            esc
          </button>
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Symbol… or an interval like 5, 1h, D"
          aria-label="Search symbols or type an interval"
          className="w-full border-b border-border bg-surface px-3 py-3 font-mono text-[15px] uppercase tracking-wider text-fg outline-none placeholder:normal-case placeholder:text-fg-faint"
        />
        <div className="max-h-[46vh] overflow-y-auto py-1" role="listbox" aria-label="Search results">
          {interval && (
            <button
              role="option"
              aria-selected={highlight === 0}
              onClick={() => pick(0)}
              onMouseEnter={() => setHighlight(0)}
              className={`flex w-full items-center justify-between px-3 py-2 font-mono text-[12px] ${
                highlight === 0 ? "bg-surface-2 text-fg" : "text-fg-dim"
              }`}
            >
              <span>
                Change interval → <span className="text-bull">{interval.label}</span>
              </span>
              <span className="text-[10px] uppercase tracking-wider text-fg-faint">↵</span>
            </button>
          )}
          {symbols.map((s, i) => {
            const idx = i + (interval ? 1 : 0);
            return (
              <button
                key={s.sym}
                role="option"
                aria-selected={highlight === idx}
                onClick={() => pick(idx)}
                onMouseEnter={() => setHighlight(idx)}
                className={`flex w-full items-center gap-3 px-3 py-2 font-mono text-[12px] ${
                  highlight === idx ? "bg-surface-2 text-fg" : "text-fg-dim"
                }`}
              >
                <span className="w-16 shrink-0 text-left text-fg">{s.sym}</span>
                <span className="flex-1 truncate text-left text-[11px]">{s.name}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wider text-fg-faint">{s.exch}</span>
              </button>
            );
          })}
          {!symbols.length && !interval && (
            <div className="px-3 py-4 font-mono text-[11px] text-fg-faint">No matches.</div>
          )}
        </div>
      </div>
    </div>
  );
}

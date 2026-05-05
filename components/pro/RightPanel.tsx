"use client";

import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmt } from "./chartCore";
import type { SymbolDef } from "./TopBar";
const DEFAULT_LIST: { sym: string }[] = [
  { sym: "^NSEI" }, { sym: "^NSEBANK" }, { sym: "^GSPC" }, { sym: "^IXIC" },
  { sym: "AAPL" }, { sym: "NVDA" }, { sym: "TSLA" }, { sym: "AMZN" }, { sym: "MSFT" }, { sym: "META" }, { sym: "GOOGL" },
  { sym: "BTC-USD" }, { sym: "ETH-USD" },
];

type LiveQuote = { sym: string; name?: string; last?: number; chg?: number; chgPct?: number; currency?: string; exch?: string; marketState?: string };

type Props = { symbol: SymbolDef; onPickSymbol: (s: SymbolDef) => void };

export function RightPanel({ symbol, onPickSymbol }: Props) {
  const [list, setList] = useState<string[]>(() => {
    if (typeof window === "undefined") return DEFAULT_LIST.map((d) => d.sym);
    try {
      const saved = localStorage.getItem("lb-pro-watchlist");
      return saved ? (JSON.parse(saved) as string[]) : DEFAULT_LIST.map((d) => d.sym);
    } catch {
      return DEFAULT_LIST.map((d) => d.sym);
    }
  });
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SymbolDef[]>([]);
  const [hist, setHist] = useState<{ ts: number; price: number }[]>([]);
  const [perf, setPerf] = useState<Record<string, number>>({});

  // persist
  useEffect(() => {
    try { localStorage.setItem("lb-pro-watchlist", JSON.stringify(list)); } catch {}
  }, [list]);

  // poll quotes every 15s
  useEffect(() => {
    let alive = true;
    const fetchQuotes = async () => {
      try {
        const symsForReq = Array.from(new Set([...list, symbol.sym]));
        const r = await fetch(`/api/quote-batch?symbols=${encodeURIComponent(symsForReq.join(","))}`);
        const j = await r.json();
        if (!alive || !j.ok) return;
        const map: Record<string, LiveQuote> = {};
        for (const q of j.quotes as LiveQuote[]) map[q.sym] = q;
        setQuotes(map);
      } catch {}
    };
    fetchQuotes();
    const id = setInterval(fetchQuotes, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [list, symbol.sym]);

  // tiny live price tick history (last ~60 samples) for the symbol
  useEffect(() => {
    const q = quotes[symbol.sym];
    if (q?.last == null) return;
    setHist((h) => [...h.slice(-59), { ts: Date.now(), price: q.last as number }]);
  }, [quotes, symbol.sym]);

  // performance from /api/quote (1d/1m/3m/6m/ytd/1y)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol.sym)}&tf=D`);
        const j = await r.json();
        if (!alive || !j.ok) return;
        const bars = j.bars as { t: number; c: number }[];
        if (!bars.length) return;
        const last = bars[bars.length - 1].c;
        const now = bars[bars.length - 1].t;
        const findOldest = (msAgo: number) => {
          const target = now - msAgo;
          for (const b of bars) if (b.t >= target) return b.c;
          return bars[0].c;
        };
        const yearStart = new Date(new Date(now).getFullYear(), 0, 1).getTime();
        const ytdRef = bars.find((b) => b.t >= yearStart)?.c ?? bars[0].c;
        const day = 86_400_000;
        setPerf({
          "1D": ((last - findOldest(day)) / findOldest(day)) * 100,
          "1M": ((last - findOldest(30 * day)) / findOldest(30 * day)) * 100,
          "3M": ((last - findOldest(90 * day)) / findOldest(90 * day)) * 100,
          "6M": ((last - findOldest(180 * day)) / findOldest(180 * day)) * 100,
          YTD: ((last - ytdRef) / ytdRef) * 100,
          "1Y": ((last - findOldest(365 * day)) / findOldest(365 * day)) * 100,
        });
      } catch {}
    })();
    return () => { alive = false; };
  }, [symbol.sym]);

  // symbol search
  useEffect(() => {
    const q = search.trim();
    if (!q) { setResults([]); return; }
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/symbol-search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (j.ok) setResults(j.items as SymbolDef[]);
      } catch {}
    }, 220);
    return () => clearTimeout(id);
  }, [search]);

  const symMeta = useMemo<SymbolDef>(() => {
    const fromQuote = quotes[symbol.sym];
    return {
      sym: symbol.sym,
      name: fromQuote?.name || symbol.name,
      exch: fromQuote?.exch || symbol.exch,
    };
  }, [symbol, quotes]);

  const live = quotes[symbol.sym];
  const sparkPath = useMemo(() => {
    if (hist.length < 2) return "";
    const lo = Math.min(...hist.map((p) => p.price));
    const hi = Math.max(...hist.map((p) => p.price));
    const r = hi - lo || 1;
    return hist.map((p, i) => `${i === 0 ? "M" : "L"}${(i / (hist.length - 1)) * 100},${30 - ((p.price - lo) / r) * 28}`).join(" ");
  }, [hist]);

  const removeSym = (s: string) => setList((l) => l.filter((x) => x !== s));
  const addSym = (s: string) => setList((l) => (l.includes(s) ? l : [...l, s]));

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-border bg-bg-soft">
      {/* Watchlist header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <span className="text-fg">Watchlist</span>
        <div className="flex items-center gap-1">
          <button title="Reset to default" onClick={() => setList(DEFAULT_LIST.map((d) => d.sym))} className="size-5 border border-border text-fg-dim hover:border-fg-dim hover:text-fg">⟳</button>
        </div>
      </div>

      {/* Search/add */}
      <div className="relative border-b border-border-soft p-2">
        <div className="flex items-center gap-2 border border-border bg-bg px-2">
          <span className="text-fg-faint">+</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Add symbol — AAPL, NIFTY, BTC…"
            className="h-7 flex-1 bg-transparent font-mono text-[11px] uppercase text-fg outline-none placeholder:text-fg-faint"
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                addSym(results[0].sym);
                setSearch("");
                setResults([]);
              }
            }}
          />
        </div>
        {results.length > 0 && (
          <div className="absolute left-2 right-2 top-11 z-30 max-h-72 overflow-y-auto border border-border bg-bg shadow-2xl">
            {results.map((r) => (
              <button
                key={r.sym}
                onClick={() => { addSym(r.sym); setSearch(""); setResults([]); }}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left font-mono text-[11px] hover:bg-surface"
              >
                <div>
                  <div className="text-fg">{r.sym}</div>
                  <div className="text-[9px] normal-case tracking-normal text-fg-faint">{r.name}</div>
                </div>
                <span className="text-[9px] text-fg-faint">{r.exch}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* column header */}
      <div className="grid grid-cols-12 gap-2 border-b border-border-soft px-3 py-1 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
        <span className="col-span-5">Symbol</span>
        <span className="col-span-3 text-right">Last</span>
        <span className="col-span-2 text-right">Chg</span>
        <span className="col-span-2 text-right">Chg%</span>
      </div>

      {/* watchlist */}
      <div className="flex-1 overflow-y-auto">
        {list.map((sym) => {
          const q = quotes[sym];
          const active = sym === symbol.sym;
          return (
            <div key={sym} className={`group grid grid-cols-12 items-center gap-2 px-3 py-1.5 font-mono text-[11px] tabular-nums transition-colors ${active ? "bg-bull/10" : "hover:bg-surface"}`}>
              <button
                className="col-span-5 flex items-center gap-1.5 text-left text-fg"
                onClick={() => onPickSymbol({ sym, name: q?.name || sym, exch: q?.exch || "" })}
              >
                <SymBadge sym={sym} />
                <span className="truncate">{sym}</span>
              </button>
              <span className="col-span-3 text-right text-fg">{q?.last != null ? fmt(q.last, 2) : "—"}</span>
              <span className={`col-span-2 text-right ${(q?.chg ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>
                {q?.chg != null ? `${q.chg >= 0 ? "+" : ""}${fmt(q.chg, 2)}` : "—"}
              </span>
              <span className={`col-span-2 text-right flex items-center justify-end gap-1 ${(q?.chgPct ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>
                <span>{q?.chgPct != null ? `${q.chgPct >= 0 ? "+" : ""}${fmt(q.chgPct, 2)}%` : "—"}</span>
                <button onClick={() => removeSym(sym)} title="Remove" className="ml-1 hidden size-4 items-center justify-center text-fg-faint group-hover:flex hover:text-bear">×</button>
              </span>
            </div>
          );
        })}
        {!list.length && <div className="px-3 py-4 text-center font-mono text-[11px] uppercase tracking-wider text-fg-faint">empty list — add a symbol above</div>}
      </div>

      {/* Symbol details */}
      <div className="border-t border-border bg-bg p-3">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          <div className="flex items-center gap-2">
            <SymBadge sym={symMeta.sym} />
            <span className="text-fg">{symMeta.sym}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`px-1.5 py-0.5 text-[9px] ${live?.marketState === "REGULAR" ? "border border-bull/40 text-bull" : "border border-border text-fg-faint"}`}>
              {live?.marketState || "—"}
            </span>
          </div>
        </div>
        <div className="mt-1 text-[10px] tracking-wider text-fg-faint">
          {symMeta.name} <span className="text-fg-faint">·</span> {symMeta.exch}
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-3xl tracking-tightest tabular-nums text-fg">
            {live?.last != null ? fmt(live.last, 2) : "—"}
          </span>
          <span className="font-mono text-[10px] text-fg-faint">{live?.currency || ""}</span>
        </div>
        <div className={`mt-1 font-mono text-[11px] ${(live?.chg ?? 0) >= 0 ? "text-bull" : "text-bear"}`}>
          {live?.chg != null ? `${live.chg >= 0 ? "+" : ""}${fmt(live.chg, 2)}` : "—"} · {live?.chgPct != null ? `${live.chgPct >= 0 ? "+" : ""}${fmt(live.chgPct, 2)}%` : "—"}
        </div>
        {hist.length > 1 && (
          <svg viewBox="0 0 100 30" className="mt-2 h-8 w-full" preserveAspectRatio="none">
            <path d={sparkPath} fill="none" stroke={(live?.chg ?? 0) >= 0 ? "var(--bull)" : "var(--bear)"} strokeWidth="1.4" pathLength={1} className="svg-draw-fast" />
          </svg>
        )}

        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-fg-faint">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          live · refreshing every 15s
        </div>
      </div>

      {/* Performance grid */}
      <div className="border-t border-border bg-bg p-3">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          <span className="text-fg">Performance</span>
          <span className="text-fg-faint">vs prev close</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-px bg-border-soft">
          {(["1D", "1M", "3M", "6M", "YTD", "1Y"] as const).map((k) => {
            const v = perf[k];
            const colour = v == null ? "var(--fg-faint)" : v >= 0 ? "var(--bull)" : "var(--bear)";
            return (
              <div key={k} className="bg-bg p-2">
                <div className="font-display text-base tabular-nums" style={{ color: colour }}>
                  {v != null ? `${v >= 0 ? "+" : ""}${fmt(v, 2)}%` : "—"}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">{k}</div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function SymBadge({ sym }: { sym: string }) {
  const palette = ["#00ff87", "#22d3ee", "#ffb800", "#ff2e63", "#a78bfa", "#c9ff00", "#06b6d4"];
  const c = palette[sym.charCodeAt(0) % palette.length];
  return (
    <span className="flex size-4 items-center justify-center" style={{ borderColor: c, color: c, border: `1px solid ${c}` }}>
      <span className="text-[7px] font-bold leading-none">{sym.replace(/^[\^]/, "").slice(0, 2)}</span>
    </span>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { track } from "@/lib/track";
import { fmt } from "./chartCore";
import type { SymbolDef } from "./TopBar";
const DEFAULT_LIST: { sym: string }[] = [
  { sym: "^NSEI" }, { sym: "^NSEBANK" }, { sym: "^GSPC" }, { sym: "^IXIC" },
  { sym: "AAPL" }, { sym: "NVDA" }, { sym: "TSLA" }, { sym: "AMZN" }, { sym: "MSFT" }, { sym: "META" }, { sym: "GOOGL" },
  { sym: "BTC-USD" }, { sym: "ETH-USD" },
];

type LiveQuote = { sym: string; name?: string; last?: number; chg?: number; chgPct?: number; currency?: string; exch?: string; marketState?: string; marketTime?: number | null };

type Props = {
  symbol: SymbolDef;
  onPickSymbol: (s: SymbolDef) => void;
  /** Fresh poll result for the charted symbol — the page patches it into the
      developing candle so chart and rail never disagree on the last price. */
  onQuote?: (sym: string, last: number, marketTime?: number) => void;
};

// Absent data is NOT a direction. `(q?.chg ?? 0) >= 0` coalesced a missing
// quote to 0, took the >= branch, and painted the "—" placeholder in --bull —
// so an entire watchlist with no feed rendered as a wall of green. On a product
// whose thesis is that retail traders get misled by numbers, that is the worst
// possible default. Chart.tsx:1091 already had the right shape
// (`pnl == null ? "var(--fg-dim)"`); these two put it where the quotes are.
const dirClass = (v: number | null | undefined) =>
  v == null ? "text-fg-faint" : v >= 0 ? "text-bull" : "text-bear";
const dirStroke = (v: number | null | undefined) =>
  v == null ? "var(--fg-faint)" : v >= 0 ? "var(--bull)" : "var(--bear)";

export function RightPanel({ symbol, onPickSymbol, onQuote }: Props) {
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

  // Collapsible fixed sections — the pair permanently ate ~250px of the 300px
  // column, squeezing the watchlist to a handful of rows. Persisted the same
  // way as lb-pro-watchlist. Read lazily (not in an effect) so there is no
  // open→closed flicker on mount; SSR falls back to open.
  const [detailsOpen, setDetailsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("lb-pro-details-open") !== "0"; } catch { return true; }
  });
  const [perfOpen, setPerfOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("lb-pro-perf-open") !== "0"; } catch { return true; }
  });
  // Persist OUTSIDE the updater — StrictMode double-invokes updaters (see the
  // undo-history comment in app/pro/page.tsx), so side effects don't belong there.
  const toggleSection = (key: "details" | "perf") => {
    const next = key === "details" ? !detailsOpen : !perfOpen;
    try { localStorage.setItem(`lb-pro-${key}-open`, next ? "1" : "0"); } catch {}
    (key === "details" ? setDetailsOpen : setPerfOpen)(next);
  };

  // persist
  useEffect(() => {
    try { localStorage.setItem("lb-pro-watchlist", JSON.stringify(list)); } catch {}
  }, [list]);

  // ── profile sync via the /api/watchlists backend. localStorage stays the
  // offline cache; signed in, the server copy is the cross-device truth.
  const { status: authStatus } = useSession();
  const listRef = useRef(list);
  listRef.current = list;
  const adoptingListRef = useRef(false);
  const pulledRef = useRef(false);

  useEffect(() => {
    if (authStatus !== "authenticated" || pulledRef.current) return;
    pulledRef.current = true;
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/watchlists");
        if (!alive || !r.ok) return;
        const j = await r.json();
        if (!j?.ok) return;
        if (Array.isArray(j.symbols) && j.symbols.length) {
          // Server copy exists → adopt it (and don't echo it straight back up).
          adoptingListRef.current = true;
          setList(j.symbols as string[]);
          setTimeout(() => { adoptingListRef.current = false; }, 0);
        } else {
          // First sign-in from this account → seed the profile with the local list.
          void fetch("/api/watchlists", {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ symbols: listRef.current }),
          }).catch(() => {});
        }
      } catch {
        /* offline — the debounced push below retries on the next edit */
      }
    })();
    return () => { alive = false; };
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    if (adoptingListRef.current) return; // the adopt itself isn't an edit
    const id = setTimeout(() => {
      track("watchlist_changed", { count: list.length });
      void fetch("/api/watchlists", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbols: list }),
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(id);
  }, [list, authStatus]);

  // The voice co-pilot sends add/remove *intents* rather than writing storage
  // itself — this component stays the single writer, so an agent edit can never
  // race (and undo) a manual edit.
  useEffect(() => {
    const onAdd = (e: Event) => {
      const t = (e as CustomEvent<{ ticker?: string }>).detail?.ticker?.trim().toUpperCase();
      if (t) setList((cur) => (cur.includes(t) ? cur : [...cur, t]));
    };
    const onRemove = (e: Event) => {
      const t = (e as CustomEvent<{ ticker?: string }>).detail?.ticker?.trim().toUpperCase();
      if (t) setList((cur) => cur.filter((s) => s !== t));
    };
    window.addEventListener("lb-watchlist-add", onAdd);
    window.addEventListener("lb-watchlist-remove", onRemove);
    return () => {
      window.removeEventListener("lb-watchlist-add", onAdd);
      window.removeEventListener("lb-watchlist-remove", onRemove);
    };
  }, []);

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
        const live = map[symbol.sym];
        if (live?.last != null) onQuote?.(symbol.sym, live.last, live.marketTime ?? undefined);
      } catch {}
    };
    fetchQuotes();
    const id = setInterval(fetchQuotes, 15000);
    return () => { alive = false; clearInterval(id); };
  }, [list, symbol.sym, onQuote]);

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
    <aside className="flex w-full flex-col border-t border-border bg-surface lg:w-[300px] lg:shrink-0 lg:border-l lg:border-t-0">
      {/* Watchlist header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2 t-chrome text-fg-dim">
        {/* A real heading, not a styled span: /pro shipped with ZERO headings, so a
            screen reader got no document outline for the whole terminal. Tailwind
            preflight zeroes heading margin/size/weight, so this renders
            byte-identically to the span it replaces. */}
        <h2 className="text-fg">Watchlist</h2>
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
          <div className="absolute left-2 right-2 top-11 z-30 max-h-72 overflow-y-auto surface-instrument border border-border bg-surface shadow-2xl">
            {results.map((r) => (
              <button
                key={r.sym}
                onClick={() => { addSym(r.sym); setSearch(""); setResults([]); }}
                className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left font-mono text-[11px] hover:bg-surface"
              >
                <div>
                  <div className="text-fg">{r.sym}</div>
                  <div className="text-[10px] normal-case tracking-normal text-fg-faint">{r.name}</div>
                </div>
                <span className="text-[10px] text-fg-faint">{r.exch}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* column header */}
      <div className="grid grid-cols-12 gap-2 border-b border-border-soft px-3 py-1 t-chrome text-fg-faint">
        <span className="col-span-5">Symbol</span>
        <span className="col-span-3 text-right">Last</span>
        <span className="col-span-2 text-right">Chg</span>
        <span className="col-span-2 text-right">Chg%</span>
      </div>

      {/* watchlist */}
      {/* dock-clear reserves the Dock's bottom-right footprint on touch, so the
          last rows of the watchlist cannot end up underneath the orb. */}
      {/* /var(--ui-zoom): html renders zoomed, so raw vh over-measures.
          lg:min-h keeps ~8 rows visible however tall the sections below get. */}
      <div className="dock-clear max-h-[calc(45vh/var(--ui-zoom))] flex-1 overflow-y-auto lg:max-h-none lg:min-h-[224px]">
        {list.map((sym) => {
          const q = quotes[sym];
          const active = sym === symbol.sym;
          return (
            <div key={sym} className={`group relative grid grid-cols-12 items-center gap-2 px-3 py-1.5 t-data text-[11px] transition-colors ${active ? "bg-bull/10" : "hover:bg-surface"}`}>
              <button
                className="col-span-5 flex items-center gap-1.5 text-left text-fg"
                onClick={() => onPickSymbol({ sym, name: q?.name || sym, exch: q?.exch || "" })}
              >
                <SymBadge sym={sym} />
                <span className="truncate">{sym}</span>
              </button>
              <span className="col-span-3 text-right text-fg">{q?.last != null ? fmt(q.last, 2) : "—"}</span>
              <span className={`col-span-2 text-right ${dirClass(q?.chg)}`}>
                {q?.chg != null ? `${q.chg >= 0 ? "+" : ""}${fmt(q.chg, 2)}` : "—"}
              </span>
              <span className={`col-span-2 text-right ${dirClass(q?.chgPct)}`}>
                {q?.chgPct != null ? `${q.chgPct >= 0 ? "+" : ""}${fmt(q.chgPct, 2)}%` : "—"}
              </span>
              {/* Hover ✕ floats over the row's right padding rather than inside
                  the ~39px Chg% cell, where it crowded the number with no gap. */}
              <button onClick={() => removeSym(sym)} title="Remove" className="absolute right-1 top-1/2 hidden size-4 -translate-y-1/2 items-center justify-center bg-surface text-fg-faint group-hover:flex hover:text-bear">×</button>
            </div>
          );
        })}
        {!list.length && <div className="px-3 py-4 text-center font-mono text-[11px] uppercase tracking-wider text-fg-faint">empty list — add a symbol above</div>}
      </div>

      {/* Symbol details — collapsible: with Performance below it, the pair ate
          ~250px of the 300px column and left the watchlist a few cut rows. */}
      <div className={`border-t border-border bg-bg px-3 py-2 ${detailsOpen ? "pb-3" : ""}`}>
        <div className="flex items-center justify-between t-chrome text-fg-dim">
          <button
            onClick={() => toggleSection("details")}
            aria-expanded={detailsOpen}
            className="flex items-center gap-2 text-left transition-colors hover:text-fg"
          >
            <SymBadge sym={symMeta.sym} />
            <span className="text-fg">{symMeta.sym}</span>
            <span className={`text-fg-faint transition-transform ${detailsOpen ? "" : "rotate-180"}`}>⌄</span>
          </button>
          <div className="flex items-center gap-1">
            <span className={`px-1.5 py-0.5 text-[10px] ${live?.marketState === "REGULAR" ? "border border-bull/40 text-bull" : "border border-border text-fg-faint"}`}>
              {live?.marketState || "—"}
            </span>
          </div>
        </div>
        {detailsOpen && (<>
        <div className="mt-1 text-[10px] tracking-wider text-fg-faint">
          {symMeta.name} <span className="text-fg-faint">·</span> {symMeta.exch}
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="font-display text-3xl tracking-tightest tabular-nums text-fg">
            {live?.last != null ? fmt(live.last, 2) : "—"}
          </span>
          <span className="font-mono text-[10px] text-fg-faint">{live?.currency || ""}</span>
        </div>
        <div className={`mt-1 font-mono text-[11px] ${dirClass(live?.chg)}`}>
          {live?.chg != null ? `${live.chg >= 0 ? "+" : ""}${fmt(live.chg, 2)}` : "—"} · {live?.chgPct != null ? `${live.chgPct >= 0 ? "+" : ""}${fmt(live.chgPct, 2)}%` : "—"}
        </div>
        {hist.length > 1 && (
          <svg viewBox="0 0 100 30" className="mt-2 h-8 w-full" preserveAspectRatio="none">
            <path d={sparkPath} fill="none" stroke={dirStroke(live?.chg)} strokeWidth="1.4" pathLength={1} className="svg-draw-fast" />
          </svg>
        )}

        <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-fg-faint">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          live · refreshing every 15s
        </div>
        </>)}
      </div>

      {/* Performance grid — collapsible, same reason as Symbol details. */}
      <div className={`border-t border-border bg-bg px-3 py-2 ${perfOpen ? "pb-3" : ""}`}>
        <div className="flex items-center justify-between t-chrome text-fg-dim">
          <button
            onClick={() => toggleSection("perf")}
            aria-expanded={perfOpen}
            className="flex items-center gap-2 text-left transition-colors hover:text-fg"
          >
            <h2 className="text-fg">Performance</h2>
            <span className={`text-fg-faint transition-transform ${perfOpen ? "" : "rotate-180"}`}>⌄</span>
          </button>
          {perfOpen && <span className="text-fg-faint">vs prev close</span>}
        </div>
        {perfOpen && (
        <div className="mt-2 grid grid-cols-3 gap-px bg-border-soft">
          {(["1D", "1M", "3M", "6M", "YTD", "1Y"] as const).map((k) => {
            const v = perf[k];
            const colour = v == null ? "var(--fg-faint)" : v >= 0 ? "var(--bull)" : "var(--bear)";
            return (
              <div key={k} className="bg-bg p-2">
                <div className="font-display text-base tabular-nums" style={{ color: colour }}>
                  {v != null ? `${v >= 0 ? "+" : ""}${fmt(v, 2)}%` : "—"}
                </div>
                <div className="t-chrome text-fg-faint">{k}</div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </aside>
  );
}

function SymBadge({ sym }: { sym: string }) {
  const palette = ["#00ff87", "#22d3ee", "#ffb800", "#ff2e63", "#a78bfa", "#c9ff00", "#06b6d4"];
  const c = palette[sym.charCodeAt(0) % palette.length];
  return (
    <span className="flex size-4 items-center justify-center" style={{ borderColor: c, color: c, border: `1px solid ${c}` }}>
      <span className="text-[10px] font-bold leading-none">{sym.replace(/^[\^]/, "").slice(0, 2)}</span>
    </span>
  );
}

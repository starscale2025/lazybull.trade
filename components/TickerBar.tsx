"use client";

import { useEffect, useState } from "react";

const SYMBOLS = [
  "AMZN", "NVDA", "TSLA", "AAPL", "MSFT", "AMD",
  "META", "GOOGL", "SPY", "QQQ", "IWM", "GLD",
  "^VIX", "GME", "PLTR", "COIN", "AVGO", "NFLX",
];

const DISPLAY: Record<string, string> = { "^VIX": "VIX" };

type Quote = {
  sym: string;
  last: number;
  chgPct: number;
  marketState?: string;
};

function fmtPrice(n: number): string {
  if (n >= 1000) return n.toFixed(2);
  if (n >= 100) return n.toFixed(2);
  if (n >= 10) return n.toFixed(2);
  return n.toFixed(2);
}
function fmtPct(p: number): string {
  const s = p >= 0 ? "+" : "−";
  return `${s}${Math.abs(p).toFixed(2)}%`;
}
function fmtClock(d: Date): string {
  return d.toUTCString().split(" ")[4]; // HH:MM:SS
}

export function TickerBar() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clock, setClock] = useState<string>("");
  const [marketState, setMarketState] = useState<string>("");

  // Live quote poll
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      try {
        const r = await fetch(`/api/quote-batch?symbols=${SYMBOLS.join(",")}`);
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.quotes)) {
          setQuotes(j.quotes);
          const ms = j.quotes.find((q: Quote) => q.sym === "SPY")?.marketState;
          if (ms) setMarketState(ms);
        }
      } catch {
        /* keep prior quotes on transient error */
      }
    };
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Wall clock
  useEffect(() => {
    setClock(fmtClock(new Date()));
    const id = setInterval(() => setClock(fmtClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  const items = quotes.length > 0 ? [...quotes, ...quotes] : [];
  const stateLabel =
    marketState === "REGULAR" ? "NYSE OPEN" :
    marketState === "PRE" ? "PRE-MARKET" :
    marketState === "POST" ? "POST-MARKET" :
    marketState === "CLOSED" ? "MARKET CLOSED" :
    "WAITING…";

  return (
    <div className="relative overflow-hidden border-b border-border bg-bg font-mono text-[11px] uppercase tracking-wider">
      <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-2 bg-bg pl-3 pr-4 border-r border-border">
        <span className="size-1.5 rounded-full bg-bull pulse-dot" />
        <span className="text-bull">LIVE</span>
        <span className="text-fg-faint">·</span>
        <span className="text-fg-dim hidden sm:inline">{stateLabel}</span>
      </div>
      <div className="flex marquee gap-8 py-2 pl-32">
        {items.length === 0 ? (
          <span className="flex items-center gap-2 whitespace-nowrap shrink-0 text-fg-faint">
            fetching live quotes from Yahoo Finance…
          </span>
        ) : (
          items.map((t, i) => {
            const sym = DISPLAY[t.sym] ?? t.sym;
            const up = t.chgPct >= 0;
            return (
              <span key={`${t.sym}-${i}`} className="flex items-center gap-2 whitespace-nowrap shrink-0">
                <span className="text-fg-dim">{sym}</span>
                <span className="text-fg">{fmtPrice(t.last)}</span>
                <span className={up ? "text-bull" : "text-bear"}>{fmtPct(t.chgPct)}</span>
                <span className="text-fg-faint">·</span>
              </span>
            );
          })
        )}
      </div>
      <div className="absolute inset-y-0 right-0 z-10 flex items-center gap-2 bg-bg pl-4 pr-3 border-l border-border">
        <span className="text-fg-dim tabular-nums">{clock || "--:--:--"}</span>
        <span className="text-fg-faint">UTC</span>
      </div>
    </div>
  );
}

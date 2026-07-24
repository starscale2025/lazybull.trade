"use client";

import { useEffect, useState } from "react";
import { applyWonk, wonkFromVix } from "@/lib/wonk";
import { useLiveQuotes } from "@/lib/streaming/useLiveQuotes";

const SYMBOLS = [
  "AMZN", "NVDA", "TSLA", "AAPL", "MSFT", "AMD",
  "META", "GOOGL", "SPY", "QQQ", "IWM", "GLD",
  "^VIX", "GME", "PLTR", "COIN", "AVGO", "NFLX",
];

const DISPLAY: Record<string, string> = { "^VIX": "VIX" };

function fmtPrice(n: number): string {
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
  // Live prices now PUSH over one shared SSE stream (see lib/streaming) instead
  // of this component polling — the marquee ticks the moment a quote changes,
  // with no per-component interval. The manager falls back to polling
  // /api/quote-batch automatically if the stream can't establish.
  const live = useLiveQuotes(SYMBOLS);
  const [clock, setClock] = useState<string>("");

  // The Volatility Wonk: the live VIX drives Fraunces' WONK/SOFT axes
  // (see lib/wonk.ts and .wonk-type in globals.css).
  const vix = live["^VIX"]?.last;
  useEffect(() => {
    if (typeof vix === "number" && Number.isFinite(vix)) applyWonk(wonkFromVix(vix));
  }, [vix]);

  // Wall clock
  useEffect(() => {
    setClock(fmtClock(new Date()));
    const id = setInterval(() => setClock(fmtClock(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  const [paused, setPaused] = useState(false);
  const quotes = SYMBOLS.map((s) => live[s]).filter((q): q is NonNullable<typeof q> => !!q);
  const items = quotes.length > 0 ? [...quotes, ...quotes] : [];
  const marketState = live["SPY"]?.marketState ?? "";
  const stateLabel =
    marketState === "REGULAR" ? "NYSE OPEN" :
    marketState === "PRE" ? "PRE-MARKET" :
    marketState === "POST" ? "POST-MARKET" :
    marketState === "CLOSED" ? "MARKET CLOSED" :
    "WAITING…";

  return (
    <div
      className={`relative overflow-hidden border-b border-border bg-bg font-mono text-[11px] uppercase tracking-wider ${paused ? "marquee-paused" : ""}`}
    >
      <div className="absolute inset-y-0 left-0 z-10 flex items-center gap-2 bg-bg pl-3 pr-4 border-r border-border">
        <span className="size-1.5 rounded-full bg-bull pulse-dot" />
        <span className="text-bull">LIVE</span>
        <span className="text-fg-faint">·</span>
        <span className="text-fg-dim hidden sm:inline">{stateLabel}</span>
        {/* WCAG 2.2.2 — an auto-moving ticker on every page must be pausable */}
        <button
          onClick={() => setPaused((v) => !v)}
          aria-pressed={paused}
          aria-label={paused ? "Resume ticker scrolling" : "Pause ticker scrolling"}
          className="ml-1 text-fg-faint transition-colors hover:text-fg"
        >
          {paused ? "▶" : "⏸"}
        </button>
      </div>
      <div className="flex marquee gap-8 py-2 pl-32">
        {items.length === 0 ? (
          <span className="flex items-center gap-2 whitespace-nowrap shrink-0 text-fg-faint">
            connecting to the live quote stream…
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

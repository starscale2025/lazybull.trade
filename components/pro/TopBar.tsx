"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export type SymbolDef = { sym: string; name: string; exch: string };

export const SEED_SYMBOLS: SymbolDef[] = [
  { sym: "AAPL", name: "Apple Inc.", exch: "NASDAQ" },
  { sym: "NVDA", name: "Nvidia Corp.", exch: "NASDAQ" },
  { sym: "TSLA", name: "Tesla Inc.", exch: "NASDAQ" },
  { sym: "AMZN", name: "Amazon.com", exch: "NASDAQ" },
  { sym: "MSFT", name: "Microsoft Corp.", exch: "NASDAQ" },
  { sym: "META", name: "Meta Platforms", exch: "NASDAQ" },
  { sym: "GOOGL", name: "Alphabet Inc.", exch: "NASDAQ" },
  { sym: "SPY", name: "SPDR S&P 500 ETF", exch: "ARCA" },
  { sym: "QQQ", name: "Invesco QQQ", exch: "NASDAQ" },
  { sym: "BTC-USD", name: "Bitcoin", exch: "CCC" },
  { sym: "ETH-USD", name: "Ethereum", exch: "CCC" },
  { sym: "^NSEI", name: "Nifty 50 Index", exch: "NSE" },
  { sym: "^NSEBANK", name: "Bank Nifty", exch: "NSE" },
  { sym: "^GSPC", name: "S&P 500", exch: "INDEX" },
];

export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "D", "W", "M"];

export const INDICATORS = [
  { id: "ema20", label: "EMA 20", desc: "Exponential moving avg", color: "var(--cyan)" },
  { id: "ema50", label: "EMA 50", desc: "Exponential moving avg", color: "#a78bfa" },
  { id: "rsi", label: "RSI 14", desc: "Relative strength index · pane", color: "var(--cyan)" },
  { id: "macd", label: "MACD", desc: "12 / 26 / 9 · pane", color: "var(--amber)" },
  { id: "bb", label: "BB 20·2σ", desc: "Bollinger bands", color: "var(--bull)" },
  { id: "vwap", label: "VWAP", desc: "Volume-weighted price", color: "var(--amber)" },
  { id: "ichimoku", label: "Ichimoku", desc: "Cloud · 9 · 26 · 52", color: "var(--plasma)" },
  { id: "supertrend", label: "Supertrend", desc: "ATR-based trend stop", color: "var(--bear)" },
];

type Chart = "candles" | "line" | "area" | "bars";

type Props = {
  symbol: SymbolDef;
  setSymbol: (s: SymbolDef) => void;
  timeframe: string;
  setTimeframe: (t: string) => void;
  chart: Chart;
  setChart: (c: Chart) => void;
  indicators: string[];
  toggleIndicator: (id: string) => void;
  onReplay: () => void;
  onAlert: () => void;
  layout: number;
  setLayout: (n: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFullscreen: () => void;
  onSnapshot: () => void;
  onTrade: () => void;
  onPublish: () => void;
  onCompare: () => void;
};

export function TopBar({
  symbol, setSymbol, timeframe, setTimeframe, chart, setChart,
  indicators, toggleIndicator, onReplay, onAlert,
  layout, setLayout, onUndo, onRedo, onFullscreen, onSnapshot, onTrade, onPublish, onCompare,
}: Props) {
  const [symOpen, setSymOpen] = useState(false);
  const [indOpen, setIndOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SymbolDef[]>([]);
  const [searching, setSearching] = useState(false);

  // live search via API (debounced)
  useEffect(() => {
    const q = query.trim();
    if (!symOpen) return;
    if (!q) { setSearchResults([]); return; }
    setSearching(true);
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/symbol-search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (j.ok) setSearchResults(j.items as SymbolDef[]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(id);
  }, [query, symOpen]);

  const list = query.trim() ? searchResults : SEED_SYMBOLS;

  return (
    <div className="relative z-30 flex h-11 items-center gap-1 border-b border-border bg-bg-soft px-2 font-mono text-[11px] uppercase tracking-wider">
      <div className="relative">
        <button
          onClick={() => setSymOpen((o) => !o)}
          className="flex h-8 items-center gap-2 border border-border bg-bg px-2 hover:border-fg-dim"
        >
          <SymGlyph sym={symbol.sym} />
          <span className="text-fg">{symbol.sym}</span>
          <Caret />
        </button>
        <AnimatePresence>
          {symOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-9 z-40 w-[360px] border border-border bg-bg shadow-2xl"
            >
              <div className="flex items-center gap-2 border-b border-border-soft p-2">
                <span className="text-fg-faint">⌕</span>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Yahoo Finance — AAPL, NIFTY, BTC, RELIANCE.NS…"
                  className="flex-1 bg-transparent font-mono text-[11px] uppercase text-fg outline-none placeholder:text-fg-faint"
                  onKeyDown={(e) => e.key === "Escape" && setSymOpen(false)}
                />
                {searching && <span className="text-cyan">…</span>}
              </div>
              <ul className="max-h-[360px] overflow-y-auto">
                {list.map((s) => (
                  <li key={s.sym}>
                    <button
                      onClick={() => { setSymbol(s); setSymOpen(false); setQuery(""); setSearchResults([]); }}
                      className={`flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left transition-colors ${
                        s.sym === symbol.sym ? "bg-bull/10 text-bull" : "text-fg-dim hover:bg-surface hover:text-fg"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <SymGlyph sym={s.sym} />
                        <div className="flex flex-col">
                          <span className="text-fg leading-tight">{s.sym}</span>
                          <span className="text-[9px] text-fg-faint normal-case tracking-normal">{s.name}</span>
                        </div>
                      </div>
                      <span className="text-[9px] text-fg-faint">{s.exch}</span>
                    </button>
                  </li>
                ))}
                {!list.length && !searching && (
                  <li className="px-3 py-4 text-center font-mono text-[10px] uppercase tracking-wider text-fg-faint">no matches</li>
                )}
              </ul>
              <div className="border-t border-border-soft px-3 py-1.5 font-mono text-[9px] text-fg-faint">
                live data via Yahoo Finance
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        title="Compare another symbol on this chart"
        onClick={onCompare}
        className="flex size-8 items-center justify-center border border-transparent text-fg-dim hover:border-border hover:text-fg"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      <Sep />

      <div className="flex items-center gap-1">
        {TIMEFRAMES.map((t) => (
          <button
            key={t}
            onClick={() => setTimeframe(t)}
            className={`h-8 min-w-7 border px-1.5 transition-colors ${
              t === timeframe ? "border-bull bg-bull/10 text-bull" : "border-transparent bg-bg text-fg-dim hover:border-border hover:text-fg"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Sep />

      {/* chart type */}
      <div className="relative">
        <button onClick={() => setChartOpen((o) => !o)} title="Chart type" className="flex h-8 items-center gap-1 border border-border bg-bg px-2 text-fg hover:border-fg-dim">
          <ChartTypeIcon type={chart} />
          <Caret />
        </button>
        <AnimatePresence>
          {chartOpen && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="absolute left-0 top-9 z-40 w-44 border border-border bg-bg shadow-2xl">
              {(["candles", "line", "area", "bars"] as Chart[]).map((c) => (
                <button
                  key={c}
                  onClick={() => { setChart(c); setChartOpen(false); }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${c === chart ? "bg-bull/10 text-bull" : "text-fg-dim hover:bg-surface hover:text-fg"}`}
                >
                  <ChartTypeIcon type={c} />
                  <span className="text-fg">{c}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Sep />

      <div className="relative">
        <button
          onClick={() => setIndOpen((o) => !o)}
          className="flex h-8 items-center gap-2 border border-transparent bg-bg px-2 text-fg-dim hover:border-border hover:text-fg"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17l4-4 4 4 4-8 6 8" />
          </svg>
          Indicators
          {indicators.length > 0 && <span className="text-bull">{indicators.length}</span>}
        </button>
        <AnimatePresence>
          {indOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-9 z-40 w-72 border border-border bg-bg shadow-2xl"
            >
              <div className="border-b border-border-soft px-3 py-2 text-[10px] text-fg-dim normal-case tracking-normal">
                Built-in studies — toggle to layer on the chart
              </div>
              <ul>
                {INDICATORS.map((i) => {
                  const on = indicators.includes(i.id);
                  return (
                    <li key={i.id}>
                      <button
                        onClick={() => toggleIndicator(i.id)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                          on ? "bg-bull/10" : "hover:bg-surface"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="size-2.5" style={{ background: i.color }} />
                          <div className="flex flex-col">
                            <span className="text-fg leading-tight">{i.label}</span>
                            <span className="text-[9px] text-fg-faint normal-case tracking-normal">{i.desc}</span>
                          </div>
                        </div>
                        <span className={`size-3 border ${on ? "border-bull bg-bull" : "border-fg-faint"}`} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Sep />

      <ToolbarBtn icon={<IconBell />} label="Alert" onClick={onAlert} />
      <ToolbarBtn icon={<IconReplay />} label="Replay" onClick={onReplay} />
      <ToolbarBtn icon={<IconUndo />} label="Undo" onClick={onUndo} />
      <ToolbarBtn icon={<IconRedo />} label="Redo" onClick={onRedo} />

      <div className="ml-auto flex items-center gap-1">
        <div className="relative">
          <button
            onClick={() => setLayoutOpen((o) => !o)}
            className="flex h-8 items-center gap-1 border border-border bg-bg px-2 text-fg-dim hover:text-fg"
            title="Multi-pane layout"
          >
            <span className="grid grid-cols-2 gap-px">
              <span className="size-1.5 bg-current" />
              <span className="size-1.5 bg-current" />
              <span className="size-1.5 bg-current" />
              <span className="size-1.5 bg-current" />
            </span>
            <span>×{layout}</span>
          </button>
          <AnimatePresence>
            {layoutOpen && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="absolute right-0 top-9 z-40 grid w-48 grid-cols-2 gap-1 border border-border bg-bg p-2 shadow-2xl">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => { setLayout(n); setLayoutOpen(false); }}
                    className={`flex h-12 items-center justify-center border ${n === layout ? "border-bull text-bull" : "border-border text-fg-dim hover:text-fg"}`}
                  >
                    <span className="grid grid-cols-2 gap-0.5">
                      {Array.from({ length: n }).map((_, i) => (
                        <span key={i} className="size-3 bg-current" />
                      ))}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ToolbarBtn icon={<IconFullscreen />} label="Full" onClick={onFullscreen} />
        <ToolbarBtn icon={<IconCamera />} label="Snap" onClick={onSnapshot} />

        <button
          onClick={onTrade}
          className="ml-1 flex h-8 items-center gap-2 border border-border bg-bg px-3 text-fg-dim hover:border-fg-dim hover:text-fg"
        >
          Trade
        </button>
        <button
          onClick={onPublish}
          className="flex h-8 items-center gap-2 bg-bull px-3 font-semibold text-bg hover:bg-bull-dim"
        >
          Publish
        </button>
      </div>
    </div>
  );
}

function ToolbarBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} title={label} className="flex h-8 items-center gap-1.5 border border-transparent bg-bg px-2 text-fg-dim hover:border-border hover:text-fg">
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function Sep() { return <span className="mx-1 h-5 w-px bg-border" aria-hidden />; }
function Caret() { return <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4l3 3 3-3" /></svg>; }

function ChartTypeIcon({ type }: { type: Chart }) {
  if (type === "candles") {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <rect x="6" y="8" width="3" height="8" /><line x1="7.5" y1="5" x2="7.5" y2="19" stroke="currentColor" />
        <rect x="13" y="6" width="3" height="11" fill="none" stroke="currentColor" /><line x1="14.5" y1="3" x2="14.5" y2="21" stroke="currentColor" />
      </svg>
    );
  }
  if (type === "line") return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 17l5-6 4 4 4-8 5 7" /></svg>;
  if (type === "area") return <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 18l5-7 4 5 4-9 5 6v5z" opacity="0.4" /><path d="M3 18l5-7 4 5 4-9 5 6" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="4" y="10" width="2" height="10" /><rect x="9" y="6" width="2" height="14" /><rect x="14" y="12" width="2" height="8" /><rect x="19" y="4" width="2" height="16" /></svg>;
}

function SymGlyph({ sym }: { sym: string }) {
  const palette = ["#00ff87", "#22d3ee", "#ffb800", "#ff2e63", "#a78bfa", "#c9ff00"];
  const c = palette[sym.charCodeAt(0) % palette.length];
  return (
    <span className="flex size-5 items-center justify-center border" style={{ borderColor: c, color: c }}>
      <span className="text-[8px] font-bold">{sym.replace(/^[\^]/, "").slice(0, 2)}</span>
    </span>
  );
}

function IconBell() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3V8z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>; }
function IconReplay() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="11,5 5,12 11,19" fill="currentColor"/><polygon points="19,5 13,12 19,19" fill="currentColor"/></svg>; }
function IconUndo() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L5 10l4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-2"/></svg>; }
function IconRedo() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l4-4-4-4"/><path d="M19 10h-9a5 5 0 0 0 0 10h2"/></svg>; }
function IconFullscreen() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>; }
function IconCamera() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13"/><circle cx="12" cy="13" r="4"/><path d="M9 7l1.5-3h3L15 7"/></svg>; }

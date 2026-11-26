"use client";

import { useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TogglePill, ToolButton } from "@/components/calm/kit";
import { typedTicker } from "@/lib/market-data/ticker";

export type SymbolDef = { sym: string; name: string; exch: string };
/** A search result: `typed` is the query offered as a ticker, `delayed` an Indian listing on the lag. */
type Found = SymbolDef & { typed?: boolean; delayed?: boolean };
type Menu = "sym" | "chart" | "ind" | "layout";

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
  { sym: "BTC-USD", name: "Bitcoin", exch: "CRYPTO" },
  { sym: "ETH-USD", name: "Ethereum", exch: "CRYPTO" },
];

export const TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "D", "W", "M"];

export const INDICATORS = [
  { id: "ema20", label: "EMA 20", desc: "Exponential moving avg", color: "var(--cyan)" },
  { id: "ema50", label: "EMA 50", desc: "Exponential moving avg", color: "var(--fg-dim)" },
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
};

export function TopBar({
  symbol, setSymbol, timeframe, setTimeframe, chart, setChart,
  indicators, toggleIndicator, onReplay, onAlert,
  layout, setLayout, onUndo, onRedo, onFullscreen, onSnapshot, onTrade, onPublish,
}: Props) {
  // One menu at a time. They used to be four independent flags, so the symbol
  // search, Indicators and the layout grid could all be open at once, stacked
  // over the chart and the order ticket, and nothing but their own button
  // closed them. Now opening one closes the rest, and Escape or a press
  // anywhere outside the open one closes it (Escape hands focus back).
  const [open, setOpen] = useState<Menu | null>(null);
  const toggle = (m: Menu) => setOpen((o) => (o === m ? null : m));
  const boxes = useRef<Partial<Record<Menu, HTMLDivElement | null>>>({});
  const triggers = useRef<Partial<Record<Menu, HTMLButtonElement | null>>>({});
  useEffect(() => {
    if (!open) return;
    const onPress = (e: PointerEvent) => {
      const box = boxes.current[open];
      if (box && e.target instanceof Node && box.contains(e.target)) return;
      setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      triggers.current[open]?.focus();
      setOpen(null);
    };
    document.addEventListener("pointerdown", onPress, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // Symbol search, a combobox: arrows move, Enter opens the highlighted row.
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ q: string; items: Found[]; source: "yahoo" | "list" } | null>(null);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  // An Enter that beat the debounce: picked as soon as its own results land,
  // never from the previous query's rows (typing NVDL fast would open NVDA).
  const pendingEnter = useRef<string | null>(null);
  const q = query.trim();
  const fresh = found && found.q === q ? found.items : null;
  const list: Found[] = q ? (fresh ?? found?.items ?? []) : SEED_SYMBOLS;

  const pick = (s: SymbolDef) => {
    setSymbol({ sym: s.sym, name: s.name, exch: s.exch });
    setOpen(null);
    setQuery("");
    setFound(null);
    setActive(0);
    pendingEnter.current = null;
  };

  useEffect(() => {
    if (open !== "sym" || !q) { setSearching(false); return; }
    setSearching(true);
    let alive = true;
    const id = setTimeout(async () => {
      let items: Found[] | null = null;
      let source: "yahoo" | "list" = "list";
      try {
        const r = await fetch(`/api/symbol-search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        if (j.ok) {
          items = j.items as Found[];
          source = j.source === "yahoo" ? "yahoo" : "list";
        }
      } catch {
        /* a failed lookup leaves the rows as they were */
      }
      if (!alive) return;
      setSearching(false);
      if (items) setFound({ q, items, source });
      if (pendingEnter.current === q) {
        const s = items?.[0] ?? typedTicker(q);
        if (s) pick(s);
      }
    }, 220);
    return () => { alive = false; clearTimeout(id); };
    // pick is recreated each render and only reads setters; q and open drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  useEffect(() => { setActive(0); }, [q, fresh]);
  useEffect(() => {
    if (open === "sym") document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, listId]);

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(0, list.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!q) { const s = SEED_SYMBOLS[active]; if (s) pick(s); return; }
      if (fresh) {
        const s = fresh[active] ?? fresh[0] ?? typedTicker(q);
        if (s) pick(s);
        return;
      }
      pendingEnter.current = q; // its results are on the way
    }
  };

  // min-[1350px], not lg, for the one-line bar: a single line needs ~1203 CSS
  // px, which under --ui-zoom (1.1) is ~1324 viewport px — so at lg (and even
  // at exactly xl/1280) Save, the only way to persist the workspace, was
  // clipped off the right edge. Below the threshold the bar wraps instead.
  return (
    <div className="relative z-30 flex flex-wrap items-center gap-1 border-b border-border bg-bg-soft px-2 py-1 t-label min-[1350px]:h-11 min-[1350px]:flex-nowrap min-[1350px]:py-0">
      <div className="relative" ref={(el) => { boxes.current.sym = el; }}>
        <ToolButton
          ref={(el) => { triggers.current.sym = el; }}
          onClick={() => toggle("sym")}
          aria-haspopup="listbox"
          aria-expanded={open === "sym"}
          aria-label={`Symbol ${symbol.sym}, change`}
          className="!px-2"
        >
          <SymGlyph sym={symbol.sym} />
          <span className="t-data">{symbol.sym}</span>
          <Caret />
        </ToolButton>
        <AnimatePresence>
          {open === "sym" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-9 z-40 w-[22.5rem] max-w-[calc(100vw/var(--ui-zoom)-1rem)] surface-instrument border border-border bg-surface shadow-2xl"
            >
              <div className="flex items-center gap-2 border-b border-border-soft p-2">
                <span className="text-fg-faint">⌕</span>
                <input
                  autoFocus
                  role="combobox"
                  aria-label="Search symbols"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={list[active] ? `${listId}-opt-${active}` : undefined}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onSearchKey}
                  placeholder="Symbol or company: AAPL, Nvidia, BTC-USD…"
                  className="flex-1 bg-transparent font-mono text-[0.6875rem] uppercase text-fg outline-none placeholder:font-sans placeholder:normal-case placeholder:text-fg-faint"
                />
                {searching && <span className="text-fg-faint">…</span>}
              </div>
              <ul id={listId} role="listbox" aria-label="Symbols" className="max-h-[22.5rem] overflow-y-auto">
                {list.map((s, i) => (
                  <li key={s.sym} role="presentation">
                    <button
                      type="button"
                      role="option"
                      id={`${listId}-opt-${i}`}
                      aria-selected={i === active}
                      tabIndex={-1}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(s)}
                      className={`flex w-full items-center justify-between gap-3 px-2 py-1.5 text-left transition-colors ${
                        i === active
                          ? "bg-surface text-fg"
                          : s.sym === symbol.sym
                            ? "bg-brand-ink/15 text-brand-ink"
                            : "text-fg-dim hover:bg-surface hover:text-fg"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <SymGlyph sym={s.sym} />
                        <div className="flex flex-col">
                          <span className="t-data leading-tight text-fg">{s.sym}</span>
                          <span className="text-[0.6875rem] text-fg-faint">{s.typed ? "Open this ticker" : s.name}</span>
                        </div>
                      </div>
                      <span className="t-chrome text-fg-faint">{s.delayed ? `${s.exch} · delayed` : s.exch}</span>
                    </button>
                  </li>
                ))}
                {!list.length && !searching && (
                  <li role="presentation" className="px-3 py-4 text-center t-label text-fg-faint">No matches</li>
                )}
              </ul>
              <div className="border-t border-border-soft px-3 py-1.5 t-label text-fg-faint">
                {found?.source === "yahoo"
                  ? "Search via Yahoo Finance · development only"
                  : "Not listed? Type the ticker and press Enter"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Sep />

      <div className="flex items-center gap-1">
        {TIMEFRAMES.map((t) => (
          <TogglePill
            key={t}
            on={t === timeframe}
            onClick={() => setTimeframe(t)}
            className="!h-7 !px-1.5 !text-[0.75rem] min-w-7 justify-center"
          >
            {t}
          </TogglePill>
        ))}
      </div>

      <Sep />

      {/* chart type */}
      <div className="relative" ref={(el) => { boxes.current.chart = el; }}>
        <ToolButton
          ref={(el) => { triggers.current.chart = el; }}
          onClick={() => toggle("chart")}
          aria-haspopup="true"
          aria-expanded={open === "chart"}
          aria-label={`Chart type: ${chart}`}
          title="Chart type"
          className="!px-2"
        >
          <ChartTypeIcon type={chart} />
          <Caret />
        </ToolButton>
        <AnimatePresence>
          {open === "chart" && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="absolute left-0 top-9 z-40 w-44 max-w-[calc(100vw/var(--ui-zoom)-1rem)] surface-instrument border border-border bg-bg shadow-2xl">
              {(["candles", "line", "area", "bars"] as Chart[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={c === chart}
                  onClick={() => { setChart(c); setOpen(null); }}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${c === chart ? "bg-brand-ink/15 text-brand-ink" : "text-fg-dim hover:bg-surface hover:text-fg"}`}
                >
                  <ChartTypeIcon type={c} />
                  <span className="capitalize text-fg">{c}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Sep />

      <div className="relative" ref={(el) => { boxes.current.ind = el; }}>
        <ToolButton
          ref={(el) => { triggers.current.ind = el; }}
          onClick={() => toggle("ind")}
          aria-haspopup="true"
          aria-expanded={open === "ind"}
          className="!px-2"
        >
          <svg aria-hidden viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 17l4-4 4 4 4-8 6 8" />
          </svg>
          Indicators
          {indicators.length > 0 && <span className="text-brand-ink">{indicators.length}</span>}
        </ToolButton>
        <AnimatePresence>
          {open === "ind" && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-9 z-40 w-72 max-w-[calc(100vw/var(--ui-zoom)-1rem)] surface-instrument border border-border bg-bg shadow-2xl"
            >
              <div className="border-b border-border-soft px-3 py-2 text-fg-dim">
                Built-in studies — toggle to layer on the chart
              </div>
              <ul>
                {INDICATORS.map((i) => {
                  const on = indicators.includes(i.id);
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleIndicator(i.id)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors ${
                          on ? "bg-brand-ink/12" : "hover:bg-surface"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ background: i.color }} />
                          <div className="flex flex-col">
                            <span className="text-fg leading-tight">{i.label}</span>
                            <span className="text-[0.6875rem] text-fg-faint">{i.desc}</span>
                          </div>
                        </div>
                        <span className={`size-3 rounded-[3px] border ${on ? "border-brand-ink bg-brand-ink" : "border-fg-faint"}`} aria-hidden />
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
        <div className="relative" ref={(el) => { boxes.current.layout = el; }}>
          <ToolButton
            ref={(el) => { triggers.current.layout = el; }}
            onClick={() => toggle("layout")}
            aria-haspopup="true"
            aria-expanded={open === "layout"}
            aria-label={`Layout: ${layout} chart${layout > 1 ? "s" : ""}`}
            title="Multi-pane layout"
            className="!px-2"
          >
            <span aria-hidden className="grid grid-cols-2 gap-px">
              <span className="size-1.5 bg-current" />
              <span className="size-1.5 bg-current" />
              <span className="size-1.5 bg-current" />
              <span className="size-1.5 bg-current" />
            </span>
            <span aria-hidden>×{layout}</span>
          </ToolButton>
          <AnimatePresence>
            {open === "layout" && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="absolute right-0 top-9 z-40 grid w-48 max-w-[calc(100vw/var(--ui-zoom)-1rem)] grid-cols-2 gap-1 surface-instrument border border-border bg-bg p-2 shadow-2xl">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={n === layout}
                    aria-label={`${n} chart${n > 1 ? "s" : ""}`}
                    title={`${n} chart${n > 1 ? "s" : ""}`}
                    onClick={() => { setLayout(n); setOpen(null); }}
                    className={`flex h-12 items-center justify-center rounded-[var(--r-instrument)] border ${n === layout ? "border-brand-ink text-brand-ink" : "border-border text-fg-dim hover:text-fg"}`}
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

        <ToolButton onClick={onTrade} className="ml-1">
          Trade
        </ToolButton>
        {/* "Save", not "Publish". The handler POSTs isPublic:false — nothing is
            published, and on a 401 it falls back to copying a share link. A
            control has to say what it does. */}
        <ToolButton primary onClick={onPublish}>
          Save
        </ToolButton>
      </div>
    </div>
  );
}

function ToolbarBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick?: () => void }) {
  return (
    <ToolButton onClick={onClick} title={label} className="!px-2">
      {icon}
      <span className="hidden md:inline">{label}</span>
    </ToolButton>
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
  return (
    <span className="flex size-5 items-center justify-center rounded bg-fg/10 text-fg-dim">
      <span className="font-mono text-[0.625rem] font-bold">{sym.replace(/^[\^]/, "").slice(0, 2)}</span>
    </span>
  );
}

function IconBell() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 8a6 6 0 0 1 12 0v5l2 3H4l2-3V8z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>; }
function IconReplay() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="11,5 5,12 11,19" fill="currentColor"/><polygon points="19,5 13,12 19,19" fill="currentColor"/></svg>; }
function IconUndo() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L5 10l4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-2"/></svg>; }
function IconRedo() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 14l4-4-4-4"/><path d="M19 10h-9a5 5 0 0 0 0 10h2"/></svg>; }
function IconFullscreen() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>; }
function IconCamera() { return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="13"/><circle cx="12" cy="13" r="4"/><path d="M9 7l1.5-3h3L15 7"/></svg>; }

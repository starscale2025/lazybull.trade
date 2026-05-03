"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { Chart, type ChartHandle, type Alert } from "@/components/pro/Chart";
import { LeftToolbar } from "@/components/pro/LeftToolbar";
import { TopBar, SEED_SYMBOLS, type SymbolDef } from "@/components/pro/TopBar";
import { RightPanel } from "@/components/pro/RightPanel";
import { BottomBar } from "@/components/pro/BottomBar";
import { ReplayBar } from "@/components/pro/ReplayBar";
import { AlertsPanel } from "@/components/pro/AlertsPanel";
import { TradeDrawer } from "@/components/pro/TradeDrawer";
import type { Bar, Drawing, ToolKind } from "@/components/pro/chartCore";

const PRESET_TO_LASTN: Record<string, number> = {
  "1D": 24, "5D": 60, "1M": 30, "3M": 90, "6M": 180, YTD: 250, "1Y": 260, "5Y": 1300, All: 99999,
};

type Workspace = {
  symbol: SymbolDef;
  timeframe: string;
  drawings: Drawing[];
  indicators: string[];
  layout: number;
  chart: "candles" | "line" | "area" | "bars";
  color: string;
  alerts: Alert[];
};

const DEFAULT_WORKSPACE: Workspace = {
  symbol: SEED_SYMBOLS[0],
  timeframe: "D",
  drawings: [],
  indicators: ["ema20", "vwap"],
  layout: 1,
  chart: "candles",
  color: "#00ff87",
  alerts: [],
};

export default function ProPage() {
  // ── core state
  const [symbol, setSymbol] = useState<SymbolDef>(DEFAULT_WORKSPACE.symbol);
  const [timeframe, setTimeframe] = useState<string>(DEFAULT_WORKSPACE.timeframe);
  const [tool, setTool] = useState<ToolKind>("cursor");
  const [drawings, _setDrawings] = useState<Drawing[]>([]);
  const [color, setColor] = useState(DEFAULT_WORKSPACE.color);
  const [indicators, setIndicators] = useState<string[]>(DEFAULT_WORKSPACE.indicators);
  const [layout, setLayout] = useState(DEFAULT_WORKSPACE.layout);
  const [chartType, setChartType] = useState<Workspace["chart"]>(DEFAULT_WORKSPACE.chart);
  const [preset, setPreset] = useState("All");
  const [intro, setIntro] = useState(true);

  // ── undo / redo
  const undoStack = useRef<Drawing[][]>([]);
  const redoStack = useRef<Drawing[][]>([]);
  const setDrawings = useCallback((next: Drawing[] | ((prev: Drawing[]) => Drawing[])) => {
    _setDrawings((prev) => {
      const nxt = typeof next === "function" ? (next as (p: Drawing[]) => Drawing[])(prev) : next;
      undoStack.current.push(prev);
      if (undoStack.current.length > 50) undoStack.current.shift();
      redoStack.current = [];
      return nxt;
    });
  }, []);
  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(drawings);
    _setDrawings(prev);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(drawings);
    _setDrawings(next);
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (cmd && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); }
      else if (!cmd && e.key === "v") setTool("cursor");
      else if (!cmd && e.key === "t") setTool("trendline");
      else if (!cmd && e.key === "h") setTool("horizontal");
      else if (!cmd && e.key === "b") setTool("brush");
      else if (!cmd && e.key === "m") setTool("measure");
      else if (!cmd && e.key === "f") setTool("fib");
      else if (!cmd && e.key === "r") setTool("rect");
      else if (!cmd && e.key === "Delete" && drawings.length) setDrawings([]);
      else if (!cmd && e.key === "Escape") setTool("cursor");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings]);

  // ── alerts + replay
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [replayActive, setReplayActive] = useState(false);
  const [replayCursor, setReplayCursor] = useState(0);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(2);
  const [toast, setToast] = useState<{ id: number; text: string; tone?: "ok" | "warn" } | null>(null);
  const showToast = (text: string, tone?: "ok" | "warn") => setToast({ id: Date.now(), text, tone });
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  // ── live data
  const [bars, setBars] = useState<Bar[]>([]);
  const [meta, setMeta] = useState<{ exchangeName?: string; currency?: string; regularMarketPrice?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFetchErr(null);
    (async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol.sym)}&tf=${timeframe}`);
        const j = await r.json();
        if (!alive) return;
        if (!j.ok) throw new Error(j.error || "quote failed");
        setBars(j.bars as Bar[]);
        setMeta(j.meta || null);
      } catch (e) {
        if (!alive) return;
        setFetchErr((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [symbol.sym, timeframe]);

  // refresh quote every 30s if not in replay
  useEffect(() => {
    if (replayActive) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol.sym)}&tf=${timeframe}`);
        const j = await r.json();
        if (j.ok) {
          setBars(j.bars as Bar[]);
          setMeta(j.meta || null);
        }
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, [symbol.sym, timeframe, replayActive]);

  // intro fade
  useEffect(() => {
    const id = setTimeout(() => setIntro(false), 900);
    return () => clearTimeout(id);
  }, []);

  // reset replay cursor when bars change
  useEffect(() => { setReplayCursor(Math.max(0, bars.length - 1)); }, [bars.length]);

  // chart imperative ref for snapshot/fit
  const chartRef = useRef<ChartHandle>(null);

  const onPreset = (p: string) => {
    setPreset(p);
    chartRef.current?.fit(PRESET_TO_LASTN[p] ?? 120);
  };

  // ── workspace save/load (Publish)
  const saveWorkspace = () => {
    const ws: Workspace = { symbol, timeframe, drawings, indicators, layout, chart: chartType, color, alerts };
    try {
      localStorage.setItem("lb-pro-workspace", JSON.stringify(ws));
      navigator.clipboard.writeText(`${location.origin}/pro?ws=${encodeURIComponent(btoa(JSON.stringify(ws)))}`).catch(() => {});
      showToast("Workspace saved · share link copied to clipboard", "ok");
    } catch (e) {
      showToast(`Save failed: ${(e as Error).message}`, "warn");
    }
  };

  // load shared / saved
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(location.href);
    const wsParam = url.searchParams.get("ws");
    try {
      const raw = wsParam ? atob(wsParam) : localStorage.getItem("lb-pro-workspace");
      if (!raw) return;
      const ws = JSON.parse(raw) as Workspace;
      setSymbol(ws.symbol);
      setTimeframe(ws.timeframe);
      _setDrawings(ws.drawings || []);
      setIndicators(ws.indicators || []);
      setLayout(ws.layout || 1);
      setChartType(ws.chart || "candles");
      setColor(ws.color || "#00ff87");
      setAlerts(ws.alerts || []);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── alert fire handler
  const onAlertFire = useCallback((a: Alert) => {
    setAlerts((cur) => cur.map((x) => (x.id === a.id ? { ...x, triggered: true } : x)));
    showToast(`⚡ Alert · ${symbol.sym} ${a.cond} ${a.price.toFixed(2)}${a.note ? ` — ${a.note}` : ""}`, "warn");
  }, [symbol.sym]);

  // ── fullscreen
  const wrapperRef = useRef<HTMLDivElement>(null);
  const toggleFullscreen = () => {
    const el = wrapperRef.current || document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // ── trade drawer
  const onTrade = () => setTradeOpen(true);

  // ── compare (add a symbol to watchlist as overlay placeholder)
  const onCompare = () => {
    showToast("Tap a symbol in the watchlist to switch the active chart", "ok");
  };

  // ── replay activation
  const startReplay = () => {
    if (!bars.length) return;
    setReplayActive(true);
    setReplayCursor(Math.max(20, Math.floor(bars.length * 0.6)));
    setReplayPlaying(false);
  };

  const symbolMetaForChart = useMemo(() => {
    return { sym: symbol.sym, exch: meta?.exchangeName || symbol.exch || "" };
  }, [symbol, meta]);

  // ── multi-pane layout
  const panes = useMemo(() => Array.from({ length: layout }, (_, i) => i), [layout]);
  const paneSymbols = useMemo<SymbolDef[]>(() => {
    // pane 0 follows the active symbol; the rest seed from defaults
    const fillers = SEED_SYMBOLS.filter((s) => s.sym !== symbol.sym).slice(0, layout - 1);
    return [symbol, ...fillers];
  }, [symbol, layout]);

  return (
    <div ref={wrapperRef} className="flex h-screen flex-col overflow-hidden bg-bg text-fg">
      {/* App bar */}
      <header className="flex h-12 items-center gap-2 border-b border-border bg-bg-soft px-3">
        <Link href="/" className="flex items-center gap-2 font-display text-sm tracking-tightest text-fg">
          <div className="relative flex size-6 items-center justify-center border border-fg/40 bg-bg">
            <div className="absolute inset-[3px] bg-bull" />
            <span className="relative font-mono text-[8px] font-bold text-bg">LB</span>
          </div>
          lazybull<span className="text-bull">.pro</span>
        </Link>
        <div className="ml-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
          <span>workspace · "godmode"</span>
          {loading && <span className="text-cyan animate-pulse">· loading bars…</span>}
          {fetchErr && <span className="text-bear">· error · {fetchErr}</span>}
        </div>
        <div className="ml-auto flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
          <button onClick={() => setAlertsOpen(true)} className="h-7 border border-border bg-bg px-2 text-fg-dim hover:text-fg">
            ⚡ alerts {alerts.length > 0 && <span className="ml-1 text-cyan">{alerts.length}</span>}
          </button>
          <button onClick={startReplay} className="h-7 border border-border bg-bg px-2 text-fg-dim hover:text-fg">⟳ replay</button>
          <button onClick={toggleFullscreen} className="size-7 border border-border bg-bg text-fg-dim hover:text-fg" title="Fullscreen">⛶</button>
          <button onClick={onTrade} className="h-7 border border-border bg-bg px-2 text-fg-dim hover:text-fg">Trade</button>
          <button onClick={saveWorkspace} className="h-7 bg-bull px-3 font-semibold text-bg hover:bg-bull-dim">Save · Share</button>
        </div>
      </header>

      <TopBar
        symbol={symbol}
        setSymbol={setSymbol}
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        chart={chartType}
        setChart={setChartType}
        indicators={indicators}
        toggleIndicator={(id) =>
          setIndicators((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
        }
        onReplay={startReplay}
        onAlert={() => setAlertsOpen(true)}
        layout={layout}
        setLayout={setLayout}
        onUndo={undo}
        onRedo={redo}
        onFullscreen={toggleFullscreen}
        onSnapshot={() => chartRef.current?.snapshot()}
        onTrade={onTrade}
        onPublish={saveWorkspace}
        onCompare={onCompare}
      />

      <div className="flex flex-1 overflow-hidden">
        <LeftToolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          onClear={() => setDrawings([])}
          count={drawings.length}
        />

        <div className="relative flex flex-1 overflow-hidden">
          {/* Multi-pane chart layout */}
          <div className={`grid w-full h-full gap-px bg-border ${
            layout === 1 ? "grid-cols-1 grid-rows-1"
            : layout === 2 ? "grid-cols-2 grid-rows-1"
            : layout === 3 ? "grid-cols-3 grid-rows-1"
            : "grid-cols-2 grid-rows-2"
          }`}>
            {panes.map((p, i) => (
              <PaneChart
                key={p}
                primary={i === 0}
                symbol={i === 0 ? symbol : paneSymbols[i] || symbol}
                timeframe={timeframe}
                tool={tool}
                drawings={i === 0 ? drawings : []}
                setDrawings={i === 0 ? setDrawings : () => {}}
                color={color}
                indicators={i === 0 ? indicators : []}
                replayCursor={i === 0 && replayActive ? replayCursor : null}
                alerts={i === 0 ? alerts : []}
                onAlertFire={onAlertFire}
                chartRef={i === 0 ? chartRef : undefined}
                bars={i === 0 ? bars : undefined}
                meta={i === 0 ? meta : undefined}
                exchangeFallback={i === 0 ? symbolMetaForChart.exch : ""}
              />
            ))}
          </div>

          {/* Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className={`absolute inset-x-0 bottom-3 mx-auto w-fit border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider ${
                  toast.tone === "warn" ? "border-amber/60 bg-amber/10 text-amber" : "border-bull/60 bg-bull/10 text-bull"
                }`}
              >
                {toast.text}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Boot intro */}
          <AnimatePresence>
            {intro && (
              <motion.div
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-bg"
              >
                <div className="flex flex-col items-center gap-3">
                  <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.4 }} className="font-display text-5xl tracking-tightest">
                    lazybull<span className="text-bull italic">.pro</span>
                  </motion.div>
                  <motion.div initial={{ width: 0 }} animate={{ width: "200px" }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="h-px bg-bull" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint">connecting to yahoo finance</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <RightPanel symbol={symbol} onPickSymbol={setSymbol} />
      </div>

      {replayActive && (
        <ReplayBar
          total={bars.length}
          cursor={replayCursor}
          onChange={setReplayCursor}
          playing={replayPlaying}
          setPlaying={setReplayPlaying}
          speed={replaySpeed}
          setSpeed={setReplaySpeed}
          onClose={() => { setReplayActive(false); setReplayPlaying(false); }}
        />
      )}

      <BottomBar preset={preset} onPreset={onPreset} status={`${drawings.length} drawing · ${indicators.length} indicator · ${alerts.length} alert · ${bars.length} bars`} />

      <AlertsPanel
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        symbol={symbol.sym}
        spot={bars[bars.length - 1]?.c ?? 0}
        alerts={alerts}
        setAlerts={setAlerts}
      />
      <TradeDrawer
        open={tradeOpen}
        onClose={() => setTradeOpen(false)}
        symbol={symbol.sym}
        spot={bars[bars.length - 1]?.c ?? 0}
      />
    </div>
  );
}

// ── per-pane chart that fetches its own bars when secondary ──
function PaneChart({
  primary,
  symbol,
  timeframe,
  tool,
  drawings,
  setDrawings,
  color,
  indicators,
  replayCursor,
  alerts,
  onAlertFire,
  chartRef,
  bars: barsProp,
  meta: metaProp,
  exchangeFallback,
}: {
  primary: boolean;
  symbol: SymbolDef;
  timeframe: string;
  tool: ToolKind;
  drawings: Drawing[];
  setDrawings: (d: Drawing[] | ((prev: Drawing[]) => Drawing[])) => void;
  color: string;
  indicators: string[];
  replayCursor: number | null;
  alerts: Alert[];
  onAlertFire?: (a: Alert) => void;
  chartRef?: React.RefObject<ChartHandle | null>;
  bars?: Bar[];
  meta?: { exchangeName?: string } | null;
  exchangeFallback: string;
}) {
  const [bars, setBars] = useState<Bar[]>(barsProp || []);
  const [meta, setMeta] = useState<{ exchangeName?: string } | null>(metaProp || null);

  useEffect(() => {
    if (primary) { setBars(barsProp || []); setMeta(metaProp || null); return; }
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol.sym)}&tf=${timeframe}`);
        const j = await r.json();
        if (!alive || !j.ok) return;
        setBars(j.bars as Bar[]);
        setMeta(j.meta || null);
      } catch {}
    })();
    return () => { alive = false; };
  }, [primary, symbol.sym, timeframe, barsProp, metaProp]);

  return (
    <div className="relative bg-bg">
      <Chart
        ref={chartRef as React.Ref<ChartHandle>}
        bars={bars}
        symbol={symbol.sym}
        exchange={meta?.exchangeName || exchangeFallback}
        timeframe={timeframe}
        tool={tool}
        drawings={drawings}
        setDrawings={setDrawings}
        color={color}
        indicators={indicators}
        replayBar={replayCursor}
        alerts={alerts}
        onAlertFire={onAlertFire}
      />
    </div>
  );
}

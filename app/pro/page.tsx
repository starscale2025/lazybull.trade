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
import { OrderTicket } from "@/components/pro/OrderTicket";
import { TradingPanel } from "@/components/pro/TradingPanel";
import { placePaperOrder } from "@/lib/pro/paper";
import { VoiceAgent } from "@/components/pro/VoiceAgent";
import type { Bar, Drawing, ToolKind } from "@/components/pro/chartCore";
import type { PlacedOrder } from "@/lib/pro/voice/useVoiceAgent";
import { computeAnalysis } from "@/lib/pro/voice/analysis";
import { usePaper } from "@/lib/stores";
import { unrealizedPnl } from "@/lib/paper-shares";

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
  //
  // Two independent reasons the history must NOT be bookkept inside the
  // setState updater, found separately from both sides of this merge:
  //  1. React invokes updaters twice under StrictMode (on by default in the App
  //     Router), so pushing from inside recorded two identical snapshots per
  //     drawing and every other undo was a visible no-op.
  //  2. The voice co-pilot can emit several drawing actions in ONE reply, and
  //     React defers the updater, so batched actions computed from a stale array.
  //
  // The mirror below is what makes both work: it is updated synchronously on
  // every write, so same-tick calls chain correctly (four rapid clicks produce
  // four drawings, not one), while history stays outside the updater. Every
  // mutation goes through commitDrawings so state and ref can never drift —
  // that single-writer rule is why the ref is NOT also assigned during render.
  const drawingsRef = useRef<Drawing[]>(drawings);
  const undoStack = useRef<Drawing[][]>([]);
  const redoStack = useRef<Drawing[][]>([]);
  /** Single funnel for state + ref, so the two can never drift apart. */
  const commitDrawings = useCallback((value: Drawing[]) => {
    drawingsRef.current = value;
    _setDrawings(value);
  }, []);
  const setDrawings = useCallback(
    (next: Drawing[] | ((prev: Drawing[]) => Drawing[])) => {
      const prev = drawingsRef.current;
      const nxt = typeof next === "function" ? (next as (p: Drawing[]) => Drawing[])(prev) : next;
      undoStack.current = [...undoStack.current, prev].slice(-50);
      redoStack.current = [];
      commitDrawings(nxt);
    },
    [commitDrawings]
  );
  const undo = () => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push(drawingsRef.current);
    commitDrawings(prev);
  };
  const redo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push(drawingsRef.current);
    commitDrawings(next);
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never let chart shortcuts fire while the user is typing. Without this,
      // Delete in the alert-note or symbol-search field wiped every drawing on
      // the chart, and any note containing v/t/h/b/m/f/r silently rearmed the
      // drawing tool so the next click drew instead of panned.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
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

  // ── paper position (shared account — same cash the /trade book uses)
  const sharePositions = usePaper((st) => st.shares);
  // Belt-and-braces with the store's sanitizeShares: a single non-finite field
  // reaching `.toFixed()` in the status strip whitescreened the whole workspace
  // with no in-app recovery. Never let one bad row take the page down.
  const rawPosition = sharePositions[symbol.sym] ?? null;
  const position =
    rawPosition && Number.isFinite(rawPosition.qty) && Number.isFinite(rawPosition.avgPrice)
      ? rawPosition
      : null;

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

  // Mark the open position to the latest bar. Declared here rather than beside
  // `position` because it needs `bars`, which is fetched below.
  const lastPrice = bars[bars.length - 1]?.c ?? null;
  const livePnl = unrealizedPnl(position, lastPrice ?? NaN);

  // TradingView-style ✕ on the position line: flatten at the last price.
  const closeAtMarket = () => {
    if (!position || lastPrice == null || replayActive) return;
    const res = placePaperOrder({
      sym: symbol.sym,
      side: position.qty > 0 ? "sell" : "buy",
      type: "market",
      qty: Math.abs(position.qty),
      price: lastPrice,
    });
    if (!res.ok) {
      showToast(`Close rejected: ${res.error}`, "warn");
      return;
    }
    const pnl = (lastPrice - position.avgPrice) * position.qty;
    showToast(`✓ Closed ${symbol.sym} — ${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)} realized`, pnl >= 0 ? "ok" : "warn");
  };

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
  // When signed in: persists to /api/workspaces (Mongo). When not: falls
  // back to localStorage so anonymous users still get a saved layout.
  const saveWorkspace = async () => {
    const ws: Workspace = { symbol, timeframe, drawings, indicators, layout, chart: chartType, color, alerts };
    // Always cache locally as a fallback.
    try { localStorage.setItem("lb-pro-workspace", JSON.stringify(ws)); } catch {}

    // Try server-side save (requires auth).
    try {
      const r = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "pro",
          name: `${symbol.sym} · ${timeframe}`,
          state: ws,
          isPublic: false,
        }),
      });
      if (r.status === 401) {
        // Not signed in — share-link fallback.
        navigator.clipboard
          .writeText(`${location.origin}/pro?ws=${encodeURIComponent(btoa(JSON.stringify(ws)))}`)
          .catch(() => {});
        showToast("Saved locally · sign in to sync across devices", "ok");
        return;
      }
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "save failed");
      showToast(`Saved as "${j.workspace.name}" — synced to your account`, "ok");
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
      // Load a workspace WITHOUT recording an undo entry (there is nothing to
      // undo back to), but still through the funnel so drawingsRef stays in
      // sync — otherwise the first edit after a load would compute from the
      // pre-load array and silently discard the loaded drawings.
      commitDrawings(ws.drawings || []);
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
  const toggleFullscreen = async () => {
    const el = wrapperRef.current || document.documentElement;
    try {
      if (!document.fullscreenElement) {
        if (!el.requestFullscreen) {
          showToast("Fullscreen not supported in this browser", "warn");
          return;
        }
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen?.();
      }
    } catch (e) {
      showToast(`Fullscreen blocked: ${(e as Error).message || "browser refused"}`, "warn");
    }
  };

  // ── trade drawer
  const onTrade = () => setTradeOpen(true);

  // ── replay activation
  const startReplay = () => {
    if (loading) {
      showToast("Bars still loading — try again in a sec", "warn");
      return;
    }
    if (!bars.length) {
      showToast(fetchErr ? `Can't replay — ${fetchErr}` : "No bars yet for this symbol", "warn");
      return;
    }
    setReplayActive(true);
    setReplayCursor(Math.max(20, Math.floor(bars.length * 0.6)));
    setReplayPlaying(false);
    showToast("Replay armed — drag the slider or press play", "ok");
  };

  const symbolMetaForChart = useMemo(() => {
    return { sym: symbol.sym, exch: meta?.exchangeName || symbol.exch || "" };
  }, [symbol, meta]);

  // ── voice co-pilot actions (the agent drives the workspace through these) ──
  // We keep a per-render `latest` ref of the real implementations (so they always
  // see fresh state), and expose a STABLE `voiceActions` object that delegates to
  // it — that keeps the WebRTC session and idle timer from churning every render.
  // Live mirrors so a multi-action reply (e.g. "set colour red then draw a line")
  // reads the value the previous action just set, not the stale render snapshot.
  const colorRef = useRef(color); colorRef.current = color;
  const barsRef = useRef<Bar[]>(bars); barsRef.current = bars;
  const alertsRef = useRef<Alert[]>(alerts); alertsRef.current = alerts;

  // helpers for agent-drawn objects: bar index from "N bars ago", unique ids
  const idxFromAgo = (ago = 0) => {
    const li = Math.max(0, barsRef.current.length - 1);
    return Math.max(0, Math.min(li, li - Math.max(0, Math.round(ago))));
  };
  const hasBars = () => barsRef.current.length > 0;
  const rid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const readLS = <T,>(k: string, fallback: T): T => {
    try { return JSON.parse(localStorage.getItem(k) || "null") ?? fallback; } catch { return fallback; }
  };
  // RightPanel owns the watchlist; we send it an intent rather than writing
  // localStorage behind its back (which raced its own persist effect).
  const watchlistIntent = (kind: "add" | "remove", ticker: string) => {
    try { window.dispatchEvent(new CustomEvent(`lb-watchlist-${kind}`, { detail: { ticker } })); } catch {}
  };

  const voiceLatest = useRef<import("@/lib/pro/voice/useVoiceAgent").VoiceActions | null>(null);
  voiceLatest.current = {
    // ── chart ──
    setSymbolByTicker: async (ticker: string) => {
      const t = ticker.trim().toUpperCase();
      if (!t) return { ok: false, error: "no ticker" };
      const seed = SEED_SYMBOLS.find((s) => s.sym === t);
      if (seed) { setSymbol(seed); return { ok: true, symbol: seed.sym, name: seed.name }; }
      try {
        const r = await fetch(`/api/symbol-search?q=${encodeURIComponent(t)}`);
        const j = await r.json();
        const hit = (j.items || [])[0] as { sym: string; name: string; exch: string } | undefined;
        if (hit?.sym) { const s = { sym: hit.sym, name: hit.name, exch: hit.exch }; setSymbol(s); return { ok: true, symbol: s.sym, name: s.name }; }
      } catch { /* fall through to raw ticker */ }
      setSymbol({ sym: t, name: t, exch: "" });
      return { ok: true, symbol: t, name: t };
    },
    setTimeframe,
    setChartType: (c: string) => setChartType(c as Workspace["chart"]),
    setLayout,
    setRangePreset: (p: string) => { if (PRESET_TO_LASTN[p] != null) onPreset(p); },
    zoomTo: (n: number) => chartRef.current?.fit(Math.max(5, Math.round(n))),
    toggleFullscreen,
    snapshot: () => chartRef.current?.snapshot(),
    saveWorkspace: () => { void saveWorkspace(); },
    // ── indicators ──
    addIndicator: (id: string) => setIndicators((cur) => (cur.includes(id) ? cur : [...cur, id])),
    removeIndicator: (id: string) => setIndicators((cur) => cur.filter((x) => x !== id)),
    clearIndicators: () => setIndicators([]),
    // ── drawing ──
    selectTool: (t: string) => setTool(t as ToolKind),
    setColor: (c: string) => setColor(c),
    drawHorizontal: (price: number) =>
      setDrawings((cur) => [...cur, { id: `d-${rid()}`, tool: "horizontal", p: price, color: colorRef.current }]),
    drawTrendline: (fromPrice, toPrice, fromBarsAgo = 30, toBarsAgo = 0) => {
      if (!hasBars()) return;
      setDrawings((cur) => [...cur, {
        id: `d-${rid()}`, tool: "trendline",
        a: { i: idxFromAgo(fromBarsAgo), p: fromPrice },
        b: { i: idxFromAgo(toBarsAgo), p: toPrice }, color: colorRef.current,
      }]);
    },
    drawFib: (fromPrice, toPrice) => {
      if (!hasBars()) return;
      setDrawings((cur) => [...cur, {
        id: `d-${rid()}`, tool: "fib",
        a: { i: idxFromAgo(30), p: fromPrice },
        b: { i: idxFromAgo(0), p: toPrice },
      }]);
    },
    drawRect: (fromPrice, toPrice, fromBarsAgo = 20, toBarsAgo = 0) => {
      if (!hasBars()) return;
      setDrawings((cur) => [...cur, {
        id: `d-${rid()}`, tool: "rect",
        a: { i: idxFromAgo(fromBarsAgo), p: fromPrice },
        b: { i: idxFromAgo(toBarsAgo), p: toPrice }, color: colorRef.current,
      }]);
    },
    drawText: (price, text, barsAgo = 0) => {
      if (!hasBars()) return;
      setDrawings((cur) => [...cur, {
        id: `d-${rid()}`, tool: "text", a: { i: idxFromAgo(barsAgo), p: price }, text, color: colorRef.current,
      }]);
    },
    clearDrawings: () => setDrawings([]),
    undo,
    redo,
    // ── alerts ──
    createAlert: (price: number, cond: "above" | "below", note?: string) => {
      // unique id — several create_alert actions can land in one model reply
      const a: Alert = { id: `al-${rid()}`, price, cond, note, triggered: false };
      alertsRef.current = [...alertsRef.current, a];
      setAlerts((cur) => [...cur, a]);
      showToast(`⚡ Alert · ${symbol.sym} ${cond} ${price.toFixed(2)}`, "ok");
    },
    deleteAlert: (price: number) => {
      // Match by identity against the live mirror, never by a precomputed index —
      // two deletes in one reply used to remove the wrong alert.
      const tol = Math.max(0.01, Math.abs(price) * 0.005);
      const target = alertsRef.current.find((a) => Math.abs(a.price - price) <= tol);
      if (!target) return false;
      alertsRef.current = alertsRef.current.filter((a) => a.id !== target.id);
      setAlerts((cur) => cur.filter((a) => a.id !== target.id));
      return true;
    },
    clearAlerts: () => { alertsRef.current = []; setAlerts([]); },
    openAlerts: (open: boolean) => setAlertsOpen(open),
    // ── replay ──
    startReplay,
    stopReplay: () => { setReplayActive(false); setReplayPlaying(false); },
    setReplayPlaying: (p: boolean) => setReplayPlaying(p),
    setReplaySpeed: (s: number) => setReplaySpeed(Math.max(1, Math.min(10, Math.round(s)))),
    replaySeek: ({ to, step }) => setReplayCursor((c) => {
      const max = Math.max(0, bars.length - 1);
      const next = to != null ? to : c + (step ?? 0);
      return Math.max(0, Math.min(max, Math.round(next)));
    }),
    // ── trading ──
    openTradePanel: (open: boolean) => setTradeOpen(open),
    // ── watchlist ──
    addToWatchlist: (ticker: string) => {
      const t = ticker.trim().toUpperCase();
      if (t) watchlistIntent("add", t);
    },
    removeFromWatchlist: (ticker: string) => {
      const t = ticker.trim().toUpperCase();
      if (t) watchlistIntent("remove", t);
    },
    // ── data lookups ──
    lookupSymbol: async (ticker: string) => {
      const t = ticker.trim().toUpperCase();
      if (!t) return { ok: false, error: "no ticker" };
      try {
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(t)}&tf=D`);
        const j = await r.json();
        if (!j.ok || !j.bars?.length) return { ok: false, error: j.error || "no data" };
        const a = computeAnalysis(j.bars as Bar[], j.meta, t, t, "D");
        return {
          ok: true, symbol: t, price: a.price, change_pct: a.changePct, change_basis: a.changeBasis,
          trend: a.trend, rsi: a.rsi, support: a.support, resistance: a.resistance,
        };
      } catch (e) { return { ok: false, error: (e as Error).message }; }
    },
    searchSymbols: async (q: string) => {
      try {
        const r = await fetch(`/api/symbol-search?q=${encodeURIComponent(q)}`);
        const j = await r.json();
        return { ok: true, results: (j.items || []).slice(0, 6) };
      } catch (e) { return { ok: false, error: (e as Error).message }; }
    },
    // ── state read-back ──
    getWorkspaceState: () => ({
      symbol: symbol.sym,
      timeframe,
      chartType,
      layout,
      rangePreset: preset,
      tool,
      color,
      indicators,
      drawingCount: drawings.length,
      // capped — this is injected into the model prompt every turn
      alerts: alerts.slice(0, 20).map((a) => ({ price: a.price, cond: a.cond, note: a.note?.slice(0, 60), triggered: a.triggered })),
      orders: readLS<PlacedOrder[]>("lb-pro-orders", []).slice(0, 10)
        .map((o) => ({ side: o.side, qty: o.qty, sym: o.sym, price: o.price, type: o.type })),
      watchlist: readLS<string[]>("lb-pro-watchlist", []).slice(0, 30),
      replay: { active: replayActive, playing: replayPlaying, speed: replaySpeed, cursor: replayCursor, total: bars.length },
    }),
    // ── plumbing ──
    onOrderPlaced: (o: PlacedOrder) => showToast(`⚡ Paper ${o.side.toUpperCase()} ${o.qty} ${o.sym} placed`, "ok"),
    showToast,
  };

  // Stable delegate — always calls the freshest implementation above.
  const voiceActions = useMemo<import("@/lib/pro/voice/useVoiceAgent").VoiceActions>(() => {
    const L = () => voiceLatest.current!;
    return {
      setSymbolByTicker: (t) => L().setSymbolByTicker(t),
      setTimeframe: (tf) => L().setTimeframe(tf),
      setChartType: (c) => L().setChartType(c),
      setLayout: (n) => L().setLayout(n),
      setRangePreset: (p) => L().setRangePreset(p),
      zoomTo: (n) => L().zoomTo(n),
      toggleFullscreen: () => L().toggleFullscreen(),
      snapshot: () => L().snapshot(),
      saveWorkspace: () => L().saveWorkspace(),
      addIndicator: (id) => L().addIndicator(id),
      removeIndicator: (id) => L().removeIndicator(id),
      clearIndicators: () => L().clearIndicators(),
      selectTool: (t) => L().selectTool(t),
      setColor: (c) => L().setColor(c),
      drawHorizontal: (p) => L().drawHorizontal(p),
      drawTrendline: (a, b, c, d) => L().drawTrendline(a, b, c, d),
      drawFib: (a, b) => L().drawFib(a, b),
      drawRect: (a, b, c, d) => L().drawRect(a, b, c, d),
      drawText: (p, t, ago) => L().drawText(p, t, ago),
      clearDrawings: () => L().clearDrawings(),
      undo: () => L().undo(),
      redo: () => L().redo(),
      createAlert: (p, c, n) => L().createAlert(p, c, n),
      deleteAlert: (p) => L().deleteAlert(p),
      clearAlerts: () => L().clearAlerts(),
      openAlerts: (o) => L().openAlerts(o),
      startReplay: () => L().startReplay(),
      stopReplay: () => L().stopReplay(),
      setReplayPlaying: (p) => L().setReplayPlaying(p),
      setReplaySpeed: (s) => L().setReplaySpeed(s),
      replaySeek: (o) => L().replaySeek(o),
      openTradePanel: (o) => L().openTradePanel(o),
      addToWatchlist: (t) => L().addToWatchlist(t),
      removeFromWatchlist: (t) => L().removeFromWatchlist(t),
      lookupSymbol: (t) => L().lookupSymbol(t),
      searchSymbols: (q) => L().searchSymbols(q),
      getWorkspaceState: () => L().getWorkspaceState(),
      onOrderPlaced: (o) => L().onOrderPlaced?.(o),
      showToast: (t, tone) => L().showToast?.(t, tone),
    };
  }, []);

  // ── multi-pane layout
  const panes = useMemo(() => Array.from({ length: layout }, (_, i) => i), [layout]);
  const paneSymbols = useMemo<SymbolDef[]>(() => {
    // pane 0 follows the active symbol; the rest seed from defaults
    const fillers = SEED_SYMBOLS.filter((s) => s.sym !== symbol.sym).slice(0, layout - 1);
    return [symbol, ...fillers];
  }, [symbol, layout]);

  return (
    <div ref={wrapperRef} className="flex min-h-screen flex-col bg-bg text-fg lg:h-screen lg:min-h-0 lg:overflow-hidden">
      {/* App bar */}
      <header className="flex h-12 items-center gap-2 border-b border-border bg-bg-soft px-3">
        <Link href="/" className="flex items-center gap-2 font-display text-sm tracking-tightest text-fg">
          <div className="relative flex size-6 items-center justify-center border border-fg/40 bg-bg">
            <div className="absolute inset-[3px] bg-bull" />
            <span className="relative font-mono text-[8px] font-bold text-bg">LB</span>
          </div>
          lazybull<span className="text-bull">.pro</span>
        </Link>
        <div className="ml-3 hidden items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim md:flex">
          <span>workspace · "godmode"</span>
          {loading && <span className="text-cyan animate-pulse">· loading bars…</span>}
          {fetchErr && <span className="text-bear">· error · {fetchErr}</span>}
        </div>
        <div className="ml-auto flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
          <button onClick={() => setAlertsOpen(true)} className="h-7 border border-border bg-bg px-2 text-fg-dim hover:text-fg">
            ⚡<span className="hidden sm:inline"> alerts</span> {alerts.length > 0 && <span className="ml-1 text-cyan">{alerts.length}</span>}
          </button>
          <button onClick={toggleFullscreen} className="size-7 border border-border bg-bg text-fg-dim hover:text-fg" title="Fullscreen">⛶</button>
          <button onClick={onTrade} className="h-7 border border-border bg-bg px-2 text-fg-dim hover:text-fg">Trade</button>
          <button onClick={saveWorkspace} className="h-7 bg-bull px-3 font-semibold text-bg hover:bg-bull-dim">Save<span className="hidden sm:inline"> · Share</span></button>
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
      />

      {/* <lg: toolbar+chart become a fixed-height band and the right panel stacks
          below (page scrolls); lg+: the original single-screen three-pane row. */}
      <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden">
        <div className="flex h-[62vh] min-h-[420px] shrink-0 overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1">
        <LeftToolbar
          tool={tool}
          setTool={setTool}
          color={color}
          setColor={setColor}
          onClear={() => setDrawings([])}
          count={drawings.length}
        />

        <div className="relative flex flex-1 overflow-hidden">
          {/* On-chart order ticket — TradingView's SELL | qty | BUY, top-left */}
          <div className="pointer-events-none absolute left-2 top-8 z-20">
            <OrderTicket
              symbol={symbol.sym}
              price={lastPrice}
              disabled={replayActive}
              onResult={showToast}
            />
          </div>
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
                chartType={chartType}
                position={i === 0 ? position : null}
                onClosePosition={i === 0 && !replayActive ? closeAtMarket : undefined}
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

      <TradingPanel
        chartSymbol={symbol.sym}
        chartLast={lastPrice}
        replayActive={replayActive}
        onResult={showToast}
      />

      <BottomBar
        preset={preset}
        onPreset={onPreset}
        status={[
          // Position first — it is the only line here that is about the user's
          // money rather than the workspace.
          position
            ? `${position.qty > 0 ? "long" : "short"} ${Math.abs(position.qty)} @ ${position.avgPrice.toFixed(2)} · ` +
              `${livePnl >= 0 ? "+" : "−"}$${Math.abs(livePnl).toFixed(2)}`
            : null,
          `${drawings.length} drawing`,
          `${indicators.length} indicator`,
          `${alerts.length} alert`,
          `${bars.length} bars`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

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

      {/* Voice co-pilot — scoped to /pro only */}
      <VoiceAgent
        symbol={symbol}
        timeframe={timeframe}
        bars={bars}
        meta={meta}
        indicators={indicators}
        actions={voiceActions}
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
  chartType,
  position,
  onClosePosition,
}: {
  primary: boolean;
  symbol: SymbolDef;
  timeframe: string;
  tool: ToolKind;
  drawings: Drawing[];
  setDrawings: (d: Drawing[] | ((prev: Drawing[]) => Drawing[])) => void;
  color: string;
  indicators: string[];
  chartType: Workspace["chart"];
  position: { qty: number; avgPrice: number } | null;
  onClosePosition?: () => void;
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
        chart={chartType}
        position={position}
        onClosePosition={onClosePosition}
        replayBar={replayCursor}
        alerts={alerts}
        onAlertFire={onAlertFire}
      />
    </div>
  );
}

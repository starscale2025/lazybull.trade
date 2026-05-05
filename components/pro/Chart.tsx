"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  autoY,
  barOfX,
  ChartGeom,
  Drawing,
  fmt,
  fmtTime,
  innerH,
  innerW,
  priceOfY,
  ToolKind,
  Viewport,
  xOfBar,
  yOfPrice,
  FIB_LEVELS,
  FIB_COLORS,
  distToSeg,
  type Bar,
} from "./chartCore";
import { bollinger, ema, ichimoku, macd, rsi, supertrend, vwap } from "./indicators";

export type Alert = { id: string; price: number; cond: "above" | "below"; note?: string; triggered?: boolean };

type Props = {
  bars: Bar[];
  symbol: string;
  exchange: string;
  timeframe: string;
  tool: ToolKind;
  drawings: Drawing[];
  setDrawings: (d: Drawing[] | ((prev: Drawing[]) => Drawing[])) => void;
  color: string;
  showVolume?: boolean;
  indicators: string[]; // ids
  replayBar?: number | null; // if set, hide bars after this index
  alerts: Alert[];
  onAlertFire?: (a: Alert) => void;
};

export type ChartHandle = {
  snapshot: () => void;
  fit: (lastN: number) => void;
};

const PAD = { L: 16, R: 72, T: 12, B: 28 };
const VOLUME_FRAC = 0.18;

export const Chart = forwardRef<ChartHandle, Props>(function Chart(
  {
    bars: allBars,
    symbol,
    exchange,
    timeframe,
    tool,
    drawings,
    setDrawings,
    color,
    showVolume = true,
    indicators,
    replayBar = null,
    alerts,
    onAlertFire,
  },
  ref
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 1000, h: 600 });

  // Apply replay cutoff
  const bars = useMemo(() => (replayBar != null ? allBars.slice(0, Math.max(2, replayBar + 1)) : allBars), [allBars, replayBar]);

  // Bottom panes (RSI, MACD)
  const bottomPanes: string[] = useMemo(() => indicators.filter((i) => i === "rsi" || i === "macd"), [indicators]);
  const paneH = bottomPanes.length ? 110 : 0;
  const totalBottomPanes = bottomPanes.length * paneH;

  const geom: ChartGeom = useMemo(
    () => ({
      width: size.w,
      height: size.h,
      padL: PAD.L,
      padR: PAD.R,
      padT: PAD.T,
      padB: PAD.B + (showVolume ? size.h * VOLUME_FRAC : 0) + totalBottomPanes,
    }),
    [size, showVolume, totalBottomPanes]
  );

  // Viewport
  const [vp, setVp] = useState<Viewport>(() => ({
    start: 0,
    span: 120,
    yMin: 0,
    yMax: 1,
  }));

  // When bars array changes (new symbol/timeframe), refit to last 120
  // and replay the candle fast-forward entrance.
  const lastBarsRef = useRef(allBars);
  const [introToken, setIntroToken] = useState(0);
  const [introPlaying, setIntroPlaying] = useState(true);
  useEffect(() => {
    if (lastBarsRef.current !== allBars) {
      lastBarsRef.current = allBars;
      const span = Math.min(120, allBars.length || 120);
      const start = Math.max(0, allBars.length - span);
      const yr = autoY(allBars, start, span);
      setVp({ start, span, yMin: yr.yMin, yMax: yr.yMax });
      setYLocked(false);
      setIntroToken((n) => n + 1);
      setIntroPlaying(true);
    }
  }, [allBars]);

  // After ~1.4s the per-candle fade-in is finished. Drop the animation
  // class so subsequent pan/zoom doesn't re-flicker the candles.
  useEffect(() => {
    if (!introPlaying) return;
    const t = setTimeout(() => setIntroPlaying(false), 1400);
    return () => clearTimeout(t);
  }, [introToken, introPlaying]);

  // Refit viewport on replay enter/exit so the chart isn't blank.
  // (Slicing `allBars` for replay leaves the viewport anchored past the
  // sliced length until we explicitly re-fit.)
  const wasReplayingRef = useRef(false);
  useEffect(() => {
    const isReplaying = replayBar != null;
    if (isReplaying && !wasReplayingRef.current) {
      const cutoff = Math.max(2, (replayBar as number) + 1);
      const sliced = allBars.slice(0, cutoff);
      const span = Math.min(120, sliced.length || 120);
      const start = Math.max(0, sliced.length - span);
      const yr = autoY(sliced, start, span);
      setVp({ start, span, yMin: yr.yMin, yMax: yr.yMax });
      setYLocked(false);
    } else if (!isReplaying && wasReplayingRef.current) {
      const span = Math.min(120, allBars.length || 120);
      const start = Math.max(0, allBars.length - span);
      const yr = autoY(allBars, start, span);
      setVp({ start, span, yMin: yr.yMin, yMax: yr.yMax });
      setYLocked(false);
    }
    wasReplayingRef.current = isReplaying;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayBar]);

  // Auto-pan during replay: if the cursor moves out of the visible window,
  // shift the viewport so the latest replay bar stays in view.
  useEffect(() => {
    if (replayBar == null) return;
    setVp((v) => {
      const rightEdge = v.start + v.span;
      const padding = Math.max(2, v.span * 0.05);
      if (replayBar > rightEdge - padding) {
        return { ...v, start: Math.max(0, replayBar + padding - v.span) };
      }
      if (replayBar < v.start) {
        return { ...v, start: Math.max(0, replayBar - v.span * 0.5) };
      }
      return v;
    });
  }, [replayBar]);

  // Resize observer
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: Math.max(320, r.width), h: Math.max(280, r.height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Auto-fit Y when scrolling unless user dragged Y
  const [yLocked, setYLocked] = useState(false);
  useEffect(() => {
    if (yLocked || !bars.length) return;
    const yr = autoY(bars, vp.start, vp.span);
    setVp((v) => ({ ...v, yMin: yr.yMin, yMax: yr.yMax }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vp.start, vp.span, bars, yLocked]);

  // ── interactions
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);
  const draftRef = useRef<Drawing | null>(null);
  const [draft, _setDraft] = useState<Drawing | null>(null);
  const setDraft = (next: Drawing | null | ((prev: Drawing | null) => Drawing | null)) => {
    const value = typeof next === "function" ? (next as (p: Drawing | null) => Drawing | null)(draftRef.current) : next;
    draftRef.current = value;
    _setDraft(value);
  };
  const panRef = useRef<{ x: number; y: number; vp: Viewport } | null>(null);
  const yAxisDragRef = useRef<{ y: number; vp: Viewport } | null>(null);
  const xAxisDragRef = useRef<{ x: number; vp: Viewport } | null>(null);

  // Axis-drag handlers — bound globally so dragging works even when the
  // pointer leaves the axis region during the drag.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const yDrag = yAxisDragRef.current;
      const xDrag = xAxisDragRef.current;
      if (yDrag) {
        // Drag DOWN → expand price range (zoom out vertically).
        // Drag UP   → compress range (zoom in).
        const dy = e.clientY - yDrag.y;
        const startVp = yDrag.vp;
        const range = startVp.yMax - startVp.yMin;
        const center = (startVp.yMin + startVp.yMax) / 2;
        const factor = Math.exp(dy * 0.005);
        const newRange = Math.max(0.01, range * factor);
        setVp((v) => ({ ...v, yMin: center - newRange / 2, yMax: center + newRange / 2 }));
        setYLocked(true);
      }
      if (xDrag) {
        // Drag RIGHT → expand bar span (zoom out).
        // Drag LEFT  → compress span (zoom in).
        // Anchor the right edge so newer bars stay visible.
        const dx = e.clientX - xDrag.x;
        const startVp = xDrag.vp;
        const factor = Math.exp(-dx * 0.005);
        const newSpan = Math.max(20, Math.min((allBars.length || 1000), startVp.span * factor));
        const rightEdge = startVp.start + startVp.span;
        const newStart = rightEdge - newSpan;
        setVp((v) => ({ ...v, start: newStart, span: newSpan }));
        setYLocked(false);
      }
    };
    const onUp = () => {
      yAxisDragRef.current = null;
      xAxisDragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [allBars.length]);

  const onYAxisDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    yAxisDragRef.current = { y: e.clientY, vp };
  };
  const onYAxisDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Reset price range to auto-fit visible bars.
    setYLocked(false);
    if (bars.length) {
      const yr = autoY(bars, vp.start, vp.span);
      setVp((v) => ({ ...v, yMin: yr.yMin, yMax: yr.yMax }));
    }
  };
  const onXAxisDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    xAxisDragRef.current = { x: e.clientX, vp };
  };
  const onXAxisDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Reset span to last 120 bars (the default fit window).
    if (!allBars.length) return;
    const span = Math.min(120, allBars.length);
    const start = Math.max(0, allBars.length - span);
    const yr = autoY(allBars, start, span);
    setVp({ start, span, yMin: yr.yMin, yMax: yr.yMax });
    setYLocked(false);
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const screenPt = (e: React.MouseEvent | MouseEvent | WheelEvent | React.WheelEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
  };
  const dataPt = (x: number, y: number) => ({ i: barOfX(x, vp, geom), p: priceOfY(y, vp, geom) });
  const newId = () => `dr-${Math.random().toString(36).slice(2, 8)}`;

  const onMouseMove = (e: React.MouseEvent) => {
    const pt = screenPt(e);
    setCrosshair(pt);
    if (panRef.current && tool === "cursor") {
      const dx = pt.x - panRef.current.x;
      const dy = pt.y - panRef.current.y;
      const slot = innerW(geom) / panRef.current.vp.span;
      const dBars = -dx / slot;
      const dPrice = (dy / innerH(geom)) * (panRef.current.vp.yMax - panRef.current.vp.yMin);
      setVp({
        start: Math.max(-50, Math.min(allBars.length - 5, panRef.current.vp.start + dBars)),
        span: panRef.current.vp.span,
        yMin: panRef.current.vp.yMin + dPrice,
        yMax: panRef.current.vp.yMax + dPrice,
      });
      setYLocked(true);
      return;
    }
    if (draftRef.current) {
      const d = dataPt(pt.x, pt.y);
      setDraft((prev) => {
        if (!prev) return prev;
        if (prev.tool === "brush") return { ...prev, pts: [...prev.pts, d] };
        if ("b" in prev) return { ...prev, b: d };
        return prev;
      });
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const pt = screenPt(e);
    const d = dataPt(pt.x, pt.y);
    if (tool === "cursor") {
      const hit = pickDrawing(pt.x, pt.y);
      if (hit) {
        setSelectedId(hit);
        return;
      }
      setSelectedId(null);
      panRef.current = { x: pt.x, y: pt.y, vp };
      return;
    }
    if (tool === "eraser") {
      const hit = pickDrawing(pt.x, pt.y);
      if (hit) setDrawings((prev) => prev.filter((d) => d.id !== hit));
      return;
    }
    if (tool === "horizontal") {
      setDrawings((prev) => [...prev, { id: newId(), tool: "horizontal", p: d.p, color }]);
      return;
    }
    if (tool === "text") {
      const text = window.prompt("Note text:", "Note");
      if (text) setDrawings((prev) => [...prev, { id: newId(), tool: "text", a: d, text, color }]);
      return;
    }
    if (tool === "callout") {
      const text = window.prompt("Callout:", "Watch this level");
      if (text) setDrawings((prev) => [...prev, { id: newId(), tool: "callout", a: d, text, color }]);
      return;
    }
    if (tool === "brush") {
      setDraft({ id: newId(), tool: "brush", pts: [d], color });
      return;
    }
    if (tool === "trendline" || tool === "ray") {
      setDraft({ id: newId(), tool, a: d, b: d, color });
      return;
    }
    if (tool === "rect") {
      setDraft({ id: newId(), tool: "rect", a: d, b: d, color });
      return;
    }
    if (tool === "fib") {
      setDraft({ id: newId(), tool: "fib", a: d, b: d });
      return;
    }
    if (tool === "channel") {
      setDraft({ id: newId(), tool: "channel", a: d, b: d, offset: 0, color });
      return;
    }
    if (tool === "measure") {
      setDraft({ id: newId(), tool: "measure", a: d, b: d });
      return;
    }
  };

  const onMouseUp = () => {
    panRef.current = null;
    const d = draftRef.current;
    if (d) {
      if ("a" in d && "b" in d) {
        const sameI = d.a.i === d.b.i;
        const sameP = Math.abs(d.a.p - d.b.p) < 1e-9;
        if (!(sameI && sameP)) setDrawings((prev) => [...prev, d]);
      } else if (d.tool === "brush" && d.pts.length > 1) {
        setDrawings((prev) => [...prev, d]);
      }
    }
    setDraft(null);
  };

  const onMouseLeave = () => {
    setCrosshair(null);
    onMouseUp();
  };

  // Wheel zoom — bound as a native non-passive listener so preventDefault()
  // actually cancels the browser pinch-zoom (Ctrl+wheel from trackpad).
  // React's synthetic onWheel is passive, where preventDefault is a silent no-op.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = wrap.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // Horizontal scroll → pan; vertical scroll / pinch → zoom around cursor.
      const isPan = Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey;
      setVp((v) => {
        if (isPan) {
          const slot = innerW(geom) / v.span;
          const dBars = e.deltaX / slot;
          return {
            ...v,
            start: Math.max(-50, Math.min(allBars.length - 5, v.start + dBars)),
          };
        }
        const factor = Math.exp(e.deltaY * 0.0015);
        const pivot = barOfX(mouseX, v, geom);
        const newSpan = Math.max(20, Math.min(allBars.length || 1000, v.span * factor));
        const newStart = pivot - ((pivot - v.start) * newSpan) / v.span;
        return { ...v, start: newStart, span: newSpan };
      });
      setYLocked(false);
    };
    wrap.addEventListener("wheel", handleWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", handleWheel);
  }, [geom, allBars.length]);

  const pickDrawing = (px: number, py: number) => {
    for (let k = drawings.length - 1; k >= 0; k--) {
      const d = drawings[k];
      const tol = 6;
      if (d.tool === "horizontal") {
        const y = yOfPrice(d.p, vp, geom);
        if (Math.abs(py - y) <= tol) return d.id;
      } else if (d.tool === "trendline" || d.tool === "ray" || d.tool === "measure" || d.tool === "channel" || d.tool === "fib") {
        const ax = xOfBar(d.a.i, vp, geom);
        const ay = yOfPrice(d.a.p, vp, geom);
        const bx = xOfBar(d.b.i, vp, geom);
        const by = yOfPrice(d.b.p, vp, geom);
        if (distToSeg(px, py, ax, ay, bx, by) <= tol) return d.id;
      } else if (d.tool === "rect") {
        const ax = xOfBar(d.a.i, vp, geom);
        const ay = yOfPrice(d.a.p, vp, geom);
        const bx = xOfBar(d.b.i, vp, geom);
        const by = yOfPrice(d.b.p, vp, geom);
        const x1 = Math.min(ax, bx), x2 = Math.max(ax, bx);
        const y1 = Math.min(ay, by), y2 = Math.max(ay, by);
        if (px >= x1 && px <= x2 && py >= y1 && py <= y2) return d.id;
      } else if (d.tool === "text" || d.tool === "callout") {
        const ax = xOfBar(d.a.i, vp, geom);
        const ay = yOfPrice(d.a.p, vp, geom);
        if (Math.abs(px - ax) < 60 && Math.abs(py - ay) < 18) return d.id;
      } else if (d.tool === "brush") {
        for (let i = 1; i < d.pts.length; i++) {
          const ax = xOfBar(d.pts[i - 1].i, vp, geom);
          const ay = yOfPrice(d.pts[i - 1].p, vp, geom);
          const bx = xOfBar(d.pts[i].i, vp, geom);
          const by = yOfPrice(d.pts[i].p, vp, geom);
          if (distToSeg(px, py, ax, ay, bx, by) <= tol) return d.id;
        }
      }
    }
    return null;
  };

  // ── derived series
  const closes = useMemo(() => bars.map((b) => b.c), [bars]);
  const ind = useMemo(() => {
    const out: Record<string, unknown> = {};
    if (indicators.includes("ema20")) out.ema20 = ema(closes, 20);
    if (indicators.includes("ema50")) out.ema50 = ema(closes, 50);
    if (indicators.includes("rsi")) out.rsi = rsi(closes, 14);
    if (indicators.includes("macd")) out.macd = macd(closes);
    if (indicators.includes("bb")) out.bb = bollinger(closes, 20, 2);
    if (indicators.includes("vwap")) out.vwap = vwap(bars);
    if (indicators.includes("ichimoku")) out.ichi = ichimoku(bars);
    if (indicators.includes("supertrend")) out.st = supertrend(bars, 10, 3);
    return out;
  }, [bars, closes, indicators]);

  // ── alerts: trigger when last bar close crosses level
  const lastClose = bars[bars.length - 1]?.c;
  const prevClose = bars[bars.length - 2]?.c;
  useEffect(() => {
    if (lastClose == null || prevClose == null) return;
    for (const a of alerts) {
      if (a.triggered) continue;
      if (a.cond === "above" && prevClose <= a.price && lastClose > a.price) onAlertFire?.(a);
      if (a.cond === "below" && prevClose >= a.price && lastClose < a.price) onAlertFire?.(a);
    }
  }, [lastClose, prevClose, alerts, onAlertFire]);

  // imperative API
  useImperativeHandle(ref, () => ({
    snapshot: () => {
      const svg = svgRef.current;
      if (!svg) return;
      const xml = new XMLSerializer().serializeToString(svg);
      const svgWithBg = xml.replace("<svg", `<svg xmlns="http://www.w3.org/2000/svg" style="background:#050505"`);
      const blob = new Blob([svgWithBg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${symbol}-${timeframe}-${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    fit: (lastN: number) => {
      if (!allBars.length) return;
      const span = Math.min(lastN, allBars.length);
      const start = Math.max(0, allBars.length - span);
      const yr = autoY(allBars, start, span);
      setVp({ start, span, yMin: yr.yMin, yMax: yr.yMax });
      setYLocked(false);
    },
  }));

  // ── derived ── visible bars + scales
  const visibleBars = useMemo(() => {
    const lo = Math.max(0, Math.floor(vp.start));
    const hi = Math.min(bars.length - 1, Math.ceil(vp.start + vp.span));
    return bars.slice(lo, hi + 1);
  }, [bars, vp.start, vp.span]);

  const yTicks = useMemo(() => {
    const n = 7;
    const step = (vp.yMax - vp.yMin) / (n - 1);
    return Array.from({ length: n }, (_, i) => vp.yMin + i * step);
  }, [vp.yMin, vp.yMax]);

  const xTicks = useMemo(() => {
    const stride = Math.max(1, Math.round(vp.span / 8));
    const ticks: number[] = [];
    for (let i = Math.ceil(vp.start); i < vp.start + vp.span; i += stride) {
      if (i >= 0 && i < bars.length) ticks.push(i);
    }
    return ticks;
  }, [vp.start, vp.span, bars.length]);

  const slot = innerW(geom) / vp.span;
  const candleW = Math.max(1, slot * 0.65);
  const last = bars[bars.length - 1] || { c: 0, o: 0, h: 0, l: 0, v: 0, t: 0, i: 0 };
  const prev = bars[bars.length - 2] || last;
  const change = last.c - prev.c;
  const changePct = (change / (prev.c || 1)) * 100;

  const allDrawings = draft ? [...drawings, draft] : drawings;

  // Volume area + sub-pane areas
  const candlesBottom = geom.height - PAD.B - (showVolume ? size.h * VOLUME_FRAC : 0) - totalBottomPanes;
  const volTop = candlesBottom;
  const volBottom = volTop + (showVolume ? size.h * VOLUME_FRAC : 0);
  const maxVol = Math.max(...visibleBars.map((b) => b.v), 1);

  const subPaneTops = bottomPanes.map((_, i) => volBottom + i * paneH);

  // Empty / loading state — render an empty pane with the OHLC label area still visible
  if (!bars.length) {
    return (
      <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-bg">
        <div className="pointer-events-none absolute left-3 top-3 font-mono text-[11px]">
          <span className="text-fg">{symbol}</span>
          <span className="ml-3 text-fg-faint">·</span>
          <span className="ml-3 text-fg-dim">{exchange}</span>
          <span className="ml-3 text-fg-faint">·</span>
          <span className="ml-3 text-fg-dim">{timeframe}</span>
          <span className="ml-3 text-cyan animate-pulse">· loading data</span>
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="font-display text-[100px] tracking-tightest text-fg/[0.03] leading-none">lazybull<span className="italic">pro</span></div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full select-none overflow-hidden bg-bg touch-none overscroll-contain"
      style={{ cursor: tool === "cursor" ? "crosshair" : tool === "eraser" ? "not-allowed" : "crosshair" }}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.w} ${size.h}`}
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* gridlines */}
        {yTicks.map((y, i) => {
          const yp = yOfPrice(y, vp, geom);
          return <line key={`gy-${i}`} x1={geom.padL} x2={size.w - geom.padR} y1={yp} y2={yp} stroke="rgba(245,245,240,0.04)" />;
        })}
        {xTicks.map((i) => {
          const x = xOfBar(i, vp, geom);
          return <line key={`gx-${i}`} x1={x} x2={x} y1={geom.padT} y2={candlesBottom} stroke="rgba(245,245,240,0.04)" />;
        })}

        {/* Indicator overlays — Bollinger Bands fill */}
        {indicators.includes("bb") && (
          <BBOverlay bb={ind.bb as { mid: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] }} bars={bars} vp={vp} geom={geom} />
        )}

        {/* Ichimoku cloud */}
        {indicators.includes("ichimoku") && (
          <IchimokuOverlay ichi={ind.ichi as { conv: (number | null)[]; base: (number | null)[]; spanA: (number | null)[]; spanB: (number | null)[] }} bars={bars} vp={vp} geom={geom} />
        )}

        {/* candles — fade in left-to-right on initial mount + on bar change */}
        {visibleBars.map((b, idx) => {
          const x = xOfBar(b.i, vp, geom);
          const isUp = b.c >= b.o;
          const c = isUp ? "var(--bull)" : "var(--bear)";
          const yO = yOfPrice(b.o, vp, geom);
          const yC = yOfPrice(b.c, vp, geom);
          const yH = yOfPrice(b.h, vp, geom);
          const yL = yOfPrice(b.l, vp, geom);
          const top = Math.min(yO, yC);
          const bh = Math.max(1, Math.abs(yC - yO));
          const delayMs = introPlaying ? idx * 8 : 0;
          return (
            <g
              key={`b-${b.i}-${introToken}`}
              className={introPlaying ? "chart-candle-in" : undefined}
              style={introPlaying ? { animationDelay: `${delayMs}ms` } : undefined}
            >
              <line x1={x} x2={x} y1={yH} y2={yL} stroke={c} strokeWidth={1} />
              <rect x={x - candleW / 2} y={top} width={candleW} height={bh} fill={c} />
            </g>
          );
        })}

        {/* Indicator overlay lines (drawn on top of candles) */}
        {indicators.includes("ema20") && (
          <SeriesLine values={ind.ema20 as (number | null)[]} bars={bars} vp={vp} geom={geom} color="#22d3ee" />
        )}
        {indicators.includes("ema50") && (
          <SeriesLine values={ind.ema50 as (number | null)[]} bars={bars} vp={vp} geom={geom} color="#a78bfa" />
        )}
        {indicators.includes("vwap") && (
          <SeriesLine values={ind.vwap as (number | null)[]} bars={bars} vp={vp} geom={geom} color="#ffb800" />
        )}
        {indicators.includes("supertrend") && (
          <SeriesLine values={(ind.st as { trend: (number | null)[] }).trend} bars={bars} vp={vp} geom={geom} color="#ff2e63" dashed />
        )}

        {/* volume — same fast-forward stagger as the candles above */}
        {showVolume &&
          visibleBars.map((b, idx) => {
            const x = xOfBar(b.i, vp, geom);
            const isUp = b.c >= b.o;
            const c = isUp ? "var(--bull)" : "var(--bear)";
            const h = (b.v / maxVol) * (volBottom - volTop - 6);
            const delayMs = introPlaying ? idx * 8 : 0;
            return (
              <rect
                key={`v-${b.i}-${introToken}`}
                className={introPlaying ? "chart-candle-in" : undefined}
                style={introPlaying ? { animationDelay: `${delayMs}ms` } : undefined}
                x={x - candleW / 2}
                y={volBottom - h}
                width={candleW}
                height={h}
                fill={c}
                opacity={0.32}
              />
            );
          })}

        {/* y-axis labels */}
        {yTicks.map((y, i) => {
          const yp = yOfPrice(y, vp, geom);
          return (
            <text key={`yt-${i}`} x={size.w - geom.padR + 6} y={yp + 3} fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-faint)">
              {fmt(y, 2)}
            </text>
          );
        })}

        {/* x-axis labels */}
        {xTicks.map((i) => {
          const x = xOfBar(i, vp, geom);
          return (
            <text key={`xt-${i}`} x={x} y={geom.height - 8} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-faint)">
              {fmtTime(bars[i].t)}
            </text>
          );
        })}

        {/* last price marker */}
        {bars.length > 0 && (
          (() => {
            const y = yOfPrice(last.c, vp, geom);
            const c = last.c >= last.o ? "var(--bull)" : "var(--bear)";
            return (
              <g>
                <line x1={geom.padL} x2={size.w - geom.padR} y1={y} y2={y} stroke={c} strokeOpacity="0.4" strokeDasharray="3 4" />
                <rect x={size.w - geom.padR + 2} y={y - 9} width={geom.padR - 4} height={18} fill={c} />
                <text x={size.w - geom.padR / 2} y={y + 3.5} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="11" fontWeight="600" fill="var(--bg)">
                  {fmt(last.c, 2)}
                </text>
              </g>
            );
          })()
        )}

        {/* Alerts */}
        {alerts.map((a) => {
          const y = yOfPrice(a.price, vp, geom);
          const c = a.triggered ? "var(--amber)" : "var(--cyan)";
          return (
            <g key={a.id}>
              <line x1={geom.padL} x2={size.w - geom.padR - 56} y1={y} y2={y} stroke={c} strokeDasharray="6 4" strokeWidth={1.2} />
              <rect x={geom.padL + 4} y={y - 9} width={70} height={18} fill={c} fillOpacity={0.15} stroke={c} />
              <text x={geom.padL + 8} y={y + 3.5} fontFamily="var(--font-jetbrains)" fontSize="10" fill={c}>
                ▲ {a.cond} {fmt(a.price, 2)}
              </text>
            </g>
          );
        })}

        {/* drawings */}
        {allDrawings.map((d) => (
          <DrawingShape key={d.id} d={d} vp={vp} geom={geom} selected={selectedId === d.id} chartW={size.w} />
        ))}

        {/* Bottom panes: RSI / MACD */}
        {bottomPanes.map((paneId, idx) => {
          const top = subPaneTops[idx];
          if (paneId === "rsi") {
            const rsiVals = ind.rsi as (number | null)[];
            return (
              <RsiPane key="rsi" values={rsiVals} bars={bars} vp={vp} top={top} height={paneH} chartW={size.w} padL={geom.padL} padR={geom.padR} />
            );
          }
          if (paneId === "macd") {
            const m = ind.macd as { line: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] };
            return <MacdPane key="macd" m={m} bars={bars} vp={vp} top={top} height={paneH} chartW={size.w} padL={geom.padL} padR={geom.padR} />;
          }
          return null;
        })}

        {/* Y-axis (price) drag zone — stretched over the right gutter where
            the price labels live. Drag vertically to scale, double-click to
            reset to auto-fit. */}
        <rect
          x={size.w - geom.padR}
          y={geom.padT}
          width={geom.padR}
          height={size.h - geom.padT - geom.padB}
          fill="transparent"
          style={{ cursor: "ns-resize" }}
          onMouseDown={onYAxisDown}
          onDoubleClick={onYAxisDoubleClick}
        />

        {/* X-axis (time) drag zone — stretched along the bottom gutter where
            the date labels live. Drag horizontally to compress/expand the
            bar window, double-click to fit last 120 bars. */}
        <rect
          x={geom.padL}
          y={geom.height - PAD.B}
          width={size.w - geom.padL - geom.padR}
          height={PAD.B}
          fill="transparent"
          style={{ cursor: "ew-resize" }}
          onMouseDown={onXAxisDown}
          onDoubleClick={onXAxisDoubleClick}
        />

        {/* crosshair */}
        {crosshair && (
          <g pointerEvents="none">
            <line x1={crosshair.x} x2={crosshair.x} y1={geom.padT} y2={geom.height - PAD.B} stroke="rgba(245,245,240,0.2)" strokeDasharray="3 3" />
            <line x1={geom.padL} x2={size.w - geom.padR} y1={crosshair.y} y2={crosshair.y} stroke="rgba(245,245,240,0.2)" strokeDasharray="3 3" />
            <rect x={size.w - geom.padR + 2} y={crosshair.y - 9} width={geom.padR - 4} height={18} fill="var(--surface-2)" stroke="var(--border)" />
            <text x={size.w - geom.padR / 2} y={crosshair.y + 3.5} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="11" fill="var(--fg)">
              {fmt(priceOfY(crosshair.y, vp, geom), 2)}
            </text>
            {(() => {
              const i = Math.round(barOfX(crosshair.x, vp, geom));
              if (i < 0 || i >= bars.length) return null;
              return (
                <g>
                  <rect x={crosshair.x - 40} y={geom.height - PAD.B + 2} width={80} height={16} fill="var(--surface-2)" stroke="var(--border)" />
                  <text x={crosshair.x} y={geom.height - PAD.B + 13} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg)">
                    {fmtTime(bars[i].t)}
                  </text>
                </g>
              );
            })()}
          </g>
        )}
      </svg>

      {/* OHLC legend top-left */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-3 font-mono text-[11px]">
        <span className="text-fg">{symbol}</span>
        <span className="text-fg-faint">·</span>
        <span className="text-fg-dim">{exchange}</span>
        <span className="text-fg-faint">·</span>
        <span className="text-fg-dim">{timeframe}</span>
        <span className="text-fg-faint">·</span>
        <span className="text-fg-dim">O</span>
        <span className="text-fg">{fmt(last.o, 2)}</span>
        <span className="text-fg-dim">H</span>
        <span className="text-fg">{fmt(last.h, 2)}</span>
        <span className="text-fg-dim">L</span>
        <span className="text-fg">{fmt(last.l, 2)}</span>
        <span className="text-fg-dim">C</span>
        <span className={change >= 0 ? "text-bull" : "text-bear"}>{fmt(last.c, 2)}</span>
        <span className={change >= 0 ? "text-bull" : "text-bear"}>
          {change >= 0 ? "+" : ""}
          {fmt(change, 2)} ({change >= 0 ? "+" : ""}
          {fmt(changePct, 2)}%)
        </span>
        {replayBar != null && (
          <>
            <span className="text-fg-faint">·</span>
            <span className="border border-amber/60 bg-amber/10 px-1 text-amber">REPLAY · bar {replayBar + 1}/{allBars.length}</span>
          </>
        )}
      </div>

      {/* watermark */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="font-display text-[100px] tracking-tightest text-fg/[0.025] leading-none">
          lazybull<span className="italic">pro</span>
        </div>
      </div>
    </div>
  );
});

// ── series helpers
function SeriesLine({ values, bars, vp, geom, color, dashed }: { values: (number | null)[]; bars: Bar[]; vp: Viewport; geom: ChartGeom; color: string; dashed?: boolean }) {
  const path = useMemo(() => {
    let d = "";
    let started = false;
    for (let i = 0; i < bars.length; i++) {
      const v = values[i];
      if (v == null) {
        started = false;
        continue;
      }
      const x = xOfBar(bars[i].i, vp, geom);
      const y = yOfPrice(v, vp, geom);
      d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
      started = true;
    }
    return d;
  }, [values, bars, vp, geom]);
  return (
    <path
      d={path}
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      strokeDasharray={dashed ? "4 4" : undefined}
      pathLength={dashed ? undefined : 1}
      className={dashed ? "svg-fade-in" : "svg-draw-in"}
    />
  );
}

function BBOverlay({ bb, bars, vp, geom }: { bb: { mid: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] }; bars: Bar[]; vp: Viewport; geom: ChartGeom }) {
  const upPath = useMemo(() => {
    let d = "";
    let started = false;
    for (let i = 0; i < bars.length; i++) {
      const v = bb.upper[i];
      if (v == null) { started = false; continue; }
      const x = xOfBar(bars[i].i, vp, geom);
      const y = yOfPrice(v, vp, geom);
      d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
      started = true;
    }
    return d;
  }, [bb.upper, bars, vp, geom]);
  const loPath = useMemo(() => {
    let d = "";
    let started = false;
    for (let i = 0; i < bars.length; i++) {
      const v = bb.lower[i];
      if (v == null) { started = false; continue; }
      const x = xOfBar(bars[i].i, vp, geom);
      const y = yOfPrice(v, vp, geom);
      d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
      started = true;
    }
    return d;
  }, [bb.lower, bars, vp, geom]);
  return (
    <g>
      <SeriesLine values={bb.mid} bars={bars} vp={vp} geom={geom} color="rgba(245,245,240,0.4)" dashed />
      <path d={upPath} stroke="rgba(0,255,135,0.5)" strokeWidth={1} fill="none" pathLength={1} className="svg-draw-in" />
      <path d={loPath} stroke="rgba(0,255,135,0.5)" strokeWidth={1} fill="none" pathLength={1} className="svg-draw-in" />
    </g>
  );
}

function IchimokuOverlay({ ichi, bars, vp, geom }: { ichi: { conv: (number | null)[]; base: (number | null)[]; spanA: (number | null)[]; spanB: (number | null)[] }; bars: Bar[]; vp: Viewport; geom: ChartGeom }) {
  // cloud fill
  const cloud = useMemo(() => {
    const segs: { x: number; aY: number; bY: number; bullish: boolean }[] = [];
    for (let i = 0; i < bars.length; i++) {
      const a = ichi.spanA[i];
      const b = ichi.spanB[i];
      if (a == null || b == null) continue;
      segs.push({ x: xOfBar(bars[i].i, vp, geom), aY: yOfPrice(a, vp, geom), bY: yOfPrice(b, vp, geom), bullish: a > b });
    }
    return segs;
  }, [ichi, bars, vp, geom]);
  return (
    <g>
      {cloud.map((s, i) => (
        <line key={i} x1={s.x} x2={s.x} y1={s.aY} y2={s.bY} stroke={s.bullish ? "rgba(0,255,135,0.18)" : "rgba(255,46,99,0.18)"} strokeWidth={4} />
      ))}
      <SeriesLine values={ichi.conv} bars={bars} vp={vp} geom={geom} color="rgba(34,211,238,0.7)" />
      <SeriesLine values={ichi.base} bars={bars} vp={vp} geom={geom} color="rgba(255,46,99,0.7)" />
    </g>
  );
}

function RsiPane({ values, bars, vp, top, height, chartW, padL, padR }: { values: (number | null)[]; bars: Bar[]; vp: Viewport; top: number; height: number; chartW: number; padL: number; padR: number }) {
  const path = useMemo(() => {
    let d = "";
    let started = false;
    const slot = (chartW - padL - padR) / vp.span;
    for (let i = 0; i < bars.length; i++) {
      const v = values[i];
      if (v == null) { started = false; continue; }
      const x = padL + (i - vp.start) * slot + slot / 2;
      const y = top + 8 + ((100 - v) / 100) * (height - 16);
      d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
      started = true;
    }
    return d;
  }, [values, bars, vp, top, height, chartW, padL, padR]);
  const yLine = (level: number) => top + 8 + ((100 - level) / 100) * (height - 16);
  return (
    <g>
      <line x1={padL} x2={chartW - padR} y1={top} y2={top} stroke="var(--border)" />
      <text x={padL + 4} y={top + 12} fontFamily="var(--font-jetbrains)" fontSize="9" fill="var(--fg-faint)">RSI 14</text>
      <line x1={padL} x2={chartW - padR} y1={yLine(70)} y2={yLine(70)} stroke="var(--bear)" strokeOpacity="0.4" strokeDasharray="3 3" />
      <line x1={padL} x2={chartW - padR} y1={yLine(50)} y2={yLine(50)} stroke="rgba(245,245,240,0.15)" />
      <line x1={padL} x2={chartW - padR} y1={yLine(30)} y2={yLine(30)} stroke="var(--bull)" strokeOpacity="0.4" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke="var(--cyan)" strokeWidth={1.4} pathLength={1} className="svg-draw-in" />
    </g>
  );
}

function MacdPane({ m, bars, vp, top, height, chartW, padL, padR }: { m: { line: (number | null)[]; signal: (number | null)[]; hist: (number | null)[] }; bars: Bar[]; vp: Viewport; top: number; height: number; chartW: number; padL: number; padR: number }) {
  const visible = useMemo(() => {
    const lo = Math.max(0, Math.floor(vp.start));
    const hi = Math.min(bars.length - 1, Math.ceil(vp.start + vp.span));
    return { lo, hi };
  }, [bars.length, vp.start, vp.span]);
  const yMax = useMemo(() => {
    let mx = 0;
    for (let i = visible.lo; i <= visible.hi; i++) {
      mx = Math.max(mx, Math.abs(m.line[i] ?? 0), Math.abs(m.signal[i] ?? 0), Math.abs(m.hist[i] ?? 0));
    }
    return mx || 1;
  }, [m, visible]);
  const slot = (chartW - padL - padR) / vp.span;
  const yOf = (v: number) => top + height / 2 - (v / yMax) * (height / 2 - 8);
  return (
    <g>
      <line x1={padL} x2={chartW - padR} y1={top} y2={top} stroke="var(--border)" />
      <text x={padL + 4} y={top + 12} fontFamily="var(--font-jetbrains)" fontSize="9" fill="var(--fg-faint)">MACD 12·26·9</text>
      <line x1={padL} x2={chartW - padR} y1={top + height / 2} y2={top + height / 2} stroke="rgba(245,245,240,0.1)" />
      {/* histogram */}
      {Array.from({ length: visible.hi - visible.lo + 1 }, (_, k) => {
        const i = visible.lo + k;
        const v = m.hist[i];
        if (v == null) return null;
        const x = padL + (i - vp.start) * slot + slot / 2;
        const y = yOf(v);
        const baseY = top + height / 2;
        return <rect key={i} x={x - slot * 0.3} width={slot * 0.6} y={Math.min(y, baseY)} height={Math.abs(y - baseY)} fill={v >= 0 ? "var(--bull)" : "var(--bear)"} opacity="0.7" />;
      })}
      {/* MACD line */}
      <SeriesLineGeneric values={m.line} top={top} height={height} yMax={yMax} bars={bars} vp={vp} chartW={chartW} padL={padL} padR={padR} color="var(--cyan)" />
      {/* Signal line */}
      <SeriesLineGeneric values={m.signal} top={top} height={height} yMax={yMax} bars={bars} vp={vp} chartW={chartW} padL={padL} padR={padR} color="var(--amber)" />
    </g>
  );
}

function SeriesLineGeneric({ values, top, height, yMax, bars, vp, chartW, padL, padR, color }: { values: (number | null)[]; top: number; height: number; yMax: number; bars: Bar[]; vp: Viewport; chartW: number; padL: number; padR: number; color: string }) {
  const path = useMemo(() => {
    let d = "";
    let started = false;
    const slot = (chartW - padL - padR) / vp.span;
    for (let i = 0; i < bars.length; i++) {
      const v = values[i];
      if (v == null) { started = false; continue; }
      const x = padL + (i - vp.start) * slot + slot / 2;
      const y = top + height / 2 - (v / yMax) * (height / 2 - 8);
      d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
      started = true;
    }
    return d;
  }, [values, bars, vp, top, height, yMax, chartW, padL, padR]);
  return <path d={path} fill="none" stroke={color} strokeWidth={1.2} pathLength={1} className="svg-draw-in" />;
}

// ── individual drawing shapes ──
function DrawingShape({
  d,
  vp,
  geom,
  selected,
  chartW,
}: {
  d: Drawing;
  vp: Viewport;
  geom: ChartGeom;
  selected: boolean;
  chartW: number;
}) {
  const stroke = selected ? "var(--cyan)" : (d as { color?: string }).color ?? "var(--fg)";
  const sw = selected ? 1.8 : 1.4;

  if (d.tool === "horizontal") {
    const y = yOfPrice(d.p, vp, geom);
    return (
      <g>
        <line x1={geom.padL} x2={chartW - geom.padR} y1={y} y2={y} stroke={stroke} strokeWidth={sw} />
        <rect x={chartW - geom.padR + 2} y={y - 8} width={geom.padR - 4} height={16} fill={stroke} />
        <text x={chartW - geom.padR / 2} y={y + 4} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fontWeight="600" fill="var(--bg)">
          {fmt(d.p, 2)}
        </text>
      </g>
    );
  }

  if (d.tool === "trendline" || d.tool === "ray" || d.tool === "measure") {
    const ax = xOfBar(d.a.i, vp, geom);
    const ay = yOfPrice(d.a.p, vp, geom);
    let bx = xOfBar(d.b.i, vp, geom);
    let by = yOfPrice(d.b.p, vp, geom);
    if (d.tool === "ray") {
      const dx = bx - ax;
      const dy = by - ay;
      if (Math.abs(dx) > 0.001) {
        const t = (chartW - geom.padR - ax) / dx;
        bx = ax + dx * t;
        by = ay + dy * t;
      }
    }
    return (
      <g>
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke={stroke} strokeWidth={sw} />
        {d.tool === "measure" && (
          <g>
            <rect x={(ax + bx) / 2 - 60} y={(ay + by) / 2 - 22} width="120" height="36" fill="var(--surface-2)" stroke="var(--cyan)" />
            <text x={(ax + bx) / 2} y={(ay + by) / 2 - 8} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg)">
              ΔP {fmt(d.b.p - d.a.p, 2)} ({fmt(((d.b.p - d.a.p) / d.a.p) * 100, 2)}%)
            </text>
            <text x={(ax + bx) / 2} y={(ay + by) / 2 + 6} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-dim)">
              Δbars {Math.abs(Math.round(d.b.i - d.a.i))}
            </text>
          </g>
        )}
        {(selected || d.tool !== "measure") && (
          <>
            <circle cx={ax} cy={ay} r={selected ? 4 : 3} fill={stroke} />
            <circle cx={bx} cy={by} r={selected ? 4 : 3} fill={stroke} />
          </>
        )}
      </g>
    );
  }

  if (d.tool === "rect") {
    const ax = xOfBar(d.a.i, vp, geom);
    const ay = yOfPrice(d.a.p, vp, geom);
    const bx = xOfBar(d.b.i, vp, geom);
    const by = yOfPrice(d.b.p, vp, geom);
    return (
      <rect
        x={Math.min(ax, bx)}
        y={Math.min(ay, by)}
        width={Math.abs(bx - ax)}
        height={Math.abs(by - ay)}
        fill={stroke}
        fillOpacity={0.1}
        stroke={stroke}
        strokeWidth={sw}
      />
    );
  }

  if (d.tool === "fib") {
    const ax = xOfBar(d.a.i, vp, geom);
    const bx = xOfBar(d.b.i, vp, geom);
    const lo = Math.min(d.a.p, d.b.p);
    const hi = Math.max(d.a.p, d.b.p);
    const range = hi - lo;
    return (
      <g>
        {FIB_LEVELS.map((lv, i) => {
          const price = hi - range * lv;
          const y = yOfPrice(price, vp, geom);
          const c = FIB_COLORS[i];
          const x1 = Math.min(ax, bx);
          return (
            <g key={lv}>
              <line x1={x1} x2={chartW - geom.padR} y1={y} y2={y} stroke={c} strokeOpacity={0.6} strokeWidth={1} />
              <rect x={x1 - 60} y={y - 8} width={56} height={16} fill={c} fillOpacity={0.15} />
              <text x={x1 - 32} y={y + 4} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fill={c}>
                {lv} · {fmt(price, 2)}
              </text>
            </g>
          );
        })}
        <line x1={ax} x2={bx} y1={yOfPrice(d.a.p, vp, geom)} y2={yOfPrice(d.b.p, vp, geom)} stroke="var(--fg-faint)" strokeDasharray="3 3" />
      </g>
    );
  }

  if (d.tool === "channel") {
    const ax = xOfBar(d.a.i, vp, geom);
    const ay = yOfPrice(d.a.p, vp, geom);
    const bx = xOfBar(d.b.i, vp, geom);
    const by = yOfPrice(d.b.p, vp, geom);
    const offset = 36;
    return (
      <g>
        <line x1={ax} y1={ay} x2={bx} y2={by} stroke={stroke} strokeWidth={sw} />
        <line x1={ax} y1={ay - offset} x2={bx} y2={by - offset} stroke={stroke} strokeWidth={sw} />
        <polygon points={`${ax},${ay} ${bx},${by} ${bx},${by - offset} ${ax},${ay - offset}`} fill={stroke} fillOpacity={0.06} />
      </g>
    );
  }

  if (d.tool === "text") {
    const ax = xOfBar(d.a.i, vp, geom);
    const ay = yOfPrice(d.a.p, vp, geom);
    return (
      <g>
        <text x={ax} y={ay} fontFamily="var(--font-jetbrains)" fontSize="11" fill={stroke}>
          {d.text}
        </text>
        <circle cx={ax} cy={ay + 4} r={2} fill={stroke} />
      </g>
    );
  }

  if (d.tool === "callout") {
    const ax = xOfBar(d.a.i, vp, geom);
    const ay = yOfPrice(d.a.p, vp, geom);
    const w = Math.max(80, d.text.length * 6.4);
    return (
      <g>
        <rect x={ax - w / 2} y={ay - 28} width={w} height={20} fill={stroke} fillOpacity={0.18} stroke={stroke} />
        <text x={ax} y={ay - 14} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fill={stroke}>
          {d.text}
        </text>
        <line x1={ax} y1={ay - 8} x2={ax} y2={ay} stroke={stroke} />
        <circle cx={ax} cy={ay} r="3" fill={stroke} />
      </g>
    );
  }

  if (d.tool === "brush") {
    const path = d.pts
      .map((pt, i) => {
        const x = xOfBar(pt.i, vp, geom);
        const y = yOfPrice(pt.p, vp, geom);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return <path d={path} stroke={stroke} strokeWidth={sw + 0.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
  }

  return null;
}

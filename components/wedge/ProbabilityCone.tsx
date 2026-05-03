"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import type { MarketEvent } from "@/lib/events";

type Pt = { i: number; t: number; c: number };

export type Cone = {
  bars: Pt[]; // historical bars
  spot: number;
  iv: number;
  daysToExpiry: number;
  low: number; // user-set band low
  high: number; // user-set band high
  onChangeLow: (v: number) => void;
  onChangeHigh: (v: number) => void;
  onChangeDays?: (v: number) => void;
  events?: MarketEvent[];
};

const PAD = { L: 14, R: 78, T: 18, B: 36 };

export function ProbabilityCone({ bars, spot, iv, daysToExpiry, low, high, onChangeLow, onChangeHigh, onChangeDays, events = [] }: Cone) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 360 });
  const dragRef = useRef<{ which: "low" | "high" | "both" | null; startY: number; startLow: number; startHigh: number; startTimeX?: number; startDays?: number } | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect;
      setSize({ w: Math.max(360, r.width), h: Math.max(280, r.height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // visible domain
  const histN = Math.min(60, bars.length);
  const histBars = bars.slice(-histN);
  const totalBars = histN + Math.max(daysToExpiry, 5);
  const minPrice = Math.min(spot * 0.7, ...histBars.map((b) => b.c), low);
  const maxPrice = Math.max(spot * 1.3, ...histBars.map((b) => b.c), high);

  const inW = size.w - PAD.L - PAD.R;
  const inH = size.h - PAD.T - PAD.B;

  const xOf = (i: number) => PAD.L + (i / (totalBars - 1)) * inW;
  const yOf = (p: number) => PAD.T + ((maxPrice - p) / (maxPrice - minPrice)) * inH;
  const priceOf = (y: number) => maxPrice - ((y - PAD.T) / inH) * (maxPrice - minPrice);
  const daysOfX = (x: number) => Math.max(1, Math.round(((x - PAD.L) / inW) * (totalBars - 1) - histN + 1));

  // The cone path — 1σ, 2σ envelopes
  // Forecast horizon: bars from histN-1 to totalBars-1
  const cone = useMemo(() => {
    const pts1U: { x: number; y: number }[] = [];
    const pts1D: { x: number; y: number }[] = [];
    const pts2U: { x: number; y: number }[] = [];
    const pts2D: { x: number; y: number }[] = [];
    const pts3U: { x: number; y: number }[] = [];
    const pts3D: { x: number; y: number }[] = [];
    const startI = histN - 1;
    for (let i = startI; i < totalBars; i++) {
      const dDays = i - startI;
      const t = Math.max(1 / 365, dDays / 365);
      const sigT = iv * Math.sqrt(t);
      const x = xOf(i);
      // log-normal forward; bands at ±0.674σ (50%), ±1σ (68%), ±1.96σ (95%)
      const k1 = 0.674, k2 = 1.0, k3 = 1.96;
      const fwd = spot;
      pts1U.push({ x, y: yOf(fwd * Math.exp(k1 * sigT)) });
      pts1D.push({ x, y: yOf(fwd * Math.exp(-k1 * sigT)) });
      pts2U.push({ x, y: yOf(fwd * Math.exp(k2 * sigT)) });
      pts2D.push({ x, y: yOf(fwd * Math.exp(-k2 * sigT)) });
      pts3U.push({ x, y: yOf(fwd * Math.exp(k3 * sigT)) });
      pts3D.push({ x, y: yOf(fwd * Math.exp(-k3 * sigT)) });
    }
    const path = (up: typeof pts1U, dn: typeof pts1U) => {
      let d = "";
      up.forEach((p, i) => (d += `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)} `));
      for (let i = dn.length - 1; i >= 0; i--) d += `L${dn[i].x.toFixed(1)},${dn[i].y.toFixed(1)} `;
      return d + "Z";
    };
    return {
      band1: path(pts1U, pts1D),
      band2: path(pts2U, pts2D),
      band3: path(pts3U, pts3D),
      median: pts1U.map((p) => ({ x: p.x, y: yOf(spot) })),
    };
  }, [bars, daysToExpiry, iv, size.w, size.h, spot]);

  // History line
  const histPath = useMemo(() => {
    if (!histBars.length) return "";
    let d = "";
    histBars.forEach((b, i) => {
      const x = xOf(i);
      const y = yOf(b.c);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)} `;
    });
    return d;
  }, [histBars, size.w, size.h, minPrice, maxPrice]);

  const yLow = yOf(low);
  const yHigh = yOf(high);
  const xExpiry = xOf(totalBars - 1);

  // ── interactions
  const screenY = (e: React.MouseEvent | MouseEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return (e as MouseEvent).clientY - rect.top;
  };
  const screenX = (e: React.MouseEvent | MouseEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return (e as MouseEvent).clientX - rect.left;
  };

  const startDrag = (which: "low" | "high" | "both" | "expiry", e: React.MouseEvent) => {
    e.stopPropagation();
    if (which === "expiry") {
      dragRef.current = { which: null, startY: 0, startLow: low, startHigh: high, startTimeX: screenX(e), startDays: daysToExpiry };
      const onMove = (ev: MouseEvent) => {
        const dx = screenX(ev) - (dragRef.current!.startTimeX as number);
        const days = (dragRef.current!.startDays as number) + Math.round((dx / inW) * (totalBars - histN));
        onChangeDays?.(Math.max(1, Math.min(365, days)));
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return;
    }
    dragRef.current = { which, startY: screenY(e), startLow: low, startHigh: high };
    const onMove = (ev: MouseEvent) => {
      const dy = screenY(ev) - dragRef.current!.startY;
      const dPrice = (dy / inH) * (maxPrice - minPrice);
      if (dragRef.current!.which === "low") {
        onChangeLow(Math.min(high - 0.5, dragRef.current!.startLow - dPrice));
      } else if (dragRef.current!.which === "high") {
        onChangeHigh(Math.max(low + 0.5, dragRef.current!.startHigh - dPrice));
      } else {
        onChangeLow(dragRef.current!.startLow - dPrice);
        onChangeHigh(dragRef.current!.startHigh - dPrice);
      }
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // y ticks
  const yTicks = useMemo(() => {
    const n = 5;
    const step = (maxPrice - minPrice) / (n - 1);
    return Array.from({ length: n }, (_, i) => minPrice + i * step);
  }, [minPrice, maxPrice]);

  // event pin positions (within forecast)
  const pinned = useMemo(() => {
    const out: { x: number; e: MarketEvent }[] = [];
    if (!histBars.length) return out;
    const baseTime = histBars[histBars.length - 1].t;
    const day = 86_400_000;
    for (const ev of events) {
      const evDay = Math.round((new Date(ev.date).getTime() - baseTime) / day);
      const i = histN - 1 + evDay;
      if (i >= histN - 1 && i < totalBars) {
        out.push({ x: xOf(i), e: ev });
      }
    }
    return out;
  }, [events, histBars, totalBars, size.w, size.h]);

  return (
    <div ref={wrapRef} className="relative h-full w-full select-none overflow-hidden bg-bg">
      <svg width="100%" height="100%" viewBox={`0 0 ${size.w} ${size.h}`}>
        <defs>
          <linearGradient id="cone-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--bull)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--bull)" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="band-grad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--bull)" stopOpacity="0.16" />
            <stop offset="50%" stopColor="var(--bull)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--bear)" stopOpacity="0.16" />
          </linearGradient>
        </defs>

        {/* y grid */}
        {yTicks.map((p, i) => {
          const y = yOf(p);
          return (
            <g key={i}>
              <line x1={PAD.L} x2={size.w - PAD.R} y1={y} y2={y} stroke="rgba(245,245,240,0.05)" />
              <text x={size.w - PAD.R + 8} y={y + 3} fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-faint)">
                {p.toFixed(2)}
              </text>
            </g>
          );
        })}

        {/* Cone bands — widest first */}
        <path d={cone.band3} fill="url(#cone-grad)" opacity="0.6" />
        <path d={cone.band2} fill="url(#cone-grad)" opacity="0.8" />
        <path d={cone.band1} fill="url(#cone-grad)" opacity="1" />
        {/* Median forward */}
        <line x1={xOf(histN - 1)} x2={xOf(totalBars - 1)} y1={yOf(spot)} y2={yOf(spot)} stroke="var(--cyan)" strokeOpacity="0.4" strokeDasharray="4 4" />

        {/* History line + filled area under it */}
        <path d={`${histPath} L${xOf(histN - 1)},${size.h - PAD.B} L${xOf(0)},${size.h - PAD.B} Z`} fill="rgba(245,245,240,0.04)" />
        <path d={histPath} fill="none" stroke="var(--fg)" strokeWidth="1.4" />

        {/* "now" line */}
        <line x1={xOf(histN - 1)} x2={xOf(histN - 1)} y1={PAD.T} y2={size.h - PAD.B} stroke="var(--fg-faint)" strokeDasharray="2 4" />
        <text x={xOf(histN - 1) + 4} y={PAD.T + 12} fontFamily="var(--font-jetbrains)" fontSize="9" fill="var(--fg-faint)">NOW</text>

        {/* User band */}
        <rect
          x={xOf(histN - 1)}
          y={Math.min(yLow, yHigh)}
          width={xExpiry - xOf(histN - 1)}
          height={Math.abs(yHigh - yLow)}
          fill="var(--bull)"
          fillOpacity="0.10"
          stroke="var(--bull)"
          strokeOpacity="0.5"
          strokeDasharray="6 3"
          onMouseDown={(e) => startDrag("both", e)}
          style={{ cursor: "grab" }}
        />

        {/* High handle */}
        <g onMouseDown={(e) => startDrag("high", e)} style={{ cursor: "ns-resize" }}>
          <line x1={xOf(histN - 1)} x2={xExpiry} y1={yHigh} y2={yHigh} stroke="var(--bull)" strokeWidth="1.4" />
          <rect x={size.w - PAD.R + 2} y={yHigh - 9} width={PAD.R - 4} height="18" fill="var(--bull)" />
          <text x={size.w - PAD.R / 2} y={yHigh + 4} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="11" fontWeight="600" fill="var(--bg)">
            {high.toFixed(2)}
          </text>
        </g>
        {/* Low handle */}
        <g onMouseDown={(e) => startDrag("low", e)} style={{ cursor: "ns-resize" }}>
          <line x1={xOf(histN - 1)} x2={xExpiry} y1={yLow} y2={yLow} stroke="var(--bull)" strokeWidth="1.4" />
          <rect x={size.w - PAD.R + 2} y={yLow - 9} width={PAD.R - 4} height="18" fill="var(--bull)" />
          <text x={size.w - PAD.R / 2} y={yLow + 4} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="11" fontWeight="600" fill="var(--bg)">
            {low.toFixed(2)}
          </text>
        </g>

        {/* Expiry handle (drag along x) */}
        <g onMouseDown={(e) => startDrag("expiry", e)} style={{ cursor: "ew-resize" }}>
          <line x1={xExpiry} x2={xExpiry} y1={PAD.T} y2={size.h - PAD.B} stroke="var(--amber)" strokeWidth="1.4" strokeDasharray="2 4" />
          <rect x={xExpiry - 36} y={PAD.T} width="72" height="16" fill="var(--amber)" />
          <text x={xExpiry} y={PAD.T + 11} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="10" fontWeight="600" fill="var(--bg)">
            {daysToExpiry}d → exp
          </text>
        </g>

        {/* Spot marker */}
        <g>
          <circle cx={xOf(histN - 1)} cy={yOf(spot)} r="3" fill="var(--cyan)" />
          <rect x={size.w - PAD.R + 2} y={yOf(spot) - 9} width={PAD.R - 4} height="18" fill="var(--cyan)" />
          <text x={size.w - PAD.R / 2} y={yOf(spot) + 4} textAnchor="middle" fontFamily="var(--font-jetbrains)" fontSize="11" fontWeight="600" fill="var(--bg)">
            {spot.toFixed(2)}
          </text>
        </g>

        {/* Event pins */}
        {pinned.map(({ x, e }) => (
          <g key={e.id}>
            <line x1={x} x2={x} y1={PAD.T + 22} y2={size.h - PAD.B} stroke={eventColor(e.kind)} strokeOpacity="0.35" strokeDasharray="1 4" />
            <g>
              <rect x={x - 7} y={size.h - PAD.B - 4} width="14" height="6" fill={eventColor(e.kind)} />
              <title>{e.title} — {e.date}</title>
            </g>
          </g>
        ))}

        {/* Confidence labels */}
        <g pointerEvents="none">
          <text x={xExpiry - 6} y={PAD.T + 32} textAnchor="end" fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-faint)">
            ◐ 50% / 68% / 95% forecast
          </text>
        </g>

        {/* x time line baseline */}
        <line x1={PAD.L} x2={size.w - PAD.R} y1={size.h - PAD.B} y2={size.h - PAD.B} stroke="var(--border)" />
      </svg>

      {/* Drag tip overlay */}
      <div className="pointer-events-none absolute right-3 top-3 flex flex-col items-end gap-1 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        <span><span className="text-bull">drag bands</span> to move your zone</span>
        <span><span className="text-amber">drag the exp line</span> →← to change date</span>
      </div>
    </div>
  );
}

function eventColor(k: MarketEvent["kind"]) {
  switch (k) {
    case "earnings": return "var(--bear)";
    case "fed": return "var(--amber)";
    case "cpi": return "var(--cyan)";
    case "dividend": return "var(--bull)";
    case "split": return "var(--plasma)";
  }
}

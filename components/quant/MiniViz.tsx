"use client";

// Small SVG viz primitives used inside bot cells. Lightweight on purpose —
// the workbench can render dozens of cells without sweating.

import { useMemo } from "react";

type SeriesV = { values: (number | null)[]; color: string; label: string; dashed?: boolean };

export function PriceWithOverlay({
  closes,
  overlay = [],
  signals = [],
  height = 160,
  width = 720,
}: {
  closes: number[];
  overlay?: SeriesV[];
  signals?: { i: number; kind: "buy" | "sell" | "warn" }[];
  height?: number;
  width?: number;
}) {
  const padL = 4;
  const padR = 4;
  const padT = 6;
  const padB = 6;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const all: number[] = [...closes];
  for (const o of overlay) for (const v of o.values) if (v != null) all.push(v);
  const max = Math.max(...all);
  const min = Math.min(...all);
  const range = max - min || 1;
  const padding = range * 0.04;
  const yMax = max + padding;
  const yMin = min - padding;
  const yRange = yMax - yMin;
  const stepX = innerW / Math.max(1, closes.length - 1);
  const yOf = (v: number) => padT + ((yMax - v) / yRange) * innerH;

  const closePath = useMemo(
    () =>
      closes
        .map((c, i) => `${i === 0 ? "M" : "L"}${(padL + i * stepX).toFixed(1)},${yOf(c).toFixed(1)}`)
        .join(" "),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [closes, width, height]
  );

  const buildPath = (vals: (number | null)[]) => {
    let d = "";
    let started = false;
    vals.forEach((v, i) => {
      if (v == null) {
        started = false;
        return;
      }
      const x = padL + i * stepX;
      const y = yOf(v);
      d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
      started = true;
    });
    return d.trim();
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
      {/* close line */}
      <path d={closePath} fill="none" stroke="var(--fg)" strokeOpacity="0.7" strokeWidth="1.2" />
      {/* overlays */}
      {overlay.map((o, idx) => (
        <path
          key={idx}
          d={buildPath(o.values)}
          fill="none"
          stroke={o.color}
          strokeWidth="1.2"
          strokeDasharray={o.dashed ? "3 3" : undefined}
          opacity={0.95}
        />
      ))}
      {/* signal markers */}
      {signals.map((s, i) => {
        const x = padL + s.i * stepX;
        const c = closes[s.i] ?? closes[closes.length - 1];
        const y = yOf(c);
        const color = s.kind === "buy" ? "var(--bull)" : s.kind === "sell" ? "var(--bear)" : "var(--amber)";
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={padT} y2={padT + innerH} stroke={color} strokeOpacity="0.18" />
            <circle cx={x} cy={y} r="3" fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

export function PaneLine({
  series,
  refLines = [],
  height = 80,
  width = 720,
  histogram = false,
}: {
  series: SeriesV[];
  refLines?: { value: number; color: string; label?: string }[];
  height?: number;
  width?: number;
  histogram?: boolean;
}) {
  const padL = 4;
  const padR = 4;
  const padT = 4;
  const padB = 4;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const all: number[] = [];
  for (const s of series) for (const v of s.values) if (v != null) all.push(v);
  for (const r of refLines) all.push(r.value);
  const max = Math.max(...all, 0);
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const yMax = max + range * 0.05;
  const yMin = min - range * 0.05;
  const yRange = yMax - yMin;
  const yOf = (v: number) => padT + ((yMax - v) / yRange) * innerH;
  const len = series[0]?.values.length ?? 0;
  const stepX = innerW / Math.max(1, len - 1);

  const buildPath = (vals: (number | null)[]) => {
    let d = "";
    let started = false;
    vals.forEach((v, i) => {
      if (v == null) {
        started = false;
        return;
      }
      const x = padL + i * stepX;
      const y = yOf(v);
      d += `${started ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
      started = true;
    });
    return d.trim();
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
      {refLines.map((r, i) => {
        const y = yOf(r.value);
        return (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={y} y2={y} stroke={r.color} strokeOpacity="0.4" strokeDasharray="2 4" />
          </g>
        );
      })}
      {histogram && series[0] && (() => {
        const bw = Math.max(1, stepX * 0.8);
        const zeroY = yOf(0);
        return series[0].values.map((v, i) => {
          if (v == null) return null;
          const x = padL + i * stepX - bw / 2;
          const y = yOf(v);
          const h = Math.abs(y - zeroY);
          return (
            <rect
              key={i}
              x={x}
              y={Math.min(y, zeroY)}
              width={bw}
              height={Math.max(1, h)}
              fill={v >= 0 ? "var(--bull)" : "var(--bear)"}
              opacity="0.6"
            />
          );
        });
      })()}
      {series.map((s, idx) => {
        if (idx === 0 && histogram) return null;
        return (
          <path
            key={idx}
            d={buildPath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth="1.3"
            strokeDasharray={s.dashed ? "3 3" : undefined}
          />
        );
      })}
    </svg>
  );
}

export function EquitySpark({
  equity,
  width = 200,
  height = 60,
  color = "var(--bull)",
}: {
  equity: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (equity.length < 2) return null;
  const max = Math.max(...equity);
  const min = Math.min(...equity);
  const range = max - min || 1;
  const stepX = width / (equity.length - 1);
  const path = equity
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  const ret = (equity[equity.length - 1] - equity[0]) / equity[0];
  const tone = ret >= 0 ? color : "var(--bear)";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`eq-${tone.replace(/[()]/g, "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.35" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${width},${height} L0,${height} Z`} fill={`url(#eq-${tone.replace(/[()]/g, "")})`} />
      <path d={path} fill="none" stroke={tone} strokeWidth="1.4" />
    </svg>
  );
}

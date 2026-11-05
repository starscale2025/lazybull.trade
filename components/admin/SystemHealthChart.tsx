"use client";

import { useState } from "react";
import type { HealthPoint } from "@/lib/admin-data";

// One series, because one series is all this host can honestly draw.
//
// This chart used to plot req/s, p99 latency and errors/min. None of the three
// existed: there is no request log, no latency histogram and no error counter
// anywhere in the codebase — all three lines came out of a seeded PRNG in
// lib/admin-data.ts. What is real is the events collection's own arrival rate,
// so that is what is plotted, and the subtitle says so out loud.

export function SystemHealthChart({ data, note }: { data: HealthPoint[]; note: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 720;
  const h = 200;
  const padL = 34;
  const padR = 8;
  const padT = 14;
  const padB = 22;

  const vals = data.map((d) => d.events);
  const max = Math.max(1, ...vals);
  const total = vals.reduce((a, b) => a + b, 0);
  const stepX = (w - padL - padR) / Math.max(1, data.length - 1);
  const yOf = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${(padL + i * stepX).toFixed(1)},${yOf(d.events).toFixed(1)}`).join(" ");
  const area = `${line} L${(padL + (data.length - 1) * stepX).toFixed(1)},${h - padB} L${padL},${h - padB} Z`;
  const point = hover != null ? data[hover] : null;

  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between gap-3 border-b border-border-soft bg-bg-soft px-3 py-2 t-chrome text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          <span className="text-bull">ingest rate</span>
          <span className="text-fg-faint">·</span>
          <span>events / min · last {data.length}m</span>
        </div>
        <span className="tabular-nums text-fg">
          {total.toLocaleString()} events <span className="text-fg-faint">· peak {max}/min</span>
        </span>
      </div>

      <div className="relative flex-1 px-2 py-3">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: 200 }}>
          {[0.25, 0.5, 0.75].map((p) => (
            <line
              key={p}
              x1={padL}
              x2={w - padR}
              y1={padT + (h - padT - padB) * p}
              y2={padT + (h - padT - padB) * p}
              stroke="var(--grid)"
              strokeWidth="1"
            />
          ))}
          <text x={4} y={padT + 4} fill="var(--fg)" fillOpacity={0.45} fontSize="9" fontFamily="var(--font-jetbrains), ui-monospace, monospace">
            {max}
          </text>
          <text x={4} y={h - padB} fill="var(--fg)" fillOpacity={0.45} fontSize="9" fontFamily="var(--font-jetbrains), ui-monospace, monospace">
            0
          </text>
          <path d={area} fill="var(--bull)" fillOpacity={0.1} />
          <path d={line} fill="none" stroke="var(--bull)" strokeWidth="1.4" />
          {data.map((d, i) =>
            i % 15 === 0 ? (
              <line key={i} x1={padL + i * stepX} x2={padL + i * stepX} y1={h - padB} y2={h - padB + 4} stroke="var(--fg)" strokeOpacity={0.2} />
            ) : null,
          )}
          {data.map((d, i) => (
            <rect
              key={`hit-${d.t}`}
              x={padL + i * stepX - stepX / 2}
              y={0}
              width={stepX}
              height={h}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
          {point && (
            <line x1={padL + (hover ?? 0) * stepX} x2={padL + (hover ?? 0) * stepX} y1={padT} y2={h - padB} stroke="var(--bull)" strokeOpacity={0.4} />
          )}
        </svg>

        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2 px-2">
          <p className="max-w-[62ch] font-mono text-[0.625rem] leading-relaxed text-fg-faint">{note}</p>
          <span className="font-mono text-[0.625rem] tabular-nums text-fg-dim">
            {point
              ? `${new Date(point.t).toISOString().slice(11, 16)}Z · ${point.events}/min`
              : `now · ${data[data.length - 1]?.events ?? 0}/min`}
          </span>
        </div>
      </div>
    </div>
  );
}

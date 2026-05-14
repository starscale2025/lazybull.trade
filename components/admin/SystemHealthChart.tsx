"use client";

import { useState } from "react";
import type { HealthSeries } from "@/lib/admin-data";

type Series = { key: keyof Omit<HealthSeries, "t">; label: string; color: string; unit: string };
const SERIES: Series[] = [
  { key: "rps", label: "req/s", color: "var(--bull)", unit: "rps" },
  { key: "p99", label: "p99 latency", color: "var(--cyan)", unit: "ms" },
  { key: "err", label: "errors", color: "var(--bear)", unit: "/min" },
];

export function SystemHealthChart({ data }: { data: HealthSeries[] }) {
  const [active, setActive] = useState<Series["key"] | "all">("all");
  const w = 720;
  const h = 220;
  const padL = 36;
  const padR = 8;
  const padT = 14;
  const padB = 24;

  function pathFor(key: Series["key"], color: string) {
    const vals = data.map((d) => d[key]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const stepX = (w - padL - padR) / (data.length - 1);
    const yOf = (v: number) => padT + ((max - v) / range) * (h - padT - padB);
    const line = data
      .map((d, i) => `${i === 0 ? "M" : "L"}${(padL + i * stepX).toFixed(1)},${yOf(d[key]).toFixed(1)}`)
      .join(" ");
    return { line, color, min, max, vals };
  }

  return (
    <div className="relative h-full overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          <span className="text-bull">system health</span>
          <span className="text-fg-faint">·</span>
          <span>last {data.length}m</span>
        </div>
        <div className="flex items-center gap-2">
          {(["all", ...SERIES.map((s) => s.key)] as const).map((k) => (
            <button
              key={k}
              onClick={() => setActive(k)}
              className={`border px-2 py-0.5 transition-colors ${
                active === k
                  ? "border-bull bg-bull/10 text-bull"
                  : "border-border text-fg-dim hover:text-fg"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="relative px-2 py-3">
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: 220 }}>
          {/* gridlines */}
          {[0.25, 0.5, 0.75].map((p) => (
            <line
              key={p}
              x1={padL}
              x2={w - padR}
              y1={padT + (h - padT - padB) * p}
              y2={padT + (h - padT - padB) * p}
              stroke="rgba(245,245,240,0.06)"
              strokeWidth="1"
            />
          ))}
          {/* x-axis ticks (every 15 mins) */}
          {data.map((d, i) =>
            i % 15 === 0 ? (
              <line
                key={i}
                x1={padL + (i * (w - padL - padR)) / (data.length - 1)}
                x2={padL + (i * (w - padL - padR)) / (data.length - 1)}
                y1={h - padB}
                y2={h - padB + 4}
                stroke="rgba(245,245,240,0.2)"
              />
            ) : null
          )}

          {/* series */}
          {SERIES.filter((s) => active === "all" || active === s.key).map((s) => {
            const { line, color } = pathFor(s.key, s.color);
            return <path key={s.key} d={line} fill="none" stroke={color} strokeWidth="1.4" />;
          })}
        </svg>

        {/* legend */}
        <div className="mt-2 flex flex-wrap gap-3 px-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          {SERIES.map((s) => {
            const last = data[data.length - 1][s.key];
            return (
              <div key={s.key} className="flex items-center gap-2">
                <span className="size-2" style={{ background: s.color }} />
                <span>{s.label}</span>
                <span className="tabular-nums" style={{ color: s.color }}>{last}{s.unit}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

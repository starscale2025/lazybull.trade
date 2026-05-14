import type { KpiCell } from "@/lib/admin-data";
import { CountUp } from "@/components/atmosphere/CountUp";

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 120;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block w-full h-7">
      <defs>
        <linearGradient id={`spk-${color.replace(/\W+/g, "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#spk-${color.replace(/\W+/g, "")})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export function KpiStrip({ cells }: { cells: KpiCell[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border md:grid-cols-3 lg:grid-cols-6">
      {cells.map((c) => {
        const tone =
          c.tone === "bull" ? "var(--bull)" :
          c.tone === "bear" ? "var(--bear)" :
          c.tone === "amber" ? "var(--amber)" :
          "var(--fg)";
        const deltaTone =
          c.delta == null ? "text-fg-faint"
          : c.delta > 0 ? "text-bull"
          : c.delta < 0 ? "text-bear"
          : "text-fg-faint";
        const numeric = typeof c.v === "number" ? c.v : 0;
        const isLargeNumber = typeof c.v === "number" && c.v >= 1000;
        return (
          <div key={c.k} className="group relative bg-bg p-4 transition-colors hover:bg-surface">
            <div className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-bull/60 transition-transform duration-500 group-hover:scale-x-100" />
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              <span>{c.k}</span>
              {c.delta != null && (
                <span className={`tabular-nums ${deltaTone}`}>
                  {c.delta > 0 ? "▲" : c.delta < 0 ? "▼" : "·"} {Math.abs(c.delta).toFixed(1)}%
                </span>
              )}
            </div>
            <div
              className="mt-2 font-display text-3xl tracking-tightest tabular-nums"
              style={{ color: tone }}
            >
              {typeof c.v === "number" ? (
                <CountUp
                  to={numeric}
                  decimals={isLargeNumber ? 0 : numeric < 10 ? 1 : 0}
                  duration={1400}
                  separator
                />
              ) : (
                c.v
              )}
              {c.unit && <span className="ml-1 text-base text-fg-dim">{c.unit}</span>}
            </div>
            {c.spark && (
              <div className="mt-2">
                <Sparkline data={c.spark} color={tone} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import type { KpiCell } from "@/lib/admin-data";
import { CountUp } from "@/components/atmosphere/CountUp";

// The strip that carries the memo's three numbers. Two changes matter beyond
// the data source: a cell now prints `sub` — the sentence saying what it
// literally counts, e.g. "12/48 signups traded within a day" — and a delta is
// rendered ONLY when the metric actually has a previous window to compare
// with. The seeded version hardcoded "+6.4%", "+12.1%", "−34.2%" on every
// cell forever, which is the exact shape of the lie the diligence memo caught.

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 120;
  const h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = w / Math.max(1, data.length - 1);
  const path = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  const id = `spk-${color.replace(/\W+/g, "")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block h-7 w-full">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L${w},${h} L0,${h} Z`} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  );
}

export function KpiStrip({ cells }: { cells: KpiCell[] }) {
  if (cells.length === 0) {
    return (
      <div className="border border-border bg-bg p-6 text-center font-mono text-[0.6875rem] text-fg-faint">
        <span className="text-bear">offline</span> · no KPI could be computed
      </div>
    );
  }
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
        // A cell states its own precision now; the old heuristic printed one
        // decimal on anything under 10, which turned "0 signups" into "0.0".
        const decimals = c.decimals ?? 0;
        return (
          <div key={c.k} className="group relative flex flex-col bg-bg p-4 transition-colors hover:bg-surface">
            <div className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-bull/60 transition-transform duration-500 group-hover:scale-x-100" />
            <div className="flex items-center justify-between t-chrome text-fg-faint">
              <span>{c.k}</span>
              {c.delta != null && (
                <span className={`tabular-nums ${deltaTone}`} title="vs the previous equal window">
                  {c.delta > 0 ? "▲" : c.delta < 0 ? "▼" : "·"} {Math.abs(c.delta).toFixed(1)}%
                </span>
              )}
            </div>
            <div className="mt-2 font-display text-3xl tracking-tightest tabular-nums" style={{ color: tone }}>
              {typeof c.v === "number" ? (
                <CountUp to={numeric} decimals={decimals} duration={1400} separator />
              ) : (
                c.v
              )}
              {c.unit && <span className="ml-1 text-base text-fg-dim">{c.unit}</span>}
            </div>
            {c.sub && (
              <div className="mt-1.5 font-mono text-[0.625rem] leading-snug text-fg-faint">{c.sub}</div>
            )}
            {c.spark && c.spark.length > 1 && (
              <div className="mt-auto pt-2">
                <Sparkline data={c.spark} color={tone} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

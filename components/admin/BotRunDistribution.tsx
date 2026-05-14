import type { BotRunRow } from "@/lib/admin-data";

export function BotRunDistribution({ rows }: { rows: BotRunRow[] }) {
  const max = Math.max(...rows.map((r) => r.runs));
  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="text-bull">quant bots</span>
          <span className="text-fg-faint">·</span>
          <span>runs · 24h</span>
        </div>
        <span className="text-fg-faint">{rows.length} bots</span>
      </div>
      <div className="flex flex-col divide-y divide-border-soft">
        {rows.map((r, i) => {
          const w = (r.runs / max) * 100;
          return (
            <div key={r.id} className="group relative grid grid-cols-[28px_1fr_72px_44px] items-center gap-2 px-3 py-1.5 transition-colors hover:bg-surface">
              <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0">
                <div className="truncate font-mono text-[12px] text-fg">{r.label}</div>
                <div className="mt-1 h-1 w-full overflow-hidden bg-border-soft">
                  <div
                    className="h-full bg-bull transition-all duration-700 ease-out"
                    style={{ width: `${w.toFixed(1)}%` }}
                  />
                </div>
              </div>
              <span className="text-right font-mono text-[11px] tabular-nums text-fg">
                {r.runs.toLocaleString()}
              </span>
              <span className="text-right font-mono text-[10px] tabular-nums text-fg-faint">
                {(r.pct * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

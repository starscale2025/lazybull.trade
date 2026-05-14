import type { SymbolRow } from "@/lib/admin-data";

function intensityColor(t: number): string {
  // bull green at high, fading to surface at low
  const a = Math.max(0.06, t);
  return `rgba(46, 232, 165, ${a})`;
}

export function SymbolHeatmap({ rows }: { rows: SymbolRow[] }) {
  const max = Math.max(...rows.map((r) => r.trades));
  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="text-bull">symbol heatmap</span>
          <span className="text-fg-faint">·</span>
          <span>top traded · 24h</span>
        </div>
        <span className="text-fg-faint">{rows.length} syms</span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-border md:grid-cols-4">
        {rows.map((r) => {
          const t = r.trades / max;
          const up = r.pnl >= 0;
          return (
            <div
              key={r.sym}
              className="group relative overflow-hidden bg-bg p-3 transition-colors hover:bg-surface"
            >
              <div
                className="pointer-events-none absolute inset-0 transition-opacity group-hover:opacity-100"
                style={{
                  background: `linear-gradient(180deg, ${intensityColor(t)} 0%, rgba(46,232,165,0) 80%)`,
                  opacity: 0.6,
                }}
              />
              <div className="relative">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                  <span className="font-display text-base text-fg">{r.sym}</span>
                  <span className={up ? "text-bull" : "text-bear"}>
                    {up ? "▲" : "▼"} {Math.abs(r.pnl).toFixed(0)}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  {r.trades.toLocaleString()} trades
                </div>
                <div className="mt-2 h-1 overflow-hidden bg-border-soft">
                  <div
                    className="h-full bg-bull transition-all"
                    style={{ width: `${(t * 100).toFixed(0)}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[9px] tabular-nums text-fg-faint">
                  <span>iv {r.iv.toFixed(1)}%</span>
                  <span>{(r.volume / 1_000_000).toFixed(2)}M vol</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

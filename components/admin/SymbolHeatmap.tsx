import type { SymbolData } from "@/lib/admin-data";
import { Empty, Tile } from "./Tile";

// Top traded symbols, from the props the product actually emits: `sym` on
// order_submitted and bet_placed, `underlying` on bet_opened.
//
// Gone with the seed: the volume and implied-vol columns (nothing records
// either for a paper order) and the per-symbol P/L (the events carry the
// order, never its outcome). A tile of four columns where three were invented
// is what the diligence memo meant by "unmeasurable from outside".

function intensityColor(t: number): string {
  const a = Math.max(0.06, t);
  return `color-mix(in srgb, var(--bull) ${(a * 100).toFixed(1)}%, transparent)`;
}

export function SymbolHeatmap({ data }: { data: SymbolData }) {
  const rows = data.rows;
  const max = rows.length ? Math.max(...rows.map((r) => r.trades)) : 1;
  const total = rows.reduce((a, b) => a + b.trades, 0);
  return (
    <Tile
      label="symbol heatmap"
      meta={`top traded · ${data.windowDays}d`}
      right={rows.length ? `${rows.length} syms · ${total.toLocaleString()} orders` : undefined}
    >
      {rows.length === 0 ? (
        <Empty reason={data.note ?? "no data"} />
      ) : (
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {rows.map((r) => {
            const t = r.trades / max;
            return (
              <div key={r.sym} className="group relative overflow-hidden bg-bg p-3 transition-colors hover:bg-surface">
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: `linear-gradient(180deg, ${intensityColor(t)} 0%, transparent 80%)`, opacity: 0.6 }}
                />
                <div className="relative">
                  <div className="font-display text-base text-fg">{r.sym}</div>
                  <div className="mt-1 t-chrome text-fg-dim">{r.trades.toLocaleString()} orders</div>
                  <div className="mt-2 h-1 overflow-hidden bg-border-soft">
                    <div className="h-full bg-bull transition-all" style={{ width: `${(t * 100).toFixed(0)}%` }} />
                  </div>
                  <div className="mt-1 font-mono text-[0.625rem] tabular-nums text-fg-faint">
                    {r.traders} {r.traders === 1 ? "trader" : "traders"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Tile>
  );
}

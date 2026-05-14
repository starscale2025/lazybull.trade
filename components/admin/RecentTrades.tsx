import type { TradeRow } from "@/lib/admin-data";

const STATUS_BADGE: Record<TradeRow["status"], string> = {
  open: "border-bull/40 bg-bull/5 text-bull",
  "closed-profit": "border-bull bg-bull/15 text-bull",
  "closed-loss": "border-bear bg-bear/15 text-bear",
  killed: "border-amber bg-amber/15 text-amber",
};

function rel(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function RecentTrades({ rows }: { rows: TradeRow[] }) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="text-bull">recent paper trades</span>
          <span className="text-fg-faint">·</span>
          <span>last {rows.length}</span>
        </div>
      </div>
      <div className="grid grid-cols-[60px_100px_60px_1fr_60px_84px_84px_88px] gap-2 border-b border-border-soft bg-bg-soft px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
        <span>when</span>
        <span>user</span>
        <span>sym</span>
        <span>strategy</span>
        <span>legs</span>
        <span className="text-right">cost</span>
        <span className="text-right">p/l</span>
        <span className="text-right">status</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-border-soft">
          {rows.map((r) => {
            const up = r.pnl >= 0;
            return (
              <div
                key={r.id}
                className="group grid grid-cols-[60px_100px_60px_1fr_60px_84px_84px_88px] items-center gap-2 px-3 py-1.5 font-mono text-[11px] tabular-nums transition-colors hover:bg-surface"
              >
                <span className="text-fg-faint">{rel(r.t)}</span>
                <span className="truncate text-fg-dim">{r.user}</span>
                <span className="text-fg">{r.sym}</span>
                <span className="truncate text-fg-dim">{r.strategy}</span>
                <span className="text-fg-dim">{r.legs}</span>
                <span className={`text-right ${r.cost < 0 ? "text-bull" : "text-bear"}`}>
                  {r.cost < 0 ? "+" : "−"}${Math.abs(r.cost)}
                </span>
                <span className={`text-right ${up ? "text-bull" : "text-bear"}`}>
                  {up ? "+" : "−"}${Math.abs(r.pnl)}
                </span>
                <span className={`border px-1.5 py-0.5 text-center text-[9px] uppercase tracking-wider ${STATUS_BADGE[r.status]}`}>
                  {r.status === "closed-profit" ? "win" : r.status === "closed-loss" ? "loss" : r.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

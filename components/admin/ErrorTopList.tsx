import type { ErrorRow } from "@/lib/admin-data";

function rel(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function ErrorTopList({ rows }: { rows: ErrorRow[] }) {
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="text-bear">top errors</span>
          <span className="text-fg-faint">·</span>
          <span>last 24h</span>
        </div>
        <span className="text-fg-faint">{rows.reduce((a, b) => a + b.count, 0)} total</span>
      </div>
      <div className="divide-y divide-border-soft">
        {rows.map((r, i) => {
          const w = (r.count / max) * 100;
          return (
            <div
              key={r.name}
              className="grid grid-cols-[24px_1fr_60px_44px] items-center gap-2 px-3 py-2 font-mono text-[11px] transition-colors hover:bg-surface"
            >
              <span className="text-fg-faint tabular-nums">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <div className="truncate text-fg">{r.name}</div>
                <div className="mt-0.5 truncate text-[10px] text-fg-faint">{r.route}</div>
                <div className="mt-1 h-0.5 w-full overflow-hidden bg-border-soft">
                  <div className="h-full bg-bear" style={{ width: `${w.toFixed(1)}%` }} />
                </div>
              </div>
              <span className="text-right tabular-nums text-bear">{r.count}</span>
              <span className="text-right text-[10px] tabular-nums text-fg-faint">{rel(r.lastSeen)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

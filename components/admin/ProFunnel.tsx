import type { FunnelStep } from "@/lib/admin-data";

export function ProFunnel({ steps }: { steps: FunnelStep[] }) {
  const max = steps[0]?.count ?? 1;
  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="text-bull">pro funnel</span>
          <span className="text-fg-faint">·</span>
          <span>last 14d</span>
        </div>
        <span className="text-fg-faint">end-to-end</span>
      </div>
      <div className="flex flex-1 flex-col divide-y divide-border-soft">
        {steps.map((s, i) => {
          const w = (s.count / max) * 100;
          const drop = i > 0 ? (1 - s.count / steps[i - 1].count) * 100 : 0;
          return (
            <div key={s.label} className="group flex flex-col gap-1 px-3 py-2 transition-colors hover:bg-surface">
              <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                <span className="text-fg-dim">{s.label}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  <span className="text-fg">{s.count.toLocaleString()}</span>
                  {i > 0 && (
                    <span className="text-bear">−{drop.toFixed(0)}%</span>
                  )}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden bg-border-soft">
                <div
                  className="h-full bg-gradient-to-r from-bull/80 to-bull transition-all duration-700 ease-out"
                  style={{ width: `${w.toFixed(1)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

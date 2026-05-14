import type { SignupBucket } from "@/lib/admin-data";

export function SignupTimeline({ rows }: { rows: SignupBucket[] }) {
  const max = Math.max(...rows.map((r) => r.signups));
  const total = rows.reduce((a, b) => a + b.signups, 0);
  const totalPro = rows.reduce((a, b) => a + b.pro, 0);
  const conv = (totalPro / total) * 100;
  return (
    <div className="relative flex h-full flex-col overflow-hidden border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <div className="flex items-center gap-3">
          <span className="text-bull">signup timeline</span>
          <span className="text-fg-faint">·</span>
          <span>last {rows.length}d</span>
        </div>
        <div className="flex items-center gap-3 tabular-nums">
          <span className="text-fg">{total.toLocaleString()}</span>
          <span className="text-fg-faint">signups</span>
          <span className="text-fg-faint">·</span>
          <span className="text-bull">{conv.toFixed(1)}%</span>
          <span className="text-fg-faint">→ pro</span>
        </div>
      </div>
      <div className="flex flex-1 items-end gap-1 px-3 py-3">
        {rows.map((b) => {
          const h = (b.signups / max) * 100;
          const proH = (b.pro / b.signups) * 100;
          const day = new Date(b.day);
          return (
            <div key={b.day} className="group relative flex flex-1 flex-col items-stretch">
              <div className="flex flex-1 items-end">
                <div
                  className="relative w-full bg-bull/20 transition-colors group-hover:bg-bull/30"
                  style={{ height: `${h}%` }}
                >
                  <div
                    className="absolute inset-x-0 bottom-0 bg-bull transition-colors"
                    style={{ height: `${proH}%` }}
                  />
                </div>
              </div>
              <div className="mt-1 text-center font-mono text-[8px] tabular-nums text-fg-faint">
                {day.getUTCDate()}
              </div>
              <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap border border-border bg-bg px-2 py-1 font-mono text-[9px] tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
                <span className="text-fg">{b.signups}</span> <span className="text-fg-faint">signups</span> · <span className="text-bull">{b.pro}</span> <span className="text-fg-faint">pro</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

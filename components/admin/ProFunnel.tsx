import type { FunnelStep } from "@/lib/admin-data";
import { Empty, Tile } from "./Tile";

// Distinct users (or devices, pre-signup) at each step from /trade to paid,
// over 30 days.
//
// The seeded version built each step by multiplying the previous one by a
// decay constant, so it could only ever draw a tidy staircase. Real steps are
// not nested — someone can hit the paywall on /practice without ever opening a
// bet — so a later step CAN out-count an earlier one. That is a finding about
// where people actually meet the wall, so a rise renders as a rise rather than
// as a negative "drop".

export function ProFunnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  const top = steps[0]?.count ?? 0;
  const end = steps[steps.length - 1]?.count ?? 0;
  return (
    <Tile
      label="pro funnel"
      meta="distinct actors · 30d"
      right={top > 0 ? `${((end / top) * 100).toFixed(2)}% end-to-end` : "end-to-end"}
    >
      {steps.every((s) => s.count === 0) ? (
        <Empty reason="no page_view, bet or checkout event in the last 30 days — every step of this funnel is genuinely at zero." />
      ) : (
        <div className="flex flex-1 flex-col divide-y divide-border-soft">
          {steps.map((s, i) => {
            const prev = i > 0 ? steps[i - 1].count : null;
            const change = prev && prev > 0 ? (s.count - prev) / prev : null;
            return (
              <div key={s.label} className="group flex flex-col gap-1 px-3 py-2 transition-colors hover:bg-surface">
                <div className="flex items-center justify-between gap-2 t-chrome">
                  <span className="truncate text-fg-dim">{s.label}</span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    <span className="text-fg">{s.count.toLocaleString()}</span>
                    {change != null && (
                      <span className={change < 0 ? "text-bear" : change > 0 ? "text-bull" : "text-fg-faint"}>
                        {change < 0 ? "−" : change > 0 ? "+" : "·"}
                        {Math.abs(change * 100).toFixed(0)}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden bg-border-soft">
                  <div
                    className="h-full bg-gradient-to-r from-bull/80 to-bull transition-all duration-700 ease-out"
                    style={{ width: `${((s.count / max) * 100).toFixed(1)}%` }}
                  />
                </div>
              </div>
            );
          })}
          <div className="px-3 py-2 font-mono text-[0.625rem] leading-relaxed text-fg-faint">
            steps are independent counts, not a nested cohort — a later step can exceed an earlier one when people meet the paywall somewhere other than /trade.
          </div>
        </div>
      )}
    </Tile>
  );
}

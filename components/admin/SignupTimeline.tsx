import type { ActivationMetrics, SignupMetrics } from "@/lib/admin-data";
import { Empty, Tile } from "./Tile";

// The memo's first two numbers, drawn: signups per day for 14 days, with the
// share of each day's cohort that placed a paper trade within 24 hours filled
// in solid underneath.
//
// The second series used to be "pro" — a fabricated 4–10% of each day's
// fabricated signups, printed as a conversion rate in the header. It is now
// activation, which is a real join between the `signup` event and the first
// order_submitted / bet_placed by that user.

export function SignupTimeline({ data, activation }: { data: SignupMetrics; activation: ActivationMetrics }) {
  const rows = data.daily;
  const max = Math.max(1, ...rows.map((r) => r.signups));
  const total = rows.reduce((a, b) => a + b.signups, 0);
  return (
    <Tile
      label="signups"
      meta={`last ${rows.length}d · UTC days`}
      right={
        <span className="tabular-nums">
          <span className="text-fg">{data.last7}</span> in 7d · <span className="text-fg">{data.last30}</span> in 30d ·{" "}
          <span className="text-bull">{(activation.rate24h * 100).toFixed(0)}%</span> activated
        </span>
      }
    >
      {total === 0 ? (
        <Empty reason={`no signup event in the last 14 days. The users collection holds ${data.usersTotal} row${data.usersTotal === 1 ? "" : "s"} and the stream holds ${data.allTime} signup event${data.allTime === 1 ? "" : "s"} all-time — signup events only exist for accounts created after the tracker shipped.`} />
      ) : (
        <>
          <div className="flex flex-1 items-end gap-1 px-3 py-3">
            {rows.map((b) => {
              const h = (b.signups / max) * 100;
              const actH = b.signups ? (b.activated / b.signups) * 100 : 0;
              const day = new Date(b.day);
              return (
                <div key={b.day} className="group relative flex flex-1 flex-col items-stretch">
                  <div className="flex flex-1 items-end" style={{ minHeight: 90 }}>
                    <div className="relative w-full bg-bull/20 transition-colors group-hover:bg-bull/30" style={{ height: `${h}%` }}>
                      <div className="absolute inset-x-0 bottom-0 bg-bull transition-colors" style={{ height: `${actH}%` }} />
                    </div>
                  </div>
                  <div className="mt-1 text-center font-mono text-[0.625rem] tabular-nums text-fg-faint">{day.getUTCDate()}</div>
                  <div className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap border border-border bg-bg px-2 py-1 font-mono text-[0.625rem] tabular-nums opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="text-fg">{b.signups}</span> <span className="text-fg-faint">signups</span> ·{" "}
                    <span className="text-bull">{b.activated}</span> <span className="text-fg-faint">traded in 24h</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="border-t border-border-soft px-3 py-2 font-mono text-[0.625rem] text-fg-faint">
            solid = placed a paper trade within 24h of signing up ·{" "}
            {activation.eligible24h > 0
              ? `${activation.within24h}/${activation.eligible24h} of the last 30 days' signups`
              : "no signup is 24h old yet, so the share has nothing to measure"}
          </div>
        </>
      )}
    </Tile>
  );
}

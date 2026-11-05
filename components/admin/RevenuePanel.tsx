import type { RevenueMetrics } from "@/lib/admin-data";
import { BarRow, Empty, Stat, Tile } from "./Tile";

// Money, from the `subscriptions` collection — the rows the provider webhooks
// write — and never from checkout_started, which is an intention, not a
// payment.
//
// Which rows count is decided by entitles() from lib/billing/entitlements: the
// SAME predicate the paywall uses, so the cockpit and the product can never
// disagree about who is paying. Annual plans are divided by 12. INR is
// converted at LAZYBULL_INR_PER_USD and the rupee total is printed beside it,
// so the Indian book can be read without trusting the rate.

export function RevenuePanel({ data }: { data: RevenueMetrics }) {
  const planMax = data.byPlan.length ? Math.max(...data.byPlan.map((r) => r.n)) : 1;
  const waitMax = data.waitlist.length ? Math.max(...data.waitlist.map((r) => r.n)) : 1;
  const nothing = data.active === 0 && data.waitlistTotal === 0;
  return (
    <Tile
      label="revenue"
      meta="subscriptions · waitlist"
      right={`$${data.mrrUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MRR`}
    >
      {nothing ? (
        <Empty reason="no subscription row entitles a plan and nobody has joined the waitlist. MRR is $0 — which is a real number, not a missing one." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 border-b border-border-soft px-3 py-3 sm:grid-cols-4">
            <Stat
              k="mrr · usd"
              v={`$${data.mrrUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              tone={data.mrrUsd > 0 ? "bull" : "fg"}
            />
            <Stat k="paying subs" v={data.active.toLocaleString()} />
            <Stat k="new · 30d" v={data.newSubs30d.toLocaleString()} />
            <Stat k="cancelled · 30d" v={data.cancelled30d.toLocaleString()} tone={data.cancelled30d ? "bear" : "fg"} />
          </div>
          <div className="border-b border-border-soft px-3 py-1.5 font-mono text-[0.625rem] text-fg-faint">
            ₹{data.mrrInrNative.toLocaleString()} of that MRR is billed in rupees, converted at ₹{data.inrPerUsd}/$ (LAZYBULL_INR_PER_USD)
            {data.byProvider.length > 0 && (
              <> · rails: {data.byProvider.map((p) => `${p.key} ${p.n}`).join(" · ")}</>
            )}
          </div>
          <div className="flex flex-col divide-y divide-border-soft md:flex-row md:divide-x md:divide-y-0">
            <div className="min-w-0 flex-1">
              <div className="border-b border-border-soft px-3 py-1.5 t-chrome text-fg-faint">subscribers by plan</div>
              {data.byPlan.length === 0 ? (
                <div className="px-3 py-3 font-mono text-[0.625rem] text-fg-faint">no entitling subscription.</div>
              ) : (
                <div className="divide-y divide-border-soft">
                  {data.byPlan.map((r) => (
                    <BarRow key={r.key} label={r.key} value={r.n.toLocaleString()} pct={r.n / planMax} />
                  ))}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="border-b border-border-soft px-3 py-1.5 t-chrome text-fg-faint">
                waitlist · {data.waitlistTotal} row{data.waitlistTotal === 1 ? "" : "s"}
              </div>
              {data.waitlist.length === 0 ? (
                <div className="px-3 py-3 font-mono text-[0.625rem] text-fg-faint">nobody on the list yet.</div>
              ) : (
                <div className="divide-y divide-border-soft">
                  {data.waitlist.map((r) => (
                    <BarRow key={`${r.tier}-${r.currency}`} label={`${r.tier} · ${r.currency}`} value={r.n.toLocaleString()} pct={r.n / waitMax} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Tile>
  );
}

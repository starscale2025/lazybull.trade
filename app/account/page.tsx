// /account — the plan, today's usage against it, the subscription that
// confers it, and the lists this address is waiting on.
//
// Server component, one request. It reads through the SAME functions the
// gates use — the session plan lib/auth.ts resolved with getPlan, peekDaily
// (lib/billing/usage.ts), countWorkspaces (lib/db/workspaces.ts),
// subscriptionsFor (lib/billing/subscriptions.ts) — so a number on this page
// is the number /api/explain and /api/workspaces enforce, never a second
// opinion. Linked from the account menu (components/AuthButtons.tsx): a paid
// tier a user cannot see or cancel is a support ticket and a chargeback.
//
// Managing: Lemon Squeezy has a customer portal, reached through
// app/api/billing/portal (a plain anchor, not <Link> — a prefetch of that
// route would call the provider's API on hover). Razorpay has none: the
// mandate is cancelled from the UPI app or bank that holds it, or by email,
// and the card says so. Either way a cancellation keeps access until the
// paid period ends (entitles() in lib/billing/entitlements.ts).

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CalmPanel, PageHeader, PillLink } from "@/components/calm/kit";
import { limitsFor } from "@/lib/billing/entitlements";
import { fmtMinor } from "@/lib/billing/prices";
import { currentSubscription, subscriptionsFor } from "@/lib/billing/subscriptions";
import type { BillingProvider, Plan, SubscriptionStatus } from "@/lib/billing/types";
import { peekDaily } from "@/lib/billing/usage";
import { countWorkspaces } from "@/lib/db/workspaces";
import { waitlistFor } from "@/lib/db/waitlist";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account — lazybull",
  robots: { index: false, follow: false },
};

const SUPPORT = "hello@lazybull.us";

const PLAN_NAME: Record<Plan, string> = { free: "Free", plus: "Plus", pro: "Pro", power: "Power" };
const PROVIDER_NAME: Record<BillingProvider, string> = {
  lemonsqueezy: "Lemon Squeezy",
  razorpay: "Razorpay",
  manual: "manual grant",
};
const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Authorised · first charge pending",
  active: "Active",
  past_due: "Payment past due · access continues while the provider retries",
  paused: "Paused",
  cancelled: "Cancelled · access runs to the period end",
  expired: "Expired",
};
/** What app/api/billing/portal redirects back with when it cannot forward. */
const NOTICES: Record<string, string> = {
  no_subscription: "There is no active subscription to manage.",
  razorpay: "Razorpay subscriptions have no self-serve portal — the subscription card says how to cancel.",
  manual: `This plan was granted by hand. Email ${SUPPORT} to change it.`,
  no_portal: `The customer portal could not be reached. Try again in a minute, or email ${SUPPORT}.`,
};

const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" }) : "—";
const capLabel = (n: number | null) => (n === null ? "unlimited" : String(n));

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/account");
  const { notice } = await searchParams;

  const userId = session.user.id;
  const email = session.user.email ?? null;
  const plan: Plan = session.user.plan ?? "free";
  const limits = limitsFor(plan);

  // Each read degrades on its own: a Mongo blip shows zeros and "—", never a
  // 500 on the page that tells someone what they are paying for.
  const [usage, workspaces, rows, waiting] = await Promise.all([
    peekDaily("explain", `user:${userId}`),
    countWorkspaces(userId).catch(() => 0),
    subscriptionsFor(userId).catch(() => []),
    email ? waitlistFor(email).catch(() => []) : Promise.resolve([]),
  ]);
  const sub = currentSubscription(rows);
  const explainPct =
    limits.explainsPerDay === null ? 0 : Math.min(100, Math.round((usage.count / limits.explainsPerDay) * 100));
  const workspacePct =
    limits.workspaces === null ? 0 : Math.min(100, Math.round((workspaces / limits.workspaces) * 100));
  const noticeText = notice ? NOTICES[notice] : null;

  return (
    <div className="page-aura min-h-screen bg-bg">
      <Nav />
      <main className="tap-floor">
        <PageHeader
          eyebrow="Account & plan"
          title={<span className="[overflow-wrap:anywhere]">{session.user.name ?? email ?? "You"}</span>}
          lede={`${email ?? "No email on file"} · ${PLAN_NAME[plan]} plan`}
        />

        <div className="shell pb-[clamp(4rem,9vw,6rem)]">
          {noticeText && (
            <div role="status" className="mb-4 rounded-[14px] bg-fg/5 px-4 py-3 text-[0.875rem] leading-snug text-fg">
              {noticeText}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <CalmPanel as="section" title="Plan">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-4xl tracking-tightest text-fg">{PLAN_NAME[plan]}</span>
                {sub && (
                  <span className="t-label tabular-nums text-fg-dim">
                    {fmtMinor(sub.amountMinor, sub.currency)} / {sub.interval}
                  </span>
                )}
              </div>
              <p className="mt-3 t-body-sm text-fg-dim">
                {plan === "free"
                  ? "Free forever. The primer, paper trades and the daily allowance below."
                  : sub
                    ? `Conferred by your ${PROVIDER_NAME[sub.provider]} subscription.`
                    : "Granted without a subscription — a manual plan."}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <PillLink href={plan === "free" ? "/pricing#plus" : "/pricing"} size="sm">
                  {plan === "free" ? "See plans" : "All plans"}
                </PillLink>
                {sub?.provider === "lemonsqueezy" && (
                  // The header comment's plain anchor, spelling out the kit's
                  // primary pill: PillLink is a <Link>, and its prefetch would
                  // call the provider on hover.
                  <a
                    href="/api/billing/portal"
                    className="btn-grad inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[0.875rem] font-semibold tracking-[-0.01em] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] transition-[transform,box-shadow,background-color,color] duration-300 [transition-timing-function:var(--ease-settle)] hover:-translate-y-px"
                  >
                    Manage subscription
                  </a>
                )}
              </div>
            </CalmPanel>

            <CalmPanel as="section" title="Usage · today">
              <div className="space-y-5">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="t-label text-fg-dim">AI-teacher explains</span>
                    <span className="t-data text-sm text-fg">
                      {usage.count} <span className="text-fg-faint">/ {capLabel(limits.explainsPerDay)}</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-border-soft">
                    <div className="h-1 rounded-full bg-brand-ink" style={{ width: `${explainPct}%` }} />
                  </div>
                  <div className="mt-1.5 t-label text-fg-faint">Resets at midnight UTC</div>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="t-label text-fg-dim">Saved workspaces</span>
                    <span className="t-data text-sm text-fg">
                      {workspaces} <span className="text-fg-faint">/ {capLabel(limits.workspaces)}</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-border-soft">
                    <div className="h-1 rounded-full bg-brand-ink" style={{ width: `${workspacePct}%` }} />
                  </div>
                  <div className="mt-1.5 t-label text-fg-faint">Pro layouts + quant setups · the cap applies to new saves only</div>
                </div>
              </div>
            </CalmPanel>

            <CalmPanel as="section" title="Subscription">
              {sub ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.875rem]">
                  <dt className="text-fg-faint">Provider</dt>
                  <dd className="text-fg first-letter:uppercase">{PROVIDER_NAME[sub.provider]}</dd>
                  <dt className="text-fg-faint">Status</dt>
                  <dd className="text-fg">{STATUS_LABEL[sub.status]}</dd>
                  <dt className="text-fg-faint">{sub.status === "cancelled" || sub.status === "expired" ? "Ends" : "Renews"}</dt>
                  <dd className="text-fg">{fmtDate(sub.currentPeriodEnd)}</dd>
                  <dt className="text-fg-faint">Amount</dt>
                  <dd className="text-fg">
                    {fmtMinor(sub.amountMinor, sub.currency)} {sub.currency} / {sub.interval}
                  </dd>
                  {sub.cancelledAt && (
                    <>
                      <dt className="text-fg-faint">Cancelled</dt>
                      <dd className="text-fg">{fmtDate(sub.cancelledAt)}</dd>
                    </>
                  )}
                </dl>
              ) : (
                <p className="t-body-sm text-fg-dim">No subscription. Nothing is charged on the free plan.</p>
              )}
              <p className="mt-4 t-body-sm text-fg-dim">
                {sub?.provider === "razorpay"
                  ? `Razorpay has no self-serve portal. Cancel the mandate from the UPI app or bank that holds it, or email ${SUPPORT} from this address and it is cancelled the same day.`
                  : sub?.provider === "lemonsqueezy"
                    ? "Change the card, download invoices or cancel from the customer portal."
                    : sub
                      ? `A manual grant — email ${SUPPORT} to change it.`
                      : "A subscription bought on /pricing appears here once the provider confirms it."}
              </p>
              <p className="mt-2 t-label text-fg-faint">Cancelling keeps access until the period end · no refunds are needed for unused days</p>
            </CalmPanel>

            <CalmPanel as="section" title="Waitlist">
              {waiting.length === 0 ? (
                <p className="t-body-sm text-fg-dim">
                  Not on any list. A tier whose checkout is not open yet takes names on{" "}
                  <Link href="/pricing" className="text-brand-ink underline underline-offset-4">
                    /pricing
                  </Link>
                  .
                </p>
              ) : (
                <ul className="space-y-2 text-[0.875rem]">
                  {waiting.map((w) => (
                    <li key={`${w.tier}:${w.currency}`} className="flex items-center justify-between gap-3 border-b border-border-soft pb-2 last:border-b-0 last:pb-0">
                      <span className="text-fg">
                        {PLAN_NAME[w.tier]} · {w.currency}
                      </span>
                      <span className="text-fg-faint">Joined {fmtDate(w.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 t-label text-fg-faint">We email this address when that checkout opens · nothing is charged</p>
            </CalmPanel>
          </div>

          <p className="mt-8 text-[0.8125rem] text-fg-faint">Paper only · Educational · Not advice</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

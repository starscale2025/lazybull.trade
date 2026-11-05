// The plan ladder and the shapes every billing-aware module agrees on.
//
// ONE source of truth for "what does a plan get". The pricing page, the
// entitlement checks in the API routes, the account page and the admin
// metrics all read from here, so a limit can never be advertised on one
// surface and enforced differently on another — which is exactly the gap the
// 2026-09 diligence memo found ("5 explains per day" on /pricing, no cap in
// code).
//
// Plans are GLOBAL tiers. India ships the same ladder in rupees through
// Razorpay (see lib/billing/razorpay.ts); the plan a subscription confers is
// the same `Plan` regardless of which rail charged for it.

import type { ObjectId } from "mongodb";

export type Plan = "free" | "plus" | "pro" | "power";

export const PLAN_ORDER: readonly Plan[] = ["free", "plus", "pro", "power"] as const;

/** `null` means unlimited. */
export type PlanLimits = {
  /** AI-teacher explanations per UTC day (app/api/explain). */
  explainsPerDay: number | null;
  /** Saved Pro/Quant workspaces (app/api/workspaces). */
  workspaces: number | null;
  /** Saved strategy-builder positions. */
  savedPositions: number | null;
  /** Bots available in the quant workbench. */
  bots: number | null;
  /** Pro-locked practice problems + editorials (lib/practice). */
  practicePro: boolean;
  /** Power-tier practice problems (ships with the licensed IV feed). */
  practicePower: boolean;
  /** Bring-your-own-bot import. */
  customBots: boolean;
};

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    explainsPerDay: 5,
    workspaces: 1,
    savedPositions: 3,
    bots: 3,
    practicePro: false,
    practicePower: false,
    customBots: false,
  },
  plus: {
    explainsPerDay: null,
    workspaces: null,
    savedPositions: null,
    bots: 15,
    practicePro: true,
    practicePower: false,
    customBots: false,
  },
  pro: {
    explainsPerDay: null,
    workspaces: null,
    savedPositions: null,
    bots: null,
    practicePro: true,
    practicePower: false,
    customBots: true,
  },
  power: {
    explainsPerDay: null,
    workspaces: null,
    savedPositions: null,
    bots: null,
    practicePro: true,
    practicePower: true,
    customBots: true,
  },
};

/** Monthly list prices, USD and INR, for the pricing page and the checkout. */
export const PLAN_PRICES: Record<Exclude<Plan, "free">, { usdMonthly: number; usdAnnualMonthly: number; inrMonthly: number; inrAnnualMonthly: number }> = {
  plus: { usdMonthly: 19, usdAnnualMonthly: 15, inrMonthly: 399, inrAnnualMonthly: 299 },
  pro: { usdMonthly: 39, usdAnnualMonthly: 29, inrMonthly: 799, inrAnnualMonthly: 599 },
  power: { usdMonthly: 59, usdAnnualMonthly: 45, inrMonthly: 1499, inrAnnualMonthly: 1199 },
};

export function planAtLeast(have: Plan, need: Plan): boolean {
  return PLAN_ORDER.indexOf(have) >= PLAN_ORDER.indexOf(need);
}

export type BillingProvider = "lemonsqueezy" | "razorpay" | "manual";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "paused" | "cancelled" | "expired";

/** One row per provider subscription in the `subscriptions` collection. */
export type SubscriptionDoc = {
  _id?: ObjectId;
  userId: ObjectId;
  provider: BillingProvider;
  /** The provider's own subscription id — the idempotency key for webhooks. */
  providerSubId: string;
  plan: Exclude<Plan, "free">;
  status: SubscriptionStatus;
  currency: "USD" | "INR";
  /** Recurring amount in minor units (cents / paise) per `interval`. */
  amountMinor: number;
  interval: "month" | "year";
  currentPeriodEnd: Date | null;
  /** Set when the user cancelled; access runs to currentPeriodEnd. */
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Provider timestamp of the event that last wrote this row. Webhooks are
   * delivered at-least-once and not in order (a `subscription_updated` can
   * land before its `subscription_created`); the upsert in
   * lib/billing/subscriptions.ts drops a write whose event is older than the
   * one already applied. `null` when the provider gave no usable timestamp.
   */
  lastEventAt?: Date | null;
  /**
   * Lemon Squeezy's pre-signed customer-portal URL (`urls.customer_portal`)
   * and payment-method URL (`urls.update_payment_method`), captured from the
   * latest webhook. Both expire 24h after they were minted — see
   * app/api/billing/portal, which refreshes through the API when it can.
   * Razorpay has no customer portal; both stay null on that rail.
   */
  portalUrl?: string | null;
  updatePaymentUrl?: string | null;
  /** The last raw webhook payload, for support and audit. Bounded by the route. */
  raw?: unknown;
};

/** Statuses that confer the plan right now. */
export const ENTITLING_STATUSES: readonly SubscriptionStatus[] = ["trialing", "active", "past_due"] as const;

/** Product-event names emitted by the billing layer (see lib/db/events.ts). */
export const BILLING_EVENTS = {
  explainServed: "explain_served",
  hitPaywall: "hit_paywall",
  checkoutStarted: "checkout_started",
  subscriptionStarted: "subscription_started",
  subscriptionUpdated: "subscription_updated",
  subscriptionCancelled: "subscription_cancelled",
  waitlistJoined: "waitlist_joined",
} as const;

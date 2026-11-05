// Billing-provider configuration — every env read for the money rail, in one
// place, at CALL time (the lib/kv.ts convention) so a test can flip a provider
// on and off without a fresh import graph and retiring a variant is an env
// edit, not a deploy.
//
// Two rails, chosen by currency (docs/strategy/03-pricing-and-packaging.md):
//   • USD → Lemon Squeezy, merchant of record. Its hosted checkout collects
//     the card and remits sales tax / VAT itself, which is what lets a company
//     operating from India sell worldwide without a US entity.
//   • INR → Razorpay Subscriptions (UPI autopay + cards), the rail the Indian
//     ₹399 / ₹799 tiers actually convert on.
//
// ENV-GATED, NEVER FAKED. With no keys set, `providers()` reports both rails
// off, /api/billing/checkout answers 503 and the pricing page degrades to the
// waitlist. A rail counts as configured only when it can BOTH sell and
// entitle — the checkout ids and the webhook secret — because a checkout
// whose webhook can never be verified would take money and grant nothing,
// which is worse than the "Revenue: Zero" the 2026-09 diligence memo found.

import type { Plan } from "./types";

export type PaidPlan = Exclude<Plan, "free">;
export type Interval = "month" | "year";
export type Currency = "USD" | "INR";
export type CheckoutProvider = "lemonsqueezy" | "razorpay";

export const PAID_PLANS: readonly PaidPlan[] = ["plus", "pro", "power"] as const;
export const INTERVALS: readonly Interval[] = ["month", "year"] as const;

const env = (k: string): string => (process.env[k] ?? "").trim();

/** `LEMONSQUEEZY_VARIANT_PRO_ANNUAL`, `RAZORPAY_PLAN_PLUS_MONTHLY`, … */
function idVar(prefix: string, plan: PaidPlan, interval: Interval): string {
  return `${prefix}_${plan.toUpperCase()}_${interval === "month" ? "MONTHLY" : "ANNUAL"}`;
}

function lookup(prefix: string, id: string): { plan: PaidPlan; interval: Interval } | null {
  const want = String(id).trim();
  if (!want) return null;
  for (const plan of PAID_PLANS) {
    for (const interval of INTERVALS) {
      if (env(idVar(prefix, plan, interval)) === want) return { plan, interval };
    }
  }
  return null;
}

function anyConfigured(prefix: string): boolean {
  return PAID_PLANS.some((p) => INTERVALS.some((i) => env(idVar(prefix, p, i)) !== ""));
}

// ── Lemon Squeezy (USD) ─────────────────────────────────────────────────────

/**
 * The store's subdomain only (`lazybull` → https://lazybull.lemonsqueezy.com).
 * Restricted to a hostname label so a mis-set env can never steer the checkout
 * redirect somewhere else.
 */
export function lsStoreSubdomain(): string {
  const v = env("LEMONSQUEEZY_STORE_SUBDOMAIN").toLowerCase();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(v) ? v : "";
}
export function lsWebhookSecret(): string {
  return env("LEMONSQUEEZY_WEBHOOK_SECRET");
}
/** Optional — only the portal refresh in app/api/billing/portal uses the API. */
export function lsApiKey(): string {
  return env("LEMONSQUEEZY_API_KEY");
}
export function lsVariantId(plan: PaidPlan, interval: Interval): string | null {
  return env(idVar("LEMONSQUEEZY_VARIANT", plan, interval)) || null;
}
/** Reverse map for webhooks: which plan/interval a purchased variant means. */
export function lsPlanForVariant(variantId: string | number): { plan: PaidPlan; interval: Interval } | null {
  return lookup("LEMONSQUEEZY_VARIANT", String(variantId));
}
export function lsConfigured(): boolean {
  return !!lsStoreSubdomain() && !!lsWebhookSecret() && anyConfigured("LEMONSQUEEZY_VARIANT");
}

// ── Razorpay (INR) ──────────────────────────────────────────────────────────

export function rzpKeyId(): string {
  return env("RAZORPAY_KEY_ID");
}
export function rzpKeySecret(): string {
  return env("RAZORPAY_KEY_SECRET");
}
export function rzpWebhookSecret(): string {
  return env("RAZORPAY_WEBHOOK_SECRET");
}
export function rzpPlanId(plan: PaidPlan, interval: Interval): string | null {
  return env(idVar("RAZORPAY_PLAN", plan, interval)) || null;
}
export function rzpPlanFor(planId: string): { plan: PaidPlan; interval: Interval } | null {
  return lookup("RAZORPAY_PLAN", planId);
}
export function rzpConfigured(): boolean {
  return !!rzpKeyId() && !!rzpKeySecret() && !!rzpWebhookSecret() && anyConfigured("RAZORPAY_PLAN");
}

// ── The public shape ────────────────────────────────────────────────────────

/** What /api/billing/config tells the browser. Booleans only — never an id. */
export function providers(): { usd: boolean; inr: boolean } {
  return { usd: lsConfigured(), inr: rzpConfigured() };
}

export function providerFor(currency: Currency): CheckoutProvider {
  return currency === "INR" ? "razorpay" : "lemonsqueezy";
}

/**
 * True when this exact plan × interval can be bought in this currency right
 * now. A rail can be live for Plus/Pro while Power stays waitlist-only — the
 * Power ids are optional because that tier "ships with a licensed IV feed"
 * the product does not have yet.
 */
export function checkoutConfigured(plan: PaidPlan, interval: Interval, currency: Currency): boolean {
  if (currency === "INR") return rzpConfigured() && !!rzpPlanId(plan, interval);
  return lsConfigured() && !!lsVariantId(plan, interval);
}

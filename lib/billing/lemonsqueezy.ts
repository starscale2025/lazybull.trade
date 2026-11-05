// Lemon Squeezy — the USD rail. Merchant of record: their hosted checkout
// takes the card and remits sales tax / VAT, so a company operating from India
// can sell worldwide with no US entity (docs/strategy/03-pricing-and-packaging.md).
//
// ENV-GATED: LEMONSQUEEZY_STORE_SUBDOMAIN + LEMONSQUEEZY_WEBHOOK_SECRET +
// LEMONSQUEEZY_VARIANT_<PLAN>_<MONTHLY|ANNUAL> (lib/billing/config.ts). With
// any of them missing this module builds no URLs and verifies nothing.
//
// Verified against docs.lemonsqueezy.com on 2026-09-08:
//   • Hosted checkout link: https://[STORE].lemonsqueezy.com/checkout/buy/[VARIANT_ID]
//     with `checkout[email]=…` to prefill and `checkout[custom][key]=…` for
//     data that comes back on webhooks as `meta.custom_data`
//     (help/checkout/prefilling-checkout-fields, help/checkout/passing-custom-data).
//   • Webhook: `X-Signature` = HMAC-SHA256(signing secret, raw request body),
//     hex (guides/developer-guide/webhooks; the official lmsqueezy/nextjs-billing
//     template compares it with crypto.timingSafeEqual). Any non-200 response
//     is retried up to three more times.
//   • Payload: { meta:{event_name, custom_data?}, data:{type:"subscriptions",
//     id, attributes:{status, variant_id, user_email, renews_at, ends_at,
//     cancelled, urls:{customer_portal, update_payment_method}, updated_at,
//     test_mode}} }. Events: subscription_created|updated|cancelled|resumed|
//     expired|paused|unpaused, plus subscription_payment_* whose `data` is a
//     subscription INVOICE (different shape — ignored here).
//   • Statuses (api/subscriptions/the-subscription-object): on_trial, active,
//     paused, past_due, unpaid, cancelled, expired. `cancelled` keeps access
//     until `ends_at` — the grace period the account page describes.

import { createHmac, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { INTERVALS, PAID_PLANS, lsPlanForVariant, lsStoreSubdomain, lsVariantId, type Interval, type PaidPlan } from "./config";
import { amountMinor } from "./prices";
import type { SubscriptionUpsert } from "./subscriptions";
import type { SubscriptionStatus } from "./types";

// ── checkout ───────────────────────────────────────────────────────────────

/** The hosted-checkout URL for a plan, or null when the rail/variant is unset. */
export function lsCheckoutUrl(args: {
  plan: PaidPlan;
  interval: Interval;
  userId: string;
  email?: string | null;
}): string | null {
  const store = lsStoreSubdomain();
  const variant = lsVariantId(args.plan, args.interval);
  if (!store || !variant) return null;
  const u = new URL(`https://${store}.lemonsqueezy.com/checkout/buy/${encodeURIComponent(variant)}`);
  if (args.email) u.searchParams.set("checkout[email]", args.email);
  // user_id is the join key the webhook hands back in meta.custom_data; plan
  // and interval are a fallback for a variant id the env no longer maps.
  u.searchParams.set("checkout[custom][user_id]", args.userId);
  u.searchParams.set("checkout[custom][plan]", args.plan);
  u.searchParams.set("checkout[custom][interval]", args.interval);
  return u.toString();
}

// ── webhook signature ──────────────────────────────────────────────────────

/** HMAC-SHA256 hex of the RAW body; constant-time compare; false on anything missing. */
export function verifyLemonSqueezySignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string,
): boolean {
  if (!secret || !signature) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody, "utf8").digest("hex"), "utf8");
  const given = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// ── webhook payload ────────────────────────────────────────────────────────

export const LS_SUBSCRIPTION_EVENTS: readonly string[] = [
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
] as const;

const Urls = z
  .object({
    customer_portal: z.string().nullish(),
    update_payment_method: z.string().nullish(),
  })
  .partial()
  .nullish();

const Attributes = z
  .object({
    status: z.string(),
    variant_id: z.union([z.number(), z.string()]).nullish(),
    user_email: z.string().nullish(),
    renews_at: z.string().nullish(),
    ends_at: z.string().nullish(),
    cancelled: z.boolean().nullish(),
    updated_at: z.string().nullish(),
    test_mode: z.boolean().nullish(),
    urls: Urls,
  })
  .passthrough();

const Payload = z
  .object({
    meta: z
      .object({
        event_name: z.string().min(1),
        custom_data: z.record(z.string(), z.unknown()).nullish(),
      })
      .passthrough(),
    data: z
      .object({
        type: z.string(),
        id: z.union([z.string(), z.number()]),
        attributes: Attributes,
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type LsSubscriptionEvent = {
  eventName: string;
  providerSubId: string;
  attributes: z.infer<typeof Attributes>;
  customData: Record<string, unknown>;
};

export type LsParsed =
  | { ok: true; eventName: string; subscription: LsSubscriptionEvent | null }
  | { ok: false; reason: "malformed" };

/**
 * Structural parse only. `subscription` is null for every event that does not
 * carry a Subscription object (orders, invoices, licence keys), which the
 * route acknowledges with 200 and does nothing about.
 */
export function parseLemonSqueezyWebhook(raw: unknown): LsParsed {
  const r = Payload.safeParse(raw);
  if (!r.success) return { ok: false, reason: "malformed" };
  const { meta, data } = r.data;
  const carriesSubscription = LS_SUBSCRIPTION_EVENTS.includes(meta.event_name) && data?.type === "subscriptions";
  if (!carriesSubscription || !data) return { ok: true, eventName: meta.event_name, subscription: null };
  return {
    ok: true,
    eventName: meta.event_name,
    subscription: {
      eventName: meta.event_name,
      providerSubId: String(data.id),
      attributes: data.attributes,
      customData: meta.custom_data ?? {},
    },
  };
}

/**
 * Lemon Squeezy → our status vocabulary. `unpaid` (four failed retries, still
 * in dunning) maps to past_due, so it keeps entitling until Lemon Squeezy
 * expires it — a paying customer with a broken card is not the same as a
 * churned one. Unknown strings return null and the event is ignored.
 */
export function mapLemonSqueezyStatus(status: string): SubscriptionStatus | null {
  switch (status) {
    case "on_trial":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "paused":
      return "paused";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    default:
      return null;
  }
}

const isoDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export type LsBuilt =
  | { ok: true; doc: SubscriptionUpsert }
  | { ok: false; reason: "no_user" | "unknown_status" | "unknown_plan" };

/**
 * The row a subscription event should upsert. Plan and interval come from
 * the variant → env mapping first, then from the checkout's custom data, so a
 * variant retired from env still resolves for existing subscribers.
 */
export function subscriptionFromLemonSqueezy(ev: LsSubscriptionEvent, raw: unknown, now: Date = new Date()): LsBuilt {
  const userId = String(ev.customData.user_id ?? "");
  if (!ObjectId.isValid(userId)) return { ok: false, reason: "no_user" };
  const status = mapLemonSqueezyStatus(ev.attributes.status);
  if (!status) return { ok: false, reason: "unknown_status" };

  let plan: PaidPlan | null = null;
  let interval: Interval | null = null;
  const byVariant = ev.attributes.variant_id != null ? lsPlanForVariant(ev.attributes.variant_id) : null;
  if (byVariant) ({ plan, interval } = byVariant);
  else {
    const p = String(ev.customData.plan ?? "");
    const i = String(ev.customData.interval ?? "");
    if ((PAID_PLANS as readonly string[]).includes(p)) plan = p as PaidPlan;
    if ((INTERVALS as readonly string[]).includes(i)) interval = i as Interval;
  }
  if (!plan || !interval) return { ok: false, reason: "unknown_plan" };

  const a = ev.attributes;
  const ended = status === "cancelled" || status === "expired";
  const eventAt = isoDate(a.updated_at);
  return {
    ok: true,
    doc: {
      userId: new ObjectId(userId),
      provider: "lemonsqueezy",
      providerSubId: ev.providerSubId,
      plan,
      status,
      currency: "USD",
      amountMinor: amountMinor(plan, interval, "USD"),
      interval,
      // renews_at is the next invoice; for cancelled/expired ends_at is the
      // date access actually stops, which is the one getPlan should honour.
      currentPeriodEnd: (ended ? isoDate(a.ends_at) ?? isoDate(a.renews_at) : isoDate(a.renews_at) ?? isoDate(a.ends_at)) ?? null,
      cancelledAt: ended ? (eventAt ?? now) : null,
      lastEventAt: eventAt,
      portalUrl: a.urls?.customer_portal ?? null,
      updatePaymentUrl: a.urls?.update_payment_method ?? null,
      raw,
    },
  };
}

/** True for a test-mode payload — production ignores those unless opted in. */
export function isTestModeEvent(ev: LsSubscriptionEvent): boolean {
  return ev.attributes.test_mode === true;
}

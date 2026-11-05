// Razorpay Subscriptions — the INR rail (UPI autopay + cards), the one the
// ₹399 / ₹799 tiers actually convert on. The 2026-09 diligence memo: "India
// ₹399/₹799 is excluded from revenue by design — test it instead of assuming
// zero." This is the test.
//
// ENV-GATED: RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET + RAZORPAY_WEBHOOK_SECRET +
// RAZORPAY_PLAN_<PLAN>_<MONTHLY|ANNUAL> (lib/billing/config.ts). No client-side
// checkout.js: the server creates the subscription and sends the user to
// Razorpay's hosted authorization page, so no new script origin joins the
// CSP in proxy.ts.
//
// Verified against razorpay.com/docs on 2026-09-08:
//   • POST https://api.razorpay.com/v1/subscriptions, HTTP basic auth
//     key_id:key_secret, body {plan_id, total_count, quantity, customer_notify,
//     notes{≤15 pairs}} → {id, status:"created", short_url, current_end, …}
//     (docs/api/payments/subscriptions/create-subscription). `short_url` is the
//     hosted page where the customer authorizes the mandate.
//   • Webhook: `X-Razorpay-Signature` = HMAC-SHA256(webhook secret, raw
//     request body), hex; `x-razorpay-event-id` is unique per event
//     (docs/webhooks/validate-test).
//   • Events (docs/webhooks/payloads/subscriptions): subscription.authenticated
//     |activated|charged|completed|updated|pending|halted|cancelled|paused|
//     resumed, each with payload.subscription.entity {id, plan_id, status,
//     current_start, current_end, charge_at, end_at, paid_count, notes}.
//     Statuses: created, authenticated, active, pending, halted, cancelled,
//     completed, expired, paused.

import { createHmac, timingSafeEqual } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { INTERVALS, PAID_PLANS, rzpKeyId, rzpKeySecret, rzpPlanFor, rzpPlanId, type Interval, type PaidPlan } from "./config";
import { amountMinor } from "./prices";
import type { SubscriptionUpsert } from "./subscriptions";
import type { SubscriptionStatus } from "./types";

// ── checkout: create the subscription server-side ──────────────────────────

/**
 * Billing cycles to authorize. Razorpay requires a finite `total_count`; ten
 * years is the customary "indefinite" for a monthly plan. The user can cancel
 * any time — this is a ceiling, not a commitment.
 */
export const RZP_TOTAL_COUNT: Record<Interval, number> = { month: 120, year: 10 };

const Created = z.object({ id: z.string().min(1), short_url: z.string().url() }).passthrough();

/**
 * Creates the subscription and returns Razorpay's hosted authorization URL.
 * Throws on any failure (caller answers 502); never returns a fake URL.
 */
export async function createRazorpaySubscription(args: {
  plan: PaidPlan;
  interval: Interval;
  userId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ id: string; url: string }> {
  const planId = rzpPlanId(args.plan, args.interval);
  const keyId = rzpKeyId();
  const secret = rzpKeySecret();
  if (!planId || !keyId || !secret) throw new Error("razorpay not configured");
  const doFetch = args.fetchImpl ?? fetch;
  const r = await doFetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`, "utf8").toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: planId,
      total_count: RZP_TOTAL_COUNT[args.interval],
      quantity: 1,
      customer_notify: 1,
      // notes come back verbatim on every webhook — user_id is the join key.
      notes: { user_id: args.userId, plan: args.plan, interval: args.interval },
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`razorpay create subscription: ${r.status}`);
  const parsed = Created.safeParse(await r.json());
  if (!parsed.success) throw new Error("razorpay create subscription: unexpected response");
  return { id: parsed.data.id, url: parsed.data.short_url };
}

// ── webhook signature ──────────────────────────────────────────────────────

export function verifyRazorpaySignature(
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

export const RZP_SUBSCRIPTION_EVENTS: readonly string[] = [
  "subscription.authenticated",
  "subscription.activated",
  "subscription.charged",
  "subscription.updated",
  "subscription.pending",
  "subscription.halted",
  "subscription.cancelled",
  "subscription.completed",
  "subscription.paused",
  "subscription.resumed",
  "subscription.expired",
] as const;

const Entity = z
  .object({
    id: z.string().min(1),
    plan_id: z.string().nullish(),
    status: z.string(),
    current_start: z.number().nullish(),
    current_end: z.number().nullish(),
    charge_at: z.number().nullish(),
    end_at: z.number().nullish(),
    ended_at: z.number().nullish(),
    // Razorpay serialises empty notes as [] rather than {}.
    notes: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).nullish(),
  })
  .passthrough();

const Payload = z
  .object({
    event: z.string().min(1),
    created_at: z.number().nullish(),
    payload: z
      .object({ subscription: z.object({ entity: Entity }).passthrough().optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type RzpSubscriptionEvent = {
  event: string;
  entity: z.infer<typeof Entity>;
  notes: Record<string, unknown>;
  /** Event timestamp (unix seconds) — the out-of-order guard. */
  eventAt: number | null;
};

export type RzpParsed =
  | { ok: true; event: string; subscription: RzpSubscriptionEvent | null }
  | { ok: false; reason: "malformed" };

export function parseRazorpayWebhook(raw: unknown): RzpParsed {
  const r = Payload.safeParse(raw);
  if (!r.success) return { ok: false, reason: "malformed" };
  const { event, payload, created_at } = r.data;
  const entity = payload?.subscription?.entity;
  if (!RZP_SUBSCRIPTION_EVENTS.includes(event) || !entity) return { ok: true, event, subscription: null };
  const notes = entity.notes && !Array.isArray(entity.notes) ? entity.notes : {};
  return { ok: true, event, subscription: { event, entity, notes, eventAt: created_at ?? null } };
}

/**
 * Razorpay → our vocabulary. `authenticated` is a mandate that is set but not
 * yet charged (the first charge lands at `charge_at`) — treated as trialing,
 * i.e. entitling, so the user is not locked out between authorizing and the
 * first debit. `created` is an unauthorized mandate and confers nothing:
 * null, and the event is ignored.
 */
export function mapRazorpayStatus(status: string): SubscriptionStatus | null {
  switch (status) {
    case "authenticated":
      return "trialing";
    case "active":
      return "active";
    case "pending":
    case "halted":
      return "past_due";
    case "paused":
      return "paused";
    case "cancelled":
      return "cancelled";
    case "completed":
    case "expired":
      return "expired";
    default:
      return null;
  }
}

const unix = (s: number | null | undefined): Date | null =>
  typeof s === "number" && Number.isFinite(s) && s > 0 ? new Date(s * 1000) : null;

export type RzpBuilt =
  | { ok: true; doc: SubscriptionUpsert }
  | { ok: false; reason: "no_user" | "unknown_status" | "unknown_plan" };

export function subscriptionFromRazorpay(ev: RzpSubscriptionEvent, raw: unknown, now: Date = new Date()): RzpBuilt {
  const userId = String(ev.notes.user_id ?? "");
  if (!ObjectId.isValid(userId)) return { ok: false, reason: "no_user" };
  const status = mapRazorpayStatus(ev.entity.status);
  if (!status) return { ok: false, reason: "unknown_status" };

  let plan: PaidPlan | null = null;
  let interval: Interval | null = null;
  const byPlan = ev.entity.plan_id ? rzpPlanFor(ev.entity.plan_id) : null;
  if (byPlan) ({ plan, interval } = byPlan);
  else {
    const p = String(ev.notes.plan ?? "");
    const i = String(ev.notes.interval ?? "");
    if ((PAID_PLANS as readonly string[]).includes(p)) plan = p as PaidPlan;
    if ((INTERVALS as readonly string[]).includes(i)) interval = i as Interval;
  }
  if (!plan || !interval) return { ok: false, reason: "unknown_plan" };

  const e = ev.entity;
  const ended = status === "cancelled" || status === "expired";
  const eventAt = unix(ev.eventAt);
  return {
    ok: true,
    doc: {
      userId: new ObjectId(userId),
      provider: "razorpay",
      providerSubId: e.id,
      plan,
      status,
      currency: "INR",
      amountMinor: amountMinor(plan, interval, "INR"),
      interval,
      // current_end is the paid-through date; before the first charge
      // (authenticated) it is null and charge_at is when access is next
      // decided; a cancelled/completed mandate ends at ended_at / end_at.
      currentPeriodEnd: ended
        ? unix(e.ended_at) ?? unix(e.current_end) ?? unix(e.end_at)
        : unix(e.current_end) ?? unix(e.charge_at) ?? unix(e.end_at),
      cancelledAt: ended ? (eventAt ?? now) : null,
      lastEventAt: eventAt,
      portalUrl: null,
      updatePaymentUrl: null,
      raw,
    },
  };
}

// The `subscriptions` collection — one row per provider subscription.
//
// WRITERS: the two webhook routes under app/api/billing/webhooks/, and nothing
// else. A checkout redirect proves nothing; only a signed webhook does, so the
// plan a user holds is derived from rows written here and never from a client
// claim. Readers: getPlan (lib/billing/entitlements.ts), /api/billing/me, the
// account page, and the admin dashboard's MRR (status ∈ ENTITLING_STATUSES ×
// amountMinor × interval × currency — keep those four fields exact).
//
// Idempotency is the whole design. Providers deliver at-least-once and out of
// order, so the write is an upsert keyed on {provider, providerSubId} guarded
// by the provider's own event timestamp: a replay is a no-op, a late-arriving
// older event cannot regress a newer status.

import { ObjectId } from "mongodb";
import { db } from "@/lib/mongo";
import { logServerEvent } from "@/lib/db/events";
import { bestPlan, entitles } from "./entitlements";
import {
  BILLING_EVENTS,
  PLAN_ORDER,
  type BillingProvider,
  type SubscriptionDoc,
  type SubscriptionStatus,
} from "./types";

/** What a webhook hands the store: everything but the row's own bookkeeping. */
export type SubscriptionUpsert = Omit<SubscriptionDoc, "_id" | "createdAt" | "updatedAt">;

export type SubscriptionChange = "started" | "updated" | "cancelled" | "stale";

export type UpsertOutcome = { doc: SubscriptionDoc; change: SubscriptionChange };

let indexReady: Promise<unknown> | null = null;
async function coll() {
  const c = (await db()).collection<SubscriptionDoc>("subscriptions");
  // The unique index is what makes two concurrent deliveries of the same new
  // subscription collapse into one row instead of two (the watchlists
  // precedent). Awaited so the first write can rely on it.
  indexReady ??= Promise.all([
    c.createIndex({ provider: 1, providerSubId: 1 }, { unique: true }),
    c.createIndex({ userId: 1, status: 1 }),
  ]).catch(() => {});
  await indexReady;
  return c;
}

const ENDED: readonly SubscriptionStatus[] = ["cancelled", "expired"] as const;
const isEnded = (s: SubscriptionStatus) => (ENDED as readonly string[]).includes(s);

/**
 * Upsert by {provider, providerSubId}. Returns the stored row and what
 * changed, so the route can log the right subscription_* event:
 *   started   — first time this providerSubId was seen
 *   cancelled — it just moved into cancelled/expired
 *   updated   — any other change (renewal, pause, past_due, plan swap…)
 *   stale     — the event is older than the one already applied; not written
 */
export async function upsertSubscription(input: SubscriptionUpsert): Promise<UpsertOutcome> {
  const c = await coll();
  const filter = { provider: input.provider, providerSubId: input.providerSubId };
  const existing = await c.findOne(filter);
  if (
    existing?.lastEventAt &&
    input.lastEventAt &&
    input.lastEventAt.getTime() < existing.lastEventAt.getTime()
  ) {
    return { doc: existing, change: "stale" };
  }
  const now = new Date();
  const write = () =>
    c.findOneAndUpdate(
      filter,
      { $set: { ...input, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: "after", includeResultMetadata: true },
    );
  let res: Awaited<ReturnType<typeof write>>;
  try {
    res = await write();
  } catch (e) {
    // Two first deliveries racing: the loser's upsert-insert trips the unique
    // index. Its retry matches the winner's row and becomes a plain update.
    if ((e as { code?: number }).code !== 11000) throw e;
    res = await write();
  }
  const doc = res.value;
  if (!doc) throw new Error("subscription upsert returned no document");
  // "started" is decided by the WRITE (did this call insert?), not by the
  // findOne above: in the race just described both callers saw no row, and
  // deciding from that would log subscription_started twice for one sale.
  const inserted = res.lastErrorObject?.updatedExisting === false;
  const change: SubscriptionChange = inserted
    ? "started"
    : existing && isEnded(input.status) && !isEnded(existing.status)
      ? "cancelled"
      : "updated";
  return { doc, change };
}

/** The product event for an upsert outcome (BILLING_EVENTS names). Never throws. */
export async function logSubscriptionChange(outcome: UpsertOutcome): Promise<void> {
  if (outcome.change === "stale") return;
  const type =
    outcome.change === "started"
      ? BILLING_EVENTS.subscriptionStarted
      : outcome.change === "cancelled"
        ? BILLING_EVENTS.subscriptionCancelled
        : BILLING_EVENTS.subscriptionUpdated;
  await logServerEvent(type, outcome.doc.userId.toHexString(), {
    plan: outcome.doc.plan,
    provider: outcome.doc.provider,
    status: outcome.doc.status,
  });
}

/** Every row for a user, newest first. Bounded — a user has a handful at most. */
export async function subscriptionsFor(userId: string): Promise<SubscriptionDoc[]> {
  if (!ObjectId.isValid(userId)) return [];
  const c = await coll();
  return c
    .find({ userId: new ObjectId(userId) }, { projection: { raw: 0 } })
    .sort({ updatedAt: -1 })
    .limit(10)
    .toArray();
}

/**
 * The row that confers the user's plan right now — the highest entitling one,
 * the same rule getPlan applies — or null on the free tier.
 */
export function currentSubscription(rows: readonly SubscriptionDoc[], now: number = Date.now()): SubscriptionDoc | null {
  const plan = bestPlan(rows, now);
  if (plan === "free") return null;
  const live = rows.filter((r) => entitles(r, now) && r.plan === plan);
  live.sort((a, b) => PLAN_ORDER.indexOf(b.plan) - PLAN_ORDER.indexOf(a.plan) || b.updatedAt.getTime() - a.updatedAt.getTime());
  return live[0] ?? null;
}

/** The fields a browser may see. Never the raw payload, never internal ids. */
export type PublicSubscription = {
  provider: BillingProvider;
  plan: SubscriptionDoc["plan"];
  status: SubscriptionStatus;
  interval: SubscriptionDoc["interval"];
  currency: SubscriptionDoc["currency"];
  amountMinor: number;
  currentPeriodEnd: string | null;
  cancelledAt: string | null;
  /** Present only when the provider has a portal (Lemon Squeezy). */
  portalUrl?: string;
};

export function publicSubscription(doc: SubscriptionDoc): PublicSubscription {
  return {
    provider: doc.provider,
    plan: doc.plan,
    status: doc.status,
    interval: doc.interval,
    currency: doc.currency,
    amountMinor: doc.amountMinor,
    currentPeriodEnd: doc.currentPeriodEnd ? doc.currentPeriodEnd.toISOString() : null,
    cancelledAt: doc.cancelledAt ? doc.cancelledAt.toISOString() : null,
    ...(doc.portalUrl ? { portalUrl: doc.portalUrl } : {}),
  };
}

/** Test-only: forget the index memo so a fresh memory Mongo re-creates it. */
export function __resetSubscriptions(): void {
  indexReady = null;
}

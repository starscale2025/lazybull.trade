// getPlan — the one question every gated surface asks.
//
// Reads the `subscriptions` collection (written only by the provider webhooks
// in app/api/billing/*) and returns the highest plan any entitling
// subscription confers. No subscription, no database, or no user → "free".
// The catch is deliberate: a Mongo blip must degrade a paid user to the free
// experience, never to a 500 on /api/explain.
//
// `ADMIN_EMAILS` holders and anyone listed in `LAZYBULL_COMP_PLAN` (comma
// separated `email:plan` pairs, for founders, friendlies and refunds handled
// by hand) get their plan without a subscription row — a manual grant is a
// support tool, not a billing path, so it is env-driven and reviewable.

import { ObjectId } from "mongodb";
import { db } from "../mongo";
import {
  ENTITLING_STATUSES,
  PLAN_LIMITS,
  PLAN_ORDER,
  planAtLeast,
  type Plan,
  type PlanLimits,
  type SubscriptionDoc,
} from "./types";

export type { Plan, PlanLimits, SubscriptionDoc };
export { PLAN_LIMITS, PLAN_ORDER, planAtLeast };

/** Highest plan among entitling subscriptions, or "free". Never throws. */
export async function getPlan(userId: string | null | undefined, email?: string | null): Promise<Plan> {
  const comp = compPlanFor(email);
  if (comp && comp !== "free") return comp;
  if (!userId || !ObjectId.isValid(userId)) return "free";
  try {
    const rows = await (await db())
      .collection<SubscriptionDoc>("subscriptions")
      .find(
        { userId: new ObjectId(userId), status: { $in: [...ENTITLING_STATUSES] } },
        { projection: { plan: 1, currentPeriodEnd: 1, status: 1 } },
      )
      .toArray();
    return bestPlan(rows);
  } catch {
    return "free";
  }
}

/**
 * Does this row confer its plan right now? Entitling status AND the period
 * has not closed — with a day of grace, because a renewal webhook can land
 * hours after `currentPeriodEnd` and a paying user must not be bounced to
 * free in the gap. A cancelled-at-period-end sub therefore keeps its plan
 * until the period closes, which is exactly what the account page promises.
 */
export function entitles(
  row: Pick<SubscriptionDoc, "status" | "currentPeriodEnd">,
  now: number = Date.now(),
): boolean {
  if (!(ENTITLING_STATUSES as readonly string[]).includes(row.status)) return false;
  if (row.currentPeriodEnd && row.currentPeriodEnd.getTime() < now - 24 * 3600_000) return false;
  return true;
}

/** Highest plan among rows that entitle — the pure core of getPlan. */
export function bestPlan(
  rows: readonly Pick<SubscriptionDoc, "plan" | "status" | "currentPeriodEnd">[],
  now: number = Date.now(),
): Plan {
  let best: Plan = "free";
  for (const r of rows) {
    if (!entitles(r, now)) continue;
    if (PLAN_ORDER.indexOf(r.plan) > PLAN_ORDER.indexOf(best)) best = r.plan;
  }
  return best;
}

/** The limits object for a plan — a convenience for route handlers. */
export function limitsFor(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * Manual grants: `LAZYBULL_COMP_PLAN="a@x.com:pro,b@y.com:plus"`. Read at call
 * time so a redeploy is not needed to revoke one.
 */
export function compPlanFor(email?: string | null): Plan | null {
  if (!email) return null;
  const raw = process.env.LAZYBULL_COMP_PLAN ?? "";
  if (!raw.trim()) return null;
  const want = email.trim().toLowerCase();
  for (const pair of raw.split(",")) {
    const [addr, plan] = pair.split(":").map((s) => s?.trim().toLowerCase());
    if (addr === want && plan && (PLAN_ORDER as readonly string[]).includes(plan)) return plan as Plan;
  }
  return null;
}

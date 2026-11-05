// The paywall decisions as PURE functions — no session, no KV, no Mongo — so
// the cap logic the pricing page advertises is testable in isolation and the
// exact body a gated route emits is importable by the client that renders it
// (components/billing/UpgradeNudge.tsx). Nothing in here may import a server
// module.
//
// The 402 contract every gated surface shares (fixed — the practice engineer
// and the admin dashboard read the same shape):
//   HTTP 402 { ok:false, error, plan, limit?, upgrade:"/pricing#plus"|"/pricing#pro" }

import { PLAN_LIMITS, PLAN_ORDER, type Plan, type PlanLimits } from "./types";

export type PaywallError = "explain_cap" | "workspace_limit" | "locked";
export type UpgradePath = "/pricing#plus" | "/pricing#pro";

export type PaywallBody = {
  ok: false;
  error: PaywallError;
  plan: Plan;
  /** The cap that was hit, when the surface has a numeric one. */
  limit?: number;
  upgrade: UpgradePath;
};

export const PAYWALL_STATUS = 402;

/** The cheapest plan above `have` whose limits satisfy `wants`, or null. */
export function cheapestPlanWith(have: Plan, wants: (l: PlanLimits) => boolean): Plan | null {
  const from = PLAN_ORDER.indexOf(have) + 1;
  for (const p of PLAN_ORDER.slice(from)) if (wants(PLAN_LIMITS[p])) return p;
  return null;
}

/**
 * `count` is the day's tally INCLUDING the request being decided (what
 * lib/billing/usage.ts consumeDaily returns), so the fifth free explain is
 * allowed and the sixth is not. A null limit is unlimited.
 */
export function explainGate(plan: Plan, count: number): { allowed: boolean; limit: number | null } {
  const limit = PLAN_LIMITS[plan].explainsPerDay;
  return { allowed: limit === null || count <= limit, limit };
}

/** `owned` is how many workspaces exist BEFORE the create being decided. */
export function workspaceGate(plan: Plan, owned: number): { allowed: boolean; limit: number | null } {
  const limit = PLAN_LIMITS[plan].workspaces;
  return { allowed: limit === null || owned < limit, limit };
}

/**
 * The 402 body. `upgrade` points at the cheapest tier that lifts THIS limit —
 * Plus for the explain and workspace caps, the first practicePro tier for a
 * locked editorial — so the nudge never sends a free user past the plan that
 * would have solved their problem. The contract only allows the two anchors;
 * a limit that nothing below Power lifts falls back to #pro, the card next to
 * the waitlist-only Power one.
 */
export function paywall(error: PaywallError, plan: Plan, limit?: number | null): PaywallBody {
  const wants: (l: PlanLimits) => boolean =
    error === "explain_cap"
      ? (l) => l.explainsPerDay === null || (typeof limit === "number" && l.explainsPerDay > limit)
      : error === "workspace_limit"
        ? (l) => l.workspaces === null || (typeof limit === "number" && l.workspaces > limit)
        : (l) => l.practicePro;
  const target = cheapestPlanWith(plan, wants);
  const upgrade: UpgradePath = target === "plus" ? "/pricing#plus" : "/pricing#pro";
  return {
    ok: false,
    error,
    plan,
    ...(typeof limit === "number" ? { limit } : {}),
    upgrade,
  };
}

/** Client-side guard for a fetch result: `if (isPaywall(r.status, json)) …`. */
export function isPaywall(status: number, body: unknown): body is PaywallBody {
  if (status !== PAYWALL_STATUS || !body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.ok === false && typeof b.error === "string" && typeof b.upgrade === "string";
}

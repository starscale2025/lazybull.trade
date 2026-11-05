// Who is asking, and what their plan lets them do in /practice. SERVER-ONLY:
// this reaches lib/auth and the subscriptions collection, so only the API
// routes under app/api/practice and the server pages import it — never a
// "use client" file.
//
// The plan ladder is lib/billing/types.ts, read through getPlan(); this file
// only maps a problem's lock onto the two practice flags there. Running the
// visible cases is free for everyone. The wall stands in front of SUBMIT on a
// locked problem, and in front of the editorial and the hints past the first
// on every problem.

import { auth } from "@/lib/auth";
import { getPlan, PLAN_LIMITS, type Plan, type PlanLimits } from "@/lib/billing/entitlements";
import type { Lock } from "./types";

export type Viewer = {
  userId: string | null;
  email: string | null;
  name: string | null;
  plan: Plan;
  limits: PlanLimits;
};

/** The lowest plan that opens a wall — what a 402 tells the client to link to. */
export type Need = "plus" | "power";

/** Session + plan, never throwing: no session and a database blip both read
    as an anonymous free viewer, which is the honest degraded state. */
export async function viewer(): Promise<Viewer> {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;
  const name = session?.user?.name ?? null;
  const plan = await getPlan(userId, email);
  return { userId, email, name, plan, limits: PLAN_LIMITS[plan] };
}

/** What submitting a problem with this lock needs beyond the viewer's plan. */
export function lockNeed(lock: Lock | undefined, limits: PlanLimits): Need | null {
  if (lock === "power" && !limits.practicePower) return "power";
  if (lock === "pro" && !limits.practicePro) return "plus";
  return null;
}

/** What the editorial and the later hints need: the problem's own lock
    first, then the Pro flag every editorial sits behind. */
export function teacherNeed(lock: Lock | undefined, limits: PlanLimits): Need | null {
  return lockNeed(lock, limits) ?? (limits.practicePro ? null : "plus");
}

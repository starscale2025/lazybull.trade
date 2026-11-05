// GET /api/billing/me — the signed-in user's plan, limits, subscription and
// today's explain usage. What the account page renders server-side, exposed
// for client surfaces (the upgrade nudge, a future usage meter) so they read
// the same numbers from the same functions.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPlan, limitsFor } from "@/lib/billing/entitlements";
import { currentSubscription, publicSubscription, subscriptionsFor } from "@/lib/billing/subscriptions";
import { peekDaily } from "@/lib/billing/usage";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }
  const userId = session.user.id;
  const [plan, rows, usage] = await Promise.all([
    getPlan(userId, session.user.email),
    subscriptionsFor(userId).catch(() => []),
    peekDaily("explain", `user:${userId}`),
  ]);
  const limits = limitsFor(plan);
  const current = currentSubscription(rows);
  return NextResponse.json(
    {
      ok: true,
      plan,
      limits,
      subscription: current ? publicSubscription(current) : null,
      usage: { explainsToday: usage.count, explainsLimit: limits.explainsPerDay, resetsAt: usage.resetsAt },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

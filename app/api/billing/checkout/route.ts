// POST /api/billing/checkout — { plan, interval, currency } → { ok, url }.
//
// Signed-in only: the user id travels to the provider as the webhook's join
// key, so an anonymous checkout could never be entitled. When the rail for
// the requested currency (or this plan's id on it) is not configured the
// answer is 503 `billing_not_configured` and the pricing page shows the
// waitlist instead — the one thing this route must never do is invent a URL.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { CheckoutBody, MAX_CHECKOUT_BODY_BYTES, createCheckout } from "@/lib/billing/checkout";
import { readBoundedBody } from "@/lib/billing/request";
import { BILLING_EVENTS } from "@/lib/billing/types";
import { logServerEvent } from "@/lib/db/events";
import { consume } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Per-user per-minute cap: an INR checkout creates a subscription object at
 *  Razorpay, so a stuck button must not mint dozens. */
const MAX_PER_USER = 5;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }
  if (!(await consume(`checkout:user:${session.user.id}`, MAX_PER_USER))) {
    return NextResponse.json({ ok: false, error: "too many checkout attempts — wait a minute" }, { status: 429 });
  }

  const body = await readBoundedBody(req, MAX_CHECKOUT_BODY_BYTES);
  if (body === null) {
    return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  }
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const parsed = CheckoutBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
  }

  const res = await createCheckout({
    ...parsed.data,
    userId: session.user.id,
    email: session.user.email,
  });
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error },
      { status: res.error === "billing_not_configured" ? 503 : 502 },
    );
  }
  await logServerEvent(BILLING_EVENTS.checkoutStarted, session.user.id, {
    plan: parsed.data.plan,
    interval: parsed.data.interval,
    provider: res.provider,
  });
  return NextResponse.json({ ok: true, url: res.url, provider: res.provider });
}

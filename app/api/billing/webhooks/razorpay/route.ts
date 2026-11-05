// POST /api/billing/webhooks/razorpay — the ONLY writer of INR subscriptions.
// See lib/billing/razorpay.ts for what was verified against razorpay.com/docs.
//
// Same response policy as the Lemon Squeezy twin: 401 on a bad signature, 400
// on a body that is not the documented shape, 200 for anything we do not act
// on (other events, an unauthorized `created` mandate, a subscription with no
// user_id in its notes), 500 only when the store failed so Razorpay's retry
// can land the entitlement.

import { NextResponse } from "next/server";
import { rzpWebhookSecret } from "@/lib/billing/config";
import { parseRazorpayWebhook, subscriptionFromRazorpay, verifyRazorpaySignature } from "@/lib/billing/razorpay";
import { logSubscriptionChange, upsertSubscription } from "@/lib/billing/subscriptions";
import { MAX_WEBHOOK_BYTES, readBoundedBody } from "@/lib/billing/request";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = rzpWebhookSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "billing_not_configured" }, { status: 503 });
  }
  const body = await readBoundedBody(req, MAX_WEBHOOK_BYTES);
  if (body === null) {
    return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  }
  if (!verifyRazorpaySignature(body, req.headers.get("x-razorpay-signature"), secret)) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const parsed = parseRazorpayWebhook(raw);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: "malformed payload" }, { status: 400 });
  }
  if (!parsed.subscription) {
    return NextResponse.json({ ok: true, ignored: parsed.event });
  }
  const built = subscriptionFromRazorpay(parsed.subscription, raw);
  if (!built.ok) {
    console.warn(`razorpay webhook ${parsed.event}: ignored (${built.reason})`);
    return NextResponse.json({ ok: true, ignored: built.reason });
  }

  try {
    const outcome = await upsertSubscription(built.doc);
    await logSubscriptionChange(outcome);
    return NextResponse.json({ ok: true, change: outcome.change });
  } catch (e) {
    console.error("razorpay webhook: store failed:", e);
    return NextResponse.json({ ok: false, error: "store failed" }, { status: 500 });
  }
}

// POST /api/billing/webhooks/lemonsqueezy — the ONLY writer of USD
// subscriptions (with its Razorpay twin for INR). See lib/billing/lemonsqueezy.ts
// for what was verified against the provider's docs and when.
//
// Response policy, because Lemon Squeezy retries any non-200 three times:
//   401  bad or missing signature          — never retried into acceptance
//   400  body is not the documented shape   — a retry cannot fix it
//   200  event we do not act on             — orders, invoices, unknown names,
//        test-mode payloads in production, a subscription with no user_id
//   500  the store itself failed            — the retry is what lands the
//        entitlement a customer just paid for
// The signature is checked before the body is parsed, so an unauthenticated
// POST costs one HMAC and nothing else.

import { NextResponse } from "next/server";
import { lsWebhookSecret } from "@/lib/billing/config";
import {
  isTestModeEvent,
  parseLemonSqueezyWebhook,
  subscriptionFromLemonSqueezy,
  verifyLemonSqueezySignature,
} from "@/lib/billing/lemonsqueezy";
import { logSubscriptionChange, upsertSubscription } from "@/lib/billing/subscriptions";
import { MAX_WEBHOOK_BYTES, readBoundedBody } from "@/lib/billing/request";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = lsWebhookSecret();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "billing_not_configured" }, { status: 503 });
  }
  const body = await readBoundedBody(req, MAX_WEBHOOK_BYTES);
  if (body === null) {
    return NextResponse.json({ ok: false, error: "payload too large" }, { status: 413 });
  }
  if (!verifyLemonSqueezySignature(body, req.headers.get("x-signature"), secret)) {
    return NextResponse.json({ ok: false, error: "bad signature" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const parsed = parseLemonSqueezyWebhook(raw);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: "malformed payload" }, { status: 400 });
  }
  if (!parsed.subscription) {
    return NextResponse.json({ ok: true, ignored: parsed.eventName });
  }
  // A test-mode store's webhook must never grant a real plan on the live
  // deploy. LEMONSQUEEZY_TEST_MODE=1 opts a staging deploy in.
  if (isTestModeEvent(parsed.subscription) && process.env.NODE_ENV === "production" && process.env.LEMONSQUEEZY_TEST_MODE !== "1") {
    return NextResponse.json({ ok: true, ignored: "test_mode" });
  }
  const built = subscriptionFromLemonSqueezy(parsed.subscription, raw);
  if (!built.ok) {
    console.warn(`lemonsqueezy webhook ${parsed.eventName}: ignored (${built.reason})`);
    return NextResponse.json({ ok: true, ignored: built.reason });
  }

  try {
    const outcome = await upsertSubscription(built.doc);
    await logSubscriptionChange(outcome);
    return NextResponse.json({ ok: true, change: outcome.change });
  } catch (e) {
    console.error("lemonsqueezy webhook: store failed:", e);
    return NextResponse.json({ ok: false, error: "store failed" }, { status: 500 });
  }
}

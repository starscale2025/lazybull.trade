// The two webhook writers, held to the provider contracts documented in
// lib/billing/lemonsqueezy.ts and lib/billing/razorpay.ts: signature
// verification against HMACs generated here, the status vocabularies, and
// the row each event turns into. Pure — no Mongo, no network; the store side
// is __tests__/billing-store.test.ts.

import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  LS_SUBSCRIPTION_EVENTS,
  isTestModeEvent,
  lsCheckoutUrl,
  mapLemonSqueezyStatus,
  parseLemonSqueezyWebhook,
  subscriptionFromLemonSqueezy,
  verifyLemonSqueezySignature,
} from "@/lib/billing/lemonsqueezy";
import {
  RZP_TOTAL_COUNT,
  createRazorpaySubscription,
  mapRazorpayStatus,
  parseRazorpayWebhook,
  subscriptionFromRazorpay,
  verifyRazorpaySignature,
} from "@/lib/billing/razorpay";
import { checkoutConfigured, lsPlanForVariant, providers, rzpPlanFor } from "@/lib/billing/config";
import { createCheckout } from "@/lib/billing/checkout";
import { amountMinor } from "@/lib/billing/prices";

const USER = "507f1f77bcf86cd799439011";
const hmac = (secret: string, body: string) => createHmac("sha256", secret).update(body, "utf8").digest("hex");

// Every billing env var the suite touches, cleared before and restored after
// each test — config.ts reads at call time, so this is enough to flip rails.
const ENV = [
  "LEMONSQUEEZY_STORE_SUBDOMAIN",
  "LEMONSQUEEZY_WEBHOOK_SECRET",
  "LEMONSQUEEZY_API_KEY",
  "LEMONSQUEEZY_VARIANT_PLUS_MONTHLY",
  "LEMONSQUEEZY_VARIANT_PLUS_ANNUAL",
  "LEMONSQUEEZY_VARIANT_PRO_MONTHLY",
  "LEMONSQUEEZY_VARIANT_PRO_ANNUAL",
  "LEMONSQUEEZY_VARIANT_POWER_MONTHLY",
  "LEMONSQUEEZY_VARIANT_POWER_ANNUAL",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "RAZORPAY_PLAN_PLUS_MONTHLY",
  "RAZORPAY_PLAN_PLUS_ANNUAL",
  "RAZORPAY_PLAN_PRO_MONTHLY",
  "RAZORPAY_PLAN_PRO_ANNUAL",
];
let saved: Record<string, string | undefined> = {};
beforeEach(() => {
  saved = {};
  for (const k of ENV) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function lsEnv() {
  process.env.LEMONSQUEEZY_STORE_SUBDOMAIN = "lazybull";
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "ls-secret";
  process.env.LEMONSQUEEZY_VARIANT_PLUS_MONTHLY = "111";
  process.env.LEMONSQUEEZY_VARIANT_PRO_ANNUAL = "222";
}
function rzpEnv() {
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "rzp-secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "rzp-webhook";
  process.env.RAZORPAY_PLAN_PLUS_MONTHLY = "plan_plus_m";
  process.env.RAZORPAY_PLAN_PRO_ANNUAL = "plan_pro_y";
}

// ── signatures ─────────────────────────────────────────────────────────────

describe("webhook signatures (HMAC-SHA256 hex over the raw body)", () => {
  const body = JSON.stringify({ meta: { event_name: "subscription_created" }, data: { id: 1 } });

  it("Lemon Squeezy: accepts the right hex, case-insensitively, and nothing else", () => {
    const sig = hmac("ls-secret", body);
    expect(verifyLemonSqueezySignature(body, sig, "ls-secret")).toBe(true);
    expect(verifyLemonSqueezySignature(body, sig.toUpperCase(), "ls-secret")).toBe(true);
    expect(verifyLemonSqueezySignature(body, sig, "other-secret")).toBe(false);
    expect(verifyLemonSqueezySignature(body + " ", sig, "ls-secret")).toBe(false); // tampered body
    expect(verifyLemonSqueezySignature(body, sig.slice(0, -2), "ls-secret")).toBe(false); // truncated
    expect(verifyLemonSqueezySignature(body, null, "ls-secret")).toBe(false);
    expect(verifyLemonSqueezySignature(body, "", "ls-secret")).toBe(false);
    expect(verifyLemonSqueezySignature(body, sig, "")).toBe(false); // unconfigured never verifies
  });

  it("Razorpay: same contract on X-Razorpay-Signature", () => {
    const sig = hmac("rzp-webhook", body);
    expect(verifyRazorpaySignature(body, sig, "rzp-webhook")).toBe(true);
    expect(verifyRazorpaySignature(body, hmac("wrong", body), "rzp-webhook")).toBe(false);
    expect(verifyRazorpaySignature(body, undefined, "rzp-webhook")).toBe(false);
    expect(verifyRazorpaySignature(body, sig, "")).toBe(false);
  });
});

// ── Lemon Squeezy ──────────────────────────────────────────────────────────

describe("Lemon Squeezy status map", () => {
  it("maps the documented vocabulary and rejects the rest", () => {
    expect(mapLemonSqueezyStatus("on_trial")).toBe("trialing");
    expect(mapLemonSqueezyStatus("active")).toBe("active");
    expect(mapLemonSqueezyStatus("past_due")).toBe("past_due");
    expect(mapLemonSqueezyStatus("unpaid")).toBe("past_due");
    expect(mapLemonSqueezyStatus("paused")).toBe("paused");
    expect(mapLemonSqueezyStatus("cancelled")).toBe("cancelled");
    expect(mapLemonSqueezyStatus("expired")).toBe("expired");
    expect(mapLemonSqueezyStatus("refunded")).toBeNull();
    expect(mapLemonSqueezyStatus("")).toBeNull();
  });
});

function lsPayload(over: Record<string, unknown> = {}, custom: Record<string, unknown> = { user_id: USER }) {
  return {
    meta: { event_name: "subscription_created", custom_data: custom },
    data: {
      type: "subscriptions",
      id: "42",
      attributes: {
        status: "active",
        variant_id: 111,
        user_email: "a@b.co",
        renews_at: "2026-10-01T00:00:00.000Z",
        ends_at: null,
        cancelled: false,
        updated_at: "2026-09-01T00:00:00.000Z",
        test_mode: false,
        urls: { customer_portal: "https://ls.test/portal", update_payment_method: "https://ls.test/pay" },
        ...over,
      },
    },
  };
}

describe("Lemon Squeezy payload → subscription row", () => {
  it("parses a subscription event and ignores the ones that carry no subscription", () => {
    const p = parseLemonSqueezyWebhook(lsPayload());
    expect(p.ok && p.subscription?.providerSubId).toBe("42");
    const order = parseLemonSqueezyWebhook({ meta: { event_name: "order_created" }, data: { type: "orders", id: 1, attributes: { status: "paid" } } });
    expect(order.ok && order.subscription).toBeNull();
    // subscription_payment_* carries an invoice, not a subscription
    const inv = parseLemonSqueezyWebhook({ meta: { event_name: "subscription_payment_success" }, data: { type: "subscription-invoices", id: 1, attributes: { status: "paid" } } });
    expect(inv.ok && inv.subscription).toBeNull();
    expect(parseLemonSqueezyWebhook({ nope: true }).ok).toBe(false);
    expect(parseLemonSqueezyWebhook("string").ok).toBe(false);
    expect(LS_SUBSCRIPTION_EVENTS).toContain("subscription_updated");
  });

  it("builds the row from the variant → env mapping, with USD amount from PLAN_PRICES", () => {
    lsEnv();
    const p = parseLemonSqueezyWebhook(lsPayload());
    if (!p.ok || !p.subscription) throw new Error("parse failed");
    const b = subscriptionFromLemonSqueezy(p.subscription, {});
    if (!b.ok) throw new Error(`build failed: ${b.reason}`);
    expect(b.doc).toMatchObject({
      provider: "lemonsqueezy",
      providerSubId: "42",
      plan: "plus",
      interval: "month",
      status: "active",
      currency: "USD",
      amountMinor: amountMinor("plus", "month", "USD"),
      portalUrl: "https://ls.test/portal",
      updatePaymentUrl: "https://ls.test/pay",
      cancelledAt: null,
    });
    expect(b.doc.amountMinor).toBe(1900);
    expect(b.doc.userId.toHexString()).toBe(USER);
    expect(b.doc.currentPeriodEnd?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(b.doc.lastEventAt?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("falls back to the checkout's custom data when the variant is no longer in env", () => {
    lsEnv();
    const p = parseLemonSqueezyWebhook(lsPayload({ variant_id: 999 }, { user_id: USER, plan: "pro", interval: "year" }));
    if (!p.ok || !p.subscription) throw new Error("parse failed");
    const b = subscriptionFromLemonSqueezy(p.subscription, {});
    expect(b.ok && b.doc.plan).toBe("pro");
    expect(b.ok && b.doc.interval).toBe("year");
    expect(b.ok && b.doc.amountMinor).toBe(amountMinor("pro", "year", "USD"));
  });

  it("a cancelled subscription keeps access to ends_at and stamps cancelledAt", () => {
    lsEnv();
    const p = parseLemonSqueezyWebhook(
      lsPayload({ status: "cancelled", cancelled: true, ends_at: "2026-10-15T00:00:00.000Z", updated_at: "2026-09-20T00:00:00.000Z" }),
    );
    if (!p.ok || !p.subscription) throw new Error("parse failed");
    const b = subscriptionFromLemonSqueezy(p.subscription, {});
    if (!b.ok) throw new Error(b.reason);
    expect(b.doc.status).toBe("cancelled");
    expect(b.doc.currentPeriodEnd?.toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(b.doc.cancelledAt?.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  });

  it("refuses to entitle without a user id, a known status or a resolvable plan", () => {
    lsEnv();
    const noUser = parseLemonSqueezyWebhook(lsPayload({}, {}));
    expect(noUser.ok && noUser.subscription && subscriptionFromLemonSqueezy(noUser.subscription, {})).toEqual({ ok: false, reason: "no_user" });
    const badStatus = parseLemonSqueezyWebhook(lsPayload({ status: "refunded" }));
    expect(badStatus.ok && badStatus.subscription && subscriptionFromLemonSqueezy(badStatus.subscription, {})).toEqual({ ok: false, reason: "unknown_status" });
    const noPlan = parseLemonSqueezyWebhook(lsPayload({ variant_id: 999 }));
    expect(noPlan.ok && noPlan.subscription && subscriptionFromLemonSqueezy(noPlan.subscription, {})).toEqual({ ok: false, reason: "unknown_plan" });
  });

  it("flags test-mode payloads", () => {
    const p = parseLemonSqueezyWebhook(lsPayload({ test_mode: true }));
    expect(p.ok && p.subscription && isTestModeEvent(p.subscription)).toBe(true);
  });
});

describe("Lemon Squeezy hosted checkout URL", () => {
  it("is the documented buy link with email + custom join keys, or null when unconfigured", () => {
    expect(lsCheckoutUrl({ plan: "plus", interval: "month", userId: USER, email: "a@b.co" })).toBeNull();
    lsEnv();
    const url = lsCheckoutUrl({ plan: "plus", interval: "month", userId: USER, email: "a+x@b.co" });
    expect(url).not.toBeNull();
    const u = new URL(url!);
    expect(u.origin).toBe("https://lazybull.lemonsqueezy.com");
    expect(u.pathname).toBe("/checkout/buy/111");
    expect(u.searchParams.get("checkout[email]")).toBe("a+x@b.co");
    expect(u.searchParams.get("checkout[custom][user_id]")).toBe(USER);
    expect(u.searchParams.get("checkout[custom][plan]")).toBe("plus");
    expect(u.searchParams.get("checkout[custom][interval]")).toBe("month");
    // a plan with no variant id → no URL, even with the rail live
    expect(lsCheckoutUrl({ plan: "power", interval: "month", userId: USER })).toBeNull();
  });

  it("a subdomain that is not a hostname label is ignored, so env can never steer the redirect elsewhere", () => {
    lsEnv();
    process.env.LEMONSQUEEZY_STORE_SUBDOMAIN = "evil.example.com/../";
    expect(lsCheckoutUrl({ plan: "plus", interval: "month", userId: USER })).toBeNull();
    expect(providers().usd).toBe(false);
  });
});

// ── Razorpay ───────────────────────────────────────────────────────────────

describe("Razorpay status map", () => {
  it("maps the documented vocabulary; `created` (unauthorised mandate) confers nothing", () => {
    expect(mapRazorpayStatus("authenticated")).toBe("trialing");
    expect(mapRazorpayStatus("active")).toBe("active");
    expect(mapRazorpayStatus("pending")).toBe("past_due");
    expect(mapRazorpayStatus("halted")).toBe("past_due");
    expect(mapRazorpayStatus("paused")).toBe("paused");
    expect(mapRazorpayStatus("cancelled")).toBe("cancelled");
    expect(mapRazorpayStatus("completed")).toBe("expired");
    expect(mapRazorpayStatus("expired")).toBe("expired");
    expect(mapRazorpayStatus("created")).toBeNull();
  });
});

function rzpPayload(event = "subscription.activated", entity: Record<string, unknown> = {}, created_at = 1_757_000_000) {
  return {
    entity: "event",
    event,
    created_at,
    payload: {
      subscription: {
        entity: {
          id: "sub_ABC",
          plan_id: "plan_plus_m",
          status: "active",
          current_start: 1_756_000_000,
          current_end: 1_758_600_000,
          charge_at: 1_758_600_000,
          end_at: null,
          notes: { user_id: USER, plan: "plus", interval: "month" },
          ...entity,
        },
      },
    },
  };
}

describe("Razorpay payload → subscription row", () => {
  it("parses subscription.* events and ignores the rest; [] notes read as none", () => {
    const p = parseRazorpayWebhook(rzpPayload());
    expect(p.ok && p.subscription?.entity.id).toBe("sub_ABC");
    expect(p.ok && p.subscription?.eventAt).toBe(1_757_000_000);
    const pay = parseRazorpayWebhook({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
    expect(pay.ok && pay.subscription).toBeNull();
    const empty = parseRazorpayWebhook(rzpPayload("subscription.activated", { notes: [] }));
    expect(empty.ok && empty.subscription?.notes).toEqual({});
    expect(parseRazorpayWebhook({ event: 1 }).ok).toBe(false);
  });

  it("builds the row from plan_id → env, INR amount from PLAN_PRICES, unix seconds → dates", () => {
    rzpEnv();
    const p = parseRazorpayWebhook(rzpPayload());
    if (!p.ok || !p.subscription) throw new Error("parse failed");
    const b = subscriptionFromRazorpay(p.subscription, {});
    if (!b.ok) throw new Error(b.reason);
    expect(b.doc).toMatchObject({
      provider: "razorpay",
      providerSubId: "sub_ABC",
      plan: "plus",
      interval: "month",
      status: "active",
      currency: "INR",
      amountMinor: 39_900,
      portalUrl: null,
      cancelledAt: null,
    });
    expect(b.doc.currentPeriodEnd?.getTime()).toBe(1_758_600_000 * 1000);
    expect(b.doc.lastEventAt?.getTime()).toBe(1_757_000_000 * 1000);
  });

  it("authenticated (mandate set, not yet charged) entitles as trialing until charge_at", () => {
    rzpEnv();
    const p = parseRazorpayWebhook(rzpPayload("subscription.authenticated", { status: "authenticated", current_end: null, charge_at: 1_760_000_000 }));
    if (!p.ok || !p.subscription) throw new Error("parse failed");
    const b = subscriptionFromRazorpay(p.subscription, {});
    expect(b.ok && b.doc.status).toBe("trialing");
    expect(b.ok && b.doc.currentPeriodEnd?.getTime()).toBe(1_760_000_000 * 1000);
  });

  it("a retired plan id falls back to notes; a missing user or `created` status is refused", () => {
    rzpEnv();
    const viaNotes = parseRazorpayWebhook(rzpPayload("subscription.activated", { plan_id: "plan_gone", notes: { user_id: USER, plan: "pro", interval: "year" } }));
    const b = viaNotes.ok && viaNotes.subscription ? subscriptionFromRazorpay(viaNotes.subscription, {}) : null;
    expect(b && b.ok && b.doc.plan).toBe("pro");
    expect(b && b.ok && b.doc.amountMinor).toBe(amountMinor("pro", "year", "INR"));

    const noUser = parseRazorpayWebhook(rzpPayload("subscription.activated", { notes: {} }));
    expect(noUser.ok && noUser.subscription && subscriptionFromRazorpay(noUser.subscription, {})).toEqual({ ok: false, reason: "no_user" });
    const created = parseRazorpayWebhook(rzpPayload("subscription.authenticated", { status: "created" }));
    expect(created.ok && created.subscription && subscriptionFromRazorpay(created.subscription, {})).toEqual({ ok: false, reason: "unknown_status" });
  });

  it("cancelled ends at ended_at and stamps cancelledAt from the event time", () => {
    rzpEnv();
    const p = parseRazorpayWebhook(
      rzpPayload("subscription.cancelled", { status: "cancelled", ended_at: 1_757_500_000 }, 1_757_400_000),
    );
    if (!p.ok || !p.subscription) throw new Error("parse failed");
    const b = subscriptionFromRazorpay(p.subscription, {});
    if (!b.ok) throw new Error(b.reason);
    expect(b.doc.status).toBe("cancelled");
    expect(b.doc.currentPeriodEnd?.getTime()).toBe(1_757_500_000 * 1000);
    expect(b.doc.cancelledAt?.getTime()).toBe(1_757_400_000 * 1000);
  });
});

describe("Razorpay create-subscription call", () => {
  it("posts the documented body with basic auth and returns short_url", async () => {
    rzpEnv();
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      seen = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ id: "sub_NEW", status: "created", short_url: "https://rzp.io/i/abc" }), { status: 200 });
    }) as typeof fetch;
    const r = await createRazorpaySubscription({ plan: "plus", interval: "month", userId: USER, fetchImpl });
    expect(r).toEqual({ id: "sub_NEW", url: "https://rzp.io/i/abc" });
    const s = seen as unknown as { url: string; init: RequestInit };
    expect(s.url).toBe("https://api.razorpay.com/v1/subscriptions");
    expect(s.init.method).toBe("POST");
    const auth = (s.init.headers as Record<string, string>).Authorization;
    expect(auth).toBe(`Basic ${Buffer.from("rzp_test_key:rzp-secret").toString("base64")}`);
    expect(JSON.parse(String(s.init.body))).toEqual({
      plan_id: "plan_plus_m",
      total_count: RZP_TOTAL_COUNT.month,
      quantity: 1,
      customer_notify: 1,
      notes: { user_id: USER, plan: "plus", interval: "month" },
    });
  });

  it("throws (never fakes a URL) on a non-2xx or an unexpected body, and when unconfigured", async () => {
    await expect(createRazorpaySubscription({ plan: "plus", interval: "month", userId: USER })).rejects.toThrow(/not configured/);
    rzpEnv();
    const bad = (async () => new Response("{}", { status: 401 })) as typeof fetch;
    await expect(createRazorpaySubscription({ plan: "plus", interval: "month", userId: USER, fetchImpl: bad })).rejects.toThrow(/401/);
    const weird = (async () => new Response(JSON.stringify({ id: "x" }), { status: 200 })) as typeof fetch;
    await expect(createRazorpaySubscription({ plan: "plus", interval: "month", userId: USER, fetchImpl: weird })).rejects.toThrow(/unexpected/);
  });
});

// ── config + orchestration ─────────────────────────────────────────────────

describe("env-gated rails", () => {
  it("nothing set → both rails off, every checkout unconfigured", () => {
    expect(providers()).toEqual({ usd: false, inr: false });
    expect(checkoutConfigured("plus", "month", "USD")).toBe(false);
    expect(checkoutConfigured("plus", "month", "INR")).toBe(false);
  });

  it("a rail counts as live only with ids AND the webhook secret", () => {
    lsEnv();
    delete process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
    expect(providers().usd).toBe(false); // could sell, could never entitle
    lsEnv();
    expect(providers().usd).toBe(true);
    expect(checkoutConfigured("plus", "month", "USD")).toBe(true);
    expect(checkoutConfigured("pro", "year", "USD")).toBe(true);
    expect(checkoutConfigured("pro", "month", "USD")).toBe(false); // no id for that interval
    expect(checkoutConfigured("power", "month", "USD")).toBe(false); // waitlist-only
    expect(lsPlanForVariant(222)).toEqual({ plan: "pro", interval: "year" });
    expect(lsPlanForVariant("nope")).toBeNull();
    rzpEnv();
    expect(providers().inr).toBe(true);
    expect(rzpPlanFor("plan_pro_y")).toEqual({ plan: "pro", interval: "year" });
    expect(checkoutConfigured("plus", "year", "INR")).toBe(false);
  });

  it("createCheckout answers billing_not_configured rather than inventing a URL", async () => {
    const r = await createCheckout({ plan: "plus", interval: "month", currency: "USD", userId: USER });
    expect(r).toEqual({ ok: false, error: "billing_not_configured", provider: "lemonsqueezy" });
    const inr = await createCheckout({ plan: "plus", interval: "month", currency: "INR", userId: USER });
    expect(inr).toEqual({ ok: false, error: "billing_not_configured", provider: "razorpay" });
    lsEnv();
    const live = await createCheckout({ plan: "plus", interval: "month", currency: "USD", userId: USER, email: "a@b.co" });
    expect(live.ok && live.url.startsWith("https://lazybull.lemonsqueezy.com/checkout/buy/111?")).toBe(true);
  });
});

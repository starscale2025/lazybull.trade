// The subscriptions store and the Mongo usage counter against a REAL MongoDB
// (mongodb-memory-server, the __tests__/paper-db.test.ts pattern). What is
// under test is the idempotency contract in lib/billing/subscriptions.ts —
// at-least-once, out-of-order webhook delivery must never double a row or
// regress a status — and getPlan reading the rows the webhooks wrote.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { db } from "@/lib/mongo";
import {
  __resetSubscriptions,
  currentSubscription,
  publicSubscription,
  subscriptionsFor,
  upsertSubscription,
  type SubscriptionUpsert,
} from "@/lib/billing/subscriptions";
import { getPlan } from "@/lib/billing/entitlements";
import { __resetUsage, consumeDaily, peekDaily } from "@/lib/billing/usage";

const USER = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439012";

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = "lbtest";
  (globalThis as unknown as { _lbMongo?: Promise<MongoClient> })._lbMongo = new MongoClient(mongod.getUri()).connect();
  __resetSubscriptions();
  __resetUsage();
}, 60_000);

afterAll(async () => {
  const g = globalThis as unknown as { _lbMongo?: Promise<MongoClient> };
  await g._lbMongo?.then((c) => c.close());
  delete g._lbMongo;
  await mongod?.stop();
});

const row = (over: Partial<SubscriptionUpsert> = {}): SubscriptionUpsert => ({
  userId: new ObjectId(USER),
  provider: "lemonsqueezy",
  providerSubId: "sub_1",
  plan: "plus",
  status: "active",
  currency: "USD",
  amountMinor: 1900,
  interval: "month",
  currentPeriodEnd: new Date("2099-01-01T00:00:00Z"),
  cancelledAt: null,
  lastEventAt: new Date("2026-09-01T00:00:00Z"),
  portalUrl: null,
  updatePaymentUrl: null,
  raw: { n: 1 },
  ...over,
});

describe("upsertSubscription — idempotent, ordered by the provider's clock", () => {
  it("first sight of a providerSubId is `started`; getPlan then confers the plan", async () => {
    expect(await getPlan(USER)).toBe("free");
    const r = await upsertSubscription(row());
    expect(r.change).toBe("started");
    expect(r.doc.createdAt).toBeInstanceOf(Date);
    expect(await getPlan(USER)).toBe("plus");
  });

  it("an exact replay is a no-op update — one row, not two", async () => {
    const r = await upsertSubscription(row());
    expect(r.change).toBe("updated");
    const n = await (await db()).collection("subscriptions").countDocuments({ providerSubId: "sub_1" });
    expect(n).toBe(1);
  });

  it("a NEWER event moves the row; an OLDER one arriving late is `stale` and changes nothing", async () => {
    const newer = await upsertSubscription(row({ status: "past_due", lastEventAt: new Date("2026-09-05T00:00:00Z"), raw: { n: 2 } }));
    expect(newer.change).toBe("updated");
    expect(newer.doc.status).toBe("past_due");

    const late = await upsertSubscription(row({ status: "active", lastEventAt: new Date("2026-09-03T00:00:00Z"), raw: { n: 3 } }));
    expect(late.change).toBe("stale");
    expect(late.doc.status).toBe("past_due"); // the stored row, untouched
    const stored = await (await db()).collection("subscriptions").findOne({ providerSubId: "sub_1" });
    expect(stored?.raw).toEqual({ n: 2 });
  });

  it("moving into cancelled/expired is `cancelled` exactly once; access lasts to the period end", async () => {
    const c = await upsertSubscription(
      row({ status: "cancelled", cancelledAt: new Date("2026-09-10T00:00:00Z"), lastEventAt: new Date("2026-09-10T00:00:00Z"), currentPeriodEnd: new Date("2099-01-01T00:00:00Z") }),
    );
    expect(c.change).toBe("cancelled");
    const again = await upsertSubscription(row({ status: "cancelled", lastEventAt: new Date("2026-09-11T00:00:00Z") }));
    expect(again.change).toBe("updated"); // already ended — not a second cancellation event
    // cancelled is not an entitling status: the plan drops to free even though the period is open.
    expect(await getPlan(USER)).toBe("free");
  });

  it("two first deliveries racing on a new id collapse into one row", async () => {
    const a = row({ providerSubId: "sub_race", plan: "pro", raw: { n: "a" } });
    const b = row({ providerSubId: "sub_race", plan: "pro", raw: { n: "b" } });
    const [ra, rb] = await Promise.all([upsertSubscription(a), upsertSubscription(b)]);
    // exactly ONE subscription_started for one sale — the other is an update
    expect([ra.change, rb.change].sort()).toEqual(["started", "updated"]);
    const n = await (await db()).collection("subscriptions").countDocuments({ providerSubId: "sub_race" });
    expect(n).toBe(1);
    expect(await getPlan(USER)).toBe("pro");
  });

  it("subscriptionsFor + currentSubscription pick the highest entitling row; publicSubscription hides raw", async () => {
    await upsertSubscription(row({ providerSubId: "sub_inr", provider: "razorpay", plan: "plus", currency: "INR", amountMinor: 39_900 }));
    const rows = await subscriptionsFor(USER);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => !("raw" in r))).toBe(true);
    const cur = currentSubscription(rows);
    expect(cur?.plan).toBe("pro");
    expect(cur?.providerSubId).toBe("sub_race");
    const pub = publicSubscription(cur!);
    expect(pub).toMatchObject({ provider: "lemonsqueezy", plan: "pro", status: "active", currency: "USD", amountMinor: 1900 });
    expect(pub.currentPeriodEnd).toBe("2099-01-01T00:00:00.000Z");
    expect((pub as Record<string, unknown>).raw).toBeUndefined();
    expect((pub as Record<string, unknown>).userId).toBeUndefined();
    expect(await subscriptionsFor(OTHER)).toEqual([]);
    expect(await subscriptionsFor("not-an-id")).toEqual([]);
  });

  it("a manual grant via LAZYBULL_COMP_PLAN wins over the rows", async () => {
    process.env.LAZYBULL_COMP_PLAN = "Founder@Lazybull.us:power, x@y.z:plus";
    expect(await getPlan(OTHER, "founder@lazybull.us")).toBe("power");
    expect(await getPlan(OTHER, "nobody@lazybull.us")).toBe("free");
    delete process.env.LAZYBULL_COMP_PLAN;
  });
});

describe("consumeDaily — Mongo backend (no KV configured)", () => {
  const T0 = Date.UTC(2026, 8, 9, 12, 0, 0); // midday UTC, 2026-09-09

  it("counts to the cap and refuses the next one, per key, per UTC day", async () => {
    for (let i = 1; i <= 5; i++) {
      const r = await consumeDaily("explain", "user:u1", 5, T0 + i);
      expect(r).toMatchObject({ allowed: true, count: i, limit: 5 });
    }
    const sixth = await consumeDaily("explain", "user:u1", 5, T0 + 6);
    expect(sixth.allowed).toBe(false);
    expect(sixth.count).toBe(6);
    expect(sixth.resetsAt).toBe(Date.UTC(2026, 8, 10));
    // another key is untouched; the next UTC day starts fresh
    expect((await consumeDaily("explain", "ip:1.2.3.4", 5, T0)).count).toBe(1);
    expect((await consumeDaily("explain", "user:u1", 5, Date.UTC(2026, 8, 10, 0, 0, 1))).count).toBe(1);
  });

  it("a null limit still counts (for the account page) but never refuses", async () => {
    for (let i = 1; i <= 7; i++) expect((await consumeDaily("explain", "user:plus", null, T0)).allowed).toBe(true);
    expect((await peekDaily("explain", "user:plus", T0)).count).toBe(7);
  });

  it("peekDaily reads without counting, and the counter row carries a TTL index", async () => {
    expect((await peekDaily("explain", "user:u1", T0)).count).toBe(6);
    expect((await peekDaily("explain", "user:u1", T0)).count).toBe(6);
    expect((await peekDaily("explain", "user:never", T0)).count).toBe(0);
    const idx = await (await db()).collection("usage_daily").indexes();
    expect(idx.some((i) => i.key?.expiresAt === 1 && i.expireAfterSeconds === 0)).toBe(true);
  });
});

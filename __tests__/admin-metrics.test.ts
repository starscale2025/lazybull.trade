// The admin cockpit's aggregates, against a REAL MongoDB
// (mongodb-memory-server), the way __tests__/practice-db.test.ts does it.
//
// WHY this suite exists at all. The 2026-09 diligence memo: "The admin
// dashboard's KPIs (active sessions, paper trades, AI tokens) are seeded
// pseudo-random mocks. A real events pipeline into MongoDB exists with 15
// event types, but nothing aggregates it." The aggregations in
// lib/admin-metrics.ts are what replaced the seed, and a wrong aggregate is
// worse than the seed was: it looks like measurement. So every number the page
// prints is asserted here against a hand-counted fixture, including the memo's
// own three questions — signups by week, traded within 24 hours, active in
// three separate weeks — and including the case that used to be impossible,
// an EMPTY database, which must yield zeros rather than throw.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import {
  DAY_MS,
  NO_BOT_IDS,
  NO_ERROR_TELEMETRY,
  WEEK_MS,
  startOfUtcDay,
  startOfUtcWeek,
} from "@/lib/admin-data";
import {
  audienceMetrics,
  botMetrics,
  buildKpis,
  cohortMetrics,
  errorMetrics,
  funnelMetrics,
  geoMetrics,
  getAdminMetrics,
  healthSeries,
  killHistory,
  liveStream,
  offlineMetrics,
  paperMetrics,
  practiceMetrics,
  revenueMetrics,
  signupsAndActivation,
  symbolMetrics,
  teacherMetrics,
  tradeFeed,
} from "@/lib/admin-metrics";

/* ── fixture ─────────────────────────────────────────────────────────────── */

// A pinned clock. Every window in lib/admin-metrics is measured from the `now`
// it is handed, which is the whole reason those functions take one.
const NOW = new Date("2026-03-19T12:00:00.000Z");
const T = NOW.getTime();
const HOUR = 3_600_000;
const MIN = 60_000;
const ago = (ms: number) => new Date(T - ms);

const ADA = new ObjectId("507f1f77bcf86cd799439011");
const BOB = new ObjectId("507f1f77bcf86cd799439012");
const CID = new ObjectId("507f1f77bcf86cd799439013");
const DEE = new ObjectId("507f1f77bcf86cd799439014");
const EVE = new ObjectId("507f1f77bcf86cd799439015");
const FRD = new ObjectId("507f1f77bcf86cd799439016");

const ANON = "dev-anon-1-aaaa";
const HEALTH_DEV = "dev-health-bbbb";

const DB = "lbadmin";
let mongod: MongoMemoryServer;
let client: MongoClient;

type Seed = {
  type: string;
  at: number;
  userId?: ObjectId;
  device?: string;
  page?: string;
  props?: Record<string, unknown>;
  country?: string;
};

const EVENTS: Seed[] = [
  // ── signups ────────────────────────────────────────────────────────────
  // Two 10 days back (inside 30d, outside 7d), one 3 days back (inside 7d),
  // and two 35 days back — old enough to have HAD three weeks to come back.
  { type: "signup", at: T - 10 * DAY_MS, userId: ADA, props: { email_domain: "gmail.com" } },
  { type: "signup", at: T - 10 * DAY_MS, userId: BOB, props: { email_domain: "gmail.com" } },
  { type: "signup", at: T - 3 * DAY_MS, userId: CID, props: { email_domain: "proton.me" } },
  { type: "signup", at: T - 35 * DAY_MS, userId: EVE },
  { type: "signup", at: T - 35 * DAY_MS, userId: FRD },

  // ── activation: ADA trades 2h after signing up, BOB 5 days after ───────
  { type: "order_submitted", at: T - 10 * DAY_MS + 2 * HOUR, userId: ADA, props: { sym: "TSLA", side: "buy", qty: 1, type: "market", mode: "filled" } },
  { type: "order_submitted", at: T - 5 * DAY_MS, userId: BOB, props: { sym: "AAPL", side: "buy", qty: 2, type: "market", mode: "filled" } },
  { type: "bet_placed", at: T - 3 * DAY_MS + HOUR, userId: CID, props: { sym: "NVDA", dir: "up", stake: 500 } },
  { type: "order_submitted", at: T - 6 * HOUR, userId: BOB, props: { sym: "AAPL", side: "sell", qty: 2, type: "limit", mode: "resting" } },

  // ── the funnel ─────────────────────────────────────────────────────────
  { type: "page_view", at: T - 6 * DAY_MS, userId: BOB, page: "/trade", country: "IN" },
  { type: "page_view", at: T - 2 * DAY_MS, userId: ADA, page: "/trade", country: "IN" },
  { type: "page_view", at: T - 20 * HOUR, device: ANON, page: "/trade/builder", country: "US" },
  { type: "page_view", at: T - 2 * DAY_MS, userId: ADA, page: "/pricing" },
  { type: "bet_opened", at: T - 2 * DAY_MS, userId: ADA, props: { underlying: "AAPL", strategy: "Bull Call Spread", cost: 240, legs: 2 } },
  { type: "hit_paywall", at: T - 2 * DAY_MS, userId: CID, props: { surface: "explain", plan: "free" } },
  { type: "hit_paywall", at: T - 3 * DAY_MS, userId: ADA, props: { surface: "workspace", plan: "free" } },
  { type: "checkout_started", at: T - 2 * DAY_MS, userId: CID, props: { plan: "pro", interval: "month", provider: "lemonsqueezy" } },
  { type: "subscription_started", at: T - 2 * DAY_MS, userId: CID, props: { plan: "pro", provider: "lemonsqueezy", status: "active" } },

  // ── ai teacher ─────────────────────────────────────────────────────────
  { type: "explain_served", at: T - 2 * HOUR, userId: ADA, props: { source: "openai", plan: "free" } },
  { type: "explain_served", at: T - 3 * DAY_MS, userId: ADA, props: { source: "mock", plan: "free" } },
  { type: "explain_served", at: T - 4 * DAY_MS, userId: BOB, props: { source: "openai", plan: "pro" } },

  // ── quant workbench: a run count, never a bot id ───────────────────────
  { type: "quant_run_all", at: T - 2 * DAY_MS, userId: ADA, props: { symbol: "AAPL", mode: "swing", bots: 3 } },
  { type: "setup_applied", at: T - 2 * DAY_MS, userId: ADA, props: { symbol: "AAPL", mode: "swing" } },

  // ── the only kill-shaped fact the product records ──────────────────────
  { type: "close_all", at: T - 4 * DAY_MS, userId: ADA, props: { reason: "daily loss limit" } },

  // ── the 35-day cohort: EVE comes back in weeks 1, 2 and 3; FRD never ───
  { type: "page_view", at: T - 27 * DAY_MS, userId: EVE, page: "/learn" },
  { type: "page_view", at: T - 20 * DAY_MS, userId: EVE, page: "/learn" },
  { type: "page_view", at: T - 13 * DAY_MS, userId: EVE, page: "/learn" },

  // ── the ingest-rate chart's last 90 minutes ────────────────────────────
  { type: "page_view", at: T - 5 * MIN, device: HEALTH_DEV, page: "/" },
  { type: "page_view", at: T - 1 * MIN, device: HEALTH_DEV, page: "/" },
];

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.MONGODB_DB = DB;
  // lib/mongo reads MONGODB_DB at call time but memoizes its client on
  // globalThis — seed the memo so every db() in the suite shares ONE
  // connection and vitest can exit cleanly.
  client = new MongoClient(mongod.getUri());
  (globalThis as unknown as { _lbMongo?: Promise<MongoClient> })._lbMongo = client.connect();
  const d = (await (globalThis as unknown as { _lbMongo: Promise<MongoClient> })._lbMongo).db(DB);

  await d.collection("users").insertMany(
    [ADA, BOB, CID, DEE, EVE, FRD].map((_id) => ({ _id, name: "someone", email: `${_id.toHexString()}@example.com` })),
  );

  await d.collection("events").insertMany(
    EVENTS.map((e) => ({
      ...(e.userId ? { userId: e.userId } : {}),
      ...(e.device ? { device: e.device } : {}),
      type: e.type,
      ...(e.page ? { page: e.page } : {}),
      ...(e.props ? { props: e.props } : {}),
      ...(e.country ? { country: e.country } : {}),
      sv: 2,
      createdAt: new Date(e.at),
    })),
  );

  // Two entitling subscriptions — one USD monthly, one INR annual — plus two
  // that must NOT count: an "active" row whose period closed long ago (the
  // entitles() guard) and a cancelled one.
  await d.collection("subscriptions").insertMany([
    {
      userId: ADA, provider: "lemonsqueezy", providerSubId: "ls_1", plan: "pro", status: "active",
      currency: "USD", amountMinor: 3900, interval: "month",
      currentPeriodEnd: ago(-15 * DAY_MS), cancelledAt: null,
      createdAt: ago(20 * DAY_MS), updatedAt: ago(20 * DAY_MS),
    },
    {
      // ₹10,080 a year → ₹840 a month → exactly $10 at ₹84/$.
      userId: BOB, provider: "razorpay", providerSubId: "rzp_1", plan: "plus", status: "active",
      currency: "INR", amountMinor: 1_008_000, interval: "year",
      currentPeriodEnd: ago(-200 * DAY_MS), cancelledAt: null,
      createdAt: ago(40 * DAY_MS), updatedAt: ago(40 * DAY_MS),
    },
    {
      userId: CID, provider: "lemonsqueezy", providerSubId: "ls_2", plan: "power", status: "active",
      currency: "USD", amountMinor: 5900, interval: "month",
      currentPeriodEnd: ago(10 * DAY_MS), cancelledAt: null,
      createdAt: ago(40 * DAY_MS), updatedAt: ago(10 * DAY_MS),
    },
    {
      userId: DEE, provider: "razorpay", providerSubId: "rzp_2", plan: "plus", status: "cancelled",
      currency: "INR", amountMinor: 39_900, interval: "month",
      currentPeriodEnd: ago(2 * DAY_MS), cancelledAt: ago(2 * DAY_MS),
      createdAt: ago(60 * DAY_MS), updatedAt: ago(2 * DAY_MS),
    },
  ]);

  await d.collection("waitlist").insertMany([
    { email: "a@x.com", tier: "pro", currency: "USD", createdAt: ago(DAY_MS) },
    { email: "b@x.com", tier: "pro", currency: "USD", createdAt: ago(DAY_MS) },
    { email: "c@x.com", tier: "power", currency: "INR", createdAt: ago(DAY_MS) },
  ]);

  await d.collection("practice_submissions").insertMany([
    { userId: ADA, slug: "black-scholes-call", lang: "python", mode: "submit", verdict: "accepted", createdAt: ago(2 * DAY_MS) },
    { userId: ADA, slug: "black-scholes-call", lang: "python", mode: "submit", verdict: "wrong-answer", createdAt: ago(2 * DAY_MS) },
    { device: ANON, slug: "kelly-fraction", lang: "python", mode: "submit", verdict: "accepted", createdAt: ago(DAY_MS) },
    { userId: BOB, slug: "black-scholes-call", lang: "python", mode: "run", verdict: "accepted", createdAt: ago(DAY_MS) },
    { userId: ADA, slug: "stale-problem", lang: "python", mode: "submit", verdict: "accepted", createdAt: ago(10 * DAY_MS) },
  ]);
}, 90_000);

afterAll(async () => {
  const g = globalThis as unknown as { _lbMongo?: Promise<MongoClient> };
  await g._lbMongo?.then((c) => c.close());
  delete g._lbMongo;
  await mongod?.stop();
});

/* ── the memo's first two numbers ────────────────────────────────────────── */

describe("signups per day, and activation", () => {
  it("buckets signups by UTC day and totals 7d / 30d / all-time", async () => {
    const { signups } = await signupsAndActivation(NOW);
    expect(signups.daily).toHaveLength(14);
    expect(signups.daily[0].day).toBe(startOfUtcDay(T) - 13 * DAY_MS);
    expect(signups.daily[13].day).toBe(startOfUtcDay(T));

    // ADA + BOB land on the same day, ten days back; CID three days back.
    expect(signups.daily[3]).toEqual({ day: startOfUtcDay(T) - 10 * DAY_MS, signups: 2, activated: 1 });
    expect(signups.daily[10]).toEqual({ day: startOfUtcDay(T) - 3 * DAY_MS, signups: 1, activated: 1 });
    expect(signups.daily.reduce((a, b) => a + b.signups, 0)).toBe(3);

    expect(signups.last7).toBe(1);   // CID only
    expect(signups.prev7).toBe(2);   // ADA + BOB, in the 14d–7d window
    expect(signups.last30).toBe(3);  // the 35-day pair is outside
    expect(signups.allTime).toBe(5); // …but still counted all-time
    expect(signups.usersTotal).toBe(6);
  });

  it("counts a signup as activated only when the trade is AFTER it and inside the window", async () => {
    const { activation } = await signupsAndActivation(NOW);
    // All three 30-day signups are older than 24h, so all three are askable.
    expect(activation.signups).toBe(3);
    expect(activation.eligible24h).toBe(3);
    expect(activation.within24h).toBe(2); // ADA (+2h) and CID (+1h); BOB traded on day 5
    expect(activation.rate24h).toBeCloseTo(2 / 3, 6);

    // CID is only three days old — asking whether they traded within SEVEN
    // days is unanswerable, so CID is not in the denominator.
    expect(activation.eligible7d).toBe(2);
    expect(activation.within7d).toBe(2);
    expect(activation.rate7d).toBe(1);
  });
});

/* ── the memo's third number ─────────────────────────────────────────────── */

describe("weekly cohorts", () => {
  it("retains by weeks since each person's own signup, and answers 'active in ≥3 weeks'", async () => {
    const c = await cohortMetrics(NOW);
    expect(c.rows).toHaveLength(8);

    const old = c.rows.find((r) => r.weekStart === startOfUtcWeek(T - 35 * DAY_MS));
    expect(old?.signups).toBe(2);          // EVE + FRD
    expect(old?.retained).toEqual([1, 1, 1, 0]); // EVE came back in weeks 1, 2, 3
    expect(old?.threeWeekActive).toBe(1);  // EVE was live in weeks 0,1,2,3
    expect(old?.weeksElapsed).toBeGreaterThanOrEqual(5);

    const recent = c.rows.find((r) => r.weekStart === startOfUtcWeek(T - 10 * DAY_MS));
    expect(recent?.signups).toBe(2);       // ADA + BOB
    expect(recent?.retained[0]).toBe(2);   // both were active in their week 1

    // The headline is measured ONLY over signups that have had 28 days to
    // earn it — the 10-day and 3-day cohorts are not in the denominator.
    expect(c.threeWeekActive).toEqual({ eligible: 2, users: 1, share: 0.5 });
  });

  it("keeps eight buckets exactly one week apart, oldest first", async () => {
    const c = await cohortMetrics(NOW);
    for (let i = 1; i < c.rows.length; i++) {
      expect(c.rows[i].weekStart - c.rows[i - 1].weekStart).toBe(WEEK_MS);
    }
  });
});

/* ── audience, paper trades, funnel ──────────────────────────────────────── */

describe("audience and paper trades", () => {
  it("counts distinct users, falling back to the device id", async () => {
    // 24h: ADA (explain), BOB (order), the anonymous device, the health device.
    // 7d adds CID. 30d adds EVE. FRD's only event is 35 days old.
    expect(await audienceMetrics(NOW)).toEqual({ dau: 4, wau: 5, mau: 6 });
  });

  it("counts order_submitted + bet_placed, and the people behind them", async () => {
    expect(await paperMetrics(NOW)).toEqual({
      trades24h: 1,   // BOB, 6h ago
      prev24h: 0,
      trades7d: 3,    // BOB ×2, CID ×1 — ADA's is 10 days old
      traders24h: 1,
      traders7d: 2,
    });
  });

  it("counts each funnel step independently, keeping the step labels", async () => {
    const f = await funnelMetrics(NOW);
    expect(f.map((s) => s.label)).toEqual([
      "Visited /trade", "Opened a bet", "Placed a trade", "Hit the paywall", "Started checkout", "Subscribed",
    ]);
    expect(f.map((s) => s.count)).toEqual([
      3, // BOB, ADA, the anonymous device — /trade/builder matches the ^/trade prefix
      1, // ADA
      3, // ADA, BOB, CID
      2, // CID (explain) + ADA (workspace) — NOT nested under "placed a trade"
      1,
      1,
    ]);
  });
});

/* ── money ───────────────────────────────────────────────────────────────── */

describe("revenue", () => {
  it("totals MRR in USD, divides annual by 12, and converts INR at the env rate", async () => {
    const before = process.env.LAZYBULL_INR_PER_USD;
    delete process.env.LAZYBULL_INR_PER_USD; // exercise the documented default
    const r = await revenueMetrics(NOW);
    expect(r.inrPerUsd).toBe(84);
    // $39/mo + (₹10,080/yr ÷ 12 ÷ 84) = $39 + $10.
    expect(r.mrrUsd).toBe(49);
    expect(r.mrrFromInrUsd).toBe(10);
    expect(r.mrrInrNative).toBe(840);
    // The lapsed "active" row and the cancelled row are both excluded.
    expect(r.active).toBe(2);
    expect(Object.fromEntries(r.byPlan.map((p) => [p.key, p.n]))).toEqual({ pro: 1, plus: 1 });
    expect(Object.fromEntries(r.byProvider.map((p) => [p.key, p.n]))).toEqual({ lemonsqueezy: 1, razorpay: 1 });
    expect(r.newSubs30d).toBe(1);
    expect(r.cancelled30d).toBe(1);
    expect(r.waitlistTotal).toBe(3);
    expect(r.waitlist).toContainEqual({ tier: "pro", currency: "USD", n: 2 });
    if (before) process.env.LAZYBULL_INR_PER_USD = before;
  });

  it("honours LAZYBULL_INR_PER_USD at call time", async () => {
    const before = process.env.LAZYBULL_INR_PER_USD;
    process.env.LAZYBULL_INR_PER_USD = "42";
    const r = await revenueMetrics(NOW);
    expect(r.inrPerUsd).toBe(42);
    expect(r.mrrFromInrUsd).toBe(20); // ₹840 ÷ 42
    expect(r.mrrUsd).toBe(59);
    if (before) process.env.LAZYBULL_INR_PER_USD = before;
    else delete process.env.LAZYBULL_INR_PER_USD;
  });
});

/* ── the rest of the tiles ───────────────────────────────────────────────── */

describe("teacher, practice, symbols, geo", () => {
  it("splits explain_served by source and plan, and hit_paywall by surface", async () => {
    const t = await teacherMetrics(NOW);
    expect(t.served24h).toBe(1);
    expect(t.served7d).toBe(3);
    expect(Object.fromEntries(t.bySource.map((r) => [r.key, r.n]))).toEqual({ openai: 2, mock: 1 });
    expect(Object.fromEntries(t.byPlan.map((r) => [r.key, r.n]))).toEqual({ free: 2, pro: 1 });
    expect(t.paywall7d).toBe(2);
    expect(Object.fromEntries(t.paywallBySurface.map((r) => [r.key, r.n]))).toEqual({ explain: 1, workspace: 1 });
  });

  it("reads the practice ledger, not the client events", async () => {
    const p = await practiceMetrics(NOW);
    expect(p).toMatchObject({ runs: 1, submits: 3, accepted: 2, users: 3 });
    expect(p.top[0]).toEqual({ slug: "black-scholes-call", submissions: 2, accepted: 1 });
    expect(p.top.map((r) => r.slug)).not.toContain("stale-problem"); // 10 days old
  });

  it("reads `sym` and `underlying`, and counts distinct traders per symbol", async () => {
    const s = await symbolMetrics(NOW);
    expect(s.note).toBeNull();
    expect(s.rows[0]).toEqual({ sym: "AAPL", trades: 3, traders: 2 }); // BOB ×2 + ADA's bet_opened
    expect(s.rows[1]).toEqual({ sym: "NVDA", trades: 1, traders: 1 });
    expect(s.rows.map((r) => r.sym)).not.toContain("TSLA"); // 10 days old
  });

  it("groups distinct actives by the server-stamped country", async () => {
    const g = await geoMetrics(NOW);
    expect(g.rows).toEqual([{ country: "IN", users: 2 }, { country: "US", users: 1 }]);
    expect(g.total).toBe(3);
    expect(g.note).toBeNull();
  });
});

describe("stream, health, and the tiles with no source", () => {
  it("returns real events newest-first with hashed actors", async () => {
    const rows = await liveStream(NOW);
    expect(rows[0].type).toBe("page_view");
    expect(rows[0].t).toBe(T - MIN);
    expect(rows[0].level).toBe("info");
    // The device id never crosses into the client bundle.
    expect(rows[0].who).toMatch(/^d·[0-9a-f]{6}$/);
    expect(JSON.stringify(rows)).not.toContain(HEALTH_DEV);
    expect(JSON.stringify(rows)).not.toContain(ADA.toHexString());
    for (let i = 1; i < rows.length; i++) expect(rows[i].t).toBeLessThanOrEqual(rows[i - 1].t);
    // Levels come from the real event vocabulary.
    expect(rows.find((r) => r.type === "order_submitted")?.level).toBe("trade");
    expect(rows.find((r) => r.type === "explain_served")?.level).toBe("ai");
    expect(rows.find((r) => r.type === "signup")?.level).toBe("auth");
    expect(rows.find((r) => r.type === "close_all")?.level).toBe("kill");
    expect(rows.find((r) => r.type === "bet_placed")?.meta).toContain("sym=NVDA");
  });

  it("buckets events per minute for 90 minutes and zero-fills the rest", async () => {
    const h = await healthSeries(NOW);
    expect(h).toHaveLength(90);
    expect(h[89].t).toBe(T);
    expect(h[89].t - h[0].t).toBe(89 * MIN);
    expect(h.reduce((a, b) => a + b.events, 0)).toBe(2);
    expect(h.find((p) => p.t === T - MIN)?.events).toBe(1);
    expect(h.find((p) => p.t === T - 5 * MIN)?.events).toBe(1);
    expect(h.find((p) => p.t === T - 30 * MIN)?.events).toBe(0);
  });

  it("says out loud that bot ids and error telemetry do not exist", async () => {
    const b = await botMetrics(NOW);
    expect(b).toEqual({ rows: [], runs: 2, botsEngaged: 3, note: NO_BOT_IDS });
    expect(await errorMetrics(NOW)).toEqual({ rows: [], note: NO_ERROR_TELEMETRY });
  });

  it("rebuilds the order feed and the close_all log from events", async () => {
    const f = await tradeFeed(NOW);
    expect(f.rows).toHaveLength(4);
    expect(f.rows[0]).toMatchObject({ sym: "AAPL", kind: "order_submitted", detail: "sell 2 · limit · resting" });
    expect(f.rows[1]).toMatchObject({ sym: "AAPL", kind: "bet_opened", detail: "Bull Call Spread · 2 legs" });
    expect(f.note).toBeNull();

    const k = await killHistory(NOW);
    expect(k.rows).toHaveLength(1);
    expect(k.rows[0]).toMatchObject({ reason: "daily loss limit" });
  });
});

/* ── the page ────────────────────────────────────────────────────────────── */

describe("getAdminMetrics", () => {
  it("puts the memo's three numbers first, in its order, with honest deltas", async () => {
    const m = await getAdminMetrics(NOW);
    expect(m.ok).toBe(true);
    expect(m.degraded).toEqual([]);
    expect(m.kpis.map((c) => c.k).slice(0, 3)).toEqual(["signups · 7d", "activation · 24h", "3-week active"]);
    expect(m.kpis[0].v).toBe(1);
    expect(m.kpis[0].delta).toBeCloseTo(-50, 6); // 1 this week against 2 last week
    expect(m.kpis[0].spark).toEqual(m.signups.daily.map((d) => d.signups));
    expect(m.kpis[1].v).toBeCloseTo(66.7, 1);
    expect(m.kpis[2].v).toBe(50);
    // paper trades · 24h has no previous window with anything in it, so it
    // carries NO delta rather than a fabricated one.
    expect(m.kpis.find((c) => c.k === "paper trades · 24h")?.delta).toBeUndefined();
    expect(m.kpis.find((c) => c.k === "mrr")?.v).toBe(49);
  });

  it("fires every group off the same clock", async () => {
    const m = await getAdminMetrics(NOW);
    expect(m.generatedAt).toBe(T);
    expect(m.health).toHaveLength(90);
    expect(m.funnel).toHaveLength(6);
    expect(m.stream.length).toBeGreaterThan(0);
  });
});

/* ── the two ways this page can have nothing to say ──────────────────────── */

describe("an empty database", () => {
  it("yields zeros and empty states rather than throwing", async () => {
    // lib/mongo reads MONGODB_DB at CALL time, so pointing it at a database
    // that was never written is a complete, isolated empty fixture.
    const before = process.env.MONGODB_DB;
    process.env.MONGODB_DB = "lbadmin_empty";
    try {
      const m = await getAdminMetrics(NOW);
      expect(m.ok).toBe(true);
      expect(m.degraded).toEqual([]);
      expect(m.signups.last7).toBe(0);
      expect(m.signups.allTime).toBe(0);
      expect(m.signups.usersTotal).toBe(0);
      expect(m.signups.daily).toHaveLength(14);
      expect(m.signups.daily.every((d) => d.signups === 0)).toBe(true);
      expect(m.activation.rate24h).toBe(0);
      expect(m.audience).toEqual({ dau: 0, wau: 0, mau: 0 });
      expect(m.cohorts.threeWeekActive).toEqual({ eligible: 0, users: 0, share: 0 });
      expect(m.paper.trades24h).toBe(0);
      expect(m.revenue.mrrUsd).toBe(0);
      expect(m.revenue.active).toBe(0);
      expect(m.practice).toMatchObject({ runs: 0, submits: 0, accepted: 0, users: 0, top: [] });
      expect(m.funnel.every((s) => s.count === 0)).toBe(true);
      expect(m.stream).toEqual([]);
      expect(m.health.every((p) => p.events === 0)).toBe(true);
      expect(m.symbols.rows).toEqual([]);
      expect(m.symbols.note).toBeTruthy();
      expect(m.geo.note).toBeTruthy();
      expect(m.trades.note).toBeTruthy();
      expect(m.kill.note).toBeTruthy();
      // A zero share must be 0, never NaN on screen.
      for (const cell of m.kpis) expect(Number.isNaN(Number(cell.v))).toBe(false);
    } finally {
      process.env.MONGODB_DB = before;
    }
  });
});

describe("an unreachable database", () => {
  it("reports offline with zeros — never a seeded number", () => {
    const m = offlineMetrics(NOW, "MONGODB_URI is not set.");
    expect(m.ok).toBe(false);
    expect(m.error).toBe("MONGODB_URI is not set.");
    expect(m.kpis).toEqual([]);
    expect(m.signups.daily.every((d) => d.signups === 0 && d.activated === 0)).toBe(true);
    expect(m.audience).toEqual({ dau: 0, wau: 0, mau: 0 });
    expect(m.health).toHaveLength(90);
    expect(m.health.every((p) => p.events === 0)).toBe(true);
    expect(m.funnel.map((s) => s.label)).toHaveLength(6);
    expect(m.funnel.every((s) => s.count === 0)).toBe(true);
    // buildKpis over the offline shape must still be finite and zeroed.
    const { kpis: _drop, ...rest } = m;
    for (const cell of buildKpis(rest)) {
      expect(cell.delta).toBeUndefined();
      expect(Number(cell.v)).toBe(0);
    }
  });
});

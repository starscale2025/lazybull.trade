// The daily counter's KV path (against the shared fake transport, no
// network), its fail-open policy with no backend at all, and the pure paywall
// decisions in lib/billing/gate.ts + lib/billing/entitlements.ts that every
// gated route builds its 402 from.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __setKvTransport } from "@/lib/kv";
import { __resetMongo } from "@/lib/mongo";
import { __resetUsage, consumeDaily, nextUtcMidnight, peekDaily, usageKey, utcDay } from "@/lib/billing/usage";
import { PAYWALL_STATUS, cheapestPlanWith, explainGate, isPaywall, paywall, workspaceGate } from "@/lib/billing/gate";
import { bestPlan, compPlanFor, entitles, limitsFor } from "@/lib/billing/entitlements";
import { ENTITLING_STATUSES, PLAN_LIMITS, PLAN_ORDER, planAtLeast } from "@/lib/billing/types";
import { fakeKv } from "./helpers/fakeKv";

const T0 = Date.UTC(2026, 8, 9, 12, 0, 0);

let savedUri: string | undefined;
beforeEach(() => {
  savedUri = process.env.MONGODB_URI;
  delete process.env.MONGODB_URI; // no Mongo in this file — KV or nothing
  __resetMongo();
  __resetUsage();
});
afterEach(() => {
  __setKvTransport(null);
  if (savedUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = savedUri;
  __resetUsage();
});

describe("consumeDaily — KV backend", () => {
  it("INCRs a per-UTC-day key, sets the TTL once, and refuses past the cap", async () => {
    const kv = fakeKv(T0);
    __setKvTransport(kv.transport);
    for (let i = 1; i <= 5; i++) expect((await consumeDaily("explain", "user:u1", 5, T0)).count).toBe(i);
    const sixth = await consumeDaily("explain", "user:u1", 5, T0);
    expect(sixth.allowed).toBe(false);
    expect(sixth.limit).toBe(5);
    const key = usageKey("explain", "user:u1", T0);
    expect(key).toBe("usage:explain:user:u1:2026-09-09");
    expect(kv.store.get(key)?.val).toBe("6");
    expect(kv.calls.filter((c) => c[0] === "EXPIRE" && c[1] === key)).toHaveLength(1);
    expect(kv.calls.filter((c) => c[0] === "INCR")).toHaveLength(6);
    // peek reads the same key without counting
    expect((await peekDaily("explain", "user:u1", T0)).count).toBe(6);
    expect(kv.store.get(key)?.val).toBe("6");
  });

  it("the key rolls at UTC midnight and the old day's counter expires on its own", async () => {
    const kv = fakeKv(T0);
    __setKvTransport(kv.transport);
    await consumeDaily("explain", "user:u1", 5, T0);
    const next = nextUtcMidnight(T0);
    expect(next).toBe(Date.UTC(2026, 8, 10));
    expect(utcDay(next)).toBe("2026-09-10");
    expect((await consumeDaily("explain", "user:u1", 5, next)).count).toBe(1);
    kv.clock.t = T0 + 3 * 86_400_000; // three days on: the 2-day TTL has reaped both keys
    expect(kv.store.has(usageKey("explain", "user:u1", T0))).toBe(true); // lazy expiry: still present…
    expect((await peekDaily("explain", "user:u1", T0)).count).toBe(0); // …but reads as gone
  });

  it("fails OPEN when KV errors and no Mongo is configured — a blip must not 402 a legitimate user", async () => {
    __setKvTransport(async () => {
      throw new Error("kv down");
    });
    const r = await consumeDaily("explain", "user:u1", 5, T0);
    expect(r).toMatchObject({ allowed: true, count: 0, limit: 5 });
    expect((await peekDaily("explain", "user:u1", T0)).count).toBe(0);
  });

  it("treats a missing INCR result as a failure rather than as 'under the cap forever'", async () => {
    __setKvTransport(async (cmd) => (cmd[0] === "INCR" ? null : 1));
    const r = await consumeDaily("explain", "user:u1", 5, T0);
    expect(r.allowed).toBe(true); // degraded to no-backend → open, and visibly count 0
    expect(r.count).toBe(0);
  });
});

describe("explainGate / workspaceGate — the pure decisions", () => {
  it("free: the fifth explain of the day is allowed, the sixth is not; paid tiers are unlimited", () => {
    expect(explainGate("free", 5)).toEqual({ allowed: true, limit: 5 });
    expect(explainGate("free", 6)).toEqual({ allowed: false, limit: 5 });
    expect(explainGate("plus", 5000)).toEqual({ allowed: true, limit: null });
    expect(explainGate("pro", 1)).toEqual({ allowed: true, limit: null });
  });

  it("free: one saved workspace — the create that would make two is refused", () => {
    expect(workspaceGate("free", 0)).toEqual({ allowed: true, limit: 1 });
    expect(workspaceGate("free", 1)).toEqual({ allowed: false, limit: 1 });
    expect(workspaceGate("plus", 99)).toEqual({ allowed: true, limit: null });
  });

  it("the 402 body follows the fixed contract and points at the cheapest tier that lifts THIS limit", () => {
    const e = paywall("explain_cap", "free", 5);
    expect(e).toEqual({ ok: false, error: "explain_cap", plan: "free", limit: 5, upgrade: "/pricing#plus" });
    expect(paywall("workspace_limit", "free", 1)).toEqual({ ok: false, error: "workspace_limit", plan: "free", limit: 1, upgrade: "/pricing#plus" });
    expect(paywall("locked", "free")).toEqual({ ok: false, error: "locked", plan: "free", upgrade: "/pricing#plus" });
    // nothing cheaper than Power lifts a Pro user's locked surface → the #pro anchor, never a Power sale
    expect(paywall("locked", "pro").upgrade).toBe("/pricing#pro");
    expect(isPaywall(PAYWALL_STATUS, e)).toBe(true);
    expect(isPaywall(200, e)).toBe(false);
    expect(isPaywall(PAYWALL_STATUS, { ok: false })).toBe(false);
    expect(cheapestPlanWith("free", (l) => l.practicePro)).toBe("plus");
    expect(cheapestPlanWith("free", (l) => l.practicePower)).toBe("power");
    expect(cheapestPlanWith("power", () => true)).toBeNull();
  });
});

describe("bestPlan / entitles — precedence and grace", () => {
  const D = (s: string) => new Date(s);
  const now = Date.UTC(2026, 8, 9);

  it("takes the highest plan among entitling rows; non-entitling statuses are ignored", () => {
    const rows = [
      { plan: "plus" as const, status: "active" as const, currentPeriodEnd: D("2099-01-01") },
      { plan: "pro" as const, status: "cancelled" as const, currentPeriodEnd: D("2099-01-01") },
      { plan: "power" as const, status: "expired" as const, currentPeriodEnd: null },
    ];
    expect(bestPlan(rows, now)).toBe("plus");
    expect(bestPlan([...rows, { plan: "pro", status: "past_due", currentPeriodEnd: D("2099-01-01") }], now)).toBe("pro");
    expect(bestPlan([{ plan: "power", status: "trialing", currentPeriodEnd: null }], now)).toBe("power");
    expect(bestPlan([], now)).toBe("free");
  });

  it("a period that closed more than a day ago no longer entitles; inside the day of grace it does", () => {
    expect(entitles({ status: "active", currentPeriodEnd: D("2026-09-08T12:00:00Z") }, now)).toBe(true); // 12h ago
    expect(entitles({ status: "active", currentPeriodEnd: D("2026-09-07T00:00:00Z") }, now)).toBe(false); // 2 days ago
    expect(entitles({ status: "paused", currentPeriodEnd: D("2099-01-01") }, now)).toBe(false);
    for (const s of ENTITLING_STATUSES) expect(entitles({ status: s, currentPeriodEnd: null }, now)).toBe(true);
  });

  it("plan arithmetic and the manual-grant parser", () => {
    expect(PLAN_ORDER).toEqual(["free", "plus", "pro", "power"]);
    expect(planAtLeast("pro", "plus")).toBe(true);
    expect(planAtLeast("plus", "pro")).toBe(false);
    expect(limitsFor("free")).toBe(PLAN_LIMITS.free);
    process.env.LAZYBULL_COMP_PLAN = " a@x.com : pro ,b@y.com:nonsense";
    expect(compPlanFor("A@x.com")).toBe("pro");
    expect(compPlanFor("b@y.com")).toBeNull();
    expect(compPlanFor(null)).toBeNull();
    delete process.env.LAZYBULL_COMP_PLAN;
    expect(compPlanFor("a@x.com")).toBeNull();
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createOrchestrator } from "@/lib/market-data";
import {
  __clearMemCache,
  acquireRefreshLock,
  cacheSet,
  releaseRefreshLock,
} from "@/lib/market-data/cache";
import { __resetHealth } from "@/lib/market-data/health";
import { __setKvTransport } from "@/lib/kv";
import { STALE_RETENTION_S } from "@/lib/market-data/provider";
import type { MarketDataProvider, Quote } from "@/lib/market-data/provider";
import { fakeKv } from "./helpers/fakeKv";

// D5: the single-flight refresh lock. With KV configured, a stale/cold key is
// refreshed by exactly ONE instance; the rest serve last-good instead of
// stampeding the upstream. These tests install a fake KV shared by "instances".

const q = (sym: string, last: number): Quote => ({ sym, last, chg: 0, chgPct: 0 });

function countingProvider(counter: { n: number }, last: number): MarketDataProvider {
  const p: MarketDataProvider = {
    name: () => "counter",
    supportsRealtime: () => true,
    supportsCrypto: () => true,
    supportsIntraday: () => true,
    available: () => true,
    health: () => ({ name: "counter", available: true, failures: 0, trippedUntil: 0, lastSuccess: 0 }),
    async getQuotes(syms) {
      counter.n += 1;
      return syms.map((s) => q(s, last));
    },
    async getQuote(sym) {
      return q(sym, last);
    },
    async getBars() {
      throw new Error("no bars");
    },
  };
  return p;
}

// Seed a deliberately-STALE quote entry (older than the ~3s quote freshness TTL,
// still within the 24h retention) under the key getQuotes(["AAPL"]) computes.
async function seedStale(sym: string) {
  await cacheSet(
    `q:${sym}`,
    { data: [q(sym, 1)], storedAt: Date.now() - 3_600_000, provider: "seed", isRealtime: false },
    STALE_RETENTION_S
  );
}

let kv: ReturnType<typeof fakeKv>;
beforeEach(() => {
  kv = fakeKv();
  __setKvTransport(kv.transport);
  __resetHealth();
  __clearMemCache();
});
afterEach(() => {
  __setKvTransport(null);
  __clearMemCache();
});

describe("single-flight refresh lock (D5)", () => {
  it("SET NX semantics: one holder at a time, reusable after release", async () => {
    expect(await acquireRefreshLock("k")).toBe(true); // first caller wins
    expect(await acquireRefreshLock("k")).toBe(false); // held → second is turned away
    await releaseRefreshLock("k");
    expect(await acquireRefreshLock("k")).toBe(true); // freed → next caller wins
  });

  it("serves last-good (Tier C) without hitting upstream while another instance holds the lock", async () => {
    const counter = { n: 0 };
    const o = createOrchestrator([countingProvider(counter, 200)]);
    await seedStale("AAPL");

    // Simulate ANOTHER instance mid-refresh by holding the lock ourselves.
    expect(await acquireRefreshLock("q:AAPL")).toBe(true);

    const held = await o.getQuotes(["AAPL"]);
    expect(counter.n).toBe(0); // did NOT stampede the upstream
    expect(held.provenance.tier).toBe("C"); // served the stale last-good instead
    expect(held.quotes[0]?.sym).toBe("AAPL");

    // Once the other instance finishes, this one refreshes for real.
    await releaseRefreshLock("q:AAPL");
    const fresh = await o.getQuotes(["AAPL"]);
    expect(counter.n).toBe(1);
    expect(fresh.quotes[0]?.last).toBe(200);
  });

  it("collapses two concurrent instances to a SINGLE upstream refresh", async () => {
    const counter = { n: 0 };
    // Two orchestrators = two 'instances' with independent in-flight dedup,
    // sharing the same KV (cache + lock).
    const a = createOrchestrator([countingProvider(counter, 300)]);
    const b = createOrchestrator([countingProvider(counter, 300)]);
    await seedStale("AAPL");

    const [ra, rb] = await Promise.all([a.getQuotes(["AAPL"]), b.getQuotes(["AAPL"])]);

    expect(counter.n).toBe(1); // exactly one instance refreshed; the other served last-good
    expect(ra.quotes[0]?.sym).toBe("AAPL");
    expect(rb.quotes[0]?.sym).toBe("AAPL");
  });

  it("without KV, the lock is a no-op (acquire always succeeds)", async () => {
    __setKvTransport(null); // simulate an un-provisioned deploy
    expect(await acquireRefreshLock("q:AAPL")).toBe(true);
    expect(await acquireRefreshLock("q:AAPL")).toBe(true); // no coordination → every instance owns its refresh
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { createOrchestrator } from "@/lib/market-data";
import { __resetHealth, breakerClosed, isQualifyingFailure } from "@/lib/market-data/health";
import { __clearMemCache, cacheSet, cacheGet, ageMs } from "@/lib/market-data/cache";
import type { BarsResult, MarketDataProvider, Quote } from "@/lib/market-data/provider";

// A controllable fake provider. `quotes`/`bars` may return a value or throw.
function fake(opts: {
  name: string;
  realtime?: boolean;
  available?: boolean;
  quotes?: (syms: string[]) => Quote[];
  bars?: (sym: string, tf: string) => BarsResult;
  onCall?: () => void;
}): MarketDataProvider {
  const p: MarketDataProvider = {
    name: () => opts.name,
    supportsRealtime: () => opts.realtime ?? false,
    supportsCrypto: () => true,
    supportsIntraday: () => true,
    available: () => opts.available ?? true,
    health: () => ({ name: opts.name, available: true, failures: 0, trippedUntil: 0, lastSuccess: 0 }),
    async getQuotes(syms) {
      opts.onCall?.();
      if (!opts.quotes) throw new Error("500 no quotes");
      return opts.quotes(syms);
    },
    async getQuote(sym) {
      const [q] = await p.getQuotes([sym]);
      if (!q) throw new Error("no quote");
      return q;
    },
    async getBars(sym, tf) {
      opts.onCall?.();
      if (!opts.bars) throw new Error("500 no bars");
      return opts.bars(sym, tf);
    },
  };
  return p;
}

const q = (sym: string, last = 100): Quote => ({ sym, last, chg: 1, chgPct: 1 });
const someBars = (): BarsResult => ({
  bars: [
    { i: 0, t: 1, o: 1, h: 1, l: 1, c: 1, v: 1 },
    { i: 1, t: 2, o: 2, h: 2, l: 2, c: 2, v: 2 },
  ],
  meta: { regularMarketPrice: 2 },
});

beforeEach(() => {
  __resetHealth();
  __clearMemCache();
});

describe("circuit breaker", () => {
  it("classifies only 429/5xx/timeout as qualifying failures", () => {
    expect(isQualifyingFailure(new Error("yahoo 429"))).toBe(true);
    expect(isQualifyingFailure(new Error("timeout"))).toBe(true);
    expect(isQualifyingFailure(new Error("alpaca 503"))).toBe(true);
    expect(isQualifyingFailure(new Error("The operation was aborted"))).toBe(true);
    expect(isQualifyingFailure(new Error("no data"))).toBe(false);
    expect(isQualifyingFailure(new Error("unsupported symbol"))).toBe(false);
  });

  it("trips a provider after repeated qualifying failures and stops using it", async () => {
    const bad = fake({ name: "bad" }); // always throws "500 …" (qualifying)
    const good = fake({ name: "good", realtime: true, quotes: (s) => s.map((x) => q(x)) });
    const o = createOrchestrator([bad, good]);

    expect(breakerClosed("bad")).toBe(true);
    // 3 failures (the threshold) across calls trips bad's breaker.
    await o.getQuotes(["A"]);
    await o.getQuotes(["B"]);
    await o.getQuotes(["C"]);
    expect(breakerClosed("bad")).toBe(false); // bad is now skipped entirely
  });
});

describe("provider chain", () => {
  it("falls through to the next provider on failure and tags its tier", async () => {
    const failing = fake({ name: "failing" }); // throws
    const backup = fake({ name: "backup", realtime: true, bars: someBars });
    const o = createOrchestrator([failing, backup]);

    const res = await o.getBars("AAPL", "D");
    expect(res).not.toBeNull();
    expect(res!.provenance.provider).toBe("backup");
    expect(res!.provenance.tier).toBe("A"); // backup is realtime → Tier A
    expect(res!.bars.length).toBe(2);
  });

  it("gap-fills quotes across providers so no symbol is lost", async () => {
    // stocks-only provider can't do ^VIX; the index provider backfills it.
    const stocks = fake({
      name: "stocks",
      realtime: true,
      quotes: (syms) => syms.filter((s) => !s.startsWith("^")).map((s) => q(s)),
    });
    const index = fake({ name: "index", quotes: (syms) => syms.map((s) => q(s, 15)) });
    const o = createOrchestrator([stocks, index]);

    const { quotes, provenance } = await o.getQuotes(["AAPL", "MSFT", "^VIX"]);
    const syms = quotes.map((x) => x.sym).sort();
    expect(syms).toEqual(["AAPL", "MSFT", "^VIX"]);
    expect(provenance.provider).toBe("stocks"); // first contributor
    expect(provenance.tier).toBe("A"); // a realtime provider contributed
  });

  it("marks a non-realtime-only result as Tier B", async () => {
    const delayed = fake({ name: "delayed", realtime: false, bars: someBars });
    const o = createOrchestrator([delayed]);
    const res = await o.getBars("AAPL", "D");
    expect(res!.provenance.tier).toBe("B");
    expect(res!.provenance.isRealtime).toBe(false);
  });
});

describe("request de-duplication", () => {
  it("collapses concurrent identical requests into one upstream call", async () => {
    let calls = 0;
    const p = fake({
      name: "counted",
      onCall: () => {
        calls++;
      },
      quotes: (s) => s.map((x) => q(x)),
    });
    const o = createOrchestrator([p]);

    await Promise.all([
      o.getQuotes(["AAPL"]),
      o.getQuotes(["AAPL"]),
      o.getQuotes(["AAPL"]),
      o.getQuotes(["AAPL"]),
      o.getQuotes(["AAPL"]),
    ]);
    expect(calls).toBe(1);
  });
});

describe("caching", () => {
  it("serves a fresh cache hit without re-calling the provider", async () => {
    let calls = 0;
    const p = fake({
      name: "cached",
      realtime: true,
      onCall: () => {
        calls++;
      },
      bars: someBars,
    });
    const o = createOrchestrator([p]);

    const first = await o.getBars("AAPL", "D");
    const second = await o.getBars("AAPL", "D"); // within the 10-min daily TTL
    expect(calls).toBe(1); // provider hit once
    expect(first!.provenance.isCached).toBe(false);
    expect(second!.provenance.isCached).toBe(true);
    expect(second!.provenance.provider).toBe("cached");
  });

  it("stale-serves last-good (Tier C) when every provider fails", async () => {
    // Seed a backdated cache entry (older than the 3s quote TTL, within retention).
    await cacheSet<Quote[]>(
      "q:AAPL",
      { data: [q("AAPL", 123)], storedAt: Date.now() - 10_000, provider: "alpaca", isRealtime: true },
      3600
    );
    const dead = fake({ name: "dead" }); // always throws
    const o = createOrchestrator([dead]);

    const { quotes, provenance } = await o.getQuotes(["AAPL"]);
    expect(quotes[0].last).toBe(123);
    expect(provenance.tier).toBe("C");
    expect(provenance.isCached).toBe(true);
    expect(provenance.cacheAge).toBeGreaterThanOrEqual(10_000);
  });

  it("round-trips an entry and reports its age", async () => {
    await cacheSet("k", { data: { hi: 1 }, storedAt: Date.now(), provider: "x", isRealtime: false }, 60);
    const got = await cacheGet<{ hi: number }>("k");
    expect(got?.data.hi).toBe(1);
    expect(ageMs(got!)).toBeGreaterThanOrEqual(0);
  });
});

describe("tier D — no data anywhere", () => {
  it("returns null bars when no provider and no cache", async () => {
    const o = createOrchestrator([fake({ name: "dead" })]);
    expect(await o.getBars("AAPL", "D")).toBeNull();
  });

  it("returns empty quotes at Tier D", async () => {
    const o = createOrchestrator([fake({ name: "dead" })]);
    const { quotes, provenance } = await o.getQuotes(["AAPL"]);
    expect(quotes).toEqual([]);
    expect(provenance.tier).toBe("D");
  });

  it("skips unavailable (unconfigured) providers", async () => {
    const off = fake({ name: "off", available: false, bars: someBars });
    const on = fake({ name: "on", realtime: true, bars: someBars });
    const o = createOrchestrator([off, on]);
    const res = await o.getBars("AAPL", "D");
    expect(res!.provenance.provider).toBe("on");
  });
});

// A provider that never resolves — simulates a hung/blackholed upstream.
const hanging: MarketDataProvider = {
  name: () => "hang",
  supportsRealtime: () => true,
  supportsCrypto: () => true,
  supportsIntraday: () => true,
  available: () => true,
  health: () => ({ name: "hang", available: true, failures: 0, trippedUntil: 0, lastSuccess: 0 }),
  getQuote: () => new Promise<never>(() => {}),
  getQuotes: () => new Promise<never>(() => {}),
  getBars: () => new Promise<never>(() => {}),
};

describe("global provider timeout (P0-4)", () => {
  it("bounds total time when a provider hangs — returns Tier D, never hangs the caller", async () => {
    const o = createOrchestrator([hanging], { deadlineMs: 80 });
    const start = Date.now();
    const res = await o.getBars("AAPL", "D");
    expect(res).toBeNull(); // no data → Tier D, not an infinite wait
    expect(Date.now() - start).toBeLessThan(1000); // bounded by the ~80ms deadline
  });

  it("leaves the happy path unchanged — a fast provider serves well under the deadline", async () => {
    const good = fake({ name: "good", realtime: true, bars: someBars });
    const o = createOrchestrator([good], { deadlineMs: 80 });
    const res = await o.getBars("AAPL", "D");
    expect(res!.provenance.provider).toBe("good");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isCrypto } from "@/lib/market-data/provider";

// The Alpaca adapter against the rules of Alpaca's API (2026-11-17): its bars
// endpoints default `start` to the beginning of the current day, so a request
// must name a start far enough back, and one unknown symbol fails a whole
// snapshots batch. Both sank every chart and the whole watchlist on the live
// site the day keys were added.

type Call = { url: URL };
let calls: Call[] = [];

function respond(handler: (u: URL) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const u = new URL(String(input));
      calls.push({ url: u });
      return new Response(JSON.stringify(handler(u)), { status: 200, headers: { "content-type": "application/json" } });
    })
  );
}

async function load() {
  vi.resetModules();
  vi.stubEnv("ALPACA_KEY_ID", "PKTEST");
  vi.stubEnv("ALPACA_SECRET", "secret-test");
  return (await import("@/lib/market-data/alpaca")).alpaca;
}

const daysBack = (iso: string | null) => (Date.now() - new Date(iso ?? "").getTime()) / 864e5;

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("crypto symbols", () => {
  it("knows a coin in every form the site uses", () => {
    for (const s of ["BTC", "BTCUSD", "BTC-USD", "BTC/USD", "eth-usd", "SOLUSDT"]) expect(isCrypto(s), s).toBe(true);
    for (const s of ["AAPL", "BTCX", "BTC-EUR", "^NSEI", "RELIANCE.NS"]) expect(isCrypto(s), s).toBe(false);
  });

  it("maps each form to Alpaca's pair", async () => {
    const { cryptoPair } = await import("@/lib/market-data/alpaca");
    for (const s of ["BTC", "BTCUSD", "BTC-USD", "BTC/USD", "btc-usd", "BTCUSDT"]) expect(cryptoPair(s), s).toBe("BTC/USD");
  });
});

describe("bars", () => {
  it("asks for daily stock bars from years back, newest first, and returns them oldest first", async () => {
    respond((u) =>
      u.pathname.endsWith("/bars")
        ? {
            bars: [
              { t: "2026-11-14T05:00:00Z", o: 3, h: 3, l: 3, c: 3, v: 30 },
              { t: "2026-11-13T05:00:00Z", o: 2, h: 2, l: 2, c: 2, v: 20 },
              { t: "2026-11-12T05:00:00Z", o: 1, h: 1, l: 1, c: 1, v: 10 },
            ],
          }
        : {}
    );
    const alpaca = await load();
    const res = await alpaca.getBars("AAPL", "D");

    const req = calls.find((c) => c.url.pathname === "/v2/stocks/AAPL/bars")!.url;
    expect(req.searchParams.get("timeframe")).toBe("1Day");
    expect(req.searchParams.get("sort")).toBe("desc");
    expect(req.searchParams.get("limit")).toBe("1300");
    expect(req.searchParams.get("feed")).toBe("iex");
    expect(daysBack(req.searchParams.get("start"))).toBeGreaterThan(1900);

    expect(res.bars.map((b) => b.c)).toEqual([1, 2, 3]);
    expect(res.bars.map((b) => b.i)).toEqual([0, 1, 2]);
    expect(res.meta.regularMarketPrice).toBe(3);
  });

  it("names a start for intraday bars too, so a request before the open is not empty", async () => {
    respond((u) => (u.pathname.endsWith("/bars") ? { bars: [{ t: "2026-11-14T20:59:00Z", o: 2, c: 2 }, { t: "2026-11-14T20:58:00Z", o: 1, c: 1 }] } : {}));
    const alpaca = await load();
    await alpaca.getBars("NVDA", "1m");
    const req = calls.find((c) => c.url.pathname.endsWith("/bars"))!.url;
    expect(daysBack(req.searchParams.get("start"))).toBeGreaterThan(5);
    expect(req.searchParams.get("sort")).toBe("desc");
  });

  it("fetches BTC-USD from the crypto endpoint as BTC/USD", async () => {
    respond(() => ({
      bars: {
        "BTC/USD": [
          { t: "2026-11-17T09:00:00Z", o: 91000, c: 91200 },
          { t: "2026-11-17T08:00:00Z", o: 90500, c: 91000 },
        ],
      },
    }));
    const alpaca = await load();
    const res = await alpaca.getBars("BTC-USD", "1h");
    const req = calls[0].url;
    expect(req.pathname).toBe("/v1beta3/crypto/us/bars");
    expect(req.searchParams.get("symbols")).toBe("BTC/USD");
    expect(req.searchParams.get("sort")).toBe("desc");
    expect(req.searchParams.get("start")).toBeTruthy();
    expect(res.bars.map((b) => b.c)).toEqual([91000, 91200]);
  });

  it("refuses symbols it cannot price, so the chain moves on", async () => {
    respond(() => ({}));
    const alpaca = await load();
    await expect(alpaca.getBars("^GSPC", "D")).rejects.toThrow();
    await expect(alpaca.getBars("RELIANCE.NS", "D")).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("quotes", () => {
  it("prices stocks and coins in one batch and leaves out what Alpaca does not carry", async () => {
    respond((u) => {
      if (u.pathname === "/v2/clock") return { is_open: false };
      if (u.pathname === "/v2/stocks/snapshots") {
        expect(u.searchParams.get("symbols")).toBe("AAPL");
        return { AAPL: { latestTrade: { p: 352.66, t: "2026-11-16T21:00:24Z" }, prevDailyBar: { c: 356.4 } } };
      }
      if (u.pathname === "/v1beta3/crypto/us/snapshots") {
        expect(u.searchParams.get("symbols")).toBe("BTC/USD");
        return { snapshots: { "BTC/USD": { latestTrade: { p: 91200, t: "2026-11-17T09:00:00Z" }, prevDailyBar: { c: 90000 } } } };
      }
      return {};
    });
    const alpaca = await load();
    const quotes = await alpaca.getQuotes(["AAPL", "BTC-USD", "^NSEI", "RELIANCE.NS"]);
    expect(quotes.map((q) => [q.sym, q.last])).toEqual([
      ["AAPL", 352.66],
      ["BTC-USD", 91200],
    ]);
  });
});

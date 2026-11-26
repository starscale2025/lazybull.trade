// What a deployment can price, and what the terminal does with a symbol it
// cannot: an empty pane that says so, never a made-up chart of a real market.

import { afterEach, describe, expect, it, vi } from "vitest";
import { isNoFeed, namedNoFeed, noFeedNote } from "@/lib/pro/no-feed";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** The coverage module as a deployment with these sources sees it. */
async function coverage(sources: { yahoo?: boolean; twelveData?: boolean } = {}) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("MARKET_DATA_ALLOW_YAHOO", sources.yahoo ? "1" : "");
  vi.stubEnv("TWELVE_DATA_API_KEY", sources.twelveData ? "td-test" : "");
  return import("@/lib/market-data/coverage");
}

describe("on the US feed alone (production today)", () => {
  it("prices US tickers and the listed coins, and nothing else", async () => {
    const { priceable } = await coverage();
    for (const s of ["AAPL", "F", "BRK.B", "SPY", "ROKU", "BTC-USD", "ETH-USD", "BTC", "aapl"]) expect(priceable(s), s).toBe(true);
    for (const s of ["^GSPC", "^IXIC", "^VIX", "^NSEI", "^NSEBANK", "RELIANCE.NS", "TCS.BO", "NIFTY", "BANKNIFTY"]) expect(priceable(s), s).toBe(false);
  });

  it("an index or an Indian name with no bars has no feed: there is nothing to wait for", async () => {
    const { missReason } = await coverage();
    for (const s of ["^GSPC", "^IXIC", "^NSEI", "RELIANCE.NS", "NIFTY"]) expect(missReason(s), s).toBe("no_feed");
  });

  it("a ticker nobody listed that came back empty is treated as no feed, not as an outage", async () => {
    const { missReason } = await coverage();
    expect(missReason("ZZZZ")).toBe("no_feed");
    expect(missReason("APPLE")).toBe("no_feed"); // a typed word that is shaped like a ticker
  });

  it("a listed stock, fund or coin with no bars is the feed not answering", async () => {
    const { missReason } = await coverage();
    for (const s of ["AAPL", "NVDA", "SPY", "QQQ", "BTC-USD", "ETH-USD", "BTC"]) expect(missReason(s), s).toBe("feed_down");
  });
});

describe("with a source that carries indices and Indian names", () => {
  it("everything is priceable again, and a listed index that is missing is an outage", async () => {
    for (const sources of [{ yahoo: true }, { twelveData: true }]) {
      const { priceable, missReason } = await coverage(sources);
      for (const s of ["^GSPC", "^NSEI", "RELIANCE.NS", "AAPL"]) expect(priceable(s), s).toBe(true);
      expect(missReason("^GSPC")).toBe("feed_down");
      expect(missReason("RELIANCE.NS")).toBe("feed_down");
      expect(missReason("ZZZZ")).toBe("no_feed");
    }
  });
});

describe("the terminal's reading of a failed bars request", () => {
  it("goes by the server's reason when there is an answer", () => {
    expect(isNoFeed({ reason: "no_feed" }, "AAPL")).toBe(true);
    expect(isNoFeed({ reason: "feed_down" }, "^GSPC")).toBe(false); // a source carries it and is down
    expect(isNoFeed({}, "^GSPC")).toBe(false); // an older answer with no reason: the practice tape, as before
  });

  it("goes by the name only when the request itself failed", () => {
    expect(isNoFeed(null, "^GSPC")).toBe(true);
    expect(isNoFeed(null, "RELIANCE.NS")).toBe(true);
    expect(isNoFeed(null, "tcs.bo")).toBe(true);
    expect(isNoFeed(null, "AAPL")).toBe(false);
    expect(isNoFeed(null, "BTC-USD")).toBe(false);
    expect(namedNoFeed("BRK.B")).toBe(false);
  });

  it("says it in one plain sentence that names the symbol", () => {
    expect(noFeedNote("^GSPC")).toBe("No price data for ^GSPC here.");
  });
});

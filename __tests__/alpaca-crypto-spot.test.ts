import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// What a coin's price is (2026-11-24).
//
// Alpaca's own crypto venue prints few trades and requotes all the time, and
// builds its crypto bars from quote midpoints when no trade prints. A quote row
// made of trades alone stood behind its own chart: on /pro the price tag and
// the watchlist beside it were tens of dollars apart on BTC, and the live
// stream, which pushes a row only when `last` changes, moved only when a trade
// printed. A coin's `last` is now the newer of its latest trade and the
// midpoint of its latest quote, with that one's time as `marketTime`. A stock's
// row is its last trade, exactly as before.
//
// The fixtures are what /v1beta3/crypto/us/snapshots answered that morning,
// every block as sent, less the trade id (`i`), which is past what a JS number
// holds.

/** BTC/USD at 06:03:55Z: the book requoted 1.4 s before, the last trade 6 s old. */
const BTC = {
  dailyBar: { c: 60368.025, h: 61601.7245, l: 59369.81, n: 325, o: 61191.86, t: "2026-11-24T00:00:00Z", v: 0.549552363, vw: 60440.5182549741 },
  latestQuote: { ap: 60397.27, as: 0.001003, bp: 60385.062, bs: 0.001003, t: "2026-11-24T06:03:53.609881159Z" },
  latestTrade: { p: 60376.9, s: 0.000187, t: "2026-11-24T06:03:49.105726071Z", tks: "S" },
  minuteBar: { c: 60368.025, h: 60456.4345, l: 60352.05, n: 2, o: 60456.4345, t: "2026-11-24T06:02:00Z", v: 0.000037, vw: 60412.1621621622 },
  prevDailyBar: { c: 61194.841, h: 64614.0945, l: 60283.055, n: 1378, o: 61176.51, t: "2026-11-23T00:00:00Z", v: 7.70255927, vw: 61896.8595937264 },
};
const BTC_MID = (60385.062 + 60397.27) / 2; // 60391.166

/** DOGE/USD at 06:04:15Z: requoted 0.6 s before; its last trade was three hours old and 2% away. */
const DOGE = {
  dailyBar: { c: 0.0565534, h: 0.0571204, l: 0.0552146, n: 2, o: 0.056307, t: "2026-11-24T00:00:00Z", v: 216.414363453, vw: 0.0555338406 },
  latestQuote: { ap: 0.05666, as: 248103.9, bp: 0.056458, bs: 248402.176, t: "2026-11-24T06:04:14.655321719Z" },
  latestTrade: { p: 0.0553446, s: 164.808526011, t: "2026-11-24T03:06:05.180346919Z", tks: "S" },
  minuteBar: { c: 0.0565534, h: 0.0565534, l: 0.05651, n: 0, o: 0.05652165, t: "2026-11-24T06:03:00Z", v: 0, vw: 0.0565317 },
  prevDailyBar: { c: 0.05632995, h: 0.060804022, l: 0.054295, n: 18, o: 0.0552905, t: "2026-11-23T00:00:00Z", v: 123671.624370858, vw: 0.0584913901 },
};

/**
 * A stock snapshot, made up (there are no stock keys on the machine that wrote
 * this), its quote newer than its trade. The fields the adapter reads are the
 * ones production already prices AAPL from; the quote carries the keys of
 * Alpaca's stock quote, bp, ap and t among them, which a coin's row would read.
 */
const AAPL = {
  latestTrade: { t: "2026-11-23T20:59:58.123456789Z", x: "V", p: 349.74, s: 100, c: ["@"], i: 7421, z: "C" },
  latestQuote: { t: "2026-11-23T20:59:59.900000001Z", ax: "V", ap: 351.2, as: 2, bx: "V", bp: 350.8, bs: 3, c: ["R"], z: "C" },
  minuteBar: { t: "2026-11-23T20:59:00Z", o: 349.6, h: 349.8, l: 349.5, c: 349.74, v: 5120, n: 61, vw: 349.66 },
  dailyBar: { t: "2026-11-23T05:00:00Z", o: 344.1, h: 350.2, l: 343.6, c: 349.74, v: 912345, n: 10422, vw: 347.9 },
  prevDailyBar: { t: "2026-11-20T05:00:00Z", o: 341.0, h: 344.9, l: 340.2, c: 343.4, v: 801234, n: 9876, vw: 342.8 },
};

const sec = (t: string) => Math.floor(Date.parse(t) / 1000);

type Snap = Record<string, unknown>;
let calls: URL[] = [];

/** Answer every request from `handler`: a plain object as JSON, or a Response as it is. */
function respond(handler: (u: URL) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const u = new URL(String(input));
      calls.push(u);
      const body = handler(u);
      if (body instanceof Response) return body;
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    })
  );
}

async function load() {
  vi.resetModules();
  vi.stubEnv("ALPACA_KEY_ID", "PKTEST");
  vi.stubEnv("ALPACA_SECRET", "secret-test");
  return (await import("@/lib/market-data/alpaca")).alpaca;
}

/** The row Alpaca's adapter builds for one coin from one snapshot. */
async function rowFor(snap: Snap, sym = "BTC-USD", pair = "BTC/USD") {
  respond((u) => (u.pathname === "/v1beta3/crypto/us/snapshots" ? { snapshots: { [pair]: snap } } : {}));
  const alpaca = await load();
  const [row] = await alpaca.getQuotes([sym]);
  return row;
}

beforeEach(() => {
  calls = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("a coin's price follows its book between trades", () => {
  it("is the midpoint of the quote when the quote is newer than the trade", async () => {
    const row = await rowFor(BTC);
    expect(row.sym).toBe("BTC-USD");
    expect(row.last).toBeCloseTo(60391.166, 6);
    expect(row.last).toBe(BTC_MID);
    // The quote's time, not the trade's four seconds before it.
    expect(row.marketTime).toBe(sec("2026-11-24T06:03:53Z"));
    // The day's change is measured from the price shown.
    expect(row.chg).toBeCloseTo(60391.166 - 61194.841, 6);
    expect(row.chgPct).toBeCloseTo(((60391.166 - 61194.841) / 61194.841) * 100, 6);
    expect(row.marketState).toBe("REGULAR");
  });

  it("is the trade when the trade is newer than the quote", async () => {
    const row = await rowFor({
      ...BTC,
      latestTrade: { ...BTC.latestTrade, t: "2026-11-24T06:03:54.000000001Z" },
    });
    expect(row.last).toBe(60376.9);
    expect(row.marketTime).toBe(sec("2026-11-24T06:03:54Z"));
    expect(row.chg).toBeCloseTo(60376.9 - 61194.841, 6);
  });

  it("is the trade when both carry the same instant: the trade happened", async () => {
    const row = await rowFor({
      ...BTC,
      latestTrade: { ...BTC.latestTrade, t: BTC.latestQuote.t },
    });
    expect(row.last).toBe(60376.9);
    expect(row.marketTime).toBe(sec("2026-11-24T06:03:53Z"));
  });

  it("tells a quote from a trade inside one second", async () => {
    // 53.609 s against 53.610 s: the same second, the trade a millisecond newer.
    const newer = await rowFor({ ...BTC, latestTrade: { ...BTC.latestTrade, t: "2026-11-24T06:03:53.610Z" } });
    expect(newer.last).toBe(60376.9);
    const older = await rowFor({ ...BTC, latestTrade: { ...BTC.latestTrade, t: "2026-11-24T06:03:53.608Z" } });
    expect(older.last).toBe(BTC_MID);
  });

  it("no longer prices a coin at a trade three hours old", async () => {
    const row = await rowFor(DOGE, "DOGE-USD", "DOGE/USD");
    expect(row.last).toBeCloseTo(0.056559, 9);
    expect(row.last).not.toBe(0.0553446);
    expect(row.marketTime).toBe(sec("2026-11-24T06:04:14Z"));
    expect(row.marketTime! - sec(DOGE.latestTrade.t)).toBeGreaterThan(10_000);
  });

  it("moves when the book moves, though no trade prints", async () => {
    // What the live stream needs: it pushes a row only when `last` changes.
    const first = await rowFor(BTC);
    const second = await rowFor({
      ...BTC,
      latestQuote: { ap: 60398.7, as: 0.001003, bp: 60391.47, bs: 0.001003, t: "2026-11-24T06:04:27.1Z" },
    });
    expect(second.last).not.toBe(first.last);
    expect(second.last).toBeCloseTo(60395.085, 6);
    expect(second.marketTime!).toBeGreaterThan(first.marketTime!);
  });

  it("is the midpoint when no trade has printed at all", async () => {
    const { latestTrade: _none, ...quoted } = BTC;
    void _none;
    const row = await rowFor(quoted);
    expect(row.last).toBe(BTC_MID);
    expect(row.marketTime).toBe(sec("2026-11-24T06:03:53Z"));
  });
});

describe("a quote that is not a price leaves the trade standing", () => {
  const trade = { last: 60376.9, marketTime: sec("2026-11-24T06:03:49Z") };
  const q = BTC.latestQuote;
  const cases: [string, Snap["latestQuote"]][] = [
    ["no quote in the snapshot", undefined],
    ["an empty quote", {}],
    ["no bid", { ap: q.ap, as: q.as, t: q.t }],
    ["no ask", { bp: q.bp, bs: q.bs, t: q.t }],
    ["a bid of zero", { ...q, bp: 0, bs: 0 }],
    ["an ask of zero", { ...q, ap: 0, as: 0 }],
    ["a bid that is not a number", { ...q, bp: "n/a" }],
    ["a crossed book", { ...q, bp: 60400, ap: 60390 }],
    ["a book a fifth of its price wide", { ...q, bp: 54000, ap: 66000 }],
    ["a quote with no time, beside a dated trade", { ap: q.ap, as: q.as, bp: q.bp, bs: q.bs }],
  ];
  for (const [name, latestQuote] of cases) {
    it(name, async () => {
      const row = await rowFor({ ...BTC, latestQuote });
      expect(row.last).toBe(trade.last);
      expect(row.marketTime).toBe(trade.marketTime);
      expect(row.chg).toBeCloseTo(trade.last - 61194.841, 6);
    });
  }

  it("still reads a book as wide as the thinnest coin's (LTC, 0.65%)", async () => {
    const row = await rowFor(
      { ...BTC, latestQuote: { ap: 41.91, as: 67.26, bp: 41.64, bs: 68.019, t: "2026-11-24T06:04:11.112446987Z" }, latestTrade: { p: 41.29, s: 0.182929, t: "2026-11-24T03:30:14.527282352Z", tks: "B" } },
      "LTC-USD",
      "LTC/USD"
    );
    expect(row.last).toBeCloseTo(41.775, 9);
  });

  it("reads a locked book, bid equal to ask", async () => {
    const row = await rowFor({ ...BTC, latestQuote: { ...q, bp: 60390, ap: 60390 } });
    expect(row.last).toBe(60390);
  });

  it("falls to the day's bar when the snapshot has neither a trade nor a usable quote", async () => {
    const row = await rowFor({ dailyBar: BTC.dailyBar, prevDailyBar: BTC.prevDailyBar, latestQuote: { ...q, bp: 0 } });
    expect(row.last).toBe(60368.025);
    expect(row.marketTime).toBeNull();
  });

  it("uses an undated quote only when it is all there is", async () => {
    const row = await rowFor({ prevDailyBar: BTC.prevDailyBar, latestQuote: { ap: q.ap, bp: q.bp } });
    expect(row.last).toBe(BTC_MID);
    expect(row.marketTime).toBeNull();
  });
});

describe("a stock's row is still its last trade", () => {
  it("ignores the quote, however new", async () => {
    respond((u) => {
      if (u.pathname === "/v2/clock") return { is_open: false };
      if (u.pathname === "/v2/stocks/snapshots") return { AAPL };
      return {};
    });
    const alpaca = await load();
    const quotes = await alpaca.getQuotes(["AAPL"]);
    // The whole row, as the adapter built it before coins followed their book.
    expect(quotes).toEqual([
      {
        sym: "AAPL",
        last: 349.74,
        chg: 349.74 - 343.4,
        chgPct: ((349.74 - 343.4) / 343.4) * 100,
        marketState: "CLOSED",
        marketTime: sec("2026-11-23T20:59:58Z"),
      },
    ]);
    const req = calls.find((u) => u.pathname === "/v2/stocks/snapshots")!;
    expect(req.searchParams.get("symbols")).toBe("AAPL");
    expect(req.searchParams.get("feed")).toBe("iex");
  });

  it("and a coin beside it in the same batch follows its book", async () => {
    respond((u) => {
      if (u.pathname === "/v2/clock") return { is_open: true };
      if (u.pathname === "/v2/stocks/snapshots") return { AAPL };
      if (u.pathname === "/v1beta3/crypto/us/snapshots") return { snapshots: { "BTC/USD": BTC } };
      return {};
    });
    const alpaca = await load();
    const quotes = await alpaca.getQuotes(["AAPL", "BTC-USD"]);
    expect(quotes.map((r) => [r.sym, r.last, r.marketTime, r.marketState])).toEqual([
      ["AAPL", 349.74, sec("2026-11-23T20:59:58Z"), "REGULAR"],
      ["BTC-USD", BTC_MID, sec("2026-11-24T06:03:53Z"), "REGULAR"],
    ]);
  });

  it("keeps its bars' meta on the trade too", async () => {
    respond((u) => {
      if (u.pathname === "/v2/clock") return { is_open: false };
      if (u.pathname === "/v2/stocks/snapshots") return { AAPL };
      if (u.pathname.endsWith("/bars")) {
        return { bars: [{ t: "2026-11-23T20:59:00Z", o: 349.6, h: 349.8, l: 349.5, c: 349.7, v: 5120 }, { t: "2026-11-23T20:58:00Z", o: 349.4, h: 349.7, l: 349.3, c: 349.6, v: 4800 }] };
      }
      return {};
    });
    const alpaca = await load();
    const { meta } = await alpaca.getBars("AAPL", "1m");
    expect(meta.regularMarketPrice).toBe(349.74);
    expect(meta.regularMarketTime).toBe(sec("2026-11-23T20:59:58Z"));
    expect(meta.previousClose).toBe(343.4);
    expect(meta.marketState).toBe("CLOSED");
  });
});

describe("a coin's bars carry the price its row carries", () => {
  // Newest first, as asked for; the newest listed bar is the last whole minute.
  const BARS = [
    { t: "2026-11-24T06:02:00Z", o: 60456.4345, h: 60456.4345, l: 60352.05, c: 60368.025, v: 0.000037, n: 2, vw: 60412.16 },
    { t: "2026-11-24T06:01:00Z", o: 60440.1, h: 60461.2, l: 60431.5, c: 60455.9, v: 0, n: 0, vw: 0 },
    { t: "2026-11-24T06:00:00Z", o: 60420.3, h: 60444.0, l: 60410.25, c: 60440.1, v: 0, n: 0, vw: 0 },
  ];
  const lastBarStart = sec("2026-11-24T06:02:00Z");

  function serve(snapshot: (u: URL) => unknown) {
    respond((u) => {
      if (u.pathname === "/v1beta3/crypto/us/bars") return { bars: { "BTC/USD": BARS } };
      if (u.pathname === "/v1beta3/crypto/us/snapshots") return snapshot(u);
      return {};
    });
  }

  it("asks for the snapshot beside the bars and stamps the meta with its price and time", async () => {
    serve(() => ({ snapshots: { "BTC/USD": BTC } }));
    const alpaca = await load();
    const res = await alpaca.getBars("BTC-USD", "1m");

    expect(calls.map((u) => u.pathname)).toEqual(["/v1beta3/crypto/us/bars", "/v1beta3/crypto/us/snapshots"]);
    expect(calls[1].searchParams.get("symbols")).toBe("BTC/USD");

    expect(res.bars.map((b) => b.c)).toEqual([60440.1, 60455.9, 60368.025]);
    expect(res.meta.regularMarketPrice).toBe(BTC_MID);
    // Past the end of the newest listed bar, so the chart opens the minute in progress with it.
    expect(res.meta.regularMarketTime).toBe(sec("2026-11-24T06:03:53Z"));
    expect(res.meta.regularMarketTime!).toBeGreaterThanOrEqual(lastBarStart + 60);
    // Yesterday's close and today's volume, not the bar before and the last bar's.
    expect(res.meta.previousClose).toBe(61194.841);
    expect(res.meta.regularMarketVolume).toBe(0.549552363);
    expect(res.meta.marketState).toBe("REGULAR");
  });

  it("agrees with the quote row built from the same snapshot", async () => {
    serve(() => ({ snapshots: { "BTC/USD": BTC } }));
    const alpaca = await load();
    const [{ meta }, [row]] = await Promise.all([alpaca.getBars("BTC-USD", "1m"), alpaca.getQuotes(["BTC-USD"])]);
    expect(meta.regularMarketPrice).toBe(row.last);
    expect(meta.regularMarketTime).toBe(row.marketTime);
    expect(row.last - meta.previousClose!).toBe(row.chg);
  });

  it("serves the bars with their own close when the snapshot fails", async () => {
    serve(() => new Response("upstream down", { status: 503 }));
    const alpaca = await load();
    const res = await alpaca.getBars("BTC-USD", "1m");
    expect(res.bars).toHaveLength(3);
    expect(res.meta.regularMarketPrice).toBe(60368.025);
    expect(res.meta.regularMarketTime).toBe(lastBarStart);
    expect(res.meta.previousClose).toBe(60455.9);
    expect(res.meta.marketState).toBe("REGULAR");
  });

  it("gives up on a snapshot that outlasts its leash, and still serves the bars", async () => {
    // The snapshot only dresses the meta, so it waits less long than the bars
    // do. Here its leash is cut to 20 ms and the request never answers.
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    const asked: number[] = [];
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
      asked.push(ms);
      return timeout(ms < 6000 ? 20 : ms);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string | URL, init?: RequestInit) => {
        const u = new URL(String(input));
        calls.push(u);
        if (u.pathname === "/v1beta3/crypto/us/snapshots") {
          return new Promise<Response>((_, reject) => {
            init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason));
          });
        }
        return Promise.resolve(new Response(JSON.stringify({ bars: { "BTC/USD": BARS } }), { status: 200 }));
      })
    );
    const alpaca = await load();
    const res = await alpaca.getBars("BTC-USD", "1m");
    expect(res.bars).toHaveLength(3);
    expect(res.meta.regularMarketPrice).toBe(60368.025);
    expect(res.meta.regularMarketTime).toBe(lastBarStart);
    // Bars first, on the adapter's usual six seconds; the snapshot on less.
    expect(asked).toHaveLength(2);
    expect(asked[0]).toBe(6000);
    expect(asked[1]).toBeLessThan(asked[0]);
  });

  it("serves the bars when the snapshot has no such pair", async () => {
    serve(() => ({ snapshots: {} }));
    const alpaca = await load();
    const res = await alpaca.getBars("BTC-USD", "1m");
    expect(res.meta.regularMarketPrice).toBe(60368.025);
    expect(res.meta.regularMarketTime).toBe(lastBarStart);
  });

  it("never lets an old trade stand in for bars that moved on quotes", async () => {
    // The book is one-sided, so the snapshot's only price is a trade from
    // before these bars. Folded into the chart it would drag the last candle
    // back; the bars' own close stands, and the day's figures still come through.
    serve(() => ({
      snapshots: {
        "BTC/USD": {
          ...BTC,
          latestQuote: { ...BTC.latestQuote, bp: 0, bs: 0 },
          latestTrade: { ...BTC.latestTrade, p: 60111, t: "2026-11-24T05:41:07.5Z" },
        },
      },
    }));
    const alpaca = await load();
    const res = await alpaca.getBars("BTC-USD", "1m");
    expect(res.meta.regularMarketPrice).toBe(60368.025);
    expect(res.meta.regularMarketTime).toBe(lastBarStart);
    expect(res.meta.previousClose).toBe(61194.841);
    // The row, with nothing else to show, is still that trade, at its own time.
    const [row] = await alpaca.getQuotes(["BTC-USD"]);
    expect(row.last).toBe(60111);
    expect(row.marketTime).toBe(sec("2026-11-24T05:41:07Z"));
  });

  it("uses the trade when it is the newest thing on the venue", async () => {
    serve(() => ({
      snapshots: { "BTC/USD": { ...BTC, latestTrade: { ...BTC.latestTrade, t: "2026-11-24T06:03:54.2Z" } } },
    }));
    const alpaca = await load();
    const res = await alpaca.getBars("BTC-USD", "1m");
    expect(res.meta.regularMarketPrice).toBe(60376.9);
    expect(res.meta.regularMarketTime).toBe(sec("2026-11-24T06:03:54Z"));
  });

  it("still fails without bars, whatever the snapshot says", async () => {
    respond((u) => (u.pathname === "/v1beta3/crypto/us/snapshots" ? { snapshots: { "BTC/USD": BTC } } : { bars: { "BTC/USD": [BARS[0]] } }));
    const alpaca = await load();
    await expect(alpaca.getBars("BTC-USD", "1m")).rejects.toThrow("alpaca: no crypto bars");
  });
});

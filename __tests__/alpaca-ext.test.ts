import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Outside the regular session the Alpaca adapter asks a second feed for the
// price of the stretch that is on, and puts it beside the row as `ext`
// (lib/market-data/us-extended.ts). The row's own fields do not change.
// Alpaca is faked; the clock is pinned, because which feed is asked depends on
// the time in New York (UTC-5 in November 2026; the 23rd is a Monday).

let calls: URL[] = [];
function respond(handler: (u: URL) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const u = new URL(String(input));
      calls.push(u);
      const body = await handler(u);
      if (body instanceof Response) return body;
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    })
  );
}
async function load(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("ALPACA_KEY_ID", "PKTEST");
  vi.stubEnv("ALPACA_SECRET", "secret-test");
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return (await import("@/lib/market-data/alpaca")).alpaca;
}
const at = (iso: string) => new Date(iso).getTime();
const sec = (iso: string) => Math.floor(at(iso) / 1000);
const setNow = (iso: string) => vi.setSystemTime(at(iso));
const snapshotFeeds = () => calls.filter((u) => u.pathname === "/v2/stocks/snapshots").map((u) => u.searchParams.get("feed"));

beforeEach(() => {
  calls = [];
  vi.useFakeTimers({ toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const IEX = {
  latestTrade: { t: "2026-11-23T21:49:01Z", p: 164.85 },
  dailyBar: { t: "2026-11-23T05:00:00Z", c: 165.185 },
  prevDailyBar: { t: "2026-11-20T05:00:00Z", c: 125.65 },
};
const NIGHT = {
  latestQuote: { t: "2026-11-24T07:16:40Z", bp: 163.6, ap: 163.72 },
  latestTrade: { t: "2026-11-24T07:01:30Z", p: 163.7 },
};
/** The late tape: the official closes, and its newest trade (Monday 19:59 unless a case says otherwise). */
const DAYS = { dailyBar: { t: "2026-11-23T05:00:00Z", c: 165.05 }, prevDailyBar: { t: "2026-11-20T05:00:00Z", c: 125.53 } };
const TAPE = { ...DAYS, latestTrade: { t: "2026-11-24T00:59:58Z", p: 166.4 } };
const TAPE_PRE = { ...DAYS, latestTrade: { t: "2026-11-24T11:41:47Z", p: 157 } };
const OFFICIAL = { close: 165.05, prevClose: 125.53 };

/** Alpaca with the market shut: each feed answers with its own snapshot. */
const shut = (bySymbol: Record<string, Record<string, unknown>> = {}) => (u: URL) => {
  if (u.pathname === "/v2/clock") return { is_open: false };
  if (u.pathname === "/v2/stocks/snapshots") {
    const feed = u.searchParams.get("feed") ?? "";
    const out: Record<string, unknown> = {};
    for (const s of (u.searchParams.get("symbols") ?? "").split(",")) {
      const snap = (bySymbol[s] ?? { iex: IEX, overnight: NIGHT, delayed_sip: TAPE })[feed];
      if (snap) out[s] = snap;
    }
    return out;
  }
  if (u.pathname === "/v1beta3/crypto/us/snapshots") {
    return { snapshots: { "BTC/USD": { latestTrade: { t: "2026-11-24T07:16:41Z", p: 60390 }, prevDailyBar: { c: 60000 } } } };
  }
  return {};
};

describe("a stock's row while the regular session is shut", () => {
  it("overnight: asks the overnight feed beside the site's own, and adds the night's price", async () => {
    setNow("2026-11-24T07:16:42Z"); // 02:16 in New York
    respond(shut());
    const alpaca = await load();
    const [row] = await alpaca.getQuotes(["NVDA"]);

    expect(snapshotFeeds()).toEqual(["iex", "delayed_sip", "overnight"]);
    expect(calls[0].pathname).toBe("/v2/clock"); // the clock first: it decides what else is asked
    expect(calls.filter((u) => u.pathname === "/v2/stocks/snapshots").every((u) => u.searchParams.get("symbols") === "NVDA")).toBe(true);
    expect(row).toEqual({
      sym: "NVDA",
      // the row itself is what it was: the last trade on the site's own feed
      last: 164.85,
      chg: 164.85 - 125.65,
      chgPct: ((164.85 - 125.65) / 125.65) * 100,
      marketState: "CLOSED",
      marketTime: sec("2026-11-23T21:49:01Z"),
      ext: {
        ...OFFICIAL, // the tape's close, not the one exchange's 165.185
        now: { session: "overnight", price: 163.66, time: sec("2026-11-24T07:16:40Z"), basis: "indicative" },
      },
    });
  });

  it("before the open: asks the delayed tape", async () => {
    setNow("2026-11-24T11:56:49Z"); // 06:56
    respond(shut({ NVDA: { iex: IEX, delayed_sip: TAPE_PRE } }));
    const alpaca = await load();
    const [row] = await alpaca.getQuotes(["NVDA"]);
    expect(snapshotFeeds()).toEqual(["iex", "delayed_sip"]);
    expect(row.ext).toEqual({ ...OFFICIAL, now: { session: "pre", price: 157, time: sec("2026-11-24T11:41:47Z"), basis: "delayed" } });
    expect(row.last).toBe(164.85);
  });

  it("the delayed tape is asked once in fifteen seconds, the site's own feed every time", async () => {
    setNow("2026-11-24T11:56:49Z");
    const both = { iex: IEX, delayed_sip: TAPE_PRE };
    respond(shut({ NVDA: both, AAPL: both }));
    const alpaca = await load();
    await alpaca.getQuotes(["NVDA", "AAPL"]);
    setNow("2026-11-24T11:56:53Z");
    await alpaca.getQuotes(["AAPL", "NVDA"]); // the same list, another order
    setNow("2026-11-24T11:56:57Z");
    const rows = await alpaca.getQuotes(["NVDA", "AAPL"]);
    expect(snapshotFeeds().filter((f) => f === "iex")).toHaveLength(3);
    expect(snapshotFeeds().filter((f) => f === "delayed_sip")).toHaveLength(1);
    expect(rows.map((r) => r.ext?.now?.price)).toEqual([157, 157]); // the kept answer still serves both

    setNow("2026-11-24T11:57:05Z"); // sixteen seconds after the first
    await alpaca.getQuotes(["NVDA", "AAPL"]);
    expect(snapshotFeeds().filter((f) => f === "delayed_sip")).toHaveLength(2);
  });

  it("the overnight feed, whose quotes are live, is asked every time", async () => {
    setNow("2026-11-24T07:16:42Z");
    respond(shut());
    const alpaca = await load();
    await alpaca.getQuotes(["NVDA"]);
    setNow("2026-11-24T07:16:45Z");
    await alpaca.getQuotes(["NVDA"]);
    expect(snapshotFeeds().filter((f) => f === "overnight")).toHaveLength(2);
    expect(snapshotFeeds().filter((f) => f === "delayed_sip")).toHaveLength(1); // the tape, kept
  });

  it("with the session open, asks nothing more and adds nothing", async () => {
    setNow("2026-11-23T15:00:00Z"); // Monday 10:00
    respond((u) => (u.pathname === "/v2/clock" ? { is_open: true } : shut()(u)));
    const alpaca = await load();
    const [row] = await alpaca.getQuotes(["NVDA"]);
    expect(snapshotFeeds()).toEqual(["iex"]);
    expect(row.marketState).toBe("REGULAR");
    expect("ext" in row).toBe(false);
  });

  it("on a holiday the clock says shut in the middle of the day: the official close, and no session", async () => {
    setNow("2026-11-26T16:00:00Z"); // Thanksgiving, 11:00
    respond(shut());
    const alpaca = await load();
    const [row] = await alpaca.getQuotes(["NVDA"]);
    expect(snapshotFeeds()).toEqual(["iex", "delayed_sip"]);
    expect(row.ext).toEqual(OFFICIAL);
  });

  it("a plan that refuses the feed costs the row only the session's price, and is left alone for ten minutes", async () => {
    setNow("2026-11-24T07:16:42Z");
    respond((u) => {
      if (u.pathname === "/v2/stocks/snapshots" && u.searchParams.get("feed") === "overnight") {
        return new Response(JSON.stringify({ message: "subscription does not permit querying overnight data" }), { status: 403 });
      }
      return shut()(u);
    });
    const alpaca = await load();
    const [row] = await alpaca.getQuotes(["NVDA"]);
    expect(row.last).toBe(164.85);
    expect(row.ext).toEqual(OFFICIAL);

    setNow("2026-11-24T07:20:00Z");
    await alpaca.getQuotes(["NVDA"]);
    expect(snapshotFeeds().filter((f) => f === "overnight")).toHaveLength(1);

    setNow("2026-11-24T07:27:00Z"); // more than ten minutes on
    await alpaca.getQuotes(["NVDA"]);
    expect(snapshotFeeds().filter((f) => f === "overnight")).toHaveLength(2);
  });

  it("a feed that fails for another reason is asked again next time", async () => {
    setNow("2026-11-24T07:16:42Z");
    let fail = true;
    respond((u) => {
      if (u.pathname === "/v2/stocks/snapshots" && u.searchParams.get("feed") === "overnight" && fail) {
        return new Response("bad gateway", { status: 502 });
      }
      return shut()(u);
    });
    const alpaca = await load();
    const [first] = await alpaca.getQuotes(["NVDA"]);
    expect(first.ext).toEqual(OFFICIAL);
    fail = false;
    setNow("2026-11-24T07:16:46Z");
    const [second] = await alpaca.getQuotes(["NVDA"]);
    expect(second.ext?.now?.basis).toBe("indicative");
  });

  it("one failed call does not cost the row its price: the last answer stands for a minute, then is let go", async () => {
    setNow("2026-11-24T07:16:42Z");
    let fail = false;
    respond((u) => {
      if (u.pathname === "/v2/stocks/snapshots" && u.searchParams.get("feed") === "overnight" && fail) {
        return new Response("bad gateway", { status: 502 });
      }
      return shut()(u);
    });
    const alpaca = await load();
    const [first] = await alpaca.getQuotes(["NVDA"]);
    expect(first.ext?.now?.price).toBe(163.66);

    fail = true;
    setNow("2026-11-24T07:16:45Z");
    const [second] = await alpaca.getQuotes(["NVDA"]);
    expect(snapshotFeeds().filter((f) => f === "overnight")).toHaveLength(2); // it was asked, and failed
    expect(second.ext).toEqual(first.ext); // the same price with the same time: the row does not blink

    setNow("2026-11-24T07:17:50Z"); // over a minute since it last answered
    const [third] = await alpaca.getQuotes(["NVDA"]);
    expect(third.ext).toEqual(OFFICIAL);

    fail = false;
    setNow("2026-11-24T07:17:54Z");
    const [fourth] = await alpaca.getQuotes(["NVDA"]);
    expect(fourth.ext).toEqual(first.ext);
  });

  it("the tape failing once does not move the close", async () => {
    setNow("2026-11-24T11:56:49Z"); // 06:56
    let fail = false;
    respond((u) => {
      if (u.pathname === "/v2/stocks/snapshots" && u.searchParams.get("feed") === "delayed_sip" && fail) {
        return new Response("down", { status: 502 });
      }
      return shut({ NVDA: { iex: IEX, delayed_sip: TAPE_PRE } })(u);
    });
    const alpaca = await load();
    const [first] = await alpaca.getQuotes(["NVDA"]);
    expect(first.ext?.close).toBe(165.05);

    fail = true;
    setNow("2026-11-24T11:57:06Z"); // past the fifteen seconds: asked again, and it fails
    const [second] = await alpaca.getQuotes(["NVDA"]);
    expect(snapshotFeeds().filter((f) => f === "delayed_sip")).toHaveLength(2);
    expect(second.ext).toEqual(first.ext); // not the one exchange's 165.185 for a quarter of a minute
  });

  it("a refusal is an answer, not a failure: nothing is held over it", async () => {
    setNow("2026-11-24T07:16:42Z");
    let refuse = false;
    respond((u) => {
      if (u.pathname === "/v2/stocks/snapshots" && u.searchParams.get("feed") === "overnight" && refuse) {
        return new Response(JSON.stringify({ message: "subscription does not permit querying overnight data" }), { status: 403 });
      }
      return shut()(u);
    });
    const alpaca = await load();
    const [first] = await alpaca.getQuotes(["NVDA"]);
    expect(first.ext?.now?.price).toBe(163.66);

    refuse = true;
    setNow("2026-11-24T07:16:45Z");
    const [second] = await alpaca.getQuotes(["NVDA"]);
    expect(second.ext).toEqual(OFFICIAL);
  });

  it("a plan that refuses the tape still gets a close, the one exchange's own", async () => {
    setNow("2026-11-24T07:16:42Z");
    respond((u) => {
      if (u.pathname === "/v2/stocks/snapshots" && u.searchParams.get("feed") === "delayed_sip") {
        return new Response(JSON.stringify({ message: "subscription does not permit querying recent SIP data" }), { status: 403 });
      }
      return shut()(u);
    });
    const alpaca = await load();
    const [row] = await alpaca.getQuotes(["NVDA"]);
    expect(row.ext).toEqual({
      close: 165.185,
      prevClose: 125.65,
      now: { session: "overnight", price: 163.66, time: sec("2026-11-24T07:16:40Z"), basis: "indicative" },
    });
  });

  it("before the open, the row's own change is measured from yesterday's close, not the one before", async () => {
    // 08:10 on Tuesday. The newest daily bar is still Monday's, and the trade is this morning's.
    setNow("2026-11-24T13:10:00Z");
    const iex = { ...IEX, latestTrade: { t: "2026-11-24T13:09:55Z", p: 156.66 } };
    respond(shut({ NVDA: { iex, delayed_sip: { ...DAYS, latestTrade: { t: "2026-11-24T12:54:58Z", p: 157.1 } } } }));
    const alpaca = await load();
    const [row] = await alpaca.getQuotes(["NVDA"]);
    expect(row.last).toBe(156.66);
    expect(row.chg).toBeCloseTo(156.66 - 165.05, 9); // it read +31.01, against Friday's 125.65
    expect(row.chgPct).toBeCloseTo(((156.66 - 165.05) / 165.05) * 100, 9);
    expect(row.ext?.now).toEqual({ session: "pre", price: 156.66, time: sec("2026-11-24T13:09:55Z"), basis: "trade" });
  });

  it("and from the one exchange's own close when the tape did not answer", async () => {
    setNow("2026-11-24T13:10:00Z");
    const iex = { ...IEX, latestTrade: { t: "2026-11-24T13:09:55Z", p: 156.66 } };
    respond((u) => (u.searchParams.get("feed") === "delayed_sip" ? new Response("down", { status: 502 }) : shut({ NVDA: { iex } })(u)));
    const alpaca = await load();
    const [row] = await alpaca.getQuotes(["NVDA"]);
    expect(row.chg).toBeCloseTo(156.66 - 165.185, 9);
  });

  it("a trade from the session's own day keeps the change it always had", async () => {
    setNow("2026-11-24T07:16:42Z"); // the night after: the last trade is Monday's after-hours print
    respond(shut());
    const alpaca = await load();
    const [row] = await alpaca.getQuotes(["NVDA"]);
    expect(row.chg).toBeCloseTo(164.85 - 125.65, 9);
  });

  it("a coin beside it has no session to be outside of", async () => {
    setNow("2026-11-24T07:16:42Z");
    respond(shut());
    const alpaca = await load();
    const rows = await alpaca.getQuotes(["NVDA", "BTC-USD"]);
    const btc = rows.find((r) => r.sym === "BTC-USD")!;
    expect(btc.last).toBe(60390);
    expect("ext" in btc).toBe(false);
    expect(rows.find((r) => r.sym === "NVDA")?.ext?.now?.session).toBe("overnight");
  });

  it("coins alone ask no stock feed at all", async () => {
    setNow("2026-11-24T07:16:42Z");
    respond(shut());
    const alpaca = await load();
    await alpaca.getQuotes(["BTC-USD"]);
    expect(snapshotFeeds()).toEqual([]);
    expect(calls.some((u) => u.pathname === "/v2/clock")).toBe(false);
  });

  it("on the full tape (a paid plan) the main feed already carries the hours before the open", async () => {
    setNow("2026-11-24T13:10:00Z"); // 08:10
    const sip = { ...IEX, latestTrade: { t: "2026-11-24T13:09:58Z", p: 157.4 } };
    respond(shut({ NVDA: { sip, overnight: NIGHT } }));
    const alpaca = await load({ ALPACA_FEED: "sip" });
    const [row] = await alpaca.getQuotes(["NVDA"]);
    expect(snapshotFeeds()).toEqual(["sip"]);
    expect(row.ext?.now).toEqual({ session: "pre", price: 157.4, time: sec("2026-11-24T13:09:58Z"), basis: "trade" });

    setNow("2026-11-25T07:16:42Z"); // the next night: the overnight venue is still its own feed
    calls = [];
    await alpaca.getQuotes(["NVDA"]);
    expect(snapshotFeeds()).toEqual(["sip", "overnight"]);
  });

  it("when Alpaca's clock does not answer, New York's own clock decides", async () => {
    setNow("2026-11-24T07:16:42Z");
    respond((u) => (u.pathname === "/v2/clock" ? new Response("down", { status: 503 }) : shut()(u)));
    const alpaca = await load();
    const [row] = await alpaca.getQuotes(["NVDA"]);
    expect(row.marketState).toBeUndefined();
    expect(row.ext?.now?.session).toBe("overnight");
  });
});

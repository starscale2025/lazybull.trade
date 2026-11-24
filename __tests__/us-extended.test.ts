import { describe, expect, it } from "vitest";
import { extFeeds, extOf } from "@/lib/market-data/us-extended";
import { nyDate, sessionStart } from "@/lib/market-data/us-session";

// A US stock's price while its regular session is shut. The snapshots below
// are NVDA's as /api/status/overnight reported them from the live site on
// 24 Nov 2026 (a Tuesday; New York is UTC-5), with prices added where a case
// needs a moment the report did not catch.

const at = (iso: string) => new Date(iso).getTime();
const sec = (iso: string) => Math.floor(at(iso) / 1000);

/** The site's own feed (IEX) on Tuesday morning: Monday's session, and one odd lot after its close. */
const IEX = {
  latestQuote: { t: "2026-11-23T21:00:02Z", bp: 155.74, bs: 100, ap: 0, as: 0 },
  latestTrade: { t: "2026-11-23T21:49:01Z", p: 164.85, s: 100 },
  dailyBar: { t: "2026-11-23T05:00:00Z", o: 167.03, h: 171.47, l: 156.96, c: 165.185, v: 21130783 },
  prevDailyBar: { t: "2026-11-20T05:00:00Z", o: 143.52, h: 143.72, l: 124.51, c: 125.65, v: 17679388 },
};
/** The late tape's daily bars: the official closes. */
const DAYS = {
  dailyBar: { t: "2026-11-23T05:00:00Z", o: 167.035, h: 171.5, l: 156.93, c: 165.05, v: 784193070 },
  prevDailyBar: { t: "2026-11-20T05:00:00Z", o: 143.52, h: 143.725, l: 124.5, c: 125.53, v: 637417722 },
};
/** The tape through the night: nothing since Monday's after-hours ended at 20:00. */
const TAPE_NIGHT = { ...DAYS, latestTrade: { t: "2026-11-24T00:59:58Z", p: 166.4 } };
/** The tape at 06:56 on Tuesday, as the check read it: fifteen minutes behind. */
const TAPE_PRE = { ...DAYS, latestTrade: { t: "2026-11-24T11:41:47Z", p: 157 }, latestQuote: { t: "2026-11-24T11:41:49Z", bp: 156.96, ap: 157.06 } };
const OFFICIAL = { close: 165.05, prevClose: 125.53 };

describe("extFeeds", () => {
  it("asks the late tape whenever the session is shut, and the overnight venue during its hours", () => {
    expect(extFeeds(at("2026-11-24T07:16:42Z"), "iex")).toEqual({ tape: "delayed_sip", night: "overnight" }); // 02:16
    expect(extFeeds(at("2026-11-24T11:56:49Z"), "iex")).toEqual({ tape: "delayed_sip", night: null }); // 06:56
    expect(extFeeds(at("2026-11-23T21:50:00Z"), "iex")).toEqual({ tape: "delayed_sip", night: null }); // 16:50
    expect(extFeeds(at("2026-11-28T17:00:00Z"), "iex")).toEqual({ tape: "delayed_sip", night: null }); // Saturday
    expect(extFeeds(at("2026-11-26T16:00:00Z"), "iex")).toEqual({ tape: "delayed_sip", night: null }); // a holiday's midday
  });

  it("keeps asking the overnight venue for pre-market's first quarter of an hour", () => {
    expect(extFeeds(at("2026-11-24T09:05:00Z"), "iex").night).toBe("overnight"); // 04:05
    expect(extFeeds(at("2026-11-24T09:15:59Z"), "iex").night).toBe("overnight");
    expect(extFeeds(at("2026-11-24T09:16:00Z"), "iex").night).toBeNull(); // 04:16: the tape has reached 04:00
  });

  it("needs no second tape when the main feed is the tape already", () => {
    expect(extFeeds(at("2026-11-24T11:56:49Z"), "sip")).toEqual({ tape: null, night: null });
    expect(extFeeds(at("2026-11-24T07:16:42Z"), "sip")).toEqual({ tape: null, night: "overnight" });
  });
});

describe("sessionStart", () => {
  it("is when the current stretch began, in New York", () => {
    expect(sessionStart(at("2026-11-24T11:56:49Z"))).toBe(at("2026-11-24T09:00:00Z")); // pre-market, from 04:00
    expect(sessionStart(at("2026-11-23T15:00:30Z"))).toBe(at("2026-11-23T14:30:00Z")); // regular, from 09:30
    expect(sessionStart(at("2026-11-23T21:50:00Z"))).toBe(at("2026-11-23T21:00:00Z")); // after-hours, from 16:00
    expect(sessionStart(at("2026-11-24T02:10:00Z"))).toBe(at("2026-11-24T01:00:00Z")); // 21:10: the night, from 20:00
    expect(sessionStart(at("2026-11-24T07:16:42Z"))).toBe(at("2026-11-24T01:00:00Z")); // 02:16: still last evening's
  });

  it("has no start while the market is closed", () => {
    expect(sessionStart(at("2026-11-28T17:00:00Z"))).toBeUndefined(); // Saturday noon
  });

  it("reads New York's date across the UTC midnight", () => {
    expect(nyDate(at("2026-11-24T03:00:00Z"))).toBe("2026-11-23");
    expect(nyDate(at("2026-11-24T05:00:00Z"))).toBe("2026-11-24");
  });
});

describe("extOf: the close", () => {
  it("is the tape's, the official one, with the official close before it", () => {
    expect(extOf(IEX, TAPE_NIGHT, null, at("2026-11-28T17:00:00Z"))).toEqual(OFFICIAL); // a Saturday
  });

  it("is the site's own feed's when the tape did not answer", () => {
    expect(extOf(IEX, null, null, at("2026-11-28T17:00:00Z"))).toEqual({ close: 165.185, prevClose: 125.65 });
  });

  it("for a quarter of an hour after the bell is the site's own: the tape's day is still forming", () => {
    // Monday 16:05. The tape, fifteen minutes behind, has the day as of 15:50.
    const tape = { ...DAYS, dailyBar: { ...DAYS.dailyBar, c: 164.4 }, latestTrade: { t: "2026-11-23T20:49:50Z", p: 164.4 } };
    expect(extOf(IEX, tape, null, at("2026-11-23T21:05:00Z"))).toMatchObject({ close: 165.185, prevClose: 125.65 });
    // 16:16: the tape has got past the bell
    expect(extOf(IEX, TAPE_NIGHT, null, at("2026-11-23T21:16:00Z"))).toMatchObject(OFFICIAL);
  });

  it("on a half day's afternoon is the site's own until the tape's day is done", () => {
    // Fri 27 Nov 2026 shuts at 13:00. At 13:05 New York's clock still says "regular".
    const fri = { t: "2026-11-27T05:00:00Z" };
    const iex = { dailyBar: { ...fri, c: 158.9 }, prevDailyBar: { c: 158.4 }, latestTrade: { t: "2026-11-27T17:59:59Z", p: 158.9 } };
    const tape = { dailyBar: { ...fri, c: 158.2 }, prevDailyBar: { c: 158.31 } };
    expect(extOf(iex, tape, null, at("2026-11-27T18:05:00Z"))).toEqual({ close: 158.9, prevClose: 158.4 });
  });

  it("on a holiday is the last session's official close all day", () => {
    // Thanksgiving, Thu 26 Nov 2026, 11:00. The tape's newest day is Wednesday's, long finished.
    const tape = { dailyBar: { t: "2026-11-25T05:00:00Z", c: 158.31 }, prevDailyBar: { c: 157.8 }, latestTrade: { t: "2026-11-26T00:59:40Z", p: 158.1 } };
    const iex = { dailyBar: { t: "2026-11-25T05:00:00Z", c: 158.4 }, prevDailyBar: { c: 157.9 } };
    expect(extOf(iex, tape, null, at("2026-11-26T16:00:00Z"))).toEqual({ close: 158.31, prevClose: 157.8 });
  });

  it("before the open, a daily bar dated today is not a close: the one before it is", () => {
    const early = { dailyBar: { t: "2026-11-24T05:00:00Z", c: 157.3 }, prevDailyBar: { t: "2026-11-23T05:00:00Z", c: 165.05 } };
    expect(extOf(IEX, early, null, at("2026-11-24T13:10:00Z"))).toEqual({ close: 165.05, prevClose: null }); // 08:10
    expect(extOf(IEX, early, null, at("2026-11-24T07:00:00Z"))).toEqual({ close: 165.05, prevClose: null }); // 02:00
    // and the same for the site's own feed when it is all there is
    const own = { ...IEX, dailyBar: { t: "2026-11-24T05:00:00Z", c: 157.3 }, prevDailyBar: { t: "2026-11-23T05:00:00Z", c: 165.185 } };
    expect(extOf(own, null, null, at("2026-11-24T13:10:00Z"))).toEqual({ close: 165.185, prevClose: null });
  });

  it("after the close, a daily bar dated today is the close, into the night", () => {
    const tue = { dailyBar: { t: "2026-11-24T05:00:00Z", c: 158.31 }, prevDailyBar: { t: "2026-11-23T05:00:00Z", c: 165.05 } };
    expect(extOf(IEX, tue, null, at("2026-11-24T22:00:00Z"))?.close).toBe(158.31); // 17:00
    expect(extOf(IEX, tue, null, at("2026-11-25T02:00:00Z"))?.close).toBe(158.31); // 21:00
    expect(extOf(IEX, tue, null, at("2026-11-25T07:00:00Z"))?.close).toBe(158.31); // 02:00 on Wednesday
  });

  it("says nothing without a daily bar to take a close from", () => {
    expect(extOf({ latestTrade: IEX.latestTrade }, null, null, at("2026-11-24T07:16:42Z"))).toBeUndefined();
    expect(extOf(null, null, null, at("2026-11-24T07:16:42Z"))).toBeUndefined();
  });
});

describe("extOf: the price of the stretch that is on", () => {
  const NIGHT = {
    latestQuote: { t: "2026-11-24T07:16:40Z", bp: 163.6, ap: 163.72 },
    latestTrade: { t: "2026-11-24T07:01:30Z", p: 163.7 }, // trades run fifteen minutes behind
  };

  it("overnight: the midpoint of a live, tight quote, called indicative", () => {
    expect(extOf(IEX, TAPE_NIGHT, NIGHT, at("2026-11-24T07:16:42Z"))).toEqual({
      ...OFFICIAL,
      now: { session: "overnight", price: 163.66, time: sec("2026-11-24T07:16:40Z"), basis: "indicative" },
    });
  });

  it("overnight: a quote too wide to mean anything gives way to the last trade", () => {
    // the night's real last quote, 1.7% wide, moved a second inside the session
    const night = {
      latestQuote: { t: "2026-11-24T08:59:57Z", bp: 158.76, ap: 161.47 },
      latestTrade: { t: "2026-11-24T08:44:51Z", p: 161.34 },
    };
    expect(extOf(IEX, TAPE_NIGHT, night, at("2026-11-24T08:59:58Z"))?.now).toEqual({
      session: "overnight", price: 161.34, time: sec("2026-11-24T08:44:51Z"), basis: "delayed",
    });
  });

  it("overnight: a one-sided or crossed quote is not a price", () => {
    const now = at("2026-11-24T07:16:42Z");
    for (const latestQuote of [
      { t: "2026-11-24T07:16:40Z", bp: 163.6, ap: 0 },
      { t: "2026-11-24T07:16:40Z", bp: 0, ap: 163.72 },
      { t: "2026-11-24T07:16:40Z", bp: 163.9, ap: 163.6 },
    ]) {
      expect(extOf(IEX, TAPE_NIGHT, { ...NIGHT, latestQuote }, now)?.now?.basis).toBe("delayed");
    }
  });

  it("overnight: just after 20:00, the evening's last print stands until the night has a price", () => {
    // Monday 20:05. The tape is at 19:50, still in after-hours.
    const tape = { ...DAYS, latestTrade: { t: "2026-11-24T00:50:10Z", p: 166.2 } };
    expect(extOf(IEX, tape, {}, at("2026-11-24T01:05:00Z"))?.now).toEqual({
      session: "post", price: 166.2, time: sec("2026-11-24T00:50:10Z"), basis: "delayed",
    });
    // and gives way the moment the night is quoted
    const night = { latestQuote: { t: "2026-11-24T01:04:58Z", bp: 166.8, ap: 166.9 } };
    expect(extOf(IEX, tape, night, at("2026-11-24T01:05:00Z"))?.now).toMatchObject({ session: "overnight", price: 166.85, basis: "indicative" });
  });

  it("before the open: the full tape, fifteen minutes late (the check's own reading)", () => {
    expect(extOf(IEX, TAPE_PRE, null, at("2026-11-24T11:56:49Z"))).toEqual({
      ...OFFICIAL,
      now: { session: "pre", price: 157, time: sec("2026-11-24T11:41:47Z"), basis: "delayed" },
    });
  });

  it("before the open: a live trade on the site's own exchange beats the late tape", () => {
    const iex = { ...IEX, latestTrade: { t: "2026-11-24T13:09:55Z", p: 157.42 } }; // 08:09:55, IEX is open
    const tape = { ...DAYS, latestTrade: { t: "2026-11-24T12:54:58Z", p: 157.1 } };
    expect(extOf(iex, tape, null, at("2026-11-24T13:10:00Z"))?.now).toEqual({
      session: "pre", price: 157.42, time: sec("2026-11-24T13:09:55Z"), basis: "trade",
    });
  });

  it("at 04:05 the night's last price still stands, under its own name", () => {
    // The tape, fifteen minutes behind, has nothing from pre-market yet.
    const night = {
      latestQuote: { t: "2026-11-24T09:00:00.377Z", bp: 158.76, ap: 161.47 }, // the real closing quote: too wide
      latestTrade: { t: "2026-11-24T08:59:51Z", p: 161.34 },
    };
    expect(extOf(IEX, TAPE_NIGHT, night, at("2026-11-24T09:05:00Z"))?.now).toEqual({
      session: "overnight", price: 161.34, time: sec("2026-11-24T08:59:51Z"), basis: "delayed",
    });
    // 04:17: the tape has reached pre-market and takes over
    const tape = { ...DAYS, latestTrade: { t: "2026-11-24T09:01:10Z", p: 160.9 } };
    expect(extOf(IEX, tape, null, at("2026-11-24T09:17:00Z"))?.now).toEqual({
      session: "pre", price: 160.9, time: sec("2026-11-24T09:01:10Z"), basis: "delayed",
    });
  });

  it("after the close: the late print on the site's own exchange is the price", () => {
    const tape = { ...DAYS, latestTrade: { t: "2026-11-23T21:34:59Z", p: 165.02 } };
    expect(extOf(IEX, tape, null, at("2026-11-23T21:50:00Z"))).toEqual({
      ...OFFICIAL,
      now: { session: "post", price: 164.85, time: sec("2026-11-23T21:49:01Z"), basis: "trade" },
    });
  });

  it("a print from inside the regular session is never the price since", () => {
    // Monday 16:05: the tape's newest trade is from 15:50, and nothing has printed after the bell.
    const tape = { ...DAYS, latestTrade: { t: "2026-11-23T20:49:50Z", p: 164.4 } };
    const iex = { ...IEX, latestTrade: { t: "2026-11-23T20:59:58Z", p: 165.25 } };
    expect(extOf(iex, tape, null, at("2026-11-23T21:05:00Z"))?.now).toBeUndefined();
  });

  it("yesterday's after-hours print is not this morning's price", () => {
    // 04:30 on Tuesday, a stock nobody has traded before the open
    expect(extOf(IEX, TAPE_NIGHT, null, at("2026-11-24T09:30:00Z"))).toEqual(OFFICIAL);
  });

  it("a holiday morning has a close and no price: nothing has printed since 04:00", () => {
    // Thanksgiving, 06:00. Wednesday was the last session.
    const tape = { dailyBar: { t: "2026-11-25T05:00:00Z", c: 158.31 }, prevDailyBar: { c: 157.8 }, latestTrade: { t: "2026-11-26T00:59:40Z", p: 158.1 } };
    const iex = { latestTrade: { t: "2026-11-25T21:10:00Z", p: 158.2 }, dailyBar: { t: "2026-11-25T05:00:00Z", c: 158.4 }, prevDailyBar: { c: 157.9 } };
    expect(extOf(iex, tape, null, at("2026-11-26T11:00:00Z"))).toEqual({ close: 158.31, prevClose: 157.8 });
  });

  it("a weekend has a close and no session, whatever the feeds hold", () => {
    const stray = { latestTrade: { t: "2026-11-28T16:59:00Z", p: 1 }, latestQuote: { t: "2026-11-28T16:59:00Z", bp: 1, ap: 1 } };
    expect(extOf(IEX, { ...DAYS, ...stray }, stray, at("2026-11-28T17:00:00Z"))).toEqual(OFFICIAL);
  });

  it("at the same instant a trade that printed beats a quote", () => {
    const night = {
      latestQuote: { t: "2026-11-24T07:16:40Z", bp: 163.6, ap: 163.72 },
      latestTrade: { t: "2026-11-24T07:16:40Z", p: 163.7 },
    };
    expect(extOf(IEX, TAPE_NIGHT, night, at("2026-11-24T07:16:42Z"))?.now).toMatchObject({ price: 163.7, basis: "delayed" });
  });

  it("ignores a stamp from the future and a price that is not one", () => {
    const now = at("2026-11-24T07:16:42Z");
    expect(extOf(IEX, TAPE_NIGHT, { latestTrade: { t: "2026-11-24T07:20:00Z", p: 170 } }, now)?.now).toBeUndefined();
    expect(extOf(IEX, TAPE_NIGHT, { latestTrade: { t: "2026-11-24T07:16:00Z", p: 0 } }, now)?.now).toBeUndefined();
    expect(extOf(IEX, TAPE_NIGHT, { latestTrade: { p: 163.7 } }, now)?.now).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import type { FreshestRef } from "@/lib/live-bars";
import { foldTrade, isShut, reconcileLive, rollStep } from "@/lib/pro/live-candle";

type Bar = { i: number; t: number; o: number; h: number; l: number; c: number; v: number };

// ── a trade may open the next bar (2026-11-22) ───────────────────────────────
// /pro used to fold every tick into the last bar the feed had listed. On a
// one-minute chart a new minute's trades poured into the old candle until the
// 30 s refetch split them out, so the "live" candle was usually the wrong one.

const MIN = 60_000;
const T0 = Date.UTC(2026, 10, 20, 14, 30); // 14:30:00 UTC, a session open
const mbar = (i: number, o: number, c = o): Bar => ({ i, t: T0 + i * MIN, o, h: Math.max(o, c), l: Math.min(o, c), c, v: 100 });

describe("rollStep", () => {
  it("gives the bar length on an intraday frame while the market trades", () => {
    expect(rollStep("1m", "REGULAR")).toBe(60_000);
    expect(rollStep("4h", "REGULAR")).toBe(14_400_000);
  });
  it("is undefined when the market is shut, or on daily and longer bars", () => {
    expect(rollStep("1m", "CLOSED")).toBeUndefined();
    expect(rollStep("5m", undefined)).toBeUndefined();
    expect(rollStep("D", "REGULAR")).toBeUndefined();
    expect(rollStep("W", "REGULAR")).toBeUndefined();
  });
});

describe("foldTrade", () => {
  const now = T0 + 10 * MIN;
  const series = [mbar(0, 100, 101), mbar(1, 101, 102)]; // last bar covers 14:31:00–14:32:00

  it("moves the developing bar when the trade is inside it", () => {
    const out = foldTrade(series, 103, T0 + MIN + 30_000, MIN, now);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ c: 103, h: 103, l: 101, o: 101 });
  });

  it("opens the next bar once the trade is past the bar's end", () => {
    const out = foldTrade(series, 103, T0 + 2 * MIN + 5_000, MIN, now);
    expect(out).toHaveLength(3);
    expect(out[1]).toBe(series[1]); // the finished bar is left alone
    expect(out[2]).toEqual({ i: 2, t: T0 + 2 * MIN, o: 103, h: 103, l: 103, c: 103, v: 0 });
  });

  it("puts the new bar on the series' own grid when minutes were skipped", () => {
    const out = foldTrade(series, 99, T0 + 5 * MIN + 59_000, MIN, now);
    expect(out[2].t).toBe(T0 + 5 * MIN);
    expect(out[2].i).toBe(2); // the index stays consecutive: the chart places bars by it
  });

  it("keeps a half-hour grid: bars that start at :30 roll at :30", () => {
    const HOUR = 3_600_000;
    const hourly = [{ i: 0, t: T0, o: 10, h: 11, l: 9, c: 10.5, v: 1 }]; // 14:30–15:30
    const out = foldTrade(hourly, 12, T0 + HOUR + 60_000, HOUR, T0 + 2 * HOUR);
    expect(out[1].t).toBe(T0 + HOUR); // 15:30, not 15:00
  });

  it("only moves the last bar when no step is given (market shut, daily bars)", () => {
    const out = foldTrade(series, 103, T0 + 9 * MIN, undefined, now);
    expect(out).toHaveLength(2);
    expect(out[1].c).toBe(103);
  });

  it("never opens a bar from a trade dated in the future", () => {
    const out = foldTrade(series, 103, now + 10 * MIN, MIN, now);
    expect(out).toHaveLength(2);
  });

  it("never opens a bar across more than a long weekend", () => {
    const out = foldTrade(series, 103, T0 + 6 * 86_400_000, MIN, T0 + 7 * 86_400_000);
    expect(out).toHaveLength(2);
  });

  it("opens the first bar of the next session after a weekend", () => {
    const monday = T0 + 3 * 86_400_000 + 12_000; // 14:30:12 three days on
    const out = foldTrade(series, 105, monday, MIN, monday + 1000);
    expect(out).toHaveLength(3);
    expect(out[2].t).toBe(T0 + 3 * 86_400_000);
  });

  it("is a no-op for an empty series or a price that is not a number", () => {
    const empty: Bar[] = [];
    expect(foldTrade(empty, 5, T0, MIN, now)).toBe(empty);
    expect(foldTrade(series, Number.NaN, T0 + 3 * MIN, MIN, now)).toBe(series);
  });
});

describe("reconcileLive", () => {
  it("keeps a tick's own bar across a refetch that only lists finished bars", () => {
    // the tick at 14:32:20 opened a 14:32 bar; the refetch still ends at 14:31
    const ref: FreshestRef = { current: { sym: "AAPL", price: 103, t: (T0 + 2 * MIN + 20_000) / 1000 } };
    const fetched = [mbar(0, 100, 101), mbar(1, 101, 102)];
    const out = reconcileLive(fetched, { regularMarketPrice: 102, regularMarketTime: (T0 + 2 * MIN - 1000) / 1000 }, "AAPL", ref, MIN);
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ t: T0 + 2 * MIN, o: 103, c: 103 });
    expect(out[1].c).toBe(102); // not folded into the finished bar
  });

  it("opens the developing bar from the fetch's own newest trade", () => {
    const ref: FreshestRef = { current: null };
    const fetched = [mbar(0, 100, 101), mbar(1, 101, 102)];
    const out = reconcileLive(fetched, { regularMarketPrice: 104, regularMarketTime: (T0 + 2 * MIN + 30_000) / 1000 }, "AAPL", ref, MIN);
    expect(out).toHaveLength(3);
    expect(out[2].c).toBe(104);
    expect(ref.current).toEqual({ sym: "AAPL", price: 104, t: (T0 + 2 * MIN + 30_000) / 1000 });
  });

  it("without a step it is reconcileBars exactly: nothing opens, an older fetch takes the freshest price", () => {
    const fresh: FreshestRef = { current: null };
    const fetched = [mbar(0, 100, 101), mbar(1, 101, 102)];
    expect(reconcileLive(fetched, { regularMarketPrice: 104, regularMarketTime: (T0 + 2 * MIN + 30_000) / 1000 }, "AAPL", fresh)).toBe(fetched);
    const held: FreshestRef = { current: { sym: "AAPL", price: 107, t: (T0 + 9 * MIN) / 1000 } };
    const out = reconcileLive(fetched, { regularMarketPrice: 104, regularMarketTime: (T0 + 2 * MIN) / 1000 }, "AAPL", held);
    expect(out).toHaveLength(2);
    expect(out[1].c).toBe(107);
  });
});

describe("reconcileLive: the bars the chart built from ticks", () => {
  // on screen: the feed's two bars, then 14:32 and 14:33 opened from ticks
  const built: Bar = { i: 2, t: T0 + 2 * MIN, o: 103, h: 104.5, l: 102.8, c: 103.6, v: 0 };
  const shown = [mbar(0, 100, 101), mbar(1, 101, 102), built];
  const tickAt = (T0 + 2 * MIN + 40_000) / 1000;

  it("a tick-built bar keeps its open, high and low when the refetch does not list it yet", () => {
    const ref: FreshestRef = { current: { sym: "AAPL", price: 103.6, t: tickAt } };
    const fetched = [mbar(0, 100, 101), mbar(1, 101, 102)]; // still ends at 14:31
    const out = reconcileLive(fetched, { regularMarketPrice: 102, regularMarketTime: tickAt - 30 }, "AAPL", ref, MIN, shown);
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ t: T0 + 2 * MIN, o: 103, h: 104.5, l: 102.8, c: 103.6, i: 2 });
  });

  it("two bars ahead of a feed that is a minute behind are both kept", () => {
    const next: Bar = { i: 3, t: T0 + 3 * MIN, o: 103.7, h: 104, l: 103.5, c: 103.9, v: 0 };
    const ref: FreshestRef = { current: { sym: "AAPL", price: 103.9, t: (T0 + 3 * MIN + 20_000) / 1000 } };
    const fetched = [mbar(0, 100, 101), mbar(1, 101, 102)];
    const out = reconcileLive(fetched, { regularMarketPrice: 102, regularMarketTime: tickAt - 60 }, "AAPL", ref, MIN, [...shown, next]);
    expect(out.map((b) => b.t)).toEqual([T0, T0 + MIN, T0 + 2 * MIN, T0 + 3 * MIN]);
    expect(out[2]).toMatchObject({ o: 103, h: 104.5, c: 103.6 }); // the minute in between did not vanish
    expect(out[3]).toMatchObject({ o: 103.7, c: 103.9 });
    expect(out.map((b) => b.i)).toEqual([0, 1, 2, 3]);
  });

  it("the feed's bar takes over once the feed lists that minute", () => {
    const ref: FreshestRef = { current: { sym: "AAPL", price: 103.6, t: tickAt } };
    const listed = [mbar(0, 100, 101), mbar(1, 101, 102), { i: 2, t: T0 + 2 * MIN, o: 102.9, h: 104.7, l: 102.5, c: 103.2, v: 900 }];
    const out = reconcileLive(listed, { regularMarketPrice: 103.2, regularMarketTime: tickAt - 5 }, "AAPL", ref, MIN, shown);
    expect(out).toHaveLength(3);
    expect(out[2]).toMatchObject({ o: 102.9, h: 104.7, l: 102.5, c: 103.6, v: 900 }); // the feed's bar, closed on the freshest trade
  });

  it("kept bars are renumbered when the feed's window slid", () => {
    const ref: FreshestRef = { current: { sym: "AAPL", price: 103.6, t: tickAt } };
    const slid = [{ ...mbar(1, 101, 102), i: 0 }]; // the feed dropped its oldest bar and renumbered
    const out = reconcileLive(slid, { regularMarketPrice: 102, regularMarketTime: tickAt - 30 }, "AAPL", ref, MIN, shown);
    expect(out.map((b) => b.i)).toEqual([0, 1]);
    expect(out[1].o).toBe(103);
  });

  it("holds at most five bars past the feed, and none across more than a long weekend", () => {
    const far = Array.from({ length: 9 }, (_, k) => ({ i: 2 + k, t: T0 + (2 + k) * MIN, o: 1, h: 1, l: 1, c: 1, v: 0 }));
    const ref: FreshestRef = { current: null };
    const fetched = [mbar(0, 100, 101), mbar(1, 101, 102)];
    const out = reconcileLive(fetched, { regularMarketPrice: 102, regularMarketTime: (T0 + MIN + 30_000) / 1000 }, "AAPL", ref, MIN, [...fetched, ...far]);
    expect(out).toHaveLength(2 + 5);
    const stale = [{ i: 2, t: T0 + 9 * 86_400_000, o: 1, h: 1, l: 1, c: 1, v: 0 }];
    expect(reconcileLive(fetched, { regularMarketPrice: 102, regularMarketTime: (T0 + MIN + 30_000) / 1000 }, "AAPL", { current: null }, MIN, stale)).toHaveLength(2);
  });

  it("nothing is kept with the market shut (no step), or when the screen is not ahead of the feed", () => {
    const ref: FreshestRef = { current: null };
    const fetched = [mbar(0, 100, 101), mbar(1, 101, 102)];
    expect(reconcileLive(fetched, { regularMarketPrice: 102, regularMarketTime: 1 }, "AAPL", ref, undefined, shown)).toBe(fetched);
    const out = reconcileLive(fetched, { regularMarketPrice: 102, regularMarketTime: (T0 + MIN + 30_000) / 1000 }, "AAPL", { current: null }, MIN, fetched);
    expect(out).toHaveLength(2);
  });
});

// ── a shut market leaves the candles alone (2026-11-24) ──────────────────────
// A print after the close is one odd lot on one exchange. Folded into the last
// candle it bent the session's close; the owner called the chart "cooked".

describe("isShut", () => {
  it("is a market the feed says is not trading", () => {
    expect(isShut("CLOSED")).toBe(true);
    expect(isShut("PRE")).toBe(true);
    expect(isShut("POST")).toBe(true);
  });
  it("is not a trading market, nor a feed that does not say", () => {
    expect(isShut("REGULAR")).toBe(false);
    expect(isShut(undefined)).toBe(false);
    expect(isShut(null)).toBe(false);
  });
});

describe("reconcileLive on a shut market", () => {
  const fetched = [mbar(0, 100, 101), mbar(1, 101, 102)];
  const late = (T0 + 50 * MIN) / 1000; // a print fifty minutes after the last bar

  it("returns the feed's bars untouched, whatever the late print says", () => {
    const ref: FreshestRef = { current: null };
    const out = reconcileLive(fetched, { regularMarketPrice: 99.4, regularMarketTime: late, marketState: "CLOSED" }, "AAPL", ref, undefined);
    expect(out).toBe(fetched);
    expect(out[1].c).toBe(102);
    expect(ref.current).toEqual({ sym: "AAPL", price: 99.4, t: late }); // noted for ordering, not drawn
  });

  it("does not fold a fresher streamed print either, nor keep tick-built bars", () => {
    const ref: FreshestRef = { current: { sym: "AAPL", price: 98.7, t: late + 60 } };
    const built: Bar = { i: 2, t: T0 + 2 * MIN, o: 103, h: 104, l: 102, c: 103, v: 0 };
    const out = reconcileLive(fetched, { regularMarketPrice: 99.4, regularMarketTime: late, marketState: "CLOSED" }, "AAPL", ref, MIN, [...fetched, built]);
    expect(out).toBe(fetched);
    expect(ref.current?.price).toBe(98.7); // the newer print stays the freshest
  });

  it("a market that does not say behaves as before: the freshest price is folded in", () => {
    const ref: FreshestRef = { current: { sym: "AAPL", price: 98.7, t: late + 60 } };
    const out = reconcileLive(fetched, { regularMarketPrice: 99.4, regularMarketTime: late }, "AAPL", ref, undefined);
    expect(out[1].c).toBe(98.7);
  });
});

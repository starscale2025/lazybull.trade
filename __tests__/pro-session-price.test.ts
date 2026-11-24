import { describe, expect, it } from "vitest";
import { headline, sessionLine, sessionMark, sessionNote, watchRow } from "@/lib/pro/session-price";

// What /pro prints for a US stock while its regular session is shut. NVDA,
// 24 Nov 2026: Monday's close 165.185 after Friday's 125.65, then 163.66 on
// the overnight venue and 157 before Tuesday's open.

const clock = (ms: number) => new Date(ms).toISOString().slice(11, 16); // UTC, for a test that runs anywhere
const T = Date.UTC(2026, 10, 24, 7, 16, 40) / 1000;
const base = { sym: "NVDA", last: 164.85, chg: 39.2, chgPct: 31.2, marketState: "CLOSED" };
const closed = { ...base, ext: { close: 165.185, prevClose: 125.65 } };
const night = { ...base, ext: { ...closed.ext, now: { session: "overnight" as const, price: 163.66, time: T, basis: "indicative" as const } } };
const pre = { ...base, ext: { ...closed.ext, now: { session: "pre" as const, price: 157, time: T, basis: "delayed" as const } } };
const post = { ...base, ext: { ...closed.ext, now: { session: "post" as const, price: 164.85, time: T, basis: "trade" as const } } };
const open = { sym: "NVDA", last: 158.4, chg: -6.785, chgPct: -4.11, marketState: "REGULAR" };

describe("the number in the big type", () => {
  it("is the quote as it came while the market trades", () => {
    expect(headline(open)).toEqual({ price: 158.4, chg: -6.785, chgPct: -4.11 });
  });

  it("is the close against the close before once the session is shut, whatever has printed since", () => {
    for (const q of [closed, night, pre, post]) {
      const h = headline(q);
      expect(h.price).toBe(165.185);
      expect(h.chg).toBeCloseTo(39.535, 6);
      expect(h.chgPct).toBeCloseTo(31.4644, 3);
    }
  });

  it("has no change to show when the feed gave no close before it", () => {
    expect(headline({ ...base, ext: { close: 165.185, prevClose: null } })).toEqual({ price: 165.185, chg: undefined, chgPct: undefined });
  });

  it("is empty without a quote", () => {
    expect(headline(undefined)).toEqual({});
  });
});

describe("the line for the stretch that is on", () => {
  it("names it and measures it from the close", () => {
    const line = sessionLine(night)!;
    expect(line.label).toBe("Overnight");
    expect(line.price).toBe(163.66);
    expect(line.chg).toBeCloseTo(-1.525, 6);
    expect(line.chgPct).toBeCloseTo(-0.9232, 3);
    expect(sessionLine(pre)!.label).toBe("Pre-market");
    expect(sessionLine(pre)!.chgPct).toBeCloseTo(-4.955, 3);
    expect(sessionLine(post)!.label).toBe("After hours");
  });

  it("is absent with the market open, and with it shut and nothing printed since", () => {
    expect(sessionLine(open)).toBeNull();
    expect(sessionLine(closed)).toBeNull();
    expect(sessionLine(undefined)).toBeNull();
  });
});

describe("a watchlist row", () => {
  it("is the stretch's price against the close, tagged", () => {
    const row = watchRow(night);
    expect(row.last).toBe(163.66);
    expect(row.chg).toBeCloseTo(-1.525, 6);
    expect(row.tag).toBe("O/N");
    expect(watchRow(pre).tag).toBe("PRE");
    expect(watchRow(post).tag).toBe("AH");
  });

  it("is the close against the one before when the market is shut and still", () => {
    const row = watchRow(closed);
    expect(row.last).toBe(165.185);
    expect(row.chgPct).toBeCloseTo(31.4644, 3);
    expect(row.tag).toBeUndefined();
  });

  it("is the quote untouched while the market trades, for a coin, and for a feed that says nothing of sessions", () => {
    expect(watchRow(open)).toEqual({ last: 158.4, chg: -6.785, chgPct: -4.11 });
    expect(watchRow({ last: 60390, chg: 390, chgPct: 0.65 })).toEqual({ last: 60390, chg: 390, chgPct: 0.65 });
    expect(watchRow(undefined)).toEqual({});
  });
});

describe("the sentence under the price", () => {
  const justAfter = T * 1000 + 5_000;

  it("says what the number is made of", () => {
    expect(sessionNote(night, justAfter, clock)).toBe("Overnight · indicative price, not a trade");
    expect(sessionNote(pre, justAfter, clock)).toBe("Pre-market · 15 minutes delayed");
    expect(sessionNote(post, justAfter, clock)).toBe("After hours · live from one exchange");
    expect(sessionNote(closed, justAfter, clock)).toBe("Market closed · closing price");
  });

  it("gives a quiet price its time", () => {
    expect(sessionNote(night, T * 1000 + 3 * 60_000, clock)).toBe("Overnight · indicative price, not a trade · as of 07:16");
    expect(sessionNote(post, T * 1000 + 40 * 60_000, clock)).toBe("After hours · live from one exchange · as of 07:16");
  });

  it("counts a delayed price as quiet only past the delay it always has", () => {
    expect(sessionNote(pre, T * 1000 + 16 * 60_000, clock)).toBe("Pre-market · 15 minutes delayed");
    expect(sessionNote(pre, T * 1000 + 21 * 60_000, clock)).toBe("Pre-market · 15 minutes delayed · as of 07:16");
  });

  it("leaves a quote without `ext` to the caller's own words", () => {
    expect(sessionNote(open, justAfter, clock)).toBeNull();
    expect(sessionNote(undefined, justAfter, clock)).toBeNull();
  });
});

describe("the chart's mark", () => {
  it("is the stretch's price and name, or nothing", () => {
    expect(sessionMark(night)).toEqual({ price: 163.66, label: "Overnight" });
    expect(sessionMark(closed)).toBeNull();
    expect(sessionMark(open)).toBeNull();
  });
});

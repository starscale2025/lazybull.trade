import { describe, it, expect } from "vitest";
import { deriveMarketState } from "@/lib/market-state";

// a real Yahoo-shaped meta: pre 06:00-09:30, regular 09:30-16:00, post 16:00-20:00 ET
const meta = {
  regularMarketTime: 1784318400,
  currentTradingPeriod: {
    pre: { start: 1784275200, end: 1784295000 },
    regular: { start: 1784295000, end: 1784318400 },
    post: { start: 1784318400, end: 1784332800 },
  },
};
const at = (epoch: number) => deriveMarketState(meta, epoch * 1000);

describe("deriveMarketState", () => {
  it("REGULAR inside the regular session", () => expect(at(1784300000)).toBe("REGULAR"));
  it("PRE inside the pre session", () => expect(at(1784280000)).toBe("PRE"));
  it("POST inside the post session", () => expect(at(1784320000)).toBe("POST"));
  it("CLOSED overnight/weekend (the bug: used to say REGULAR)", () =>
    expect(at(1784407994)).toBe("CLOSED"));
  it("CLOSED before the pre session opens", () => expect(at(1784200000)).toBe("CLOSED"));
  it("boundary: regular end is no longer REGULAR", () =>
    expect(at(1784318400)).toBe("POST"));
  it("honours an explicit provider state when present", () =>
    expect(deriveMarketState({ ...meta, marketState: "PRE" }, 1784300000 * 1000)).toBe("PRE"));
  it("no trading periods: recent trade => REGULAR, stale => CLOSED", () => {
    const now = 1784400000;
    expect(deriveMarketState({ regularMarketTime: now - 60 }, now * 1000)).toBe("REGULAR");
    expect(deriveMarketState({ regularMarketTime: now - 7200 }, now * 1000)).toBe("CLOSED");
  });
  it("empty meta never throws", () => expect(deriveMarketState(undefined)).toBe("CLOSED"));
});

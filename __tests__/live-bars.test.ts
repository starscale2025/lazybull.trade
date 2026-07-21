import { describe, expect, it } from "vitest";
import { applyTick, foldClose, patchLastBar, reconcileBars, type FreshestRef } from "@/lib/live-bars";

type Bar = { i: number; t: number; o: number; h: number; l: number; c: number; v: number };
const bar = (o: number, h: number, l: number, c: number, i = 0): Bar => ({ i, t: i, o, h, l, c, v: 0 });

describe("patchLastBar", () => {
  it("moves the close and stretches the high", () => {
    const out = patchLastBar([bar(10, 12, 9, 11)], 13);
    expect(out[0]).toMatchObject({ c: 13, h: 13, l: 9 });
  });

  it("stretches the low on a downtick", () => {
    const out = patchLastBar([bar(10, 12, 9, 11)], 8.5);
    expect(out[0]).toMatchObject({ c: 8.5, h: 12, l: 8.5 });
  });

  it("only touches the LAST bar", () => {
    const a = bar(1, 2, 1, 2, 0);
    const out = patchLastBar([a, bar(10, 12, 9, 11, 1)], 13);
    expect(out[0]).toBe(a); // untouched by reference
    expect(out[1].c).toBe(13);
  });

  it("is a no-op (same reference) when the price already matches", () => {
    const arr = [bar(10, 12, 9, 11)];
    expect(patchLastBar(arr, 11)).toBe(arr);
  });

  it("handles an empty series", () => {
    const arr: Bar[] = [];
    expect(patchLastBar(arr, 5)).toBe(arr);
  });

  it("foldClose works on timestamp-less candles (the /quant shape)", () => {
    const out = foldClose([{ o: 1, h: 2, l: 0.5, c: 1.5 }], 2.5);
    expect(out[0]).toEqual({ o: 1, h: 2.5, l: 0.5, c: 2.5 });
  });
});

describe("reconcileBars", () => {
  it("patches the freshest trade into a STALER fetch instead of walking back", () => {
    const ref: FreshestRef = { current: { sym: "AAPL", price: 105, t: 2000 } };
    const out = reconcileBars([bar(100, 101, 99, 100)], { regularMarketPrice: 100, regularMarketTime: 1000 }, "AAPL", ref);
    expect(out[0].c).toBe(105);
  });

  it("a NEWER fetch wins and becomes the new freshest", () => {
    const ref: FreshestRef = { current: { sym: "AAPL", price: 105, t: 1000 } };
    const bars = [bar(100, 101, 99, 100)];
    const out = reconcileBars(bars, { regularMarketPrice: 100, regularMarketTime: 2000 }, "AAPL", ref);
    expect(out).toBe(bars); // untouched
    expect(ref.current).toEqual({ sym: "AAPL", price: 100, t: 2000 });
  });

  it("another symbol's freshest never leaks into this fetch", () => {
    const ref: FreshestRef = { current: { sym: "NVDA", price: 999, t: 9999 } };
    const out = reconcileBars([bar(100, 101, 99, 100)], { regularMarketPrice: 100, regularMarketTime: 1 }, "AAPL", ref);
    expect(out[0].c).toBe(100);
    expect(ref.current?.sym).toBe("AAPL"); // ref now tracks the fetched symbol
  });
});

describe("applyTick", () => {
  it("applies a fresh tick and records it", () => {
    const ref: FreshestRef = { current: null };
    const out = applyTick([bar(10, 12, 9, 11)], { sym: "AAPL", price: 12.5, t: 100 }, "AAPL", ref);
    expect(out?.[0].c).toBe(12.5);
    expect(ref.current).toEqual({ sym: "AAPL", price: 12.5, t: 100 });
  });

  it("drops a tick older than what already painted the tape", () => {
    const ref: FreshestRef = { current: { sym: "AAPL", price: 13, t: 200 } };
    expect(applyTick([bar(10, 12, 9, 13)], { sym: "AAPL", price: 12, t: 100 }, "AAPL", ref)).toBeNull();
    expect(ref.current?.price).toBe(13);
  });

  it("drops cross-symbol and non-finite ticks", () => {
    const ref: FreshestRef = { current: null };
    expect(applyTick([bar(1, 2, 1, 2)], { sym: "NVDA", price: 5, t: 1 }, "AAPL", ref)).toBeNull();
    expect(applyTick([bar(1, 2, 1, 2)], { sym: "AAPL", price: NaN, t: 1 }, "AAPL", ref)).toBeNull();
    expect(ref.current).toBeNull();
  });
});

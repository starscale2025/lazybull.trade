import { describe, expect, it } from "vitest";
import { CANDLES, CANDLE_CRASH_AT, DIVERGE, FIRST_RED_I, PEAK_PRICE, candlePrintAt, floorReachF, floorY, revealF } from "@/lib/candle-series";
import { CANDLE_CRASH_FROM } from "@/lib/cinema";
import { CRASH_AT } from "@/lib/cinema-score";

/** Gate A4 #3: the crash is one frame, and the floor is the visitor's K1. */
describe("the candle series", () => {
  it("crashes at one frame: the first red print", () => {
    expect(CANDLES.slice(0, FIRST_RED_I).every((c) => c.up)).toBe(true);
    expect(CANDLES[FIRST_RED_I].up).toBe(false);
    expect(FIRST_RED_I).toBeLessThanOrEqual(DIVERGE);
    expect(revealF(CANDLE_CRASH_AT)).toBeCloseTo(FIRST_RED_I, 6);
    expect(CRASH_AT).toBe(CANDLE_CRASH_AT);
    // "Then the floor goes." pre-laps the crash, never trails it.
    expect(CANDLE_CRASH_FROM).toBeLessThan(CANDLE_CRASH_AT);
    expect(CANDLE_CRASH_AT - CANDLE_CRASH_FROM).toBeLessThan(0.03);
  });

  it("puts the floor at K1, with the peak as SIM 100, and the price falls through it", () => {
    expect(floorY(100)).toBeCloseTo(PEAK_PRICE, 9);
    for (const k1 of [80, 90, 96, 100]) {
      const y = floorY(k1);
      const at = floorReachF(y);
      expect(at).toBeGreaterThanOrEqual(FIRST_RED_I);
      // ...and keeps falling below it: the floor bounds the loss, not the price.
      const low = Math.min(...CANDLES.slice(Math.ceil(at)).map((c) => c.c));
      expect(low).toBeLessThan(y);
      expect(candlePrintAt(at)).toBeGreaterThanOrEqual(CANDLE_CRASH_AT);
    }
  });
});

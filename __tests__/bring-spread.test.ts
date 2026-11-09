import { describe, expect, it } from "vitest";
import { bullCallSpread } from "@/lib/models";
import { DAYS, IV, SPOT, figures } from "@/lib/hero-spread";

/**
 * Gate A4 #6: the spread a visitor shapes on the home page opens in /trade.
 * The promise is that it is the SAME spread, so the builder's numbers must be
 * the home page's numbers at the home page's spot, days and IV.
 */
describe("the spread brought to the builder", () => {
  for (const [k1, k2] of [[100, 108], [96, 108], [90, 112], [104, 106]] as const) {
    it(`matches the home page at ${k1}/${k2}`, () => {
      const home = figures(k1, k2);
      const s = bullCallSpread({ spot: SPOT, k1, k2, daysToExpiry: DAYS, iv: IV });
      expect(s.cost).toBeCloseTo(home.maxLoss, 6);
      expect(Math.abs(s.maxLoss)).toBeCloseTo(home.maxLoss, 0);
      expect(s.maxProfit).toBeCloseTo(home.maxProfit, 0);
      expect(s.breakevens[0]).toBeCloseTo(home.breakeven, 0);
      expect(s.legs.map((l) => [l.side, l.type, l.strike])).toEqual([["long", "C", k1], ["short", "C", k2]]);
    });
  }
});

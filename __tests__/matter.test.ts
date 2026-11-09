import { describe, expect, it } from "vitest";
import { addMatterSlot, getMatterSlots, removeMatterSlot } from "@/lib/matter";
import { GAP, K_MAX, K_MIN, START_STRIKES, figures, placeStrike } from "@/lib/hero-spread";
import { isToolRoute } from "@/lib/motion/routes";

const el = {} as HTMLElement;

describe("the matter's slots", () => {
  it("registers and forgets slots by id", () => {
    addMatterSlot({ id: "a", el, shape: "sphere", drain: true });
    addMatterSlot({ id: "b", el, shape: "ledger" });
    expect(getMatterSlots().map((s) => s.shape).sort()).toEqual(["ledger", "sphere"]);
    removeMatterSlot("a");
    removeMatterSlot("b");
    expect(getMatterSlots()).toEqual([]);
  });

  it("stays dormant on the tools, alive on content pages", () => {
    for (const p of ["/pro", "/trade", "/trade/chain", "/portfolio", "/admin", "/practice/two-sum"]) expect(isToolRoute(p)).toBe(true);
    for (const p of ["/", "/learn", "/pricing", "/practice", "/practice/tracks/quant", "/about"]) expect(isToolRoute(p)).toBe(false);
  });
});

describe("the example spread, shared by frame zero and the instrument", () => {
  it("keeps the strikes in bounds and at least GAP apart", () => {
    expect(placeStrike(START_STRIKES, "k1", 200)).toEqual({ k1: START_STRIKES.k2 - GAP, k2: START_STRIKES.k2 });
    expect(placeStrike(START_STRIKES, "k1", 0)).toEqual({ k1: K_MIN, k2: START_STRIKES.k2 });
    expect(placeStrike(START_STRIKES, "k2", 0)).toEqual({ k1: START_STRIKES.k1, k2: START_STRIKES.k1 + GAP });
    expect(placeStrike(START_STRIKES, "k2", 999)).toEqual({ k1: START_STRIKES.k1, k2: K_MAX });
    expect(placeStrike(START_STRIKES, "k1", 95.4)).toEqual({ k1: 95, k2: 108 });
  });

  it("prices a debit spread whose floor and cap add up to its width", () => {
    const f = figures(100, 108);
    expect(f.maxLoss).toBeGreaterThan(0);
    expect(f.maxProfit).toBeGreaterThan(0);
    expect(f.maxLoss + f.maxProfit).toBeCloseTo(800, 6);
    expect(f.breakeven).toBeGreaterThan(100);
    expect(f.breakeven).toBeLessThan(108);
  });
});

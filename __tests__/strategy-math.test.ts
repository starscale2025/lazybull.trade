import { describe, it, expect } from "vitest";
import { generateStrategies } from "@/lib/models";

const finite = (n: number) => Number.isFinite(n);
const all = (spot: number, low: number, high: number, d = 30, iv = 0.35) =>
  generateStrategies({ spot, low, high, daysToExpiry: d, iv });

describe("generateStrategies — money math", () => {
  const cases: [string, number, number, number][] = [
    ["normal band around spot", 100, 92, 108],
    ["band entirely BELOW spot", 100, 60, 80],   // used to invert bull call legs
    ["band entirely ABOVE spot", 100, 120, 140], // used to invert bear put legs
    ["very wide band (condor wings)", 100, 10, 190], // used to make negative strike -> NaN
    ["low-priced stock", 8, 5, 11],
    ["tight band", 250, 249, 251],
  ];

  for (const [label, spot, low, high] of cases) {
    it(`${label}: no NaN/undefined anywhere`, () => {
      for (const s of all(spot, low, high)) {
        expect(finite(s.cost), `${s.id} cost`).toBe(true);
        expect(finite(s.maxLoss), `${s.id} maxLoss`).toBe(true);
        expect(Number.isNaN(s.maxProfit), `${s.id} maxProfit NaN`).toBe(false);
        expect(finite(s.prob), `${s.id} prob`).toBe(true);
        expect(s.prob).toBeGreaterThanOrEqual(0);
        expect(s.prob).toBeLessThanOrEqual(1);
        for (const l of s.legs) {
          expect(l.strike, `${s.id} strike>0`).toBeGreaterThan(0);
          expect(finite(l.premium), `${s.id} premium`).toBe(true);
        }
      }
    });

    it(`${label}: spread legs are ordered correctly for their structure`, () => {
      for (const s of all(spot, low, high)) {
        const lc = s.legs.find((l) => l.type === "C" && l.side === "long");
        const sc = s.legs.find((l) => l.type === "C" && l.side === "short");
        const lp = s.legs.find((l) => l.type === "P" && l.side === "long");
        const sp = s.legs.find((l) => l.type === "P" && l.side === "short");

        if (/bull call spread/i.test(s.kind)) {
          // debit: buy the lower strike, sell the higher one
          expect(lc!.strike, `${s.kind} long<short`).toBeLessThan(sc!.strike);
        }
        if (/bear put spread/i.test(s.kind)) {
          // debit: buy the higher strike, sell the lower one
          expect(lp!.strike, `${s.kind} long>short`).toBeGreaterThan(sp!.strike);
        }
        if (/condor/i.test(s.kind)) {
          // wings outside the shorts: Klp < Ksp < Ksc < Klc
          expect(lp!.strike, "condor put wing").toBeLessThan(sp!.strike);
          expect(sp!.strike, "condor body").toBeLessThan(sc!.strike);
          expect(sc!.strike, "condor call wing").toBeLessThan(lc!.strike);
        }
        // credit spreads (non-condor): the two legs must never collide
        if (lc && sc) expect(lc.strike).not.toBe(sc.strike);
        if (lp && sp) expect(lp.strike).not.toBe(sp.strike);
      }
    });
  }

  it("long put max profit subtracts the premium paid", () => {
    const s = all(100, 60, 80).find((x) => x.id === "cheap")!;
    expect(s.kind).toMatch(/put/i);
    const prem = s.cost / 100;
    const K = s.legs[0].strike;
    expect(s.maxProfit).toBeCloseTo((K - prem) * 100, 6);
    expect(s.maxProfit).toBeLessThan(K * 100); // strictly less than the old wrong value
  });

  it("maxProfit/maxLoss stay correct when strikes fall outside +/-50% of spot", () => {
    // wide band pushes wings far from spot; the old +/-50% scan grid missed them
    for (const s of all(100, 20, 185)) {
      expect(finite(s.maxLoss)).toBe(true);
      expect(s.maxLoss).toBeLessThanOrEqual(0);
      if (Number.isFinite(s.maxProfit)) expect(s.maxProfit).toBeGreaterThanOrEqual(0);
    }
  });
});

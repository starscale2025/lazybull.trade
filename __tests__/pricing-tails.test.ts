import { describe, expect, it } from "vitest";
import { pnlSummary, type Leg } from "@/lib/pricing";

const leg = (type: Leg["type"], side: Leg["side"], strike: number, premium: number, qty = 1): Leg => ({
  id: `${side}-${type}-${strike}`,
  type,
  side,
  strike,
  qty,
  premium,
});

// Deterministic, cent-rounded premiums: rounding is what leaves the float
// residue on a flat tail, so the sweep needs realistic two-decimal prices.
const cents = (x: number) => Math.round(x * 100) / 100;

function sweepVerticals(make: (k: number, w: number, i: number) => Leg[]) {
  const out: Leg[][] = [];
  let i = 0;
  for (let k = 50; k < 150; k += 0.5) for (const w of [1, 2.5, 5, 10]) out.push(make(k, w, i++));
  return out;
}

describe("pnlSummary tails", () => {
  it("reads a bull call spread as capped on both sides", () => {
    const s = pnlSummary([leg("C", "long", 96, 6.2), leg("C", "short", 104, 2.1)], 100);
    expect(s.profitUncapped).toBe(false);
    expect(s.unboundedRisk).toBe(false);
    expect(s.maxProfit).toBeCloseTo(390, 6);
    expect(s.maxLoss).toBeCloseTo(-410, 6);
  });

  it("never calls a defined-risk vertical unbounded or uncapped", () => {
    const books = [
      ...sweepVerticals((k, w, i) => [leg("C", "long", k, cents(1 + ((i * 7.3) % 4))), leg("C", "short", k + w, cents((i * 3.1) % 3))]),
      ...sweepVerticals((k, w, i) => [leg("P", "short", k + w, cents(1 + ((i * 5.7) % 4))), leg("P", "long", k, cents((i * 2.3) % 3))]),
      ...sweepVerticals((k, w, i) => [leg("C", "short", k, cents(1 + ((i * 4.1) % 4))), leg("C", "long", k + w, cents((i * 1.9) % 3))]),
      ...sweepVerticals((k, w, i) => [leg("P", "long", k + w, cents(1 + ((i * 6.7) % 4))), leg("P", "short", k, cents((i * 2.9) % 3))]),
    ];
    const flagged = books.filter((b) => {
      const s = pnlSummary(b, 100);
      return s.unboundedRisk || s.profitUncapped;
    });
    expect(books.length).toBe(3200);
    expect(flagged).toEqual([]);
  });

  it("still sees the real tails", () => {
    expect(pnlSummary([leg("C", "long", 100, 3)], 100).profitUncapped).toBe(true);
    expect(pnlSummary([leg("C", "long", 100, 3)], 100).unboundedRisk).toBe(false);
    expect(pnlSummary([leg("C", "short", 100, 3)], 100).unboundedRisk).toBe(true);
    expect(pnlSummary([leg("P", "short", 100, 3)], 100).unboundedRisk).toBe(true);
    expect(pnlSummary([leg("P", "long", 100, 3)], 100).profitUncapped).toBe(false);
  });

  it("holds at very large prices", () => {
    const s = pnlSummary([leg("C", "long", 960_000, 6200.17), leg("C", "short", 1_040_000, 2100.03)], 1_000_000);
    expect(s.unboundedRisk).toBe(false);
    expect(s.profitUncapped).toBe(false);
  });
});

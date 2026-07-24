import { describe, it, expect } from "vitest";
import { unionOf, backoffDelay, changedSymbols } from "@/lib/streaming/manager";
import type { Quote } from "@/lib/market-data/provider";

const sub = (syms: string[]) => ({ symbols: new Set(syms), cb: () => {} });
const q = (sym: string, last: number): Quote => ({ sym, last, chg: 0, chgPct: 0 });

describe("streaming manager — pure logic", () => {
  it("unions subscriber symbols, sorted + de-duped (one connection covers all)", () => {
    expect(unionOf([sub(["AAPL", "MSFT"]), sub(["MSFT", "^VIX"])])).toEqual(["AAPL", "MSFT", "^VIX"]);
    expect(unionOf([sub(["AAPL"]), sub(["AAPL"])])).toEqual(["AAPL"]); // 100 users, one subscription
    expect(unionOf([])).toEqual([]);
  });

  it("reconnects with exponential backoff capped at 15s", () => {
    expect(backoffDelay(1)).toBe(1000);
    expect(backoffDelay(2)).toBe(2000);
    expect(backoffDelay(3)).toBe(4000);
    expect(backoffDelay(4)).toBe(8000);
    expect(backoffDelay(5)).toBe(15000); // 16000 → capped
    expect(backoffDelay(20)).toBe(15000);
  });

  it("fans out only the symbols whose price actually changed", () => {
    const prev = new Map([
      ["AAPL", 100],
      ["MSFT", 200],
    ]);
    const changed = changedSymbols(prev, [q("AAPL", 100), q("MSFT", 201), q("NVDA", 50)]).sort();
    expect(changed).toEqual(["MSFT", "NVDA"]); // AAPL unchanged; NVDA new
  });
});

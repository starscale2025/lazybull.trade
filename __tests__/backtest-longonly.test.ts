import { describe, it, expect } from "vitest";
import { backtestLongOnly } from "@/lib/quant/series";
type Sig = 0 | 1 | -1;
const fin = (p: number[], s: Sig[]) => { const r = backtestLongOnly(p,s); return r.equity[r.equity.length-1]; };
describe("backtestLongOnly", () => {
  it("multi-bar +10% trade returns +10% (was 18.8% — double counted)", () => {
    expect(fin([100,100,105,108,110],[0,1,0,0,-1] as Sig[])).toBeCloseTo(1.10, 10);
  });
  it("one-bar trade unchanged", () => {
    expect(fin([100,100,110],[0,1,-1] as Sig[])).toBeCloseTo(1.10, 10);
  });
  it("multi-bar loss is exact", () => {
    expect(fin([100,100,90,80],[0,1,0,-1] as Sig[])).toBeCloseTo(0.80, 10);
  });
  it("two sequential trades compound correctly", () => {
    expect(fin([100,100,110,100,120,110],[0,1,-1,1,-1,0] as Sig[])).toBeCloseTo(1.10*1.20, 10);
  });
  it("still counts trades and win rate at trade level", () => {
    const r = backtestLongOnly([100,100,105,108,110],[0,1,0,0,-1] as Sig[]);
    expect(r.trades).toBe(1); expect(r.winRate).toBe(1);
  });
});

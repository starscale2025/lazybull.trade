import { describe, expect, it } from "vitest";
import { modelRead, quantRead, realizedVolFromCloses } from "@/lib/bet-analysis";
import type { Candle } from "@/lib/candles";

// Deterministic candle fixtures (same PRNG family as the other suites).
function candles(n: number, seed = 7, drift = 0): Candle[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const out: Candle[] = [];
  let c = 100;
  for (let i = 0; i < n; i++) {
    const o = c;
    c = c * (1 + (rand() - 0.5) * 0.03 + drift);
    out.push({ o, h: Math.max(o, c) * 1.005, l: Math.min(o, c) * 0.995, c });
  }
  return out;
}

describe("quantRead", () => {
  it("tallies the whole jury and stays internally consistent", () => {
    const r = quantRead(candles(200), "TEST");
    expect(r.up + r.down + r.hold).toBe(r.jurySize);
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
    expect(r.h).toBeGreaterThanOrEqual(0);
    expect(r.h).toBeLessThanOrEqual(1);
    if (r.up > r.down) expect(r.lean).toBe("UP");
    if (r.down > r.up) expect(r.lean).toBe("DOWN");
    if (r.up === r.down) expect(r.lean).toBe("NEUTRAL");
  });

  it("a NEUTRAL lean carries zero confidence", () => {
    // Force neutrality with a flat tape: every verdict is hold or split.
    const flat: Candle[] = Array.from({ length: 120 }, () => ({ o: 100, h: 100.1, l: 99.9, c: 100 }));
    const r = quantRead(flat, "FLAT");
    if (r.lean === "NEUTRAL") expect(r.confidence).toBe(0);
  });

  it("survives a tiny series without throwing", () => {
    const r = quantRead(candles(5), "TINY");
    expect(r.up + r.down + r.hold).toBe(r.jurySize);
  });
});

describe("modelRead", () => {
  it("pUp is a probability and the 1σ range brackets spot", () => {
    const cs = candles(200);
    const spot = cs[cs.length - 1].c;
    const m = modelRead(cs, spot, 30);
    expect(m.pUp).toBeGreaterThan(0);
    expect(m.pUp).toBeLessThan(1);
    expect(m.lo).toBeLessThan(spot);
    expect(m.hi).toBeGreaterThan(spot);
    expect(Number.isFinite(m.vol)).toBe(true);
  });

  it("longer horizon widens the range", () => {
    const cs = candles(200);
    const spot = cs[cs.length - 1].c;
    const short = modelRead(cs, spot, 7);
    const long = modelRead(cs, spot, 90);
    expect(long.hi - long.lo).toBeGreaterThan(short.hi - short.lo);
  });

  it("junk spot falls back to the last close rather than NaN", () => {
    const cs = candles(100);
    const m = modelRead(cs, NaN, 30);
    expect(Number.isFinite(m.pUp)).toBe(true);
    expect(Number.isFinite(m.lo)).toBe(true);
    expect(Number.isFinite(m.hi)).toBe(true);
  });
});

describe("realizedVolFromCloses", () => {
  it("clamps to the house band and never returns NaN", () => {
    expect(realizedVolFromCloses([])).toBe(0.32); // thin history fallback
    expect(realizedVolFromCloses([100, 100, 100])).toBe(0.32);
    const flat = new Array(80).fill(100);
    const v = realizedVolFromCloses(flat); // zero variance -> clamped floor
    expect(v).toBeGreaterThanOrEqual(0.1);
    expect(v).toBeLessThanOrEqual(1.2);
    const wild = candles(120, 3).map((c) => c.c * (Math.random() ? 1 : 1)); // real series
    const v2 = realizedVolFromCloses(wild);
    expect(Number.isFinite(v2)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { hurst, macd, sortino } from "@/lib/quant/series";
import { probBS, generateStrategies } from "@/lib/models";

// Deterministic GBM-ish series so these assertions are reproducible.
function series(n: number, seed = 7): number[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const out: number[] = [100];
  for (let i = 1; i < n; i++) out.push(out[i - 1] * (1 + (rand() - 0.5) * 0.04));
  return out;
}

// A trending (momentum-persistent) and a mean-reverting generator, to prove the
// estimator actually discriminates rather than just staying in range.
function trending(n: number, seed = 7): number[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const out = [100];
  let m = 0;
  for (let i = 1; i < n; i++) {
    m = 0.85 * m + (rand() - 0.5) * 0.02;
    out.push(out[i - 1] * (1 + m));
  }
  return out;
}
function reverting(n: number, seed = 7): number[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const out = [100];
  for (let i = 1; i < n; i++) {
    const pull = ((100 - out[i - 1]) / 100) * 0.5;
    out.push(out[i - 1] * (1 + pull + (rand() - 0.5) * 0.04));
  }
  return out;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const overSeeds = (fn: (n: number, seed: number) => number[], n: number) =>
  Array.from({ length: 40 }, (_, i) => hurst(fn(n, i + 1)));

describe("hurst", () => {
  // Lag 64 used to be admitted at 65 samples, leaving a 1-element difference
  // series; std() -> 0 -> log(1e-9) = -20.7 dominated the regression slope.
  it("stays in [0,1] across the bar counts that used to blow up", () => {
    for (let n = 33; n <= 200; n++) {
      const h = hurst(series(n));
      expect(Number.isFinite(h), `H not finite at n=${n}`).toBe(true);
      expect(h, `H out of range at n=${n}`).toBeGreaterThanOrEqual(0);
      expect(h, `H out of range at n=${n}`).toBeLessThanOrEqual(1);
    }
  });

  it("no longer returns the -6.59 outlier at the 65/66-bar boundary", () => {
    expect(hurst(series(65))).toBeGreaterThan(0);
    expect(hurst(series(66))).toBeGreaterThan(0);
  });

  it("centres a random walk near 0.5 instead of the old ~0.19", () => {
    // The lag-std estimator was biased so low that a random walk always read
    // REVERT; raw R/S is biased the other way (~0.60), hence Anis-Lloyd.
    for (const n of [65, 120, 250]) {
      const med = median(overSeeds(series, n));
      expect(med, `random walk mis-centred at n=${n}`).toBeGreaterThan(0.4);
      expect(med, `random walk mis-centred at n=${n}`).toBeLessThan(0.6);
    }
  });

  it("separates trending from mean-reverting regimes", () => {
    for (const n of [65, 120, 250]) {
      const t = median(overSeeds(trending, n));
      const w = median(overSeeds(series, n));
      const r = median(overSeeds(reverting, n));
      expect(t, `trend not > walk at n=${n}`).toBeGreaterThan(w);
      expect(w, `walk not > revert at n=${n}`).toBeGreaterThan(r);
      expect(t, `trend below the 0.55 threshold at n=${n}`).toBeGreaterThan(0.55);
      expect(r, `revert above the 0.45 threshold at n=${n}`).toBeLessThan(0.45);
    }
  });

  it("the documented RANDOM regime is actually reachable", () => {
    // The old estimator never once produced 0.45 <= H <= 0.55 on a random walk.
    const inBand = overSeeds(series, 250).filter((h) => h >= 0.45 && h <= 0.55).length;
    expect(inBand).toBeGreaterThan(5);
  });

  it("falls back to 0.5 on degenerate input", () => {
    expect(hurst(series(31))).toBe(0.5);
    expect(hurst(new Array(80).fill(100))).toBe(0.5); // zero dispersion everywhere
    expect(hurst([1, 2, 3])).toBe(0.5);
  });
});

describe("macd", () => {
  const px = series(180);
  const { line, signal, histogram } = macd(px);

  it("keeps the signal null until it has `signal` real line values", () => {
    const firstLine = line.findIndex((v) => v != null);
    const firstSig = signal.findIndex((v) => v != null);
    expect(firstLine).toBeGreaterThan(0);
    // 9-period EMA seed needs 9 real samples, so the signal starts 8 bars later.
    expect(firstSig).toBe(firstLine + 8);
  });

  it("does not emit the fabricated first-bar crossover (hist != (1-k)*line)", () => {
    const firstLine = line.findIndex((v) => v != null);
    // Old behaviour: sig = line*k exactly, so hist = (1-k)*line and shared its sign.
    expect(histogram[firstLine]).toBeNull();
  });

  it("seeds the signal from real data — signal tracks the line, not zero", () => {
    const firstSig = signal.findIndex((v) => v != null);
    const l = line[firstSig] as number;
    const s = signal[firstSig] as number;
    // A properly seeded SMA sits within the local range of the line, never at ~20% of it.
    expect(Math.abs(s - l)).toBeLessThan(Math.abs(l) * 0.5);
  });

  it("histogram is null wherever either input is null", () => {
    histogram.forEach((h, i) => {
      if (line[i] == null || signal[i] == null) expect(h).toBeNull();
    });
  });
});

describe("sortino", () => {
  it("matches hand-computed downside deviation (was 3.58x overstated)", () => {
    const rets = [0.02, -0.01, 0.03, -0.012, 0.01, -0.008];
    // mean = 0.005; DD = sqrt((0.01^2 + 0.012^2 + 0.008^2)/6) = 0.0071647
    const expected = (0.005 / 0.0071647) * Math.sqrt(252);
    expect(sortino(rets)).toBeCloseTo(expected, 2);
    expect(sortino(rets)).toBeLessThan(15); // old formula gave 39.69
  });

  it("reports unbounded, not 0, when there is no downside", () => {
    // std([]) was 0 -> the guard returned 0, i.e. the WORST score for the BEST case.
    expect(sortino([0.01, 0.02, 0.03])).toBe(Infinity);
    expect(sortino([0.01, 0.02, -0.005, 0.03, 0.01])).toBeGreaterThan(50);
  });

  it("honours the target return rf in the denominator", () => {
    const rets = [0.01, 0.005, 0.02, 0.001];
    // With rf above some returns, those become shortfalls and DD > 0.
    expect(sortino(rets, 0.01)).not.toBe(sortino(rets, 0));
  });

  it("is 0 for an empty series", () => {
    expect(sortino([])).toBe(0);
  });
});

describe("probBS input clamping", () => {
  const base = { spot: 100, daysToExpiry: 30, iv: 0.3 };
  it("never returns NaN for a non-positive band", () => {
    for (const [low, high] of [
      [-50, 120],
      [-200, -100],
      [0, 120],
      [-1e6, 1e6],
    ]) {
      const p = probBS({ ...base, low, high });
      expect(Number.isNaN(p), `NaN for band ${low}..${high}`).toBe(false);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });
  it("still prices a normal band sensibly", () => {
    expect(probBS({ ...base, low: 95, high: 105 })).toBeGreaterThan(0.1);
    expect(probBS({ ...base, low: 95, high: 105 })).toBeLessThan(0.9);
  });
});

describe("strategy strikes stay positive and finite", () => {
  // A dragged band could go negative; every strategy card then rendered $NaN.
  for (const [low, high] of [
    [-120, -80],
    [-50, 10],
    [0.1, 0.2],
    [80, 120],
  ] as const) {
    it(`band ${low}..${high} yields finite money on every card`, () => {
      const strategies = generateStrategies({ spot: 100, low, high, daysToExpiry: 30, iv: 0.3 });
      expect(strategies.length).toBeGreaterThan(0);
      for (const s of strategies) {
        for (const l of s.legs) {
          expect(l.strike, `${s.id}: non-positive strike`).toBeGreaterThan(0);
          expect(Number.isFinite(l.premium), `${s.id}: NaN premium`).toBe(true);
        }
        expect(Number.isNaN(s.cost), `${s.id}: NaN cost`).toBe(false);
        expect(Number.isNaN(s.maxLoss), `${s.id}: NaN maxLoss`).toBe(false);
        expect(Number.isNaN(s.maxProfit), `${s.id}: NaN maxProfit`).toBe(false);
      }
    });
  }
});

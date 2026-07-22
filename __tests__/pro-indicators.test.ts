// The math that is ACTUALLY ON SCREEN. The old suite only tested
// lib/quant/series.ts — the twin the chart never imports — which is how a
// VWAP that reset its sums every bar (a date string compared against a string
// LENGTH) shipped as a default indicator on an education product. These tests
// import components/pro/indicators.ts, the module Chart.tsx draws from, and
// back the VERIFIED MATH ✓ badges on the legend.

import { describe, expect, it } from "vitest";
import { bollinger, ema, macd, rsi, sma, vwap, atr } from "@/components/pro/indicators";
import type { Bar } from "@/components/pro/chartCore";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const bar = (t: number, h: number, l: number, c: number, v: number, o = c): Bar => ({
  i: 0,
  t,
  o,
  h,
  l,
  c,
  v,
});

describe("sma / ema", () => {
  it("sma matches the hand-computed window", () => {
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out).toEqual([null, null, 2, 3, 4]);
  });

  it("ema uses α = 2/(n+1) and warms up from the first value", () => {
    const out = ema([10, 20, 30], 2); // α = 2/3
    expect(out[1]).toBeCloseTo(10 + (2 / 3) * 10, 10); // 16.666…
    expect(out[2]).toBeCloseTo((out[1] as number) + (2 / 3) * (30 - (out[1] as number)), 10);
  });
});

describe("rsi", () => {
  it("stays inside [0, 100] and reads directionally", () => {
    const up = rsi(Array.from({ length: 40 }, (_, i) => 100 + i), 14);
    const down = rsi(Array.from({ length: 40 }, (_, i) => 100 - i), 14);
    expect(up[39]).toBe(100); // pure gains
    expect(down[39]).toBe(0); // pure losses
    const mixed = rsi(Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i)), 14);
    for (const v of mixed) if (v != null) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of mixed) if (v != null) expect(v).toBeLessThanOrEqual(100);
  });
});

describe("macd", () => {
  const closes = Array.from({ length: 80 }, (_, i) => 100 + i * 0.5 + Math.sin(i / 3) * 2);
  const m = macd(closes);

  it("hist = line − signal wherever both are defined", () => {
    for (let i = 0; i < closes.length; i++) {
      if (m.line[i] != null && m.signal[i] != null) {
        expect(m.hist[i]).toBeCloseTo((m.line[i] as number) - (m.signal[i] as number), 10);
      } else {
        expect(m.hist[i]).toBeNull();
      }
    }
  });

  it("exposes the shape the legend reads: `hist`, not `histogram`", () => {
    // The legend once read .histogram off this object and silently rendered
    // nothing. The typed IndicatorData in Chart.tsx makes that a compile
    // error now; this pins the contract at runtime too.
    expect(Object.keys(m).sort()).toEqual(["hist", "line", "signal"]);
  });
});

describe("bollinger", () => {
  it("mid is the SMA and the bands sit symmetrically ±2σ", () => {
    const closes = [2, 4, 6, 8, 10, 12];
    const b = bollinger(closes, 3, 2);
    const s = sma(closes, 3);
    expect(b.mid).toEqual(s);
    for (let i = 2; i < closes.length; i++) {
      const m = b.mid[i] as number;
      expect((b.upper[i] as number) - m).toBeCloseTo(m - (b.lower[i] as number), 10);
      expect(b.upper[i] as number).toBeGreaterThan(m);
    }
  });
});

describe("vwap — the one we shipped broken", () => {
  it("REGRESSION: intraday sums are CUMULATIVE within a session, not reset per bar", () => {
    // Two hourly bars, same day. The broken version reset every bar, making
    // bar 2's VWAP its own typical price. The real VWAP is volume-weighted
    // across both.
    const t0 = Date.UTC(2026, 6, 20, 14); // intraday spacing (1h)
    const bars = [bar(t0, 110, 90, 100, 100), bar(t0 + HOUR, 210, 190, 200, 300)];
    const out = vwap(bars);
    const tp1 = (110 + 90 + 100) / 3; // 100
    const tp2 = (210 + 190 + 200) / 3; // 200
    const expected = (tp1 * 100 + tp2 * 300) / 400; // 175
    expect(out[1]).toBeCloseTo(expected, 10);
    expect(out[1]).not.toBeCloseTo(tp2, 5); // the broken behavior
  });

  it("resets at the session boundary on intraday bars", () => {
    const day1 = Date.UTC(2026, 6, 20, 14);
    const day2 = Date.UTC(2026, 6, 21, 14);
    const bars = [
      bar(day1, 110, 90, 100, 100),
      bar(day1 + HOUR, 210, 190, 200, 100),
      bar(day2, 55, 45, 50, 100), // new day → fresh anchor
    ];
    const out = vwap(bars);
    expect(out[2]).toBeCloseTo(50, 10); // day 2 starts over at its own typical price
    expect(out[1]).toBeCloseTo(150, 10); // day 1 stayed cumulative
  });

  it("anchors across the WHOLE series on daily bars — a per-bar 'session' VWAP of daily data is just typical price, which teaches nothing", () => {
    const t0 = Date.UTC(2026, 6, 1);
    const bars = [bar(t0, 110, 90, 100, 100), bar(t0 + DAY, 210, 190, 200, 300)];
    const out = vwap(bars);
    expect(out[1]).toBeCloseTo(175, 10); // cumulative, NOT 200
  });

  it("handles zero volume without inventing numbers", () => {
    const t0 = Date.UTC(2026, 6, 20, 14);
    const out = vwap([bar(t0, 110, 90, 100, 0)]);
    expect(out[0]).toBeNull();
  });
});

describe("atr", () => {
  it("first true range is high−low and stays positive", () => {
    const t0 = Date.UTC(2026, 6, 1);
    const bars = [bar(t0, 110, 90, 100, 1), bar(t0 + DAY, 130, 100, 120, 1)];
    const out = atr(bars, 1);
    expect(out[0]).toBeCloseTo(20, 10);
    for (const v of out) if (v != null) expect(v).toBeGreaterThan(0);
  });
});

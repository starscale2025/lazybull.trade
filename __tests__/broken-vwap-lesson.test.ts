import { describe, expect, it } from "vitest";
import { makeLessonTape, typicalPrice, vwapBroken } from "@/components/learn/broken-vwap-math";
import { vwap } from "@/components/pro/indicators";

// "Anatomy of a Broken VWAP" (/learn/broken-vwap) makes three factual claims
// on screen. A confession page that's wrong would be worse than no page —
// so each claim is pinned here, against the same modules the lesson renders.

describe("the lesson tape", () => {
  it("is deterministic — every visitor sees the same exhibit", () => {
    const a = makeLessonTape();
    const b = makeLessonTape();
    expect(a).toEqual(b);
    expect(a).toHaveLength(156); // 78 five-minute bars × 2 sessions
  });

  it("spans exactly two sessions with a gap-down open", () => {
    const bars = makeLessonTape();
    // UTC days — sessions are keyed by exchange time, not the viewer's clock.
    const d1 = new Date(bars[77].t).getUTCDate();
    const d2 = new Date(bars[78].t).getUTCDate();
    expect(d1).not.toBe(d2);
    expect(bars[78].o).toBeLessThan(bars[77].c); // day 2 gaps down
  });
});

describe("claim 1 — the broken line is typical price in a trench coat", () => {
  it("vwapBroken equals (H+L+C)/3 on every single bar", () => {
    const bars = makeLessonTape();
    const broken = vwapBroken(bars);
    const tp = typicalPrice(bars);
    for (let i = 0; i < bars.length; i++) {
      expect(broken[i]).toBeCloseTo(tp[i], 10);
    }
  });
});

describe("claim 2 — the fixed line carries real information", () => {
  it("diverges materially from typical price by the day-1 close (the on-page $ figure)", () => {
    const bars = makeLessonTape();
    const fixed = vwap(bars).map((v) => v ?? 0);
    const broken = vwapBroken(bars).map((v) => v ?? 0);
    // The caption prints |fixed − broken| at bar 77; it must be a visible gap,
    // not a rounding artifact.
    expect(Math.abs(fixed[77] - broken[77])).toBeGreaterThan(0.25);
  });
});

describe("claim 3 — the fixed line resets exactly once, at the session boundary", () => {
  it("day 2's first bar re-anchors; day 1's last bar stayed cumulative", () => {
    const bars = makeLessonTape();
    const fixed = vwap(bars).map((v) => v ?? 0);
    const tp = typicalPrice(bars);
    // First bar of a fresh anchor IS its own typical price…
    expect(fixed[78]).toBeCloseTo(tp[78], 10);
    // …and the day-1 close is NOT (the anchor held all session).
    expect(Math.abs(fixed[77] - tp[77])).toBeGreaterThan(0.1);
    // No mid-session resets: within day 1, VWAP never equals typical price
    // after the volume has had time to accumulate.
    for (let i = 30; i < 78; i++) {
      expect(Math.abs(fixed[i] - tp[i])).toBeGreaterThan(1e-6);
    }
  });
});

import { describe, expect, it } from "vitest";
import { ACTS, COPY_BEATS, colorGrade, seamDip } from "@/lib/cinema";
import { filmToScroll } from "@/components/scrollstory/cinema-metrics";
import { BULL_MARK, bullMarkSamples } from "@/lib/bull-mark";

// Scroll spent per unit of film around a film position: the tempo map's density.
const pace = (p: number, h = 0.002) => (filmToScroll(p + h) - filmToScroll(p - h)) / (2 * h);

describe("the tempo map (M31)", () => {
  it("brakes inside a beat and rushes across an act seam", () => {
    const safety = COPY_BEATS.find((b) => b.id === "safety")!;
    const inBeat = pace((safety.from + safety.to) / 2);
    const atSeam = pace(ACTS.candle.to);
    expect(inBeat).toBeGreaterThan(atSeam * 1.4);
  });
});

describe("one world, one grade (M27)", () => {
  it("is cold glass with the darks lifted in the dive, clean in the information frames", () => {
    const dive = colorGrade((ACTS.dive.from + ACTS.dive.to) / 2 + 0.02);
    expect(dive.toe).toBeCloseTo(0.3, 2);
    expect(dive.saturation).toBeLessThan(1);
    const safety = colorGrade((ACTS.safety.from + ACTS.safety.to) / 2);
    expect(safety.split).toBe(0);
    expect(safety.saturation).toBe(1);
  });
  it("dips exposure at each act seam, and only there", () => {
    expect(seamDip(ACTS.candle.to)).toBeCloseTo(0.35, 2);
    expect(seamDip((ACTS.safety.from + ACTS.safety.to) / 2)).toBeLessThan(1e-3);
    expect(colorGrade(ACTS.candle.to).exposure).toBeLessThan(colorGrade(ACTS.candle.to - 0.03).exposure);
  });
});

describe("the bull mark (M25)", () => {
  it("is a long strangle: horns up at both ends, a flat jaw", () => {
    expect(BULL_MARK[0]).toEqual([0, 0]);
    expect(BULL_MARK[BULL_MARK.length - 1]).toEqual([1, 0]);
    const jaw = BULL_MARK.filter(([, y]) => y > 0.8);
    expect(jaw.length).toBe(2);
    expect(jaw[0][1]).toBe(jaw[1][1]);
  });
  it("samples evenly along its length", () => {
    const pts = bullMarkSamples(200);
    expect(pts).toHaveLength(200);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[199][0]).toBeCloseTo(1, 6);
  });
});

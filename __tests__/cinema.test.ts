import { describe, expect, it } from "vitest";
import {
  ACTS,
  COPY_BEATS,
  beatOpacity,
  canvasOpacity,
  clamp01,
  flashOpacity,
  frameUrl,
  manifestSchema,
  progressToFrame,
} from "@/lib/cinema";

describe("ACTS", () => {
  it("covers [0,1] contiguously in order", () => {
    const order = ["boot", "assembly", "dive", "bull", "flash", "handoff"] as const;
    expect(ACTS[order[0]].from).toBe(0);
    expect(ACTS[order[order.length - 1]].to).toBe(1);
    for (let i = 1; i < order.length; i++) {
      expect(ACTS[order[i]].from).toBe(ACTS[order[i - 1]].to);
    }
  });
});

describe("COPY_BEATS", () => {
  it("has unique ids and windows inside [0,1]", () => {
    const ids = COPY_BEATS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of COPY_BEATS) {
      expect(b.from).toBeGreaterThanOrEqual(0);
      expect(b.to).toBeLessThanOrEqual(1);
      expect(b.to).toBeGreaterThan(b.from);
    }
  });
});

describe("clamp01", () => {
  it("clamps and neutralizes non-finite input", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
  });
});

describe("progressToFrame", () => {
  it("maps progress to clamped frame indices", () => {
    expect(progressToFrame(0, 160)).toBe(0);
    expect(progressToFrame(1, 160)).toBe(159);
    expect(progressToFrame(0.999, 160)).toBe(159);
    expect(progressToFrame(0.5, 160)).toBe(80);
    expect(progressToFrame(0.25, 4)).toBe(1);
    expect(progressToFrame(-1, 160)).toBe(0);
    expect(progressToFrame(NaN, 160)).toBe(0);
    expect(progressToFrame(0.5, 0)).toBe(0);
  });
});

describe("beatOpacity", () => {
  const beat = { from: 0.2, to: 0.4 };
  it("is 0 outside the window (inclusive edges)", () => {
    expect(beatOpacity(0.1, beat)).toBe(0);
    expect(beatOpacity(0.2, beat)).toBe(0);
    expect(beatOpacity(0.4, beat)).toBe(0);
    expect(beatOpacity(0.5, beat)).toBe(0);
  });
  it("ramps over the fade width and plateaus at 1", () => {
    expect(beatOpacity(0.215, beat, 0.03)).toBeCloseTo(0.5, 5);
    expect(beatOpacity(0.23, beat, 0.03)).toBe(1);
    expect(beatOpacity(0.3, beat, 0.03)).toBe(1);
    expect(beatOpacity(0.385, beat, 0.03)).toBeCloseTo(0.5, 5);
  });
  it("never exceeds 1 when the window is narrower than two fades", () => {
    const narrow = { from: 0.2, to: 0.22 };
    expect(beatOpacity(0.21, narrow, 0.03)).toBeLessThanOrEqual(1);
    expect(beatOpacity(0.21, narrow, 0.03)).toBeGreaterThan(0);
  });
});

describe("flashOpacity", () => {
  it("is a triangle over the flash act peaking mid-act", () => {
    expect(flashOpacity(0.5)).toBe(0);
    expect(flashOpacity(0.8)).toBe(0);
    expect(flashOpacity(0.86)).toBeCloseTo(1, 5);
    expect(flashOpacity(0.89)).toBeCloseTo(0.5, 5);
    expect(flashOpacity(0.92)).toBe(0);
    expect(flashOpacity(1)).toBe(0);
  });
});

describe("canvasOpacity", () => {
  it("holds 1 until handoff then fades to 0", () => {
    expect(canvasOpacity(0)).toBe(1);
    expect(canvasOpacity(0.9)).toBe(1);
    expect(canvasOpacity(0.92)).toBe(1);
    expect(canvasOpacity(0.96)).toBeCloseTo(0.5, 5);
    expect(canvasOpacity(1)).toBe(0);
  });
});

describe("frameUrl", () => {
  it("builds 1-based zero-padded webp paths", () => {
    expect(frameUrl("/cinema/frames/desktop", 0)).toBe("/cinema/frames/desktop/frame_0001.webp");
    expect(frameUrl("/cinema/frames/mobile", 159)).toBe("/cinema/frames/mobile/frame_0160.webp");
  });
});

describe("manifestSchema", () => {
  const valid = {
    desktop: { dir: "/cinema/frames/desktop", width: 1600, height: 1000, frameCount: 160 },
    mobile: { dir: "/cinema/frames/mobile", width: 800, height: 1200, frameCount: 160 },
  };
  it("parses a valid manifest", () => {
    expect(manifestSchema.parse(valid)).toEqual(valid);
  });
  it("rejects missing sets and bad numbers", () => {
    expect(() => manifestSchema.parse({ desktop: valid.desktop })).toThrow();
    expect(() =>
      manifestSchema.parse({ ...valid, desktop: { ...valid.desktop, frameCount: 0 } })
    ).toThrow();
  });
});

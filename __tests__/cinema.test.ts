import { describe, expect, it } from "vitest";
import {
  ACTS,
  ACT_ORDER,
  BULL3D,
  CANDLE3D,
  COPY_BEATS,
  beatOpacity,
  bull3dOpacity,
  candle3dOpacity,
  canvasOpacity,
  clamp01,
  flashOpacity,
} from "@/lib/cinema";

describe("ACTS", () => {
  it("covers [0,1] contiguously in ACT_ORDER", () => {
    expect(ACT_ORDER.length).toBe(9);
    expect(ACTS[ACT_ORDER[0]].from).toBe(0);
    expect(ACTS[ACT_ORDER[ACT_ORDER.length - 1]].to).toBe(1);
    for (let i = 1; i < ACT_ORDER.length; i++) {
      expect(ACTS[ACT_ORDER[i]].from).toBeCloseTo(ACTS[ACT_ORDER[i - 1]].to, 10);
    }
  });
  it("every act has positive width", () => {
    for (const a of ACT_ORDER) expect(ACTS[a].to).toBeGreaterThan(ACTS[a].from);
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
  it("each beat sits within some act window", () => {
    for (const b of COPY_BEATS) {
      const inside = ACT_ORDER.some((a) => b.from >= ACTS[a].from - 1e-9 && b.to <= ACTS[a].to + 1e-9);
      expect(inside, `beat ${b.id} spans an act boundary`).toBe(true);
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
});

describe("flashOpacity", () => {
  it("is a faint triangle over the start of the matrix act", () => {
    expect(flashOpacity(0.5)).toBe(0);
    expect(flashOpacity(ACTS.matrix.from)).toBe(0); // 0.84 edge
    expect(flashOpacity(0.872)).toBeCloseTo(1, 5); // mid of [0.84, 0.904]
    expect(flashOpacity(0.905)).toBe(0);
    expect(flashOpacity(1)).toBe(0);
  });
});

describe("canvasOpacity", () => {
  it("holds 1 almost to the end, then a short crossfade to 0", () => {
    expect(canvasOpacity(0)).toBe(1);
    expect(canvasOpacity(0.9)).toBe(1);
    expect(canvasOpacity(0.998)).toBe(1);
    expect(canvasOpacity(0.999)).toBeCloseTo(0.5, 5);
    expect(canvasOpacity(1)).toBe(0);
  });
});

describe("bull3dOpacity", () => {
  it("is 0 outside the bull window", () => {
    expect(bull3dOpacity(0)).toBe(0);
    expect(bull3dOpacity(BULL3D.in0)).toBe(0);
    expect(bull3dOpacity(BULL3D.out1)).toBe(0);
    expect(bull3dOpacity(1)).toBe(0);
  });
  it("fades in, holds opaque, then dissolves out", () => {
    expect(bull3dOpacity((BULL3D.in0 + BULL3D.in1) / 2)).toBeCloseTo(0.5, 5);
    expect(bull3dOpacity(BULL3D.in1)).toBe(1);
    expect(bull3dOpacity((BULL3D.in1 + BULL3D.out0) / 2)).toBe(1);
    expect(bull3dOpacity(BULL3D.out0)).toBe(1);
    expect(bull3dOpacity((BULL3D.out0 + BULL3D.out1) / 2)).toBeCloseTo(0.5, 5);
  });
  it("hands off cleanly: monotonic window, gone before the homepage resolve", () => {
    // The 2D Matrix rain starts mid-bull-act (~0.796), so the 3D fade-out overlaps
    // it. The bull must be fully gone before the homepage resolves (~0.86) so the
    // cinema's tail is purely 2D.
    expect(BULL3D.in0).toBeGreaterThanOrEqual(ACTS.consensus.from);
    expect(BULL3D.in0).toBeLessThan(BULL3D.in1);
    expect(BULL3D.in1).toBeLessThanOrEqual(BULL3D.out0);
    expect(BULL3D.out0).toBeLessThan(BULL3D.out1);
    expect(BULL3D.out1).toBeLessThanOrEqual(0.86);
  });
});

describe("candle3dOpacity", () => {
  it("is 0 outside the candle window", () => {
    expect(candle3dOpacity(0.3)).toBe(0);
    expect(candle3dOpacity(CANDLE3D.in0)).toBe(0);
    expect(candle3dOpacity(CANDLE3D.out1)).toBe(0);
    expect(candle3dOpacity(0.6)).toBe(0);
  });
  it("fades in, holds opaque through the foresight beats, dissolves out", () => {
    expect(candle3dOpacity((CANDLE3D.in0 + CANDLE3D.in1) / 2)).toBeCloseTo(0.5, 5);
    expect(candle3dOpacity(CANDLE3D.in1)).toBe(1);
    expect(candle3dOpacity(0.44)).toBe(1); // foresight beat
    expect(candle3dOpacity(0.52)).toBe(1); // vindication beat
    expect(candle3dOpacity((CANDLE3D.out0 + CANDLE3D.out1) / 2)).toBeCloseTo(0.5, 5);
  });
  it("stays inside the candle act", () => {
    expect(CANDLE3D.in0).toBeGreaterThanOrEqual(ACTS.candle.from - 1e-9);
    expect(CANDLE3D.out1).toBeLessThanOrEqual(ACTS.candle.to + 1e-9);
    expect(CANDLE3D.in0).toBeLessThan(CANDLE3D.in1);
    expect(CANDLE3D.in1).toBeLessThanOrEqual(CANDLE3D.out0);
    expect(CANDLE3D.out0).toBeLessThan(CANDLE3D.out1);
  });
});

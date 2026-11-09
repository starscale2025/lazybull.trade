import { describe, expect, it } from "vitest";
import {
  ACTS,
  ACT_ORDER,
  BULL3D,
  BULL3D_SHOW,
  CANDLE3D,
  DIVE3D,
  COPY_BEATS,
  beatOpacity,
  bull3dOpacity,
  candle3dOpacity,
  handoffOpacity,
  clamp01,
  dive3dOpacity,
} from "@/lib/cinema";
import { FILM_SPAN, holdOf } from "@/components/scrollstory/cinema-metrics";

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
  it("has unique ids and windows inside [0,1], bar the last one", () => {
    const ids = COPY_BEATS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const last = COPY_BEATS[COPY_BEATS.length - 1];
    for (const b of COPY_BEATS) {
      expect(b.from).toBeGreaterThanOrEqual(0);
      // The film's last line is held past 1 on purpose (M25): it is still up
      // when the hold begins and dissolves with the stage.
      expect(b.to).toBeLessThanOrEqual(b === last ? 1.05 : 1);
      expect(b.to).toBeGreaterThan(b.from);
    }
  });
  it("each beat sits within some act window", () => {
    for (const b of COPY_BEATS) {
      // the last act runs on through the hold, so its end is open
      const end = (a: (typeof ACT_ORDER)[number]) => (a === ACT_ORDER[ACT_ORDER.length - 1] ? Infinity : ACTS[a].to);
      const inside = ACT_ORDER.some((a) => b.from >= ACTS[a].from - 1e-9 && b.to <= end(a) + 1e-9);
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

describe("handoffOpacity (the hold is the hand-off, Gate A3 #3)", () => {
  it("holds, then dissolves across the hold, then leaves only the landing", () => {
    expect(handoffOpacity(0)).toBe(1);
    expect(handoffOpacity(0.08)).toBe(1);
    expect(handoffOpacity(0.5)).toBeCloseTo(0.5, 5);
    expect(handoffOpacity(0.92)).toBe(0);
    expect(handoffOpacity(1)).toBe(0);
  });
  it("only ever goes down as the hold is scrolled", () => {
    let last = 1;
    for (let h = 0; h <= 1; h += 0.01) {
      const o = handoffOpacity(h);
      expect(o).toBeLessThanOrEqual(last + 1e-12);
      last = o;
    }
  });
  it("takes the film's last line with it", () => {
    // The dissolve runs over the hold, which starts at film progress 1; the
    // last line ("Welcome in.", beside the mark) is still fully up there, so
    // it leaves with the stage rather than before it.
    const welcome = COPY_BEATS.find((b) => b.id === "welcome")!;
    expect(beatOpacity(1, welcome, welcome.fade)).toBe(1);
  });
});

describe("holdOf", () => {
  it("is 0 through the film and runs 0 → 1 over the hold", () => {
    expect(holdOf(0)).toBe(0);
    expect(holdOf(FILM_SPAN)).toBe(0);
    expect(holdOf(1)).toBe(1);
    expect(holdOf((FILM_SPAN + 1) / 2)).toBeCloseTo(0.5, 9);
    expect(holdOf(Number.NaN)).toBe(0);
  });
});

describe("bull3dOpacity", () => {
  it("is 0 outside the bull's visible window", () => {
    expect(bull3dOpacity(0)).toBe(0);
    expect(bull3dOpacity(BULL3D.in0)).toBe(0);
    expect(bull3dOpacity(BULL3D_SHOW.in0)).toBe(0);
    expect(bull3dOpacity(BULL3D.out1)).toBe(0);
    expect(bull3dOpacity(1)).toBe(0);
  });
  it("fades in, holds opaque, then dissolves out", () => {
    expect(bull3dOpacity((BULL3D_SHOW.in0 + BULL3D_SHOW.in1) / 2)).toBeCloseTo(0.5, 5);
    expect(bull3dOpacity(BULL3D_SHOW.in1)).toBe(1);
    expect(bull3dOpacity((BULL3D_SHOW.in1 + BULL3D_SHOW.out0) / 2)).toBe(1);
    expect(bull3dOpacity(BULL3D_SHOW.out0)).toBe(1);
    expect(bull3dOpacity((BULL3D_SHOW.out0 + BULL3D_SHOW.out1) / 2)).toBeCloseTo(0.5, 5);
  });
  it("leaves the vote alone on screen: the bull appears only once it clears", () => {
    // Gate A2, d11: shown from 0.71 the bull sat over the whole vote act.
    expect(BULL3D_SHOW.in0).toBeGreaterThanOrEqual(ACTS.consensus.to);
    // and the clock the charge runs on is untouched, so it still lands at full opacity
    expect(BULL3D_SHOW.out0).toBe(BULL3D.out0);
    expect(BULL3D_SHOW.out1).toBe(BULL3D.out1);
  });
  it("keeps the bull's copy off the charge", () => {
    const beat = COPY_BEATS.find((b) => b.id === "bull")!;
    // the charge runs over bull-clock 0.626 → 0.826 (Bull3D.tsx)
    const chargeFrom = BULL3D.in0 + 0.626 * (BULL3D.out1 - BULL3D.in0);
    expect(beat.from).toBeGreaterThanOrEqual(BULL3D_SHOW.in0);
    expect(beat.to).toBeLessThanOrEqual(chargeFrom + 0.005);
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

describe("dive3dOpacity", () => {
  it("is 0 outside the tunnel window and 1 through its hold", () => {
    expect(dive3dOpacity(0.1)).toBe(0);
    expect(dive3dOpacity(0.19)).toBe(1); // mid-tunnel
    expect(dive3dOpacity(DIVE3D.out1)).toBe(0);
    expect(dive3dOpacity(0.3)).toBe(0);
  });
  it("is already fully opaque on the frame the hero curtain lifts off", () => {
    // re-tribunal regression 5: a fade-in at 0.15 let the retired laptop show
    // through the corridor under the curtain
    expect(dive3dOpacity(ACTS.dive.from)).toBe(1);
    expect(dive3dOpacity(ACTS.dive.from - 0.01)).toBeGreaterThan(0);
    expect(dive3dOpacity(ACTS.dive.from - 0.01)).toBeLessThan(1);
  });
  it("spans the dive act and clears before the regime chart needs the frame", () => {
    expect(DIVE3D.in0).toBeGreaterThanOrEqual(ACTS.dive.from - 0.01);
    expect(DIVE3D.out1).toBeLessThanOrEqual(ACTS.regime.from + 0.01);
    expect(DIVE3D.in0).toBeLessThan(DIVE3D.in1);
    expect(DIVE3D.in1).toBeLessThanOrEqual(DIVE3D.out0);
    expect(DIVE3D.out0).toBeLessThan(DIVE3D.out1);
  });
});

describe("candle3dOpacity", () => {
  it("is 0 outside the candle window", () => {
    expect(candle3dOpacity(0.3)).toBe(0);
    expect(candle3dOpacity(CANDLE3D.in0)).toBe(0);
    expect(candle3dOpacity(CANDLE3D.out1)).toBe(0);
    // 0.605 is the tail now (the ice-lab beat widened it) — sample past it.
    expect(candle3dOpacity(0.61)).toBe(0);
  });
  it("fades in, holds opaque through the foresight beats, dissolves out", () => {
    expect(candle3dOpacity((CANDLE3D.in0 + CANDLE3D.in1) / 2)).toBeCloseTo(0.5, 5);
    expect(candle3dOpacity(CANDLE3D.in1)).toBe(1);
    expect(candle3dOpacity(0.44)).toBe(1); // foresight beat
    expect(candle3dOpacity(0.52)).toBe(1); // vindication beat
    expect(candle3dOpacity((CANDLE3D.out0 + CANDLE3D.out1) / 2)).toBeCloseTo(0.5, 5);
  });
  it("spans the candle act and clears before the next act's copy", () => {
    expect(CANDLE3D.in0).toBeGreaterThanOrEqual(ACTS.candle.from - 1e-9);
    // The ice-lab beat deliberately lets the 3D layer fade a hair PAST the act
    // boundary (a crossfade, so there's no black flash into safety). Two real
    // invariants replace the old "must end by ACTS.candle.to":
    //  1. it must be fully gone before the safety COPY takes the stage, and
    //  2. that spill must stay a short crossfade, not a whole overlapping beat.
    const safetyCopy = COPY_BEATS.find((b) => b.id === "safety")!;
    expect(CANDLE3D.out1).toBeLessThanOrEqual(safetyCopy.from + 1e-9);
    expect(CANDLE3D.out1 - ACTS.candle.to).toBeLessThanOrEqual(0.02 + 1e-9);
    expect(CANDLE3D.in0).toBeLessThan(CANDLE3D.in1);
    expect(CANDLE3D.in1).toBeLessThanOrEqual(CANDLE3D.out0);
    expect(CANDLE3D.out0).toBeLessThan(CANDLE3D.out1);
  });
});

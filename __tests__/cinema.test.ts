import { describe, expect, it } from "vitest";
import {
  ACTS,
  ACT_ORDER,
  CANDLE3D,
  COPY_BEATS,
  beatOpacity,
  candle3dOpacity,
  floorHandoff,
  handoffOpacity,
  clamp01,
  matterAt,
  matterNear,
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

describe("the one take (matterAt)", () => {
  it("is the river early on and the bull late, and is drawn only for those passages", () => {
    expect(matterAt(0.2).stage).toBe(0);
    expect(matterAt(0.75).stage).toBe(1);
    expect(matterNear(0.2)).toBe(true);
    expect(matterNear(0.5)).toBe(false);
    expect(matterNear(0.9)).toBe(true);
  });
  it("has landed the line by the time the curtain has lifted off the first words", () => {
    const dive = COPY_BEATS.find((b) => b.id === "dive")!;
    expect(matterAt(dive.from + 0.016).birth).toBe(1);
  });
  it("pours into the first candle as that candle starts to print", () => {
    expect(matterAt(CANDLE3D.in0 - 0.003).pour).toBe(0);
    expect(matterAt(CANDLE3D.in1).pour).toBe(1);
  });
  it("gathers on the vote as the vote clears, then forms the bull under its own words", () => {
    expect(matterAt(ACTS.consensus.to + 0.002).ringOn).toBe(1);
    expect(matterAt(ACTS.consensus.to - 0.016).ringOn).toBe(0);
    const beat = COPY_BEATS.find((b) => b.id === "bull")!;
    expect(matterAt(beat.to).swarm).toBe(1);
    // the words have started to leave before the last shot starts to form
    expect(matterAt(beat.to - (beat.fade ?? 0)).poster).toBe(0);
  });
  it("has the last shot standing before its words are read", () => {
    const welcome = COPY_BEATS.find((b) => b.id === "welcome")!;
    expect(matterAt(welcome.from + 0.022).poster).toBe(1);
    expect(matterAt(0.79).poster).toBe(0);
  });
  it("scrubs: every ramp only ever rises with progress", () => {
    let last = matterAt(0);
    for (let p = 0.001; p <= 1; p += 0.001) {
      const f = matterAt(p);
      for (const k of ["birth", "chop", "trend", "pour", "ringOn", "swarm", "poster"] as const) {
        expect(f[k]).toBeGreaterThanOrEqual(last[k]);
      }
      last = f;
    }
  });
});

describe("the floor line's hand-off", () => {
  it("starts on the chart after the chart has landed and reaches the payoff before it draws", () => {
    expect(floorHandoff(0.52)).toBe(0);
    expect(floorHandoff(ACTS.safety.from)).toBe(1);
  });
});

describe("candle3dOpacity", () => {
  it("is 0 outside the candle window", () => {
    expect(candle3dOpacity(0.3)).toBe(0);
    expect(candle3dOpacity(CANDLE3D.in0)).toBe(0);
    expect(candle3dOpacity(CANDLE3D.out1)).toBe(0);
    expect(candle3dOpacity(0.61)).toBe(0);
  });
  it("fades in, holds opaque through the foresight beats, dissolves out", () => {
    expect(candle3dOpacity((CANDLE3D.in0 + CANDLE3D.in1) / 2)).toBeCloseTo(0.5, 5);
    expect(candle3dOpacity(CANDLE3D.in1)).toBe(1);
    expect(candle3dOpacity(0.44)).toBe(1); // foresight beat
    expect(candle3dOpacity(0.5)).toBe(1); // vindication beat
    expect(candle3dOpacity((CANDLE3D.out0 + CANDLE3D.out1) / 2)).toBeCloseTo(0.5, 5);
  });
  it("spans the candle act and clears before the next act's copy", () => {
    expect(CANDLE3D.in0).toBeGreaterThanOrEqual(ACTS.candle.from - 1e-9);
    const safetyCopy = COPY_BEATS.find((b) => b.id === "safety")!;
    expect(CANDLE3D.out1).toBeLessThanOrEqual(safetyCopy.from + 1e-9);
    expect(CANDLE3D.out1).toBeLessThanOrEqual(ACTS.candle.to);
    expect(CANDLE3D.in0).toBeLessThan(CANDLE3D.in1);
    expect(CANDLE3D.in1).toBeLessThanOrEqual(CANDLE3D.out0);
    expect(CANDLE3D.out0).toBeLessThan(CANDLE3D.out1);
  });
});

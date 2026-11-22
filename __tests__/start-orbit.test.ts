import { describe, expect, it } from "vitest";
import { MAP_SECTORS, MAP_SYMBOLS, reading } from "@/lib/market/heatmap";
import { CHIP_EDGE, extremes, pickMovers, wingCapacity, wingPlaces } from "@/lib/start/chips";
import { depthQ, floorLayout, floorView, labelBox, project, quadOf, splitSides } from "@/lib/start/floor";
import {
  APPROACH_ENTER,
  APPROACH_FRESH_MS,
  APPROACH_LEAVE,
  APPROACH_STALE_MS,
  FRONT,
  TAU,
  Z_WORDMARK,
  arcAngle,
  depthBand,
  driftFactor,
  frontIndex,
  mixAngle,
  nextApproach,
  podAngle,
  podPose,
  restAngle,
  ringFor,
  stepSpin,
  turnToFront,
  wrapPi,
  type Spin,
} from "@/lib/start/orbit";

// /start as an orbit (2026-11-20): the market map drawn as a floor in
// perspective, and six page links circling a giant wordmark. The geometry
// lives in lib/start and is checked here; the browser only draws it.

describe("the floor", () => {
  const view = floorView(1440, 860, 500);
  const layout = floorLayout();

  it("places every ticker once, inside the square, with no overlaps", () => {
    expect(layout.tiles.map((t) => t.sym).sort()).toEqual([...MAP_SYMBOLS].sort());
    const eps = 1e-9;
    for (const t of layout.tiles) {
      expect(t.x0).toBeGreaterThanOrEqual(-eps);
      expect(t.x1).toBeLessThanOrEqual(1 + eps);
      expect(t.v0).toBeGreaterThanOrEqual(-eps);
      expect(t.v1).toBeLessThanOrEqual(1 + eps);
      expect(t.x1).toBeGreaterThan(t.x0);
      expect(t.v1).toBeGreaterThan(t.v0);
    }
    for (let i = 0; i < layout.tiles.length; i++)
      for (let j = i + 1; j < layout.tiles.length; j++) {
        const a = layout.tiles[i], b = layout.tiles[j];
        const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
        const ov = Math.min(a.v1, b.v1) - Math.max(a.v0, b.v0);
        expect(ox > 1e-7 && ov > 1e-7, `${a.sym} overlaps ${b.sym}`).toBe(false);
      }
  });

  it("splits the sectors into two sides of near-equal market cap, mirrored about the middle", () => {
    const cap = (side: typeof MAP_SECTORS) => side.reduce((a, s) => a + s.stocks.reduce((x, y) => x + y.cap, 0), 0);
    const [left, right] = splitSides();
    expect(left.length + right.length).toBe(MAP_SECTORS.length);
    expect(Math.abs(cap(left) - cap(right)) / (cap(left) + cap(right))).toBeLessThan(0.05);
    const leftNames = new Set(left.map((s) => s.name));
    for (const t of layout.tiles) {
      if (leftNames.has(t.sector)) expect(t.x1, t.sym).toBeLessThanOrEqual(0.5 + 1e-9);
      else expect(t.x0, t.sym).toBeGreaterThanOrEqual(0.5 - 1e-9);
    }
  });

  it("puts the biggest name of each side at the front, against the middle", () => {
    for (const sym of ["NVDA", "META"]) {
      const t = layout.tiles.find((x) => x.sym === sym)!;
      expect(t.v0, sym).toBeCloseTo(0, 9);
      expect(Math.min(Math.abs(t.x0 - 0.5), Math.abs(t.x1 - 0.5)), sym).toBeLessThan(1e-9);
    }
  });

  it("projects the front edge onto the bottom of the stage and never above the horizon", () => {
    expect(project(0.5, 0, view)).toMatchObject({ x: 720, y: 860, q: 1 });
    expect(project(0, 0, view).x).toBeCloseTo(720 - view.frontSpan / 2, 9);
    expect(project(1, 1, view).x).toBeCloseTo(720 + view.farSpan / 2, 9);
    for (const v of [0, 0.1, 0.5, 0.9, 1, 1.4, -0.2])
      for (const x of [0, 0.3, 1]) {
        const p = project(x, v, view);
        expect(p.y).toBeGreaterThanOrEqual(view.horizon);
        expect(p.y).toBeLessThanOrEqual(view.bottom);
      }
    expect(depthQ(1, view)).toBeCloseTo(view.farQ, 12);
  });

  it("keeps a tile's side edges straight: three points of one edge are collinear", () => {
    const x = 0.8;
    const [a, b, c] = [0.05, 0.4, 0.9].map((v) => project(x, v, view));
    const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    expect(Math.abs(cross)).toBeLessThan(1e-6);
  });

  it("thins rows with distance, and gives a label its room and its lean", () => {
    const near = quadOf({ x0: 0.5, x1: 0.6, v0: 0, v1: 0.1 }, view);
    const far = quadOf({ x0: 0.5, x1: 0.6, v0: 0.8, v1: 0.9 }, view);
    expect(near[0].y - near[3].y).toBeGreaterThan((far[0].y - far[3].y) * 2);
    const middle = labelBox({ x0: 0.45, x1: 0.55, v0: 0, v1: 0.3 }, view);
    expect(middle.lean).toBeCloseTo(0, 9); // straight up the middle
    const right = labelBox({ x0: 0.8, x1: 0.9, v0: 0, v1: 0.3 }, view);
    expect(right.lean).toBeGreaterThan(0); // leans in toward the vanishing point
    expect(right.width).toBeGreaterThan(0);
    expect(right.height).toBeGreaterThan(0);
  });
});

describe("the orbit", () => {
  const ring = { cx: 720, cy: 400, rx: 600, ry: 150 };
  const N = 6;

  it("draws a pod at the front big, bright and over the wordmark; at the back small, dim and behind", () => {
    const front = podPose(FRONT, ring);
    const back = podPose(-FRONT, ring);
    expect(front).toMatchObject({ x: 720, y: 550 });
    expect(back.y).toBe(250);
    expect(front.scale).toBeCloseTo(1.04, 9);
    expect(back.scale).toBeCloseTo(0.8, 9);
    expect(front.opacity).toBe(1);
    expect(back.opacity).toBeCloseTo(0.62, 9);
    expect(front.z).toBeGreaterThan(Z_WORDMARK);
    expect(back.z).toBeLessThan(Z_WORDMARK);
  });

  it("softens a pod in three steps: the back, the sides, the front", () => {
    expect(depthBand(Math.sin(-FRONT))).toBe("back");
    expect(depthBand(Math.sin(0))).toBe("side");
    expect(depthBand(Math.sin(Math.PI))).toBe("side");
    expect(depthBand(Math.sin(FRONT))).toBe("front");
    let changes = 0;
    for (let k = 1; k <= 360; k++) if (depthBand(Math.sin((k / 360) * TAU)) !== depthBand(Math.sin(((k - 1) / 360) * TAU))) changes++;
    expect(changes).toBe(4); // a full turn crosses each of the two edges twice
  });

  it("drifts the front of the ring a fifth further against the pointer than the back", () => {
    expect(driftFactor(-1)).toBe(1);
    expect(driftFactor(0)).toBeCloseTo(1.1, 12);
    expect(driftFactor(1)).toBeCloseTo(1.2, 12);
  });

  it("counts a pod as approached only for a pointer on the move, and lets it go a little later", () => {
    const moving = APPROACH_FRESH_MS - 1;
    const resting = APPROACH_FRESH_MS + 1;
    expect(nextApproach(null, [0, 0.5, 0.2], moving)).toBe(1);
    // a pod drifting past a parked pointer is not approached
    expect(nextApproach(null, [0, 0.5, 0.2], resting)).toBeNull();
    // not near enough yet
    expect(nextApproach(null, [APPROACH_ENTER - 0.01, 0, 0], moving)).toBeNull();
    // caught, it is kept while still in reach, even with the pointer at rest...
    expect(nextApproach(1, [0, APPROACH_LEAVE + 0.01, 0], resting)).toBe(1);
    // ...and let go once out of reach
    expect(nextApproach(1, [0, APPROACH_LEAVE - 0.01, 0], moving)).toBeNull();
    // another pod takes over only when clearly nearer: no flicker between two
    expect(nextApproach(1, [0.9, 0.5, 0], moving)).toBe(0);
    expect(nextApproach(1, [0.55, 0.5, 0], moving)).toBe(1);
    // a pointer that has rested a long while is no longer reaching for it
    expect(nextApproach(1, [0, 0.9, 0], APPROACH_STALE_MS + 1)).toBeNull();
    expect(nextApproach(1, [0, 0.9, 0], APPROACH_STALE_MS - 1)).toBe(1);
  });

  it("changes layers only at the ring's two ends", () => {
    for (let k = 0; k < 360; k++) {
      const theta = (k / 360) * TAU;
      const p = podPose(theta, ring);
      expect(p.z > Z_WORDMARK, `at ${k}°`).toBe(Math.sin(theta) >= 0);
      expect(p.z).not.toBe(Z_WORDMARK);
    }
  });

  it("fans the pods out evenly at rest, the middle pair nearest the front", () => {
    const rest = restAngle(N);
    const depths = Array.from({ length: N }, (_, i) => Math.sin(podAngle(i, rest, N)));
    expect(depths[2]).toBeCloseTo(depths[3], 9);
    expect(depths[2]).toBeGreaterThan(depths[1]);
    expect(depths[0]).toBeCloseTo(depths[5], 9);
    expect(depths[0]).toBeLessThan(0); // the outer pair wait at the back
  });

  it("lays the still arc left to right across the front, evenly, none behind the wordmark", () => {
    const xs = Array.from({ length: N }, (_, i) => podPose(arcAngle(i, N), ring).x);
    for (let i = 1; i < N; i++) expect(xs[i] - xs[i - 1]).toBeCloseTo(xs[1] - xs[0], 6);
    expect(xs[0]).toBeLessThan(xs[5]);
    for (let i = 0; i < N; i++) expect(podPose(arcAngle(i, N), ring).depth).toBeGreaterThan(0);
  });

  it("names the pod at the front and turns to another by the short way", () => {
    const rest = restAngle(N);
    for (let i = 0; i < N; i++) {
      const turn = turnToFront(i, rest, N);
      expect(Math.abs(turn)).toBeLessThanOrEqual(Math.PI + 1e-9);
      expect(wrapPi(podAngle(i, rest + turn, N) - FRONT)).toBeCloseTo(0, 9);
      expect(frontIndex(rest + turn, N)).toBe(i);
    }
    expect(wrapPi(TAU + 0.25)).toBeCloseTo(0.25, 12);
    expect(mixAngle(0.1, TAU - 0.1, 0.5)).toBeCloseTo(0, 9); // across the seam, not the long way
  });

  it("lets a flick die away into the cruise, stops when held, and eases to a goal", () => {
    const cruise = TAU / 80;
    let s: Spin = { angle: 0, vel: 3, goal: null };
    for (let i = 0; i < 600; i++) s = stepSpin(s, 1 / 60, { cruise, hold: false });
    expect(s.vel).toBeCloseTo(cruise, 4);
    expect(s.angle).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) s = stepSpin(s, 1 / 60, { cruise, hold: true });
    expect(Math.abs(s.vel)).toBeLessThan(1e-4);
    s = { angle: 1, vel: 0, goal: 2 };
    for (let i = 0; i < 180 && s.goal != null; i++) s = stepSpin(s, 1 / 60, { cruise, hold: false });
    expect(s).toEqual({ angle: 2, vel: 0, goal: null });
    expect(stepSpin({ angle: 1, vel: 1, goal: null }, 0, { cruise, hold: false })).toEqual({ angle: 1, vel: 1, goal: null });
  });

  it("sizes the ring so pods change layers clear of the letters and stay on the stage", () => {
    const wide = ringFor({ width: 1440, horizon: 500 }, { halfWidth: 465, fontSize: 266 }, { width: 200 });
    expect(wide.rx).toBeGreaterThanOrEqual(465 + 120);
    expect(wide.rx + 200 * 0.45).toBeLessThanOrEqual(720 - 8 + 1e-9);
    expect(wide.cy).toBeLessThan(500);
    expect(wide.cy + wide.ry).toBeGreaterThan(500); // the front of the ring dips below the horizon
    expect(wide.cy - wide.ry).toBeLessThan(500 - 266 * 0.72); // the back clears the tall letters
  });
});

describe("the movers", () => {
  const day = { A: -6.5, B: -0.2, C: 3.1, D: 0.4, E: -2.2, F: 9, G: 1.5, H: -0.9, I: 2.8 };

  it("picks the day's six biggest moves whatever their direction, worst to best", () => {
    expect(pickMovers(day).map(([s]) => s)).toEqual(["A", "E", "G", "I", "C", "F"]);
    // a lopsided day is shown as it is, not balanced three and three
    const up = { A: 4, B: 5, C: 6, D: 7, E: 8, F: -3, G: 0.1 };
    expect(pickMovers(up).map(([, p]) => p)).toEqual([-3, 4, 5, 6, 7, 8]);
    expect(pickMovers({ A: 1, B: Number.NaN })).toEqual([["A", 1]]);
  });

  it("gives a small stage the day's worst and best", () => {
    expect(extremes(day)).toEqual([["A", -6.5], ["F", 9]]);
    expect(extremes({ A: 2 })).toEqual([["A", 2]]);
  });

  it("lays the wings out as mirror images, inner highest, all on the stage", () => {
    const stage = { width: 1440, horizon: 431, fontSize: 268 };
    const p = wingPlaces(6, stage);
    expect(p).toHaveLength(6);
    for (let i = 0; i < 3; i++) {
      expect(p[i].x + p[5 - i].x).toBeCloseTo(1440, 6);
      expect(p[i].y).toBeCloseTo(p[5 - i].y, 6);
    }
    for (let i = 1; i < 6; i++) expect(p[i].x).toBeGreaterThan(p[i - 1].x);
    expect(p[2].y).toBeLessThan(p[1].y); // inner is higher (smaller y) than the middle
    expect(p[1].y).toBeLessThan(p[0].y);
    for (const q of p) {
      expect(q.x).toBeGreaterThanOrEqual(CHIP_EDGE);
      expect(q.x).toBeLessThanOrEqual(1440 - CHIP_EDGE);
      expect(q.y).toBeGreaterThan(20); // below the top of the sky
      expect(q.y).toBeLessThan(stage.horizon);
    }
  });

  it("drops the outer pair on a narrow stage, and keeps fewer movers balanced", () => {
    expect(wingCapacity({ width: 1440, horizon: 431, fontSize: 268 })).toBe(6);
    const narrow = { width: 1024, horizon: 417, fontSize: 210 };
    expect(wingCapacity(narrow)).toBe(4);
    const four = wingPlaces(6, narrow);
    expect(four).toHaveLength(4);
    expect(four[0].x).toBeGreaterThanOrEqual(CHIP_EDGE);
    expect(four[0].x + four[3].x).toBeCloseTo(1024, 6);
    const two = wingPlaces(2, { width: 1440, horizon: 431, fontSize: 268 });
    expect(two[0].x + two[1].x).toBeCloseTo(1440, 6);
    expect(wingPlaces(0, { width: 1440, horizon: 431, fontSize: 268 })).toEqual([]);
  });

  it("keeps every mover clear of the pods turning at the back of the ring", () => {
    // real window shapes, sized the way start.module.css sizes the stage (rem is 17.6px on this site)
    const shapes = [[1440, 793], [1440, 900], [1920, 1080], [2560, 1300], [1280, 720], [1366, 768], [1200, 800], [1100, 700], [1024, 768]].map(([w, h]) => {
      const stageH = Math.max(40 * 17.6, h - (2.75 * 17.6 + 1));
      return [w, stageH * 0.58, Math.max(5 * 17.6, Math.min(w * 0.205, stageH * 0.36, 15.5 * 17.6))];
    });
    for (const [width, horizon, fontSize] of shapes) {
      const ring = ringFor({ width, horizon }, { halfWidth: fontSize * 1.42, fontSize }, { width: 210 });
      // and the three places of a wing never touch each other
      const places = wingPlaces(6, { width, horizon, fontSize });
      for (let i = 1; i < places.length / 2; i++) expect(Math.abs(places[i].y - places[i - 1].y), `${width}px wing step`).toBeGreaterThanOrEqual(40);
      for (const q of places) expect(q.y - 17, `${width}px: under the navbar`).toBeGreaterThan(16);
      const chips = wingPlaces(6, { width, horizon, fontSize }).map((c) => ({ l: c.x - 64, r: c.x + 64, t: c.y - 17, b: c.y + 17 }));
      for (let k = 0; k < 360; k += 2) {
        const pose = podPose((k / 360) * TAU, ring);
        const half = { w: (210 * pose.scale) / 2, h: (60 * pose.scale) / 2 };
        for (const c of chips) {
          const apart = pose.x + half.w < c.l || pose.x - half.w > c.r || pose.y + half.h < c.t || pose.y - half.h > c.b;
          expect(apart, `${width}px, pod at ${k}°`).toBe(true);
        }
      }
    }
  });
});

describe("the day's reading", () => {
  it("counts the day, ranks the movers and scales mood and heat", () => {
    const r = reading({ A: 3, B: 1, C: -2, D: -0.5, E: 0 })!;
    expect(r).toMatchObject({ up: 2, down: 2, breadth: 0 });
    expect(r.best.map(([s]) => s)).toEqual(["A", "B"]);
    expect(r.worst.map(([s]) => s)).toEqual(["C", "D"]);
    expect(r.heat).toBeGreaterThan(0);
    expect(reading({ A: 4, B: 5 })!.breadth).toBe(1);
    expect(reading({ A: -4, B: -5 })!.breadth).toBe(-1);
    expect(reading({ A: 0.1 })!.heat).toBe(0);
    expect(reading({ A: 9 })!.heat).toBe(1);
    expect(reading({})).toBeNull();
  });
});

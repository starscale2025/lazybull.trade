// The market floor on /start: the map laid flat and drawn in perspective, the
// front edge at the bottom of the stage and the back edge on the horizon.
//
// Pure geometry, no canvas and no DOM. The floor has its own flat square:
// x runs across (0 left, 1 right) and v runs deep (0 the front edge, 1 the
// horizon). project() takes a point of that square to the screen. Both screen
// coordinates are affine in one depth factor q, so every tile edge stays a
// straight line and a tile is always a clean quad.
//
// The layout puts the biggest names front and centre: the sectors are split
// into two sides of near-equal market cap, each side is laid out from the
// middle outward, and the left side is mirrored.

import { MAP_SECTORS, type MapSector } from "@/lib/market/heatmap";
import { squarify } from "@/lib/viz/treemap";

export type FloorTile = { sym: string; sector: string; x0: number; x1: number; v0: number; v1: number };
export type FloorSector = { name: string; x0: number; x1: number; v0: number; v1: number };
export type FloorLayout = { tiles: FloorTile[]; sectors: FloorSector[] };

/** How the flat floor meets the screen, in CSS pixels of the canvas. */
export type FloorView = {
  width: number;
  /** y of the horizon and of the front edge. */
  horizon: number;
  bottom: number;
  /** Width the whole floor spans at the front edge and at the back. */
  frontSpan: number;
  farSpan: number;
  /** Depth factor at the back edge (1 at the front): how close the floor gets to the horizon. */
  farQ: number;
  /** How fast rows thin out with distance; 1 is even, higher crowds the back. */
  gamma: number;
};

const cap = (s: MapSector) => s.stocks.reduce((a, x) => a + x.cap, 0);

/** Two sides of near-equal market cap: biggest sector first, each to the lighter side. */
export function splitSides(sectors: MapSector[] = MAP_SECTORS): [MapSector[], MapSector[]] {
  const sides: [MapSector[], MapSector[]] = [[], []];
  const weight = [0, 0];
  for (const s of [...sectors].sort((a, b) => cap(b) - cap(a))) {
    const i = weight[1] < weight[0] ? 1 : 0;
    sides[i].push(s);
    weight[i] += cap(s);
  }
  // The heavier first pick (technology) goes right, where a reader's eye lands second.
  return [sides[1], sides[0]];
}

/**
 * Every stock placed once in the flat square. `sideAspect` is the width of one
 * side over its depth as it will appear on screen, so tiles come out roughly
 * square once projected.
 */
export function floorLayout(sectors: MapSector[] = MAP_SECTORS, sideAspect = 2.2): FloorLayout {
  const out: FloorLayout = { tiles: [], sectors: [] };
  const [left, right] = splitSides(sectors);
  [left, right].forEach((side, sideIndex) => {
    // Local x runs from the middle of the floor (0) outward (sideAspect).
    const toX = (lx: number) => (sideIndex === 1 ? 0.5 + (0.5 * lx) / sideAspect : 0.5 - (0.5 * lx) / sideAspect);
    const span = (a: number, b: number) => {
      const p = toX(a);
      const q = toX(b);
      return p < q ? ([p, q] as const) : ([q, p] as const);
    };
    const rects = squarify(side.map((s) => ({ value: cap(s), data: s })), { x: 0, y: 0, w: sideAspect, h: 1 });
    for (const r of rects) {
      const [sx0, sx1] = span(r.x, r.x + r.w);
      out.sectors.push({ name: r.data.name, x0: sx0, x1: sx1, v0: r.y, v1: r.y + r.h });
      for (const t of squarify(r.data.stocks.map((x) => ({ value: x.cap, data: x })), r)) {
        const [x0, x1] = span(t.x, t.x + t.w);
        out.tiles.push({ sym: t.data.sym, sector: r.data.name, x0, x1, v0: t.y, v1: t.y + t.h });
      }
    }
  });
  return out;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** The depth factor: 1 at the front edge, farQ at the back. */
export function depthQ(v: number, view: FloorView): number {
  return view.farQ + (1 - view.farQ) * Math.pow(1 - clamp01(v), view.gamma);
}

/** A point of the flat floor on the screen. */
export function project(x: number, v: number, view: FloorView): { x: number; y: number; q: number } {
  const q = depthQ(v, view);
  const near = (q - view.farQ) / (1 - view.farQ); // 1 at the front, 0 at the back
  const span = view.farSpan + (view.frontSpan - view.farSpan) * near;
  return { x: view.width / 2 + (x - 0.5) * span, y: view.horizon + (view.bottom - view.horizon) * q, q };
}

export type Quad = [nearLeft: { x: number; y: number }, nearRight: { x: number; y: number }, farRight: { x: number; y: number }, farLeft: { x: number; y: number }];

/** A tile (or any rectangle of the floor) as its four screen corners. */
export function quadOf(r: { x0: number; x1: number; v0: number; v1: number }, view: FloorView): Quad {
  return [project(r.x0, r.v0, view), project(r.x1, r.v0, view), project(r.x1, r.v1, view), project(r.x0, r.v1, view)];
}

/**
 * Where a tile's label goes: its centre, the room it has, and the lean of its
 * centre line (screen x per screen y), so type can be painted on the floor.
 */
export function labelBox(r: { x0: number; x1: number; v0: number; v1: number }, view: FloorView) {
  const xm = (r.x0 + r.x1) / 2;
  const near = project(xm, r.v0, view);
  const far = project(xm, r.v1, view);
  const mid = { x: (near.x + far.x) / 2, y: (near.y + far.y) / 2 };
  // the tile's width where the label sits: halfway up the quad on screen
  const qMid = (near.q + far.q) / 2;
  const nearT = (qMid - view.farQ) / (1 - view.farQ);
  const width = (r.x1 - r.x0) * (view.farSpan + (view.frontSpan - view.farSpan) * nearT);
  const height = near.y - far.y;
  return { x: mid.x, y: mid.y, width, height, lean: height > 0 ? (near.x - far.x) / height : 0 };
}

/** The view for a stage of this size with the horizon at `horizon` px. */
export function floorView(width: number, height: number, horizon: number): FloorView {
  // a gentle splay: the front edge is 1.45 times the back, so the floor recedes without rushing at the viewer
  return { width, horizon, bottom: height, frontSpan: width * 1.45, farSpan: width, farQ: 0.02, gamma: 1.6 };
}

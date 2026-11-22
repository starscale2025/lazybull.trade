// The day's movers on /start: which ones float in the sky, and where. Pure
// maths, no DOM.
//
// They float on two mirrored wings, three a side, stepping down and outward
// from the arc of words and staying above the ring the pages turn on. The
// layout is symmetrical; the data is not forced to be. The places hold the
// day's six biggest moves, whatever their direction, read left to right from
// the worst to the best: a day with five gainers shows five gainers.
//
// A small screen has no wings: its two movers (the day's worst and best) sit
// in a row along the top of the stage, laid out by the browser so that no chip
// can leave the screen whatever its width (start.module.css, .chipRow).

/** The wings, in wordmark font sizes: how far out from the middle, how high above the horizon. Inner first. */
export const WING = [
  { out: 1.6, up: 1.46 },
  { out: 1.95, up: 1.24 },
  { out: 2.3, up: 1.02 },
] as const;
/** How near a chip's centre may come to the stage's edge. */
export const CHIP_EDGE = 78;

export type Mover = [sym: string, move: number];
export type Place = { x: number; y: number };

const finite = (moves: Record<string, number>): Mover[] => Object.entries(moves).filter(([, p]) => Number.isFinite(p));
const byValue = (a: Mover, b: Mover) => a[1] - b[1] || a[0].localeCompare(b[0]);

/** The day's n biggest moves, whatever their direction, ordered from the worst to the best. */
export function pickMovers(moves: Record<string, number>, n = 6): Mover[] {
  return finite(moves)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, n)
    .sort(byValue);
}

/** The day's worst and best moves, for a stage with room for only two. */
export function extremes(moves: Record<string, number>): Mover[] {
  const all = finite(moves).sort(byValue);
  return all.length > 1 ? [all[0], all[all.length - 1]] : all;
}

type Stage = { width: number; horizon: number; fontSize: number };

/** How far the wings must be pulled in to keep `pairs` places a side on the stage (1: not at all). */
const squeeze = (stage: Stage, pairs: number) => Math.min(1, (stage.width / 2 - CHIP_EDGE) / (WING[pairs - 1].out * stage.fontSize));

/**
 * How many movers a stage has room for: six, or four on a narrow one, where
 * the outer pair would have to crowd in over the pods turning at the back.
 */
export function wingCapacity(stage: Stage): number {
  return squeeze(stage, 3) >= 0.95 ? 6 : 4;
}

/**
 * Where `count` movers float on a wide stage: chip centres in stage pixels,
 * left to right, mirrored about the middle. With fewer than the stage has room
 * for, the places fill from the middle outward, so the wings stay balanced.
 */
export function wingPlaces(count: number, stage: Stage): Place[] {
  const pairs = wingCapacity(stage) / 2;
  const half = stage.width / 2;
  const fs = stage.fontSize;
  const k = squeeze(stage, pairs);
  const wing = WING.slice(0, pairs);
  const at = (side: -1 | 1, p: (typeof WING)[number]): Place => ({ x: half + side * p.out * fs * k, y: stage.horizon - p.up * fs });
  // left to right: the outer places on the left, inward, then outward on the right
  const all = [...[...wing].reverse().map((p) => at(-1, p)), ...wing.map((p) => at(1, p))];
  // the middle pair first, then outward, alternating sides
  const middleOut = all.map((_, i) => i).sort((a, b) => Math.abs(a - (all.length - 1) / 2) - Math.abs(b - (all.length - 1) / 2) || a - b);
  return middleOut
    .slice(0, Math.max(0, Math.min(count, all.length)))
    .sort((a, b) => a - b)
    .map((i) => all[i]);
}

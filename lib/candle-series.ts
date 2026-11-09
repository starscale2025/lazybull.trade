import { CANDLE3D, CANDLE_BUILD_END } from "./cinema";

/**
 * THE CANDLE ACT'S PRICE SERIES (CandleField3D), as plain numbers, so the
 * sound, the act rail and the tests can key to the same candles the picture
 * prints rather than to a progress value typed in again (Gate A4 #3: the
 * crash used to land at three different instants).
 *
 * Deterministic: climb to a peak, crash, then a floor chop. World y is price.
 */

export const N = 48;
/** Spacing along x (time). */
export const SP = 1.05;
/** The peak: the climb ends here and the crash begins. */
export const DIVERGE = 26;
export const CRASH_END = 42;
export const SPAN = CRASH_END * SP;

export type SeriesCandle = { x: number; cy: number; h: number; up: boolean; wl: number; wh: number; o: number; c: number };

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const CANDLES: SeriesCandle[] = (() => {
  const rnd = mulberry32(77);
  const prices: number[] = [];
  let p = 2.4;
  for (let i = 0; i <= N; i++) {
    if (i < DIVERGE) p += 0.46 + (rnd() - 0.5) * 0.6; // climb
    else if (i < CRASH_END) p -= 1.2 + (rnd() - 0.5) * 0.85; // crash (steeper)
    else p += (rnd() - 0.5) * 0.3; // floor chop
    prices.push(Math.max(0.4, p));
  }
  const out: SeriesCandle[] = [];
  for (let i = 0; i < N; i++) {
    const o = prices[i];
    const c = prices[i + 1];
    const wick = 0.22 + rnd() * 0.45;
    out.push({
      x: i * SP,
      cy: (o + c) / 2,
      h: Math.max(0.22, Math.abs(c - o)),
      up: c >= o,
      wl: Math.min(o, c) - wick,
      wh: Math.max(o, c) + wick,
      o,
      c,
    });
  }
  return out;
})();

export const PEAK_Y = CANDLES[DIVERGE].cy;
/** The price at the top of the climb: the close of the last green candle. */
export const PEAK_PRICE = Math.max(...CANDLES.map((c) => c.c));

/** The first red candle: the one that closes down off the peak. */
export const FIRST_RED_I = CANDLES.findIndex((c) => !c.up);

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * How far the chart has printed, 0..1. The timeline completes at
 * CANDLE_BUILD_END, before the window's out0: the act's tail is the lab's.
 */
export const buildAt = (progress: number) =>
  clamp((progress - CANDLE3D.in0) / (CANDLE_BUILD_END - CANDLE3D.in0), 0, 1);
/** The print head, in candles: candle i grows while this runs from i to i + 1. */
export const revealF = (progress: number) => clamp(buildAt(progress) / 0.9, 0, 1) * N;
/** Film progress at which candle `i` (fractional) starts to print: revealF's inverse. */
export const candlePrintAt = (i: number) => CANDLE3D.in0 + 0.9 * (i / N) * (CANDLE_BUILD_END - CANDLE3D.in0);

/**
 * THE CRASH, as one frame: the first red print (≈0.404). The sound's hit,
 * the rail's "the crash" row and the camera's trauma all key to it. "Then
 * the floor goes." comes up a beat earlier (CANDLE_CRASH_FROM, 0.385), a
 * deliberate pre-lap.
 */
export const CANDLE_CRASH_AT = candlePrintAt(FIRST_RED_I);

/**
 * THE FLOOR AT K1 (Gate A4 #3, M26 as corrected): the visitor's long strike,
 * with the peak as SIM 100. The price falls through it; what stops there is
 * the loss.
 */
export const floorY = (k1: number) => PEAK_PRICE * (k1 / 100);

/**
 * Where on the print head (in candles, fractional) the falling price first
 * reaches `y`: inside the first crash candle whose close is at or under it.
 * A floor above the peak is reached at the first red print.
 */
export function floorReachF(y: number): number {
  for (let i = FIRST_RED_I; i < N; i++) {
    const c = CANDLES[i];
    if (c.up || c.c > y) continue;
    if (c.o <= y) return i;
    return i + (c.o - y) / (c.o - c.c);
  }
  return FIRST_RED_I;
}

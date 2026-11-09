import { priceOption } from "./pricing";

/**
 * THE EXAMPLE SPREAD, shared by every surface that lets a visitor shape it:
 * the touchable payoff under frame zero's headline (components/HeroPosition)
 * and the landing's instrument (components/PayoffInstrument). A bull call
 * spread on SIM, a synthetic index at 100, priced by the same Black-Scholes
 * engine as /trade. Nothing here names a real security or a target.
 *
 * Both surfaces publish to lib/hero-position.ts, so a spread set on one is the
 * spread on the other, and on the film's safety act.
 */

export const SPOT = 100;
export const DAYS = 30;
export const IV = 0.22;
export const RATE = 0.045;
export const T = DAYS / 365;

/** The price axis both surfaces draw, and the strikes' bounds. */
export const S_MIN = 76;
export const S_MAX = 116;
export const K_MIN = 80;
export const K_MAX = 114;
/** The narrowest spread the handles allow. */
export const GAP = 2;
/** The example: what a visitor sees until they move a strike. */
export const START_STRIKES = { k1: 100, k2: 108 } as const;

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const money = (v: number) => `$${Math.round(Math.abs(v)).toLocaleString("en-US")}`;

export const call = (s: number, k: number, t = T) => priceOption(s, k, t, RATE, IV, "C").price;

/** The three numbers the decision turns on. */
export function figures(k1: number, k2: number) {
  const c1 = call(SPOT, k1);
  const c2 = call(SPOT, k2);
  const debit = c1 - c2;
  return { c1, c2, debit, maxLoss: debit * 100, maxProfit: (k2 - k1 - debit) * 100, breakeven: k1 + debit };
}

/** Clamp a strike move against the other strike, as every gesture does. */
export function placeStrike(k: { k1: number; k2: number }, h: "k1" | "k2", v: number) {
  const n = Math.round(v);
  return {
    k1: h === "k1" ? clamp(n, K_MIN, k.k2 - GAP) : k.k1,
    k2: h === "k2" ? clamp(n, k.k1 + GAP, K_MAX) : k.k2,
  };
}

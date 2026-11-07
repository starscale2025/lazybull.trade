// THE VISITOR'S POSITION, shared between the payoff instrument and the film.
//
// The payoff instrument (components/PayoffInstrument.tsx) is a bull call
// spread the visitor can reshape; the film's safety act says "your worst case
// is a number you chose". They used to be two different positions: the
// instrument showed −$230 / +$570 (or whatever the visitor dragged it to) and
// the film drew its own hardcoded −$80 / +$420 under that headline
// (re-tribunal regression 3). Now the instrument publishes here and both films
// read it. Since 2026-11-06 the instrument sits after the film, so on a first
// pass the film draws the example spread and says so.
//
// A plain module store, like cinema-clock: the films read it every frame and
// must not re-render to do so. No pricing in here; the instrument owns the
// maths.

export type HeroPosition = {
  /** The strikes. */
  k1: number;
  k2: number;
  /** Dollars, both positive. */
  maxLoss: number;
  maxProfit: number;
  breakeven: number;
  /** False until the visitor moves a strike: until then the spread is ours. */
  chosen: boolean;
};

let current: HeroPosition | null = null;
const subs = new Set<() => void>();

/** The latest position, or null before the hero has published one. */
export function getHeroPosition(): HeroPosition | null {
  return current;
}

export function setHeroPosition(p: HeroPosition) {
  const c = current;
  if (
    c &&
    c.k1 === p.k1 &&
    c.k2 === p.k2 &&
    c.chosen === p.chosen &&
    Math.round(c.maxLoss) === Math.round(p.maxLoss)
  )
    return;
  current = p;
  subs.forEach((fn) => fn());
}

/** Subscribe to changes; returns the unsubscribe. */
export function onHeroPosition(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

// THE VISITOR'S POSITION, shared between frame zero and the film.
//
// The hero instrument (components/HeroInstrument.tsx) is a bull call spread the
// visitor can reshape; the film's safety act says "your worst case is a number
// you chose". They used to be two different positions: the hero showed
// −$230 / +$570 (or whatever the visitor dragged it to) and the film drew its
// own hardcoded −$80 / +$420 under that headline (re-tribunal regression 3).
// Now the hero publishes here and both films read it, so the number the film
// calls "chosen" is the one the visitor chose.
//
// A plain module store, like cinema-clock: the films read it every frame and
// must not re-render to do so. No pricing in here; the hero owns the maths.

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

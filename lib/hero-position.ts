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
//
// A spread the visitor CHOSE also goes to sessionStorage, so it survives what
// a module variable cannot: a reload, or the full page load of a sign-in round
// trip. It is the visitor's own, for this tab, and never leaves the browser.

import { useSyncExternalStore } from "react";

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

const KEY = "lb-hero-position";

function restore(): HeroPosition | null {
  if (typeof window === "undefined") return null;
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as HeroPosition | null;
    const ok = p && [p.k1, p.k2, p.maxLoss, p.maxProfit, p.breakeven].every(Number.isFinite) && p.k1 < p.k2;
    return ok ? { ...p, chosen: true } : null;
  } catch {
    return null; // storage blocked or the entry is damaged: start from the example
  }
}

let current: HeroPosition | null = restore();
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
  if (p.chosen) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* storage blocked: the spread simply lasts as long as the page */
    }
  }
  subs.forEach((fn) => fn());
}

/** Subscribe to changes; returns the unsubscribe. */
export function onHeroPosition(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

const chosenSnapshot = () => (current?.chosen ? current : null);

/** The spread the visitor chose, or null. Null on the server and through
    hydration, so a page rendered there and restored here cannot disagree. */
export function useChosenPosition(): HeroPosition | null {
  return useSyncExternalStore(onHeroPosition, chosenSnapshot, () => null);
}

/** Whether the visitor has set the spread themselves, as React state: the
    film's safety line may only say "a number you chose" once they have. */
export function useHeroChosen(): boolean {
  return useSyncExternalStore(onHeroPosition, () => getHeroPosition()?.chosen ?? false, () => false);
}

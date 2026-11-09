import { useSyncExternalStore } from "react";

/**
 * THE ISLAND (M32, 2026-11-09): one live thing at a time.
 *
 * A page that has something live to show (the visitor's spread on the
 * landing, the position being built on /trade) publishes it here; the Island
 * (components/island/Island.tsx, mounted once in the root layout) draws it.
 * There is only ever one: the latest publisher wins, and a publisher clears
 * only its own entry, so a page that unmounts cannot wipe the next page's.
 *
 * A plain module store, like hero-position: no provider, no React state in
 * the publishers.
 */

export type IslandGlyph = "payoff" | "clock";

export type IslandState = {
  /** Who published it; clearIsland(id) only clears a matching entry. */
  id: string;
  /** The small mint line: what this is. Always says paper. */
  label: string;
  /** The one big number, with its sign: a loss reads "−$483", never "$483". */
  value: string;
  /** Under the number, what it means. */
  caption: string;
  /** Segments on the arc (2–12) and the lit one (0-based). */
  segments: number;
  active: number;
  glyph: IslandGlyph;
  /** Where "Open" goes, when there is somewhere to go. */
  href?: string;
  hrefLabel?: string;
  /**
   * What a screen reader hears when this changes. Leave it the same while
   * the value moves under a drag, or the Island talks over the page's own
   * live region; change it when there is news.
   */
  announce: string;
};

let current: IslandState | null = null;
const subs = new Set<() => void>();

const same = (a: IslandState | null, b: IslandState | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.id === b.id &&
    a.label === b.label &&
    a.value === b.value &&
    a.caption === b.caption &&
    a.segments === b.segments &&
    a.active === b.active &&
    a.glyph === b.glyph &&
    a.href === b.href &&
    a.announce === b.announce);

export function setIsland(next: IslandState) {
  if (same(current, next)) return;
  current = next;
  subs.forEach((fn) => fn());
}

/** Clear the Island, but only if `id` still owns it. */
export function clearIsland(id: string) {
  if (!current || current.id !== id) return;
  current = null;
  subs.forEach((fn) => fn());
}

export function getIsland(): IslandState | null {
  return current;
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function useIsland(): IslandState | null {
  return useSyncExternalStore(subscribe, getIsland, () => null);
}

/**
 * The film's say over the Island while it is pinned (ScrollCinema, Gate A4
 * #4): "dot" recedes it to its dot so it sits over no frame of the film, and
 * "pill" brings the pill back where the film speaks of the visitor's own
 * position (the safety act, and the hold that hands off to the landing).
 * null when no film is on screen: the Island places itself.
 */
export type IslandStage = "dot" | "pill" | null;

let stage: IslandStage = null;
const stageSubs = new Set<() => void>();

export function setIslandStage(next: IslandStage) {
  if (next === stage) return;
  stage = next;
  stageSubs.forEach((fn) => fn());
}

export function getIslandStage(): IslandStage {
  return stage;
}

function subscribeStage(fn: () => void) {
  stageSubs.add(fn);
  return () => {
    stageSubs.delete(fn);
  };
}

export function useIslandStage(): IslandStage {
  return useSyncExternalStore(subscribeStage, getIslandStage, () => null);
}

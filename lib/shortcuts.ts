import { useSyncExternalStore } from "react";

/**
 * THE VISITOR'S SHORTCUTS (owner, 2026-11-09), drawn by the dial in the bottom
 * left corner (components/dial/ShortcutDial.tsx). One set for every page, and
 * any page can have its own set instead. Saved in this browser.
 *
 * The rules are plain functions over the saved value, so they can be tested
 * without a browser; only the bottom of this file touches storage.
 */

export type ShortcutAction = "search" | "pause";
export type Shortcut = { id: string; label: string; href?: string; action?: ShortcutAction };

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "builder", label: "Strategy builder", href: "/trade" },
  { id: "chain", label: "Options chain", href: "/trade/chain" },
  { id: "pro", label: "Pro charts", href: "/pro" },
  { id: "portfolio", label: "Portfolio", href: "/portfolio" },
  { id: "learn", label: "Learn", href: "/learn" },
  { id: "practice", label: "Practice", href: "/practice" },
  { id: "greeks", label: "Greeks", href: "/greeks" },
  { id: "quant", label: "Quant lab", href: "/quant" },
  { id: "pricing", label: "Pricing", href: "/pricing" },
  { id: "safety", label: "Safety", href: "/safety" },
  { id: "search", label: "Search", action: "search" },
  { id: "pause", label: "Pause motion", action: "pause" },
];

export const MAX_SLOTS = 6;
export const DEFAULT_SLOTS: readonly string[] = ["builder", "chain", "pro", "portfolio", "learn"];

export type SavedShortcuts = { all: string[]; pages: Record<string, string[]> };
export const DEFAULT_SAVED: SavedShortcuts = { all: [...DEFAULT_SLOTS], pages: {} };

const known = new Map(SHORTCUTS.map((s) => [s.id, s]));
export const shortcutById = (id: string) => known.get(id);

/** Known ids only, no repeats, within the limit. Saved data is never trusted. */
export function cleanSlots(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === "string" && known.has(id) && !out.includes(id)) out.push(id);
  }
  return out.slice(0, MAX_SLOTS);
}

export function cleanSaved(raw: unknown): SavedShortcuts {
  const r = (raw ?? {}) as Partial<SavedShortcuts>;
  const all = cleanSlots(r.all);
  const pages: Record<string, string[]> = {};
  if (r.pages && typeof r.pages === "object") {
    for (const [path, ids] of Object.entries(r.pages)) {
      const c = cleanSlots(ids);
      if (c.length) pages[path] = c;
    }
  }
  return { all: all.length ? all : [...DEFAULT_SLOTS], pages };
}

/** What a page shows, and whether it is that page's own set. */
export function slotsFor(saved: SavedShortcuts, path: string): { ids: string[]; own: boolean } {
  const own = saved.pages[path];
  return own?.length ? { ids: own, own: true } : { ids: saved.all, own: false };
}

export function withSlots(saved: SavedShortcuts, path: string, ownPage: boolean, ids: string[]): SavedShortcuts {
  const next = cleanSlots(ids);
  if (!next.length) return saved; // the dial always keeps at least one
  return ownPage ? { ...saved, pages: { ...saved.pages, [path]: next } } : { ...saved, all: next };
}

/** Back to the every-page set, for this page. */
export function withoutPage(saved: SavedShortcuts, path: string): SavedShortcuts {
  const pages = { ...saved.pages };
  delete pages[path];
  return { ...saved, pages };
}

/** The slot the visitor is on: an exact match, else the longest section match. */
export function activeSlot(ids: string[], path: string): number {
  let best = -1;
  let bestLen = -1;
  ids.forEach((id, i) => {
    const href = known.get(id)?.href;
    if (!href) return;
    const hit = href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
    if (hit && href.length > bestLen) {
      best = i;
      bestLen = href.length;
    }
  });
  return best;
}

// ── storage ──────────────────────────────────────────────────────────────────
const KEY = "lb-shortcuts";
let current: SavedShortcuts | null = null;
const subs = new Set<() => void>();

function snapshot(): SavedShortcuts {
  if (!current) {
    try {
      current = cleanSaved(JSON.parse(localStorage.getItem(KEY) ?? "null"));
    } catch {
      current = DEFAULT_SAVED;
    }
  }
  return current;
}

export function saveShortcuts(next: SavedShortcuts) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: the set lasts as long as the page */
  }
  subs.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function useSavedShortcuts(): SavedShortcuts {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_SAVED);
}

"use client";

// One poll of the quote chain for everything on /start: the floor, the
// floating movers, the status light, the horizon's mood and the caption all
// read the same day. A module store (useSyncExternalStore), so however many
// pieces subscribe there is one fetch a minute, and none while the tab is
// hidden or nothing on the page is listening.

import { useSyncExternalStore } from "react";
import { MAP_SYMBOLS, simulatedMoves } from "@/lib/market/heatmap";

export type Feed = {
  moves: Record<string, number>;
  /** live: the market is open. closed: the last session's moves. sim: no feed answered. */
  state: "live" | "closed" | "sim";
  provider?: string;
  at: number;
};

const BATCH = 40; // /api/quote-batch takes up to 50
const REFRESH_MS = 60_000;

let feed: Feed | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
const subs = new Set<() => void>();

async function loadMoves(): Promise<Feed> {
  const batches: string[][] = [];
  for (let i = 0; i < MAP_SYMBOLS.length; i += BATCH) batches.push(MAP_SYMBOLS.slice(i, i + BATCH));
  const replies = await Promise.all(
    batches.map((b) =>
      fetch(`/api/quote-batch?symbols=${encodeURIComponent(b.join(","))}`)
        .then((r) => r.json())
        .catch(() => null),
    ),
  );
  const moves: Record<string, number> = {};
  let provider: string | undefined;
  let open = false;
  for (const j of replies) {
    if (!j?.ok || !Array.isArray(j.quotes)) continue;
    provider ??= typeof j.source === "string" ? j.source : undefined;
    for (const q of j.quotes) {
      if (q?.sym && Number.isFinite(q.chgPct)) {
        moves[q.sym] = q.chgPct;
        if (q.marketState === "REGULAR") open = true;
      }
    }
  }
  // Under half the map priced is not a market picture: show the labelled sim.
  if (Object.keys(moves).length < MAP_SYMBOLS.length / 2) {
    return { moves: simulatedMoves(new Date().toISOString().slice(0, 10)), state: "sim", at: Date.now() };
  }
  return { moves, state: open ? "live" : "closed", provider, at: Date.now() };
}

function pull() {
  if (inFlight || document.hidden) return;
  inFlight = true;
  loadMoves()
    .then((f) => {
      feed = f;
      for (const fn of subs) fn();
    })
    .finally(() => {
      inFlight = false;
    });
}

function subscribe(fn: () => void) {
  subs.add(fn);
  if (subs.size === 1) {
    pull();
    timer = setInterval(pull, REFRESH_MS);
    document.addEventListener("visibilitychange", pull);
  }
  return () => {
    subs.delete(fn);
    if (!subs.size) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", pull);
    }
  };
}

const snapshot = () => feed;
const serverSnapshot = () => null;

/** The shared day, or null until the first answer (and always on the server). */
export function useFeed(): Feed | null {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

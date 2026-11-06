import type { Candle } from "../candles";
import type { Verdict } from "./types";

// ── how /quant may speak about a named security
//
// The Gate A re-tribunal (2026-11-05) found /quant pinning a preset to a named
// stock and printing buy and sell verdicts, with vote counts, on the LIVE tape
// beside a PAPER TRADE button. That is a stock-specific, forward-looking call,
// which docs/COMPLIANCE.md (a) and (b)3 rule out whatever the footer says. Two changes answer it, and both
// live here so every surface uses the same ones:
//
//   1. The models never see the last HOLDOUT sessions. They read a window that
//      has already played out, and the page then shows what the price did
//      next, so every read is checkable history rather than a forecast.
//   2. A verdict's side stays buy/sell/hold/warn inside the engine (bots,
//      tallies, colours), but the page prints it as a READ of that window,
//      never as a trade action.

/**
 * Sessions held back from the models. 60 is the longest horizon any built-in
 * bot accepts (the `horizon` params in lib/quant/ai-bots.ts top out at 60), so
 * whatever a model says about "the next N days" lands on bars that already
 * exist.
 */
export const HOLDOUT = 60;

/** What one bot's side prints as. */
export const READ: Record<Verdict["side"], string> = {
  buy: "up",
  sell: "down",
  hold: "flat",
  warn: "caution",
};

/** What the tally across bots prints as: a split is "mixed", not "flat". */
export const AGGREGATE_READ: Record<Verdict["side"], string> = {
  buy: "leaned up",
  sell: "leaned down",
  hold: "mixed",
  warn: "caution",
};

/** The bars the models are allowed to see: everything but the last HOLDOUT. */
export function modelWindow(all: Candle[]): Candle[] {
  return all.slice(0, Math.max(0, all.length - HOLDOUT));
}

/** A bar time (ms) as its UTC day, YYYY-MM-DD: how every read here is dated. */
export function isoDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * The day of the window's last bar, or null when the tape is undated (the seed
 * and fallback walks are synthetic). A model read from outside the page (the
 * hosted API, the snapshot, the on-device nets) counts only if it is dated to
 * exactly this day: anything later has seen the held-back sessions, and
 * anything earlier is a read of some other window, which the outcome the page
 * shows cannot check.
 */
export function windowEnd(window: Candle[]): string | null {
  const t = window[window.length - 1]?.t;
  return typeof t === "number" && Number.isFinite(t) ? isoDay(t) : null;
}

export type Outcome = {
  /** Sessions between the end of the window and the last bar. */
  sessions: number;
  /** Close on the window's last bar, the one the models read from. */
  then: number;
  /** Close 20 sessions later, the default bot horizon; null if not reached. */
  after20: number | null;
  /** Close on the last bar of the tape. */
  now: number;
};

/** What the price did after the window the models saw. */
export function outcomeOf(window: Candle[], all: Candle[]): Outcome | null {
  const end = window.length - 1;
  if (end < 0 || all.length <= window.length) return null;
  const then = all[end].c;
  const now = all[all.length - 1].c;
  if (!Number.isFinite(then) || !Number.isFinite(now) || then <= 0) return null;
  return {
    sessions: all.length - window.length,
    then,
    after20: all[end + 20]?.c ?? null,
    now,
  };
}

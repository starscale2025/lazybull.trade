// Live trades on /pro's chart: the last candle moves, and the next one opens
// (2026-11-22).
//
// The chart used to fold every price into the last bar the feed had listed
// (patchLastBar, lib/live-bars.ts). The feed lists a bar once it has formed,
// so on a one-minute chart a new minute's trades poured into the old candle
// until the 30 s refetch split them out: the "live" candle was usually the
// wrong one. A trade whose own time is past the end of the last bar now opens
// the next bar.
//
// Kept apart from lib/live-bars.ts on purpose: that file is also in the home
// page's bundle (the ticker), which has a byte budget.

import { patchLastBar, reconcileBars, type FreshestRef } from "@/lib/live-bars";

/** Bar length (ms) of the frames short enough for a trade to open a bar by
    itself. On daily and longer bars the next bar comes from the bars feed. */
const STEP_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
};

/** The bar length when a live trade may open a bar: an intraday frame, while
    the market trades. Otherwise undefined, and a trade only moves the last bar. */
export function rollStep(tf: string, marketState?: string | null): number | undefined {
  return marketState === "REGULAR" ? STEP_MS[tf] : undefined;
}

/** A weekend plus a holiday. A trade dated further than this past the last bar
    is a different stretch of tape, left to the bars feed. */
const MAX_ROLL_GAP_MS = 5 * 86_400_000;
/** The most tick-built bars held past the feed's last one. The feed lags by a
    minute or two; further ahead than this is not lag. */
const MAX_KEPT = 5;

type Timed = { t: number; o: number; h: number; l: number; c: number; i?: number; v?: number };

/**
 * Fold a trade into a timestamped series. Inside the developing bar it moves
 * the close and stretches high/low. Once the trade's own time is past the end
 * of that bar it opens the next one at that price, on the series' own grid
 * (bars that start at :30 keep starting at :30).
 *
 * `stepMs` is the bar length, given only when a trade may open a bar (see
 * rollStep). A trade dated in the future, or days past the last bar, never
 * opens one.
 */
export function foldTrade<T extends Timed>(arr: T[], price: number, tradeMs?: number, stepMs?: number, nowMs: number = Date.now()): T[] {
  const last = arr[arr.length - 1];
  if (!last || !Number.isFinite(price)) return arr;
  if (
    stepMs && stepMs > 0 && tradeMs != null && Number.isFinite(tradeMs) &&
    tradeMs >= last.t + stepMs && tradeMs <= nowMs + 60_000 && tradeMs - last.t <= MAX_ROLL_GAP_MS
  ) {
    const next = { ...last, t: last.t + Math.floor((tradeMs - last.t) / stepMs) * stepMs, o: price, h: price, l: price, c: price };
    if (last.i != null) next.i = last.i + 1; // the chart places a bar by its index
    if (last.v != null) next.v = 0;
    return [...arr, next];
  }
  return patchLastBar(arr, price);
}

/**
 * reconcileBars (lib/live-bars.ts) for a chart whose trades may open a bar.
 * A refetch lists finished bars; the freshest trade may already belong to the
 * next one. With a step that trade keeps, or opens, its own bar across the
 * refetch instead of vanishing into the bar before it. Without a step this is
 * reconcileBars exactly.
 *
 * `shown` is the series on screen when this is a refetch of that same series.
 * The feed caches intraday bars for a minute, so the chart can be a bar or two
 * ahead of it. The bars the chart opened from ticks and the feed does not list
 * yet stay as they were built (open, high, low) instead of vanishing, or being
 * reopened flat at the latest price, until the feed catches up.
 */
export function reconcileLive<T extends Timed>(
  bars: T[],
  meta: { regularMarketPrice?: number; regularMarketTime?: number } | null | undefined,
  sym: string,
  freshestRef: FreshestRef,
  stepMs?: number,
  shown?: T[] | null
): T[] {
  if (!stepMs) return reconcileBars(bars, meta, sym, freshestRef);
  const theirs = bars[bars.length - 1];
  let base = bars;
  if (shown?.length && theirs) {
    let from = shown.length;
    while (from > 0 && shown.length - from < MAX_KEPT && shown[from - 1].t > theirs.t && shown[from - 1].t - theirs.t <= MAX_ROLL_GAP_MS) from--;
    if (from < shown.length) {
      base = [...bars, ...shown.slice(from).map((b, k) => (theirs.i != null ? { ...b, i: theirs.i + 1 + k } : b))];
    }
  }
  const mt = meta?.regularMarketTime ?? 0;
  const f = freshestRef.current;
  if (f && f.sym === sym && f.t > mt) return foldTrade(base, f.price, f.t * 1000, stepMs);
  const mp = meta?.regularMarketPrice;
  if (typeof mp === "number" && Number.isFinite(mp)) {
    freshestRef.current = { sym, price: mp, t: mt };
    if (mt > 0) return foldTrade(base, mp, mt * 1000, stepMs);
  }
  return base;
}

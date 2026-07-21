// Live-tick plumbing shared by every page that mixes two market-data feeds.
//
// The bars proxy (/api/quote) and the spot poll (/api/quote-batch) cache
// separately for 30s, so either can deliver the staler snapshot. These helpers
// keep one rule everywhere: fold fresh trades into the developing bar, and let
// the newest upstream regularMarketTime win in BOTH directions — a cached
// refetch must never walk the tape backwards. (/pro shipped that regression
// once; /quant would have re-shipped it without this extraction.)

/** The freshest known trade for one symbol, ordered by exchange timestamp. */
export type FreshestRef = { current: { sym: string; price: number; t: number } | null };

type OHLC = { o: number; h: number; l: number; c: number };

/** Fold a fresh trade price into the developing (last) bar: close moves,
    high/low stretch. No-op when nothing changes, so it's cheap in updaters.
    Generic over the bar shape — works for /pro's timestamped Bar and /quant's
    plain Candle alike. */
export function patchLastBar<T extends OHLC>(arr: T[], price: number): T[] {
  const last = arr[arr.length - 1];
  if (!last || last.c === price) return arr;
  return [...arr.slice(0, -1), { ...last, c: price, h: Math.max(last.h, price), l: Math.min(last.l, price) }];
}

/** /quant's Candle has no timestamps — same fold, friendlier name. */
export const foldClose = patchLastBar;

/** A just-fetched bar series can be STALER than the last quote tick. Order
    them by upstream regularMarketTime: an older fetch gets the freshest trade
    patched into its last bar; a newer fetch becomes the new freshest. */
export function reconcileBars<T extends OHLC>(
  bars: T[],
  meta: { regularMarketPrice?: number; regularMarketTime?: number } | null | undefined,
  sym: string,
  freshestRef: FreshestRef
): T[] {
  const mt = meta?.regularMarketTime ?? 0;
  const f = freshestRef.current;
  if (f && f.sym === sym && f.t > mt) return patchLastBar(bars, f.price);
  const mp = meta?.regularMarketPrice;
  if (typeof mp === "number" && Number.isFinite(mp)) freshestRef.current = { sym, price: mp, t: mt };
  return bars;
}

/** A live quote tick: apply unless an already-newer snapshot owns the tape.
    Returns the patched series, or null when the tick must be dropped (stale,
    non-finite, or for a different symbol than `bars` holds). Updates the ref
    when the tick wins. */
export function applyTick<T extends OHLC>(
  bars: T[],
  tick: { sym: string; price: number; t?: number },
  barsSym: string | null,
  freshestRef: FreshestRef
): T[] | null {
  if (!Number.isFinite(tick.price)) return null;
  if (barsSym !== tick.sym) return null;
  const t = tick.t ?? 0;
  const f = freshestRef.current;
  if (f && f.sym === tick.sym && f.t > t) return null;
  freshestRef.current = { sym: tick.sym, price: tick.price, t };
  return patchLastBar(bars, tick.price);
}

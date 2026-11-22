// What each range button on /pro means (2026-11-22).
//
// The buttons used to be bar counts, the same on every timeframe: "1D" was the
// last 24 bars and "1M" the last 30, so on a daily chart "1D" drew a month and
// "5D" drew more than "1M". A range is a span of time. Each one names the bar
// size that suits it, the way a terminal's range row does, and where the span
// starts is worked out from the bars that actually loaded.
//
// Pure, so the table is pinned by __tests__/pro-ranges.test.ts.

import { isCrypto } from "@/lib/market-data/provider";

export const RANGE_PRESETS = ["1D", "5D", "1M", "3M", "6M", "YTD", "1Y", "5Y", "All"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export type RangePlan =
  /** Trading days, counted by the overnight breaks in the bars themselves. */
  | { tf: string; kind: "sessions"; n: number }
  /** Calendar days back from the last bar. */
  | { tf: string; kind: "days"; n: number }
  | { tf: string; kind: "ytd" }
  | { tf: string; kind: "all" };

/**
 * The bar size and span for a range, for this symbol. Crypto trades round the
 * clock and its intraday history from the feed is short (a week of hourly
 * bars), so three of its ranges use a coarser bar than a stock's.
 */
export function rangePlan(preset: string, symbol: string): RangePlan | null {
  const crypto = isCrypto(symbol);
  switch (preset) {
    case "1D": return crypto ? { tf: "5m", kind: "days", n: 1 } : { tf: "5m", kind: "sessions", n: 1 };
    case "5D": return crypto ? { tf: "1h", kind: "days", n: 5 } : { tf: "15m", kind: "sessions", n: 5 };
    case "1M": return crypto ? { tf: "D", kind: "days", n: 30 } : { tf: "1h", kind: "days", n: 30 };
    case "3M": return { tf: "D", kind: "days", n: 91 };
    case "6M": return { tf: "D", kind: "days", n: 182 };
    case "YTD": return { tf: "D", kind: "ytd" };
    case "1Y": return { tf: "D", kind: "days", n: 365 };
    case "5Y": return { tf: "W", kind: "days", n: 1826 };
    case "All": return { tf: "M", kind: "all" };
    default: return null;
  }
}

const DAY = 86_400_000;
/** Two bars this far apart are in different sessions. An overnight break is
    8 h with extended hours and 17.5 h without; a thin stock's quiet spell
    inside a 6.5 h session never reaches it. */
const SESSION_BREAK_MS = 6 * 3_600_000;
/** A range never shows fewer bars than this: minutes into a new session "1D"
    still has a chart to read, with the session growing into it. */
export const RANGE_MIN_BARS = 20;

/** First index whose time is strictly after `ms` (bars ascend in time). */
function firstAfter(bars: { t: number }[], ms: number): number {
  let lo = 0, hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t > ms) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/**
 * Index of the first bar a range shows. Never further back than the bars that
 * loaded (a feed with three weeks of history shows three weeks for "1M"), and
 * never so far forward that fewer than RANGE_MIN_BARS are left.
 */
export function rangeStart(bars: { t: number }[], plan: RangePlan): number {
  const n = bars.length;
  if (n < 2) return 0;
  const last = bars[n - 1].t;
  let from = 0;
  if (plan.kind === "ytd") {
    from = firstAfter(bars, Date.UTC(new Date(last).getUTCFullYear(), 0, 1) - 1);
  } else if (plan.kind === "days") {
    // strictly after: the bar exactly n days old belongs to the day before
    from = firstAfter(bars, last - plan.n * DAY);
  } else if (plan.kind === "sessions") {
    let breaks = 0;
    let found = -1;
    for (let i = n - 1; i > 0; i--) {
      if (bars[i].t - bars[i - 1].t >= SESSION_BREAK_MS) {
        breaks++;
        if (breaks === plan.n) { found = i; break; }
      }
    }
    // No breaks at all: a market that never shuts (or a made-up tape), so the
    // span is plain days. Some breaks but fewer than asked: show what there is.
    from = found >= 0 ? found : breaks === 0 ? firstAfter(bars, last - plan.n * DAY) : 0;
  }
  return Math.max(0, Math.min(from, n - RANGE_MIN_BARS));
}

/** How many of the last bars a range shows: what the chart's fit() takes. */
export function rangeBars(bars: { t: number }[], plan: RangePlan): number {
  return bars.length - rangeStart(bars, plan);
}

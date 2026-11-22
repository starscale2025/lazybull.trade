// What the chart shows of its bars, and how it names their times (2026-11-22).
// Pure helpers for components/pro/Chart.tsx, pinned by
// __tests__/pro-chart-view.test.ts. Kept out of chartCore.ts, which pages
// outside /pro import too.

import { fmtTime } from "./chartCore";

// The time axis used to print fmtTime on every frame, so a one-minute chart
// read "Nov 21, 26" seven times across and a timeframe looked like it had done
// nothing. A label now suits the bar: the clock inside a day, the day where a
// new one begins, the year only on bars long enough to need it. Times are the
// viewer's own, like the clock in the status bar.
const INTRADAY = new Set(["1m", "5m", "15m", "1h", "4h"]);
const pad2 = (n: number) => String(n).padStart(2, "0");
const clockOf = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const dayOf = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
const monthOf = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Is `tf` a frame shorter than a day? */
export const isIntraday = (tf: string) => INTRADAY.has(tf);

/** A time-axis label for a bar at `ms`. `prevMs` is the label to its left:
    on an intraday frame the first label of each day names the day and the
    rest give the time. */
export function fmtAxisTime(ms: number, tf: string, prevMs?: number): string {
  const d = new Date(ms);
  if (tf === "M") return monthOf(d);
  if (!INTRADAY.has(tf)) return fmtTime(ms);
  return prevMs == null || !sameDay(d, new Date(prevMs)) ? dayOf(d) : clockOf(d);
}

/** One bar's time in full: for the crosshair and the spoken line. */
export function fmtBarTime(ms: number, tf: string): string {
  const d = new Date(ms);
  if (tf === "M") return monthOf(d);
  if (!INTRADAY.has(tf)) return fmtTime(ms);
  return `${dayOf(d)} ${clockOf(d)}`;
}

/** Index of the bar whose time is nearest `ms` (bars ascend in time). */
export function indexOfTime(bars: { t: number }[], ms: number): number {
  if (!bars.length) return -1;
  let lo = 0, hi = bars.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].t < ms) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 && ms - bars[lo - 1].t < bars[lo].t - ms ? lo - 1 : lo;
}

/**
 * The window to show after the SAME series refreshed (a refetch, a live tick,
 * a new bar). The chart used to refit to its last 120 bars on every such
 * update, so a range or a zoom the user chose lasted until the next poll.
 *
 * While the newest bar is in view the window stays on it, so new bars arrive
 * in view. Scrolled back into history, it holds the same bars by their time,
 * however the feed's window slid underneath.
 */
export function keepWindow(view: { start: number; span: number }, prev: { t: number }[], next: { t: number }[]): { start: number; span: number } {
  if (!prev.length || !next.length) return view;
  if (view.start + view.span >= prev.length - 0.5) {
    return { start: view.start + (next.length - prev.length), span: view.span };
  }
  const at = Math.max(0, Math.min(prev.length - 1, Math.round(view.start)));
  const now = indexOfTime(next, prev[at].t);
  return now < 0 ? view : { start: view.start + (now - at), span: view.span };
}

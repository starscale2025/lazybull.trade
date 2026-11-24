// The regular US session, for intraday bars (2026-11-24).
//
// Alpaca's free feed is one exchange, IEX. Inside the session its bars are
// built from thousands of trades; outside it they are single odd lots minutes
// apart (NVDA, 23 Nov 2026, the hour after the close: thirteen one-minute bars,
// 100 to 1,200 shares each, between 164.13 and 165.21). The chart places bars
// by index, so those drew as a trail of dashes after the session, and took
// slots the session's own first minutes then fell out of. The owner's word for
// it was "cooked". Intraday stock bars are the regular session only.
//
// Pure, pinned by __tests__/us-session.test.ts.

const NY = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

/** Minutes since midnight in New York (daylight saving included) at `ms`. */
export function nyMinutes(ms: number): number {
  let h = 0, m = 0;
  for (const p of NY.formatToParts(new Date(ms))) {
    if (p.type === "hour") h = Number(p.value) % 24;
    else if (p.type === "minute") m = Number(p.value);
  }
  return h * 60 + m;
}

const OPEN = 9 * 60 + 30;
const CLOSE = 16 * 60;

/** Bar length (ms) per intraday frame. Daily and longer bars have no session to be outside of. */
export const INTRADAY_STEP_MS: Record<string, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
};

/**
 * Does a bar that starts at `ms` and runs `stepMs` overlap 09:30 to 16:00 in
 * New York? An hourly bar that starts at 09:00 does (it holds 09:30 to 10:00);
 * one that starts at 16:00 does not. An early close (three half days a year)
 * is not known here: those afternoons keep whatever the feed prints.
 */
export function inRegularSession(ms: number, stepMs: number): boolean {
  const start = nyMinutes(ms);
  return start < CLOSE && start + stepMs / 60_000 > OPEN;
}

/** The bars of `tf` that belong to the regular session, renumbered. Daily and longer frames pass through. */
export function regularSessionBars<T extends { t: number; i: number }>(bars: T[], tf: string): T[] {
  const step = INTRADAY_STEP_MS[tf];
  if (!step) return bars;
  const kept = bars.filter((b) => inRegularSession(b.t, step));
  return kept.length === bars.length ? bars : kept.map((b, i) => ({ ...b, i }));
}

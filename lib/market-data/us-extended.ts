// A US stock's price while its regular session is shut (2026-11-24).
//
// The site's live feed is one exchange, shut from the close to the next open.
// So at 12:46 on an Indian afternoon the page said NVDA 164.85, "market
// closed", while the stock was trading 163.66 on the overnight venue; and
// before the next open it still said 164.85 with the stock near 157. The
// owner's words were "not live".
//
// What a free plan is served outside the session was asked of the plan itself
// (./overnight-probe, /api/status/overnight) rather than read off the docs:
//   delayed_sip   the full tape, fifteen minutes late. Its daily bars are the
//                 official closes every other screen quotes (NVDA, 23 Nov
//                 2026: 165.05 after 125.53, where one exchange's own last
//                 trades said 165.185 after 125.65).
//   overnight     20:00 to 04:00 New York. Quotes as they are made, trades
//                 fifteen minutes late.
//   iex           the site's own feed, live, open 08:00 to 17:00.
//
// From those this builds `Quote.ext`: the regular session's close, and the
// newest price of the stretch that is on, with what it is made of. Pure;
// pinned by __tests__/us-extended.test.ts.

import { type ExtBasis, type ExtSession, type QuoteExt, num } from "./provider";
import { nyDate, nyMinutes, sessionStart, usSession, type UsSession } from "./us-session";

/** The tape runs fifteen minutes behind; a minute of slack on top. */
const TAPE_LAG_MS = 16 * 60_000;

/**
 * The feeds to ask beside the main one once the regular session is shut: the
 * late tape for the close and the hours either side of the session (not when
 * the main feed is the tape already, a paid plan's `sip`), and the overnight
 * venue during its hours.
 */
export function extFeeds(nowMs: number, mainFeed: string): { tape: string | null; night: string | null } {
  // The night's last price stands in for the first quarter of an hour of
  // pre-market, until the late tape has anything from it (see extOf).
  const night = usSession(nowMs) === "overnight" || usSession(nowMs - TAPE_LAG_MS) === "overnight";
  return { tape: mainFeed === "sip" ? null : "delayed_sip", night: night ? "overnight" : null };
}

// A quote wider than this share of its midpoint says little about where the
// stock trades: the night's last quote for NVDA on 24 Nov 2026 was 158.76 by
// 161.47, 1.7% wide, around a last trade of 161.34. Then the trade stands.
const MAX_QUOTE_SPREAD = 0.01;
/** A stamp this far ahead of our clock is a clock problem, not a price. */
const SKEW_MS = 60_000;
const PRE_OPEN_MIN = 4 * 60;

const msOf = (t: unknown) => (typeof t === "string" ? new Date(t).getTime() : NaN);
const isExt = (s: UsSession): s is ExtSession => s === "overnight" || s === "pre" || s === "post";

/**
 * `main` is the stock's snapshot on the site's own feed, `tape` its snapshot
 * on the late tape and `night` on the overnight venue (each null when it was
 * not asked or did not answer). Undefined when neither `tape` nor `main` has a
 * daily bar to take a close from.
 *
 * The close is the tape's, the official one, once the tape has got past the
 * bell: for the quarter of an hour after it the tape's day is still forming,
 * and the site's own feed, which is live, stands in.
 *
 * A price counts only if it is stamped after the stretch began. That one rule
 * keeps yesterday's after-hours print out of this morning, and keeps a holiday
 * honest without a calendar: the clock says a stretch is on, nothing has
 * printed in it, so there is no `now`. "The stretch" is the one the late tape
 * is in, a quarter of an hour back: at 04:05 the tape has nothing from
 * pre-market yet, and the night's last price still stands, under its own name,
 * rather than the line going blank until 04:15. A price is named for the
 * stretch it was made in.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function extOf(main: any, tape: any, night: any, nowMs: number): QuoteExt | undefined {
  const stretch = usSession(nowMs);
  const today = nyDate(nowMs);
  const datedToday = (snap: any) => {
    const t = msOf(snap?.dailyBar?.t);
    return Number.isFinite(t) && nyDate(t) === today;
  };

  const tapeForming = datedToday(tape) && usSession(nowMs - TAPE_LAG_MS) === "regular";
  const ref = num(tape?.dailyBar?.c) != null && !tapeForming ? tape : main;
  let close = num(ref?.dailyBar?.c);
  let prevClose: number | null = num(ref?.prevDailyBar?.c) ?? null;
  // Before today's session has opened, a daily bar dated today is not a
  // session's close. The bar before it is.
  const beforeOpen = stretch === "pre" || (stretch === "overnight" && nyMinutes(nowMs) < PRE_OPEN_MIN);
  if (beforeOpen && datedToday(ref)) {
    close = prevClose ?? undefined;
    prevClose = null;
  }
  if (close == null) return undefined;

  const ext: QuoteExt = { close, prevClose };
  if (!isExt(stretch)) return ext;
  const start = sessionStart(nowMs - TAPE_LAG_MS) ?? sessionStart(nowMs);
  if (start == null) return ext;

  type Offer = { price: number; at: number; basis: ExtBasis; rank: number; session: ExtSession };
  let best: Offer | null = null;
  const offer = (price: number | undefined, t: unknown, basis: ExtBasis, rank: number, venue?: ExtSession) => {
    const at = msOf(t);
    if (price == null || !(price > 0) || !Number.isFinite(at) || at < start || at > nowMs + SKEW_MS) return;
    const session = venue ?? usSession(at);
    if (!isExt(session)) return; // a print from inside the regular session is the candles' business
    // The newest wins; at the same instant a trade that printed beats a late one, and both beat a quote.
    if (!best || at > best.at || (at === best.at && rank > best.rank)) best = { price, at, basis, rank, session };
  };

  offer(num(main?.latestTrade?.p), main?.latestTrade?.t, "trade", 3);
  offer(num(tape?.latestTrade?.p), tape?.latestTrade?.t, "delayed", 2);
  if (night) {
    // Whatever the clock says, a price from the overnight venue is the night's.
    offer(num(night.latestTrade?.p), night.latestTrade?.t, "delayed", 2, "overnight");
    const bid = num(night.latestQuote?.bp);
    const ask = num(night.latestQuote?.ap);
    if (bid != null && ask != null && bid > 0 && ask >= bid) {
      const mid = (bid + ask) / 2;
      // to a hundredth of a cent: a midpoint of two cent prices needs no more
      if (ask - bid <= MAX_QUOTE_SPREAD * mid) offer(Math.round(mid * 1e4) / 1e4, night.latestQuote.t, "indicative", 1, "overnight");
    }
  }

  const won = best as Offer | null;
  if (won) ext.now = { session: won.session, price: won.price, time: Math.floor(won.at / 1000), basis: won.basis };
  return ext;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

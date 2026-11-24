// How /pro shows a US stock while its regular session is shut (2026-11-24).
//
// A quote then carries `ext` (lib/market-data/us-extended.ts): the session's
// close, and the price of the stretch that is on with what it is made of. The
// close stays the number in the big type. It is settled, it is what the
// chart's last candle and a paper order's fill agree with, and the price since
// is a quote's midpoint or a trade fifteen minutes old. That price gets its
// own line beside it, named for what it is, and it is the number a watchlist
// row carries, tagged.
//
// Pure, so the wording is pinned by __tests__/pro-session-price.test.ts. Kept
// in lib/pro: only /pro reads it, and the home page's bundle is on a budget.

import type { ExtBasis, ExtSession, QuoteExt } from "@/lib/market-data/provider";

type Row = { last?: number; chg?: number; chgPct?: number; ext?: QuoteExt };

export const SESSION_LABEL: Record<ExtSession, string> = {
  overnight: "Overnight",
  pre: "Pre-market",
  post: "After hours",
};

/** The same, short enough for a watchlist row. */
export const SESSION_TAG: Record<ExtSession, string> = { overnight: "O/N", pre: "PRE", post: "AH" };

const BASIS: Record<ExtBasis, string> = {
  indicative: "indicative price, not a trade",
  delayed: "15 minutes delayed",
  trade: "live from one exchange",
};

/** A price older than this is given its time, so a quiet stock is not read as a live one. */
const STALE_MS = 2 * 60_000;
/** A delayed price is fifteen minutes old by construction; past this it is a quiet stock too. */
const STALE_DELAYED_MS = 20 * 60_000;

const change = (price: number, from: number | null | undefined) =>
  from ? { chg: price - from, chgPct: ((price - from) / from) * 100 } : { chg: undefined, chgPct: undefined };

/**
 * The number in the big type and its change. With the session shut that is the
 * close against the close before; otherwise the quote as it came.
 */
export function headline(q: Row | undefined): { price?: number; chg?: number; chgPct?: number } {
  if (!q) return {};
  if (!q.ext) return { price: q.last, chg: q.chg, chgPct: q.chgPct };
  return { price: q.ext.close, ...change(q.ext.close, q.ext.prevClose) };
}

/** The stretch that is on: its name, its price and the move since the close. Null when none is, or nothing has printed in it. */
export function sessionLine(q: Row | undefined): { session: ExtSession; label: string; price: number; chg: number; chgPct: number } | null {
  const now = q?.ext?.now;
  if (!q?.ext || !now) return null;
  const { chg = 0, chgPct = 0 } = change(now.price, q.ext.close);
  return { session: now.session, label: SESSION_LABEL[now.session], price: now.price, chg, chgPct };
}

/**
 * A watchlist row: the price of the stretch that is on, against the close and
 * tagged; with the market shut and nothing since, the close against the one
 * before; otherwise the quote as it came.
 */
export function watchRow(q: Row | undefined): { last?: number; chg?: number; chgPct?: number; tag?: string } {
  if (!q) return {};
  const line = sessionLine(q);
  if (line) return { last: line.price, chg: line.chg, chgPct: line.chgPct, tag: SESSION_TAG[line.session] };
  const h = headline(q);
  return { last: h.price, chg: h.chg, chgPct: h.chgPct };
}

/** The sentence under the price: what the number is. Null when the quote carries no `ext` (the caller keeps its own words). */
export function sessionNote(q: Row | undefined, nowMs: number, clock: (ms: number) => string): string | null {
  if (!q?.ext) return null;
  const now = q.ext.now;
  if (!now) return "Market closed · closing price";
  const aged = nowMs - now.time * 1000 > (now.basis === "delayed" ? STALE_DELAYED_MS : STALE_MS);
  return `${SESSION_LABEL[now.session]} · ${BASIS[now.basis]}${aged ? ` · as of ${clock(now.time * 1000)}` : ""}`;
}

/** The mark the chart draws at the session's price. */
export function sessionMark(q: Row | undefined): { price: number; label: string } | null {
  const line = sessionLine(q);
  return line ? { price: line.price, label: line.label } : null;
}

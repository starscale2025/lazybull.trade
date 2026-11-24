// Alpaca — the primary provider. Free "Basic" plan streams REAL-TIME data from
// IEX, served over an authenticated API, so (unlike Yahoo's scraped endpoint) it
// does NOT greylist datacenter IPs — the whole Vercel 429 problem disappears.
// Keys are SERVER-SIDE ONLY (never shipped to the browser).
//
// Paid upgrade with zero code change: set ALPACA_FEED=sip to get the full
// consolidated tape instead of IEX. Everything else is identical.
//
// Coverage note: Alpaca serves US stocks/ETFs + crypto, but NOT indices
// (^VIX, ^GSPC…). Those symbols throw here (a NON-qualifying "unsupported"
// error, so the breaker doesn't trip) and the orchestrator's chain fills them
// from Twelve Data / Yahoo. See ./index.

import {
  type Bar,
  type BarsResult,
  type MarketDataProvider,
  type ProviderHealth,
  type Quote,
  isCrypto,
  num,
} from "./provider";
import { getHealth } from "./health";
import { INTRADAY_STEP_MS, regularSessionBars } from "./us-session";

const DATA = "https://data.alpaca.markets";
const TRADING = "https://api.alpaca.markets";

const KEY = process.env.ALPACA_KEY_ID || "";
const SECRET = process.env.ALPACA_SECRET || "";
const FEED = process.env.ALPACA_FEED || "iex"; // iex (free) | sip (paid) — one env, no code change

const TF: Record<string, string> = {
  "1m": "1Min", "5m": "5Min", "15m": "15Min", "1h": "1Hour", "4h": "4Hour",
  D: "1Day", W: "1Week", M: "1Month",
};
const BAR_LIMIT: Record<string, number> = {
  "1m": 390, "5m": 390, "15m": 450, "1h": 500, "4h": 500, D: 1300, W: 520, M: 360,
};

function headers() {
  return { "APCA-API-KEY-ID": KEY, "APCA-API-SECRET-KEY": SECRET, Accept: "application/json" };
}
async function get(url: string, timeoutMs = 6000): Promise<Record<string, unknown>> {
  const r = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!r.ok) throw new Error(`alpaca ${r.status}`); // 429/5xx bubble up → breaker
  return (await r.json()) as Record<string, unknown>;
}

/** app symbol → Alpaca crypto pair: BTC, BTCUSD, BTC-USD and BTC/USD all → BTC/USD. */
export const cryptoPair = (s: string) => `${s.toUpperCase().replace(/[-/]?(USDT|USD)$/, "")}/USD`;

/** A US ticker Alpaca can price (AAPL, BRK.B); anything else would fail the whole batch. */
const usTicker = (s: string) => /^[A-Z]{1,5}(\.[A-Z])?$/.test(s);

// Alpaca's bars endpoints default `start` to the beginning of the current day.
// Without one, a request before the open comes back empty and a daily request
// never holds more than today's bar, so every chart fell to the synthetic tape.
// Ask from far enough back to cover `limit` bars across weekends and holidays,
// newest first, and turn them round.
const LOOKBACK_DAYS: Record<string, number> = { "1m": 7, "5m": 14, "15m": 35, "1h": 120, "4h": 730, D: 2000, W: 3800, M: 11000 };
// RFC-3339 to the second, the precision Alpaca's own examples use.
const startFor = (tf: string) => new Date(Date.now() - (LOOKBACK_DAYS[tf] ?? 2000) * 864e5).toISOString().replace(/\.\d{3}Z$/, "Z");

const iso = (t: unknown) => (typeof t === "string" ? Math.floor(new Date(t).getTime() / 1000) : undefined);
/** Epoch ms of an RFC-3339 stamp (Alpaca's run to the nanosecond; ms is kept), NaN without one. */
const msOf = (t: unknown) => (typeof t === "string" ? new Date(t).getTime() : NaN);

// A quote wider than this share of its own midpoint is not a market: a side of
// the book has been pulled, and the midpoint says nothing about where the coin
// trades. Far outside a working book on purpose (BTC/USD was quoted 0.01-0.02%
// wide and the widest of the ten coins, LTC and AVAX, 0.65%, on 2026-11-24),
// because what stands in for a refused quote is a trade that can be hours old.
const MAX_QUOTE_SPREAD = 0.1;
/** How long a crypto chart waits for the snapshot that only dresses its meta. */
const SNAPSHOT_LEASH_MS = 2500;

/** A snapshot's price and the time it is the price of (epoch seconds). */
type Spot = {
  price: number | undefined;
  time: number | undefined;
  /** Known to be the newest price the venue has: nothing in its bars is newer. */
  current: boolean;
};

/**
 * The price a snapshot stands at.
 *
 * A stock: its latest trade, as always.
 *
 * A coin: the newer of its latest trade and the midpoint of its latest quote,
 * with that one's time. Alpaca's own crypto venue prints few trades and quotes
 * all the time: on 2026-11-24 BTC/USD's last trade was up to seven minutes old,
 * ETH's fourteen and DOGE's three hours, while every book had been requoted
 * within the last minute, and 228 of BTC's 390 newest one-minute bars had no
 * volume. Alpaca builds those bars from quote midpoints when no trade prints,
 * so a row made of trades alone stood behind its own chart: on /pro the price
 * tag and the watchlist beside it were tens of dollars apart, and the live
 * stream, which pushes a row only when `last` changes, moved only when a
 * trade printed.
 *
 * A midpoint is an INDICATIVE price: where the coin is quoted, not a trade.
 * The honesty ledger (components/pro/TruthBadge.tsx) and docs/ENGINE.md §5 say
 * so; keep them true if this rule changes. A quote with a side missing,
 * crossed, or wider than MAX_QUOTE_SPREAD is not a price, and the trade stands.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function spotOf(snap: any, crypto: boolean): Spot {
  const trade = { price: num(snap?.latestTrade?.p), time: iso(snap?.latestTrade?.t) };
  // A stock's bars are made of the same trades, so its latest trade is current.
  if (!crypto) return { ...trade, current: true };

  const bid = num(snap?.latestQuote?.bp);
  const ask = num(snap?.latestQuote?.ap);
  if (bid == null || ask == null || bid <= 0 || ask < bid) return { ...trade, current: false };
  const mid = (bid + ask) / 2;
  if (ask - bid > MAX_QUOTE_SPREAD * mid) return { ...trade, current: false };

  const quoteAt = msOf(snap.latestQuote.t);
  const tradeAt = msOf(snap.latestTrade?.t);
  // Without a time the quote cannot be placed against the trade, or against
  // the bars: it is used only when it is all there is.
  if (!Number.isFinite(quoteAt)) {
    return trade.price == null ? { price: mid, time: undefined, current: false } : { ...trade, current: false };
  }
  // A trade at the same instant as the quote wins: it happened.
  if (trade.price != null && tradeAt >= quoteAt) return { ...trade, current: true };
  return { price: mid, time: Math.floor(quoteAt / 1000), current: true };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function barsFrom(raw: any[]): Bar[] {
  const bars: Bar[] = [];
  for (const b of raw || []) {
    const o = num(b.o), c = num(b.c);
    if (o == null || c == null) continue;
    const h = num(b.h), l = num(b.l), v = num(b.v);
    bars.push({ i: bars.length, t: new Date(b.t).getTime(), o, h: h ?? o, l: l ?? o, c, v: v ?? 0 });
  }
  return bars;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function metaFrom(bars: Bar[], snap: any, marketState?: string, crypto = false): BarsResult["meta"] {
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];
  // The chart folds this price into its last bar, or opens the next one with
  // it (lib/pro/live-candle.ts), so it has to be newer than the bars. A coin's
  // bars move on quotes: its last trade alone can be hours behind them, and
  // would drag the last candle back. Then the bars speak for themselves.
  const spot = spotOf(snap, crypto);
  const live = spot.current ? spot : undefined;
  return {
    regularMarketPrice: live?.price ?? last?.c,
    regularMarketTime: live?.time ?? (last ? Math.floor(last.t / 1000) : undefined),
    previousClose: num(snap?.prevDailyBar?.c) ?? prev?.c,
    chartPreviousClose: prev?.c,
    regularMarketVolume: num(snap?.dailyBar?.v) ?? last?.v,
    gmtoffset: 0,
    marketState,
  };
}

let clockCache: { state: string; at: number } | null = null;
/** US market open/closed from Alpaca's holiday-aware clock, memoised ~10s. */
async function marketState(): Promise<string | undefined> {
  if (clockCache && Date.now() - clockCache.at < 10_000) return clockCache.state;
  try {
    const c = await get(`${TRADING}/v2/clock`);
    const state = c.is_open ? "REGULAR" : "CLOSED";
    clockCache = { state, at: Date.now() };
    return state;
  } catch {
    return undefined; // deriveMarketState() falls back to trade-recency downstream
  }
}

export const alpaca: MarketDataProvider = {
  name: () => "alpaca",
  supportsRealtime: () => true,
  supportsCrypto: () => true,
  supportsIntraday: () => true,
  available: () => !!(KEY && SECRET),
  health: (): ProviderHealth => getHealth("alpaca"),

  async getQuotes(symbols: string[]): Promise<Quote[]> {
    const stocks = symbols.filter((s) => !isCrypto(s) && usTicker(s));
    const cryptos = symbols.filter(isCrypto);
    // Indices (^…) are unsupported — signal it so the chain fills them elsewhere.
    if (symbols.length && !stocks.length && !cryptos.length) throw new Error("alpaca: unsupported symbols");

    const out: Quote[] = [];
    const [state, stockSnap, cryptoSnap] = await Promise.all([
      stocks.length ? marketState() : Promise.resolve(undefined),
      stocks.length
        ? get(`${DATA}/v2/stocks/snapshots?symbols=${encodeURIComponent(stocks.join(","))}&feed=${FEED}`)
        : Promise.resolve({} as Record<string, unknown>),
      cryptos.length
        ? get(`${DATA}/v1beta3/crypto/us/snapshots?symbols=${encodeURIComponent(cryptos.map(cryptoPair).join(","))}`)
        : Promise.resolve({} as Record<string, unknown>),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pushSnap = (sym: string, snap: any, st: string | undefined, crypto: boolean) => {
      if (!snap) return;
      // A coin's row follows its book between trades; a stock's is its last
      // trade (spotOf). The time is that of whichever price the row carries.
      const spot = spotOf(snap, crypto);
      const last = spot.price ?? num(snap.dailyBar?.c);
      if (last == null) return;
      const prev = num(snap.prevDailyBar?.c) ?? last;
      const chg = last - prev;
      out.push({
        sym,
        last,
        chg,
        chgPct: prev ? (chg / prev) * 100 : 0,
        marketState: st,
        marketTime: spot.time ?? null,
      });
    };
    for (const s of stocks) pushSnap(s, (stockSnap as Record<string, unknown>)[s], state, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cSnaps = (cryptoSnap as any).snapshots ?? {};
    for (const s of cryptos) pushSnap(s, cSnaps[cryptoPair(s)], "REGULAR", true); // crypto trades 24/7
    return out;
  },

  async getQuote(symbol: string): Promise<Quote> {
    const [q] = await this.getQuotes([symbol]);
    if (!q) throw new Error("alpaca: no quote");
    return q;
  },

  async getBars(symbol: string, tf: string, limit?: number): Promise<BarsResult> {
    if (!isCrypto(symbol) && !usTicker(symbol)) throw new Error("alpaca: not a US ticker");
    const timeframe = TF[tf] ?? "1Day";
    const n = limit ?? BAR_LIMIT[tf] ?? 500;

    if (isCrypto(symbol)) {
      const pair = cryptoPair(symbol);
      // The snapshot beside the bars, as for a stock below: without it the
      // meta's price was the last listed bar's close stamped with that bar's
      // START, and its "previous close" the bar before, a minute ago on a
      // one-minute chart. With it the meta carries the price and time the quote
      // row carries (spotOf), yesterday's close and today's volume. It is
      // asked for at the same moment and on a short leash: late or failed, it
      // costs the meta those, never the chart its bars.
      const [j, snap] = await Promise.all([
        get(
          `${DATA}/v1beta3/crypto/us/bars?symbols=${encodeURIComponent(pair)}&timeframe=${timeframe}&start=${encodeURIComponent(startFor(tf))}&limit=${n}&sort=desc`
        ),
        get(`${DATA}/v1beta3/crypto/us/snapshots?symbols=${encodeURIComponent(pair)}`, SNAPSHOT_LEASH_MS).then(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (s) => ((s as any).snapshots ?? {})[pair] ?? null,
          () => null
        ),
      ]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bars = barsFrom([...(((j as any).bars ?? {})[pair] ?? [])].reverse());
      if (bars.length < 2) throw new Error("alpaca: no crypto bars");
      return { bars, meta: metaFrom(bars, snap, "REGULAR", true) };
    }

    // Intraday bars are the regular session only (./us-session): outside it
    // this feed prints single odd lots minutes apart, which a chart that
    // places bars by index draws as a trail of dashes after the close. Those
    // prints also take slots, so more is asked for than is kept: up to 150
    // extended minutes ride on a 390-minute session.
    const intraday = tf in INTRADAY_STEP_MS;
    const ask = intraday ? Math.min(10_000, Math.ceil(n * 1.5) + 60) : n;
    const j = await get(
      `${DATA}/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${timeframe}&start=${encodeURIComponent(startFor(tf))}&limit=${ask}&feed=${FEED}&sort=desc&adjustment=all`
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listed = barsFrom([...((j as any).bars ?? [])].reverse());
    const session = regularSessionBars(listed, tf);
    const bars = intraday && session.length > n ? session.slice(-n).map((b, i) => ({ ...b, i })) : session;
    if (bars.length < 2) throw new Error("alpaca: no bars");
    // A cheap snapshot gives a live spot + prev close + market state for meta.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let snap: any = null;
    let state: string | undefined;
    try {
      [snap, state] = await Promise.all([
        get(`${DATA}/v2/stocks/snapshots?symbols=${encodeURIComponent(symbol)}&feed=${FEED}`).then(
          (s) => (s as Record<string, unknown>)[symbol]
        ),
        marketState(),
      ]);
    } catch {
      /* meta falls back to the bars themselves */
    }
    return { bars, meta: metaFrom(bars, snap, state) };
  },
};

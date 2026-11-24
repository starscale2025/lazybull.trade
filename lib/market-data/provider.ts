// The provider seam. Every vendor (Alpaca, Twelve Data, Finnhub, Yahoo) speaks
// this ONE interface, and every route imports only `getProvider()` from
// ./index — never a vendor directly. Swapping or reordering vendors, or moving
// to a paid feed, touches a file in here and nothing else.
//
// Shapes below intentionally mirror what /api/quote and /api/quote-batch already
// return, so migrating the routes is a lift-and-shift, not a rewrite, and the
// ~20 frontend/AI call sites keep working unchanged.

/** One OHLCV bar — identical to the existing /api/quote bar shape. */
export type Bar = { i: number; t: number; o: number; h: number; l: number; c: number; v: number };

/** The `meta` block /api/quote returns. deriveMarketState() consumes marketState. */
export type QuoteMeta = {
  currency?: string;
  exchangeName?: string;
  instrumentType?: string;
  regularMarketPrice?: number;
  regularMarketTime?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  regularMarketVolume?: number;
  gmtoffset?: number;
  marketState?: string;
};

/** The stretches of the US week outside the regular session (./us-session). */
export type ExtSession = "overnight" | "pre" | "post";

/**
 * What a price outside the regular session is made of:
 *   trade      — a trade as it printed, on the feed the site reads live;
 *   delayed    — a trade from the full tape, or from the overnight venue, served fifteen minutes late;
 *   indicative — the midpoint of a live overnight quote: where the stock is quoted, not a trade.
 */
export type ExtBasis = "trade" | "delayed" | "indicative";

/**
 * A US stock while its regular session is shut (./us-extended). `close` is the
 * last regular session's close and `prevClose` the one before (null when the
 * feed does not say). `now` is the price of the stretch that is on, present
 * only when something has printed or been quoted since that stretch began.
 */
export type QuoteExt = {
  close: number;
  prevClose: number | null;
  now?: { session: ExtSession; price: number; /** epoch seconds */ time: number; basis: ExtBasis };
};

/** One row of /api/quote-batch. Field names are load-bearing (TickerBar etc.). */
export type Quote = {
  sym: string;
  name?: string;
  /**
   * The current price. A stock's is its latest trade. A coin's, from Alpaca, is
   * the newer of its latest trade and the midpoint of its latest quote: between
   * trades an indicative price, where the coin is quoted, not a trade
   * (spotOf in ./alpaca).
   */
  last: number;
  chg: number;
  chgPct: number;
  currency?: string;
  exch?: string;
  marketState?: string;
  /** when `last` was the price, upstream (epoch seconds) — lets the client order feeds. */
  marketTime?: number | null;
  /**
   * Set for a US stock, from Alpaca, while its regular session is shut: the
   * session's close and what the stock is doing since. `last` and `marketState`
   * are unchanged by it, so a consumer that does not read it sees what it
   * always has.
   */
  ext?: QuoteExt;
  /**
   * Set ONLY for Indian securities (lib/region.ts): `last` is the newest close
   * the SEBI education-lag policy allows, not a live print. `asOf` is that
   * bar's time (epoch ms); `policy` names the rule so the UI can say why.
   */
  delayed?: boolean;
  asOf?: number | null;
  policy?: string;
};

export type BarsResult = { bars: Bar[]; meta: QuoteMeta };

/**
 * Reliability tier, surfaced to the UI:
 *   A — realtime primary succeeded (Alpaca)
 *   B — a secondary live provider succeeded
 *   C — every provider failed → last-good served from cache (honestly stamped)
 *   D — no real data anywhere → caller synthesizes (route stays back-compatible)
 */
export type Tier = "A" | "B" | "C" | "D";

/** Attached to every response as EXTRA fields; the existing provenance UI reads it. */
export type Provenance = {
  provider: string;
  tier: Tier;
  /** epoch ms the underlying data was fetched from a provider. */
  updatedAt: number;
  /** ms since that fetch (0 for a fresh live hit). */
  cacheAge: number;
  isRealtime: boolean;
  isCached: boolean;
  /**
   * Present when a data-lag policy shaped this response (today: the SEBI
   * education lag on Indian securities, lib/region.ts). The provenance badge
   * renders it as "delayed 31 d · SEBI education norms".
   */
  policy?: string;
};

export type ProviderHealth = {
  name: string;
  available: boolean;
  /** consecutive qualifying failures (429/5xx/timeout). */
  failures: number;
  /** breaker open until this epoch ms (0 = closed). */
  trippedUntil: number;
  lastSuccess: number;
  lastError?: string;
};

/**
 * A market-data vendor. Implementations are thin, stateless fetch+map adapters;
 * all cross-cutting concerns (caching, retries, breaker, dedup, provenance) live
 * in the orchestrator (./index), so a new vendor is just this interface.
 */
export interface MarketDataProvider {
  name(): string;
  /** IEX/SIP/etc. live ticks (vs delayed). Drives Tier A vs B and isRealtime. */
  supportsRealtime(): boolean;
  supportsCrypto(): boolean;
  supportsIntraday(): boolean;
  /** creds present / usable right now. An unavailable provider is skipped. */
  available(): boolean;
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Quote[]>;
  getBars(symbol: string, tf: string, limit?: number): Promise<BarsResult>;
  /** current circuit-breaker/health snapshot (from ./health). */
  health(): ProviderHealth;
}

// ── shared helpers ────────────────────────────────────────────────────────

/** parseFloat that yields undefined (not NaN) for junk — vendors return strings. */
export function num(x: unknown): number | undefined {
  const n = parseFloat(String(x));
  return Number.isFinite(n) ? n : undefined;
}

/** Is this one of the app's crypto tickers? (only BTC today, but future-proof) */
export function isCrypto(symbol: string): boolean {
  // BTC, BTCUSD, BTC/USD and Yahoo's BTC-USD (the watchlist's own form) are all
  // the same coin; missing the hyphen sent BTC-USD to stock endpoints, where one
  // unknown symbol fails the whole batch.
  return /^(BTC|ETH|SOL|DOGE|LTC|BCH|AVAX|LINK|XRP|ADA)([-/]?(USD|USDT))?$/i.test(symbol);
}

/** App timeframe → coarse cache class, which picks the freshness TTL. */
export function tfClass(tf: string): "quote" | "intraday" | "daily" {
  return /^(D|W|M)$/.test(tf) ? "daily" : "intraday";
}

/** Freshness TTL (seconds) before the orchestrator re-hits a provider. */
export const FRESH_TTL_S = { quote: 3, intraday: 60, daily: 600 } as const;

/** How long last-good stays available for Tier-C stale-serve (well beyond TTL). */
export const STALE_RETENTION_S = 24 * 60 * 60;

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

/** One row of /api/quote-batch. Field names are load-bearing (TickerBar etc.). */
export type Quote = {
  sym: string;
  name?: string;
  last: number;
  chg: number;
  chgPct: number;
  currency?: string;
  exch?: string;
  marketState?: string;
  /** upstream snapshot time (epoch seconds) — lets the client order feeds. */
  marketTime?: number | null;
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
  return /^(BTC|ETH|SOL|DOGE|LTC|BCH|AVAX|LINK|XRP|ADA)(USD|USDT)?$/i.test(symbol);
}

/** App timeframe → coarse cache class, which picks the freshness TTL. */
export function tfClass(tf: string): "quote" | "intraday" | "daily" {
  return /^(D|W|M)$/.test(tf) ? "daily" : "intraday";
}

/** Freshness TTL (seconds) before the orchestrator re-hits a provider. */
export const FRESH_TTL_S = { quote: 3, intraday: 60, daily: 600 } as const;

/** How long last-good stays available for Tier-C stale-serve (well beyond TTL). */
export const STALE_RETENTION_S = 24 * 60 * 60;

# Production Market-Data Layer — Design Spec

**Date:** 2026-07-24
**Status:** Approved (author-written spec)
**Scope:** Replace the market-data infrastructure behind `/api/quote` and
`/api/quote-batch`. **No product redesign, no UI redesign.** Existing response
shapes preserved so the frontend + AI bots keep working unchanged.

## Context / problem

LazyBull is an educational paper-trading platform. Two routes feed everything:

- `/api/quote` → historical/daily bars for the Quant workbench + the AI bots.
- `/api/quote-batch` → the ticker + live quotes (spot price, change).

Both fetched Yahoo's free chart endpoint, which **greylists datacenter IPs**, so
on Vercel they 429 and the app flaps to a synthetic "OFFLINE" tape. The fix is a
real provider layer that (a) drops Yahoo as primary, (b) abstracts vendors, (c)
never shows OFFLINE just because one provider blipped, and (d) is free today with
a one-env-var path to a paid full-tape feed later.

## Non-negotiable constraints

1. **Preserve response shapes.** `/api/quote` returns `{ ok, symbol, tf, source,
   bars: [{i,t,o,h,l,c,v}], meta }`; `/api/quote-batch` returns `{ ok, quotes:
   [{sym, name, last, chg, chgPct, currency, exch, marketState, marketTime}] }`.
   ~20 call sites depend on these. Provenance is added as **extra** fields only.
2. **Vercel serverless only.** No websocket workers, SSE, Redis clusters, Kafka,
   daemons, k8s, microservices.
3. **No forced infra.** The cache must work with zero setup (in-memory) and
   upgrade to real cross-invocation KV when env is present — no hard dependency.

## Architecture — the provider seam

```
lib/market-data/
  provider.ts    — MarketDataProvider interface + shared types + provenance/tier helpers
  alpaca.ts      — primary: free IEX realtime quotes + bars + crypto (ALPACA_FEED=iex|sip)
  twelvedata.ts  — secondary (refactor of the existing TD integration)
  finnhub.ts     — quotes only (free tier dropped candles → getBars unsupported)
  yahoo.ts       — last-ditch (refactor of the existing Yahoo chart code)
  cache.ts       — KV abstraction: in-memory Map default, Upstash/Vercel-KV REST when env set
  health.ts      — per-provider circuit breaker (trip on repeated 429/5xx/timeout, cooldown)
  index.ts       — getProvider(): dedup + provider chain + cache + breaker + provenance
```

Routes import **only** `getProvider()` from `index.ts`. No route imports a vendor.

### Interface

```ts
interface MarketDataProvider {
  name(): string;
  supportsRealtime(): boolean;
  supportsCrypto(): boolean;
  supportsIntraday(): boolean;
  available(): boolean;          // has creds / is usable
  getQuote(symbol): Promise<Quote>;
  getQuotes(symbols): Promise<Quote[]>;
  getBars(symbol, tf, limit?): Promise<BarsResult>;
  health(): ProviderHealth;      // reads the shared circuit-breaker registry
}
```

`Quote` mirrors the quote-batch item; `BarsResult = { bars: Bar[]; meta:
QuoteMeta }` mirrors the quote payload.

### Provider chain (automatic, no manual switching)

`Alpaca → Twelve Data → Finnhub → Yahoo → Cache(last-good) → Synthetic`

The orchestrator walks the chain, skipping breaker-tripped / unavailable
providers, and stops at the first success. A provider that lacks a capability
(e.g. Finnhub `getBars`) is skipped for that call.

### Reliability tiers (surfaced as provenance)

- **Tier A** — realtime primary (Alpaca).
- **Tier B** — a secondary provider succeeded.
- **Tier C** — every provider failed → last-good from cache (never a lie: stamped `isCached`, `cacheAge`).
- **Tier D** — no real data anywhere → **the route signals synthetic** the SAME way it does today (bars: `{ok:false}` → the client's existing practice-tape path + the calm reconnect banner; quotes: `{ok:true, quotes:[]}`). This preserves the current UX exactly.

### Cache TTLs (freshness before re-fetching a provider)

- realtime quotes: 3 s · 5-minute bars: 60 s · daily bars: 10 min.

A fresh cache hit short-circuits provider calls (rate saver + dedup). Values are
retained far longer than their TTL so Tier-C last-good survives an outage.

### Circuit breaker (health.ts)

Per-provider `{ failures, trippedUntil }`. Trip on repeated 429 / 5xx / timeout
past a threshold; serve the next provider; auto-retry after a cooldown. "No data"
(a clean empty/404) is not a breaker failure.

### Request de-duplication

A module-level `Map<key, Promise>` of in-flight requests. Concurrent identical
requests (same symbols) await ONE upstream promise instead of N.

### Provenance metadata (every response, extra fields)

`{ provider, tier, updatedAt, cacheAge, isRealtime, isCached }` plus `source` =
provider name (back-compat: `/quant` already reads `j.source`). The existing
provenance line renders it; only the provider→label map gains "Alpaca".

### /api/status (observability only)

Returns the chain, each provider's health + breaker state, last-success times,
cache backend (memory|kv), and cache age. No secrets.

## Alpaca specifics

- Base `https://data.alpaca.markets`. Server-side headers `APCA-API-KEY-ID` /
  `APCA-API-SECRET-KEY` (never in the browser). Available only when both env vars
  are set; otherwise the provider reports unavailable and the chain skips it.
- Stocks: snapshots (`/v2/stocks/snapshots`) for quotes, `/v2/stocks/{sym}/bars`
  for bars, `feed` from `ALPACA_FEED` (default `iex`). Crypto: the crypto v1beta3
  endpoints. Flipping `ALPACA_FEED=sip` (paid) needs **no code change**.

## Deliverables

Provider abstraction · route migration · KV cache · circuit breakers · request
dedup · `/api/status` · preserved frontend behavior · typed + documented + tested
(unit tests for breaker, dedup, chain, cache — no network). Env additions:
`ALPACA_KEY_ID`, `ALPACA_SECRET`, `ALPACA_FEED`, `FINNHUB_API_KEY` (optional),
`KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL`/`_TOKEN`
(optional). All optional — the app runs with none set (memory cache + Yahoo/
synthetic), and gets better as each is added.

## Out of scope (explicitly not now)

Websocket fan-out, SSE, Redis clusters, Kafka, daemons, k8s, microservices. The
seam makes a future streaming worker or a paid provider a one-file add.

# Live Quotes — Polling → SSE Streaming

**Date:** 2026-07-24
**Scope:** Upgrade the *transport* for live quotes from per-component polling to a
single shared Server-Sent-Events stream. **No change to the market-data layer**,
provider abstraction, or component rendering — only how prices reach the browser.

## The Vercel constraint (why SSE, not a shared websocket)

The spec's ideal is `100 users → ONE Alpaca websocket → broadcast`. That shared
upstream socket needs a **persistent singleton process**, and Vercel serverless
has none (ephemeral, horizontally scaled). Alpaca's free tier also allows only
**one** websocket connection total — so per-user sockets are impossible too. A
true shared upstream WS therefore requires an always-on worker, which was
explicitly out of scope.

**Resolution (chosen):** SSE gives the terminal *feel* — the browser subscribes
once and prices push — without any persistent upstream socket. The
"one upstream subscription per symbol" guarantee is provided by the **existing
market-data cache + in-flight de-dup**: N SSE streams asking for AAPL collapse to
~one upstream fetch per cache window. Honest latency: ~2–3s (provider-cache
bounded), not sub-100ms. A true upstream WS (worker or browser crypto socket) can
feed the same event shape later with no client change.

## Architecture

```
Browser component → useLiveQuotes(symbols)
                         │  (subscribe)
                         ▼
              StreamingManager (one per tab)
                         │  ONE EventSource for the UNION of subscribed symbols
                         ▼
          GET /api/stream/quotes  (Node streaming Response)
                         │  loop every ~2s
                         ▼
              getProvider().getQuotes()  ← market-data layer (cache+dedup+chain)
```

- **`app/api/stream/quotes/route.ts`** — Node streaming `Response`. Emits
  `hello`, then `quotes` events (only *changed* prices, each with an `id:` for
  `Last-Event-ID`) + `hb` heartbeats, over a ~55s cycle then a clean `bye` so the
  EventSource reconnects seamlessly (under Vercel's `maxDuration`). Sources every
  tick from `getProvider().getQuotes()`; contains **zero** vendor logic.
- **`lib/streaming/manager.ts`** — the browser singleton. Owns: EventSource
  lifecycle over the symbol union (debounced), reconnect w/ exponential backoff
  (cap 15s), heartbeat/stale detection (force-reconnect after 12s silence),
  throttled fan-out (≤10fps), and **automatic fallback to polling
  `/api/quote-batch`** if SSE can't establish (with periodic SSE retry).
- **`lib/streaming/useLiveQuotes.ts`** — `useLiveQuotes(symbols)` /
  `useLiveQuote(symbol)`. Re-subscribes only when the symbol *set* changes.

## What changed in the app

- **TickerBar** and the **/quant live spot tick** now consume `useLiveQuotes`
  instead of polling. The /quant tick feeds `applyTick` → the developing candle
  updates incrementally (append/update the last candle, never a full reload).
- Everything else is untouched; the polling routes remain as the fallback path,
  so the UI keeps working if the stream is blocked (e.g., a proxy that strips
  SSE).

## Future providers

The manager and route are transport-agnostic. A real streaming provider
(Polygon, Alpaca SIP, Finnhub, Binance/Coinbase for crypto) plugs in by feeding
the same `quotes` event shape — either from an always-on worker that fans a real
upstream WS into this SSE route, or a browser-side socket for keyless crypto.
No component or route contract changes.

## Not built (per scope)

Kubernetes, Kafka, Redis pub/sub, microservices, Docker Swarm, always-on workers.
Everything runs on Vercel serverless today.

## Verification

- SSE endpoint (curl + in-browser EventSource): `hello` → `quotes` (real AAPL +
  provenance + `id`) → `hb` every ~2s, pushing only changed prices.
- App manager opens one union EventSource; graceful "connecting…" when a symbol
  set has no data; no console errors. Manager pure logic unit-tested (union,
  backoff, change-diff). Gates: tsc · vitest · build · guard.

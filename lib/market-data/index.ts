// The orchestrator — the ONLY thing routes import. It owns every cross-cutting
// concern so the vendor adapters stay thin:
//   • fresh-cache short-circuit (rate saver)      • in-flight de-duplication
//   • the provider chain w/ breaker + availability • last-good stale-serve (Tier C)
//   • gap-filling quotes across providers          • provenance + tier stamping
//
// Add a provider = implement the interface and drop it in the chain. No route or
// frontend change. Move to a paid feed = swap the adapter or its env. That's it.
//
// The logic is exposed as createOrchestrator(chain) so tests can inject fake
// providers; getProvider() is the default instance over the real chain.

import {
  type BarsResult,
  type MarketDataProvider,
  type Provenance,
  type Quote,
  FRESH_TTL_S,
  STALE_RETENTION_S,
  tfClass,
} from "./provider";
import { alpaca } from "./alpaca";
import { twelvedata } from "./twelvedata";
import { finnhub } from "./finnhub";
import { yahoo } from "./yahoo";
import {
  acquireRefreshLock,
  ageMs,
  cacheBackend,
  cacheGet,
  cacheSet,
  releaseRefreshLock,
  type CacheEntry,
} from "./cache";
import { allHealth, breakerClosed, isQualifyingFailure, recordFailure, recordSuccess } from "./health";

/** Default priority order. First usable provider that returns real data wins. */
const DEFAULT_CHAIN: MarketDataProvider[] = [alpaca, twelvedata, finnhub, yahoo];

/** A provider is a candidate only if it has creds AND its breaker is closed. */
const usable = (p: MarketDataProvider) => p.available() && breakerClosed(p.name());
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const liveTier = (isRealtime: boolean): Provenance["tier"] => (isRealtime ? "A" : "B");

// P0-4: bound the TOTAL time one request spends walking the chain. Per-provider
// timeouts are 6s, so 4 providers could stack to ~24s; this caps the whole walk
// and shrinks each provider's slice to the remaining budget so we fail over
// earlier instead of hanging a caller. "timeout" in the message means the
// breaker counts it (see isQualifyingFailure). The abandoned upstream fetch
// still aborts on its own internal timeout.
const CHAIN_DEADLINE_MS = 7000;
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("chain timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/** Provenance for a cache hit: fresh (isRealtime tier) vs stale (Tier C). */
function cachedProv(entry: CacheEntry<unknown>, stale: boolean): Provenance {
  return {
    provider: entry.provider,
    tier: stale ? "C" : liveTier(entry.isRealtime),
    updatedAt: entry.storedAt,
    cacheAge: ageMs(entry),
    isRealtime: entry.isRealtime && !stale,
    isCached: true,
  };
}

// Results the routes consume.
export type BarsResponse = (BarsResult & { provenance: Provenance }) | null; // null → Tier D
export type QuotesResponse = { quotes: Quote[]; provenance: Provenance };

export function createOrchestrator(chain: MarketDataProvider[], opts?: { deadlineMs?: number }) {
  const deadlineMs = opts?.deadlineMs ?? CHAIN_DEADLINE_MS;
  // In-flight de-duplication: 200 clients hitting the same symbol at once share
  // ONE upstream promise instead of firing 200 identical provider calls.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inflight = new Map<string, Promise<any>>();
  function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const p = fn().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  async function getBars(symbol: string, tf: string): Promise<BarsResponse> {
    const key = `b:${symbol}:${tf}`;
    return dedup(key, async () => {
      const cached = await cacheGet<BarsResult>(key);
      const freshMs = FRESH_TTL_S[tfClass(tf)] * 1000;
      if (cached && ageMs(cached) < freshMs) {
        return { ...cached.data, provenance: cachedProv(cached, false) };
      }
      // Single-flight across instances: only the lock holder refreshes a
      // stale/cold key; everyone else serves last-good so a popular symbol's
      // expiry can't stampede the upstream. No-op (always true) without KV.
      const holdsLock = await acquireRefreshLock(key);
      if (!holdsLock && cached) {
        return { ...cached.data, provenance: cachedProv(cached, true) }; // Tier C while another instance refreshes
      }
      try {
        const deadline = Date.now() + deadlineMs;
        for (const p of chain) {
          if (!usable(p)) continue;
          const remaining = deadline - Date.now();
          if (remaining <= 0) break; // chain budget spent — fall to cache / Tier D
          try {
            const res = await withTimeout(p.getBars(symbol, tf), remaining);
            recordSuccess(p.name());
            await cacheSet<BarsResult>(
              key,
              { data: res, storedAt: Date.now(), provider: p.name(), isRealtime: p.supportsRealtime() },
              STALE_RETENTION_S
            );
            return {
              ...res,
              provenance: {
                provider: p.name(),
                tier: liveTier(p.supportsRealtime()),
                updatedAt: Date.now(),
                cacheAge: 0,
                isRealtime: p.supportsRealtime(),
                isCached: false,
              },
            };
          } catch (e) {
            // Only 429/5xx/timeout count against the breaker; a clean miss doesn't.
            if (isQualifyingFailure(e)) recordFailure(p.name(), errMsg(e));
          }
        }
        if (cached) return { ...cached.data, provenance: cachedProv(cached, true) }; // Tier C
        return null; // Tier D → route returns {ok:false}, client keeps its practice tape
      } finally {
        if (holdsLock) await releaseRefreshLock(key);
      }
    });
  }

  async function getQuotes(symbols: string[]): Promise<QuotesResponse> {
    const key = `q:${[...symbols].sort().join(",")}`;
    return dedup(key, async () => {
      const cached = await cacheGet<Quote[]>(key);
      if (cached && ageMs(cached) < FRESH_TTL_S.quote * 1000) {
        return { quotes: cached.data, provenance: cachedProv(cached, false) };
      }
      // Single-flight across instances (see getBars): the lock holder refreshes,
      // the rest serve last-good rather than stampede the upstream.
      const holdsLock = await acquireRefreshLock(key);
      if (!holdsLock && cached) {
        return { quotes: cached.data, provenance: cachedProv(cached, true) }; // Tier C while another instance refreshes
      }
      try {
        // Gap-fill: Alpaca can't serve indices (^VIX); the next provider backfills
        // only the still-missing symbols, so no symbol is lost to a coverage gap.
        const remaining = new Set(symbols);
        const collected: Quote[] = [];
        let anyRealtime = false;
        let firstProvider = "";
        const deadline = Date.now() + deadlineMs;
        for (const p of chain) {
          if (!remaining.size) break;
          if (!usable(p)) continue;
          const timeLeft = deadline - Date.now();
          if (timeLeft <= 0) break; // chain budget spent — fall to cache / Tier D
          try {
            const got = await withTimeout(p.getQuotes([...remaining]), timeLeft);
            recordSuccess(p.name());
            let contributed = false;
            for (const q of got) {
              if (remaining.has(q.sym)) {
                collected.push(q);
                remaining.delete(q.sym);
                contributed = true;
              }
            }
            if (contributed) {
              firstProvider ||= p.name();
              if (p.supportsRealtime()) anyRealtime = true;
            }
          } catch (e) {
            if (isQualifyingFailure(e)) recordFailure(p.name(), errMsg(e));
          }
        }
        if (collected.length) {
          await cacheSet<Quote[]>(
            key,
            { data: collected, storedAt: Date.now(), provider: firstProvider, isRealtime: anyRealtime },
            STALE_RETENTION_S
          );
          return {
            quotes: collected,
            provenance: {
              provider: firstProvider,
              tier: liveTier(anyRealtime),
              updatedAt: Date.now(),
              cacheAge: 0,
              isRealtime: anyRealtime,
              isCached: false,
            },
          };
        }
        if (cached) return { quotes: cached.data, provenance: cachedProv(cached, true) }; // Tier C
        return {
          quotes: [],
          provenance: { provider: "none", tier: "D", updatedAt: Date.now(), cacheAge: 0, isRealtime: false, isCached: false },
        };
      } finally {
        if (holdsLock) await releaseRefreshLock(key);
      }
    });
  }

  function status() {
    return {
      chain: chain.map((p) => p.name()),
      cacheBackend: cacheBackend(),
      providers: chain.map((p) => ({
        name: p.name(),
        configured: p.available(),
        realtime: p.supportsRealtime(),
        crypto: p.supportsCrypto(),
        intraday: p.supportsIntraday(),
        health: p.health(),
      })),
      breakers: allHealth(),
    };
  }

  return { getBars, getQuotes, status };
}

const DEFAULT = createOrchestrator(DEFAULT_CHAIN);

/** The single accessor every route uses. */
export function getProvider() {
  return DEFAULT;
}

/** Observability snapshot for /api/status (no secrets). */
export function marketDataStatus() {
  return DEFAULT.status();
}

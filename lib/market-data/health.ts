// Per-provider circuit breaker. When a provider starts failing (429 / 5xx /
// timeout — the ways a market-data vendor goes down), we stop sending it traffic
// for a cooldown instead of hammering a dead endpoint on every request and
// eating its timeout each time. After the cooldown it's tried again (half-open):
// one success closes the breaker, another failure re-opens it.
//
// State is module-level, so it's shared across requests within a warm serverless
// instance. It resets on a cold start — which is fine: a breaker is a
// short-lived "give it a rest" hint, not durable state.

import type { ProviderHealth } from "./provider";

/** Consecutive qualifying failures before the breaker trips. */
const FAILURE_THRESHOLD = 3;
/** How long the breaker stays open before a retry is allowed. */
const COOLDOWN_MS = 30_000;

const registry = new Map<string, ProviderHealth>();

function ensure(name: string): ProviderHealth {
  let h = registry.get(name);
  if (!h) {
    h = { name, available: true, failures: 0, trippedUntil: 0, lastSuccess: 0 };
    registry.set(name, h);
  }
  return h;
}

/** Breaker closed? (i.e. this provider may be tried right now.) */
export function breakerClosed(name: string): boolean {
  const h = registry.get(name);
  if (!h) return true;
  return h.trippedUntil <= Date.now();
}

export function recordSuccess(name: string): void {
  const h = ensure(name);
  h.failures = 0;
  h.trippedUntil = 0;
  h.lastSuccess = Date.now();
  h.lastError = undefined;
  h.available = true;
}

/**
 * Record a QUALIFYING failure (429/5xx/timeout/network). Trips the breaker once
 * the threshold is crossed. A clean "no data" (empty result, 404) is NOT a
 * qualifying failure and should not be reported here — it doesn't mean the
 * provider is unhealthy.
 */
export function recordFailure(name: string, err: string): void {
  const h = ensure(name);
  h.failures += 1;
  h.lastError = err;
  if (h.failures >= FAILURE_THRESHOLD) {
    h.trippedUntil = Date.now() + COOLDOWN_MS;
    h.available = false;
  }
}

/** Whether the observed error should count against the breaker. */
export function isQualifyingFailure(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("network") ||
    msg.includes("fetch failed") ||
    /\b5\d\d\b/.test(msg) // 5xx
  );
}

/** Live snapshot for a provider (used by MarketDataProvider.health()). */
export function getHealth(name: string): ProviderHealth {
  const h = ensure(name);
  return { ...h, available: breakerClosed(name) };
}

/** All tracked providers, for the /api/status observability endpoint. */
export function allHealth(): ProviderHealth[] {
  return Array.from(registry.values()).map((h) => ({ ...h, available: breakerClosed(h.name) }));
}

/** Test-only: wipe breaker state between cases. */
export function __resetHealth(): void {
  registry.clear();
}

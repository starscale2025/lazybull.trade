// Cache abstraction with graceful degradation. The reliability story (Tier-C
// "last-good" stale-serve that survives a full provider outage) needs storage
// that persists ACROSS serverless invocations — which an in-process Map cannot
// do on Vercel (every cold start is a fresh process). So:
//
//   • If a Vercel-KV / Upstash REST endpoint is configured (env), use it over
//     plain fetch — no SDK dependency, serverless-friendly, cross-invocation.
//   • Otherwise fall back to an in-process Map. This keeps local dev and an
//     un-provisioned deploy fully working (dedup + short-TTL freshness within a
//     warm instance); it just can't stale-serve across cold starts until KV is
//     enabled. No setup is REQUIRED to run — the app only gets more resilient
//     once KV env is added.
//
// The cache must never break the request path: every KV call is timed out and
// its errors are swallowed (get → null, set → no-op).

import { kvCommand, kvEnabled } from "@/lib/kv";

export type CacheEntry<T> = {
  data: T;
  /** epoch ms the data was fetched from a provider. */
  storedAt: number;
  /** which provider produced it (so a Tier-C stale-serve can still name it). */
  provider: string;
  isRealtime: boolean;
};

export function cacheBackend(): "kv" | "memory" {
  return kvEnabled() ? "kv" : "memory";
}

// ── in-process fallback ───────────────────────────────────────────────────
const mem = new Map<string, { value: string; expireAt: number }>();

function memGet(key: string): string | null {
  const hit = mem.get(key);
  if (!hit) return null;
  if (hit.expireAt < Date.now()) {
    mem.delete(key);
    return null;
  }
  return hit.value;
}
function memSet(key: string, value: string, ttlS: number) {
  // Opportunistic prune so a long-lived warm instance can't grow unbounded.
  if (mem.size > 500) {
    const now = Date.now();
    for (const [k, v] of mem) if (v.expireAt < now) mem.delete(k);
  }
  mem.set(key, { value, expireAt: Date.now() + ttlS * 1000 });
}

// ── public API ────────────────────────────────────────────────────────────

/** Read the last-good entry for a key, or null. Never throws. */
export async function cacheGet<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = kvEnabled() ? ((await kvCommand(["GET", key])) as string | null) : memGet(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null; // a cache miss/error must degrade to "no cache", not an error
  }
}

/**
 * Store an entry. `retentionS` is how long it stays retrievable (well beyond the
 * freshness TTL) so Tier-C stale-serve survives an outage. Never throws.
 */
export async function cacheSet<T>(
  key: string,
  entry: CacheEntry<T>,
  retentionS: number
): Promise<void> {
  const value = JSON.stringify(entry);
  try {
    if (kvEnabled()) await kvCommand(["SET", key, value, "EX", retentionS]);
    else memSet(key, value, retentionS);
  } catch {
    /* a failed cache write must never break the response */
  }
}

// ── single-flight refresh lock (KV-only) ──────────────────────────────────
// On a stale/cold key, exactly ONE instance should hit the upstream provider;
// the rest serve last-good. This ends the cross-instance STAMPEDE where every
// warm serverless instance refreshes the same popular symbol the instant its
// short TTL lapses (N× the provider quota burn, all at once).
//
// Without KV there is nothing to coordinate across instances, so every instance
// owns its own refresh (exactly today's behavior) → acquire returns true. And it
// FAILS OPEN on any KV error: the lock is an optimization, never a correctness
// gate, so a coordination hiccup must never block a refresh.
const REFRESH_LOCK_TTL_S = 10; // > the 7s chain deadline, so it can't lapse mid-refresh

/** Try to become the ONE instance that refreshes `key`. true → go fetch. */
export async function acquireRefreshLock(
  key: string,
  ttlS: number = REFRESH_LOCK_TTL_S
): Promise<boolean> {
  if (!kvEnabled()) return true;
  try {
    return (await kvCommand(["SET", `lock:${key}`, "1", "NX", "EX", ttlS])) === "OK";
  } catch {
    return true; // KV hiccup must not block refreshes
  }
}

/** Release a refresh lock early (best-effort; it also self-expires at ttlS). */
export async function releaseRefreshLock(key: string): Promise<void> {
  if (!kvEnabled()) return;
  try {
    await kvCommand(["DEL", `lock:${key}`]);
  } catch {
    /* the lock self-expires; a lost DEL only delays the next refresh slightly */
  }
}

/** Age of an entry in ms. */
export function ageMs(entry: CacheEntry<unknown>): number {
  return Math.max(0, Date.now() - entry.storedAt);
}

/** Test-only: clear the in-process cache between cases. */
export function __clearMemCache(): void {
  mem.clear();
}

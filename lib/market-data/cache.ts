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

export type CacheEntry<T> = {
  data: T;
  /** epoch ms the data was fetched from a provider. */
  storedAt: number;
  /** which provider produced it (so a Tier-C stale-serve can still name it). */
  provider: string;
  isRealtime: boolean;
};

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const KV_ENABLED = !!(KV_URL && KV_TOKEN);

export function cacheBackend(): "kv" | "memory" {
  return KV_ENABLED ? "kv" : "memory";
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

// ── Upstash / Vercel-KV REST (single-command POST, no SDK) ────────────────
async function kvCommand(cmd: (string | number)[]): Promise<unknown> {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(2000), // KV must never wedge a request
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`kv ${r.status}`);
  const j = (await r.json()) as { result?: unknown };
  return j.result ?? null;
}

// ── public API ────────────────────────────────────────────────────────────

/** Read the last-good entry for a key, or null. Never throws. */
export async function cacheGet<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = KV_ENABLED ? ((await kvCommand(["GET", key])) as string | null) : memGet(key);
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
    if (KV_ENABLED) await kvCommand(["SET", key, value, "EX", retentionS]);
    else memSet(key, value, retentionS);
  } catch {
    /* a failed cache write must never break the response */
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

// Minimal Vercel-KV / Upstash REST client — one Redis command per POST, no SDK.
// Shared by the market-data cache (last-good + the single-flight refresh lock)
// and the SSE guard (fleet-wide per-IP caps).
//
// Two deliberate choices make this both serverless-safe AND testable:
//   • env is read at CALL time, not module load, so a test (or a late-bound
//     deploy) can toggle KV on/off without a fresh import graph;
//   • the transport is injectable, so the KV code paths can be exercised against
//     a fake in-memory Redis with zero network.
//
// KV is always an ENHANCEMENT, never a hard dependency. Every caller degrades on
// its own terms: the cache stale-serves, the refresh lock fails OPEN, the guard
// falls back to per-instance memory. A KV outage must never become an app outage.

type Transport = (cmd: (string | number)[]) => Promise<unknown>;

let testTransport: Transport | null = null;

const url = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";

/** True when a KV backend is reachable (real env, or a test transport). */
export function kvEnabled(): boolean {
  return testTransport != null || !!(url() && token());
}

/**
 * Run one Redis command over the REST API (or the injected test transport).
 * Throws on network / timeout / non-2xx — callers catch and degrade. The 2s
 * timeout guarantees KV can never wedge a request path.
 */
export async function kvCommand(cmd: (string | number)[], timeoutMs = 2000): Promise<unknown> {
  if (testTransport) return testTransport(cmd);
  const r = await fetch(url(), {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`kv ${r.status}`);
  const j = (await r.json()) as { result?: unknown };
  return j.result ?? null;
}

/** Test-only: install (or clear with null) a fake transport; flips kvEnabled → true. */
export function __setKvTransport(fn: Transport | null): void {
  testTransport = fn;
}

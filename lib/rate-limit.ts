// Fixed-window rate limiting for the AI endpoints (Realtime token mint, voice
// brain proxy, /api/explain). Every accepted request there costs real money
// upstream, so the caps must survive serverless cold starts and hold across
// the whole fleet — the per-instance module-state limiters these routes used
// to carry reset on every cold start and multiplied by instance count.
//
// Two backends, chosen at call time (same shape as lib/streaming/guard.ts):
//   • KV (Vercel-KV / Upstash) — atomic INCR on a per-window bucket key gives
//     a TRUE fleet-wide cap that survives cold starts. Bucket keys carry a TTL
//     so they clean themselves up; no sweep pass needed.
//   • in-memory — per-instance counters. Used when no KV is configured (local
//     dev, keyless deploys keep working with zero setup) AND as the fallback
//     when a KV call errors at runtime.

import { kvCommand, kvEnabled } from "@/lib/kv";

/** Fixed window length — every AI-endpoint cap is per-minute. */
export const RATE_WINDOW_MS = 60_000;

// ── client IP (the one shared derivation for every limited route) ──────────

/**
 * Client IP for rate-limit keying. Platform-set headers win: `x-real-ip` and
 * `x-vercel-forwarded-for` are written by our own proxy/edge from the socket,
 * while the LEFTMOST `x-forwarded-for` entry is whatever the client sent and
 * stays spoofable behind proxies that append rather than overwrite. Some
 * topologies still let a determined spoofer rotate the per-IP key — the GLOBAL
 * cap is the unspoofable backstop, which is why every route keeps both tiers.
 */
export function clientIp(headers: Headers): string {
  const raw =
    headers.get("x-real-ip") ||
    headers.get("x-vercel-forwarded-for") ||
    headers.get("x-forwarded-for") ||
    "";
  return raw.split(",")[0].trim() || "unknown";
}

// ── in-memory path (no KV, or KV-error fallback) ──────────────────────────
type Bucket = { count: number; windowStart: number };
const buckets = new Map<string, Bucket>();

function memConsume(key: string, max: number, now: number): boolean {
  let b = buckets.get(key);
  if (!b || now - b.windowStart >= RATE_WINDOW_MS) {
    // Align window starts to the same boundaries the KV bucket keys use, so a
    // mid-window fallback from KV agrees with KV about when the window rolls.
    b = { count: 0, windowStart: now - (now % RATE_WINDOW_MS) };
    buckets.set(key, b);
  }
  b.count += 1;
  // opportunistic prune so a warm instance's map can't grow unbounded
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now - v.windowStart >= RATE_WINDOW_MS) buckets.delete(k);
  return b.count <= max;
}

// ── KV path (atomic, fleet-wide) ──────────────────────────────────────────
async function kvConsume(key: string, max: number, now: number): Promise<boolean> {
  // Bucketed by window so the key expires on its own — no cleanup needed.
  const k = `rl:${key}:${Math.floor(now / RATE_WINDOW_MS)}`;
  const raw = await kvCommand(["INCR", k]);
  const n = Number(raw);
  // A missing/unparseable result would land on 0 and silently allow forever, so
  // treat it as a KV failure and let the caller fall back to the local counter.
  if (!Number.isFinite(n) || n < 1) throw new Error("kv INCR returned no count");
  if (n === 1) await kvCommand(["EXPIRE", k, Math.ceil(RATE_WINDOW_MS / 1000) + 5]);
  return n <= max;
}

// ── degraded-mode visibility ──────────────────────────────────────────────
// Leave a log breadcrumb whenever limiting is NOT fleet-wide, so production
// logs can answer "were the caps per-instance during this incident?". Warns at
// most once per window so a KV outage can't flood the logs.
let lastDegradedWarnAt = -Infinity;
function warnDegraded(reason: string, now: number): void {
  if (now - lastDegradedWarnAt < RATE_WINDOW_MS) return;
  lastDegradedWarnAt = now;
  console.warn(`rate-limit: degraded to per-instance limiting — ${reason}`);
}

// ── public API (async: KV is a network call) ──────────────────────────────

/** Count one hit against `key`'s current window; true while within `max`. */
export async function consume(key: string, max: number, now: number = Date.now()): Promise<boolean> {
  if (kvEnabled()) {
    try {
      return await kvConsume(key, max, now);
    } catch (e) {
      // KV outage → degrade to the per-instance counter for this window rather
      // than failing wide open (an attacker rides out the outage uncapped) or
      // failing closed (an infra blip 429s every legitimate user).
      warnDegraded(`KV error (${e instanceof Error ? e.message : String(e)})`, now);
      return memConsume(key, max, now);
    }
  }
  // No KV at all: expected in dev/test, a real gap in production.
  if (process.env.NODE_ENV === "production") warnDegraded("no KV configured", now);
  return memConsume(key, max, now);
}

/**
 * The two-tier check every AI route uses: per-IP, then global. Per-IP runs
 * FIRST so a hammering IP is rejected on its own key and can never burn more
 * than `maxPerIp` of the shared global budget per window; the global cap then
 * backstops IP rotation and spoofed forwarding headers (see clientIp).
 */
export async function underLimit(
  scope: string,
  ip: string,
  maxPerIp: number,
  maxGlobal: number,
  now: number = Date.now(),
): Promise<boolean> {
  if (!(await consume(`${scope}:ip:${ip}`, maxPerIp, now))) return false;
  return consume(`${scope}:global`, maxGlobal, now);
}

/** Test-only: reset the in-memory buckets. */
export function __resetRateLimit(): void {
  buckets.clear();
  lastDegradedWarnAt = -Infinity;
}

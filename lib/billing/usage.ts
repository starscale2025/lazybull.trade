// Daily usage counters — the store behind "5 explains per day".
//
// The 2026-09 diligence memo: "The '5 explains per day' free-tier limit on the
// pricing page does not exist in code." It now does, and it has to hold across
// serverless instances and cold starts, or a free user gets 5 per warm
// instance. Same two-backend shape as lib/rate-limit.ts, chosen at call time:
//   • KV (Vercel KV / Upstash) — INCR on a per-UTC-day key with a 2-day TTL.
//     Atomic and fleet-wide; the key cleans itself up.
//   • Mongo `usage_daily` — an upsert with $inc, with a TTL index on
//     `expiresAt` so rows self-delete. Used when no KV is configured and as
//     the fallback when a KV call errors mid-request.
//
// FAILS OPEN when both backends are unreachable. This is a product cap on a
// free tier, not a security control: the per-minute limiter in the route still
// bounds spend, and an infra blip must neither 402 a legitimate user nor turn
// the AI teacher into a 500. The degradation is logged once per window, as
// lib/rate-limit.ts does, so an incident can be reconstructed.
//
// Keys are `user:<id>` for signed-in users and `ip:<ip>` for anonymous ones
// (the route decides). A day is a UTC day, which is what the pricing page
// promises ("per day") and what `resetsAt` reports back for the UI.

import { kvCommand, kvEnabled } from "@/lib/kv";
import { db } from "@/lib/mongo";

export const DAY_MS = 86_400_000;
/** KV TTL — two days, so a counter is never reaped mid-day by clock skew. */
const KV_TTL_S = 2 * 86_400;

export type DailyResult = {
  allowed: boolean;
  /** Today's tally INCLUDING this request. 0 only when the store was unreachable. */
  count: number;
  limit: number | null;
  /** ms epoch of the next UTC midnight — when the tally resets. */
  resetsAt: number;
};

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function nextUtcMidnight(now: number): number {
  return (Math.floor(now / DAY_MS) + 1) * DAY_MS;
}

export function usageKey(kind: string, key: string, now: number): string {
  return `usage:${kind}:${key}:${utcDay(now)}`;
}

// ── KV path ────────────────────────────────────────────────────────────────
async function kvIncr(k: string): Promise<number> {
  const n = Number(await kvCommand(["INCR", k]));
  // A missing result would land on 0 and read as "under the cap" forever —
  // treat it as a KV failure so the caller falls through to Mongo.
  if (!Number.isFinite(n) || n < 1) throw new Error("kv INCR returned no count");
  if (n === 1) await kvCommand(["EXPIRE", k, KV_TTL_S]);
  return n;
}

async function kvPeek(k: string): Promise<number> {
  const n = Number((await kvCommand(["GET", k])) ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// ── Mongo path ─────────────────────────────────────────────────────────────
type UsageDoc = { _id: string; count: number; expiresAt: Date };

let indexReady: Promise<unknown> | null = null;
async function coll() {
  const c = (await db()).collection<UsageDoc>("usage_daily");
  // TTL on expiresAt (expireAfterSeconds: 0 = "at the stamped time"). Created
  // here rather than only in scripts/init-mongo.ts so a deploy that never ran
  // the script still reaps its counters — the lib/db/audit.ts precedent.
  indexReady ??= c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
  await indexReady;
  return c;
}

async function mongoIncr(k: string, now: number): Promise<number> {
  const c = await coll();
  const doc = await c.findOneAndUpdate(
    { _id: k },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(now + 2 * DAY_MS) } },
    { upsert: true, returnDocument: "after" },
  );
  const n = doc?.count;
  if (typeof n !== "number" || n < 1) throw new Error("usage_daily upsert returned no count");
  return n;
}

async function mongoPeek(k: string): Promise<number> {
  const doc = await (await coll()).findOne({ _id: k }, { projection: { count: 1 } });
  return doc?.count ?? 0;
}

// ── degraded-mode visibility (once per day-window, never a log flood) ──────
let lastWarnAt = -Infinity;
function warnDegraded(reason: string, now: number): void {
  if (now - lastWarnAt < 60_000) return;
  lastWarnAt = now;
  console.warn(`usage: daily counter degraded — ${reason}`);
}

async function incr(k: string, now: number): Promise<number> {
  if (kvEnabled()) {
    try {
      return await kvIncr(k);
    } catch (e) {
      warnDegraded(`KV error (${e instanceof Error ? e.message : String(e)}), using Mongo`, now);
    }
  }
  return mongoIncr(k, now);
}

/**
 * Count one use of `kind` against `key` for today and decide it against
 * `limit` (null = unlimited, still counted so the account page can show it).
 */
export async function consumeDaily(
  kind: string,
  key: string,
  limit: number | null,
  now: number = Date.now(),
): Promise<DailyResult> {
  const k = usageKey(kind, key, now);
  const resetsAt = nextUtcMidnight(now);
  try {
    const count = await incr(k, now);
    return { allowed: limit === null || count <= limit, count, limit, resetsAt };
  } catch (e) {
    warnDegraded(`no backend reachable (${e instanceof Error ? e.message : String(e)}), failing open`, now);
    return { allowed: true, count: 0, limit, resetsAt };
  }
}

/** Read today's tally without counting — for /api/billing/me and /account. */
export async function peekDaily(
  kind: string,
  key: string,
  now: number = Date.now(),
): Promise<{ count: number; resetsAt: number }> {
  const k = usageKey(kind, key, now);
  const resetsAt = nextUtcMidnight(now);
  try {
    if (kvEnabled()) {
      try {
        return { count: await kvPeek(k), resetsAt };
      } catch {
        /* fall through to Mongo, the same order consumeDaily uses */
      }
    }
    return { count: await mongoPeek(k), resetsAt };
  } catch {
    return { count: 0, resetsAt };
  }
}

/** Test-only: reset the index memo so a fresh memory Mongo gets its TTL index. */
export function __resetUsage(): void {
  indexReady = null;
  lastWarnAt = -Infinity;
}

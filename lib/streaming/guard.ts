// Per-IP abuse protection for the SSE endpoint: caps concurrent streams per IP
// and the rate of new connections per IP. Symbol count is capped separately in
// the route.
//
// Two backends, chosen at call time:
//   • KV (Vercel-KV / Upstash) — atomic INCR/DECR gives a TRUE fleet-wide cap:
//     8 concurrent streams per IP across ALL serverless instances, not 8 per
//     instance. This is the real limit once the app fans out to many instances.
//   • in-memory — per-instance counters. Used with no KV configured (local dev,
//     un-provisioned deploy) AND as the fallback if a KV call errors, so a KV
//     outage degrades the cap to per-instance rather than removing it or locking
//     everyone out.
//
// The KV path FAILS SOFT: on any error it falls back to the in-memory decision
// for that call. Abuse protection must never become an availability risk.

import { kvCommand, kvEnabled } from "@/lib/kv";

const MAX_ACTIVE_PER_IP = 8; // concurrent SSE streams from one IP
const MAX_NEW_PER_WINDOW = 30; // new connections per IP per window
const WINDOW_MS = 60_000;
// Leak backstop for the KV active counter: > the max stream life (route caps a
// stream at 55s) so a crashed instance's un-released slot self-heals, but long
// enough that a live stream's slot never expires under it.
const ACTIVE_TTL_S = 120;

type Rec = { active: number; opened: number; windowStart: number };
const byIp = new Map<string, Rec>();

// ── in-memory path (no KV, or KV-error fallback) ──────────────────────────
function memAcquire(ip: string, now: number): { ok: boolean; reason?: string } {
  let r = byIp.get(ip);
  if (!r) {
    r = { active: 0, opened: 0, windowStart: now };
    byIp.set(ip, r);
  } else if (now - r.windowStart > WINDOW_MS) {
    r.windowStart = now;
    r.opened = 0; // reset the rate window; keep `active` (long-lived streams persist)
  }
  if (r.active >= MAX_ACTIVE_PER_IP) return { ok: false, reason: "too many concurrent connections" };
  if (r.opened >= MAX_NEW_PER_WINDOW) return { ok: false, reason: "connection rate exceeded" };
  r.active += 1;
  r.opened += 1;
  return { ok: true };
}
function memRelease(ip: string, now: number): void {
  const r = byIp.get(ip);
  if (!r) return;
  r.active = Math.max(0, r.active - 1);
  // Prune idle records so the Map can't grow unbounded across many IPs.
  if (r.active === 0 && now - r.windowStart > WINDOW_MS) byIp.delete(ip);
}

// ── KV path (atomic, fleet-wide) ──────────────────────────────────────────
async function kvAcquire(ip: string, now: number): Promise<{ ok: boolean; reason?: string }> {
  const actKey = `sse:act:${ip}`;
  const active = Number(await kvCommand(["INCR", actKey]));
  // Refresh the leak backstop on every acquire so a busy IP's counter never
  // lapses under it, while an idle IP's counter self-heals at ACTIVE_TTL_S.
  await kvCommand(["EXPIRE", actKey, ACTIVE_TTL_S]);
  if (active > MAX_ACTIVE_PER_IP) {
    await kvCommand(["DECR", actKey]); // roll back the reservation we just made
    return { ok: false, reason: "too many concurrent connections" };
  }
  // Rate key is bucketed by window so it expires on its own — no cleanup needed.
  const rateKey = `sse:rate:${ip}:${Math.floor(now / WINDOW_MS)}`;
  const opened = Number(await kvCommand(["INCR", rateKey]));
  if (opened === 1) await kvCommand(["EXPIRE", rateKey, Math.ceil(WINDOW_MS / 1000) + 5]);
  if (opened > MAX_NEW_PER_WINDOW) {
    await kvCommand(["DECR", actKey]); // undo the active reservation; rate stays counted
    return { ok: false, reason: "connection rate exceeded" };
  }
  return { ok: true };
}
async function kvRelease(ip: string): Promise<void> {
  const actKey = `sse:act:${ip}`;
  const n = Number(await kvCommand(["DECR", actKey]));
  if (n < 0) await kvCommand(["SET", actKey, "0"]); // never let a stray DECR under-count
}

// ── public API (async: KV is a network call) ──────────────────────────────

/** Reserve a connection slot for `ip`. Resolves { ok:false } when a cap is hit. */
export async function tryAcquire(
  ip: string,
  now: number = Date.now()
): Promise<{ ok: boolean; reason?: string }> {
  if (kvEnabled()) {
    try {
      return await kvAcquire(ip, now);
    } catch {
      return memAcquire(ip, now); // KV outage → per-instance cap, not no cap
    }
  }
  return memAcquire(ip, now);
}

/** Release a slot when the stream ends (idempotent per call site via the route). */
export async function release(ip: string, now: number = Date.now()): Promise<void> {
  if (kvEnabled()) {
    try {
      await kvRelease(ip);
      return;
    } catch {
      /* fall through to the in-memory release */
    }
  }
  memRelease(ip, now);
}

export const GUARD_LIMITS = { MAX_ACTIVE_PER_IP, MAX_NEW_PER_WINDOW, WINDOW_MS, ACTIVE_TTL_S } as const;

/** Test-only: reset the in-memory counters. */
export function __resetGuard(): void {
  byIp.clear();
}

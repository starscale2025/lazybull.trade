// P0-5: lightweight per-IP abuse protection for the SSE endpoint. In-memory and
// per-instance by design (no Redis/worker — Vercel-compatible + "lightweight"):
// it caps concurrent streams per IP and the rate of new connections per IP.
// It is NOT a global limiter (each serverless instance keeps its own counts),
// but it stops a single client from opening thousands of streams against one
// instance and exhausting that instance's concurrency. Symbol count is capped
// separately in the route.

const MAX_ACTIVE_PER_IP = 8; // concurrent SSE streams from one IP
const MAX_NEW_PER_WINDOW = 30; // new connections per IP per window
const WINDOW_MS = 60_000;

type Rec = { active: number; opened: number; windowStart: number };
const byIp = new Map<string, Rec>();

/** Reserve a connection slot for `ip`. Returns { ok:false } when a cap is hit. */
export function tryAcquire(ip: string, now: number = Date.now()): { ok: boolean; reason?: string } {
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

/** Release a slot when the stream ends (idempotent per call site via the route). */
export function release(ip: string, now: number = Date.now()): void {
  const r = byIp.get(ip);
  if (!r) return;
  r.active = Math.max(0, r.active - 1);
  // Prune idle records so the Map can't grow unbounded across many IPs.
  if (r.active === 0 && now - r.windowStart > WINDOW_MS) byIp.delete(ip);
}

export const GUARD_LIMITS = { MAX_ACTIVE_PER_IP, MAX_NEW_PER_WINDOW, WINDOW_MS } as const;

/** Test-only: reset all counters. */
export function __resetGuard(): void {
  byIp.clear();
}

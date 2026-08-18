import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { consume, underLimit, clientIp, __resetRateLimit, RATE_WINDOW_MS } from "@/lib/rate-limit";
import { __setKvTransport } from "@/lib/kv";
import { fakeKv } from "./helpers/fakeKv";

// Fixed-window limiter behind the AI endpoints (realtime token mint, voice
// brain, /api/explain). Two backends: KV bucket counters (fleet-wide) and the
// in-memory fallback (no KV configured, or KV erroring). Both are covered here
// with no network — the KV path runs against the shared fake transport.

const T0 = 10 * RATE_WINDOW_MS; // an aligned, boring "now" for deterministic windows

beforeEach(__resetRateLimit);
afterEach(() => {
  __setKvTransport(null);
  __resetRateLimit();
});

describe("rate limiter (in-memory path — no KV configured)", () => {
  it("caps a key within the window and resets after rollover", async () => {
    for (let i = 0; i < 3; i++) expect(await consume("t:a", 3, T0 + i)).toBe(true);
    expect(await consume("t:a", 3, T0 + 10)).toBe(false); // one past the cap

    // next fixed window → fresh allowance
    expect(await consume("t:a", 3, T0 + RATE_WINDOW_MS)).toBe(true);
  });

  it("isolates keys from each other", async () => {
    for (let i = 0; i < 3; i++) await consume("t:b", 3, T0);
    expect(await consume("t:b", 3, T0)).toBe(false); // this key is saturated
    expect(await consume("t:c", 3, T0)).toBe(true); // a different key is unaffected
  });
});

describe("underLimit (per-IP + global tiers)", () => {
  it("rejects a hammering IP on its own key without draining the global budget", async () => {
    // IP A: 2 allowed, then a burst of rejected calls…
    expect(await underLimit("s", "1.1.1.1", 2, 4, T0)).toBe(true);
    expect(await underLimit("s", "1.1.1.1", 2, 4, T0)).toBe(true);
    for (let i = 0; i < 10; i++) expect(await underLimit("s", "1.1.1.1", 2, 4, T0)).toBe(false);
    // …which must not have burned global slots: IP B still gets its full share.
    expect(await underLimit("s", "2.2.2.2", 2, 4, T0)).toBe(true);
    expect(await underLimit("s", "2.2.2.2", 2, 4, T0)).toBe(true);
  });

  it("the global cap backstops IP rotation (spoofed per-IP keys)", async () => {
    // 4 requests from 4 "different" IPs exhaust maxGlobal=4…
    for (let i = 0; i < 4; i++) expect(await underLimit("g", `9.9.9.${i}`, 2, 4, T0)).toBe(true);
    // …so a fresh IP with per-IP allowance to spare is still rejected.
    expect(await underLimit("g", "9.9.9.99", 2, 4, T0)).toBe(false);
  });
});

describe("rate limiter (KV path — fleet-wide bucket counters)", () => {
  let kv: ReturnType<typeof fakeKv>;
  beforeEach(() => {
    kv = fakeKv();
    __setKvTransport(kv.transport);
  });

  it("counts in shared rl:* bucket keys and rolls over with the window", async () => {
    for (let i = 0; i < 3; i++) expect(await consume("t:kv", 3, T0)).toBe(true);
    expect(await consume("t:kv", 3, T0)).toBe(false);
    // the counter lives in KV (any instance would see it), bucketed by window
    const bucket = Math.floor(T0 / RATE_WINDOW_MS);
    expect(Number(kv.store.get(`rl:t:kv:${bucket}`)?.val)).toBe(4);

    // a new window is a new bucket key → allowance resets
    expect(await consume("t:kv", 3, T0 + RATE_WINDOW_MS)).toBe(true);
  });

  it("keeps per-IP and global tiers in separate KV keys", async () => {
    await underLimit("v", "3.3.3.3", 5, 50, T0);
    const bucket = Math.floor(T0 / RATE_WINDOW_MS);
    expect(Number(kv.store.get(`rl:v:ip:3.3.3.3:${bucket}`)?.val)).toBe(1);
    expect(Number(kv.store.get(`rl:v:global:${bucket}`)?.val)).toBe(1);
  });

  it("fails SOFT to the in-memory counter when every KV call errors", async () => {
    __setKvTransport(async () => {
      throw new Error("kv down");
    });
    // KV is 'enabled' (a transport is installed) but every command throws, so
    // the limiter must degrade to the per-instance counter — not fail wide
    // open (uncapped) and not hard-block everyone.
    for (let i = 0; i < 3; i++) expect(await consume("t:down", 3, T0)).toBe(true);
    expect(await consume("t:down", 3, T0)).toBe(false); // in-memory cap still holds
  });
});

describe("clientIp", () => {
  it("prefers the platform-set x-real-ip over a spoofable x-forwarded-for", () => {
    const h = new Headers({ "x-real-ip": "5.5.5.5", "x-forwarded-for": "6.6.6.6, 5.5.5.5" });
    expect(clientIp(h)).toBe("5.5.5.5"); // NOT the client-supplied leftmost 6.6.6.6
  });

  it("falls back to x-vercel-forwarded-for, then leftmost x-forwarded-for, then unknown", () => {
    expect(clientIp(new Headers({ "x-vercel-forwarded-for": "7.7.7.7" }))).toBe("7.7.7.7");
    expect(clientIp(new Headers({ "x-forwarded-for": " 8.8.8.8 , 9.9.9.9" }))).toBe("8.8.8.8");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

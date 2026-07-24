import { describe, it, expect, beforeEach } from "vitest";
import { tryAcquire, release, __resetGuard, GUARD_LIMITS } from "@/lib/streaming/guard";

// P0-5: per-IP abuse protection for the SSE endpoint. With no KV configured (the
// test env) tryAcquire/release resolve against the in-memory per-instance path.
// The KV atomic path is covered separately in streaming-guard-kv.test.ts.
beforeEach(__resetGuard);

describe("SSE connection guard (P0-5, in-memory path)", () => {
  it("caps concurrent connections per IP, and frees a slot on release", async () => {
    for (let i = 0; i < GUARD_LIMITS.MAX_ACTIVE_PER_IP; i++) {
      expect((await tryAcquire("1.1.1.1")).ok).toBe(true);
    }
    const over = await tryAcquire("1.1.1.1");
    expect(over.ok).toBe(false); // one past the concurrent cap
    expect(over.reason).toMatch(/concurrent/);

    await release("1.1.1.1");
    expect((await tryAcquire("1.1.1.1")).ok).toBe(true); // a freed slot is reusable
  });

  it("caps the NEW-connection rate per IP within a window", async () => {
    const now = 1_000_000;
    // Open + immediately release so we exercise the rate cap, not the concurrent cap.
    for (let i = 0; i < GUARD_LIMITS.MAX_NEW_PER_WINDOW; i++) {
      expect((await tryAcquire("2.2.2.2", now)).ok).toBe(true);
      await release("2.2.2.2", now);
    }
    const rateLimited = await tryAcquire("2.2.2.2", now);
    expect(rateLimited.ok).toBe(false); // rate exceeded inside the window
    expect(rateLimited.reason).toMatch(/rate/);

    // A fresh window resets the rate allowance.
    expect((await tryAcquire("2.2.2.2", now + GUARD_LIMITS.WINDOW_MS + 1)).ok).toBe(true);
  });

  it("isolates IPs from each other", async () => {
    for (let i = 0; i < GUARD_LIMITS.MAX_ACTIVE_PER_IP; i++) await tryAcquire("3.3.3.3");
    expect((await tryAcquire("3.3.3.3")).ok).toBe(false); // this IP is saturated
    expect((await tryAcquire("4.4.4.4")).ok).toBe(true); // a different IP is unaffected
  });
});

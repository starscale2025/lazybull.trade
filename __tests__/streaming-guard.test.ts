import { describe, it, expect, beforeEach } from "vitest";
import { tryAcquire, release, __resetGuard, GUARD_LIMITS } from "@/lib/streaming/guard";

// P0-5: per-IP abuse protection for the SSE endpoint.
beforeEach(__resetGuard);

describe("SSE connection guard (P0-5)", () => {
  it("caps concurrent connections per IP, and frees a slot on release", () => {
    for (let i = 0; i < GUARD_LIMITS.MAX_ACTIVE_PER_IP; i++) {
      expect(tryAcquire("1.1.1.1").ok).toBe(true);
    }
    const over = tryAcquire("1.1.1.1");
    expect(over.ok).toBe(false); // one past the concurrent cap
    expect(over.reason).toMatch(/concurrent/);

    release("1.1.1.1");
    expect(tryAcquire("1.1.1.1").ok).toBe(true); // a freed slot is reusable
  });

  it("caps the NEW-connection rate per IP within a window", () => {
    const now = 1_000_000;
    // Open + immediately release so we exercise the rate cap, not the concurrent cap.
    for (let i = 0; i < GUARD_LIMITS.MAX_NEW_PER_WINDOW; i++) {
      expect(tryAcquire("2.2.2.2", now).ok).toBe(true);
      release("2.2.2.2", now);
    }
    const rateLimited = tryAcquire("2.2.2.2", now);
    expect(rateLimited.ok).toBe(false); // rate exceeded inside the window
    expect(rateLimited.reason).toMatch(/rate/);

    // A fresh window resets the rate allowance.
    expect(tryAcquire("2.2.2.2", now + GUARD_LIMITS.WINDOW_MS + 1).ok).toBe(true);
  });

  it("isolates IPs from each other", () => {
    for (let i = 0; i < GUARD_LIMITS.MAX_ACTIVE_PER_IP; i++) tryAcquire("3.3.3.3");
    expect(tryAcquire("3.3.3.3").ok).toBe(false); // this IP is saturated
    expect(tryAcquire("4.4.4.4").ok).toBe(true); // a different IP is unaffected
  });
});

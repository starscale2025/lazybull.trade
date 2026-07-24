import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tryAcquire, release, __resetGuard, GUARD_LIMITS } from "@/lib/streaming/guard";
import { __setKvTransport } from "@/lib/kv";
import { fakeKv } from "./helpers/fakeKv";

// D5: the KV-backed atomic guard. Counters live in a shared KV, so the per-IP
// cap is FLEET-WIDE (every call, whatever instance, hits the same counter) —
// not per-instance. A shared fake KV lets us prove that in one process.
const { MAX_ACTIVE_PER_IP, MAX_NEW_PER_WINDOW, WINDOW_MS } = GUARD_LIMITS;

let kv: ReturnType<typeof fakeKv>;
beforeEach(() => {
  kv = fakeKv();
  __setKvTransport(kv.transport);
  __resetGuard();
});
afterEach(() => {
  __setKvTransport(null);
  __resetGuard();
});

describe("SSE connection guard (D5, KV atomic path)", () => {
  it("enforces a fleet-wide concurrent cap via the shared counter", async () => {
    for (let i = 0; i < MAX_ACTIVE_PER_IP; i++) {
      expect((await tryAcquire("5.5.5.5")).ok).toBe(true);
    }
    const over = await tryAcquire("5.5.5.5");
    expect(over.ok).toBe(false);
    expect(over.reason).toMatch(/concurrent/);
    // the shared counter sits exactly at the cap — the rejected attempt rolled back
    expect(Number(kv.store.get("sse:act:5.5.5.5")?.val)).toBe(MAX_ACTIVE_PER_IP);

    await release("5.5.5.5");
    expect((await tryAcquire("5.5.5.5")).ok).toBe(true); // a freed slot reopens
  });

  it("caps the new-connection rate within a window and resets next window", async () => {
    const now = 5_000_000;
    for (let i = 0; i < MAX_NEW_PER_WINDOW; i++) {
      expect((await tryAcquire("6.6.6.6", now)).ok).toBe(true);
      await release("6.6.6.6", now); // release so we hit the RATE cap, not the concurrent one
    }
    const rate = await tryAcquire("6.6.6.6", now);
    expect(rate.ok).toBe(false);
    expect(rate.reason).toMatch(/rate/);

    // A new window is a new bucket key → allowance resets.
    expect((await tryAcquire("6.6.6.6", now + WINDOW_MS + 1)).ok).toBe(true);
  });

  it("never lets a stray release push the counter negative", async () => {
    await tryAcquire("7.7.7.7"); // active = 1
    await release("7.7.7.7"); // active = 0
    await release("7.7.7.7"); // stray → must clamp at 0, not -1

    // If the clamp failed, the counter would be -1 and 9 acquires would slip through.
    for (let i = 0; i < MAX_ACTIVE_PER_IP; i++) {
      expect((await tryAcquire("7.7.7.7")).ok).toBe(true);
    }
    expect((await tryAcquire("7.7.7.7")).ok).toBe(false); // still capped at exactly MAX
  });

  it("fails SOFT to the in-memory cap when every KV call errors", async () => {
    __setKvTransport(async () => {
      throw new Error("kv down");
    });
    // KV is 'enabled' (a transport is installed) but every command throws, so the
    // guard must fall back to the per-instance in-memory cap — not lock everyone
    // out, and not let everyone through uncapped.
    for (let i = 0; i < MAX_ACTIVE_PER_IP; i++) {
      expect((await tryAcquire("8.8.8.8")).ok).toBe(true);
    }
    expect((await tryAcquire("8.8.8.8")).ok).toBe(false); // in-memory cap still holds
  });
});

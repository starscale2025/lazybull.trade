import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Controllable mock of the market-data layer the SSE route sits on.
const h = vi.hoisted(() => ({
  impl: async (_syms: string[]): Promise<{ quotes: unknown[]; provenance: unknown }> => {
    throw new Error("provider boom");
  },
}));
vi.mock("@/lib/market-data", () => ({
  getProvider: () => ({
    getQuotes: (syms: string[]) => h.impl(syms),
    getBars: async () => null,
  }),
}));

import { GET } from "@/app/api/stream/quotes/route";
import { __resetGuard, GUARD_LIMITS } from "@/lib/streaming/guard";

beforeEach(() => {
  __resetGuard();
  process.env.SSE_TICK_MS = "20";
  process.env.SSE_HEARTBEAT_MS = "20";
  process.env.SSE_CYCLE_MS = "250";
  h.impl = async () => {
    throw new Error("provider boom");
  };
});
afterEach(() => {
  delete process.env.SSE_TICK_MS;
  delete process.env.SSE_HEARTBEAT_MS;
  delete process.env.SSE_CYCLE_MS;
  vi.restoreAllMocks();
});

async function collect(res: Response, ms: number): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) out += dec.decode(value, { stream: true });
  }
  try {
    await reader.cancel();
  } catch {
    /* already closed */
  }
  return out;
}

describe("SSE route resilience (P0-1, P0-2)", () => {
  it("keeps the stream alive + heartbeats even when every provider fetch throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(new Request("http://x/api/stream/quotes?symbols=AAPL"));
    const text = await collect(res, 400);

    expect(text).toContain("event: hello");
    // P0-2: heartbeats keep coming despite the failing pump.
    expect((text.match(/event: hb/g) || []).length).toBeGreaterThanOrEqual(2);
    // P0-1: a provider failure never emits an error event or tears down the stream…
    expect(text).not.toContain("event: error");
    // …it ends only at the clean cycle boundary.
    expect(text).toContain("event: bye");
    expect(spy).toHaveBeenCalled(); // the failure was logged
  });

  it("still streams quotes when the provider works (existing behavior unchanged)", async () => {
    h.impl = async () => ({
      quotes: [{ sym: "AAPL", last: 123.45, chg: 1, chgPct: 1 }],
      provenance: { provider: "alpaca", tier: "A", updatedAt: 0, cacheAge: 0, isRealtime: true, isCached: false },
    });
    const res = await GET(new Request("http://x/api/stream/quotes?symbols=AAPL"));
    const text = await collect(res, 200);
    expect(text).toContain("event: quotes");
    expect(text).toContain("AAPL");
    expect(text).toContain("123.45");
  });

  it("rejects with 429 once the per-IP connection cap is hit (P0-5)", async () => {
    const headers = { "x-forwarded-for": "9.9.9.9" };
    const held: Response[] = [];
    for (let i = 0; i < GUARD_LIMITS.MAX_ACTIVE_PER_IP; i++) {
      held.push(await GET(new Request("http://x/api/stream/quotes?symbols=AAPL", { headers })));
    }
    const blocked = await GET(new Request("http://x/api/stream/quotes?symbols=AAPL", { headers }));
    expect(blocked.status).toBe(429);
    for (const r of held) {
      try {
        await r.body?.cancel();
      } catch {
        /* */
      }
    }
  });

  it("keys the cap on the platform-set IP — a rotating spoofed XFF can't dodge it (R-06)", async () => {
    const held: Response[] = [];
    for (let i = 0; i < GUARD_LIMITS.MAX_ACTIVE_PER_IP; i++) {
      held.push(
        await GET(
          new Request("http://x/api/stream/quotes?symbols=AAPL", {
            headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": `10.0.0.${i}` },
          })
        )
      );
    }
    // Same real IP, yet another forged XFF: still the same guard key → 429.
    const blocked = await GET(
      new Request("http://x/api/stream/quotes?symbols=AAPL", {
        headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "10.0.0.99" },
      })
    );
    expect(blocked.status).toBe(429);
    for (const r of held) {
      try {
        await r.body?.cancel();
      } catch {
        /* */
      }
    }
  });
});

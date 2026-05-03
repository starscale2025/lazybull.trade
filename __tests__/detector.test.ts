import { describe, expect, it } from "vitest";
import { detect } from "@/lib/detector";
import type { Leg } from "@/lib/pricing";

const mk = (over: Partial<Leg>): Leg => ({
  id: "x",
  type: "C",
  side: "long",
  strike: 100,
  qty: 1,
  premium: 1,
  ...over,
});

describe("strategy detector", () => {
  it("detects a long call", () => {
    expect(detect([mk({ side: "long", type: "C" })]).kind).toBe("Long Call");
  });

  it("detects a long put", () => {
    expect(detect([mk({ side: "long", type: "P", strike: 90 })]).kind).toBe("Long Put");
  });

  it("flags naked short call as unbounded", () => {
    const d = detect([mk({ side: "short", type: "C" })]);
    expect(d.kind).toBe("Short Call");
    expect(d.defined).toBe(false);
  });

  it("detects bull call spread", () => {
    const d = detect([
      mk({ id: "lo", side: "long", type: "C", strike: 100, premium: 5 }),
      mk({ id: "hi", side: "short", type: "C", strike: 110, premium: 2 }),
    ]);
    expect(d.kind).toBe("Bull Call Spread");
    expect(d.bias).toBe("bullish");
    expect(d.defined).toBe(true);
    expect(d.net).toBe("debit");
  });

  it("detects bull put spread", () => {
    const d = detect([
      mk({ id: "lo", side: "long", type: "P", strike: 90, premium: 1 }),
      mk({ id: "hi", side: "short", type: "P", strike: 100, premium: 4 }),
    ]);
    expect(d.kind).toBe("Bull Put Spread");
    expect(d.bias).toBe("bullish");
    expect(d.defined).toBe(true);
    expect(d.net).toBe("credit");
  });

  it("detects long straddle (same strike, long both)", () => {
    const d = detect([
      mk({ id: "c", type: "C", strike: 100, side: "long" }),
      mk({ id: "p", type: "P", strike: 100, side: "long" }),
    ]);
    expect(d.kind).toBe("Long Straddle");
    expect(d.bias).toBe("volatile");
  });

  it("detects long strangle (different strikes, long both)", () => {
    const d = detect([
      mk({ id: "c", type: "C", strike: 110, side: "long" }),
      mk({ id: "p", type: "P", strike: 90, side: "long" }),
    ]);
    expect(d.kind).toBe("Long Strangle");
  });

  it("detects iron condor (4 legs, condor shape)", () => {
    const d = detect([
      mk({ id: "p1", type: "P", strike: 80, side: "long", premium: 0.5 }),
      mk({ id: "p2", type: "P", strike: 90, side: "short", premium: 1.5 }),
      mk({ id: "c1", type: "C", strike: 110, side: "short", premium: 1.4 }),
      mk({ id: "c2", type: "C", strike: 120, side: "long", premium: 0.4 }),
    ]);
    expect(d.kind).toBe("Iron Condor");
    expect(d.defined).toBe(true);
    expect(d.bias).toBe("neutral");
  });

  it("detects iron butterfly when middle strikes coincide", () => {
    const d = detect([
      mk({ id: "p1", type: "P", strike: 80, side: "long", premium: 0.3 }),
      mk({ id: "p2", type: "P", strike: 100, side: "short", premium: 3 }),
      mk({ id: "c1", type: "C", strike: 100, side: "short", premium: 3 }),
      mk({ id: "c2", type: "C", strike: 120, side: "long", premium: 0.3 }),
    ]);
    expect(d.kind).toBe("Iron Butterfly");
  });

  it("falls back to Custom for unknown shape", () => {
    const d = detect([
      mk({ id: "c1", type: "C", strike: 100, side: "long" }),
      mk({ id: "c2", type: "C", strike: 110, side: "long" }),
      mk({ id: "p1", type: "P", strike: 90, side: "short" }),
    ]);
    expect(d.kind).toBe("Custom");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HeroPosition } from "@/lib/hero-position";

const base: HeroPosition = { k1: 96, k2: 104, maxLoss: 410.4, maxProfit: 389.6, breakeven: 100.1, chosen: false };

// Module state, so each test gets a fresh store.
async function fresh() {
  vi.resetModules();
  return import("@/lib/hero-position");
}

describe("hero position store", () => {
  let store: Awaited<ReturnType<typeof fresh>>;
  let calls: number;
  beforeEach(async () => {
    store = await fresh();
    calls = 0;
    store.onHeroPosition(() => calls++);
  });

  it("publishes the first position", () => {
    expect(store.getHeroPosition()).toBeNull();
    store.setHeroPosition(base);
    expect(store.getHeroPosition()).toEqual(base);
    expect(calls).toBe(1);
  });

  it("drops a repeat of the same position, including sub-dollar loss noise", () => {
    store.setHeroPosition(base);
    store.setHeroPosition({ ...base });
    store.setHeroPosition({ ...base, maxLoss: 410.2, maxProfit: 389.8 });
    expect(calls).toBe(1);
  });

  it("publishes every real change: a strike, the choice, the dollar loss", () => {
    store.setHeroPosition(base);
    store.setHeroPosition({ ...base, k1: 97 });
    store.setHeroPosition({ ...base, k1: 97, chosen: true });
    store.setHeroPosition({ ...base, k1: 97, chosen: true, maxLoss: 450 });
    expect(calls).toBe(4);
    expect(store.getHeroPosition()?.maxLoss).toBe(450);
  });

  it("stops telling a listener that unsubscribed", () => {
    let mine = 0;
    const off = store.onHeroPosition(() => mine++);
    store.setHeroPosition(base);
    off();
    store.setHeroPosition({ ...base, k2: 110 });
    expect(mine).toBe(1);
  });
});

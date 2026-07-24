import { describe, it, expect, vi, afterEach } from "vitest";
import { unionOf, backoffDelay, changedSymbols, streamingManager } from "@/lib/streaming/manager";
import type { Quote } from "@/lib/market-data/provider";

// Minimal EventSource stand-in so the manager takes its SSE path in node/vitest
// and we can drive hello/quotes/error deterministically.
class FakeES {
  static last: FakeES | null = null;
  listeners: Record<string, ((e: { data?: string }) => void)[]> = {};
  onerror: (() => void) | null = null;
  readyState = 0;
  constructor(public url: string) {
    FakeES.last = this;
  }
  addEventListener(type: string, cb: (e: { data?: string }) => void) {
    (this.listeners[type] ||= []).push(cb);
  }
  close() {
    this.readyState = 2;
  }
  emit(type: string, data?: string) {
    (this.listeners[type] || []).forEach((cb) => cb({ data }));
  }
  fail() {
    this.onerror?.();
  }
}
(globalThis as unknown as { EventSource: unknown }).EventSource = FakeES;
// The manager guards its SSE path on `typeof window !== "undefined"` (SSR
// safety); shim a window so the node test env takes that path.
(globalThis as unknown as { window: unknown }).window = globalThis;

const sub = (syms: string[]) => ({ symbols: new Set(syms), cb: () => {} });
const q = (sym: string, last: number): Quote => ({ sym, last, chg: 0, chgPct: 0 });

describe("streaming manager — pure logic", () => {
  it("unions subscriber symbols, sorted + de-duped (one connection covers all)", () => {
    expect(unionOf([sub(["AAPL", "MSFT"]), sub(["MSFT", "^VIX"])])).toEqual(["AAPL", "MSFT", "^VIX"]);
    expect(unionOf([sub(["AAPL"]), sub(["AAPL"])])).toEqual(["AAPL"]); // 100 users, one subscription
    expect(unionOf([])).toEqual([]);
  });

  it("reconnects with exponential backoff capped at 15s", () => {
    expect(backoffDelay(1)).toBe(1000);
    expect(backoffDelay(2)).toBe(2000);
    expect(backoffDelay(3)).toBe(4000);
    expect(backoffDelay(4)).toBe(8000);
    expect(backoffDelay(5)).toBe(15000); // 16000 → capped
    expect(backoffDelay(20)).toBe(15000);
  });

  it("fans out only the symbols whose price actually changed", () => {
    const prev = new Map([
      ["AAPL", 100],
      ["MSFT", 200],
    ]);
    const changed = changedSymbols(prev, [q("AAPL", 100), q("MSFT", 201), q("NVDA", 50)]).sort();
    expect(changed).toEqual(["MSFT", "NVDA"]); // AAPL unchanged; NVDA new
  });
});

describe("reconnect backoff (P0-3)", () => {
  afterEach(() => vi.useRealTimers());

  it("does NOT reset attempts on hello, but DOES on the first real data", () => {
    vi.useFakeTimers();
    const unsub = streamingManager.subscribe(["ZZZ"], () => {});
    vi.advanceTimersByTime(300); // debounce → connect → FakeES
    const es1 = FakeES.last!;
    expect(es1).toBeTruthy();

    es1.fail(); // dropped before any data → one reconnect attempt is counted
    expect(streamingManager.__attempts()).toBe(1);

    vi.advanceTimersByTime(1100); // backoff(1)=1000ms fires → reconnect → new FakeES
    const es2 = FakeES.last!;
    es2.emit("hello"); // P0-3: must NOT reset the counter (the old bug reset it to 0)
    expect(streamingManager.__attempts()).toBe(1);

    es2.emit("quotes", JSON.stringify({ quotes: [{ sym: "ZZZ", last: 1, chg: 0, chgPct: 0 }] }));
    expect(streamingManager.__attempts()).toBe(0); // reset only once real data flows

    unsub();
    vi.advanceTimersByTime(300); // let the debounced teardown run
  });
});

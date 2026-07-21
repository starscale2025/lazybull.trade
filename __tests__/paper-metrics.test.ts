import { describe, expect, it } from "vitest";
import { accountMetrics, protectionFor, toCsv } from "@/lib/paper-metrics";
import type { SharePosition } from "@/lib/paper-shares";
import type { Order } from "@/lib/paper-orders";

const pos = (sym: string, qty: number, avgPrice: number): SharePosition => ({
  sym,
  qty,
  avgPrice,
  realized: 0,
  openedAt: 0,
  lastTs: 0,
});

const order = (p: Partial<Order>): Order => ({
  id: p.id ?? "o",
  sym: p.sym ?? "AAPL",
  side: p.side ?? "buy",
  type: p.type ?? "limit",
  qty: p.qty ?? 1,
  tif: p.tif ?? "gtc",
  status: p.status ?? "working",
  placedAt: 0,
  ...p,
});

describe("accountMetrics identities", () => {
  it("reproduces the reference panel's arithmetic from store-native cash", () => {
    // Short 1 AAPL @ 293.32 from 100k: the store CREDITS the proceeds, so cash
    // is 100,293.32. Market 327.22 -> unrealised -33.90, equity 99,966.10.
    const m = accountMetrics({
      cash: 100_293.32,
      realizedToday: 0,
      shares: { AAPL: pos("AAPL", -1, 293.32) },
      orders: [],
      marks: { AAPL: 327.22 },
    });
    expect(m.unrealizedPnl).toBeCloseTo(-33.9, 2);
    expect(m.equity).toBeCloseTo(99_966.1, 2);
    // The published identities must hold exactly.
    expect(m.equity).toBeCloseTo(m.balance + m.holdingsValue + m.betsAtCost, 6);
    expect(m.availableFunds).toBeCloseTo(m.equity - m.accountMargin - m.ordersMargin, 6);
    expect(m.marginBuffer).toBeCloseTo(m.availableFunds / m.equity, 6);
  });

  it("buying shares with cash does not move the account value — the regression", () => {
    // 100 AAPL @ 327.015 bought from 100k: cash drops by the notional, the
    // holding is worth the notional. The old contract (equity = cash +
    // unrealised) showed this as -32.7% with zero P&L on the portfolio page.
    const m = accountMetrics({
      cash: 100_000 - 32_701.5,
      realizedToday: 0,
      shares: { AAPL: pos("AAPL", 100, 327.015) },
      orders: [],
      marks: { AAPL: 327.015 },
    });
    expect(m.unrealizedPnl).toBeCloseTo(0, 6);
    expect(m.equity).toBeCloseTo(100_000, 6);
    // Available funds reconcile with spendable cash for a fully-paid long.
    expect(m.availableFunds).toBeCloseTo(100_000 - 32_701.5, 6);
  });

  it("carries open option bets at cost — a placed bet is not an instant loss", () => {
    // 500 debit bet from 100k cash: cash 99,500, bet carried at 500.
    const m = accountMetrics({
      cash: 99_500,
      realizedToday: 0,
      shares: {},
      orders: [],
      marks: {},
      openBetCost: 500,
    });
    expect(m.betsAtCost).toBe(500);
    expect(m.equity).toBeCloseTo(100_000, 6);
    // A credit bet is a liability at cost, not free money.
    const credit = accountMetrics({
      cash: 100_200, realizedToday: 0, shares: {}, orders: [], marks: {}, openBetCost: -200,
    });
    expect(credit.equity).toBeCloseTo(100_000, 6);
  });

  it("charges margin on a short the same as a long — exposure is symmetric", () => {
    const long = accountMetrics({
      cash: 100_000, realizedToday: 0, shares: { A: pos("A", 10, 50) }, orders: [], marks: { A: 60 },
    });
    const short = accountMetrics({
      cash: 100_000, realizedToday: 0, shares: { A: pos("A", -10, 50) }, orders: [], marks: { A: 60 },
    });
    expect(long.accountMargin).toBe(600);
    expect(short.accountMargin).toBe(600);
    // ...but the P&L is inverted.
    expect(long.unrealizedPnl).toBe(100);
    expect(short.unrealizedPnl).toBe(-100);
  });

  it("subtracts working-order margin from available funds", () => {
    const m = accountMetrics({
      cash: 10_000,
      realizedToday: 0,
      shares: {},
      orders: [order({ side: "buy", type: "limit", limitPrice: 100, qty: 20 })], // 2000
      marks: {},
    });
    expect(m.ordersMargin).toBe(2000);
    expect(m.availableFunds).toBe(8000);
    expect(m.marginBuffer).toBeCloseTo(0.8, 6);
  });

  it("counts positions carried at cost so the caller can disclose it", () => {
    const m = accountMetrics({
      cash: 100_000,
      realizedToday: 0,
      shares: { A: pos("A", 10, 50), B: pos("B", 5, 20) },
      orders: [],
      marks: { A: 60 }, // B has no live mark
    });
    expect(m.unmarkedCount).toBe(1);
    // B contributes its cost to margin but nothing to unrealised — never a
    // fabricated gain on a symbol we cannot price.
    expect(m.accountMargin).toBe(600 + 100);
    expect(m.unrealizedPnl).toBe(100);
  });

  it("never returns NaN on a wiped-out or empty account", () => {
    const empty = accountMetrics({ cash: 0, realizedToday: 0, shares: {}, orders: [], marks: {} });
    expect(empty.marginBuffer).toBe(0);
    expect(Number.isFinite(empty.equity)).toBe(true);

    const junk = accountMetrics({
      cash: NaN,
      realizedToday: NaN,
      shares: { A: { ...pos("A", 10, 50), qty: NaN } },
      orders: [],
      marks: { A: 60 },
    });
    expect(Number.isFinite(junk.balance)).toBe(true);
    expect(Number.isFinite(junk.equity)).toBe(true);
    expect(Number.isFinite(junk.marginBuffer)).toBe(true);
  });

  it("clamps the buffer to 0..1 rather than showing a negative percentage", () => {
    // A fully-paid long can't take available funds negative under cash
    // accounting — but an over-reserved order book can (e.g. stale state from
    // before the buying-power gate). The metric must clamp, not show -400%.
    const over = accountMetrics({
      cash: 1_000,
      realizedToday: 0,
      shares: {},
      orders: [order({ side: "buy", type: "limit", limitPrice: 50, qty: 100 })], // reserves 5000
      marks: {},
    });
    expect(over.availableFunds).toBeLessThan(0);
    expect(over.marginBuffer).toBe(0);
  });
});

describe("protectionFor", () => {
  const orders = [
    order({ id: "tp", sym: "AAPL", type: "limit", limitPrice: 400, reduceOnly: true, side: "sell" }),
    order({ id: "sl", sym: "AAPL", type: "stop", stopPrice: 300, reduceOnly: true, side: "sell" }),
    order({ id: "entry", sym: "AAPL", type: "limit", limitPrice: 350, side: "buy" }), // not reduce-only
    order({ id: "other", sym: "NVDA", type: "limit", limitPrice: 999, reduceOnly: true, side: "sell" }),
  ];

  it("reads the live exits off the order book", () => {
    expect(protectionFor("AAPL", orders)).toEqual({ takeProfit: 400, stopLoss: 300 });
  });

  it("ignores entries, other symbols and dead orders", () => {
    expect(protectionFor("NVDA", orders).takeProfit).toBe(999);
    expect(protectionFor("TSLA", orders)).toEqual({ takeProfit: undefined, stopLoss: undefined });
    const cancelled = orders.map((o) => ({ ...o, status: "cancelled" as const }));
    expect(protectionFor("AAPL", cancelled)).toEqual({ takeProfit: undefined, stopLoss: undefined });
  });
});

describe("toCsv", () => {
  it("escapes commas, quotes and newlines", () => {
    const csv = toCsv(["a", "b"], [["x,y", 'he said "hi"'], ["line\nbreak", 3]]);
    expect(csv.split("\n")[0]).toBe("a,b");
    expect(csv).toContain('"x,y"');
    expect(csv).toContain('"he said ""hi"""');
    expect(csv).toContain('"line');
  });
});

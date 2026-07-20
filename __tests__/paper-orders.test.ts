import { describe, expect, it } from "vitest";
import {
  availableFunds,
  validateMove,
  bracketFor,
  fillPriceFor,
  ordersMargin,
  shouldFill,
  sweep,
  tifExpiry,
  validateOrder,
  type Order,
} from "@/lib/paper-orders";

const mk = (p: Partial<Order>): Order => ({
  id: p.id ?? "o1",
  sym: p.sym ?? "AAPL",
  side: p.side ?? "buy",
  type: p.type ?? "limit",
  qty: p.qty ?? 10,
  tif: p.tif ?? "gtc",
  status: p.status ?? "working",
  placedAt: p.placedAt ?? 0,
  ...p,
});

describe("validateOrder", () => {
  it("requires a price for the type that needs one", () => {
    expect(validateOrder({ sym: "A", side: "buy", qty: 1, type: "limit" })).toMatch(/limit/);
    expect(validateOrder({ sym: "A", side: "buy", qty: 1, type: "stop" })).toMatch(/stop/);
    expect(validateOrder({ sym: "A", side: "buy", qty: 1, type: "market" })).toBeNull();
  });

  it("rejects junk quantities", () => {
    expect(validateOrder({ sym: "A", side: "buy", qty: 0, type: "market" })).toMatch(/quantity/);
    expect(validateOrder({ sym: "A", side: "buy", qty: NaN, type: "market" })).toMatch(/quantity/);
    expect(validateOrder({ sym: "A", side: "buy", qty: -1, type: "market" })).toMatch(/quantity/);
  });

  it("rejects a bracket that could never be reached", () => {
    // A buy's take profit BELOW the entry, or stop ABOVE it, is a typo.
    expect(
      validateOrder({ sym: "A", side: "buy", qty: 1, type: "limit", limitPrice: 100, takeProfit: 90 })
    ).toMatch(/take profit must be above/);
    expect(
      validateOrder({ sym: "A", side: "buy", qty: 1, type: "limit", limitPrice: 100, stopLoss: 110 })
    ).toMatch(/stop loss must be below/);
    // and the mirror for a sell
    expect(
      validateOrder({ sym: "A", side: "sell", qty: 1, type: "limit", limitPrice: 100, takeProfit: 110 })
    ).toMatch(/take profit must be below/);
    expect(
      validateOrder({ sym: "A", side: "sell", qty: 1, type: "limit", limitPrice: 100, stopLoss: 90 })
    ).toMatch(/stop loss must be above/);
  });

  it("accepts a correctly-sided bracket", () => {
    expect(
      validateOrder({ sym: "A", side: "buy", qty: 1, type: "limit", limitPrice: 100, takeProfit: 110, stopLoss: 95 })
    ).toBeNull();
  });
});

describe("limit orders fill at your price or better — never worse", () => {
  const buyLimit = mk({ side: "buy", type: "limit", limitPrice: 100 });
  const sellLimit = mk({ side: "sell", type: "limit", limitPrice: 100 });

  it("a buy limit needs the market at or below it", () => {
    expect(shouldFill(buyLimit, 101)).toBe(false); // still too expensive
    expect(shouldFill(buyLimit, 100)).toBe(true);
    expect(shouldFill(buyLimit, 95)).toBe(true);
  });

  it("a sell limit needs the market at or above it", () => {
    expect(shouldFill(sellLimit, 99)).toBe(false);
    expect(shouldFill(sellLimit, 100)).toBe(true);
    expect(shouldFill(sellLimit, 105)).toBe(true);
  });

  it("takes the price improvement when the market is through the limit", () => {
    // A limit is the WORST acceptable price. Buying at 100 when the market is
    // 90 would overcharge the account on every marketable order.
    expect(fillPriceFor(buyLimit, 90)).toBe(90);
    expect(fillPriceFor(sellLimit, 115)).toBe(115);
  });

  it("never fills worse than the limit", () => {
    // At/inside the limit, the limit price is what you get.
    expect(fillPriceFor(buyLimit, 100)).toBe(100);
    expect(fillPriceFor(sellLimit, 100)).toBe(100);
    // A price on the wrong side cannot fill at all, but if asked, clamp.
    expect(fillPriceFor(buyLimit, 120)).toBe(100);
    expect(fillPriceFor(sellLimit, 80)).toBe(100);
  });
});

describe("stop orders trigger through the price and fill at the market", () => {
  const buyStop = mk({ side: "buy", type: "stop", stopPrice: 100 });
  const sellStop = mk({ side: "sell", type: "stop", stopPrice: 100 });

  it("a buy stop sits above the market", () => {
    expect(shouldFill(buyStop, 99)).toBe(false);
    expect(shouldFill(buyStop, 100)).toBe(true);
    expect(shouldFill(buyStop, 105)).toBe(true);
  });

  it("a sell stop sits below the market", () => {
    expect(shouldFill(sellStop, 101)).toBe(false);
    expect(shouldFill(sellStop, 100)).toBe(true);
    expect(shouldFill(sellStop, 95)).toBe(true);
  });

  it("slips: a triggered stop fills at the market, not at its trigger", () => {
    // A gap through the stop must cost the account the gap. Filling at 100
    // would make every stop loss look better than it was.
    expect(fillPriceFor(sellStop, 92)).toBe(92);
    expect(fillPriceFor(buyStop, 108)).toBe(108);
  });
});

describe("sweep", () => {
  it("leaves an unreached order working", () => {
    const r = sweep([mk({ side: "buy", type: "limit", limitPrice: 100 })], "AAPL", 105, 1);
    expect(r.fills).toHaveLength(0);
    expect(r.orders[0].status).toBe("working");
  });

  it("fills when the price arrives, at the better of limit and market", () => {
    const r = sweep([mk({ side: "buy", type: "limit", limitPrice: 100 })], "AAPL", 98, 5);
    expect(r.fills).toHaveLength(1);
    expect(r.orders[0].status).toBe("filled");
    expect(r.orders[0].fillPrice).toBe(98); // price improvement, not the limit
    expect(r.orders[0].filledAt).toBe(5);
  });

  it("fills exactly at the limit when the market touches it", () => {
    const r = sweep([mk({ side: "buy", type: "limit", limitPrice: 100 })], "AAPL", 100, 5);
    expect(r.orders[0].fillPrice).toBe(100);
  });

  it("ignores orders for a different symbol", () => {
    const r = sweep([mk({ sym: "NVDA", side: "buy", type: "limit", limitPrice: 100 })], "AAPL", 50, 1);
    expect(r.fills).toHaveLength(0);
  });

  it("expires an order past its time in force without filling it", () => {
    const o = mk({ side: "buy", type: "limit", limitPrice: 100, expiresAt: 10 });
    const r = sweep([o], "AAPL", 50, 20); // price would fill, but it is dead
    expect(r.fills).toHaveLength(0);
    expect(r.orders[0].status).toBe("expired");
    expect(r.cancelled).toContain("o1");
  });

  it("OCO: the take profit filling cancels the stop loss", () => {
    const tp = mk({ id: "e-tp", side: "sell", type: "limit", limitPrice: 110, parentId: "e", reduceOnly: true });
    const sl = mk({ id: "e-sl", side: "sell", type: "stop", stopPrice: 95, parentId: "e", reduceOnly: true });
    const r = sweep([tp, sl], "AAPL", 112, 9);
    expect(r.fills.map((f) => f.order.id)).toEqual(["e-tp"]);
    expect(r.orders.find((o) => o.id === "e-sl")!.status).toBe("cancelled");
    expect(r.cancelled).toContain("e-sl");
  });

  it("OCO: the stop loss filling cancels the take profit", () => {
    const tp = mk({ id: "e-tp", side: "sell", type: "limit", limitPrice: 110, parentId: "e", reduceOnly: true });
    const sl = mk({ id: "e-sl", side: "sell", type: "stop", stopPrice: 95, parentId: "e", reduceOnly: true });
    const r = sweep([tp, sl], "AAPL", 90, 9);
    expect(r.fills.map((f) => f.order.id)).toEqual(["e-sl"]);
    expect(r.orders.find((o) => o.id === "e-tp")!.status).toBe("cancelled");
  });

  it("does not touch an unrelated bracket's siblings", () => {
    const a = mk({ id: "a-tp", side: "sell", type: "limit", limitPrice: 110, parentId: "a", reduceOnly: true });
    const b = mk({ id: "b-sl", side: "sell", type: "stop", stopPrice: 95, parentId: "b", reduceOnly: true });
    const r = sweep([a, b], "AAPL", 112, 1);
    expect(r.orders.find((o) => o.id === "b-sl")!.status).toBe("working");
  });

  it("never re-fills an already-filled order", () => {
    const filled = mk({ status: "filled", fillPrice: 100 });
    const r = sweep([filled], "AAPL", 50, 1);
    expect(r.fills).toHaveLength(0);
  });
});

describe("bracketFor", () => {
  it("builds exits on the opposite side, reduce-only and GTC", () => {
    const entry = mk({ id: "e", side: "buy", type: "limit", limitPrice: 100, takeProfit: 110, stopLoss: 95, qty: 7 });
    const exits = bracketFor(entry, 100, 1);
    expect(exits).toHaveLength(2);
    for (const e of exits) {
      expect(e.side).toBe("sell");
      expect(e.reduceOnly).toBe(true);
      expect(e.parentId).toBe("e");
      expect(e.qty).toBe(7);
      // An exit that expires would silently unprotect the position.
      expect(e.tif).toBe("gtc");
    }
    expect(exits.find((e) => e.type === "limit")!.limitPrice).toBe(110);
    expect(exits.find((e) => e.type === "stop")!.stopPrice).toBe(95);
  });

  it("builds only what was asked for", () => {
    expect(bracketFor(mk({ id: "e", takeProfit: 110 }), 100, 1)).toHaveLength(1);
    expect(bracketFor(mk({ id: "e" }), 100, 1)).toHaveLength(0);
  });

  it("mirrors for a short entry", () => {
    const entry = mk({ id: "e", side: "sell", type: "limit", limitPrice: 100, takeProfit: 90, stopLoss: 105 });
    const exits = bracketFor(entry, 100, 1);
    expect(exits.every((e) => e.side === "buy")).toBe(true);
  });
});

describe("buying power", () => {
  it("working buy orders reserve their notional", () => {
    const orders = [
      mk({ id: "1", side: "buy", type: "limit", limitPrice: 100, qty: 10 }), // 1000
      mk({ id: "2", side: "buy", type: "stop", stopPrice: 50, qty: 4 }), // 200
    ];
    expect(ordersMargin(orders)).toBe(1200);
    expect(availableFunds(5000, orders)).toBe(3800);
  });

  it("sells and reduce-only exits reserve nothing", () => {
    const orders = [
      mk({ id: "1", side: "sell", type: "limit", limitPrice: 100, qty: 10 }),
      mk({ id: "2", side: "buy", type: "limit", limitPrice: 100, qty: 10, reduceOnly: true }),
    ];
    expect(ordersMargin(orders)).toBe(0);
  });

  it("filled and cancelled orders release their margin", () => {
    const orders = [
      mk({ id: "1", side: "buy", type: "limit", limitPrice: 100, qty: 10, status: "filled" }),
      mk({ id: "2", side: "buy", type: "limit", limitPrice: 100, qty: 10, status: "cancelled" }),
    ];
    expect(ordersMargin(orders)).toBe(0);
    expect(availableFunds(5000, orders)).toBe(5000);
  });
});

describe("time in force", () => {
  it("gtc never expires", () => {
    expect(tifExpiry("gtc", Date.UTC(2026, 0, 1))).toBeUndefined();
  });
  it("day expires later the same day", () => {
    const now = Date.UTC(2026, 0, 1, 10);
    const exp = tifExpiry("day", now)!;
    expect(exp).toBeGreaterThan(now);
    expect(exp - now).toBeLessThan(86_400_000);
  });
  it("week expires in seven days", () => {
    const now = Date.UTC(2026, 0, 1, 10);
    expect(tifExpiry("week", now)! - now).toBe(7 * 86_400_000);
  });
});


describe("validateMove — dragging a protective order", () => {
  // Long position: TP is a sell limit ABOVE the market, SL a sell stop BELOW it.
  const tp = mk({ id: "tp", side: "sell", type: "limit", limitPrice: 120, reduceOnly: true, parentId: "e" });
  const sl = mk({ id: "sl", side: "sell", type: "stop", stopPrice: 80, reduceOnly: true, parentId: "e" });

  it("allows a move that keeps the order away from the market", () => {
    expect(validateMove(tp, 130, 100)).toBeNull(); // TP further up
    expect(validateMove(sl, 70, 100)).toBeNull(); // SL further down
  });

  it("refuses a take profit dragged BELOW the market — it would fill instantly", () => {
    // A sell limit at 90 with the market at 100 is immediately marketable, so
    // the drag would liquidate the position it was protecting.
    expect(validateMove(tp, 90, 100)).toMatch(/fill immediately/);
  });

  it("refuses a stop loss dragged ABOVE the market", () => {
    expect(validateMove(sl, 110, 100)).toMatch(/fill immediately/);
  });

  it("mirrors for a short position's exits", () => {
    const shortTp = mk({ id: "tp", side: "buy", type: "limit", limitPrice: 80, reduceOnly: true });
    const shortSl = mk({ id: "sl", side: "buy", type: "stop", stopPrice: 120, reduceOnly: true });
    expect(validateMove(shortTp, 70, 100)).toBeNull();
    expect(validateMove(shortSl, 130, 100)).toBeNull();
    expect(validateMove(shortTp, 110, 100)).toMatch(/fill immediately/); // buy limit above market
    expect(validateMove(shortSl, 90, 100)).toMatch(/fill immediately/); // buy stop below market
  });

  it("does not restrict a normal entry order — only protective ones", () => {
    const entry = mk({ id: "e", side: "buy", type: "limit", limitPrice: 90 });
    // Dragging an entry limit above the market is a legitimate marketable order.
    expect(validateMove(entry, 110, 100)).toBeNull();
  });

  it("rejects junk prices and dead orders", () => {
    expect(validateMove(tp, 0, 100)).toMatch(/above 0/);
    expect(validateMove(tp, NaN, 100)).toMatch(/above 0/);
    expect(validateMove({ ...tp, status: "filled" }, 130, 100)).toMatch(/no longer working/);
  });

  it("allows any price when there is no mark to judge against", () => {
    expect(validateMove(tp, 90, undefined)).toBeNull();
  });
});

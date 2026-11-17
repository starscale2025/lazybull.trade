import { beforeEach, describe, expect, it } from "vitest";
import { localDay, usePaper, useSafety } from "@/lib/stores";
import { maxAffordableQty, reconcileReduceOnly, type Order } from "@/lib/paper-orders";

// Paper trading on /pro (2026-11-17): what a first-time user does, end to end
// through the one order engine every ticket, panel and voice path shares.

const MKT = 352.78;
const yesterday = () => localDay(Date.now() - 864e5);

function fresh() {
  useSafety.setState({ trainingWheels: true, dailyLossLimit: 500, killSwitchTriggered: false, killReason: undefined, killedOn: undefined });
  usePaper.setState({
    cash: 5_000,
    startingCash: 5_000,
    positions: [],
    shares: {},
    orders: [],
    trades: [],
    balanceLog: [],
    journal: {},
    realizedToday: 0,
    realizedOn: "",
  });
}
const paper = () => usePaper.getState();
const working = (sym = "AAPL") => paper().orders.filter((o) => o.status === "working" && o.sym === sym);

beforeEach(fresh);

describe("orders fill when they should", () => {
  it("a limit the market has already reached fills on submit, at the market", () => {
    const r = paper().submitOrder({ sym: "AAPL", side: "buy", type: "limit", qty: 2, limitPrice: 353, tif: "gtc", marketPrice: MKT });
    expect(r.ok).toBe(true);
    expect(r.order?.status).toBe("filled");
    expect(r.order?.fillPrice).toBe(MKT);
    expect(paper().shares.AAPL.qty).toBe(2);
  });

  it("a limit away from the market rests until the price comes to it, then brings its exits", () => {
    const r = paper().submitOrder({
      sym: "AAPL", side: "buy", type: "limit", qty: 2, limitPrice: 350, takeProfit: 360, stopLoss: 345, tif: "gtc", marketPrice: MKT,
    });
    expect(r.order?.status).toBe("working");
    expect(paper().shares.AAPL).toBeUndefined();
    paper().markPrice("AAPL", 349.5);
    expect(paper().shares.AAPL.qty).toBe(2);
    expect(paper().shares.AAPL.avgPrice).toBe(349.5);
    expect(working().map((o) => [o.type, o.side, o.qty, o.reduceOnly])).toEqual([
      ["limit", "sell", 2, true],
      ["stop", "sell", 2, true],
    ]);
  });

  it("a working order on another symbol fills when that symbol is priced", () => {
    paper().submitOrder({ sym: "NVDA", side: "buy", type: "limit", qty: 1, limitPrice: 150, tif: "gtc", marketPrice: 156.66 });
    expect(working("NVDA")).toHaveLength(1);
    paper().markPrice("NVDA", 149.4);
    expect(paper().shares.NVDA.qty).toBe(1);
    expect(working("NVDA")).toHaveLength(0);
  });

  it("refuses an order the account cannot pay for, and says how much it can", () => {
    const r = paper().submitOrder({ sym: "AAPL", side: "buy", type: "market", qty: 100, tif: "gtc", marketPrice: MKT });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("the most you can buy is 14 AAPL");
  });
});

describe("exits follow the position", () => {
  it("closing a position cancels its take profit and stop loss", () => {
    paper().submitOrder({ sym: "AAPL", side: "buy", type: "market", qty: 2, takeProfit: 360, stopLoss: 345, tif: "gtc", marketPrice: MKT });
    expect(working()).toHaveLength(2);
    paper().submitOrder({ sym: "AAPL", side: "sell", type: "market", qty: 2, tif: "gtc", marketPrice: MKT });
    expect(paper().shares.AAPL).toBeUndefined();
    expect(working()).toHaveLength(0);
    // the price running through the old take profit sells nothing
    paper().markPrice("AAPL", 361);
    expect(paper().shares.AAPL).toBeUndefined();
  });

  it("exits larger than what is left are trimmed to it", () => {
    paper().submitOrder({ sym: "AAPL", side: "buy", type: "market", qty: 5, takeProfit: 360, stopLoss: 345, tif: "gtc", marketPrice: MKT });
    paper().submitOrder({ sym: "AAPL", side: "sell", type: "market", qty: 3, tif: "gtc", marketPrice: MKT });
    expect(working().map((o) => o.qty)).toEqual([2, 2]);
    paper().markPrice("AAPL", 361);
    expect(paper().shares.AAPL).toBeUndefined(); // sold the 2 left, no short
  });

  it("a resting sell that would now open a short is refused while training wheels are on", () => {
    paper().submitOrder({ sym: "AAPL", side: "buy", type: "market", qty: 1, tif: "gtc", marketPrice: MKT });
    paper().submitOrder({ sym: "AAPL", side: "sell", type: "stop", qty: 1, stopPrice: 349, tif: "gtc", marketPrice: MKT });
    paper().submitOrder({ sym: "AAPL", side: "sell", type: "market", qty: 1, tif: "gtc", marketPrice: MKT });
    paper().markPrice("AAPL", 348);
    expect(paper().shares.AAPL).toBeUndefined();
    const stop = paper().orders.find((o) => o.type === "stop")!;
    expect(stop.status).toBe("cancelled");
    expect(stop.note).toMatch(/short/);
  });
});

describe("the daily loss limit is daily", () => {
  it("a new day restarts the tally and re-arms a kill switch from an earlier day", () => {
    usePaper.setState({ realizedToday: -620, realizedOn: yesterday() });
    useSafety.setState({ killSwitchTriggered: true, killReason: "limit", killedOn: yesterday() });
    paper().rollDay();
    expect(paper().realizedToday).toBe(0);
    expect(paper().realizedOn).toBe(localDay());
    expect(useSafety.getState().killSwitchTriggered).toBe(false);
  });

  it("a kill switch hit today stays up today", () => {
    usePaper.setState({ realizedToday: -620, realizedOn: localDay() });
    useSafety.getState().triggerKillSwitch("limit");
    paper().rollDay();
    expect(paper().realizedToday).toBe(-620);
    expect(useSafety.getState().killSwitchTriggered).toBe(true);
  });

  it("a close on a new day counts from zero", () => {
    usePaper.setState({ realizedToday: -400, realizedOn: yesterday() });
    paper().submitOrder({ sym: "AAPL", side: "buy", type: "market", qty: 1, tif: "gtc", marketPrice: 100 });
    paper().submitOrder({ sym: "AAPL", side: "sell", type: "market", qty: 1, tif: "gtc", marketPrice: 90 });
    expect(paper().realizedToday).toBe(-10);
    expect(paper().realizedOn).toBe(localDay());
  });
});

describe("helpers", () => {
  const o = (over: Partial<Order>): Order => ({
    id: "x", sym: "AAPL", side: "sell", type: "limit", qty: 5, limitPrice: 360, tif: "gtc", status: "working", placedAt: 0, reduceOnly: true, ...over,
  });

  it("reconcileReduceOnly cancels exits with nothing to exit and trims oversized ones", () => {
    expect(reconcileReduceOnly([o({})], {})[0].status).toBe("cancelled");
    expect(reconcileReduceOnly([o({})], { AAPL: { qty: 2 } })[0].qty).toBe(2);
    expect(reconcileReduceOnly([o({})], { AAPL: { qty: -2 } })[0].status).toBe("cancelled");
    const untouched = [o({ qty: 1 }), o({ reduceOnly: false })];
    expect(reconcileReduceOnly(untouched, { AAPL: { qty: 3 } })).toBe(untouched);
  });

  it("maxAffordableQty gives whole shares when one fits, else a fraction", () => {
    expect(maxAffordableQty(5_000, MKT)).toBe(14);
    expect(maxAffordableQty(5_000, 64_300)).toBe(0.0777);
    expect(maxAffordableQty(0, MKT)).toBe(0);
  });
});

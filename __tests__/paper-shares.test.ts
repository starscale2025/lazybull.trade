import { describe, expect, it } from "vitest";
import {
  applyFill,
  marketValue,
  unrealizedPnl,
  validateFill,
  type Fill,
  type SharePosition,
} from "@/lib/paper-shares";

const buy = (qty: number, price: number, sym = "AAPL"): Fill => ({ sym, side: "buy", qty, price, ts: 1 });
const sell = (qty: number, price: number, sym = "AAPL"): Fill => ({ sym, side: "sell", qty, price, ts: 1 });

/** Run a sequence of fills from flat, returning the end state. */
function run(fills: Fill[]) {
  let pos: SharePosition | null = null;
  let cash = 0;
  let realized = 0;
  for (const f of fills) {
    const r = applyFill(pos, f);
    pos = r.position;
    cash += r.cashDelta;
    realized += r.realizedDelta;
  }
  return { pos, cash, realized };
}

describe("validateFill", () => {
  it("rejects fills that would poison the account", () => {
    expect(validateFill(buy(0, 100))).toMatch(/quantity/);
    expect(validateFill(buy(-5, 100))).toMatch(/quantity/);
    expect(validateFill(buy(NaN, 100))).toMatch(/quantity/);
    expect(validateFill(buy(10, 0))).toMatch(/price/);
    expect(validateFill(buy(10, NaN))).toMatch(/price/);
    expect(validateFill({ ...buy(10, 100), sym: "" })).toMatch(/symbol/);
  });
  it("accepts a normal fill", () => {
    expect(validateFill(buy(100, 250.5))).toBeNull();
  });
});

describe("opening and adding", () => {
  it("opens a long and debits cash", () => {
    const { pos, cash, realized } = run([buy(100, 250)]);
    expect(pos!.qty).toBe(100);
    expect(pos!.avgPrice).toBe(250);
    expect(cash).toBe(-25_000);
    expect(realized).toBe(0);
  });

  it("weighted-averages the entry when adding, and books NO profit", () => {
    // 100 @ 200 then 100 @ 300 -> 200 @ 250
    const { pos, cash, realized } = run([buy(100, 200), buy(100, 300)]);
    expect(pos!.qty).toBe(200);
    expect(pos!.avgPrice).toBe(250);
    expect(cash).toBe(-50_000);
    // Adding to a winner is not a realization event. Getting this wrong is how
    // an account invents profit it never made.
    expect(realized).toBe(0);
  });

  it("opens a short and credits cash", () => {
    const { pos, cash } = run([sell(50, 400)]);
    expect(pos!.qty).toBe(-50);
    expect(pos!.avgPrice).toBe(400);
    expect(cash).toBe(20_000);
  });

  it("averages a short the same way", () => {
    const { pos } = run([sell(100, 300), sell(100, 500)]);
    expect(pos!.qty).toBe(-200);
    expect(pos!.avgPrice).toBe(400);
  });
});

describe("reducing and closing", () => {
  it("realizes only the closed portion and leaves the average alone", () => {
    // long 100 @ 200, sell 40 @ 250 -> +$2000 realized, 60 still @ 200
    const { pos, realized } = run([buy(100, 200), sell(40, 250)]);
    expect(realized).toBe(2_000);
    expect(pos!.qty).toBe(60);
    expect(pos!.avgPrice).toBe(200); // a reduce must NOT move the average
  });

  it("closes flat and returns a null position", () => {
    const { pos, cash, realized } = run([buy(100, 200), sell(100, 220)]);
    expect(pos).toBeNull();
    expect(realized).toBe(2_000);
    expect(cash).toBe(2_000); // -20,000 then +22,000
  });

  it("books a loss correctly on a long", () => {
    const { realized } = run([buy(100, 200), sell(100, 180)]);
    expect(realized).toBe(-2_000);
  });

  it("books a gain when a SHORT is covered lower", () => {
    // short 100 @ 300, buy back @ 250 -> +$5000
    const { pos, realized } = run([sell(100, 300), buy(100, 250)]);
    expect(pos).toBeNull();
    expect(realized).toBe(5_000);
  });

  it("books a loss when a short is covered higher", () => {
    const { realized } = run([sell(100, 300), buy(100, 340)]);
    expect(realized).toBe(-4_000);
  });
});

describe("crossing through zero", () => {
  it("closes the long, then opens a short at the fill price", () => {
    // long 100 @ 200; sell 150 @ 250.
    // Realize 100 * (250-200) = +5000, and be left SHORT 50 @ 250 — not
    // short 50 still carrying the long's 200 average.
    const { pos, realized } = run([buy(100, 200), sell(150, 250)]);
    expect(realized).toBe(5_000);
    expect(pos!.qty).toBe(-50);
    expect(pos!.avgPrice).toBe(250);
  });

  it("closes the short, then opens a long at the fill price", () => {
    const { pos, realized } = run([sell(80, 400), buy(200, 350)]);
    expect(realized).toBe(80 * (400 - 350));
    expect(pos!.qty).toBe(120);
    expect(pos!.avgPrice).toBe(350);
  });

  it("resets openedAt when it crosses, but not when it merely reduces", () => {
    const opened = applyFill(null, { ...buy(100, 200), ts: 1000 }).position!;
    const reduced = applyFill(opened, { ...sell(40, 210), ts: 2000 }).position!;
    expect(reduced.openedAt).toBe(1000); // same position, still open
    const crossed = applyFill(reduced, { ...sell(200, 210), ts: 3000 }).position!;
    expect(crossed.openedAt).toBe(3000); // a genuinely new position
  });
});

describe("cash conservation", () => {
  it("round-trip cash equals realized P&L", () => {
    // Whatever path it takes, a position that ends flat must leave cash moved
    // by exactly the realized P&L — no cash created or destroyed.
    const paths: Fill[][] = [
      [buy(100, 200), sell(100, 230)],
      [buy(100, 200), sell(40, 250), sell(60, 190)],
      [sell(50, 300), buy(50, 280)],
      [buy(100, 200), sell(150, 250), buy(50, 240)],
      [sell(100, 400), buy(250, 380), sell(150, 390)],
    ];
    for (const p of paths) {
      const { pos, cash, realized } = run(p);
      expect(pos, `path did not end flat: ${JSON.stringify(p)}`).toBeNull();
      expect(cash, `cash != realized for ${JSON.stringify(p)}`).toBeCloseTo(realized, 6);
    }
  });

  it("never produces a non-finite field", () => {
    const { pos, cash, realized } = run([buy(3, 0.01), buy(7, 1e6), sell(9, 12.34)]);
    expect(Number.isFinite(pos!.qty)).toBe(true);
    expect(Number.isFinite(pos!.avgPrice)).toBe(true);
    expect(Number.isFinite(cash)).toBe(true);
    expect(Number.isFinite(realized)).toBe(true);
  });
});

describe("mark to market", () => {
  const long: SharePosition = { sym: "AAPL", qty: 100, avgPrice: 200, realized: 0, openedAt: 0, lastTs: 0 };
  const short: SharePosition = { sym: "AAPL", qty: -100, avgPrice: 200, realized: 0, openedAt: 0, lastTs: 0 };

  it("prices a long the intuitive way", () => {
    expect(unrealizedPnl(long, 250)).toBe(5_000);
    expect(unrealizedPnl(long, 150)).toBe(-5_000);
  });

  it("inverts for a short", () => {
    expect(unrealizedPnl(short, 150)).toBe(5_000);
    expect(unrealizedPnl(short, 250)).toBe(-5_000);
  });

  it("is 0 for no position or a junk mark, never NaN", () => {
    expect(unrealizedPnl(null, 250)).toBe(0);
    expect(unrealizedPnl(undefined, 250)).toBe(0);
    expect(unrealizedPnl(long, NaN)).toBe(0);
    expect(marketValue(null, 100)).toBe(0);
    expect(marketValue(long, NaN)).toBe(0);
  });

  it("market value is signed by direction", () => {
    expect(marketValue(long, 250)).toBe(25_000);
    expect(marketValue(short, 250)).toBe(-25_000);
  });
});

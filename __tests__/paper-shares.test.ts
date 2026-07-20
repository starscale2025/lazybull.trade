import { describe, expect, it } from "vitest";
import {
  applyFill,
  marketValue,
  unrealizedPnl,
  validateFill,
  MAX_QTY,
  QTY_EPS,
  sanitizePosition,
  sanitizeShares,
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

// ─────────────────────────────────────────────────────────────────────────────
// Regressions from the adversarial audit (21 confirmed findings).
// ─────────────────────────────────────────────────────────────────────────────

describe("fractional dust never leaves an un-closeable position", () => {
  it("a fractional round trip ends exactly flat, not at 5.55e-17", () => {
    // buy 0.1 x3 then sell 0.3 — float sum is 0.30000000000000004
    let pos = applyFill(null, buy(0.1, 100)).position;
    pos = applyFill(pos, buy(0.1, 100)).position;
    pos = applyFill(pos, buy(0.1, 100)).position;
    const out = applyFill(pos, sell(0.3, 100));
    expect(out.position, "dust position survived a full close").toBeNull();
  });

  it("closing the reported qty always flattens, across many fractional paths", () => {
    for (let i = 1; i <= 200; i++) {
      const q = i / 7; // non-representable in binary for most i
      let p = applyFill(null, buy(q, 123.45)).position;
      p = applyFill(p, buy(q, 200.1)).position;
      const closed = applyFill(p, sell(Math.abs(p!.qty), 150));
      expect(closed.position, `path i=${i} left dust`).toBeNull();
    }
  });

  it("treats a sub-epsilon stored position as flat rather than a holding", () => {
    expect(sanitizePosition({ sym: "X", qty: 1e-17, avgPrice: 100, realized: 0, openedAt: 0, lastTs: 0 })).toBeNull();
  });
});

describe("corrupt persisted state cannot poison the account", () => {
  it("rejects a position with a missing or non-finite avgPrice", () => {
    // `prev?.avgPrice ?? 0` used to set the basis to $0 and invent the whole
    // notional as realized profit on the next sell.
    expect(sanitizePosition({ sym: "X", qty: 100, realized: 0, openedAt: 0, lastTs: 0 })).toBeNull();
    expect(sanitizePosition({ sym: "X", qty: 100, avgPrice: NaN, realized: 0, openedAt: 0, lastTs: 0 })).toBeNull();
    expect(sanitizePosition({ sym: "X", qty: 100, avgPrice: 0, realized: 0, openedAt: 0, lastTs: 0 })).toBeNull();
    expect(sanitizePosition({ sym: "X", qty: 100, avgPrice: -5, realized: 0, openedAt: 0, lastTs: 0 })).toBeNull();
  });

  it("rejects a non-finite qty that would make realizedToday NaN", () => {
    // A NaN realizedToday silently disables the daily-loss kill switch forever.
    expect(sanitizePosition({ sym: "X", qty: NaN, avgPrice: 100, realized: 0, openedAt: 0, lastTs: 0 })).toBeNull();
    expect(sanitizePosition({ sym: "X", qty: Infinity, avgPrice: 100, realized: 0, openedAt: 0, lastTs: 0 })).toBeNull();
    const bad = { sym: "X", qty: NaN, avgPrice: 100, realized: 0, openedAt: 0, lastTs: 0 } as SharePosition;
    const out = applyFill(bad, sell(10, 200));
    expect(Number.isFinite(out.realizedDelta)).toBe(true);
    expect(Number.isFinite(out.cashDelta)).toBe(true);
  });

  it("sanitizeShares survives null, arrays, strings and key/sym mismatch", () => {
    expect(sanitizeShares(null)).toEqual({});
    expect(sanitizeShares(undefined)).toEqual({});
    expect(sanitizeShares("nope")).toEqual({});
    expect(sanitizeShares([{ sym: "X", qty: 1, avgPrice: 1 }])).toEqual({});
    // a row filed under the wrong key is dropped, not silently mis-attributed
    expect(sanitizeShares({ AAPL: { sym: "NVDA", qty: 1, avgPrice: 1, realized: 0, openedAt: 0, lastTs: 0 } })).toEqual({});
    const good = { AAPL: { sym: "AAPL", qty: 5, avgPrice: 10, realized: 0, openedAt: 0, lastTs: 0 } };
    expect(Object.keys(sanitizeShares(good))).toEqual(["AAPL"]);
  });
});

describe("fill bounds", () => {
  it("refuses a quantity that would drive cash to -Infinity", () => {
    expect(validateFill(buy(1e308, 100))).toMatch(/limit/);
    expect(validateFill(buy(MAX_QTY * 2, 100))).toMatch(/limit/);
    expect(validateFill(buy(MAX_QTY, 100))).toBeNull(); // the bound itself is allowed
  });
  it("refuses an absurd price", () => {
    expect(validateFill(buy(1, 1e308))).toMatch(/limit/);
  });
});

describe("property: invariants hold over random fill sequences", () => {
  it("cash conservation, positive basis, and finiteness across 2000 sequences", () => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let s = 0; s < 2000; s++) {
      let pos: SharePosition | null = null;
      let cash = 0;
      let realized = 0;
      const fractional = s % 2 === 0;
      for (let i = 0; i < 12; i++) {
        const q = fractional ? (rnd() * 10 + 0.01) : Math.max(1, Math.floor(rnd() * 100));
        const price = rnd() * 500 + 0.5;
        const side = rnd() > 0.5 ? "buy" : "sell";
        const f: Fill = { sym: "T", side, qty: q, price, ts: i };
        if (validateFill(f)) continue;
        const r = applyFill(pos, f);
        pos = r.position;
        cash += r.cashDelta;
        realized += r.realizedDelta;
        expect(Number.isFinite(cash), `seq ${s}: cash non-finite`).toBe(true);
        expect(Number.isFinite(realized), `seq ${s}: realized non-finite`).toBe(true);
        if (pos) {
          expect(pos.avgPrice, `seq ${s}: non-positive basis`).toBeGreaterThan(0);
          expect(Math.abs(pos.qty), `seq ${s}: dust kept as a position`).toBeGreaterThanOrEqual(QTY_EPS);
        }
      }
      // Flatten and assert cash moved by exactly the realized total.
      if (pos) {
        const r = applyFill(pos, { sym: "T", side: pos.qty > 0 ? "sell" : "buy", qty: Math.abs(pos.qty), price: 250, ts: 99 });
        expect(r.position, `seq ${s}: could not flatten`).toBeNull();
        cash += r.cashDelta;
        realized += r.realizedDelta;
      }
      expect(cash, `seq ${s}: cash != realized when flat`).toBeCloseTo(realized, 6);
    }
  });
});

describe("closed-trade detection (history records every close, not just winners)", () => {
  // The store records a round-trip when a fill runs OPPOSITE an open position.
  // Gating on realized !== 0 dropped scratch trades from the history entirely.
  const closes = (prevQty: number, side: "buy" | "sell") =>
    Math.sign(side === "buy" ? 1 : -1) !== Math.sign(prevQty);

  it("treats a break-even close as a close", () => {
    const opened = applyFill(null, buy(100, 300)).position!;
    const out = applyFill(opened, sell(100, 300));
    expect(out.position).toBeNull();
    expect(out.realizedDelta).toBe(0); // scratch — but still a completed trade
    expect(closes(opened.qty, "sell")).toBe(true);
  });

  it("does not treat an ADD as a close", () => {
    const opened = applyFill(null, buy(100, 300)).position!;
    expect(closes(opened.qty, "buy")).toBe(false);
    const added = applyFill(opened, buy(50, 320));
    expect(added.realizedDelta).toBe(0);
    expect(added.position!.qty).toBe(150);
  });

  it("counts a partial reduce and a cross as closes", () => {
    const long = applyFill(null, buy(100, 300)).position!;
    expect(closes(long.qty, "sell")).toBe(true);
    const short = applyFill(null, sell(100, 300)).position!;
    expect(closes(short.qty, "buy")).toBe(true);
  });
});

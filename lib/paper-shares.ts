// Average-cost share accounting for the paper account.
//
// Kept as a PURE function, separate from the zustand store, for one reason:
// every money-math bug this codebase has shipped (backtest double-count,
// long-put max profit, Sortino denominator) lived in code that could only be
// exercised through a component. This can be unit-tested directly, and is.
//
// Conventions:
//   qty > 0  long,  qty < 0  short,  qty === 0  flat (position is dropped)
//   cash is debited to buy and credited to sell — no margin, no leverage, no
//   borrow cost. It is a teaching account, not a broker simulator.

export type SharePosition = {
  sym: string;
  qty: number; // signed
  avgPrice: number; // average entry of the currently-open qty
  realized: number; // realized P&L booked on this symbol, all time
  openedAt: number; // when the position last went from flat to non-flat
  lastTs: number; // last fill
};

export type Fill = {
  sym: string;
  side: "buy" | "sell";
  qty: number; // always positive; `side` carries the direction
  price: number;
  ts?: number;
};

export type ApplyResult = {
  position: SharePosition | null; // null when the fill leaves the symbol flat
  cashDelta: number; // negative = cash spent
  realizedDelta: number; // P&L booked by THIS fill
};

/** A fill we refuse to book. Callers surface this rather than silently no-op. */
export function validateFill(f: Fill): string | null {
  if (!f.sym) return "missing symbol";
  if (!Number.isFinite(f.qty) || f.qty <= 0) return "quantity must be a positive number";
  if (!Number.isFinite(f.price) || f.price <= 0) return "price must be a positive number";
  return null;
}

/**
 * Apply one fill to a position using average-cost accounting.
 *
 * Three cases, and the third is the one that is usually got wrong:
 *  1. Opening or adding in the SAME direction — weighted-average the entry.
 *     No P&L is realized; adding to a winner must not book a gain.
 *  2. Reducing — realize P&L on the closed portion only, at the OLD average.
 *     avgPrice does NOT move when you reduce.
 *  3. Crossing through zero (sell 150 when long 100) — realize the full 100,
 *     then open a NEW 50-short at the fill price. Treating this as a simple
 *     reduce would leave a phantom -50 carrying the long's average cost.
 */
export function applyFill(prev: SharePosition | null, f: Fill): ApplyResult {
  const ts = f.ts ?? Date.now();
  const signed = f.side === "buy" ? f.qty : -f.qty;
  // Cash moves opposite the position: buying costs, selling raises.
  const cashDelta = -signed * f.price;

  const prevQty = prev?.qty ?? 0;
  const prevAvg = prev?.avgPrice ?? 0;
  const prevRealized = prev?.realized ?? 0;
  const nextQty = prevQty + signed;

  // ── flat -> open, or adding in the same direction
  if (prevQty === 0 || Math.sign(signed) === Math.sign(prevQty)) {
    const totalCost = Math.abs(prevQty) * prevAvg + Math.abs(signed) * f.price;
    const avgPrice = totalCost / Math.abs(nextQty);
    return {
      position: {
        sym: f.sym,
        qty: nextQty,
        avgPrice,
        realized: prevRealized,
        openedAt: prevQty === 0 ? ts : prev!.openedAt,
        lastTs: ts,
      },
      cashDelta,
      realizedDelta: 0,
    };
  }

  // ── reducing, closing, or crossing through zero
  const closedQty = Math.min(Math.abs(signed), Math.abs(prevQty));
  // Long closed above entry = gain; short closed below entry = gain. The
  // sign of prevQty carries that, so one expression covers both.
  const realizedDelta = closedQty * (f.price - prevAvg) * Math.sign(prevQty);
  const realized = prevRealized + realizedDelta;

  if (nextQty === 0) {
    return { position: null, cashDelta, realizedDelta };
  }

  const crossed = Math.sign(nextQty) !== Math.sign(prevQty);
  return {
    position: {
      sym: f.sym,
      qty: nextQty,
      // Crossing opens a brand-new position at the fill price; a plain reduce
      // leaves the original average untouched.
      avgPrice: crossed ? f.price : prevAvg,
      realized,
      openedAt: crossed ? ts : prev!.openedAt,
      lastTs: ts,
    },
    cashDelta,
    realizedDelta,
  };
}

/** Mark-to-market P&L of an open position at the current price. */
export function unrealizedPnl(pos: SharePosition | null | undefined, mark: number): number {
  if (!pos || !pos.qty || !Number.isFinite(mark)) return 0;
  return (mark - pos.avgPrice) * pos.qty;
}

/** Current notional exposure — what the position is worth right now. */
export function marketValue(pos: SharePosition | null | undefined, mark: number): number {
  if (!pos || !Number.isFinite(mark)) return 0;
  return pos.qty * mark;
}

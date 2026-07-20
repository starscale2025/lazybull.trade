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

/**
 * Quantities below this are float dust, not a position. `nextQty === 0` was an
 * EXACT comparison, so fractional round-trips (buy 0.1 three times, sell 0.3)
 * left residue like 5.55e-17 that rendered as "LONG 0.00" and could never be
 * closed — every close produced a new speck.
 */
export const QTY_EPS = 1e-9;

/**
 * Hard ceiling on a single fill. Unbounded qty (e.g. 1e308) drove cash to
 * -Infinity, which then poisoned every later comparison and silently no-opped
 * subsequent orders while still writing them to the blotter.
 */
export const MAX_QTY = 1e9;
export const MAX_PRICE = 1e9;

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
  if (f.qty > MAX_QTY) return `quantity above the ${MAX_QTY.toExponential(0)} limit`;
  if (f.price > MAX_PRICE) return `price above the ${MAX_PRICE.toExponential(0)} limit`;
  return null;
}

/**
 * Coerce whatever came out of storage into a usable position, or null.
 *
 * Persisted state is attacker-adjacent (any user can edit localStorage) and
 * also just gets stale across schema changes. A missing avgPrice used to fall
 * through `prev?.avgPrice ?? 0`, which silently set the cost basis to $0 and
 * invented the entire notional as realized profit on the next sell. A
 * non-finite qty propagated NaN into realizedToday, permanently disabling the
 * daily-loss kill switch. Neither can be allowed past this boundary.
 */
export function sanitizePosition(raw: unknown): SharePosition | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Partial<SharePosition>;
  const qty = typeof p.qty === "number" && Number.isFinite(p.qty) ? p.qty : null;
  const avgPrice = typeof p.avgPrice === "number" && Number.isFinite(p.avgPrice) ? p.avgPrice : null;
  if (qty === null || avgPrice === null) return null;
  if (Math.abs(qty) < QTY_EPS) return null; // flat, or dust
  if (avgPrice <= 0) return null; // a real holding always has a positive basis
  if (typeof p.sym !== "string" || !p.sym) return null;
  const realized = typeof p.realized === "number" && Number.isFinite(p.realized) ? p.realized : 0;
  const openedAt = typeof p.openedAt === "number" && Number.isFinite(p.openedAt) ? p.openedAt : 0;
  const lastTs = typeof p.lastTs === "number" && Number.isFinite(p.lastTs) ? p.lastTs : openedAt;
  return { sym: p.sym, qty, avgPrice, realized, openedAt, lastTs };
}

/** Sanitize an entire persisted `shares` map; drops anything unusable. */
export function sanitizeShares(raw: unknown): Record<string, SharePosition> {
  const out: Record<string, SharePosition> = {};
  // An array (or null, or a string) here used to hard-crash the page on first
  // render; Object.entries on a non-object throws, and an array produced
  // numeric keys that never matched a symbol lookup.
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const pos = sanitizePosition(value);
    if (pos && pos.sym === key) out[key] = pos;
  }
  return out;
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
export function applyFill(prevRaw: SharePosition | null, f: Fill): ApplyResult {
  // Never trust the incoming position: it may have come straight from storage.
  const prev = sanitizePosition(prevRaw);
  const ts = f.ts ?? Date.now();
  const signed = f.side === "buy" ? f.qty : -f.qty;
  // Cash moves opposite the position: buying costs, selling raises.
  const cashDelta = -signed * f.price;

  const prevQty = prev?.qty ?? 0;
  const prevAvg = prev?.avgPrice ?? 0;
  const prevRealized = prev?.realized ?? 0;
  const nextQty = prevQty + signed;

  // ── flat -> open, or adding in the same direction
  if (Math.abs(prevQty) < QTY_EPS || Math.sign(signed) === Math.sign(prevQty)) {
    const totalCost = Math.abs(prevQty) * prevAvg + Math.abs(signed) * f.price;
    const avgPrice = totalCost / Math.abs(nextQty);
    return {
      position: {
        sym: f.sym,
        qty: nextQty,
        avgPrice,
        realized: prevRealized,
        openedAt: Math.abs(prevQty) < QTY_EPS ? ts : prev!.openedAt,
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

  // Epsilon, not `=== 0`: see QTY_EPS.
  if (Math.abs(nextQty) < QTY_EPS) {
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
  if (!pos || !Number.isFinite(mark)) return 0;
  if (!Number.isFinite(pos.qty) || !Number.isFinite(pos.avgPrice)) return 0;
  if (Math.abs(pos.qty) < QTY_EPS) return 0;
  return (mark - pos.avgPrice) * pos.qty;
}

/** Current notional exposure — what the position is worth right now. */
export function marketValue(pos: SharePosition | null | undefined, mark: number): number {
  if (!pos || !Number.isFinite(mark) || !Number.isFinite(pos.qty)) return 0;
  return pos.qty * mark;
}

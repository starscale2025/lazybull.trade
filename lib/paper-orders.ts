// The order engine: resting orders that fill when price crosses them.
//
// Pure functions over state, no React and no storage, so the fill rules can be
// unit-tested directly. This is the part that makes it paper TRADING rather
// than a button that mutates a balance: a limit order sits working until the
// market reaches it, a stop triggers on the way through, and a bracket's two
// children cancel each other.

export type OrderType = "market" | "limit" | "stop";
export type OrderSide = "buy" | "sell";
/** Day = until session end, GTC = until cancelled. Week matches TradingView's default. */
export type TimeInForce = "day" | "week" | "gtc";
export type OrderStatus = "working" | "filled" | "cancelled" | "rejected" | "expired";

export type Order = {
  id: string;
  sym: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  /** Required for limit. The price at or better than which it may fill. */
  limitPrice?: number;
  /** Required for stop. Crossing this arms a market fill. */
  stopPrice?: number;
  /** Bracket children, created on fill. Prices, not ticks. */
  takeProfit?: number;
  stopLoss?: number;
  tif: TimeInForce;
  status: OrderStatus;
  placedAt: number;
  expiresAt?: number;
  filledAt?: number;
  fillPrice?: number;
  /** Set on bracket children so they can only ever close, never open. */
  reduceOnly?: boolean;
  /** The entry order this exit belongs to; used for OCO. */
  parentId?: string;
  /** Why it was rejected or cancelled, for the order history. */
  note?: string;
};

export type Fill = { sym: string; side: OrderSide; qty: number; price: number; ts: number };

const DAY_MS = 86_400_000;

export function tifExpiry(tif: TimeInForce, now: number): number | undefined {
  if (tif === "gtc") return undefined;
  // Day orders die at the next midnight; week orders after seven days. Neither
  // is exchange-accurate — this is a teaching account with no session calendar —
  // so the UI must not imply a real session close.
  if (tif === "day") {
    const d = new Date(now);
    d.setHours(23, 59, 59, 999);
    return d.getTime();
  }
  return now + 7 * DAY_MS;
}

/** Validate an order before it can rest. Returns a reason, or null if fine. */
export function validateOrder(o: Partial<Order>): string | null {
  if (!o.sym) return "missing symbol";
  if (o.side !== "buy" && o.side !== "sell") return "side must be buy or sell";
  if (!Number.isFinite(o.qty) || (o.qty as number) <= 0) return "quantity must be above 0";
  if (o.type === "limit" && (!Number.isFinite(o.limitPrice) || (o.limitPrice as number) <= 0)) {
    return "limit orders need a price above 0";
  }
  if (o.type === "stop" && (!Number.isFinite(o.stopPrice) || (o.stopPrice as number) <= 0)) {
    return "stop orders need a trigger price above 0";
  }
  if (o.takeProfit != null && (!Number.isFinite(o.takeProfit) || o.takeProfit <= 0)) {
    return "take profit must be a price above 0";
  }
  if (o.stopLoss != null && (!Number.isFinite(o.stopLoss) || o.stopLoss <= 0)) {
    return "stop loss must be a price above 0";
  }
  // A bracket on the wrong side of the entry can never be reached, so it is
  // almost certainly a typo rather than an intention.
  const ref = o.type === "limit" ? o.limitPrice : o.type === "stop" ? o.stopPrice : undefined;
  if (ref != null && o.side === "buy") {
    if (o.takeProfit != null && o.takeProfit <= ref) return "take profit must be above the entry for a buy";
    if (o.stopLoss != null && o.stopLoss >= ref) return "stop loss must be below the entry for a buy";
  }
  if (ref != null && o.side === "sell") {
    if (o.takeProfit != null && o.takeProfit >= ref) return "take profit must be below the entry for a sell";
    if (o.stopLoss != null && o.stopLoss <= ref) return "stop loss must be above the entry for a sell";
  }
  return null;
}

/**
 * Would this order fill at the given price?
 *
 * Limit: fills at your price OR BETTER — a buy limit needs the market at or
 * below it, a sell limit at or above.
 * Stop: triggers when the market trades THROUGH it in the direction of the
 * stop — a buy stop above the market, a sell stop below.
 */
export function shouldFill(o: Order, price: number): boolean {
  if (o.status !== "working" || !Number.isFinite(price)) return false;
  if (o.type === "market") return true;
  if (o.type === "limit") {
    return o.side === "buy" ? price <= (o.limitPrice as number) : price >= (o.limitPrice as number);
  }
  return o.side === "buy" ? price >= (o.stopPrice as number) : price <= (o.stopPrice as number);
}

/**
 * The price a filling order actually gets.
 *
 * A limit price is the WORST price you will accept, not a fixed one. If the
 * market is already through it — a buy limit at 100 with the market at 90 —
 * you get 90. Returning the limit price there would overcharge the account on
 * every marketable order and quietly understate every entry.
 *
 * A stop becomes a market order once triggered, so it fills at the market. That
 * is how a stop slips past its trigger on a gap, and modelling it any other way
 * would flatter every stop loss.
 */
export function fillPriceFor(o: Order, marketPrice: number): number {
  if (o.type !== "limit") return marketPrice;
  const limit = o.limitPrice as number;
  if (!Number.isFinite(marketPrice)) return limit;
  return o.side === "buy" ? Math.min(limit, marketPrice) : Math.max(limit, marketPrice);
}

export type SweepResult = {
  orders: Order[];
  fills: { order: Order; price: number }[];
  /** Ids cancelled by OCO or expiry, for the history. */
  cancelled: string[];
};

/**
 * Advance the book against a price for one symbol.
 *
 * Order matters: expire first, then fill, then apply OCO. Doing OCO before the
 * fill would cancel the sibling of an order that had not filled yet.
 */
export function sweep(orders: Order[], sym: string, price: number, now: number): SweepResult {
  const out: Order[] = [];
  const fills: SweepResult["fills"] = [];
  const cancelled: string[] = [];

  for (const o of orders) {
    if (o.status !== "working") {
      out.push(o);
      continue;
    }
    if (o.expiresAt != null && now >= o.expiresAt) {
      out.push({ ...o, status: "expired", note: `${o.tif} order expired` });
      cancelled.push(o.id);
      continue;
    }
    if (o.sym !== sym || !shouldFill(o, price)) {
      out.push(o);
      continue;
    }
    const fp = fillPriceFor(o, price);
    const filled: Order = { ...o, status: "filled", filledAt: now, fillPrice: fp };
    out.push(filled);
    fills.push({ order: filled, price: fp });
  }

  // OCO: when one leg of a bracket fills, its sibling is done.
  for (const f of fills) {
    if (!f.order.parentId) continue;
    for (let i = 0; i < out.length; i++) {
      const sib = out[i];
      if (sib.id !== f.order.id && sib.parentId === f.order.parentId && sib.status === "working") {
        out[i] = { ...sib, status: "cancelled", note: "OCO — the other exit filled" };
        cancelled.push(sib.id);
      }
    }
  }

  return { orders: out, fills, cancelled };
}

/** Build the resting exit orders for a filled entry. */
export function bracketFor(entry: Order, entryPrice: number, now: number): Order[] {
  const exits: Order[] = [];
  const exitSide: OrderSide = entry.side === "buy" ? "sell" : "buy";
  const base = {
    sym: entry.sym,
    side: exitSide,
    qty: entry.qty,
    tif: "gtc" as TimeInForce, // an exit that expires would silently unprotect the position
    status: "working" as OrderStatus,
    placedAt: now,
    reduceOnly: true,
    parentId: entry.id,
  };
  if (entry.takeProfit != null) {
    exits.push({ ...base, id: `${entry.id}-tp`, type: "limit", limitPrice: entry.takeProfit });
  }
  if (entry.stopLoss != null) {
    exits.push({ ...base, id: `${entry.id}-sl`, type: "stop", stopPrice: entry.stopLoss });
  }
  void entryPrice; // brackets are absolute prices; kept for a future ticks mode
  return exits;
}

/**
 * Margin held by working orders — TradingView's "Orders margin".
 *
 * Only BUY orders reserve funds; a reduce-only exit does not, because it
 * releases exposure rather than adding it. At 1:1 leverage the reservation is
 * simply the notional.
 */
export function ordersMargin(orders: Order[]): number {
  return orders.reduce((acc, o) => {
    if (o.status !== "working" || o.reduceOnly || o.side !== "buy") return acc;
    const px = o.type === "limit" ? o.limitPrice : o.stopPrice;
    return acc + (Number.isFinite(px) ? (px as number) * o.qty : 0);
  }, 0);
}

/**
 * Can this working order be moved to `price` without filling on the next tick?
 *
 * Dragging a stop loss above a long's market price turns it into an immediate
 * market sell; dragging a take profit below it does the same. Neither is what
 * the drag intended, so the caller refuses rather than silently liquidating the
 * position the handle was protecting. Returns a reason, or null if the move is
 * safe.
 */
export function validateMove(o: Order, price: number, marketPrice?: number): string | null {
  if (!Number.isFinite(price) || price <= 0) return "price must be above 0";
  if (o.status !== "working") return "order is no longer working";
  if (!Number.isFinite(marketPrice)) return null; // no mark to judge against
  const mkt = marketPrice as number;
  // shouldFill answers exactly the question "would this fill right now?".
  const moved = { ...o, [o.type === "limit" ? "limitPrice" : "stopPrice"]: price } as Order;
  if (o.reduceOnly && shouldFill(moved, mkt)) {
    return o.type === "limit"
      ? "take profit would fill immediately — move it further from the market"
      : "stop loss would fill immediately — move it further from the market";
  }
  return null;
}

/** Cash actually free to commit: balance minus what working orders reserve. */
export function availableFunds(cash: number, orders: Order[]): number {
  return cash - ordersMargin(orders);
}

// Account metrics for the paper-trading panel.
//
// Pure and separately tested, because these six numbers are the ones a user
// reads to decide whether they can afford the next trade — and they have to
// agree with each other. The identities below are the contract:
//
//   equity          = balance + unrealised
//   accountMargin   = notional of OPEN positions (1:1 leverage)
//   availableFunds  = equity − accountMargin − ordersMargin
//   marginBuffer    = availableFunds / equity
//
// Leverage is fixed at 1:1 rather than mimicking a broker's margin-rate table.
// A teaching account that quietly granted leverage would understate what a
// position actually costs, which is exactly the lesson it exists to teach.

import type { SharePosition } from "./paper-shares";
import { ordersMargin as calcOrdersMargin, type Order } from "./paper-orders";

export type AccountMetrics = {
  /** Cash. What TradingView calls "Account balance". */
  balance: number;
  /** Balance plus open-position P&L. */
  equity: number;
  /** Booked P&L for the session. */
  realizedPnl: number;
  /** Mark-to-market P&L of everything still open. */
  unrealizedPnl: number;
  /** Capital tied up by open positions. */
  accountMargin: number;
  /** Capital reserved by working orders that have not filled. */
  ordersMargin: number;
  /** Equity minus everything committed. */
  availableFunds: number;
  /** availableFunds / equity, 0..1. The headroom before a margin problem. */
  marginBuffer: number;
  /** Positions with no live mark, so the caller can disclose it. */
  unmarkedCount: number;
};

export function accountMetrics(args: {
  cash: number;
  realizedToday: number;
  shares: Record<string, SharePosition>;
  orders: Order[];
  /** Live price per symbol. A symbol absent here is carried at cost. */
  marks: Record<string, number>;
}): AccountMetrics {
  const { cash, realizedToday, shares, orders, marks } = args;

  let unrealizedPnl = 0;
  let accountMargin = 0;
  let unmarkedCount = 0;

  for (const pos of Object.values(shares)) {
    if (!pos || !Number.isFinite(pos.qty) || !Number.isFinite(pos.avgPrice)) continue;
    const mark = marks[pos.sym];
    const hasMark = Number.isFinite(mark) && mark > 0;
    if (!hasMark) unmarkedCount++;
    const px = hasMark ? mark : pos.avgPrice;
    // A short's margin is its notional too — the exposure is symmetric even
    // though the cash moved the other way when it opened.
    accountMargin += Math.abs(pos.qty) * px;
    if (hasMark) unrealizedPnl += (mark - pos.avgPrice) * pos.qty;
  }

  const balance = Number.isFinite(cash) ? cash : 0;
  const equity = balance + unrealizedPnl;
  const ordersMargin = calcOrdersMargin(orders);
  const availableFunds = equity - accountMargin - ordersMargin;
  // Guard the divide: a wiped-out account should read 0% headroom, not NaN.
  const marginBuffer = equity > 0 ? Math.max(0, Math.min(1, availableFunds / equity)) : 0;

  return {
    balance,
    equity,
    realizedPnl: Number.isFinite(realizedToday) ? realizedToday : 0,
    unrealizedPnl,
    accountMargin,
    ordersMargin,
    availableFunds,
    marginBuffer,
    unmarkedCount,
  };
}

/**
 * The take-profit and stop-loss currently protecting a symbol, read off the
 * working reduce-only orders rather than stored on the position — the orders
 * ARE the protection, so duplicating them onto the position would let the two
 * drift apart.
 */
export function protectionFor(sym: string, orders: Order[]): { takeProfit?: number; stopLoss?: number } {
  const live = orders.filter((o) => o.status === "working" && o.sym === sym && o.reduceOnly);
  return {
    takeProfit: live.find((o) => o.type === "limit")?.limitPrice,
    stopLoss: live.find((o) => o.type === "stop")?.stopPrice,
  };
}

/** Rows -> CSV, for the panel's export button. Quotes anything risky. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
}

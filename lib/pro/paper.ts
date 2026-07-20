"use client";

// The single place a /pro paper order is booked.
//
// There were three copies of this logic (TradeDrawer, useVoiceAgent,
// useFreeVoiceAgent), each writing the `lb-pro-orders` blotter directly and
// none of them touching the paper account — so /pro orders had no position, no
// cash impact and no P&L, and the daily-loss kill switch could not see them.
// Everything now funnels through here: validate, book to the shared account,
// then append to the blotter.

import { usePaper, useSafety } from "@/lib/stores";
import { QTY_EPS, type Fill } from "@/lib/paper-shares";

export const ORDERS_KEY = "lb-pro-orders";
/** Blotter rows are display history; the account is the source of truth. */
export const ORDERS_CHANGED = "lb-orders-changed";
const MAX_BLOTTER = 30;

export type PlacedOrder = {
  id: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  price: number;
  sym: string;
  ts: number;
};

export type PlaceInput = {
  sym: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  qty: number;
  /** Limit price, or the mark to fill at for a market order. */
  price: number;
};

export type PlaceResult =
  | { ok: true; order: PlacedOrder; /** false when the order-history write failed */ blotterWritten: boolean }
  | { ok: false; error: string };

export function readBlotter(): PlacedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    return Array.isArray(raw) ? (raw as PlacedOrder[]) : [];
  } catch {
    return [];
  }
}

/**
 * Book a paper order against the shared account.
 *
 * Fills at `price` immediately — including limit orders. This is a teaching
 * account with no matching engine, so a "limit" is really just a
 * choose-your-own-fill-price. Callers should not imply resting orders in the UI.
 */
export function placePaperOrder(input: PlaceInput): PlaceResult {
  // ── safety gates live HERE, in the one funnel every caller shares.
  //
  // They were previously enforced per-caller, so OrderTicket and QuickBet
  // checked the kill switch while TradeDrawer and both voice agents did not —
  // three of five paths could open new risk during a breach. A guard that only
  // some callers remember to apply is not a guard.
  const safety = useSafety.getState();
  const current = usePaper.getState().shares[input.sym]?.qty ?? 0;
  const signed = input.side === "buy" ? input.qty : -input.qty;
  const next = current + signed;
  // Reducing exposure is always allowed — including while halted. Blocking a
  // close during a kill switch would trap the user in the position that armed it.
  const reducing = Math.abs(next) < Math.abs(current);

  if (safety.killSwitchTriggered && !reducing) {
    return { ok: false, error: "kill switch is on — only closing orders are allowed" };
  }
  // Training wheels promise "defined-risk only" (see RiskWizard). A short stock
  // position has unbounded loss, so holding one contradicts the promise the
  // user accepted. Closing a long is still fine; opening/holding a short is not.
  if (safety.trainingWheels && next < -QTY_EPS) {
    return {
      ok: false,
      error: "training wheels: short selling has unlimited risk — turn them off in Safety to allow it",
    };
  }

  const fill: Fill = {
    sym: input.sym,
    side: input.side,
    qty: input.qty,
    price: input.price,
    ts: Date.now(),
  };

  // The account validates and is the thing that can refuse.
  const res = usePaper.getState().fillShares(fill);
  if (!res.ok) return { ok: false, error: res.error ?? "order rejected" };

  const order: PlacedOrder = {
    id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    side: input.side,
    type: input.type,
    qty: input.qty,
    price: input.price,
    sym: input.sym,
    ts: fill.ts!,
  };

  // Re-read before writing: the voice agent may have appended since whatever
  // called us last rendered, and clobbering the key with a stale list loses
  // somebody else's order.
  //
  // If storage is failing (quota, private mode) the ACCOUNT fill above has
  // already happened, so the blotter would silently fall behind the positions.
  // Surface it: the trade is real, the receipt is not.
  let blotterWritten = true;
  try {
    const next = [order, ...readBlotter()].slice(0, MAX_BLOTTER);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(next));
  } catch {
    blotterWritten = false;
  }
  // Fire regardless so live panels re-read the account even when the write failed.
  try {
    window.dispatchEvent(new CustomEvent(ORDERS_CHANGED));
  } catch {
    /* non-browser context */
  }

  return { ok: true, order, blotterWritten };
}

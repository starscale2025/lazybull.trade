"use client";

// The single place a /pro paper order is booked.
//
// There were three copies of this logic (the old trade drawer, useVoiceAgent,
// useFreeVoiceAgent), each writing the `lb-pro-orders` blotter directly and
// none of them touching the paper account — so /pro orders had no position, no
// cash impact and no P&L, and the daily-loss kill switch could not see them.
// Everything now funnels through here: validate, book to the shared account,
// then append to the blotter.

import { usePaper } from "@/lib/stores";

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
  // Thin wrapper over the order engine so every path — the on-chart ticket, the
  // position ✕, the panel close and both voice agents — books through ONE
  // entry point and lands in the order history. This used to be a parallel
  // instant-fill path, which is why "limit" orders filled at the market and why
  // ticket fills never appeared in Orders.
  const engine = usePaper.getState().submitOrder({
    sym: input.sym,
    side: input.side,
    type: "market",
    qty: input.qty,
    tif: "gtc",
    marketPrice: input.price,
  });
  if (!engine.ok) return { ok: false, error: engine.error ?? "order rejected" };

  const order: PlacedOrder = {
    id: engine.order!.id,
    side: input.side,
    type: input.type,
    qty: input.qty,
    price: engine.order!.fillPrice ?? input.price,
    sym: input.sym,
    ts: engine.order!.filledAt ?? Date.now(),
  };
  let blotterWritten = true;
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...readBlotter()].slice(0, MAX_BLOTTER)));
  } catch {
    blotterWritten = false;
  }
  try {
    window.dispatchEvent(new CustomEvent(ORDERS_CHANGED));
  } catch {
    /* non-browser context */
  }
  return { ok: true, order, blotterWritten };
}

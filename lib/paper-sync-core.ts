// Pure logic for the paper-account sync — everything here is decision-making
// with no I/O, so the reconcile rules that guard a user's account history are
// unit-tested instead of only exercised by two browsers racing each other.
//
// The sync model is snapshot replication with optimistic concurrency: the
// client is the engine and the source of truth while it runs; the server holds
// the latest sanitized snapshot per user at a monotonically increasing `rev`.

import { sanitizeShares } from "./paper-shares";
import type { usePaper } from "./stores";

type PaperState = ReturnType<typeof usePaper.getState>;

/** The exact field set that replicates — mirrors what zustand persists. */
export type PaperSnapshot = {
  cash: number;
  startingCash: number;
  realizedToday: number;
  positions: PaperState["positions"];
  shares: PaperState["shares"];
  orders: PaperState["orders"];
  trades: PaperState["trades"];
  balanceLog: PaperState["balanceLog"];
  journal: PaperState["journal"];
};

export function pickSnapshot(s: PaperState): PaperSnapshot {
  return {
    cash: s.cash,
    startingCash: s.startingCash,
    realizedToday: s.realizedToday,
    positions: s.positions,
    shares: s.shares,
    orders: s.orders,
    trades: s.trades,
    balanceLog: s.balanceLog,
    journal: s.journal,
  };
}

/** Coerce an untrusted snapshot (server or wire) into something safe to put
    in the store. Same spirit as the store's own hydration merge(): numbers
    finite-or-default, arrays are arrays, shares re-sanitized. */
export function sanitizeSnapshot(raw: unknown, fallbackCapital = 100_000): PaperSnapshot {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const startingCash = num(o.startingCash, fallbackCapital);
  return {
    cash: num(o.cash, startingCash),
    startingCash,
    realizedToday: num(o.realizedToday, 0),
    positions: arr(o.positions),
    shares: sanitizeShares(o.shares),
    orders: arr(o.orders),
    trades: arr(o.trades),
    balanceLog: arr(o.balanceLog),
    journal:
      o.journal && typeof o.journal === "object" && !Array.isArray(o.journal)
        ? (o.journal as PaperSnapshot["journal"])
        : {},
  } as PaperSnapshot;
}

/** A factory-default account has nothing worth overwriting a server copy for. */
export function isFactoryDefault(s: PaperSnapshot): boolean {
  return (
    s.trades.length === 0 &&
    s.balanceLog.length === 0 &&
    s.orders.length === 0 &&
    s.positions.length === 0 &&
    Object.keys(s.shares).length === 0 &&
    s.cash === s.startingCash
  );
}

/** Newest thing that happened locally — the fork tiebreaker. */
export function latestActivity(s: PaperSnapshot): number {
  let t = 0;
  for (const b of s.balanceLog) t = Math.max(t, b?.ts ?? 0);
  for (const tr of s.trades) t = Math.max(t, tr?.closedAt ?? 0);
  for (const o of s.orders) t = Math.max(t, o?.placedAt ?? 0);
  return t;
}

export type InitialDecision =
  | { kind: "none" } // both sides empty — nothing to move
  | { kind: "push" } // local is the truth → upload
  | { kind: "adopt" } // server is the truth → download
  | { kind: "fork" }; // both changed since the last sync → tiebreak

/** First reconcile after sign-in. `lastSyncedRev` is what THIS device last
    pushed/adopted (0 = never synced here). */
export function decideInitial(args: {
  serverRev: number;
  serverHasState: boolean;
  localDefault: boolean;
  lastSyncedRev: number;
}): InitialDecision {
  const { serverRev, serverHasState, localDefault, lastSyncedRev } = args;
  if (!serverHasState || serverRev === 0) return localDefault ? { kind: "none" } : { kind: "push" };
  if (localDefault) return { kind: "adopt" };
  // Server moved past what this device last saw → someone else wrote. If we
  // are exactly at the server's rev, history is linear and local continues it.
  return serverRev === lastSyncedRev ? { kind: "push" } : { kind: "fork" };
}

/** Fork tiebreak: whichever side traded more recently keeps the account. Ties
    go to the server — adopting is the non-destructive direction (the local
    copy triggered a push conflict and is still on this device's disk). */
export function resolveFork(serverUpdatedAtMs: number, localLatestMs: number): "adopt" | "push" {
  return serverUpdatedAtMs >= localLatestMs ? "adopt" : "push";
}

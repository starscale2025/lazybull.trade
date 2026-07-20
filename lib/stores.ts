"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChainCell, Leg } from "./pricing";
import { applyFill, sanitizeShares, validateFill, type Fill, type SharePosition } from "./paper-shares";
import {
  availableFunds as calcAvailable,
  bracketFor,
  sweep,
  tifExpiry,
  validateOrder,
  type Order as WorkingOrder,
} from "./paper-orders";

// ─────────────── strategy store ───────────────
type StrategyState = {
  selected: string[]; // composite keys: `${expiry}|${strike}|${type}`
  legs: Leg[];
  toggle: (cell: ChainCell, side?: "long" | "short") => void;
  flipSide: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
};

const cellKey = (c: ChainCell) => `${c.expiry}|${c.strike}|${c.type}`;
const legId = (c: ChainCell) => cellKey(c);

export const useStrategy = create<StrategyState>()((set) => ({
  selected: [],
  legs: [],
  toggle: (cell, side = "long") =>
    set((s) => {
      const id = legId(cell);
      const existing = s.legs.find((l) => l.id === id);
      if (existing) {
        return {
          selected: s.selected.filter((k) => k !== id),
          legs: s.legs.filter((l) => l.id !== id),
        };
      }
      const newLeg: Leg = {
        id,
        type: cell.type,
        side,
        strike: cell.strike,
        qty: 1,
        premium: cell.mid,
      };
      return {
        selected: [...s.selected, id],
        legs: [...s.legs, newLeg],
      };
    }),
  flipSide: (id) =>
    set((s) => ({
      legs: s.legs.map((l) => (l.id === id ? { ...l, side: l.side === "long" ? "short" : "long" } : l)),
    })),
  setQty: (id, qty) =>
    set((s) => ({ legs: s.legs.map((l) => (l.id === id ? { ...l, qty: Math.max(1, qty) } : l)) })),
  clear: () => set({ selected: [], legs: [] }),
}));

// ─────────────── paper trading store ───────────────

/**
 * Read the freshest persisted account straight from storage.
 *
 * zustand `persist` hydrates ONCE at page load and then writes the whole store
 * on every set(), with no re-read and no `storage` subscription. With two tabs
 * open that made the account last-writer-wins at WHOLE-ACCOUNT granularity:
 * tab B's fill stamped over tab A's, silently erasing entire positions and
 * their cash impact (measured: a 100-share NVDA buy and its $20,281 debit
 * vanished, while both fills still sat in the blotter).
 *
 * Re-reading immediately before a mutation narrows the race from "the whole
 * account" to "two fills in the same millisecond", which is the difference
 * between losing a position and losing nothing in practice. Returns null when
 * storage is unavailable or unusable, in which case callers keep in-memory state.
 */
function readPersistedAccount(): Pick<PaperState, "cash" | "startingCash" | "realizedToday" | "shares" | "positions" | "trades" | "orders"> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("lb-paper");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const st = parsed?.state;
    if (!st || typeof st !== "object") return null;
    const num = (v: unknown, fb: number) => (typeof v === "number" && Number.isFinite(v) ? v : fb);
    return {
      cash: num(st.cash, 100_000),
      startingCash: num(st.startingCash, 100_000),
      realizedToday: num(st.realizedToday, 0),
      positions: Array.isArray(st.positions) ? st.positions : [],
      trades: Array.isArray(st.trades) ? st.trades : [],
      orders: Array.isArray(st.orders) ? st.orders : [],
      shares: sanitizeShares(st.shares),
    };
  } catch {
    return null;
  }
}

export type Position = {
  id: string;
  underlying: string;
  legs: Leg[];
  strategy: string;
  openedAt: number;
  openSpot: number;
  cost: number; // net debit (+) / credit (-) at open
  status: "open" | "closed";
  pnl: number; // realized when closed
};

/** One completed round-trip, for the portfolio history and the equity curve. */
export type ClosedTrade = {
  id: string;
  sym: string;
  side: "long" | "short"; // the direction of the position that was CLOSED
  qty: number; // how much was closed by this fill
  entry: number; // average entry of the closed portion
  exit: number; // fill price
  pnl: number; // realized on this close
  openedAt: number;
  closedAt: number;
};

type PaperState = {
  cash: number;
  startingCash: number;
  positions: Position[];
  /**
   * Realized round-trips, newest first. The blotter (`lb-pro-orders`) records
   * every FILL; this records every CLOSE with its P&L, which is what a
   * portfolio history and an equity curve actually need. Capped so a long
   * session cannot grow localStorage without bound.
   */
  trades: ClosedTrade[];
  /**
   * Share positions from /pro, keyed by symbol. They live in the SAME store as
   * the option `positions` above so both books draw on one cash balance and one
   * realized-P&L figure — /pro used to keep an unaccounted order log in its own
   * localStorage key, outside the account and outside the kill switch.
   *
   * Separate field rather than a row in `positions` because a share holding is
   * genuinely a different shape (signed qty + average price, no legs); flattening
   * it into `legs` would have meant storing a lie.
   */
  shares: Record<string, SharePosition>;
  /** The order book: working, filled, cancelled and expired orders. */
  orders: WorkingOrder[];
  realizedToday: number;
  open: (p: Omit<Position, "id" | "openedAt" | "status" | "pnl">) => Position;
  close: (id: string, exitPnl: number) => void;
  closeAll: (reason: string) => void;
  /** Book a share fill. Returns an error string instead of throwing. */
  fillShares: (f: Fill) => { ok: boolean; error?: string; realized?: number };
  /** Submit an order. Market fills now; limit/stop rest until price reaches them. */
  submitOrder: (
    o: Omit<WorkingOrder, "id" | "status" | "placedAt"> & { marketPrice?: number }
  ) => { ok: boolean; error?: string; order?: WorkingOrder };
  cancelOrder: (id: string) => void;
  /** Advance the book against a live price. Called from the chart's quote poll. */
  markPrice: (sym: string, price: number) => void;
  /** Set the paper account's starting capital and reset everything to it. */
  setStartingCash: (n: number) => void;
  reset: () => void;
};

const MAX_TRADES = 200;
const DEFAULT_CAPITAL = 100_000;

export const usePaper = create<PaperState>()(
  persist(
    (set, get) => ({
      cash: DEFAULT_CAPITAL,
      startingCash: DEFAULT_CAPITAL,
      positions: [],
      shares: {},
      orders: [],
      trades: [],
      realizedToday: 0,
      open: (p) => {
        const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const pos: Position = { ...p, id, openedAt: Date.now(), status: "open", pnl: 0 };
        set((s) => ({ cash: s.cash - p.cost, positions: [pos, ...s.positions] }));
        return pos;
      },
      close: (id, exitPnl) =>
        set((s) => ({
          cash: s.cash + exitPnl,
          realizedToday: s.realizedToday + exitPnl,
          positions: s.positions.map((p) => (p.id === id ? { ...p, status: "closed", pnl: exitPnl } : p)),
        })),
      closeAll: () =>
        set((s) => {
          let cash = s.cash;
          const positions = s.positions.map((p) => {
            if (p.status === "open") {
              cash += 0; // mark-to-zero, demo
              return { ...p, status: "closed" as const, pnl: 0 };
            }
            return p;
          });
          // The kill-switch overlay states that ALL positions have been closed.
          // This used to ignore `shares` entirely, so every stock position from
          // /pro and the bet slip stayed open behind a screen claiming they were
          // flat. Return the cost basis to cash and drop them, matching the
          // mark-to-zero convention the option legs already use.
          let realized = s.realizedToday;
          for (const pos of Object.values(s.shares)) {
            cash += pos.qty * pos.avgPrice; // unwind at cost — no P&L invented
            realized += 0;
          }
          // Working orders must die with the positions — leaving a resting buy
          // alive after a kill switch would re-open risk on the next tick.
          const orders = s.orders.map((o) =>
            o.status === "working" ? { ...o, status: "cancelled" as const, note: "kill switch" } : o
          );
          return { positions, cash, shares: {}, orders, realizedToday: realized };
        }),
      fillShares: (f) => {
        const invalid = validateFill(f);
        if (invalid) return { ok: false, error: invalid };
        // Apply against the freshest account another tab may have written, not
        // against this tab's page-load snapshot.
        const fresh = readPersistedAccount();
        const s = fresh ? { ...get(), ...fresh } : get();
        const before = s.shares[f.sym] ?? null;
        const { position, cashDelta, realizedDelta } = applyFill(before, f);
        const shares = { ...s.shares };
        if (position) shares[f.sym] = position;
        else delete shares[f.sym]; // flat positions are dropped, not kept at qty 0

        // Record a round-trip whenever this fill CLOSED quantity — which is
        // exactly when it runs opposite an existing position. Gating on
        // `realizedDelta !== 0` instead meant a scratch trade (exit == entry)
        // left no trace at all, so the history silently omitted every
        // break-even close. Derived from `before`, where the entry price and
        // open time live.
        const trades = [...(s.trades ?? [])];
        const signedQty = f.side === "buy" ? f.qty : -f.qty;
        const closedSomething = !!before && Math.sign(signedQty) !== Math.sign(before.qty);
        if (closedSomething && before) {
          const closedQty = Math.min(f.qty, Math.abs(before.qty));
          trades.unshift({
            id: `t-${f.ts ?? Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sym: f.sym,
            side: before.qty > 0 ? "long" : "short",
            qty: closedQty,
            entry: before.avgPrice,
            exit: f.price,
            pnl: realizedDelta,
            openedAt: before.openedAt,
            closedAt: f.ts ?? Date.now(),
          });
        }

        set({
          ...(fresh ?? {}),
          shares,
          trades: trades.slice(0, MAX_TRADES),
          cash: s.cash + cashDelta,
          // Share P&L lands in the same realizedToday the kill switch reads, so
          // one daily loss limit governs both books.
          realizedToday: s.realizedToday + realizedDelta,
        });
        return { ok: true, realized: realizedDelta };
      },
      submitOrder: (input) => {
        const invalid = validateOrder(input);
        if (invalid) return { ok: false, error: invalid };

        // ── safety gates live HERE, at the single entry point every order
        // path shares, so no caller can forget them.
        const safety = useSafety.getState();
        const held = get().shares[input.sym]?.qty ?? 0;
        const signedQty = input.side === "buy" ? input.qty : -input.qty;
        const nextQty = held + signedQty;
        // Reducing exposure is always allowed — including while halted.
        // Blocking a close would trap the user in the position that armed it.
        const reducing = Math.abs(nextQty) < Math.abs(held);
        if (safety.killSwitchTriggered && !reducing) {
          return { ok: false, error: "kill switch is on — only closing orders are allowed" };
        }
        // Training wheels promise defined risk; a short stock position has none.
        if (safety.trainingWheels && nextQty < -1e-9 && !input.reduceOnly) {
          return {
            ok: false,
            error: "training wheels: short selling has unlimited risk — turn them off in Safety to allow it",
          };
        }

        const now = Date.now();
        const order: WorkingOrder = {
          ...input,
          id: `ord-${now}-${Math.random().toString(36).slice(2, 7)}`,
          status: "working",
          placedAt: now,
          expiresAt: tifExpiry(input.tif, now),
        };

        // Buying power: a BUY must be covered by funds not already reserved by
        // other working orders. Reduce-only exits and sells are exempt — they
        // release exposure rather than adding it.
        const s = get();
        if (order.side === "buy" && !order.reduceOnly) {
          const px =
            order.type === "market" ? input.marketPrice : order.type === "limit" ? order.limitPrice : order.stopPrice;
          const need = Number.isFinite(px) ? (px as number) * order.qty : 0;
          const free = calcAvailable(s.cash, s.orders);
          if (need > free) {
            return {
              ok: false,
              error: `not enough buying power — needs $${need.toFixed(2)}, $${Math.max(0, free).toFixed(2)} available`,
            };
          }
        }

        // A market order does not rest; fill it immediately at the mark.
        if (order.type === "market") {
          const px = input.marketPrice;
          if (!Number.isFinite(px) || (px as number) <= 0) return { ok: false, error: "no market price available" };
          const res = get().fillShares({ sym: order.sym, side: order.side, qty: order.qty, price: px as number, ts: now });
          if (!res.ok) return { ok: false, error: res.error };
          const filled: WorkingOrder = { ...order, status: "filled", filledAt: now, fillPrice: px as number };
          const exits = bracketFor(filled, px as number, now);
          set((st) => ({ orders: [filled, ...exits, ...st.orders].slice(0, 300) }));
          return { ok: true, order: filled };
        }

        set((st) => ({ orders: [order, ...st.orders].slice(0, 300) }));
        return { ok: true, order };
      },

      cancelOrder: (id) =>
        set((st) => ({
          orders: st.orders.map((o) =>
            o.id === id && o.status === "working" ? { ...o, status: "cancelled", note: "cancelled by user" } : o
          ),
        })),

      markPrice: (sym, price) => {
        const s = get();
        if (!s.orders.some((o) => o.status === "working" && o.sym === sym)) return;
        const now = Date.now();
        const res = sweep(s.orders, sym, price, now);
        if (!res.fills.length && !res.cancelled.length) return;
        // Book each fill through the same accounting path a manual trade uses.
        for (const f of res.fills) {
          get().fillShares({ sym: f.order.sym, side: f.order.side, qty: f.order.qty, price: f.price, ts: now });
        }
        // Entries that carried a bracket get their exits once they fill.
        const born = res.fills.flatMap((f) =>
          f.order.reduceOnly ? [] : bracketFor(f.order, f.price, now)
        );
        set({ orders: [...born, ...res.orders].slice(0, 300) });
      },

      setStartingCash: (n) => {
        const capital = Number.isFinite(n) && n > 0 ? Math.min(n, 1e9) : DEFAULT_CAPITAL;
        // Changing the starting capital restarts the account — carrying old
        // positions and P&L into a new balance would make every historical
        // return percentage meaningless.
        set({ cash: capital, startingCash: capital, positions: [], shares: {}, orders: [], trades: [], realizedToday: 0 });
      },
      reset: () =>
        set((s) => ({
          cash: s.startingCash,
          positions: [],
          shares: {},
          orders: [],
          trades: [],
          realizedToday: 0,
        })),
    }),
    {
      name: "lb-paper",
      // `shares` was added after launch, so accounts persisted before this
      // change deserialize without it. Without a merge that restores the
      // default, every read of `shares` would be undefined and the /pro
      // position panel would crash on first render for existing users.
      version: 2,
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<PaperState>;
        return {
          ...p,
          shares: sanitizeShares(p.shares),
          orders: Array.isArray(p.orders) ? p.orders : [],
          trades: Array.isArray(p.trades) ? p.trades : [],
        } as PaperState;
      },
      // migrate() only runs when the stored version differs. Anything already
      // at v2 — including hand-edited or half-written localStorage — bypasses
      // it, so sanitize on every hydration too. A `shares: null` or an array
      // used to hard-crash /pro and /trade/chain on first render.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PaperState>;
        const num = (v: unknown, fallback: number) =>
          typeof v === "number" && Number.isFinite(v) ? v : fallback;
        return {
          ...current,
          ...p,
          cash: num(p.cash, current.cash),
          startingCash: num(p.startingCash, current.startingCash),
          realizedToday: num(p.realizedToday, 0),
          positions: Array.isArray(p.positions) ? p.positions : [],
          orders: Array.isArray(p.orders) ? p.orders.slice(0, 300) : [],
          trades: Array.isArray(p.trades)
            ? p.trades.filter((t) => t && Number.isFinite(t.pnl) && Number.isFinite(t.qty)).slice(0, MAX_TRADES)
            : [],
          shares: sanitizeShares(p.shares),
        } as PaperState;
      },
    }
  )
);

// ─────────────── safety store ───────────────
type SafetyState = {
  wizardSeen: boolean;
  trainingWheels: boolean;
  dailyLossLimit: number;
  killSwitchTriggered: boolean;
  killReason?: string;
  setWizardSeen: () => void;
  setTrainingWheels: (v: boolean) => void;
  setDailyLossLimit: (n: number) => void;
  triggerKillSwitch: (reason: string) => void;
  resetKillSwitch: () => void;
};

export const useSafety = create<SafetyState>()(
  persist(
    (set) => ({
      wizardSeen: false,
      trainingWheels: true,
      dailyLossLimit: 500,
      killSwitchTriggered: false,
      setWizardSeen: () => set({ wizardSeen: true }),
      setTrainingWheels: (v) => set({ trainingWheels: v }),
      setDailyLossLimit: (n) => set({ dailyLossLimit: Math.max(0, n) }),
      triggerKillSwitch: (reason) => set({ killSwitchTriggered: true, killReason: reason }),
      resetKillSwitch: () => set({ killSwitchTriggered: false, killReason: undefined }),
    }),
    { name: "lb-safety" }
  )
);

// ─────────────── theme store ───────────────
type ThemeState = { theme: "dark" | "light"; toggle: () => void };
export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toggle: () => set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    { name: "lb-theme" }
  )
);

// ─────────────── teacher store ───────────────
type TeacherState = {
  bubble?: { title: string; body: string; icon: string };
  setBubble: (b?: TeacherState["bubble"]) => void;
};

export const useTeacher = create<TeacherState>((set) => ({
  bubble: undefined,
  setBubble: (b) => set({ bubble: b }),
}));

// Keep every open tab's view of the paper account converged. `persist` does not
// subscribe to the `storage` event, so without this a second tab shows a stale
// balance until reload — and the user sees two different accounts side by side.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "lb-paper") void usePaper.persist.rehydrate();
    if (e.key === "lb-safety") void useSafety.persist.rehydrate();
  });
}

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChainCell, Leg } from "./pricing";

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

type PaperState = {
  cash: number;
  startingCash: number;
  positions: Position[];
  realizedToday: number;
  open: (p: Omit<Position, "id" | "openedAt" | "status" | "pnl">) => Position;
  close: (id: string, exitPnl: number) => void;
  closeAll: (reason: string) => void;
  reset: () => void;
};

export const usePaper = create<PaperState>()(
  persist(
    (set, get) => ({
      cash: 100_000,
      startingCash: 100_000,
      positions: [],
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
          return { positions, cash };
        }),
      reset: () => set({ cash: 100_000, positions: [], realizedToday: 0 }),
    }),
    { name: "lb-paper" }
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

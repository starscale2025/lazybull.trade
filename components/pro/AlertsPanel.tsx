"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TogglePill, ToolButton } from "@/components/calm/kit";
import type { Alert } from "./Chart";
import { fmt } from "./chartCore";

type Props = {
  open: boolean;
  onClose: () => void;
  symbol: string;
  spot: number;
  alerts: Alert[];
  setAlerts: (a: Alert[] | ((prev: Alert[]) => Alert[])) => void;
};

export function AlertsPanel({ open, onClose, symbol, spot, alerts, setAlerts }: Props) {
  const [price, setPrice] = useState<string>("");
  const [cond, setCond] = useState<"above" | "below">("above");
  const [note, setNote] = useState("");

  const add = () => {
    const p = parseFloat(price);
    if (!Number.isFinite(p)) return;
    setAlerts((cur) => [
      ...cur,
      { id: `al-${Math.random().toString(36).slice(2, 7)}`, price: p, cond, note: note.trim() || undefined, triggered: false },
    ]);
    setPrice("");
    setNote("");
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-end bg-black/50 backdrop-blur-sm"
        >
          <motion.aside
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[20rem] max-w-full flex-col border-l border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 t-label">
              <span className="text-fg">Alerts · {symbol}</span>
              <button onClick={onClose} className="text-fg-faint hover:text-fg">✕</button>
            </div>

            <div className="border-b border-border-soft p-3 space-y-2">
              <div className="flex items-center gap-2 t-label text-fg-dim">
                <span className="text-fg-faint">Spot</span>
                <span className="t-data text-fg">{fmt(spot, 2)}</span>
              </div>
              <div className="flex gap-1">
                <TogglePill on={cond === "above"} onClick={() => setCond("above")} className="flex-1 justify-center">
                  ▲ Above
                </TogglePill>
                <TogglePill on={cond === "below"} onClick={() => setCond("below")} className="flex-1 justify-center">
                  ▼ Below
                </TogglePill>
              </div>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={`Price · e.g. ${fmt(spot, 2)}`}
                className="w-full surface-instrument border border-border bg-surface px-2 py-1.5 font-mono text-sm text-fg outline-none focus:border-brand-ink"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full surface-instrument border border-border bg-surface px-2 py-1.5 font-mono text-[0.6875rem] text-fg outline-none focus:border-brand-ink"
              />
              <ToolButton primary onClick={add} className="w-full">
                + Create alert
              </ToolButton>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="border-b border-border-soft px-3 py-1.5 t-label text-fg-faint">
                {alerts.length} active
              </div>
              {alerts.map((a) => (
                <div key={a.id} className="grid grid-cols-12 items-center gap-2 border-b border-border-soft px-3 py-2 t-data text-[0.6875rem]">
                  <span className="col-span-2 text-fg-dim">{a.cond === "above" ? "▲" : "▼"}</span>
                  <span className="col-span-4 text-fg">{fmt(a.price, 2)}</span>
                  <span className="col-span-4 text-fg-dim text-[0.625rem]">{a.note || "—"}</span>
                  <span className="col-span-1">
                    {a.triggered && <span className="text-brand-ink">●</span>}
                  </span>
                  <button onClick={() => setAlerts((cur) => cur.filter((x) => x.id !== a.id))} className="col-span-1 text-fg-faint hover:text-fg">×</button>
                </div>
              ))}
              {!alerts.length && <div className="px-3 py-6 text-center t-label text-fg-faint">No alerts yet</div>}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
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
          className="fixed inset-0 z-[110] flex items-center justify-end bg-black/50 backdrop-blur-sm"
        >
          <motion.aside
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[320px] flex-col border-l border-cyan/40 bg-bg shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em]">
              <span className="text-cyan">⚡ alerts · {symbol}</span>
              <button onClick={onClose} className="text-fg-faint hover:text-fg">✕</button>
            </div>

            <div className="border-b border-border-soft p-3 space-y-2">
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                <span className="text-fg-faint">spot</span>
                <span className="text-fg tabular-nums">{fmt(spot, 2)}</span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setCond("above")}
                  className={`flex-1 border px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider ${cond === "above" ? "border-bull text-bull bg-bull/10" : "border-border text-fg-dim hover:text-fg"}`}
                >
                  ▲ Above
                </button>
                <button
                  onClick={() => setCond("below")}
                  className={`flex-1 border px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider ${cond === "below" ? "border-bear text-bear bg-bear/10" : "border-border text-fg-dim hover:text-fg"}`}
                >
                  ▼ Below
                </button>
              </div>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={`price · e.g. ${fmt(spot, 2)}`}
                className="w-full border border-border bg-surface px-2 py-1.5 font-mono text-sm text-fg outline-none focus:border-cyan"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="note (optional)"
                className="w-full border border-border bg-surface px-2 py-1.5 font-mono text-[11px] text-fg outline-none focus:border-cyan"
              />
              <button onClick={add} className="w-full border border-cyan bg-cyan/10 py-1.5 font-mono text-[11px] uppercase tracking-wider text-cyan hover:bg-cyan/20">
                + create alert
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="border-b border-border-soft px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                {alerts.length} active
              </div>
              {alerts.map((a) => (
                <div key={a.id} className="grid grid-cols-12 items-center gap-2 border-b border-border-soft px-3 py-2 font-mono text-[11px] tabular-nums">
                  <span className={`col-span-2 ${a.cond === "above" ? "text-bull" : "text-bear"}`}>{a.cond === "above" ? "▲" : "▼"}</span>
                  <span className="col-span-4 text-fg">{fmt(a.price, 2)}</span>
                  <span className="col-span-4 text-fg-dim text-[10px]">{a.note || "—"}</span>
                  <span className="col-span-1">
                    {a.triggered && <span className="text-amber">●</span>}
                  </span>
                  <button onClick={() => setAlerts((cur) => cur.filter((x) => x.id !== a.id))} className="col-span-1 text-fg-faint hover:text-bear">×</button>
                </div>
              ))}
              {!alerts.length && <div className="px-3 py-6 text-center font-mono text-[10px] text-fg-faint">no alerts yet</div>}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

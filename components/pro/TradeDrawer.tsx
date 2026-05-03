"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { fmt } from "./chartCore";

type Order = { id: string; side: "buy" | "sell"; type: "market" | "limit"; qty: number; price: number; sym: string; ts: number };

type Props = {
  open: boolean;
  onClose: () => void;
  symbol: string;
  spot: number;
};

export function TradeDrawer({ open, onClose, symbol, spot }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("limit");
  const [qty, setQty] = useState("100");
  const [price, setPrice] = useState(spot.toFixed(2));
  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("lb-pro-orders") || "[]") as Order[]; } catch { return []; }
  });

  const place = () => {
    const o: Order = {
      id: `o-${Date.now()}`,
      side, type, sym: symbol,
      qty: parseFloat(qty) || 0,
      price: type === "market" ? spot : parseFloat(price) || spot,
      ts: Date.now(),
    };
    const next = [o, ...orders].slice(0, 30);
    setOrders(next);
    try { localStorage.setItem("lb-pro-orders", JSON.stringify(next)); } catch {}
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
            initial={{ x: 360 }}
            animate={{ x: 0 }}
            exit={{ x: 360 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-[360px] flex-col border-l border-bull/40 bg-bg shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em]">
              <span className="text-bull">⚡ paper trade · {symbol}</span>
              <button onClick={onClose} className="text-fg-faint hover:text-fg">✕</button>
            </div>

            <div className="border-b border-border-soft p-4">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setSide("buy")}
                  className={`border py-2 font-mono text-xs font-semibold uppercase tracking-wider ${side === "buy" ? "border-bull bg-bull/10 text-bull" : "border-border text-fg-dim hover:text-fg"}`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setSide("sell")}
                  className={`border py-2 font-mono text-xs font-semibold uppercase tracking-wider ${side === "sell" ? "border-bear bg-bear/10 text-bear" : "border-border text-fg-dim hover:text-fg"}`}
                >
                  Sell
                </button>
              </div>
              <div className="mt-3 flex gap-1">
                {(["market", "limit"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 border px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider ${type === t ? "border-cyan text-cyan bg-cyan/10" : "border-border text-fg-dim hover:text-fg"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="mt-3 space-y-2 font-mono text-[11px]">
                <label className="flex items-center justify-between border border-border bg-surface px-2 py-1.5">
                  <span className="text-fg-faint text-[10px] uppercase">qty</span>
                  <input value={qty} onChange={(e) => setQty(e.target.value)} className="w-24 bg-transparent text-right text-fg outline-none" />
                </label>
                <label className={`flex items-center justify-between border bg-surface px-2 py-1.5 ${type === "market" ? "border-border opacity-50" : "border-border"}`}>
                  <span className="text-fg-faint text-[10px] uppercase">price</span>
                  <input
                    value={type === "market" ? "MKT" : price}
                    disabled={type === "market"}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-24 bg-transparent text-right text-fg outline-none"
                  />
                </label>
                <div className="flex items-center justify-between border border-border bg-surface px-2 py-1.5 text-fg-dim">
                  <span className="text-[10px] uppercase">est. value</span>
                  <span className="text-fg tabular-nums">${fmt((parseFloat(qty) || 0) * (type === "market" ? spot : parseFloat(price) || spot), 2)}</span>
                </div>
                <button
                  onClick={place}
                  className={`mt-1 w-full py-2.5 font-mono text-xs font-semibold uppercase tracking-wider ${side === "buy" ? "bg-bull text-bg hover:bg-bull-dim" : "bg-bear text-bg hover:bg-bear-dim"}`}
                >
                  Place {side} {type} ↵
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="border-b border-border-soft px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                paper orders · {orders.length}
              </div>
              {orders.length === 0 && <div className="px-3 py-6 text-center font-mono text-[10px] text-fg-faint">no orders yet</div>}
              {orders.map((o) => (
                <div key={o.id} className="grid grid-cols-12 items-center gap-2 border-b border-border-soft px-3 py-1.5 font-mono text-[10px] tabular-nums">
                  <span className={`col-span-2 ${o.side === "buy" ? "text-bull" : "text-bear"}`}>{o.side === "buy" ? "B" : "S"}</span>
                  <span className="col-span-2 text-fg">{o.sym}</span>
                  <span className="col-span-2 text-fg-dim uppercase">{o.type}</span>
                  <span className="col-span-2 text-right text-fg">{o.qty}</span>
                  <span className="col-span-2 text-right text-fg">{fmt(o.price, 2)}</span>
                  <span className="col-span-2 text-right text-fg-faint">{new Date(o.ts).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

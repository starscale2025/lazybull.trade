"use client";

// The TradingView-style on-chart order widget: SELL | qty | BUY, floating in
// the top-left of the chart. One click books a market paper order through the
// shared-account funnel (lib/pro/paper.ts) — same cash, same kill switch,
// same blotter as the drawer and the voice co-pilot.

import { useState } from "react";
import { placePaperOrder } from "@/lib/pro/paper";
import { useSafety } from "@/lib/stores";
import { fmt } from "./chartCore";

type Props = {
  symbol: string;
  /** Last traded price — the fill price for a market order. */
  price: number | null;
  /** Trading at replay prices would book fills that never existed. */
  disabled?: boolean;
  onResult: (msg: string, tone?: "ok" | "warn") => void;
};

export function OrderTicket({ symbol, price, disabled = false, onResult }: Props) {
  const [qty, setQty] = useState("100");
  // The a11y name and the disabled state must describe the quantity that will
  // actually be booked, not the raw keystrokes ("1.2.3" parses to 1.2).
  const parsedQty = parseFloat(qty);
  const qtyLabel = Number.isFinite(parsedQty) && parsedQty > 0 ? String(parsedQty) : "no";
  const killed = useSafety((s) => s.killSwitchTriggered);
  const blocked = disabled || killed || !price;

  const submit = (side: "buy" | "sell") => {
    if (!price) return;
    if (killed) {
      onResult("Kill switch is on — no new orders", "warn");
      return;
    }
    const n = parseFloat(qty);
    const res = placePaperOrder({ sym: symbol, side, type: "market", qty: n, price });
    if (!res.ok) {
      onResult(`Rejected: ${res.error}`, "warn");
      return;
    }
    onResult(`⚡ Paper ${side.toUpperCase()} ${n} ${symbol} @ ${fmt(price, 2)}`, "ok");
  };

  return (
    <div
      className={`pointer-events-auto flex items-stretch border border-border bg-bg/90 shadow-lg backdrop-blur-sm ${
        blocked ? "opacity-50" : ""
      }`}
      title={
        killed
          ? "Kill switch is on"
          : disabled
            ? "Exit replay to trade"
            : "Paper market orders at the last price"
      }
    >
      <button
        onClick={() => submit("sell")}
        disabled={blocked}
        // Without this the button's a11y name is "Sell333.74" (or empty in
        // some trees) — the price is decoration, the action is what matters.
        aria-label={`Sell ${qtyLabel} ${symbol} at market`}
        className="flex flex-col items-center px-3 py-1 font-mono transition-colors enabled:hover:bg-bear enabled:hover:text-bg disabled:cursor-not-allowed text-bear"
      >
        <span className="text-[9px] font-semibold uppercase tracking-wider">Sell</span>
        <span className="text-[11px] tabular-nums">{price ? fmt(price, 2) : "—"}</span>
      </button>
      <input
        value={qty}
        // Keep the user's text as typed (minus junk); the store validates on
        // submit. Silently rewriting input into a DIFFERENT valid number is
        // worse than rejecting it — the user never sees the substitution.
        onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
        inputMode="decimal"
        aria-label="Order quantity"
        className="w-14 border-x border-border bg-transparent text-center font-mono text-[11px] tabular-nums text-fg outline-none"
      />
      <button
        onClick={() => submit("buy")}
        disabled={blocked}
        aria-label={`Buy ${qtyLabel} ${symbol} at market`}
        className="flex flex-col items-center px-3 py-1 font-mono transition-colors enabled:hover:bg-bull enabled:hover:text-bg disabled:cursor-not-allowed text-bull"
      >
        <span className="text-[9px] font-semibold uppercase tracking-wider">Buy</span>
        <span className="text-[11px] tabular-nums">{price ? fmt(price, 2) : "—"}</span>
      </button>
    </div>
  );
}

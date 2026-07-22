"use client";

// The TradingView-style on-chart order widget: SELL | qty | BUY.
//
// Two-step by default. The first click STAGES the order and the widget flips to
// a confirm bar showing exactly what will be booked; only the second click
// books it. TradingView ships one-click trading OFF for the same reason — on a
// chart you are constantly clicking, and an instant fill from a stray click is
// indistinguishable from a deliberate trade after the fact.
//
// One-click can be turned on (persisted per browser) for people who want it.

import { useEffect, useRef, useState } from "react";
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

const ONE_CLICK_KEY = "lb-pro-one-click";
/** A staged order goes stale rather than sitting armed against a moving price. */
const STAGE_TTL_MS = 8000;

export function OrderTicket({ symbol, price, disabled = false, onResult }: Props) {
  const [qty, setQty] = useState("100");
  const [staged, setStaged] = useState<{ side: "buy" | "sell"; qty: number; price: number } | null>(null);
  const [oneClick, setOneClick] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const killed = useSafety((s) => s.killSwitchTriggered);
  const blocked = disabled || killed || !price;

  // The a11y name and the confirm bar must describe the quantity that will
  // actually be booked, not the raw keystrokes ("1.2.3" parses to 1.2).
  const parsedQty = parseFloat(qty);
  const validQty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : null;
  const qtyLabel = validQty !== null ? String(validQty) : "no";

  useEffect(() => {
    try {
      setOneClick(localStorage.getItem(ONE_CLICK_KEY) === "1");
    } catch {
      /* storage unavailable — stay two-step, the safer default */
    }
  }, []);

  // Drop a staged order when anything it was quoted against changes.
  useEffect(() => {
    setStaged(null);
  }, [symbol, disabled, killed]);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };
  useEffect(() => clearTimer, []);

  const book = (side: "buy" | "sell", atPrice: number, n: number) => {
    const res = placePaperOrder({ sym: symbol, side, type: "market", qty: n, price: atPrice });
    if (!res.ok) {
      onResult(`Rejected: ${res.error}`, "warn");
      return;
    }
    onResult(
      `⚡ Paper ${side.toUpperCase()} ${n} ${symbol} @ ${fmt(atPrice, 2)}${res.blotterWritten ? "" : " (history not saved)"}`,
      "ok"
    );
  };

  const arm = (side: "buy" | "sell") => {
    if (!price || validQty === null) {
      onResult("Enter a quantity above 0", "warn");
      return;
    }
    if (oneClick) {
      book(side, price, validQty);
      return;
    }
    clearTimer();
    setStaged({ side, qty: validQty, price });
    timerRef.current = setTimeout(() => setStaged(null), STAGE_TTL_MS);
  };

  const confirm = () => {
    if (!staged) return;
    clearTimer();
    // Book at the CURRENT price, not the one quoted when staged — otherwise a
    // slow confirm fills at a price that no longer exists.
    book(staged.side, price ?? staged.price, staged.qty);
    setStaged(null);
  };

  const toggleOneClick = () => {
    const next = !oneClick;
    setOneClick(next);
    setStaged(null);
    try {
      localStorage.setItem(ONE_CLICK_KEY, next ? "1" : "0");
    } catch {
      /* non-persistent this session */
    }
  };

  if (staged) {
    const up = staged.side === "buy";
    const drift = price != null ? price - staged.price : 0;
    return (
      <div className="pointer-events-auto flex items-stretch border border-border bg-surface shadow-lg">
        <div className="flex flex-col justify-center px-3 py-1 font-mono">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${up ? "text-bull" : "text-bear"}`}>
            Confirm {staged.side}
          </span>
          <span className="text-[11px] tabular-nums text-fg-dim">
            {staged.qty} {symbol} @ {fmt(price ?? staged.price, 2)}
            {Math.abs(drift) >= 0.01 && (
              // The price moved while the order sat staged — say so, because
              // the fill will use the new one.
              <span className={drift > 0 ? "text-bull" : "text-bear"}>
                {" "}
                ({drift > 0 ? "+" : "−"}
                {fmt(Math.abs(drift), 2)})
              </span>
            )}
          </span>
        </div>
        <button
          onClick={confirm}
          aria-label={`Confirm ${staged.side} ${staged.qty} ${symbol} at market`}
          className={`border-l border-border px-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg ${
            up ? "bg-bull hover:bg-bull-dim" : "bg-bear hover:bg-bear-dim"
          }`}
        >
          ✓
        </button>
        <button
          onClick={() => {
            clearTimer();
            setStaged(null);
          }}
          aria-label="Cancel staged order"
          className="border-l border-border px-3 font-mono text-[11px] text-fg-faint transition-colors hover:text-fg"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      className={`pointer-events-auto flex items-stretch border border-border bg-surface/90 shadow-lg backdrop-blur-sm ${
        blocked ? "opacity-50" : ""
      }`}
      title={
        killed
          ? "Kill switch is on"
          : disabled
            ? "Exit replay to trade"
            : oneClick
              ? "One-click trading is ON — orders book immediately"
              : "Click to stage an order, then confirm"
      }
    >
      <button
        onClick={() => arm("sell")}
        disabled={blocked}
        aria-label={`Sell ${qtyLabel} ${symbol} at market`}
        className="flex flex-col items-center px-3 py-1 font-mono transition-colors enabled:hover:bg-bear enabled:hover:text-bg disabled:cursor-not-allowed text-bear"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider">Sell</span>
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
        onClick={() => arm("buy")}
        disabled={blocked}
        aria-label={`Buy ${qtyLabel} ${symbol} at market`}
        className="flex flex-col items-center px-3 py-1 font-mono transition-colors enabled:hover:bg-bull enabled:hover:text-bg disabled:cursor-not-allowed text-bull"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider">Buy</span>
        <span className="text-[11px] tabular-nums">{price ? fmt(price, 2) : "—"}</span>
      </button>
      <button
        onClick={toggleOneClick}
        role="switch"
        aria-checked={oneClick}
        aria-label="One-click trading"
        title={oneClick ? "One-click trading ON — click to require confirmation" : "One-click trading OFF"}
        className={`border-l border-border px-2 font-mono text-[10px] uppercase tracking-wider transition-colors ${
          oneClick ? "bg-amber/20 text-amber" : "text-fg-faint hover:text-fg-dim"
        }`}
      >
        1-click
      </button>
    </div>
  );
}

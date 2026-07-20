"use client";

// The docked order panel: Market / Limit / Stop, quantity in shares or USD,
// take-profit and stop-loss brackets, and time in force.
//
// Limit and stop orders REST here — they go into the book and fill when the
// market reaches them (lib/paper-orders.ts). The old drawer filled a "limit"
// instantly at whatever price you typed, which is the opposite of what a limit
// order is.

import { useEffect, useMemo, useState } from "react";
import { usePaper, useSafety } from "@/lib/stores";
import { availableFunds, ordersMargin, type OrderType, type TimeInForce } from "@/lib/paper-orders";
import { fmt } from "./chartCore";

type Props = {
  symbol: string;
  price: number | null;
  /** Replay prices are historical — filling against them would be fiction. */
  disabled?: boolean;
  onResult: (msg: string, tone?: "ok" | "warn") => void;
  onClose: () => void;
};

const TIF_LABEL: Record<TimeInForce, string> = { day: "Day", week: "Week", gtc: "GTC" };

export function OrderPanel({ symbol, price, disabled = false, onResult, onClose }: Props) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<OrderType>("limit");
  const [qtyMode, setQtyMode] = useState<"shares" | "usd">("shares");
  const [qtyText, setQtyText] = useState("100");
  const [priceText, setPriceText] = useState("");
  const [priceTouched, setPriceTouched] = useState(false);
  const [tpOn, setTpOn] = useState(false);
  const [slOn, setSlOn] = useState(false);
  const [tpText, setTpText] = useState("");
  const [slText, setSlText] = useState("");
  const [tif, setTif] = useState<TimeInForce>("week");
  const [err, setErr] = useState<string | null>(null);

  const submitOrder = usePaper((s) => s.submitOrder);
  const cash = usePaper((s) => s.cash);
  const orders = usePaper((s) => s.orders);
  const killed = useSafety((s) => s.killSwitchTriggered);

  // Track the market until the user takes over the field — the panel mounts
  // before the chart's bars resolve, so seeding once left it showing 0.00.
  useEffect(() => {
    if (!priceTouched && price && price > 0) setPriceText(price.toFixed(2));
  }, [price, priceTouched]);

  // A stale rejection must not sit under a button describing a different order.
  useEffect(() => {
    setErr(null);
  }, [side, type, qtyText, priceText, tpText, slText, tif, symbol]);

  const limitOrStop = parseFloat(priceText);
  const refPrice = type === "market" ? price ?? 0 : Number.isFinite(limitOrStop) ? limitOrStop : price ?? 0;
  const rawQty = parseFloat(qtyText);
  // "USD" sizes by notional; shares is literal. Fractional shares are allowed —
  // the account is fractional throughout.
  const qty = useMemo(() => {
    if (!Number.isFinite(rawQty) || rawQty <= 0) return 0;
    if (qtyMode === "shares") return rawQty;
    return refPrice > 0 ? rawQty / refPrice : 0;
  }, [rawQty, qtyMode, refPrice]);

  const notional = qty * refPrice;
  const free = availableFunds(cash, orders);
  const reserved = ordersMargin(orders);
  const blocked = disabled || killed || qty <= 0 || refPrice <= 0;

  const submit = () => {
    setErr(null);
    const res = submitOrder({
      sym: symbol,
      side,
      type,
      qty,
      limitPrice: type === "limit" ? limitOrStop : undefined,
      stopPrice: type === "stop" ? limitOrStop : undefined,
      takeProfit: tpOn && parseFloat(tpText) > 0 ? parseFloat(tpText) : undefined,
      stopLoss: slOn && parseFloat(slText) > 0 ? parseFloat(slText) : undefined,
      tif,
      marketPrice: price ?? undefined,
    });
    if (!res.ok) {
      setErr(res.error ?? "order rejected");
      return;
    }
    onResult(
      type === "market"
        ? `⚡ ${side.toUpperCase()} ${fmt(qty, 2)} ${symbol} @ ${fmt(price ?? 0, 2)}`
        : `${type.toUpperCase()} ${side} ${fmt(qty, 2)} ${symbol} @ ${fmt(limitOrStop, 2)} is working`,
      "ok"
    );
  };

  const field = "w-full border border-border bg-bg px-2 py-1.5 text-right font-mono text-[12px] tabular-nums text-fg outline-none focus:border-fg-dim";
  const label = "font-mono text-[9px] uppercase tracking-wider text-fg-faint";

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-l border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-fg">
          {symbol} <span className="text-fg-faint">order</span>
        </span>
        <button onClick={onClose} aria-label="Close order panel" className="font-mono text-xs text-fg-faint hover:text-fg">
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {/* side */}
        <div className="grid grid-cols-2 gap-px bg-border">
          {(["sell", "buy"] as const).map((sd) => (
            <button
              key={sd}
              onClick={() => setSide(sd)}
              aria-pressed={side === sd}
              className={`flex flex-col items-center py-2 font-mono transition-colors ${
                side === sd
                  ? sd === "buy"
                    ? "bg-bull text-bg"
                    : "bg-bear text-bg"
                  : "bg-bg text-fg-dim hover:text-fg"
              }`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider">{sd}</span>
              <span className="text-[12px] tabular-nums">{price ? fmt(price, 2) : "—"}</span>
            </button>
          ))}
        </div>

        {/* type */}
        <div className="flex gap-px bg-border">
          {(["market", "limit", "stop"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={`flex-1 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                type === t ? "bg-surface text-fg" : "bg-bg text-fg-faint hover:text-fg-dim"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* price */}
        {type !== "market" && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className={label}>{type === "limit" ? "limit price" : "stop price"}</span>
              <button
                onClick={() => {
                  setPriceTouched(true);
                  if (price) setPriceText(price.toFixed(2));
                }}
                className="font-mono text-[9px] uppercase tracking-wider text-fg-faint hover:text-fg"
              >
                use last
              </button>
            </div>
            <input
              value={priceText}
              onChange={(e) => {
                setPriceTouched(true);
                setPriceText(e.target.value.replace(/[^\d.]/g, ""));
              }}
              inputMode="decimal"
              aria-label={type === "limit" ? "Limit price" : "Stop price"}
              className={field}
            />
          </div>
        )}

        {/* quantity */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className={label}>quantity</span>
            <div className="flex gap-px">
              {(["shares", "usd"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setQtyMode(m)}
                  aria-pressed={qtyMode === m}
                  className={`px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                    qtyMode === m ? "bg-surface text-fg" : "text-fg-faint hover:text-fg-dim"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <input
            value={qtyText}
            onChange={(e) => setQtyText(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            aria-label={qtyMode === "shares" ? "Quantity in shares" : "Quantity in dollars"}
            className={field}
          />
          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-fg-faint">
            <span>{qtyMode === "shares" ? "≈ value" : "≈ shares"}</span>
            <span className="tabular-nums text-fg-dim">
              {qtyMode === "shares" ? `$${fmt(notional, 2)}` : fmt(qty, 4)}
            </span>
          </div>
        </div>

        {/* brackets */}
        <div className="border-t border-border-soft pt-3">
          <div className={`${label} mb-2`}>exits</div>
          <BracketRow
            name="Take profit"
            on={tpOn}
            setOn={setTpOn}
            value={tpText}
            setValue={setTpText}
            placeholder={refPrice ? (side === "buy" ? refPrice * 1.02 : refPrice * 0.98).toFixed(2) : ""}
          />
          <BracketRow
            name="Stop loss"
            on={slOn}
            setOn={setSlOn}
            value={slText}
            setValue={setSlText}
            placeholder={refPrice ? (side === "buy" ? refPrice * 0.98 : refPrice * 1.02).toFixed(2) : ""}
          />
        </div>

        {/* time in force */}
        {type !== "market" && (
          <div>
            <div className={`${label} mb-1`}>time in force</div>
            <div className="flex gap-px bg-border">
              {(["day", "week", "gtc"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTif(t)}
                  aria-pressed={tif === t}
                  className={`flex-1 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                    tif === t ? "bg-surface text-fg" : "bg-bg text-fg-faint hover:text-fg-dim"
                  }`}
                >
                  {TIF_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* buying power */}
        <div className="space-y-1 border-t border-border-soft pt-3 font-mono text-[10px]">
          <Row k="Available funds" v={`$${fmt(free, 2)}`} />
          <Row k="Orders margin" v={`$${fmt(reserved, 2)}`} />
          <Row k="Order value" v={`$${fmt(notional, 2)}`} tone={notional > free && side === "buy" ? "text-bear" : undefined} />
          {/* 1:1 is stated because a paper account that silently implied leverage
              would teach the wrong lesson about position size. */}
          <Row k="Leverage" v="1:1" />
        </div>
      </div>

      <div className="border-t border-border p-3">
        <button
          onClick={submit}
          disabled={blocked}
          className={`w-full py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            side === "buy" ? "bg-bull text-bg hover:bg-bull-dim" : "bg-bear text-bg hover:bg-bear-dim"
          }`}
        >
          {killed
            ? "kill switch on"
            : disabled
              ? "exit replay to trade"
              : `${side} ${qty > 0 ? fmt(qty, 2) : ""} ${symbol} ${type === "market" ? "@ MKT" : `@ ${fmt(limitOrStop || 0, 2)} ${type.toUpperCase()}`}`}
        </button>
        {err && (
          <div role="alert" className="mt-2 border border-bear/40 bg-bear/10 px-2 py-1.5 font-mono text-[10px] text-bear">
            {err}
          </div>
        )}
        <div className="mt-2 text-center font-mono text-[9px] uppercase tracking-widest text-fg-faint">
          paper only · not advice
        </div>
      </div>
    </aside>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-fg-faint">{k}</span>
      <span className={`tabular-nums ${tone ?? "text-fg-dim"}`}>{v}</span>
    </div>
  );
}

function BracketRow({
  name,
  on,
  setOn,
  value,
  setValue,
  placeholder,
}: {
  name: string;
  on: boolean;
  setOn: (v: boolean) => void;
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <button
        role="switch"
        aria-checked={on}
        aria-label={name}
        onClick={() => setOn(!on)}
        className={`h-4 w-7 shrink-0 rounded-full border transition-colors ${
          on ? "border-bull/60 bg-bull/30" : "border-border bg-bg"
        }`}
      >
        <span
          className={`block size-3 rounded-full transition-transform ${on ? "translate-x-3.5 bg-bull" : "translate-x-0.5 bg-fg-faint"}`}
        />
      </button>
      <span className="flex-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim">{name}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
        disabled={!on}
        placeholder={placeholder}
        inputMode="decimal"
        aria-label={`${name} price`}
        className="w-20 border border-border bg-bg px-1.5 py-1 text-right font-mono text-[11px] tabular-nums text-fg outline-none disabled:opacity-40"
      />
    </div>
  );
}

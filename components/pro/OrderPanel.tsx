"use client";

// The docked order panel, laid out to match a professional terminal's order
// ticket: Order/DOM tabs, a Sell | spread | Buy header, Market/Limit/Stop,
// price with a bid/ask swap, quantity in shares or currency, Exits with per-leg
// price-or-ticks entry, Extra settings, and an Order info summary.
//
// Limit and stop orders REST — they enter the book and fill when the market
// reaches them (lib/paper-orders.ts).

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
/** Equities quote in cents. Ticks are shown against this. */
const TICK = 0.01;
/** Synthetic spread so Sell/Buy differ, as a real quote would. No L1 feed here. */
const SPREAD = 0.02;

export function OrderPanel({ symbol, price, disabled = false, onResult, onClose }: Props) {
  const [tab, setTab] = useState<"order" | "dom">("order");
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
  /** Each exit can be entered as an absolute price or a distance in ticks. */
  const [tpUnit, setTpUnit] = useState<"price" | "ticks">("price");
  const [slUnit, setSlUnit] = useState<"price" | "ticks">("price");
  const [tif, setTif] = useState<TimeInForce>("week");
  const [rthFill, setRthFill] = useState(false);
  const [rthTp, setRthTp] = useState(false);
  const [exitsOpen, setExitsOpen] = useState(true);
  const [extraOpen, setExtraOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submitOrder = usePaper((s) => s.submitOrder);
  const cash = usePaper((s) => s.cash);
  const orders = usePaper((s) => s.orders);
  const killed = useSafety((s) => s.killSwitchTriggered);

  const bid = price != null ? price - SPREAD / 2 : null;
  const ask = price != null ? price + SPREAD / 2 : null;

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
  const qty = useMemo(() => {
    if (!Number.isFinite(rawQty) || rawQty <= 0) return 0;
    if (qtyMode === "shares") return rawQty;
    return refPrice > 0 ? rawQty / refPrice : 0;
  }, [rawQty, qtyMode, refPrice]);

  /** An exit's absolute price, whether it was typed as a price or as ticks. */
  const exitPrice = (text: string, unit: "price" | "ticks", dir: 1 | -1): number | undefined => {
    const n = parseFloat(text);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    if (unit === "price") return n;
    // Ticks are a DISTANCE from the entry, signed by which exit it is and which
    // way the trade faces — so the same "75 ticks" means profit on a buy and on
    // a sell without the user re-deriving the direction.
    const away = side === "buy" ? dir : -dir;
    return refPrice + away * n * TICK;
  };
  const tpPrice = tpOn ? exitPrice(tpText, tpUnit, 1) : undefined;
  const slPrice = slOn ? exitPrice(slText, slUnit, -1) : undefined;
  const ticksFrom = (p?: number) => (p == null || !refPrice ? null : Math.round(Math.abs(p - refPrice) / TICK));

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
      takeProfit: tpPrice,
      stopLoss: slPrice,
      tif,
      marketPrice: price ?? undefined,
    });
    if (!res.ok) {
      setErr(res.error ?? "order rejected");
      return;
    }
    onResult(
      type === "market"
        ? `${side.toUpperCase()} ${fmt(qty, 2)} ${symbol} @ ${fmt(price ?? 0, 2)}`
        : `${type.toUpperCase()} ${side} ${fmt(qty, 2)} ${symbol} @ ${fmt(limitOrStop, 2)} is working`,
      "ok"
    );
  };

  const label = "font-mono text-[9px] uppercase tracking-wider text-fg-faint";

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-border bg-bg">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="font-mono text-[12px] uppercase tracking-wider text-fg">
          {symbol} <span className="text-fg-faint">order</span>
        </span>
        <button onClick={onClose} aria-label="Close order panel" className="font-mono text-xs text-fg-faint hover:text-fg">
          ✕
        </button>
      </div>

      {/* Order / DOM */}
      <div className="grid grid-cols-2 gap-px bg-border p-px">
        {(["order", "dom"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors ${
              tab === t ? "bg-surface-2 text-fg" : "bg-bg text-fg-faint hover:text-fg-dim"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "dom" ? (
        <DomLadder symbol={symbol} price={price} onPick={(p) => { setTab("order"); setPriceTouched(true); setPriceText(p.toFixed(2)); }} />
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            {/* Sell | spread | Buy */}
            <div className="flex items-stretch border-b border-border">
              <button
                onClick={() => setSide("sell")}
                aria-pressed={side === "sell"}
                className={`flex flex-1 flex-col items-center py-2 font-mono transition-colors ${
                  side === "sell" ? "bg-bear text-bg" : "bg-bg text-bear hover:bg-bear/10"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">Sell</span>
                <span className="text-[13px] tabular-nums">{bid ? fmt(bid, 2) : "—"}</span>
              </button>
              <div className="flex w-12 items-center justify-center border-x border-border font-mono text-[10px] tabular-nums text-fg-faint">
                {price ? SPREAD.toFixed(2) : "—"}
              </div>
              <button
                onClick={() => setSide("buy")}
                aria-pressed={side === "buy"}
                className={`flex flex-1 flex-col items-center py-2 font-mono transition-colors ${
                  side === "buy" ? "bg-bull text-bg" : "bg-bg text-bull hover:bg-bull/10"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">Buy</span>
                <span className="text-[13px] tabular-nums">{ask ? fmt(ask, 2) : "—"}</span>
              </button>
            </div>

            {/* Market | Limit | Stop */}
            <div className="flex border-b border-border">
              {(["market", "limit", "stop"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={`flex-1 border-b-2 py-2 font-mono text-[11px] capitalize transition-colors ${
                    type === t ? "border-bull text-fg" : "border-transparent text-fg-faint hover:text-fg-dim"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-3 p-3">
              {/* price */}
              {type !== "market" && (
                <div>
                  <div className={`${label} mb-1`}>price</div>
                  <Field
                    value={priceText}
                    onChange={(v) => {
                      setPriceTouched(true);
                      setPriceText(v);
                    }}
                    ariaLabel={type === "limit" ? "Limit price" : "Stop price"}
                    suffix={side === "buy" ? "Ask" : "Bid"}
                    onSwap={() => {
                      // Swap to the other side of the book, the way a terminal's
                      // ⇄ jumps a limit between bid and ask.
                      const p = side === "buy" ? bid : ask;
                      if (p) {
                        setPriceTouched(true);
                        setPriceText(p.toFixed(2));
                      }
                    }}
                  />
                </div>
              )}

              {/* quantity */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className={label}>{qtyMode === "shares" ? "quantity" : "usd"}</span>
                  <div className="flex gap-px">
                    {(["shares", "usd"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setQtyMode(m)}
                        aria-pressed={qtyMode === m}
                        className={`px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                          qtyMode === m ? "bg-surface-2 text-fg" : "text-fg-faint hover:text-fg-dim"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <Field
                  value={qtyText}
                  onChange={setQtyText}
                  ariaLabel={qtyMode === "shares" ? "Quantity in shares" : "Quantity in dollars"}
                  suffix={qtyMode === "shares" ? `${fmt(notional, 0)} usd` : `${fmt(qty, 2)} sh`}
                />
              </div>

              {/* exits */}
              <Section title="Exits" open={exitsOpen} onToggle={() => setExitsOpen((v) => !v)}>
                <ExitRow
                  name="Take profit"
                  on={tpOn}
                  setOn={setTpOn}
                  unit={tpUnit}
                  setUnit={setTpUnit}
                  value={tpText}
                  setValue={setTpText}
                  resolved={tpPrice}
                  ticks={ticksFrom(tpPrice)}
                  tone="text-cyan"
                />
                <ExitRow
                  name="Stop loss"
                  on={slOn}
                  setOn={setSlOn}
                  unit={slUnit}
                  setUnit={setSlUnit}
                  value={slText}
                  setValue={setSlText}
                  resolved={slPrice}
                  ticks={ticksFrom(slPrice)}
                  tone="text-amber"
                />
              </Section>

              {/* extra settings */}
              <Section title="Extra settings" open={extraOpen} onToggle={() => setExtraOpen((v) => !v)}>
                {type !== "market" && (
                  <div className="mb-2">
                    <div className={`${label} mb-1`}>time in force</div>
                    <div className="flex gap-px bg-border">
                      {(["day", "week", "gtc"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTif(t)}
                          aria-pressed={tif === t}
                          className={`flex-1 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                            tif === t ? "bg-surface-2 text-fg" : "bg-bg text-fg-faint hover:text-fg-dim"
                          }`}
                        >
                          {TIF_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* There is no extended-hours feed here, so these are recorded
                    on the order rather than pretended to be enforced. */}
                <Check label="Fill order outside RTH" checked={rthFill} onChange={setRthFill} />
                <Check label="Fill take profit outside RTH" checked={rthTp} onChange={setRthTp} />
              </Section>

              {/* order info */}
              <div className="space-y-1 border-t border-border-soft pt-3 font-mono text-[10px]">
                <div className={`${label} mb-1`}>order info</div>
                <Row k="Order value" v={`$${fmt(notional, 2)}`} tone={notional > free && side === "buy" ? "text-bear" : undefined} />
                <Row k="Available funds" v={`$${fmt(free, 2)}`} tone={free < 0 ? "text-bear" : undefined} />
                {reserved > 0 && <Row k="Orders margin" v={`$${fmt(reserved, 2)}`} tone="text-amber" />}
                {/* 1:1 is stated because a paper account that silently implied
                    leverage would teach the wrong lesson about position size. */}
                <Row k="Leverage" v="1:1" />
                <Row k="Tick value" v={`${TICK.toFixed(2)} USD`} />
              </div>
            </div>
          </div>

          {/* submit */}
          <div className="border-t border-border p-3">
            <button
              onClick={submit}
              disabled={blocked}
              className={`flex w-full flex-col items-center gap-0.5 py-2.5 font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                side === "buy" ? "bg-bull text-bg hover:bg-bull-dim" : "bg-bear text-bg hover:bg-bear-dim"
              }`}
            >
              <span className="text-[12px] font-semibold uppercase tracking-wider">
                {killed ? "kill switch on" : disabled ? "exit replay to trade" : side}
              </span>
              {!killed && !disabled && (
                <span className="text-[10px] tabular-nums opacity-90">
                  {qty > 0 ? fmt(qty, 2) : "—"} {symbol} @{" "}
                  {type === "market" ? "MKT" : `${fmt(limitOrStop || 0, 2)} ${type.toUpperCase()}`}
                </span>
              )}
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
        </>
      )}
    </aside>
  );
}

/** A value cell with an optional swap control and a right-hand unit hint. */
function Field({
  value,
  onChange,
  ariaLabel,
  suffix,
  onSwap,
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  suffix?: string;
  onSwap?: () => void;
}) {
  return (
    <div className="flex items-center border border-border bg-surface focus-within:border-fg-dim">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        inputMode="decimal"
        aria-label={ariaLabel}
        className="w-full bg-transparent px-2 py-2 text-right font-mono text-[13px] tabular-nums text-fg outline-none"
      />
      {onSwap && (
        <button
          onClick={onSwap}
          aria-label={`Use ${suffix}`}
          title={`Use ${suffix}`}
          className="border-l border-border px-2 py-2 font-mono text-[11px] text-fg-faint transition-colors hover:text-fg"
        >
          ⇄
        </button>
      )}
      {suffix && (
        <span className="shrink-0 border-l border-border px-2 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          {suffix}
        </span>
      )}
    </div>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-border-soft pt-3">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="mb-2 flex w-full items-center justify-between font-mono text-[11px] text-fg transition-colors hover:text-fg-dim"
      >
        {title}
        <span className={`text-fg-faint transition-transform ${open ? "" : "rotate-180"}`}>⌃</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function ExitRow({
  name,
  on,
  setOn,
  unit,
  setUnit,
  value,
  setValue,
  resolved,
  ticks,
  tone,
}: {
  name: string;
  on: boolean;
  setOn: (v: boolean) => void;
  unit: "price" | "ticks";
  setUnit: (u: "price" | "ticks") => void;
  value: string;
  setValue: (v: string) => void;
  resolved?: number;
  ticks: number | null;
  tone: string;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between">
        <button
          onClick={() => setUnit(unit === "price" ? "ticks" : "price")}
          className="font-mono text-[10px] text-fg-dim transition-colors hover:text-fg"
          title="Switch between an absolute price and a distance in ticks"
        >
          {name}, {unit} <span className="text-fg-faint">⌄</span>
        </button>
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
      </div>
      <div className={`flex items-center border border-border bg-surface ${on ? "" : "opacity-40"}`}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
          disabled={!on}
          inputMode="decimal"
          aria-label={`${name} ${unit}`}
          className={`w-full bg-transparent px-2 py-1.5 text-right font-mono text-[12px] tabular-nums outline-none ${tone}`}
        />
        {/* Whichever unit you are NOT typing in, shown live — so the tick
            distance and the absolute price are never out of sync in your head. */}
        <span className="shrink-0 border-l border-border px-2 py-1.5 font-mono text-[10px] tabular-nums text-fg-faint">
          {unit === "price"
            ? ticks != null
              ? `${ticks} ticks`
              : "ticks"
            : resolved != null
              ? fmt(resolved, 2)
              : "price"}
        </span>
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mb-1.5 flex cursor-pointer items-center gap-2 font-mono text-[10px] text-fg-dim">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-3 accent-bull"
      />
      {label}
    </label>
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

/**
 * A depth ladder. There is no real order-book feed behind this account, so the
 * sizes are illustrative and labelled as such rather than dressed up as depth
 * that does not exist. Clicking a row arms that price on the order form.
 */
function DomLadder({ symbol, price, onPick }: { symbol: string; price: number | null; onPick: (p: number) => void }) {
  const rows = useMemo(() => {
    if (!price) return [];
    const out: { price: number; side: "ask" | "bid" }[] = [];
    for (let i = 8; i >= 1; i--) out.push({ price: price + i * TICK * 5, side: "ask" });
    for (let i = 1; i <= 8; i++) out.push({ price: price - i * TICK * 5, side: "bid" });
    return out;
  }, [price]);

  if (!price) {
    return <div className="p-3 font-mono text-[11px] text-fg-faint">Waiting for a price…</div>;
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
        {symbol} · click a price to use it
      </div>
      {rows.map((r) => (
        <button
          key={r.price}
          onClick={() => onPick(r.price)}
          className="flex w-full items-center justify-between border-b border-border-soft px-3 py-1 font-mono text-[11px] tabular-nums transition-colors hover:bg-surface"
        >
          <span className={r.side === "ask" ? "text-bear" : "text-bull"}>{r.side}</span>
          <span className="text-fg">{fmt(r.price, 2)}</span>
        </button>
      ))}
      <div className="px-3 py-2 font-mono text-[9px] leading-relaxed text-fg-faint">
        Illustrative ladder — this paper account has no level-2 feed, so no sizes
        are shown rather than invented ones.
      </div>
    </div>
  );
}

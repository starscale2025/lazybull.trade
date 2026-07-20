"use client";

// The TradingView-style bottom trading panel: an account strip that is always
// visible, plus collapsible Positions / Orders tabs.
//
// Positions span EVERY symbol in the shared paper account, not just the one on
// the chart, so marks for the others come from /api/quote-batch on a 10s poll.
// A row with no live mark yet shows "—" and its close button stays disabled —
// closing a position at a price we do not have would fabricate a fill.

import { useEffect, useMemo, useState } from "react";
import { usePaper } from "@/lib/stores";
import { unrealizedPnl } from "@/lib/paper-shares";
import { placePaperOrder, readBlotter, ORDERS_CHANGED, type PlacedOrder } from "@/lib/pro/paper";
import { fmt } from "./chartCore";

type Props = {
  /** Live last for the charted symbol — seeds its mark without waiting for the poll. */
  chartSymbol: string;
  chartLast: number | null;
  /** Replay rewrites the chart's clock; closing at replay prices would lie. */
  replayActive: boolean;
  onResult: (msg: string, tone?: "ok" | "warn") => void;
};

export function TradingPanel({ chartSymbol, chartLast, replayActive, onResult }: Props) {
  const shares = usePaper((s) => s.shares);
  const cash = usePaper((s) => s.cash);
  const startingCash = usePaper((s) => s.startingCash);
  const realizedToday = usePaper((s) => s.realizedToday);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"positions" | "orders">("positions");
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<PlacedOrder[]>([]);

  // Blotter mirror for the Orders tab.
  useEffect(() => {
    setOrders(readBlotter());
    const sync = () => setOrders(readBlotter());
    window.addEventListener(ORDERS_CHANGED, sync);
    return () => window.removeEventListener(ORDERS_CHANGED, sync);
  }, []);

  // Live marks for every symbol we hold. The charted symbol is seeded from the
  // chart's own bars so its row never waits on the poll.
  const heldSyms = Object.keys(shares).sort();
  const heldKey = heldSyms.join(",");
  useEffect(() => {
    if (!heldKey) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/quote-batch?symbols=${encodeURIComponent(heldKey)}`);
        const j = await r.json();
        if (cancelled || !j?.ok || !Array.isArray(j.quotes)) return;
        setMarks((prev) => {
          const next = { ...prev };
          for (const q of j.quotes) if (q?.sym && Number.isFinite(q.last)) next[q.sym] = q.last;
          return next;
        });
      } catch {
        /* keep prior marks on transient failure */
      }
    };
    poll();
    const id = setInterval(poll, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [heldKey]);

  const markOf = (sym: string): number | null => {
    if (sym === chartSymbol && Number.isFinite(chartLast)) return chartLast as number;
    const m = marks[sym];
    return Number.isFinite(m) ? m : null;
  };

  const rows = heldSyms.map((sym) => {
    const pos = shares[sym];
    const mark = markOf(sym);
    return { sym, pos, mark, upnl: mark == null ? null : unrealizedPnl(pos, mark) };
  });

  // Equity marks what it can and carries the rest at cost — same convention as
  // the chain page's portfolio panel.
  const { equity, totalUpnl } = useMemo(() => {
    let eq = cash;
    let u = 0;
    for (const { pos, mark } of rows) {
      eq += pos.qty * (mark ?? pos.avgPrice);
      if (mark != null) u += (mark - pos.avgPrice) * pos.qty;
    }
    return { equity: eq, totalUpnl: u };
  }, [rows, cash]);

  const closePosition = (sym: string) => {
    const pos = shares[sym];
    const mark = markOf(sym);
    if (!pos || mark == null) return;
    const res = placePaperOrder({
      sym,
      side: pos.qty > 0 ? "sell" : "buy",
      type: "market",
      qty: Math.abs(pos.qty),
      price: mark,
    });
    if (!res.ok) {
      onResult(`Close rejected: ${res.error}`, "warn");
      return;
    }
    const pnl = (mark - pos.avgPrice) * pos.qty;
    onResult(`✓ Closed ${sym} — ${pnl >= 0 ? "+" : "−"}$${fmt(Math.abs(pnl), 2)} realized`, pnl >= 0 ? "ok" : "warn");
  };

  const money = (n: number) => `$${fmt(n, 2)}`;
  const signed = (n: number) => (
    <span className={n >= 0 ? "text-bull" : "text-bear"}>
      {n >= 0 ? "+" : "−"}${fmt(Math.abs(n), 2)}
    </span>
  );

  return (
    <div className="border-t border-border bg-bg">
      {/* account strip — always visible, TradingView-style */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 text-fg-dim transition-colors hover:text-fg"
        >
          <span className={`transition-transform ${open ? "rotate-180" : ""}`}>▴</span>
          Trading panel
          {heldSyms.length > 0 && (
            <span className="border border-border px-1 text-[9px] text-fg">{heldSyms.length}</span>
          )}
        </button>
        <span className="text-fg-faint">
          balance <span className="tabular-nums text-fg">{money(cash)}</span>
        </span>
        <span className="text-fg-faint">
          equity <span className="tabular-nums text-fg">{money(equity)}</span>
        </span>
        <span className="text-fg-faint">
          open p&l <span className="tabular-nums">{signed(totalUpnl)}</span>
        </span>
        <span className="text-fg-faint">
          realized today <span className="tabular-nums">{signed(realizedToday)}</span>
        </span>
        <span className="ml-auto hidden text-fg-faint sm:inline">
          paper · started {money(startingCash)}
        </span>
      </div>

      {open && (
        <div className="border-t border-border-soft">
          <div className="flex items-center gap-1 px-3 pt-2">
            {(["positions", "orders"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  tab === t ? "bg-surface text-fg" : "text-fg-faint hover:text-fg-dim"
                }`}
              >
                {t}
                {t === "orders" && orders.length > 0 && <span className="ml-1 text-fg-faint">{orders.length}</span>}
              </button>
            ))}
          </div>

          <div className="max-h-44 overflow-y-auto px-3 pb-2 pt-1">
            {tab === "positions" ? (
              rows.length === 0 ? (
                <div className="py-3 font-mono text-[11px] text-fg-faint">
                  No open positions — use the Buy/Sell buttons on the chart.
                </div>
              ) : (
                <table className="w-full font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="text-left text-[9px] uppercase tracking-wider text-fg-faint">
                      <th className="py-1 pr-3 font-normal">Symbol</th>
                      <th className="pr-3 font-normal">Side</th>
                      <th className="pr-3 text-right font-normal">Qty</th>
                      <th className="pr-3 text-right font-normal">Avg</th>
                      <th className="pr-3 text-right font-normal">Last</th>
                      <th className="pr-3 text-right font-normal">P&L</th>
                      <th className="pr-3 text-right font-normal">Realized</th>
                      <th className="text-right font-normal" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ sym, pos, mark, upnl }) => (
                      <tr key={sym} className="border-t border-border-soft text-fg-dim">
                        <td className="py-1.5 pr-3 text-fg">{sym}</td>
                        <td className={`pr-3 uppercase ${pos.qty > 0 ? "text-bull" : "text-bear"}`}>
                          {pos.qty > 0 ? "long" : "short"}
                        </td>
                        <td className="pr-3 text-right">{fmt(Math.abs(pos.qty), 2)}</td>
                        <td className="pr-3 text-right">{fmt(pos.avgPrice, 2)}</td>
                        <td className="pr-3 text-right">{mark == null ? "—" : fmt(mark, 2)}</td>
                        <td className="pr-3 text-right">{upnl == null ? "—" : signed(upnl)}</td>
                        <td className="pr-3 text-right">{signed(pos.realized)}</td>
                        <td className="text-right">
                          <button
                            onClick={() => closePosition(sym)}
                            disabled={mark == null || replayActive}
                            title={
                              replayActive
                                ? "Exit replay to close"
                                : mark == null
                                  ? "Waiting for a live price"
                                  : "Close at market"
                            }
                            className="border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-fg-dim transition-colors enabled:hover:border-bear enabled:hover:text-bear disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            ✕ close
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : orders.length === 0 ? (
              <div className="py-3 font-mono text-[11px] text-fg-faint">No orders yet.</div>
            ) : (
              <table className="w-full font-mono text-[11px] tabular-nums">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-wider text-fg-faint">
                    <th className="py-1 pr-3 font-normal">Time</th>
                    <th className="pr-3 font-normal">Symbol</th>
                    <th className="pr-3 font-normal">Side</th>
                    <th className="pr-3 font-normal">Type</th>
                    <th className="pr-3 text-right font-normal">Qty</th>
                    <th className="text-right font-normal">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-t border-border-soft text-fg-dim">
                      <td className="py-1.5 pr-3">
                        {new Date(o.ts).toLocaleTimeString("en-US", { hour12: false })}
                      </td>
                      <td className="pr-3 text-fg">{o.sym}</td>
                      <td className={`pr-3 uppercase ${o.side === "buy" ? "text-bull" : "text-bear"}`}>{o.side}</td>
                      <td className="pr-3 uppercase">{o.type}</td>
                      <td className="pr-3 text-right">{fmt(o.qty, 2)}</td>
                      <td className="text-right">{fmt(o.price, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

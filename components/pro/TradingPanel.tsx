"use client";

// The TradingView-style bottom trading panel: an account strip that is always
// visible, plus collapsible Positions / Orders tabs.
//
// Positions span EVERY symbol in the shared paper account, not just the one on
// the chart, so marks for the others come from /api/quote-batch on a 10s poll.
// A row with no live mark yet shows "—" and its close button stays disabled —
// closing a position at a price we do not have would fabricate a fill.

import { useEffect, useMemo, useState } from "react";
import { usePaper, type ClosedTrade } from "@/lib/stores";
import { availableFunds, ordersMargin } from "@/lib/paper-orders";
import { unrealizedPnl } from "@/lib/paper-shares";
import { placePaperOrder } from "@/lib/pro/paper";
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
  const trades = usePaper((s) => s.trades);
  const book = usePaper((s) => s.orders);
  const cancelOrder = usePaper((s) => s.cancelOrder);
  const working = book.filter((o) => o.status === "working");
  const history = book.filter((o) => o.status !== "working");
  const free = availableFunds(cash, book);
  const reserved = ordersMargin(book);
  const setStartingCash = usePaper((s) => s.setStartingCash);
  const resetAccount = usePaper((s) => s.reset);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"positions" | "orders" | "history">("positions");
  const [capitalOpen, setCapitalOpen] = useState(false);
  const [capitalText, setCapitalText] = useState("");
  const [marks, setMarks] = useState<Record<string, number>>({});


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

  const stats = useMemo(() => {
    const n = trades.length;
    if (!n) return { n: 0, winRate: 0, best: 0, worst: 0 };
    const wins = trades.filter((t) => t.pnl > 0).length;
    const pnls = trades.map((t) => t.pnl);
    return { n, winRate: wins / n, best: Math.max(...pnls), worst: Math.min(...pnls) };
  }, [trades]);

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
  // Round BEFORE choosing the sign. The fill price and the mark come from
  // different sources (chart bars vs the quote poll), so a flat position could
  // carry −0.0000001 and render the alarming "−$0.00" in red.
  const signed = (n: number) => {
    const r = Math.abs(n) < 0.005 ? 0 : n;
    return (
      <span className={r > 0 ? "text-bull" : r < 0 ? "text-bear" : "text-fg-dim"}>
        {r >= 0 ? "+" : "−"}${fmt(Math.abs(r), 2)}
      </span>
    );
  };

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
        <span className="text-fg-faint">
          available <span className="tabular-nums text-fg">{money(free)}</span>
        </span>
        {reserved > 0 && (
          <span className="text-fg-faint">
            orders margin <span className="tabular-nums text-amber">{money(reserved)}</span>
          </span>
        )}
        <span className="ml-auto flex items-center gap-2 text-fg-faint">
          <span className="hidden sm:inline">paper</span>
          <button
            onClick={() => {
              setCapitalText(String(Math.round(startingCash)));
              setCapitalOpen((v) => !v);
            }}
            aria-expanded={capitalOpen}
            className="border border-border px-1.5 py-0.5 uppercase tracking-wider transition-colors hover:border-fg-dim hover:text-fg"
            title="Set starting capital or reset the account"
          >
            capital {money(startingCash)}
          </button>
        </span>
      </div>

      {capitalOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border-soft bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
          <label className="flex items-center gap-1.5 text-fg-faint">
            starting capital
            <span className="text-fg-dim">$</span>
            <input
              value={capitalText}
              onChange={(e) => setCapitalText(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              aria-label="Starting capital in dollars"
              className="w-24 border border-border bg-bg px-1.5 py-0.5 text-right tabular-nums text-fg outline-none"
            />
          </label>
          <button
            onClick={() => {
              const n = parseFloat(capitalText);
              if (!Number.isFinite(n) || n <= 0) {
                onResult("Starting capital must be above 0", "warn");
                return;
              }
              setStartingCash(n);
              setCapitalOpen(false);
              onResult(`Account restarted at $${fmt(n, 2)}`, "ok");
            }}
            className="border border-bull/50 px-2 py-0.5 text-bull transition-colors hover:bg-bull hover:text-bg"
          >
            set &amp; restart
          </button>
          <button
            onClick={() => {
              resetAccount();
              setCapitalOpen(false);
              onResult(`Account reset to $${fmt(startingCash, 2)}`, "ok");
            }}
            className="border border-border px-2 py-0.5 text-fg-dim transition-colors hover:border-bear hover:text-bear"
          >
            reset to {money(startingCash)}
          </button>
          {/* Both actions wipe positions and history — say so before the click. */}
          <span className="text-fg-faint normal-case">
            Clears all positions, orders and trade history.
          </span>
        </div>
      )}

      {open && (
        <div className="border-t border-border-soft">
          <div className="flex items-center gap-1 px-3 pt-2">
            {(["positions", "orders", "history"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
                  tab === t ? "bg-surface text-fg" : "text-fg-faint hover:text-fg-dim"
                }`}
              >
                {t}
                {t === "orders" && working.length > 0 && <span className="ml-1 text-bull">{working.length}</span>}
                {t === "history" && trades.length > 0 && <span className="ml-1 text-fg-faint">{trades.length}</span>}
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
            ) : tab === "history" ? (
              trades.length === 0 ? (
                <div className="py-3 font-mono text-[11px] text-fg-faint">
                  No closed trades yet — your realized P&L will appear here once you close a position.
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Realized equity curve: startingCash plus cumulative realized
                      P&L, oldest to newest. Unrealized is deliberately excluded —
                      a curve that moves with open positions is a mark, not a
                      track record. */}
                  <EquityCurve startingCash={startingCash} trades={trades} />
                  <div className="grid grid-cols-4 gap-px bg-border-soft">
                    {[
                      { k: "Trades", v: String(stats.n), c: "text-fg" },
                      { k: "Win rate", v: stats.n ? `${Math.round(stats.winRate * 100)}%` : "—", c: stats.winRate >= 0.5 ? "text-bull" : "text-amber" },
                      { k: "Best", v: stats.n ? `+$${fmt(stats.best, 2)}` : "—", c: "text-bull" },
                      { k: "Worst", v: stats.n ? `−$${fmt(Math.abs(stats.worst), 2)}` : "—", c: "text-bear" },
                    ].map((x) => (
                      <div key={x.k} className="bg-bg p-1.5">
                        <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">{x.k}</div>
                        <div className={`font-mono text-[11px] tabular-nums ${x.c}`}>{x.v}</div>
                      </div>
                    ))}
                  </div>
                  <table className="w-full font-mono text-[11px] tabular-nums">
                    <thead>
                      <tr className="text-left text-[9px] uppercase tracking-wider text-fg-faint">
                        <th className="py-1 pr-3 font-normal">Closed</th>
                        <th className="pr-3 font-normal">Symbol</th>
                        <th className="pr-3 font-normal">Side</th>
                        <th className="pr-3 text-right font-normal">Qty</th>
                        <th className="pr-3 text-right font-normal">Entry</th>
                        <th className="pr-3 text-right font-normal">Exit</th>
                        <th className="pr-3 text-right font-normal">P&L</th>
                        <th className="text-right font-normal">Return</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((t) => {
                        const basis = Math.abs(t.entry * t.qty);
                        const ret = basis > 0 ? t.pnl / basis : 0;
                        return (
                          <tr key={t.id} className="border-t border-border-soft text-fg-dim">
                            <td className="py-1.5 pr-3">
                              {new Date(t.closedAt).toLocaleTimeString("en-US", { hour12: false })}
                            </td>
                            <td className="pr-3 text-fg">{t.sym}</td>
                            <td className={`pr-3 uppercase ${t.side === "long" ? "text-bull" : "text-bear"}`}>{t.side}</td>
                            <td className="pr-3 text-right">{fmt(t.qty, 2)}</td>
                            <td className="pr-3 text-right">{fmt(t.entry, 2)}</td>
                            <td className="pr-3 text-right">{fmt(t.exit, 2)}</td>
                            <td className="pr-3 text-right">{signed(t.pnl)}</td>
                            <td className={`text-right ${ret >= 0 ? "text-bull" : "text-bear"}`}>
                              {ret >= 0 ? "+" : "−"}
                              {(Math.abs(ret) * 100).toFixed(2)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : working.length === 0 && history.length === 0 ? (
              <div className="py-3 font-mono text-[11px] text-fg-faint">
                No orders yet — place a limit or stop from the order panel and it will rest here until price reaches it.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="pb-1 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                    working · {working.length}
                  </div>
                  {working.length === 0 ? (
                    <div className="py-1 font-mono text-[11px] text-fg-faint">Nothing resting.</div>
                  ) : (
                    <table className="w-full font-mono text-[11px] tabular-nums">
                      <thead>
                        <tr className="text-left text-[9px] uppercase tracking-wider text-fg-faint">
                          <th className="py-1 pr-3 font-normal">Symbol</th>
                          <th className="pr-3 font-normal">Side</th>
                          <th className="pr-3 font-normal">Type</th>
                          <th className="pr-3 text-right font-normal">Qty</th>
                          <th className="pr-3 text-right font-normal">Price</th>
                          <th className="pr-3 font-normal">TIF</th>
                          <th className="text-right font-normal" />
                        </tr>
                      </thead>
                      <tbody>
                        {working.map((o) => (
                          <tr key={o.id} className="border-t border-border-soft text-fg-dim">
                            <td className="py-1.5 pr-3 text-fg">{o.sym}</td>
                            <td className={`pr-3 uppercase ${o.side === "buy" ? "text-bull" : "text-bear"}`}>{o.side}</td>
                            <td className="pr-3 uppercase">
                              {o.reduceOnly ? (o.type === "limit" ? "take profit" : "stop loss") : o.type}
                            </td>
                            <td className="pr-3 text-right">{fmt(o.qty, 2)}</td>
                            <td className="pr-3 text-right">{fmt((o.type === "limit" ? o.limitPrice : o.stopPrice) ?? 0, 2)}</td>
                            <td className="pr-3 uppercase">{o.tif}</td>
                            <td className="text-right">
                              <button
                                onClick={() => {
                                  cancelOrder(o.id);
                                  onResult(`Cancelled ${o.side} ${o.sym}`, "ok");
                                }}
                                className="border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-fg-dim transition-colors hover:border-bear hover:text-bear"
                              >
                                ✕ cancel
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {history.length > 0 && (
                  <div>
                    <div className="pb-1 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                      order history · {history.length}
                    </div>
                    <table className="w-full font-mono text-[11px] tabular-nums">
                      <thead>
                        <tr className="text-left text-[9px] uppercase tracking-wider text-fg-faint">
                          <th className="py-1 pr-3 font-normal">Time</th>
                          <th className="pr-3 font-normal">Symbol</th>
                          <th className="pr-3 font-normal">Side</th>
                          <th className="pr-3 font-normal">Type</th>
                          <th className="pr-3 text-right font-normal">Qty</th>
                          <th className="pr-3 text-right font-normal">Price</th>
                          <th className="font-normal">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.slice(0, 40).map((o) => (
                          <tr key={o.id} className="border-t border-border-soft text-fg-dim">
                            <td className="py-1.5 pr-3">
                              {new Date(o.filledAt ?? o.placedAt).toLocaleTimeString("en-US", { hour12: false })}
                            </td>
                            <td className="pr-3 text-fg">{o.sym}</td>
                            <td className={`pr-3 uppercase ${o.side === "buy" ? "text-bull" : "text-bear"}`}>{o.side}</td>
                            <td className="pr-3 uppercase">{o.type}</td>
                            <td className="pr-3 text-right">{fmt(o.qty, 2)}</td>
                            <td className="pr-3 text-right">
                              {fmt(o.fillPrice ?? (o.type === "limit" ? o.limitPrice : o.stopPrice) ?? 0, 2)}
                            </td>
                            <td
                              className={`uppercase ${
                                o.status === "filled" ? "text-bull" : o.status === "rejected" ? "text-bear" : "text-fg-faint"
                              }`}
                              title={o.note}
                            >
                              {o.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Realized equity curve. Plots startingCash + cumulative realized P&L, oldest
 * to newest — deliberately excluding open positions, because a line that moves
 * with unrealized marks is a snapshot of sentiment rather than a track record.
 */
function EquityCurve({ startingCash, trades }: { startingCash: number; trades: ClosedTrade[] }) {
  const pts = useMemo(() => {
    const chronological = [...trades].reverse(); // store keeps newest first
    let eq = startingCash;
    const out = [eq];
    for (const t of chronological) {
      eq += t.pnl;
      out.push(eq);
    }
    return out;
  }, [trades, startingCash]);

  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const W = 300;
  const H = 44;
  const d = pts
    .map((v, i) => `${((i / (pts.length - 1)) * W).toFixed(1)},${(H - ((v - min) / range) * H).toFixed(1)}`)
    .join(" L");
  const last = pts[pts.length - 1];
  const up = last >= startingCash;
  const c = up ? "var(--bull)" : "var(--bear)";
  const baseY = H - ((startingCash - min) / range) * H;

  return (
    <div className="flex items-center gap-3 border border-border-soft bg-surface p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-11 flex-1" preserveAspectRatio="none" aria-hidden>
        {/* starting-capital baseline, so above/below the line is readable at a glance */}
        <line x1={0} x2={W} y1={baseY} y2={baseY} stroke="var(--fg-faint)" strokeDasharray="3 4" strokeOpacity={0.5} />
        <path d={`M${d}`} fill="none" stroke={c} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="shrink-0 font-mono">
        <div className="text-[9px] uppercase tracking-wider text-fg-faint">realized equity</div>
        <div className={`text-sm tabular-nums ${up ? "text-bull" : "text-bear"}`}>
          ${fmt(last, 2)}
        </div>
        <div className={`text-[10px] tabular-nums ${up ? "text-bull" : "text-bear"}`}>
          {up ? "+" : "−"}
          {(Math.abs((last - startingCash) / (startingCash || 1)) * 100).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

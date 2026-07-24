"use client";

// The paper-trading panel: a six-metric account strip that is always visible,
// plus Positions / Orders / Order history / Balance history / Trading journal.
//
// Positions span EVERY symbol in the shared account, not just the charted one,
// so marks for the others come from /api/quote-batch on a 10s poll. A row with
// no live mark shows "—" and its close button stays disabled: closing at a
// price we do not have would fabricate a fill.

import { useEffect, useMemo, useRef, useState } from "react";
import { usePaper, type BalanceEntry, type ClosedTrade } from "@/lib/stores";
import { accountMetrics, protectionFor, toCsv } from "@/lib/paper-metrics";
import { placePaperOrder } from "@/lib/pro/paper";
import { ResetFundsModal } from "@/components/ResetFundsModal";
import { RollingNumber } from "./RollingNumber";
import { fmt } from "./chartCore";

type Props = {
  /** Live last for the charted symbol — seeds its mark without waiting for the poll. */
  chartSymbol: string;
  chartLast: number | null;
  /** Replay rewrites the chart's clock; closing at replay prices would lie. */
  replayActive: boolean;
  onResult: (msg: string, tone?: "ok" | "warn") => void;
};

type Tab = "positions" | "orders" | "orderHistory" | "balance" | "journal";
const TAB_LABEL: Record<Tab, string> = {
  positions: "Positions",
  orders: "Orders",
  orderHistory: "Order history",
  balance: "Balance history",
  journal: "Trading journal",
};

export function TradingPanel({ chartSymbol, chartLast, replayActive, onResult }: Props) {
  const shares = usePaper((s) => s.shares);
  const cash = usePaper((s) => s.cash);
  const startingCash = usePaper((s) => s.startingCash);
  const realizedToday = usePaper((s) => s.realizedToday);
  const trades = usePaper((s) => s.trades);
  const book = usePaper((s) => s.orders);
  const balanceLog = usePaper((s) => s.balanceLog);
  const journal = usePaper((s) => s.journal);
  const cancelOrder = usePaper((s) => s.cancelOrder);
  const setJournalNote = usePaper((s) => s.setJournalNote);
  const submitOrder = usePaper((s) => s.submitOrder);
  const setStartingCash = usePaper((s) => s.setStartingCash);
  const resetAccount = usePaper((s) => s.reset);
  const optionBets = usePaper((s) => s.positions);

  // A real sub-window: a title bar that stays put, a body that can be
  // minimized away or expanded, and a draggable top edge to size it.
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [bodyH, setBodyH] = useState(208);
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null);
  const [tab, setTab] = useState<Tab>("positions");
  const [capitalOpen, setCapitalOpen] = useState(false);
  const [capitalText, setCapitalText] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<{ sym: string; tp: string; sl: string } | null>(null);

  const working = book.filter((o) => o.status === "working");
  const orderHistory = book.filter((o) => o.status !== "working");

  // Live marks for every symbol we hold. The charted symbol is seeded from the
  // chart's own bars so its row never waits on the poll.
  const heldSyms = useMemo(() => Object.keys(shares).sort(), [shares]);
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

  /** Marks including the chart's own symbol, which is fresher than the poll. */
  const allMarks = useMemo(() => {
    const m = { ...marks };
    if (chartSymbol && Number.isFinite(chartLast) && (chartLast as number) > 0) m[chartSymbol] = chartLast as number;
    return m;
  }, [marks, chartSymbol, chartLast]);

  // Open option bets carried at cost — they share this cash balance, so
  // leaving them out made every bet read as an instant loss of its premium.
  const openBetCost = useMemo(
    () => optionBets.reduce((a, p) => (p.status === "open" ? a + p.cost : a), 0),
    [optionBets]
  );

  const metrics = useMemo(
    () => accountMetrics({ cash, realizedToday, shares, orders: book, marks: allMarks, openBetCost }),
    [cash, realizedToday, shares, book, allMarks, openBetCost]
  );

  const markOf = (sym: string): number | null => {
    const m = allMarks[sym];
    return Number.isFinite(m) && m > 0 ? m : null;
  };

  const rows = heldSyms.map((sym) => {
    const pos = shares[sym];
    const mark = markOf(sym);
    const prot = protectionFor(sym, book);
    return {
      sym,
      pos,
      mark,
      ...prot,
      upnl: mark == null ? null : (mark - pos.avgPrice) * pos.qty,
    };
  });

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

  /** Replace a position's protective orders with new ones. */
  const applyProtection = (sym: string, tpText: string, slText: string) => {
    const pos = shares[sym];
    if (!pos) return;
    const tp = parseFloat(tpText);
    const sl = parseFloat(slText);
    // Cancel the existing exits first, so we never end up with two take
    // profits racing each other on the same position.
    for (const o of book) {
      if (o.status === "working" && o.sym === sym && o.reduceOnly) cancelOrder(o.id);
    }
    const exitSide = pos.qty > 0 ? "sell" : "buy";
    let placed = 0;
    if (Number.isFinite(tp) && tp > 0) {
      const r = submitOrder({
        sym, side: exitSide, type: "limit", qty: Math.abs(pos.qty),
        limitPrice: tp, tif: "gtc", reduceOnly: true, parentId: `manual-${sym}`,
      });
      if (r.ok) placed++;
      else onResult(`Take profit rejected: ${r.error}`, "warn");
    }
    if (Number.isFinite(sl) && sl > 0) {
      const r = submitOrder({
        sym, side: exitSide, type: "stop", qty: Math.abs(pos.qty),
        stopPrice: sl, tif: "gtc", reduceOnly: true, parentId: `manual-${sym}`,
      });
      if (r.ok) placed++;
      else onResult(`Stop loss rejected: ${r.error}`, "warn");
    }
    setEditing(null);
    if (placed) onResult(`Protection updated on ${sym}`, "ok");
  };

  const exportCsv = () => {
    let headers: string[] = [];
    let data: (string | number)[][] = [];
    const stamp = (ts: number) => new Date(ts).toISOString();
    if (tab === "positions") {
      headers = ["Symbol", "Side", "Quantity", "Avg fill price", "Take profit", "Stop loss", "Last", "Unrealized"];
      data = rows.map((r) => [
        r.sym, r.pos.qty > 0 ? "Long" : "Short", Math.abs(r.pos.qty), r.pos.avgPrice,
        r.takeProfit ?? "", r.stopLoss ?? "", r.mark ?? "", r.upnl ?? "",
      ]);
    } else if (tab === "orders" || tab === "orderHistory") {
      const src = tab === "orders" ? working : orderHistory;
      headers = ["Time", "Symbol", "Side", "Type", "Qty", "Price", "TIF", "Status", "Note"];
      data = src.map((o) => [
        stamp(o.filledAt ?? o.placedAt), o.sym, o.side, o.type, o.qty,
        o.fillPrice ?? (o.type === "limit" ? o.limitPrice : o.stopPrice) ?? "", o.tif, o.status, o.note ?? "",
      ]);
    } else if (tab === "balance") {
      headers = ["Time", "Kind", "Symbol", "Amount", "Balance", "Note"];
      data = balanceLog.map((b) => [stamp(b.ts), b.kind, b.sym ?? "", b.amount, b.balance, b.note]);
    } else {
      headers = ["Closed", "Symbol", "Side", "Qty", "Entry", "Exit", "P&L", "Note"];
      data = trades.map((t) => [
        stamp(t.closedAt), t.sym, t.side, t.qty, t.entry, t.exit, t.pnl, journal[t.id] ?? "",
      ]);
    }
    const blob = new Blob([toCsv(headers, data)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lazybull-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Drag the window's top edge to resize. Listeners live on window so the
  // pointer can leave the 4px handle mid-drag without the resize dying.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    resizeRef.current = { startY: e.clientY, startH: bodyH };
    const onMove = (ev: PointerEvent) => {
      const r = resizeRef.current;
      if (!r) return;
      // Dragging UP grows the panel, so the delta is inverted.
      setBodyH(Math.max(120, Math.min(560, r.startH + (r.startY - ev.clientY))));
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const money = (n: number) => `$${fmt(n, 2)}`;
  // Round BEFORE choosing the sign. The fill price and the mark come from
  // different sources, so a flat position could carry −0.0000001 and render
  // the alarming "−$0.00" in red.
  const signed = (n: number) => {
    const r = Math.abs(n) < 0.005 ? 0 : n;
    return (
      <span className={r > 0 ? "text-bull" : r < 0 ? "text-bear" : "text-fg-dim"}>
        {r >= 0 ? "+" : "−"}${fmt(Math.abs(r), 2)}
      </span>
    );
  };

  const th = "pr-3 py-1 text-left font-normal";
  const td = "py-1.5 pr-3";

  return (
    <div className="flex flex-col border-t border-border bg-surface">
      {/* draggable top edge */}
      {open && (
        <div
          onPointerDown={startResize}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize the paper trading window"
          className="h-1 shrink-0 cursor-ns-resize bg-transparent transition-colors hover:bg-bull/40"
        />
      )}

      {/* title bar — always visible, like a docked window's chrome */}
      {/* pr-16: keep RESET FUNDS and the window controls clear of the docked
          mic pinned at bottom-right by the Dock (components/Dock.tsx). */}
      <div className="flex items-center gap-2 border-b border-border-soft bg-surface px-3 pr-16 py-1.5">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-fg transition-colors hover:text-bull"
        >
          <span className="grid size-4 place-items-center border border-bull/50 text-[10px] font-bold text-bull">LB</span>
          Paper Trading
          <span className={`text-fg-faint transition-transform ${open ? "" : "rotate-180"}`}>⌄</span>
        </button>

        {/* collapsed summary, so the bar is useful even when minimized. The
            money ROLLS between values (beat 3 of the fill ritual) — a fill
            should read as movement, not a silent mutation. */}
        {!open && (
          <span className="flex flex-wrap items-center gap-x-4 font-mono text-[10px] uppercase tracking-wider">
            <Metric k="Equity" node={<RollingNumber value={metrics.equity} format={money} />} />
            <Metric
              k="P&L"
              node={(() => {
                const pnl = metrics.realizedPnl + metrics.unrealizedPnl;
                const r = Math.abs(pnl) < 0.005 ? 0 : pnl;
                return (
                  <span className={r > 0 ? "text-bull" : r < 0 ? "text-bear" : "text-fg-dim"}>
                    <RollingNumber value={r} format={(n) => `${n >= 0 ? "+" : "−"}$${fmt(Math.abs(n), 2)}`} />
                  </span>
                );
              })()}
            />
            {rows.length > 0 && <Metric k="Positions" v={String(rows.length)} />}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <a
            href="/portfolio"
            className="border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-dim transition-colors hover:border-fg-dim hover:text-fg"
            title="Full portfolio — positions, history, wagered, ledger"
          >
            portfolio ↗
          </a>
          <button
            onClick={() => setResetOpen(true)}
            className="border border-bull/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-bull transition-colors hover:bg-bull hover:text-bg"
            title={`Reset to ${money(startingCash)} — wipes the ENTIRE portfolio (full warning before anything happens)`}
          >
            ↺ reset funds
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Minimize paper trading"
            title="Minimize"
            className="px-1 font-mono text-[13px] leading-none text-fg-faint transition-colors hover:text-fg"
          >
            —
          </button>
          <button
            onClick={() => {
              setOpen(true);
              setMaximized((v) => !v);
            }}
            aria-label={maximized ? "Restore paper trading" : "Maximize paper trading"}
            title={maximized ? "Restore" : "Maximize"}
            className="px-1 font-mono text-[11px] leading-none text-fg-faint transition-colors hover:text-fg"
          >
            {maximized ? "❐" : "⛶"}
          </button>
        </div>
      </div>

      {open && (
        <>
          {/* account selector row */}
          <div className="flex items-center gap-2 px-3 pt-2">
            <button
              onClick={() => {
                setCapitalText(String(Math.round(startingCash)));
                setCapitalOpen((v) => !v);
              }}
              aria-expanded={capitalOpen}
              className="flex items-center gap-1.5 border border-border bg-surface px-2 py-1 font-mono text-[11px] text-fg transition-colors hover:border-fg-dim"
              title="Change the starting capital"
            >
              lazybull paper <span className="text-fg-faint">USD</span>
              <span className="text-fg-faint">⌄</span>
            </button>
            <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              started {money(startingCash)}
            </span>
          </div>

          {capitalOpen && (
            <div className="mx-3 mt-2 flex flex-wrap items-center gap-2 border border-border bg-surface px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
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
              <span className="normal-case text-fg-faint">Clears all positions, orders and history.</span>
            </div>
          )}

          {/* metrics grid — label above value, two rows, like a broker's summary */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 px-3 pb-2 pt-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat k="Account balance" v={money(metrics.balance)} />
            <Stat k="Equity" v={money(metrics.equity)} />
            <Stat k="Realized P&L" node={signed(metrics.realizedPnl)} />
            <Stat k="Unrealized P&L" node={signed(metrics.unrealizedPnl)} />
            <Stat k="Account margin" v={money(metrics.accountMargin)} />
            <Stat k="Available funds" v={money(metrics.availableFunds)} tone={metrics.availableFunds < 0 ? "text-bear" : undefined} />
            <Stat k="Orders margin" v={money(metrics.ordersMargin)} tone={metrics.ordersMargin > 0 ? "text-amber" : undefined} />
            <Stat
              k="Margin buffer"
              v={`${(metrics.marginBuffer * 100).toFixed(2)}%`}
              tone={metrics.marginBuffer < 0.2 ? "text-bear" : undefined}
            />
            {metrics.unmarkedCount > 0 && (
              <Stat
                k="Valued at cost"
                v={`${metrics.unmarkedCount} position${metrics.unmarkedCount > 1 ? "s" : ""}`}
                tone="text-fg-faint"
              />
            )}
          </div>

          <div className="flex items-center gap-1 px-3 pt-2">
            {(Object.keys(TAB_LABEL) as Tab[]).map((t) => {
              const count =
                t === "positions" ? rows.length : t === "orders" ? working.length : t === "journal" ? trades.length : 0;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-wider transition-colors ${
                    tab === t ? "bg-surface text-fg" : "text-fg-faint hover:text-fg-dim"
                  }`}
                >
                  {TAB_LABEL[t]}
                  {count > 0 && <span className="ml-1.5 text-fg-faint">{count}</span>}
                </button>
              );
            })}
            <button
              onClick={exportCsv}
              aria-label="Export this tab as CSV"
              title="Export CSV"
              className="ml-auto px-2 py-1 font-mono text-[13px] text-fg-faint transition-colors hover:text-fg"
            >
              ↓
            </button>
          </div>

          <div
            className="overflow-y-auto px-3 pb-2 pt-1"
            style={{ height: maximized ? "min(60vh, 560px)" : bodyH }}
          >
            {tab === "positions" &&
              (rows.length === 0 ? (
                <Empty>No open positions — buy or sell from the order panel.</Empty>
              ) : (
                <table className="w-full font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-fg-faint">
                      <th className={th}>Symbol</th>
                      <th className={th}>Side</th>
                      <th className={`${th} text-right`}>Quantity</th>
                      <th className={`${th} text-right`}>Avg fill price</th>
                      <th className={`${th} text-right`}>Take profit</th>
                      <th className={`${th} text-right`}>Stop loss</th>
                      <th className={`${th} text-right`}>Last price</th>
                      <th className={`${th} text-right`}>Unrealized</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isEditing = editing?.sym === r.sym;
                      return (
                        <tr key={r.sym} className="border-t border-border-soft text-fg-dim">
                          <td className={`${td} text-fg`}>
                            <span className="mr-1.5 border border-border px-1 text-[10px] text-fg-faint">
                              {r.pos.qty > 0 ? "LONG" : "SHORT"}
                            </span>
                            {r.sym}
                          </td>
                          <td className={`${td} uppercase ${r.pos.qty > 0 ? "text-bull" : "text-bear"}`}>
                            {r.pos.qty > 0 ? "Long" : "Short"}
                          </td>
                          <td className={`${td} text-right`}>{fmt(Math.abs(r.pos.qty), 2)}</td>
                          <td className={`${td} text-right`}>{fmt(r.pos.avgPrice, 2)}</td>
                          <td className={`${td} text-right`}>
                            {isEditing ? (
                              <input
                                value={editing!.tp}
                                onChange={(e) => setEditing({ ...editing!, tp: e.target.value.replace(/[^\d.]/g, "") })}
                                aria-label={`Take profit for ${r.sym}`}
                                className="w-16 border border-border bg-bg px-1 text-right text-cyan outline-none"
                              />
                            ) : r.takeProfit != null ? (
                              <span className="text-cyan">{fmt(r.takeProfit, 2)}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={`${td} text-right`}>
                            {isEditing ? (
                              <input
                                value={editing!.sl}
                                onChange={(e) => setEditing({ ...editing!, sl: e.target.value.replace(/[^\d.]/g, "") })}
                                aria-label={`Stop loss for ${r.sym}`}
                                className="w-16 border border-border bg-bg px-1 text-right text-amber outline-none"
                              />
                            ) : r.stopLoss != null ? (
                              <span className="text-amber">{fmt(r.stopLoss, 2)}</span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={`${td} text-right`}>{r.mark == null ? "—" : fmt(r.mark, 2)}</td>
                          <td className={`${td} text-right`}>{r.upnl == null ? "—" : signed(r.upnl)}</td>
                          <td className={`${td} text-right whitespace-nowrap`}>
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => applyProtection(r.sym, editing!.tp, editing!.sl)}
                                  className="mr-1 border border-bull/50 px-1.5 text-[10px] text-bull hover:bg-bull hover:text-bg"
                                >
                                  save
                                </button>
                                <button
                                  onClick={() => setEditing(null)}
                                  className="border border-border px-1.5 text-[10px] text-fg-faint hover:text-fg"
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    setEditing({
                                      sym: r.sym,
                                      tp: r.takeProfit != null ? String(r.takeProfit) : "",
                                      sl: r.stopLoss != null ? String(r.stopLoss) : "",
                                    })
                                  }
                                  aria-label={`Edit protection for ${r.sym}`}
                                  title="Set take profit / stop loss"
                                  className="mr-2 text-fg-faint transition-colors hover:text-fg"
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() => closePosition(r.sym)}
                                  disabled={r.mark == null || replayActive}
                                  aria-label={`Close ${r.sym}`}
                                  title={
                                    replayActive ? "Exit replay to close" : r.mark == null ? "Waiting for a live price" : "Close at market"
                                  }
                                  className="text-fg-faint transition-colors enabled:hover:text-bear disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  ✕
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ))}

            {tab === "orders" &&
              (working.length === 0 ? (
                <Empty>Nothing resting — a limit or stop order will wait here until price reaches it.</Empty>
              ) : (
                <table className="w-full font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-fg-faint">
                      <th className={th}>Symbol</th>
                      <th className={th}>Side</th>
                      <th className={th}>Type</th>
                      <th className={`${th} text-right`}>Qty</th>
                      <th className={`${th} text-right`}>Price</th>
                      <th className={th}>TIF</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {working.map((o) => (
                      <tr key={o.id} className="border-t border-border-soft text-fg-dim">
                        <td className={`${td} text-fg`}>{o.sym}</td>
                        <td className={`${td} uppercase ${o.side === "buy" ? "text-bull" : "text-bear"}`}>{o.side}</td>
                        <td className={`${td} uppercase`}>
                          {o.reduceOnly ? (o.type === "limit" ? "take profit" : "stop loss") : o.type}
                        </td>
                        <td className={`${td} text-right`}>{fmt(o.qty, 2)}</td>
                        <td className={`${td} text-right`}>{fmt((o.type === "limit" ? o.limitPrice : o.stopPrice) ?? 0, 2)}</td>
                        <td className={`${td} uppercase`}>{o.tif}</td>
                        <td className={`${td} text-right`}>
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
              ))}

            {tab === "orderHistory" &&
              (orderHistory.length === 0 ? (
                <Empty>No completed orders yet.</Empty>
              ) : (
                <table className="w-full font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-fg-faint">
                      <th className={th}>Time</th>
                      <th className={th}>Symbol</th>
                      <th className={th}>Side</th>
                      <th className={th}>Type</th>
                      <th className={`${th} text-right`}>Qty</th>
                      <th className={`${th} text-right`}>Price</th>
                      <th className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderHistory.slice(0, 60).map((o) => (
                      <tr key={o.id} className="border-t border-border-soft text-fg-dim">
                        <td className={td}>{new Date(o.filledAt ?? o.placedAt).toLocaleTimeString("en-US", { hour12: false })}</td>
                        <td className={`${td} text-fg`}>{o.sym}</td>
                        <td className={`${td} uppercase ${o.side === "buy" ? "text-bull" : "text-bear"}`}>{o.side}</td>
                        <td className={`${td} uppercase`}>{o.type}</td>
                        <td className={`${td} text-right`}>{fmt(o.qty, 2)}</td>
                        <td className={`${td} text-right`}>
                          {fmt(o.fillPrice ?? (o.type === "limit" ? o.limitPrice : o.stopPrice) ?? 0, 2)}
                        </td>
                        <td
                          className={`${td} uppercase ${
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
              ))}

            {tab === "balance" &&
              (balanceLog.length === 0 ? (
                <Empty>No cash movements yet.</Empty>
              ) : (
                <table className="w-full font-mono text-[11px] tabular-nums">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-fg-faint">
                      <th className={th}>Time</th>
                      <th className={th}>Type</th>
                      <th className={th}>Detail</th>
                      <th className={`${th} text-right`}>Amount</th>
                      <th className={`${th} text-right`}>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balanceLog.slice(0, 80).map((b: BalanceEntry) => (
                      <tr key={b.id} className="border-t border-border-soft text-fg-dim">
                        <td className={td}>{new Date(b.ts).toLocaleTimeString("en-US", { hour12: false })}</td>
                        <td className={`${td} uppercase`}>{b.kind}</td>
                        <td className={td}>{b.note}</td>
                        <td className={`${td} text-right`}>{signed(b.amount)}</td>
                        <td className={`${td} text-right text-fg`}>{money(b.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}

            {tab === "journal" &&
              (trades.length === 0 ? (
                <Empty>No closed trades yet — your realized P&L and notes will appear here.</Empty>
              ) : (
                <div className="space-y-2">
                  <EquityCurve startingCash={startingCash} trades={trades} />
                  <div className="grid grid-cols-4 gap-px bg-border-soft">
                    {[
                      { k: "Trades", v: String(stats.n), c: "text-fg" },
                      { k: "Win rate", v: stats.n ? `${Math.round(stats.winRate * 100)}%` : "—", c: stats.winRate >= 0.5 ? "text-bull" : "text-amber" },
                      { k: "Best", v: stats.n ? `+$${fmt(stats.best, 2)}` : "—", c: "text-bull" },
                      { k: "Worst", v: stats.n ? `−$${fmt(Math.abs(stats.worst), 2)}` : "—", c: "text-bear" },
                    ].map((x) => (
                      <div key={x.k} className="bg-bg p-1.5">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">{x.k}</div>
                        <div className={`font-mono text-[11px] tabular-nums ${x.c}`}>{x.v}</div>
                      </div>
                    ))}
                  </div>
                  <table className="w-full font-mono text-[11px] tabular-nums">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-wider text-fg-faint">
                        <th className={th}>Closed</th>
                        <th className={th}>Symbol</th>
                        <th className={th}>Side</th>
                        <th className={`${th} text-right`}>Qty</th>
                        <th className={`${th} text-right`}>Entry</th>
                        <th className={`${th} text-right`}>Exit</th>
                        <th className={`${th} text-right`}>P&L</th>
                        <th className={`${th} text-right`}>Return</th>
                        <th className={th}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((t) => {
                        const basis = Math.abs(t.entry * t.qty);
                        const ret = basis > 0 ? t.pnl / basis : 0;
                        return (
                          <tr key={t.id} className="border-t border-border-soft text-fg-dim">
                            <td className={td}>{new Date(t.closedAt).toLocaleTimeString("en-US", { hour12: false })}</td>
                            <td className={`${td} text-fg`}>{t.sym}</td>
                            <td className={`${td} uppercase ${t.side === "long" ? "text-bull" : "text-bear"}`}>{t.side}</td>
                            <td className={`${td} text-right`}>{fmt(t.qty, 2)}</td>
                            <td className={`${td} text-right`}>{fmt(t.entry, 2)}</td>
                            <td className={`${td} text-right`}>{fmt(t.exit, 2)}</td>
                            <td className={`${td} text-right`}>{signed(t.pnl)}</td>
                            <td className={`${td} text-right ${ret >= 0 ? "text-bull" : "text-bear"}`}>
                              {ret >= 0 ? "+" : "−"}
                              {(Math.abs(ret) * 100).toFixed(2)}%
                            </td>
                            <td className={td}>
                              <input
                                defaultValue={journal[t.id] ?? ""}
                                onBlur={(e) => setJournalNote(t.id, e.target.value)}
                                placeholder="why did you take it?"
                                aria-label={`Journal note for ${t.sym}`}
                                className="w-40 border border-transparent bg-transparent px-1 text-fg-dim outline-none placeholder:text-fg-faint/60 hover:border-border focus:border-border focus:text-fg"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
          </div>
        </>
      )}

      <ResetFundsModal
        open={resetOpen}
        onCancel={() => setResetOpen(false)}
        onConfirm={() => {
          resetAccount();
          // Also drop the saved workspace. A stray click on the layout
          // control persists x2/x4 forever and reads as "buying opened a
          // new chart", with no obvious way back.
          try {
            localStorage.removeItem("lb-pro-workspace");
          } catch {
            /* storage unavailable — the account still reset */
          }
          setResetOpen(false);
          onResult(`Portfolio wiped — fresh start at ${money(usePaper.getState().startingCash)} · workspace cleared`, "ok");
        }}
      />
    </div>
  );
}

/** Label above value — the broker-summary reading order, for the metrics grid. */
function Stat({ k, v, node, tone }: { k: string; v?: string; node?: React.ReactNode; tone?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-fg-faint">{k}</div>
      <div className={`font-mono text-[13px] tabular-nums ${tone ?? "text-fg"}`}>{node ?? v}</div>
    </div>
  );
}

/** Inline label·value, for the collapsed title-bar summary. */
function Metric({ k, v, node, tone }: { k: string; v?: string; node?: React.ReactNode; tone?: string }) {
  return (
    <span className="text-fg-faint">
      {k} <span className={`tabular-nums ${tone ?? "text-fg"}`}>{node ?? v}</span>
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-3 font-mono text-[11px] text-fg-faint">{children}</div>;
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
        <line x1={0} x2={W} y1={baseY} y2={baseY} stroke="var(--fg-faint)" strokeDasharray="3 4" strokeOpacity={0.5} />
        <path d={`M${d}`} fill="none" stroke={c} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="shrink-0 font-mono">
        <div className="text-[10px] uppercase tracking-wider text-fg-faint">realized equity</div>
        <div className={`text-sm tabular-nums ${up ? "text-bull" : "text-bear"}`}>${fmt(last, 2)}</div>
        <div className={`text-[10px] tabular-nums ${up ? "text-bull" : "text-bear"}`}>
          {up ? "+" : "−"}
          {(Math.abs((last - startingCash) / (startingCash || 1)) * 100).toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

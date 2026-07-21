"use client";

// The paper account in one place. /pro's sub-window shows the account while
// you chart; this page is the account — equity, open positions across both
// books (shares from /pro, option bets from /trade and /quant), working
// orders, wagered totals, realized history, the cash ledger and the journal.
// Everything reads the ONE shared usePaper store, so a number here can never
// disagree with the panel on /pro.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { usePaper, type BalanceEntry, type ClosedTrade, type Position } from "@/lib/stores";
import { unrealizedPnl } from "@/lib/paper-shares";
import { accountMetrics, protectionFor, toCsv } from "@/lib/paper-metrics";
import { placePaperOrder } from "@/lib/pro/paper";
import { fmt } from "@/components/pro/chartCore";

type QuoteRow = { sym: string; last?: number; chgPct?: number };

const stampDate = (ts: number) =>
  new Date(ts).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
const stampTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
const stamp = (ts: number) => `${stampDate(ts)} ${stampTime(ts)}`;

const money = (n: number) => `$${fmt(Math.abs(n), 2)}`;
const signedMoney = (n: number) => `${n >= 0 ? "+" : "−"}$${fmt(Math.abs(n), 2)}`;

function downloadCsv(name: string, csv: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function PortfolioPage() {
  const cash = usePaper((s) => s.cash);
  const startingCash = usePaper((s) => s.startingCash);
  const realizedToday = usePaper((s) => s.realizedToday);
  const shares = usePaper((s) => s.shares);
  const orders = usePaper((s) => s.orders);
  const trades = usePaper((s) => s.trades);
  const balanceLog = usePaper((s) => s.balanceLog);
  const journal = usePaper((s) => s.journal);
  const bets = usePaper((s) => s.positions);
  const cancelOrder = usePaper((s) => s.cancelOrder);
  const setJournalNote = usePaper((s) => s.setJournalNote);

  const [quotes, setQuotes] = useState<Record<string, QuoteRow>>({});
  const [toast, setToast] = useState<string | null>(null);

  const say = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 4000);
  };

  const working = useMemo(() => orders.filter((o) => o.status === "working"), [orders]);

  // ── live marks — one poll covers positions and working orders; each fresh
  // price also advances the book (fills resting orders, spawns brackets), so
  // the account keeps moving while you're on this page, not just on /pro.
  const symsKey = useMemo(() => {
    const set = new Set<string>();
    for (const sym of Object.keys(shares)) set.add(sym);
    for (const o of working) set.add(o.sym);
    return Array.from(set).sort().join(",");
  }, [shares, working]);

  useEffect(() => {
    if (!symsKey) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/quote-batch?symbols=${encodeURIComponent(symsKey)}`);
        const j = await r.json();
        if (!alive || !j.ok) return;
        const map: Record<string, QuoteRow> = {};
        for (const q of j.quotes as QuoteRow[]) map[q.sym] = q;
        setQuotes(map);
        for (const q of j.quotes as QuoteRow[]) {
          if (q.last != null && Number.isFinite(q.last)) usePaper.getState().markPrice(q.sym, q.last);
        }
      } catch {
        /* keep the last marks on a failed poll */
      }
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [symsKey]);

  const marks = useMemo(() => {
    const m: Record<string, number> = {};
    for (const [sym, q] of Object.entries(quotes)) if (q.last != null) m[sym] = q.last;
    return m;
  }, [quotes]);

  const betStats = useMemo(() => {
    const openBets = bets.filter((p) => p.status === "open");
    const closedBets = bets.filter((p) => p.status === "closed");
    const wageredOpen = openBets.reduce((a, p) => a + Math.abs(p.cost), 0);
    /** Signed — what equity carries the open bets at. */
    const openCost = openBets.reduce((a, p) => a + p.cost, 0);
    const wins = closedBets.filter((p) => p.pnl > 0).length;
    const betPnl = closedBets.reduce((a, p) => a + p.pnl, 0);
    return { openBets, closedBets, wageredOpen, openCost, wins, betPnl };
  }, [bets]);

  const metrics = useMemo(
    () => accountMetrics({ cash, realizedToday, shares, orders: working, marks, openBetCost: betStats.openCost }),
    [cash, realizedToday, shares, working, marks, betStats.openCost]
  );

  const netPnl = metrics.equity - startingCash;
  const netPct = startingCash > 0 ? (netPnl / startingCash) * 100 : 0;

  // ── wagered: cash that left the account into trades, and what came back.
  // From the ledger rather than re-deriving from fills — the ledger already
  // reconciles. Both logs cap at 200 entries, disclosed below.
  const wagered = useMemo(() => {
    let out = 0;
    let back = 0;
    for (const b of balanceLog) {
      if (b.kind !== "trade") continue;
      if (b.amount < 0) out += -b.amount;
      else back += b.amount;
    }
    return { out, back };
  }, [balanceLog]);

  // ── performance from realized round-trips
  const perf = useMemo(() => {
    const n = trades.length;
    if (!n) return null;
    const pnls = trades.map((t) => t.pnl);
    const wins = pnls.filter((p) => p > 0);
    const losses = pnls.filter((p) => p < 0);
    const grossWin = wins.reduce((a, b) => a + b, 0);
    const grossLoss = losses.reduce((a, b) => a + b, 0);
    return {
      n,
      winRate: wins.length / n,
      profitFactor: grossLoss !== 0 ? grossWin / -grossLoss : null,
      avgWin: wins.length ? grossWin / wins.length : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
      expectancy: pnls.reduce((a, b) => a + b, 0) / n,
      best: Math.max(...pnls),
      worst: Math.min(...pnls),
    };
  }, [trades]);

  const positionRows = useMemo(
    () =>
      Object.values(shares)
        .filter((p) => p && Number.isFinite(p.qty) && p.qty !== 0)
        .map((pos) => {
          const q = quotes[pos.sym];
          const mark = q?.last != null && Number.isFinite(q.last) ? q.last : null;
          const upnl = mark != null ? unrealizedPnl(pos, mark) : null;
          const upnlPct =
            upnl != null && pos.avgPrice > 0 ? (upnl / (Math.abs(pos.qty) * pos.avgPrice)) * 100 : null;
          const prot = protectionFor(pos.sym, orders);
          return { pos, mark, upnl, upnlPct, dayPct: q?.chgPct ?? null, ...prot };
        })
        .sort((a, b) => a.pos.sym.localeCompare(b.pos.sym)),
    [shares, quotes, orders]
  );

  const closePosition = (sym: string) => {
    const pos = shares[sym];
    const mark = marks[sym];
    if (!pos || !Number.isFinite(mark)) {
      say(`No live price for ${sym} yet — try again in a few seconds`);
      return;
    }
    const res = placePaperOrder({
      sym,
      side: pos.qty > 0 ? "sell" : "buy",
      type: "market",
      qty: Math.abs(pos.qty),
      price: mark,
    });
    if (!res.ok) {
      say(`Close rejected: ${res.error}`);
      return;
    }
    const pnl = (mark - pos.avgPrice) * pos.qty;
    say(`Closed ${sym} — ${signedMoney(pnl)} realized`);
  };

  const resetAccount = () => {
    if (!window.confirm(`Reset the paper account to ${money(startingCash)}? Positions, orders, history and the ledger are cleared.`)) return;
    usePaper.getState().reset();
    say(`Account reset to ${money(startingCash)}`);
  };

  return (
    <div className="pro-theme min-h-screen bg-bg text-fg">
      <Nav />

      <main className="mx-auto max-w-[1200px] px-5 pb-24 pt-8">
        {/* ── header ── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint">
              <span className="border border-bull/40 bg-bull/10 px-1.5 py-0.5 font-semibold text-bull">paper</span>
              <span>one account · /pro · /trade · /quant</span>
            </div>
            <h1 className="mt-2 font-display text-3xl tracking-tightest">Portfolio</h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
            <button
              onClick={resetAccount}
              className="h-8 border border-border bg-surface px-3 text-fg-dim transition-colors hover:border-bear/60 hover:text-bear"
            >
              ↺ reset funds
            </button>
            <Link
              href="/pro"
              className="flex h-8 items-center border border-border bg-surface px-3 text-fg-dim transition-colors hover:border-fg-dim hover:text-fg"
            >
              open charts →
            </Link>
          </div>
        </div>

        {/* ── hero: account value ── */}
        <section className="mt-6 border border-border bg-surface p-5">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint">Account value</div>
              <div className="mt-1 font-display text-5xl tabular-nums tracking-tightest">
                ${fmt(metrics.equity, 2)}
              </div>
              <div className={`mt-2 font-mono text-[13px] tabular-nums ${netPnl >= 0 ? "text-bull" : "text-bear"}`}>
                {signedMoney(netPnl)} · {netPnl >= 0 ? "+" : "−"}
                {fmt(Math.abs(netPct), 2)}% <span className="text-fg-faint">since start</span>
              </div>
            </div>
            <EquityCurve startingCash={startingCash} trades={trades} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-px border border-border-soft bg-border-soft sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Balance" value={money(metrics.balance)} />
            <Stat label="Unrealized P&L" value={signedMoney(metrics.unrealizedPnl)} tone={metrics.unrealizedPnl} />
            <Stat label="Realized today" value={signedMoney(metrics.realizedPnl)} tone={metrics.realizedPnl} />
            <Stat label="Available funds" value={money(metrics.availableFunds)} />
            <Stat label="Positions margin" value={money(metrics.accountMargin)} />
            <Stat label="Orders reserved" value={money(metrics.ordersMargin)} />
            <Stat label="Margin buffer" value={`${fmt(metrics.marginBuffer * 100, 1)}%`} />
            <Stat label="Starting capital" value={money(startingCash)} />
          </div>
          {metrics.unmarkedCount > 0 && (
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-amber">
              {metrics.unmarkedCount} position{metrics.unmarkedCount > 1 ? "s" : ""} carried at cost — no live
              price yet
            </div>
          )}
        </section>

        {/* ── wagered strip ── */}
        <section className="mt-4 grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
          <Stat big label="Total wagered" value={money(wagered.out)} sub="cash sent into trades & bets" />
          <Stat big label="Returned from trades" value={money(wagered.back)} sub="closes, credits, premiums" />
          <Stat big label="Bets open now" value={money(betStats.wageredOpen)} sub={`${betStats.openBets.length} option bet${betStats.openBets.length === 1 ? "" : "s"}`} />
          <Stat
            big
            label="Bet record"
            value={betStats.closedBets.length ? `${betStats.wins}W · ${betStats.closedBets.length - betStats.wins}L` : "—"}
            sub={betStats.closedBets.length ? `${signedMoney(betStats.betPnl)} settled` : "no settled bets yet"}
          />
        </section>

        {/* ── open positions ── */}
        <Section
          title={`Open positions · ${positionRows.length}`}
          onExport={
            positionRows.length
              ? () =>
                  downloadCsv(
                    "positions.csv",
                    toCsv(
                      ["Symbol", "Side", "Quantity", "Avg price", "Last", "Market value", "Unrealized", "Take profit", "Stop loss"],
                      positionRows.map((r) => [
                        r.pos.sym,
                        r.pos.qty > 0 ? "Long" : "Short",
                        Math.abs(r.pos.qty),
                        r.pos.avgPrice,
                        r.mark ?? "",
                        r.mark != null ? Math.abs(r.pos.qty) * r.mark : "",
                        r.upnl ?? "",
                        r.takeProfit ?? "",
                        r.stopLoss ?? "",
                      ])
                    )
                  )
              : undefined
          }
        >
          {positionRows.length === 0 ? (
            <Empty>
              No open positions. Place a trade on <Link className="text-bull underline" href="/pro">/pro</Link> or bet a
              direction on <Link className="text-bull underline" href="/quant">/quant</Link>.
            </Empty>
          ) : (
            <table className="w-full font-mono text-[11px] tabular-nums">
              <thead>
                <Tr head>
                  <Th left>Symbol</Th>
                  <Th left>Side</Th>
                  <Th>Qty</Th>
                  <Th>Avg</Th>
                  <Th>Last</Th>
                  <Th>Day %</Th>
                  <Th>Value</Th>
                  <Th>Unrealized</Th>
                  <Th>TP / SL</Th>
                  <Th> </Th>
                </Tr>
              </thead>
              <tbody>
                {positionRows.map((r) => (
                  <Tr key={r.pos.sym}>
                    <Td left strong>{r.pos.sym}</Td>
                    <Td left>
                      <span className={r.pos.qty > 0 ? "text-bull" : "text-bear"}>
                        {r.pos.qty > 0 ? "Long" : "Short"}
                      </span>
                    </Td>
                    <Td>{fmt(Math.abs(r.pos.qty), 0)}</Td>
                    <Td>{fmt(r.pos.avgPrice, 2)}</Td>
                    <Td>{r.mark != null ? fmt(r.mark, 2) : <span className="text-fg-faint">at cost</span>}</Td>
                    <Td tone={r.dayPct ?? undefined}>{r.dayPct != null ? `${r.dayPct >= 0 ? "+" : ""}${fmt(r.dayPct, 2)}%` : "—"}</Td>
                    <Td>{r.mark != null ? money(Math.abs(r.pos.qty) * r.mark) : "—"}</Td>
                    <Td tone={r.upnl ?? undefined}>
                      {r.upnl != null ? (
                        <>
                          {signedMoney(r.upnl)}{" "}
                          <span className="text-fg-faint">
                            {r.upnlPct != null ? `(${r.upnlPct >= 0 ? "+" : "−"}${fmt(Math.abs(r.upnlPct), 2)}%)` : ""}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <span className="text-bull">{r.takeProfit != null ? fmt(r.takeProfit, 2) : "—"}</span>
                      <span className="text-fg-faint"> / </span>
                      <span className="text-bear">{r.stopLoss != null ? fmt(r.stopLoss, 2) : "—"}</span>
                    </Td>
                    <Td>
                      <button
                        onClick={() => closePosition(r.pos.sym)}
                        className="border border-border px-2 py-0.5 uppercase tracking-wider text-fg-dim transition-colors hover:border-bear/60 hover:text-bear"
                      >
                        close
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* ── option bets ── */}
        <Section title={`Option bets · ${betStats.openBets.length} open`}>
          {bets.length === 0 ? (
            <Empty>
              No bets yet. The UP/DOWN slip on <Link className="text-bull underline" href="/quant">/quant</Link> and{" "}
              <Link className="text-bull underline" href="/trade/chain">the chain</Link> books here.
            </Empty>
          ) : (
            <table className="w-full font-mono text-[11px] tabular-nums">
              <thead>
                <Tr head>
                  <Th left>Opened</Th>
                  <Th left>Underlying</Th>
                  <Th left>Strategy</Th>
                  <Th left>Legs</Th>
                  <Th>Wagered</Th>
                  <Th>Status</Th>
                  <Th>P&L</Th>
                </Tr>
              </thead>
              <tbody>
                {bets.slice(0, 60).map((p: Position) => (
                  <Tr key={p.id}>
                    <Td left>{stamp(p.openedAt)}</Td>
                    <Td left strong>{p.underlying}</Td>
                    <Td left>{p.strategy}</Td>
                    <Td left>
                      <span className="text-fg-dim">
                        {p.legs
                          .map((l) => `${l.side === "long" ? "+" : "−"}${l.qty} ${l.type}${l.strike}`)
                          .join("  ")}
                      </span>
                    </Td>
                    <Td>{money(Math.abs(p.cost))}</Td>
                    <Td>
                      {p.status === "open" ? (
                        <span className="text-cyan">open</span>
                      ) : (
                        <span className="text-fg-faint">settled</span>
                      )}
                    </Td>
                    <Td tone={p.status === "closed" ? p.pnl : undefined}>
                      {p.status === "closed" ? signedMoney(p.pnl) : "—"}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </table>
          )}
          {bets.length > 0 && (
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              settle or manage bets on <Link className="text-bull underline" href="/trade">/trade</Link>
            </div>
          )}
        </Section>

        {/* ── working orders ── */}
        <Section title={`Working orders · ${working.length}`}>
          {working.length === 0 ? (
            <Empty>No resting orders. Limits and stops placed anywhere on the site rest here until they fill.</Empty>
          ) : (
            <table className="w-full font-mono text-[11px] tabular-nums">
              <thead>
                <Tr head>
                  <Th left>Placed</Th>
                  <Th left>Symbol</Th>
                  <Th left>Side</Th>
                  <Th left>Type</Th>
                  <Th>Qty</Th>
                  <Th>Price</Th>
                  <Th>TIF</Th>
                  <Th left>Note</Th>
                  <Th> </Th>
                </Tr>
              </thead>
              <tbody>
                {working.map((o) => (
                  <Tr key={o.id}>
                    <Td left>{stamp(o.placedAt)}</Td>
                    <Td left strong>{o.sym}</Td>
                    <Td left>
                      <span className={o.side === "buy" ? "text-bull" : "text-bear"}>{o.side}</span>
                    </Td>
                    <Td left>
                      {o.type}
                      {o.reduceOnly ? <span className="text-fg-faint"> · exit</span> : ""}
                    </Td>
                    <Td>{fmt(o.qty, 0)}</Td>
                    <Td>{fmt((o.type === "limit" ? o.limitPrice : o.stopPrice) ?? 0, 2)}</Td>
                    <Td>{o.tif}</Td>
                    <Td left>
                      <span className="text-fg-faint">{o.note ?? ""}</span>
                    </Td>
                    <Td>
                      <button
                        onClick={() => cancelOrder(o.id)}
                        className="border border-border px-2 py-0.5 uppercase tracking-wider text-fg-dim transition-colors hover:border-bear/60 hover:text-bear"
                      >
                        cancel
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* ── performance ── */}
        <Section title="Performance · realized round-trips">
          {!perf ? (
            <Empty>Close a trade and the win rate, profit factor and expectancy appear here.</Empty>
          ) : (
            <div className="grid grid-cols-2 gap-px border border-border-soft bg-border-soft sm:grid-cols-4 lg:grid-cols-8">
              <Stat label="Round-trips" value={String(perf.n)} />
              <Stat label="Win rate" value={`${fmt(perf.winRate * 100, 1)}%`} />
              <Stat
                label="Profit factor"
                value={perf.profitFactor != null ? fmt(perf.profitFactor, 2) : "∞"}
              />
              <Stat label="Expectancy / trade" value={signedMoney(perf.expectancy)} tone={perf.expectancy} />
              <Stat label="Avg win" value={signedMoney(perf.avgWin)} tone={1} />
              <Stat label="Avg loss" value={signedMoney(perf.avgLoss)} tone={-1} />
              <Stat label="Best trade" value={signedMoney(perf.best)} tone={perf.best} />
              <Stat label="Worst trade" value={signedMoney(perf.worst)} tone={perf.worst} />
            </div>
          )}
        </Section>

        {/* ── trade history ── */}
        <Section
          title={`Trade history · ${trades.length}`}
          onExport={
            trades.length
              ? () =>
                  downloadCsv(
                    "trade-history.csv",
                    toCsv(
                      ["Closed", "Symbol", "Side", "Quantity", "Entry", "Exit", "P&L", "Note"],
                      trades.map((t) => [
                        new Date(t.closedAt).toISOString(),
                        t.sym,
                        t.side,
                        t.qty,
                        t.entry,
                        t.exit,
                        t.pnl,
                        journal[t.id] ?? "",
                      ])
                    )
                  )
              : undefined
          }
        >
          {trades.length === 0 ? (
            <Empty>Every close lands here with its realized P&L — reduce or flatten a position to start the tape.</Empty>
          ) : (
            <table className="w-full font-mono text-[11px] tabular-nums">
              <thead>
                <Tr head>
                  <Th left>Closed</Th>
                  <Th left>Symbol</Th>
                  <Th left>Side</Th>
                  <Th>Qty</Th>
                  <Th>Entry</Th>
                  <Th>Exit</Th>
                  <Th>P&L</Th>
                  <Th left>Journal</Th>
                </Tr>
              </thead>
              <tbody>
                {trades.slice(0, 100).map((t: ClosedTrade) => (
                  <Tr key={t.id}>
                    <Td left>{stamp(t.closedAt)}</Td>
                    <Td left strong>{t.sym}</Td>
                    <Td left>
                      <span className={t.side === "long" ? "text-bull" : "text-bear"}>{t.side}</span>
                    </Td>
                    <Td>{fmt(t.qty, 0)}</Td>
                    <Td>{fmt(t.entry, 2)}</Td>
                    <Td>{fmt(t.exit, 2)}</Td>
                    <Td tone={t.pnl}>{signedMoney(t.pnl)}</Td>
                    <Td left>
                      <input
                        defaultValue={journal[t.id] ?? ""}
                        onBlur={(e) => setJournalNote(t.id, e.target.value)}
                        placeholder="why did you take it?"
                        aria-label={`Journal note for ${t.sym} trade`}
                        className="w-full max-w-[220px] border-b border-transparent bg-transparent text-fg-dim outline-none placeholder:text-fg-faint focus:border-border"
                      />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </table>
          )}
          {trades.length >= 100 && (
            <div className="mt-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              showing 100 — export for the full record (history caps at 200 round-trips)
            </div>
          )}
        </Section>

        {/* ── cash ledger ── */}
        <Section
          title={`Cash ledger · ${balanceLog.length}`}
          onExport={
            balanceLog.length
              ? () =>
                  downloadCsv(
                    "ledger.csv",
                    toCsv(
                      ["Time", "Kind", "Symbol", "Amount", "Balance after", "Note"],
                      balanceLog.map((b) => [
                        new Date(b.ts).toISOString(),
                        b.kind,
                        b.sym ?? "",
                        b.amount,
                        b.balance,
                        b.note,
                      ])
                    )
                  )
              : undefined
          }
        >
          {balanceLog.length === 0 ? (
            <Empty>Every cash movement — fills, credits, resets — reconciles here.</Empty>
          ) : (
            <table className="w-full font-mono text-[11px] tabular-nums">
              <thead>
                <Tr head>
                  <Th left>Time</Th>
                  <Th left>Kind</Th>
                  <Th left>Note</Th>
                  <Th>Amount</Th>
                  <Th>Balance after</Th>
                </Tr>
              </thead>
              <tbody>
                {balanceLog.slice(0, 100).map((b: BalanceEntry) => (
                  <Tr key={b.id}>
                    <Td left>{stamp(b.ts)}</Td>
                    <Td left>
                      <span className={b.kind === "trade" ? "text-fg-dim" : "text-amber"}>{b.kind}</span>
                    </Td>
                    <Td left>
                      <span className="text-fg-dim">{b.note}</span>
                    </Td>
                    <Td tone={b.amount}>{signedMoney(b.amount)}</Td>
                    <Td>{money(b.balance)}</Td>
                  </Tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <div className="mt-10 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-fg-faint">
          paper only · not advice · history and ledger keep the last 200 entries
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-border bg-surface px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-fg shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function Stat({
  label,
  value,
  sub,
  tone,
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: number;
  big?: boolean;
}) {
  const color =
    tone == null || tone === 0 ? "text-fg" : tone > 0 ? "text-bull" : "text-bear";
  return (
    <div className="bg-surface p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-fg-faint">{label}</div>
      <div className={`mt-1 font-mono ${big ? "text-[16px]" : "text-[13px]"} tabular-nums ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-fg-faint">{sub}</div>}
    </div>
  );
}

function Section({
  title,
  children,
  onExport,
}: {
  title: string;
  children: React.ReactNode;
  onExport?: () => void;
}) {
  return (
    <section className="mt-4 border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border-soft px-4 py-2.5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg-dim">{title}</h2>
        {onExport && (
          <button
            onClick={onExport}
            className="font-mono text-[10px] uppercase tracking-wider text-fg-faint transition-colors hover:text-fg"
          >
            ⤓ csv
          </button>
        )}
      </div>
      <div className="overflow-x-auto p-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-6 text-center font-mono text-[11px] text-fg-faint">{children}</div>;
}

function Tr({ children, head }: { children: React.ReactNode; head?: boolean }) {
  return (
    <tr className={head ? "text-fg-faint" : "border-t border-border-soft transition-colors hover:bg-surface-2/50"}>
      {children}
    </tr>
  );
}

function Th({ children, left }: { children: React.ReactNode; left?: boolean }) {
  return (
    <th className={`px-2 pb-2 font-normal uppercase tracking-wider ${left ? "text-left" : "text-right"}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  left,
  strong,
  tone,
}: {
  children: React.ReactNode;
  left?: boolean;
  strong?: boolean;
  tone?: number;
}) {
  const color =
    tone == null ? (strong ? "text-fg" : "text-fg-dim") : tone > 0 ? "text-bull" : tone < 0 ? "text-bear" : "text-fg-dim";
  return <td className={`px-2 py-1.5 ${left ? "text-left" : "text-right"} ${color}`}>{children}</td>;
}

/** Realized-only equity curve: starting capital stepped by each round-trip,
    oldest → newest. Same semantics as the /pro sub-window's curve. */
function EquityCurve({ startingCash, trades }: { startingCash: number; trades: ClosedTrade[] }) {
  const W = 360;
  const H = 96;
  const pts = useMemo(() => {
    const chron = [...trades].sort((a, b) => a.closedAt - b.closedAt);
    let eq = startingCash;
    const ys = [eq, ...chron.map((t) => (eq += t.pnl))];
    return ys;
  }, [trades, startingCash]);

  if (pts.length < 2) {
    return (
      <div className="hidden h-[96px] w-[360px] items-center justify-center border border-border-soft font-mono text-[10px] uppercase tracking-wider text-fg-faint sm:flex">
        equity curve appears after your first close
      </div>
    );
  }

  const lo = Math.min(...pts, startingCash);
  const hi = Math.max(...pts, startingCash);
  const pad = (hi - lo) * 0.12 || 1;
  const y = (v: number) => H - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * H;
  const x = (i: number) => (i / (pts.length - 1)) * W;
  const path = pts.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const up = pts[pts.length - 1] >= startingCash;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="hidden shrink-0 sm:block" aria-label="Equity curve">
      <line
        x1="0"
        x2={W}
        y1={y(startingCash)}
        y2={y(startingCash)}
        stroke="var(--fg-faint)"
        strokeWidth="1"
        strokeDasharray="4 4"
        opacity="0.6"
      />
      <path d={path} fill="none" stroke={up ? "var(--bull)" : "var(--bear)"} strokeWidth="1.6" />
    </svg>
  );
}

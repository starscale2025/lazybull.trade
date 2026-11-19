"use client";

import { usePaper } from "@/lib/stores";
import { payoff } from "@/lib/pricing";

export function PositionsPanel({ spot, symbol }: { spot: number; symbol?: string }) {
  const positions = usePaper((s) => s.positions);
  const close = usePaper((s) => s.close);
  const cash = usePaper((s) => s.cash);
  const startingCash = usePaper((s) => s.startingCash);
  const realizedToday = usePaper((s) => s.realizedToday);
  const shares = usePaper((s) => s.shares);

  const open = positions.filter((p) => p.status === "open");
  const closed = positions.filter((p) => p.status === "closed").slice(0, 5);

  // The account's cash is SHARED with share bets placed on /pro and the
  // QuickBet slip. Without adding those back, every dollar sitting in a share
  // position read as a pure loss here (a $31k long showed as "P&L −$31k").
  //
  // Valuing them ALL at cost then produced the opposite problem: this panel and
  // /pro disagreed by the entire unrealized P&L on the same screen. Mark the
  // symbol this page actually has a live spot for, and carry the rest at cost.
  const shareBook = Object.values(shares).reduce(
    (acc, sp) => acc + sp.qty * (sp.sym === symbol && Number.isFinite(spot) ? spot : sp.avgPrice),
    0
  );
  // Positions still valued at cost, so the number below can be read honestly.
  const unmarkedSyms = Object.values(shares).filter((sp) => sp.sym !== symbol).length;

  const equity = cash + shareBook + open.reduce((acc, p) => acc + p.cost, 0); // legs are already cash-out at open

  const totalPnl = (cash + shareBook + open.reduce((acc, p) => acc + payoff(p.legs, spot), 0)) - startingCash;

  return (
    // overflow-hidden: the last row's hover tint follows the pane's corners.
    // Safe here — nothing in this panel is a `fixed` dialog.
    <div className="deck-pane overflow-hidden">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-4 py-2">
        <span className="text-[0.875rem] font-medium text-fg">Paper portfolio</span>
        <span className="text-[0.8125rem] text-fg-faint">
          Equity <span className="t-data text-fg">${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </span>
      </div>
      {unmarkedSyms > 0 && (
        // Say so rather than let the number quietly disagree with /pro.
        <div className="border-b border-border px-4 py-2 text-[0.75rem] leading-relaxed text-fg-faint">
          {unmarkedSyms} stock position{unmarkedSyms > 1 ? "s" : ""} valued at cost — live marks on pro charts
        </div>
      )}
      {/* The account in three figures, the mockup's stat row: a quiet label,
          the figure set in the display face, gains green and losses red. */}
      <dl className="grid grid-cols-3 border-b border-border">
        {[
          { k: "Cash", v: `$${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, c: "text-fg" },
          { k: "Realized today", v: `${realizedToday >= 0 ? "+" : "−"}$${Math.abs(realizedToday).toFixed(0)}`, c: realizedToday >= 0 ? "text-bull" : "text-bear" },
          { k: "Total P&L", v: `${totalPnl >= 0 ? "+" : "−"}$${Math.abs(totalPnl).toFixed(0)}`, c: totalPnl >= 0 ? "text-bull" : "text-bear" },
        ].map((s, i) => (
          <div
            key={s.k}
            className={`flex min-w-0 flex-col justify-between gap-1 px-3 py-3 sm:px-4 ${i > 0 ? "border-l border-border" : ""}`}
          >
            <dt className="text-[0.8125rem] leading-snug text-fg-faint">{s.k}</dt>
            {/* wrap-anywhere, never truncate: an ellipsis would cut digits off
                a money figure. A third of a 360px phone holds about seven
                characters at this size; a longer figure takes a second line. */}
            <dd className={`deck-display wrap-anywhere text-[1.0625rem] leading-tight tabular-nums sm:text-[1.1875rem] ${s.c}`}>{s.v}</dd>
          </div>
        ))}
      </dl>

      {/* Open positions — deck table rows: the strong rule under the head,
          hairlines between rows. */}
      <div className="deck-label border-b border-[var(--deck-rule)] px-4 pb-2 pt-4">
        Open · {open.length}
      </div>
      {open.length === 0 ? (
        <div className="px-4 py-5 text-center text-[0.8125rem] text-fg-faint">No open positions</div>
      ) : (
        <div>
          {open.map((p) => {
            const live = payoff(p.legs, spot);
            return (
              <div
                key={p.id}
                className="deck-row grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-3 border-t border-border px-4 py-2.5 first:border-t-0 sm:gap-x-4"
              >
                <div className="min-w-0">
                  <div className="break-words text-[0.8125rem] text-fg">{p.strategy}</div>
                  <div className="mt-0.5 font-mono text-[0.6875rem] text-fg-faint">{p.underlying} · {p.legs.length} leg</div>
                </div>
                <div className="text-right">
                  <div className="deck-label">Cost</div>
                  <div className={`mt-0.5 t-data text-[0.8125rem] ${p.cost > 0 ? "text-bear" : "text-bull"}`}>${Math.abs(p.cost).toFixed(0)}</div>
                </div>
                <div className="text-right">
                  <div className="deck-label">Live</div>
                  <div className={`mt-0.5 t-data text-[0.8125rem] ${live >= 0 ? "text-bull" : "text-bear"}`}>{live >= 0 ? "+" : "−"}${Math.abs(live).toFixed(0)}</div>
                </div>
                <button type="button" onClick={() => close(p.id, live)} className="deck-btn deck-btn-sm px-3">
                  Close
                </button>
              </div>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <>
          <div className="deck-label border-b border-[var(--deck-rule)] border-t border-t-border px-4 pb-2 pt-4">
            Recent closed
          </div>
          <div className="pb-1">
            {closed.map((p) => (
              <div
                key={p.id}
                className="deck-row flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-[0.75rem] first:border-t-0"
              >
                <div className="min-w-0 text-fg-dim">{p.strategy} · {p.underlying}</div>
                <div className={`shrink-0 t-data ${p.pnl >= 0 ? "text-bull" : "text-bear"}`}>
                  {p.pnl >= 0 ? "+" : "−"}${Math.abs(p.pnl).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

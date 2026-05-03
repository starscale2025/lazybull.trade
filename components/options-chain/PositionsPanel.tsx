"use client";

import { useEffect } from "react";
import { usePaper } from "@/lib/stores";
import { payoff } from "@/lib/pricing";

export function PositionsPanel({ spot }: { spot: number }) {
  const positions = usePaper((s) => s.positions);
  const close = usePaper((s) => s.close);
  const cash = usePaper((s) => s.cash);
  const startingCash = usePaper((s) => s.startingCash);
  const realizedToday = usePaper((s) => s.realizedToday);

  const open = positions.filter((p) => p.status === "open");
  const closed = positions.filter((p) => p.status === "closed").slice(0, 5);

  const unrealized = open.reduce(
    (acc, p) => acc + payoff(p.legs, spot) - (p.cost > 0 ? -p.cost : -p.cost),
    0
  );
  const equity = cash + open.reduce((acc, p) => acc + p.cost, 0); // legs are already cash-out at open

  const totalPnl = (cash + open.reduce((acc, p) => acc + payoff(p.legs, spot), 0)) - startingCash;

  return (
    <div className="border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
        <span className="text-bull">● paper portfolio</span>
        <span className="text-fg-dim">
          equity <span className="text-fg">${equity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-px border-b border-border bg-border-soft">
        {[
          { k: "Cash", v: `$${cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, c: "text-fg" },
          { k: "Realized today", v: `${realizedToday >= 0 ? "+" : "−"}$${Math.abs(realizedToday).toFixed(0)}`, c: realizedToday >= 0 ? "text-bull" : "text-bear" },
          { k: "Total P&L", v: `${totalPnl >= 0 ? "+" : "−"}$${Math.abs(totalPnl).toFixed(0)}`, c: totalPnl >= 0 ? "text-bull" : "text-bear" },
        ].map((s) => (
          <div key={s.k} className="bg-bg p-2.5">
            <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">{s.k}</div>
            <div className={`mt-0.5 font-mono text-sm tabular-nums ${s.c}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-fg-faint border-b border-border-soft">
        open · {open.length}
      </div>
      {open.length === 0 ? (
        <div className="px-3 py-4 text-center font-mono text-[11px] text-fg-faint">no open positions</div>
      ) : (
        <div>
          {open.map((p) => {
            const live = payoff(p.legs, spot);
            return (
              <div key={p.id} className="grid grid-cols-12 items-center gap-2 border-b border-border-soft px-3 py-2 font-mono text-[11px] tabular-nums">
                <div className="col-span-4">
                  <div className="text-fg">{p.strategy}</div>
                  <div className="font-mono text-[10px] text-fg-faint">{p.underlying} · {p.legs.length} leg</div>
                </div>
                <div className="col-span-3 text-right">
                  <div className="text-fg-dim">cost</div>
                  <div className={p.cost > 0 ? "text-bear" : "text-bull"}>${Math.abs(p.cost).toFixed(0)}</div>
                </div>
                <div className="col-span-3 text-right">
                  <div className="text-fg-dim">live</div>
                  <div className={live >= 0 ? "text-bull" : "text-bear"}>{live >= 0 ? "+" : "−"}${Math.abs(live).toFixed(0)}</div>
                </div>
                <button
                  onClick={() => close(p.id, live)}
                  className="col-span-2 border border-border bg-bg px-2 py-1 text-[10px] uppercase tracking-wider text-fg-dim hover:border-bear hover:text-bear"
                >
                  close
                </button>
              </div>
            );
          })}
        </div>
      )}

      {closed.length > 0 && (
        <>
          <div className="px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-fg-faint border-b border-border-soft">
            recent closed
          </div>
          {closed.map((p) => (
            <div key={p.id} className="grid grid-cols-12 items-center gap-2 border-b border-border-soft px-3 py-1.5 font-mono text-[10px] tabular-nums text-fg-dim">
              <div className="col-span-7">{p.strategy} · {p.underlying}</div>
              <div className={`col-span-5 text-right ${p.pnl >= 0 ? "text-bull" : "text-bear"}`}>
                {p.pnl >= 0 ? "+" : "−"}${Math.abs(p.pnl).toFixed(0)}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

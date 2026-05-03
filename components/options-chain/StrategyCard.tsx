"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useStrategy, usePaper, useSafety } from "@/lib/stores";
import { detect } from "@/lib/detector";
import { pnlSummary } from "@/lib/pricing";
import { PnLDiagram } from "./PnLDiagram";
import { PreTradeModal } from "@/components/safety/PreTradeModal";

const fmt = (n: number) =>
  Number.isFinite(n) ? `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(0)}` : "unbounded";

export function StrategyCard({ underlying, spot }: { underlying: string; spot: number }) {
  const legs = useStrategy((s) => s.legs);
  const flipSide = useStrategy((s) => s.flipSide);
  const setQty = useStrategy((s) => s.setQty);
  const clear = useStrategy((s) => s.clear);
  const open = usePaper((s) => s.open);
  const cash = usePaper((s) => s.cash);
  const trainingWheels = useSafety((s) => s.trainingWheels);

  const detection = useMemo(() => detect(legs), [legs]);
  const summary = useMemo(() => (legs.length ? pnlSummary(legs, spot) : null), [legs, spot]);

  const cost = useMemo(
    () =>
      legs.reduce(
        (acc, l) => acc + (l.side === "long" ? l.premium : -l.premium) * l.qty * 100,
        0
      ),
    [legs]
  );

  const [explainOpen, setExplainOpen] = useState(false);
  const [explanation, setExplanation] = useState<{ source: string; text: string } | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  const [tradeModal, setTradeModal] = useState(false);

  async function explain() {
    if (!summary) return;
    setExplainOpen(true);
    setExplainLoading(true);
    try {
      const r = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strategy: detection.kind,
          bias: detection.bias,
          defined: detection.defined,
          net: detection.net,
          maxProfit: summary.maxProfit,
          maxLoss: summary.maxLoss,
          breakevens: summary.breakevens,
          spot,
          underlying,
        }),
      });
      const data = await r.json();
      setExplanation(data);
    } finally {
      setExplainLoading(false);
    }
  }

  const placeTrade = () => {
    if (!summary) return;
    open({
      underlying,
      legs,
      strategy: detection.kind,
      openSpot: spot,
      cost,
    });
    clear();
    setTradeModal(false);
  };

  return (
    <div className="border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
        <div className="flex items-center gap-2">
          <span className="text-bull">●</span>
          <span className="text-fg">strategy builder</span>
        </div>
        <div className="flex items-center gap-2 text-fg-dim">
          <span>{legs.length} leg{legs.length === 1 ? "" : "s"}</span>
          {legs.length > 0 && (
            <button onClick={clear} className="text-fg-faint hover:text-bear transition-colors">
              clear
            </button>
          )}
        </div>
      </div>

      {/* Detected strategy banner */}
      <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">detected</div>
          <div className="font-display text-3xl tracking-tightest text-fg">
            {legs.length === 0 ? "Empty" : detection.kind}
          </div>
          {legs.length > 0 && (
            <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
              <span
                className="inline-flex items-center gap-1.5 border px-2 py-0.5"
                style={{
                  borderColor:
                    detection.bias === "bullish"
                      ? "var(--bull)"
                      : detection.bias === "bearish"
                      ? "var(--bear)"
                      : detection.bias === "volatile"
                      ? "var(--plasma)"
                      : "var(--cyan)",
                  color:
                    detection.bias === "bullish"
                      ? "var(--bull)"
                      : detection.bias === "bearish"
                      ? "var(--bear)"
                      : detection.bias === "volatile"
                      ? "var(--plasma)"
                      : "var(--cyan)",
                }}
              >
                {detection.bias}
              </span>
              <span className="border border-border bg-bg px-2 py-0.5">net {detection.net}</span>
              <span
                className="border px-2 py-0.5"
                style={{
                  borderColor: detection.defined ? "var(--bull)" : "var(--bear)",
                  color: detection.defined ? "var(--bull)" : "var(--bear)",
                }}
              >
                {detection.defined ? "defined risk" : "unbounded risk"}
              </span>
            </div>
          )}
        </div>
        {legs.length > 0 && (
          <button
            onClick={explain}
            className="group inline-flex items-center gap-2 border border-bull/40 bg-bull/10 px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-bull transition-colors hover:bg-bull/20"
          >
            <span className="size-1.5 rounded-full bg-bull pulse-dot" />
            Explain this strategy
          </button>
        )}
      </div>

      {legs.length > 0 && (
        <p className="px-4 pt-2 text-sm leading-relaxed text-fg-dim">{detection.blurb}</p>
      )}

      {/* P&L diagram */}
      <div className="px-4 pt-4">
        <PnLDiagram legs={legs} spot={spot} />
      </div>

      {/* Numerical summary */}
      {summary && legs.length > 0 && (
        <div className="grid grid-cols-2 gap-px border-t border-border-soft bg-border-soft md:grid-cols-4">
          {[
            { k: "Max profit", v: fmt(summary.maxProfit), c: "text-bull" },
            { k: "Max loss", v: summary.unboundedRisk ? "unbounded" : fmt(summary.maxLoss), c: summary.unboundedRisk ? "text-bear" : "text-fg" },
            { k: "Breakeven", v: summary.breakevens.length ? summary.breakevens.map((b) => `$${b.toFixed(2)}`).join(" / ") : "—", c: "text-fg" },
            { k: "Net cost", v: `${cost >= 0 ? "" : "+"}$${Math.abs(cost / 100).toFixed(2)}`, c: cost >= 0 ? "text-fg-dim" : "text-bull" },
          ].map((s) => (
            <div key={s.k} className="bg-bg p-3">
              <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">{s.k}</div>
              <div className={`mt-1 font-mono text-base tabular-nums ${s.c}`}>{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Legs */}
      {legs.length > 0 && (
        <div className="border-t border-border-soft">
          <div className="grid grid-cols-12 gap-2 border-b border-border-soft bg-bg-soft px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
            <span className="col-span-2">side</span>
            <span className="col-span-2">type</span>
            <span className="col-span-2">strike</span>
            <span className="col-span-2 text-right">premium</span>
            <span className="col-span-2 text-right">qty</span>
            <span className="col-span-2 text-right">net</span>
          </div>
          {legs.map((l) => (
            <div key={l.id} className="grid grid-cols-12 items-center gap-2 border-b border-border-soft px-3 py-1.5 font-mono text-[11px] tabular-nums">
              <button
                onClick={() => flipSide(l.id)}
                className={`col-span-2 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  l.side === "long" ? "border-bull text-bull hover:bg-bull/10" : "border-bear text-bear hover:bg-bear/10"
                }`}
              >
                {l.side}
              </button>
              <span className={`col-span-2 ${l.type === "C" ? "text-bull" : "text-bear"}`}>{l.type === "C" ? "call" : "put"}</span>
              <span className="col-span-2 text-fg">{l.strike.toFixed(l.strike < 100 ? 2 : 0)}</span>
              <span className="col-span-2 text-right text-fg-dim">${l.premium.toFixed(2)}</span>
              <span className="col-span-2 text-right">
                <input
                  type="number"
                  min={1}
                  value={l.qty}
                  onChange={(e) => setQty(l.id, parseInt(e.target.value) || 1)}
                  className="w-12 border border-border bg-bg px-1 py-0.5 text-right text-fg outline-none focus:border-bull"
                />
              </span>
              <span className={`col-span-2 text-right ${l.side === "long" ? "text-bear" : "text-bull"}`}>
                {l.side === "long" ? "−" : "+"}${(l.premium * l.qty * 100).toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Trade button */}
      {legs.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-border-soft bg-bg-soft px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            cash <span className="text-fg">${cash.toLocaleString()}</span>
            <span className="text-fg-faint mx-2">·</span>
            cost <span className={cost > 0 ? "text-bear" : "text-bull"}>${Math.abs(cost).toFixed(0)}</span>
          </div>
          <button
            onClick={() => setTradeModal(true)}
            className="inline-flex items-center gap-2 bg-bull px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim transition-colors"
          >
            paper trade →
          </button>
        </div>
      )}

      {/* Explain modal */}
      <AnimatePresence>
        {explainOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setExplainOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-xl w-full border border-bull/40 bg-bg shadow-[0_30px_80px_-20px_rgba(0,255,135,0.4)]"
            >
              <div className="flex items-center justify-between border-b border-border bg-bg-soft px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                <span className="text-bull">● teacher · {explanation?.source ?? "..."}</span>
                <button onClick={() => setExplainOpen(false)} className="text-fg-faint hover:text-fg">
                  ✕
                </button>
              </div>
              <div className="p-6">
                <div className="font-display text-2xl tracking-tightest text-fg">
                  {detection.kind}
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
                  on {underlying} · spot ${spot.toFixed(2)}
                </div>
                <div className="mt-4 min-h-[120px] whitespace-pre-line text-[14px] leading-relaxed text-fg">
                  {explainLoading ? (
                    <span className="text-fg-faint">teacher is thinking…</span>
                  ) : (
                    explanation?.text
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PreTradeModal
        open={tradeModal}
        onClose={() => setTradeModal(false)}
        onConfirm={placeTrade}
        strategy={detection.kind}
        unbounded={!detection.defined || (summary?.unboundedRisk ?? false)}
        maxLoss={summary?.maxLoss ?? 0}
        maxProfit={summary?.maxProfit ?? 0}
        cost={cost}
        trainingWheels={trainingWheels}
      />
    </div>
  );
}

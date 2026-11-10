"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useStrategy, usePaper, useSafety } from "@/lib/stores";
import { detect } from "@/lib/detector";
import { pnlSummary } from "@/lib/pricing";
import { PnLDiagram } from "./PnLDiagram";
import { PreTradeModal } from "@/components/safety/PreTradeModal";
import { withBriefing } from "@/lib/safety-briefing";
import { UpgradeNudge } from "@/components/billing/UpgradeNudge";
import { isPaywall, type PaywallBody } from "@/lib/billing/gate";
import { noteExplainRequest, tradeFingerprint } from "@/lib/confusion";

const fmt = (n: number) =>
  Number.isFinite(n) ? `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(0)}` : "unbounded";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// A leg's side, in the colours the chain paints it: long green, short red.
const SIDE_TAG = {
  long: "bg-[var(--deck-green-tint)] text-bull",
  short: "bg-[var(--deck-red-tint)] text-bear",
} as const;

// The legs table's cells: the deck's mono figures, ruled by .deck-table.
const TH = "deck-label px-2 pb-2 pt-3 font-normal";
const TD = "px-2 py-2";

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
  const [explanation, setExplanation] = useState<{ source: string; text: string; disclosure?: string } | null>(null);
  // The daily cap (app/api/explain answers 402 with lib/billing/gate.ts's body).
  const [paywall, setPaywall] = useState<PaywallBody | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  const [tradeModal, setTradeModal] = useState(false);

  async function explain() {
    if (!summary) return;
    setExplainOpen(true);
    setExplainLoading(true);
    // Asking twice about the SAME position inside five minutes is the clearest
    // signal we get that an explanation did not land — the confusion trace the
    // teacher is meant to learn from. It records only under the "trace" consent
    // basis and never carries the position itself, just a fingerprint of it.
    // The chain is the second of the two explain call sites; the builder's is
    // wired in app/trade/workbench.tsx.
    noteExplainRequest(
      tradeFingerprint({ strategy: detection.kind, underlying, legs }),
      "chain",
    );
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
      if (isPaywall(r.status, data)) {
        setPaywall(data);
        setExplanation(null);
      } else {
        setPaywall(null);
        setExplanation(data);
      }
    } finally {
      setExplainLoading(false);
    }
  }

  const placeTrade = () => {
    if (!summary) return;
    // null = refused by the safety settings; PreTradeModal already says why.
    const pos = open({
      underlying,
      legs,
      strategy: detection.kind,
      openSpot: spot,
      cost,
    });
    if (!pos) return;
    clear();
    setTradeModal(false);
  };

  // Risk before returns — the deck's rule (slide 17, and the builder's rail in
  // app/trade/workbench.tsx): max loss leads, then max profit, then where it
  // breaks even and what it costs. The same four figures and the same maths as
  // before; only the order and the colour moved. A figure takes red or green
  // only when its sign earns it, so a "max profit" that is really a loss is
  // never printed in the gain colour.
  const figures = summary
    ? [
        {
          k: "Max loss",
          v: summary.unboundedRisk ? "unbounded" : fmt(summary.maxLoss),
          c: summary.unboundedRisk || summary.maxLoss < 0 ? "text-bear" : "text-fg",
          lead: true,
        },
        { k: "Max profit", v: fmt(summary.maxProfit), c: summary.maxProfit > 0 ? "text-bull" : "text-fg", lead: true },
        { k: "Breakeven", v: summary.breakevens.length ? summary.breakevens.map((b) => `$${b.toFixed(2)}`).join(" / ") : "—", c: "text-fg" },
        { k: "Net cost", v: `${cost >= 0 ? "" : "+"}$${Math.abs(cost / 100).toFixed(2)}`, c: cost >= 0 ? "text-fg-dim" : "text-bull" },
      ]
    : [];

  return (
    <div className="deck-pane">
      {/* Pane head: the title and the count; the card's secondary actions */}
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-2">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[0.875rem] font-medium text-fg">Strategy builder</span>
          <span className="t-data text-[0.75rem] text-fg-faint">
            {legs.length} leg{legs.length === 1 ? "" : "s"}
          </span>
        </div>
        {legs.length > 0 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={explain} className="deck-btn deck-btn-sm">
              Explain
            </button>
            <button type="button" onClick={clear} className="deck-btn deck-btn-sm">
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Detected strategy banner */}
      <div className="px-4 pt-4">
        <div className="deck-label">Detected</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <div className="deck-display text-[1.625rem] leading-[1.1] tracking-[-0.02em] text-fg">
            {legs.length === 0 ? "Empty" : detection.kind}
          </div>
          {legs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="deck-chip text-fg">{cap(detection.bias)}</span>
              <span className="deck-chip">Net {detection.net}</span>
              <span className={`deck-chip ${detection.defined ? "" : "bg-[var(--deck-amber-tint)] text-amber"}`}>
                {detection.defined ? "Defined risk" : "Unbounded risk"}
              </span>
            </div>
          )}
        </div>
      </div>

      {legs.length > 0 && (
        <p className="px-4 pt-3 text-[0.875rem] leading-relaxed text-fg-dim">{detection.blurb}</p>
      )}

      {/* P&L diagram */}
      <div className="px-4 pt-4">
        <PnLDiagram legs={legs} spot={spot} />
      </div>

      {/* Numerical summary — risk first. grid-cols-2 always: the card lives in
          a ~395px side column, so a viewport (md:) breakpoint would overflow
          the cells. Breakevens may wrap; the two lead figures never do. */}
      {summary && legs.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 border-t border-border">
          {figures.map((s, i) => (
            <div
              key={s.k}
              className={`flex min-w-0 flex-col justify-between gap-1 px-4 py-3 ${i % 2 === 1 ? "border-l border-border" : ""} ${
                i >= 2 ? "border-t border-border" : ""
              }`}
            >
              <dt className="text-[0.8125rem] text-fg-faint">{s.k}</dt>
              <dd
                className={`deck-display tabular-nums ${
                  s.lead ? "whitespace-nowrap text-[1.375rem] leading-tight" : "text-[1.0625rem] leading-snug"
                } ${s.c}`}
              >
                {s.v}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Legs — a deck table: the strong rule under the head, hairlines
          between rows. It scrolls inside itself on the narrowest phones. */}
      {legs.length > 0 && (
        <div className="overflow-x-auto border-t border-border">
          <table className="deck-table w-full text-left">
            <thead>
              <tr>
                <th scope="col" className={`${TH} pl-4`}>side</th>
                <th scope="col" className={TH}>type</th>
                <th scope="col" className={TH}>strike</th>
                <th scope="col" className={`${TH} text-right`}>premium</th>
                <th scope="col" className={`${TH} text-right`}>qty</th>
                <th scope="col" className={`${TH} pr-4 text-right`}>net</th>
              </tr>
            </thead>
            <tbody>
              {legs.map((l) => (
                <tr key={l.id} className="deck-row t-data text-[0.75rem]">
                  <td className={`${TD} pl-4`}>
                    {/* the side flips on a press, and wears the chain's colour.
                        The tint sits on the inner tag, so on touch, where
                        tap-floor lifts every button to 44px, the hit area
                        grows and the tag stays a 24px tag. */}
                    <button
                      type="button"
                      onClick={() => flipSide(l.id)}
                      className="group inline-flex items-center rounded-[6px]"
                    >
                      <span
                        className={`inline-flex h-6 min-w-[3.25rem] items-center justify-center rounded-[6px] px-2 font-mono text-[0.6875rem] uppercase tracking-[0.08em] transition-shadow group-hover:shadow-[inset_0_0_0_1px_currentColor] ${SIDE_TAG[l.side]}`}
                      >
                        {cap(l.side)}
                      </span>
                    </button>
                  </td>
                  <td className={`${TD} text-fg-dim`}>{l.type === "C" ? "call" : "put"}</td>
                  <td className={`${TD} text-fg`}>{l.strike.toFixed(l.strike < 100 ? 2 : 0)}</td>
                  <td className={`${TD} text-right text-fg-dim`}>${l.premium.toFixed(2)}</td>
                  <td className={`${TD} text-right`}>
                    <input
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => setQty(l.id, parseInt(e.target.value) || 1)}
                      className="w-12 rounded-[6px] border border-border bg-[var(--deck-sunk)] px-1.5 py-0.5 text-right text-fg outline-none transition-colors hover:border-[var(--deck-rule-hi)] focus:border-brand"
                    />
                  </td>
                  <td className={`${TD} pr-4 text-right ${l.side === "long" ? "text-bear" : "text-bull"}`}>
                    {l.side === "long" ? "−" : "+"}${(l.premium * l.qty * 100).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trade button — the screen's one green action */}
      {legs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3.5">
          <div className="text-[0.8125rem] text-fg-faint">
            Cash <span className="t-data text-fg">${cash.toLocaleString()}</span>
            <span className="mx-2">·</span>
            Cost <span className={`t-data ${cost > 0 ? "text-bear" : "text-bull"}`}>${Math.abs(cost).toFixed(0)}</span>
          </div>
          <button type="button" onClick={() => withBriefing(() => setTradeModal(true))} className="deck-btn deck-btn-primary">
            Paper trade
            <span aria-hidden className="deck-arrow">
              →
            </span>
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
            className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            onClick={() => setExplainOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              // capped at the viewport and scrolling inside, as PreTradeModal
              // and RiskWizard are: a long explanation on a 360px phone ran
              // past both edges of this centred box, out of reach.
              className="deck-pane max-h-[calc(100vh/var(--ui-zoom)-2rem)] w-full max-w-xl overflow-y-auto overscroll-contain shadow-[0_24px_60px_-24px_rgba(0,0,0,0.9)]"
            >
              <div className="flex h-11 items-center justify-between gap-3 border-b border-border pl-5 pr-3">
                <span className="deck-label">Teacher · {paywall ? "paused" : explanation?.source ?? "..."}</span>
                <button
                  type="button"
                  onClick={() => setExplainOpen(false)}
                  aria-label="Close"
                  className="grid size-8 place-items-center rounded-full text-fg-faint transition-colors hover:bg-[var(--deck-raised)] hover:text-fg"
                >
                  ✕
                </button>
              </div>
              <div className="p-6">
                <div className="deck-display text-[1.75rem] leading-[1.1] tracking-[-0.02em] text-fg">
                  {detection.kind}
                </div>
                <div className="mt-1.5 t-data text-[0.75rem] text-fg-faint">
                  On {underlying} · spot ${spot.toFixed(2)}
                </div>
                {paywall && !explainLoading ? (
                  <UpgradeNudge paywall={paywall} className="mt-4" />
                ) : (
                  <div className="mt-4 min-h-[7.5rem] whitespace-pre-line text-[0.9375rem] leading-relaxed text-fg-dim">
                    {explainLoading ? (
                      <span className="text-fg-faint">Teacher is thinking…</span>
                    ) : (
                      explanation?.text
                    )}
                  </div>
                )}
                {/* The AI-output disclosure travels with every response
                    (lib/billing/explain-policy.ts) and is rendered, not assumed. */}
                {!explainLoading && !paywall && explanation?.disclosure && (
                  <div className="mt-4 border-t border-border pt-3 text-[0.75rem] leading-relaxed text-fg-faint">
                    {explanation.disclosure}
                  </div>
                )}
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

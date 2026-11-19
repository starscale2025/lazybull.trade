"use client";

// The strategy builder's plain-English parts (owner, 2026-11-17: "simple to
// understand, gives the output in a good way"). Three things:
//
//   StrategyChoices  the example strategies as three side-by-side cards, each
//                    in words a newcomer can read: what it is, what it does,
//                    and — risk first — the most it can lose, the most it can
//                    make, the chance of profit and what it costs.
//   PayoffChart      the chosen strategy's profit and loss at expiry, large and
//                    labelled: today's price, the breakevens, the best and
//                    worst case.
//   howItPays        one sentence: the price condition under which it profits.
//
// Every number comes from the Strategy the generator built (lib/models.ts) or
// from the expiry payoff of its legs (lib/pricing.ts payoff); nothing here
// computes odds of its own.

import { useMemo } from "react";
import type { Strategy } from "@/lib/models";
import { payoff, pnlCurve, type Leg } from "@/lib/pricing";
import { PnlSparkline } from "./StrategyCards";

/** A plain name for each example's job, not its jargon. */
const JOB: Record<Strategy["id"], { tag: string; tone: string }> = {
  cheap: { tag: "Cheap & risky", tone: "text-amber" },
  income: { tag: "Get paid upfront", tone: "text-fg-dim" },
  aggressive: { tag: "Pick a direction, capped", tone: "text-fg-dim" },
  brought: { tag: "Your spread", tone: "text-bull" },
};

const legsOf = (s: Strategy): Leg[] => s.legs.map((l, i) => ({ id: `${s.id}-${i}`, ...l }));

/** "Iron condor 203.5/215 – 240/251.5" → "Iron condor"; the strikes are shown
    separately, as the contracts. */
export function familyName(kind: string): string {
  return kind
    .replace(/[\d.]+/g, "")
    .replace(/[/–-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loss and gain in words, never a broken number dressed as a risk statement. */
const lossText = (n: number) => (Number.isNaN(n) ? "—" : Number.isFinite(n) ? `$${Math.abs(n).toFixed(0)}` : "No limit");
const gainText = (n: number) => (Number.isNaN(n) ? "—" : Number.isFinite(n) ? `$${Math.abs(n).toFixed(0)}` : "No cap");

/** The price condition under which the position profits at expiry, read off
    its own payoff on either side of the breakevens. `when` is the whole time
    phrase: "on Dec 22", or "at expiry" before the browser's date is known. */
export function howItPays(s: Strategy, symbol: string, when: string): string {
  const legs = legsOf(s);
  const be = [...s.breakevens].sort((a, b) => a - b);
  const money = (n: number) => `$${n.toFixed(2)}`;
  if (be.length >= 2) {
    const lo = be[0];
    const hi = be[be.length - 1];
    const inside = payoff(legs, (lo + hi) / 2) > 0;
    return inside
      ? `It profits if ${symbol} ends between ${money(lo)} and ${money(hi)} ${when}.`
      : `It profits if ${symbol} ends below ${money(lo)} or above ${money(hi)} ${when}.`;
  }
  if (be.length === 1) {
    const above = payoff(legs, be[0] * 1.01) > 0;
    return `It profits if ${symbol} ends ${above ? "above" : "below"} ${money(be[0])} ${when}.`;
  }
  return `The chart shows how it pays ${when}.`;
}

/** The contracts, as a reader would say them: "Buy 226.5 call". */
function Contracts({ s }: { s: Strategy }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Contracts">
      {s.legs.map((l, i) => (
        <li
          key={i}
          className={`rounded-[6px] px-2 py-0.5 font-mono text-[0.6875rem] ${
            l.side === "long" ? "bg-[var(--deck-raised)] text-fg" : "bg-[var(--deck-raised)] text-fg-dim"
          }`}
        >
          {l.side === "long" ? "Buy" : "Sell"} {l.qty > 1 ? `${l.qty}× ` : ""}
          {l.strike} {l.type === "C" ? "call" : "put"}
        </li>
      ))}
    </ul>
  );
}

export function StrategyChoices({
  strategies,
  selectedId,
  onSelect,
  spot,
}: {
  strategies: Strategy[];
  selectedId: Strategy["id"] | null;
  onSelect: (s: Strategy) => void;
  spot: number;
}) {
  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${strategies.length > 3 ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}>
      {strategies.map((s) => {
        const chosen = selectedId === s.id;
        const job = JOB[s.id];
        return (
          <article
            key={s.id}
            onClick={() => onSelect(s)}
            className={`group flex cursor-pointer flex-col rounded-[14px] border p-5 transition-[border-color,background-color] duration-300 ${
              chosen
                ? "border-bull bg-[color-mix(in_srgb,var(--bull)_5%,var(--deck-pane))]"
                : "border-border bg-[var(--deck-pane)] hover:border-[var(--deck-rule-hi)]"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className={`deck-label ${job.tone}`}>{job.tag}</span>
              {chosen && <span className="deck-label text-bull">✓ Chosen</span>}
            </div>
            <h3 className="deck-display mt-3 text-[1.5rem] leading-tight tracking-[-0.02em] text-fg">{familyName(s.kind)}</h3>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-fg-dim">{s.blurb}</p>

            <PnlSparkline s={s} spot={spot} className="mt-4 h-16 w-full" />
            <div className="mt-3">
              <Contracts s={s} />
            </div>

            {/* Risk first: the deck's rule for the terminal. */}
            <dl className="mt-5 grid grid-cols-2 border-y border-border">
              <div className="py-3 pr-3">
                <dt className="text-[0.75rem] text-fg-faint">Most you can lose</dt>
                <dd className="mt-1 t-data text-[1.125rem] text-bear">{lossText(s.maxLoss)}</dd>
              </div>
              <div className="border-l border-border py-3 pl-4">
                <dt className="text-[0.75rem] text-fg-faint">Most you can make</dt>
                <dd className="mt-1 t-data text-[1.125rem] text-bull">{gainText(s.maxProfit)}</dd>
              </div>
              <div className="border-t border-border py-3 pr-3">
                <dt className="text-[0.75rem] text-fg-faint">Chance of profit</dt>
                <dd className="mt-1 t-data text-[1.125rem] text-fg">{(s.prob * 100).toFixed(0)}%</dd>
              </div>
              <div className="border-l border-t border-border py-3 pl-4">
                <dt className="text-[0.75rem] text-fg-faint">{s.cost > 0 ? "You pay" : "You get paid"}</dt>
                <dd className="mt-1 t-data text-[1.125rem] text-fg">${Math.abs(s.cost).toFixed(0)}</dd>
              </div>
            </dl>

            <button
              type="button"
              aria-pressed={chosen}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(s);
              }}
              className={`deck-btn deck-btn-sm mt-5 w-full ${chosen ? "!text-bull" : ""}`}
            >
              {chosen ? "Chosen · see below" : "Choose this"}
              {!chosen && (
                <span aria-hidden className="deck-arrow">
                  ↓
                </span>
              )}
            </button>
          </article>
        );
      })}
    </div>
  );
}

/**
 * Profit and loss at expiry, large: green above $0, red below, today's price
 * and the breakevens marked and labelled. The SVG stretches to its box; the
 * labels are HTML laid over it, so type never smears.
 */
export function PayoffChart({ s, spot, symbol }: { s: Strategy; spot: number; symbol: string }) {
  const W = 600;
  const H = 240;
  const geom = useMemo(() => {
    const curve = pnlCurve(legsOf(s), spot, 0.3, 121);
    const xs = curve.map((p) => p.s);
    const ys = curve.map((p) => p.pnl);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const top = Math.max(0, ...ys);
    const bottom = Math.min(0, ...ys);
    const pad = (top - bottom || 1) * 0.12;
    const yHi = top + pad;
    const yLo = bottom - pad;
    // Rounded to a tenth: Black-Scholes premiums differ in the last digits
    // between Node and the browser, and an unrounded coordinate would carry
    // that into the DOM (see the same guard in StrategyCards' Sparkline).
    const xOf = (x: number) => ((x - xMin) / (xMax - xMin)) * W;
    const yOf = (y: number) => ((yHi - y) / (yHi - yLo)) * H;
    const r = (n: number) => n.toFixed(1);
    const line = curve.map((p, i) => `${i ? "L" : "M"}${r(xOf(p.s))},${r(yOf(p.pnl))}`).join(" ");
    const y0 = yOf(0);
    const up = curve.map((p) => `L${r(xOf(p.s))},${r(yOf(Math.max(0, p.pnl)))}`).join(" ");
    const dn = curve.map((p) => `L${r(xOf(p.s))},${r(yOf(Math.min(0, p.pnl)))}`).join(" ");
    return {
      line,
      profit: `M0,${r(y0)} ${up} L${W},${r(y0)} Z`,
      loss: `M0,${r(y0)} ${dn} L${W},${r(y0)} Z`,
      y0: r(y0),
      y0Pct: (y0 / H) * 100,
      pct: (x: number) => ((x - xMin) / (xMax - xMin)) * 100,
      inView: (x: number) => x >= xMin && x <= xMax,
      xSpot: r(xOf(spot)),
    };
  }, [s, spot]);

  const bes = s.breakevens.filter(geom.inView);
  const topLabel = Number.isFinite(s.maxProfit) ? `Best case +$${Math.abs(s.maxProfit).toFixed(0)}` : "Profit keeps growing ↑";
  const bottomLabel = Number.isFinite(s.maxLoss) ? `Worst case −$${Math.abs(s.maxLoss).toFixed(0)}` : "Loss keeps growing ↓";

  return (
    <figure className="flex h-full flex-col">
      <div className="relative min-h-[15rem] flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d={geom.profit} fill="var(--bull)" fillOpacity="0.14" />
          <path d={geom.loss} fill="var(--bear)" fillOpacity="0.14" />
          <line x1="0" x2={W} y1={geom.y0} y2={geom.y0} stroke="var(--deck-rule-hi, var(--border))" vectorEffect="non-scaling-stroke" />
          <line x1={geom.xSpot} x2={geom.xSpot} y1="0" y2={H} stroke="var(--cyan)" strokeOpacity="0.7" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          {bes.map((b) => (
            <line
              key={b}
              x1={((geom.pct(b) / 100) * W).toFixed(1)}
              x2={((geom.pct(b) / 100) * W).toFixed(1)}
              y1="0"
              y2={H}
              stroke="var(--fg-faint)"
              strokeDasharray="2 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={geom.line} fill="none" stroke="var(--fg)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute left-2 top-1 font-mono text-[0.6875rem] text-bull">{topLabel}</span>
        <span className="absolute bottom-1 left-2 font-mono text-[0.6875rem] text-bear">{bottomLabel}</span>
        <span
          className="absolute right-2 -translate-y-full pb-0.5 font-mono text-[0.6875rem] text-fg-faint"
          style={{ top: `${geom.y0Pct}%` }}
        >
          $0
        </span>
        {/* Today's label shares the bottom edge with the worst case: on a
            phone there is no room for both, so the caption carries it there. */}
        <span
          className="absolute bottom-1 -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-[var(--deck-pane,var(--bg))] px-1 font-mono text-[0.6875rem] text-cyan max-sm:hidden"
          style={{ left: `${geom.pct(spot)}%` }}
        >
          Today ${spot.toFixed(2)}
        </span>
        {/* Two breakevens sit on alternate rows, so their labels never overlap. */}
        {bes.map((b, i) => (
          <span
            key={b}
            className="absolute -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-[var(--deck-pane,var(--bg))] px-1 font-mono text-[0.6875rem] text-fg-dim"
            style={{ left: `${geom.pct(b)}%`, top: i % 2 ? "2.75rem" : "1.5rem" }}
          >
            <span className="max-sm:hidden">Breakeven </span>
            <span className="sm:hidden">B/E </span>${b.toFixed(2)}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 text-[0.8125rem] leading-relaxed text-fg-faint">
        Profit or loss at expiry for one {familyName(s.kind).toLowerCase()} on {symbol}, across prices 30% either side of
        today. Green is profit, red is loss. The blue dashed line is today&rsquo;s price (${spot.toFixed(2)}); dotted lines
        mark the breakevens.
      </figcaption>
    </figure>
  );
}

"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import type { Strategy } from "@/lib/models";
import { pnlCurve, type Leg } from "@/lib/pricing";
import { Chip, ToolButton, type ChipTone } from "@/components/calm/kit";

type Props = {
  strategies: Strategy[];
  selectedId: Strategy["id"] | null;
  onSelect: (s: Strategy) => void;
  onPlace: (s: Strategy) => void;
  spot: number;
  symbol: string;
  /** 1 = stacked (right-rail panel), 3 = the classic three-across row (default). */
  columns?: 1 | 3;
  /** Dense app-shell mode: three slim selectable rows instead of full cards. */
  compact?: boolean;
};

// `color` strokes the payoff line. The label is the one Chip, and only the label
// that names a risk takes a tone.
const TONE: Record<Strategy["id"], { label: string; color: string; chip: ChipTone }> = {
  cheap: { label: "Cheap & risky", color: "var(--plasma)", chip: "warn" },
  income: { label: "Defined-risk credit", color: "var(--bull)", chip: "neutral" },
  // This pill read "Aggressive" in --bear. Red means loss on this site, so it
  // coloured a judgement as an outcome, on a spread whose loss is capped at the
  // debit. It is named for what it is now: a debit spread that takes a side.
  // --cyan is the palette's data colour (spot, strikes, data strokes), never
  // gain or loss.
  // The `aggressive` key stays: it is an id, never shown.
  aggressive: { label: "Directional debit", color: "var(--cyan)", chip: "neutral" },
  brought: { label: "Your spread", color: "var(--brand-ink)", chip: "brand" },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function StrategyCards({ strategies, selectedId, onSelect, onPlace, spot, symbol, columns = 3, compact = false }: Props) {
  if (compact) {
    return (
      <div className="-mx-2 mt-2 flex flex-col">
        {strategies.map((s) => {
          const selected = selectedId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              aria-pressed={selected}
              title={TONE[s.id].label}
              className={`flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${
                selected ? "bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]" : "hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]"
              }`}
            >
              <span
                aria-hidden
                className={`size-2 shrink-0 rounded-full ${selected ? "bg-[image:var(--grad-fill)]" : "bg-[color-mix(in_srgb,var(--fg)_22%,transparent)]"}`}
              />
              <span className="min-w-0 flex-1 text-[0.875rem] leading-snug text-fg">{s.kind}</span>
              <span className="shrink-0 t-label tabular-nums text-fg-dim">
                {s.cost > 0 ? "Pay" : "Collect"} ${Math.abs(s.cost).toFixed(0)}
              </span>
              <span className="w-9 shrink-0 text-right t-data text-[0.75rem] text-fg" title="Probability of profit at expiry">
                {(s.prob * 100).toFixed(0)}%
              </span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className={`grid grid-cols-1 gap-px bg-border ${columns === 3 ? "md:grid-cols-3" : ""}`}>
      {strategies.map((s, i) => (
        <Card
          key={s.id}
          s={s}
          spot={spot}
          symbol={symbol}
          selected={selectedId === s.id}
          onSelect={() => onSelect(s)}
          onPlace={() => onPlace(s)}
          delay={i * 0.06}
        />
      ))}
    </div>
  );
}

function Card({ s, spot, symbol, selected, onSelect, onPlace, delay }: { s: Strategy; spot: number; symbol: string; selected: boolean; onSelect: () => void; onPlace: () => void; delay: number }) {
  const tone = TONE[s.id];
  const curve = useMemo(() => {
    const legs: Leg[] = s.legs.map((l, i) => ({ id: `${s.id}-${i}`, ...l }));
    return pnlCurve(legs, spot, 0.35, 81);
  }, [s.legs, s.id, spot]);
  const fmt = (n: number) =>
    Number.isFinite(n) ? `${n >= 0 ? "+" : "−"}$${Math.abs(n).toFixed(0)}` : (n > 0 ? "unbounded ↑" : "unbounded ↓");

  // factual chips, all derived from the strategy itself (never invented)
  const definedRisk = Number.isFinite(s.maxLoss);
  const chips: string[] = [s.cost > 0 ? "Debit" : "Credit", cap(s.bias), ...(definedRisk ? ["Defined risk"] : [])];
  // R:R only when both sides are finite and the loss side is non-zero
  const rr =
    Number.isFinite(s.maxProfit) && definedRisk && Math.abs(s.maxLoss) > 0
      ? s.maxProfit / Math.abs(s.maxLoss)
      : null;
  const rail: { k: string; v: string; c?: string }[] = [
    { k: "Max profit", v: fmt(s.maxProfit) },
    { k: "Max loss", v: fmt(s.maxLoss) },
    ...(s.breakevens.length
      ? [{ k: "Breakeven", v: s.breakevens.map((b) => b.toFixed(2)).join(" / ") }]
      : []),
    { k: "POP", v: `${(s.prob * 100).toFixed(0)}%`, c: "text-bull" },
    ...(rr != null ? [{ k: "R:R", v: rr.toFixed(2) }] : []),
  ];

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -2 }}
      className={`group relative flex cursor-pointer flex-col gap-4 p-5 text-left transition-colors ${
        selected ? "bg-surface" : "bg-bg hover:bg-surface"
      }`}
    >
      {/* selection ring */}
      {selected && (
        <span className="pointer-events-none absolute inset-0 border-2 border-brand-ink" />
      )}

      {/* header */}
      <div className="flex items-center justify-between">
        <Chip tone={tone.chip}>{tone.label}</Chip>
        <span className="t-label text-fg-faint tabular-nums">
          {s.cost > 0 ? "You pay" : "You collect"} ${Math.abs(s.cost).toFixed(0)}
        </span>
      </div>

      {/* strategy title + fact chips */}
      <div>
        <div className="font-display text-2xl tracking-tightest leading-[1.05] text-fg">{s.kind}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {chips.map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
      </div>

      {/* mini P&L sparkline */}
      <Sparkline curve={curve} spot={spot} color={tone.color} />

      {/* stat rail */}
      <div className="h-px bg-border-soft" />
      <div className="flex flex-col gap-1.5">
        {rail.map((it) => (
          <div key={it.k} className="flex items-baseline justify-between gap-3">
            <span className="t-label text-fg-faint">{it.k}</span>
            <span className={`text-right t-data text-sm ${it.c ?? "text-fg"}`}>{it.v}</span>
          </div>
        ))}
      </div>

      {/* blurb */}
      <p className="t-body-sm text-fg">{s.blurb}</p>

      {/* place button */}
      <div className="mt-auto pt-2">
        <ToolButton
          primary={selected}
          onClick={(e) => { e.stopPropagation(); onPlace(); }}
          className="w-full !h-11 !justify-between lg:!h-9"
        >
          <span>Place paper trade on {symbol}</span>
          <span>→</span>
        </ToolButton>
      </div>
    </motion.div>
  );
}

/** Payoff sparkline for the selected strategy — reused by the app-shell strategy panel. */
export function PnlSparkline({ s, spot, className = "h-20 w-full" }: { s: Strategy; spot: number; className?: string }) {
  const curve = useMemo(() => {
    const legs: Leg[] = s.legs.map((l, i) => ({ id: `${s.id}-${i}`, ...l }));
    return pnlCurve(legs, spot, 0.35, 81);
  }, [s.legs, s.id, spot]);
  return <Sparkline curve={curve} spot={spot} color={TONE[s.id].color} className={className} />;
}

/** PnlSparkline's frame with nothing drawn in it: /trade before the visitor
 *  picks an example. The $0 line and the dashed spot marker are Sparkline's
 *  own, in the same places (pnlCurve samples spot ± 35%, so spot sits dead
 *  centre in both), so picking an example only adds the curve. The marker drops
 *  from the axis to its label instead of spanning the frame, which keeps the
 *  upper half clear for the note. No legs and no strikes: an empty frame must
 *  never sketch a position. Labels are HTML because the SVG stretches
 *  (preserveAspectRatio="none") and would smear text. */
export function EmptyPnlSparkline({ spot, note, className = "h-20 w-full" }: { spot: number; note: string; className?: string }) {
  const w = 280, h = 84;
  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        {/* Sparkline draws $0 in --border and lets its fills carry the edge.
            Alone, the axis is the whole picture, so it steps up to --fg-faint. */}
        <line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="var(--fg-faint)" strokeOpacity="0.6" vectorEffect="non-scaling-stroke" />
        <line x1={w / 2} x2={w / 2} y1={h / 2} y2={h} stroke="var(--cyan)" strokeOpacity="0.4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      </svg>
      <span aria-hidden className="absolute left-0 top-1/2 -translate-y-full whitespace-nowrap pb-0.5 t-chrome text-fg-faint">$0</span>
      <span aria-hidden className="absolute bottom-0 left-1/2 whitespace-nowrap pl-1.5 t-label tabular-nums text-fg-faint">
        Spot ${spot.toFixed(2)}
      </span>
      <p className="absolute inset-x-3 top-1/4 -translate-y-1/2 text-balance text-center t-label text-fg-dim">{note}</p>
    </div>
  );
}

function Sparkline({ curve, spot, color, className = "h-20 w-full" }: { curve: { s: number; pnl: number }[]; spot: number; color: string; className?: string }) {
  if (!curve.length) return null;
  const w = 280, h = 84;
  const xs = curve.map((p) => p.s);
  const ys = curve.map((p) => p.pnl);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const range = yMax - yMin || 1;
  // Both projections round here rather than at each call site. The payoff curve
  // comes out of Black-Scholes, and Math.exp/Math.log aren't specified to the
  // last ULP — Node and the browser disagree in the final digits. An unrounded
  // coordinate carries that disagreement into the DOM, where React reads it as
  // a hydration mismatch. One decimal is all the viewBox can resolve anyway.
  const xOf = (x: number) => (((x - xMin) / (xMax - xMin)) * w).toFixed(1);
  const yOf = (y: number) => (h - ((y - yMin) / range) * h).toFixed(1);
  const yZero = yOf(0);
  const path = curve.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.s)},${yOf(p.pnl)}`).join(" ");
  const filledTop = curve.map((p) => `L${xOf(p.s)},${yOf(Math.max(0, p.pnl))}`).join(" ");
  const filledBot = curve.map((p) => `L${xOf(p.s)},${yOf(Math.min(0, p.pnl))}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id={`g-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--bull)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--bull)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M${xOf(xMin)},${yZero} ${filledTop} L${xOf(xMax)},${yZero} Z`} fill="var(--bull)" fillOpacity="0.15" />
      <path d={`M${xOf(xMin)},${yZero} ${filledBot} L${xOf(xMax)},${yZero} Z`} fill="var(--bear)" fillOpacity="0.15" />
      <line x1="0" x2={w} y1={yZero} y2={yZero} stroke="var(--border)" />
      <line x1={xOf(spot)} x2={xOf(spot)} y1="0" y2={h} stroke="var(--cyan)" strokeOpacity="0.4" strokeDasharray="3 3" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

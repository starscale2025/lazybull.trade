"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
import type { Strategy } from "@/lib/models";
import { pnlCurve, type Leg } from "@/lib/pricing";

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

const TONE: Record<Strategy["id"], { label: string; color: string; pillBg: string }> = {
  cheap: { label: "Cheap & risky", color: "var(--plasma)", pillBg: "rgba(201,255,0,0.12)" },
  income: { label: "Defined-risk income", color: "var(--bull)", pillBg: "rgba(0,255,135,0.12)" },
  aggressive: { label: "Aggressive", color: "var(--bear)", pillBg: "rgba(255,46,99,0.12)" },
};

/** Shared tone map so the strategy panel (page shell) can color its detail block consistently. */
export const STRATEGY_TONE = TONE;

export function StrategyCards({ strategies, selectedId, onSelect, onPlace, spot, symbol, columns = 3, compact = false }: Props) {
  if (compact) {
    return (
      <div className="flex flex-col divide-y divide-border-soft">
        {strategies.map((s) => {
          const tone = TONE[s.id];
          const selected = selectedId === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className={`relative flex flex-col gap-1 px-3 py-2 text-left font-mono transition-colors ${
                selected ? "bg-surface" : "bg-bg hover:bg-surface"
              }`}
            >
              {selected && (
                <span className="pointer-events-none absolute inset-y-0 left-0 w-0.5" style={{ background: tone.color }} aria-hidden />
              )}
              {/* line 1: the fixed-width chrome */}
              <span className="flex items-center gap-2">
                <span
                  className="inline-flex shrink-0 items-center gap-1.5 px-1.5 py-0.5 t-chrome"
                  style={{ color: tone.color, background: tone.pillBg }}
                >
                  <span className="size-1 rounded-full" style={{ background: tone.color }} />
                  {tone.label}
                </span>
                <span className="ml-auto shrink-0 t-chrome text-fg-faint tabular-nums">
                  {s.cost > 0 ? "pay" : "collect"} ${Math.abs(s.cost).toFixed(0)}
                </span>
                <span className="w-9 shrink-0 text-right t-data text-[11px] text-bull">{(s.prob * 100).toFixed(0)}%</span>
              </span>
              {/* line 2: the payload — name + strikes, never truncated */}
              <span className="text-[11px] leading-snug text-fg">{s.kind}</span>
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
  const chips: string[] = [s.cost > 0 ? "debit" : "credit", s.bias, ...(definedRisk ? ["defined risk"] : [])];
  // R:R only when both sides are finite and the loss side is non-zero
  const rr =
    Number.isFinite(s.maxProfit) && definedRisk && Math.abs(s.maxLoss) > 0
      ? s.maxProfit / Math.abs(s.maxLoss)
      : null;
  const rail: { k: string; v: string; c?: string }[] = [
    { k: "max profit", v: fmt(s.maxProfit) },
    { k: "max loss", v: fmt(s.maxLoss) },
    ...(s.breakevens.length
      ? [{ k: "breakeven", v: s.breakevens.map((b) => b.toFixed(2)).join(" / ") }]
      : []),
    { k: "pop", v: `${(s.prob * 100).toFixed(0)}%`, c: "text-bull" },
    ...(rr != null ? [{ k: "r:r", v: rr.toFixed(2) }] : []),
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
        <span className="pointer-events-none absolute inset-0 border-2" style={{ borderColor: tone.color }} />
      )}

      {/* header */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-2 py-1 t-chrome" style={{ color: tone.color, background: tone.pillBg }}>
          <span className="size-1.5 rounded-full" style={{ background: tone.color }} />
          {tone.label}
        </div>
        <span className="t-chrome text-fg-faint tabular-nums">
          {s.cost > 0 ? "you pay" : "you collect"} ${Math.abs(s.cost).toFixed(0)}
        </span>
      </div>

      {/* strategy title + fact chips */}
      <div>
        <div className="font-display text-2xl uppercase tracking-tightest leading-[1.05] text-fg">{s.kind}</div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {chips.map((c, i) => (
            <span
              key={c}
              className={`border px-1.5 py-0.5 t-chrome ${
                i === 0 ? "border-bull/60 text-bull" : "border-border text-fg-dim"
              }`}
            >
              {c}
            </span>
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
            <span className="t-chrome text-fg-faint">{it.k}</span>
            <span className={`text-right t-data text-sm ${it.c ?? "text-fg"}`}>{it.v}</span>
          </div>
        ))}
      </div>

      {/* blurb */}
      <p className="t-body-sm text-fg">{s.blurb}</p>

      {/* place button */}
      <div className="mt-auto pt-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlace(); }}
          className="inline-flex w-full items-center justify-between border px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors lg:py-2.5"
          style={{ borderColor: tone.color, color: tone.color, background: selected ? tone.pillBg : "transparent" }}
        >
          <span className="inline-flex items-center gap-2">
            <span className="size-1.5 rounded-full pulse-dot" style={{ background: tone.color }} />
            place this bet on {symbol}
          </span>
          <span>→</span>
        </button>
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

function Sparkline({ curve, spot, color, className = "h-20 w-full" }: { curve: { s: number; pnl: number }[]; spot: number; color: string; className?: string }) {
  if (!curve.length) return null;
  const w = 280, h = 84;
  const xs = curve.map((p) => p.s);
  const ys = curve.map((p) => p.pnl);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const range = yMax - yMin || 1;
  const xOf = (x: number) => ((x - xMin) / (xMax - xMin)) * w;
  const yOf = (y: number) => h - ((y - yMin) / range) * h;
  const yZero = yOf(0);
  const path = curve.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.s).toFixed(1)},${yOf(p.pnl).toFixed(1)}`).join(" ");
  const filledTop = curve.map((p) => `L${xOf(p.s).toFixed(1)},${yOf(Math.max(0, p.pnl)).toFixed(1)}`).join(" ");
  const filledBot = curve.map((p) => `L${xOf(p.s).toFixed(1)},${yOf(Math.min(0, p.pnl)).toFixed(1)}`).join(" ");
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

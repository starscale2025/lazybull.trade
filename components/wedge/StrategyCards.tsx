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
};

const TONE: Record<Strategy["id"], { label: string; color: string; pillBg: string }> = {
  cheap: { label: "Cheap & risky", color: "var(--plasma)", pillBg: "rgba(201,255,0,0.12)" },
  income: { label: "Defined-risk income", color: "var(--bull)", pillBg: "rgba(0,255,135,0.12)" },
  aggressive: { label: "Aggressive", color: "var(--bear)", pillBg: "rgba(255,46,99,0.12)" },
};

export function StrategyCards({ strategies, selectedId, onSelect, onPlace, spot, symbol }: Props) {
  return (
    <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-3">
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
        <div className="inline-flex items-center gap-2 px-2 py-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: tone.color, background: tone.pillBg }}>
          <span className="size-1.5 rounded-full" style={{ background: tone.color }} />
          {tone.label}
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">{s.id === "income" ? "credit" : "debit"}</span>
      </div>

      {/* headline numbers */}
      <div>
        <div className="font-display text-4xl tracking-tightest leading-none" style={{ color: tone.color }}>
          {fmt(s.maxProfit)}
        </div>
        <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
          best case · max profit
        </div>
      </div>

      {/* mini P&L sparkline */}
      <Sparkline curve={curve} spot={spot} color={tone.color} />

      {/* secondary stats */}
      <div className="grid grid-cols-3 gap-px bg-border-soft">
        {[
          { k: "Risk", v: fmt(s.maxLoss), c: "text-bear" },
          { k: "Cost", v: `${s.cost >= 0 ? "" : "+"}$${Math.abs(s.cost).toFixed(0)}`, c: s.cost >= 0 ? "text-fg-dim" : "text-bull" },
          { k: "Win odds", v: `${(s.prob * 100).toFixed(0)}%`, c: "text-fg" },
        ].map((it) => (
          <div key={it.k} className="bg-bg p-2">
            <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">{it.k}</div>
            <div className={`mt-0.5 font-mono text-sm tabular-nums ${it.c}`}>{it.v}</div>
          </div>
        ))}
      </div>

      {/* leg recipe */}
      <div className="font-mono text-[11px] text-fg-dim">{s.kind}</div>

      {/* blurb */}
      <p className="text-sm leading-relaxed text-fg">{s.blurb}</p>

      {/* place button */}
      <div className="mt-auto pt-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPlace(); }}
          className="inline-flex w-full items-center justify-between border px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors"
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

function Sparkline({ curve, spot, color }: { curve: { s: number; pnl: number }[]; spot: number; color: string }) {
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
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-20 w-full">
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

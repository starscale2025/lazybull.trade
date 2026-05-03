"use client";

import { motion, AnimatePresence } from "motion/react";
import { useMemo } from "react";
import { type Bet, storySentence } from "./PositionStory";
import { priceOption } from "@/lib/pricing";

type Props = {
  bets: Bet[];
  liveSpot: number;
  iv: number;
  onClose: (id: string, pnl: number) => void;
  onRoll: (b: Bet) => void;
};

function valueLive(b: Bet, spotAt: number, iv: number) {
  const daysLeft = Math.max(1, Math.ceil((new Date(b.expiry).getTime() - Date.now()) / 86_400_000));
  const t = daysLeft / 365;
  let v = 0;
  for (const l of b.strategy.legs) {
    const { price } = priceOption(spotAt, l.strike, t, 0.045, iv, l.type);
    const sign = l.side === "long" ? 1 : -1;
    v += sign * (price - l.premium) * l.qty * 100;
  }
  return { value: v, daysLeft };
}

function recommendation(b: Bet, spotAt: number, iv: number) {
  const { value, daysLeft } = valueLive(b, spotAt, iv);
  const target = b.strategy.maxProfit === Infinity ? 200 : b.strategy.maxProfit * 0.6;
  if (value >= target && Number.isFinite(target))
    return { tone: "var(--bull)", text: `Take profit now — you've captured ${((value / target) * 100).toFixed(0)}% of the move.` };
  if (value <= -Math.abs(b.strategy.maxLoss) * 0.7 && Number.isFinite(b.strategy.maxLoss))
    return { tone: "var(--bear)", text: `Pain trade — consider closing or rolling. You're at ${((value / b.strategy.maxLoss) * 100).toFixed(0)}% of max loss.` };
  if (daysLeft <= 7)
    return { tone: "var(--amber)", text: `Inside the danger week — gamma blows up. Roll to next month for ~$${Math.max(20, Math.round(b.strategy.maxLoss * 0.1)).toFixed(0)}.` };
  if (spotAt > b.thesisLow && spotAt < b.thesisHigh)
    return { tone: "var(--bull)", text: "On track — stock is sitting inside your thesis zone." };
  return { tone: "var(--cyan)", text: `Outside the zone but still ${daysLeft}d to expiry — let theta cook.` };
}

export function ManagePanel({ bets, liveSpot, iv, onClose, onRoll }: Props) {
  const open = bets.filter((b) => b.status === "open");

  return (
    <div className="border border-border bg-bg">
      <div className="flex items-center justify-between border-b border-border-soft px-5 py-3 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
        <span>open bets · {open.length}</span>
        <span className="text-fg-faint">live priced from /api/quote</span>
      </div>

      <AnimatePresence initial={false}>
        {open.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-5 py-10 text-center font-mono text-[11px] text-fg-faint"
          >
            you haven't placed a bet yet — pick one of the cards above
          </motion.div>
        )}

        {open.map((b, i) => {
          const { value, daysLeft } = valueLive(b, liveSpot, iv);
          const rec = recommendation(b, liveSpot, iv);
          return (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ delay: 0.04 * i }}
              className="border-b border-border-soft p-5"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="font-display text-2xl tracking-tightest">{b.strategy.kind}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    {b.symbol} · expiry {b.expiry} · {daysLeft}d left
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">live P&L</div>
                  <div className={`font-display text-3xl tracking-tightest tabular-nums ${value >= 0 ? "text-bull" : "text-bear"}`}>
                    {value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(0)}
                  </div>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-fg">{storySentence(b)}</p>

              <div className="mt-3 flex items-start gap-2 border-l-2 px-3 py-2" style={{ borderColor: rec.tone, background: `color-mix(in srgb, ${rec.tone} 10%, transparent)` }}>
                <span className="mt-0.5 text-base" style={{ color: rec.tone }}>◆</span>
                <span className="text-[13px] leading-snug text-fg">{rec.text}</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onClose(b.id, value)}
                  className="border border-border bg-bg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-bear hover:text-bear"
                >
                  close · book {value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(0)}
                </button>
                <button
                  onClick={() => onRoll(b)}
                  className="border border-border bg-bg px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-cyan hover:text-cyan"
                >
                  roll to next month
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Closed history */}
      {bets.some((b) => b.status === "closed") && (
        <div className="border-t border-border bg-bg-soft p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">recent · closed</div>
          <ul className="space-y-1">
            {bets.filter((b) => b.status === "closed").slice(0, 4).map((b) => (
              <li key={b.id} className="flex items-center justify-between border-b border-border-soft py-1 font-mono text-[11px] tabular-nums">
                <span className="text-fg-dim">{b.symbol} · {b.strategy.kind}</span>
                <span className={(b.closedPnl ?? 0) >= 0 ? "text-bull" : "text-bear"}>
                  {(b.closedPnl ?? 0) >= 0 ? "+" : "−"}${Math.abs(b.closedPnl ?? 0).toFixed(0)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

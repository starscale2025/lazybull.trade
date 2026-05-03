"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MODEL_META, probAll, spreadBetween, type ModelKey } from "@/lib/models";

type Props = { spot: number; low: number; high: number; daysToExpiry: number; iv: number };

const DEFAULT_USER_CODE = `// Returns probability stock lands in [input.low, input.high] at expiry.
// You have access to: input.spot, low, high, daysToExpiry, iv, rate
// and the standard math namespace.

const t = input.daysToExpiry / 365;
const sigT = input.iv * math.sqrt(t);
const u = math.log(input.high / input.spot) / sigT;
const l = math.log(input.low / input.spot) / sigT;
// crude normal CDF approximation
const N = (x) => 0.5 * (1 + math.tanh(math.sqrt(2/math.PI) * x));
return N(u) - N(l);`;

export function ModelSpread({ spot, low, high, daysToExpiry, iv }: Props) {
  const [userCode, setUserCode] = useState(DEFAULT_USER_CODE);
  const [byoOpen, setByoOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const probs = useMemo(() => {
    setRunning(true);
    const p = probAll({ spot, low, high, daysToExpiry, iv }, userCode);
    setTimeout(() => setRunning(false), 50);
    return p;
  }, [spot, low, high, daysToExpiry, iv, userCode]);

  const spread = spreadBetween(probs);
  const order: ModelKey[] = ["bs", "vs", "mc", "emp", "heston", "user"];
  const consensus = (() => {
    const vs = Object.values(probs).filter((v): v is number => v != null);
    if (!vs.length) return 0;
    return vs.reduce((a, b) => a + b, 0) / vs.length;
  })();

  return (
    <div className="border border-border bg-bg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">Model spread</span>
          <span className="border border-border bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fg">consensus {(consensus * 100).toFixed(0)}%</span>
          <span
            className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${
              spread > 0.12 ? "border-amber/50 bg-amber/10 text-amber" : "border-bull/50 bg-bull/10 text-bull"
            }`}
          >
            spread {(spread * 100).toFixed(0)} pts {spread > 0.12 ? "· high uncertainty" : "· tight"}
          </span>
        </div>
        <button
          onClick={() => setByoOpen((v) => !v)}
          className="border border-border bg-bg px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim hover:border-fg-dim hover:text-fg"
        >
          + bring your own model
        </button>
      </div>

      <div className="space-y-1 p-5">
        {order.map((k, i) => {
          const meta = MODEL_META[k];
          const v = probs[k];
          const disabled = v == null;
          const winner = !disabled && Math.abs(v - Math.max(...Object.values(probs).filter((x): x is number => x != null))) < 1e-9;
          const loser = !disabled && Math.abs(v - Math.min(...Object.values(probs).filter((x): x is number => x != null))) < 1e-9;
          return (
            <motion.div
              key={k}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i }}
              className={`grid grid-cols-12 items-center gap-3 border bg-surface px-3 py-2 ${
                disabled ? "opacity-40" : ""
              }`}
              style={{ borderColor: disabled ? "var(--border)" : meta.tone, borderLeftWidth: 3 }}
            >
              <div className="col-span-3 flex items-center gap-2">
                <span className="font-mono text-[10px]" style={{ color: meta.tone }}>{meta.short}</span>
                <span className="font-display text-sm tracking-tightest text-fg">{meta.label}</span>
              </div>
              <div className="col-span-7">
                <div className="relative h-2 w-full bg-bg">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(v ?? 0) * 100}%` }}
                    transition={{ type: "spring", stiffness: 220, damping: 30 }}
                    className="absolute inset-y-0 left-0"
                    style={{ background: meta.tone, opacity: disabled ? 0.3 : 1 }}
                  />
                </div>
                <div className="mt-0.5 font-mono text-[9px] tracking-normal text-fg-faint">{meta.explain}</div>
              </div>
              <div className="col-span-2 flex items-center justify-end gap-1.5 font-mono tabular-nums">
                <span className="text-base text-fg">{v != null ? `${(v * 100).toFixed(0)}%` : "—"}</span>
                {winner && <span className="text-bull text-[10px]">↑</span>}
                {loser && <span className="text-bear text-[10px]">↓</span>}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {byoOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border-soft"
          >
            <div className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  Your model · runs in a sandboxed Function constructor
                </div>
                {running && <span className="font-mono text-[10px] text-cyan animate-pulse">re-evaluating…</span>}
              </div>
              <textarea
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                spellCheck={false}
                rows={12}
                className="w-full resize-y border border-border bg-bg p-3 font-mono text-[11px] text-fg outline-none focus:border-cyan"
              />
              <div className="mt-2 flex items-center justify-between font-mono text-[10px] tracking-wider text-fg-faint">
                <span>output: <span className={probs.user != null ? "text-bull" : "text-bear"}>{probs.user != null ? `${(probs.user * 100).toFixed(2)}%` : "error / not a number"}</span></span>
                <span>roadmap: marketplace + accuracy leaderboard</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

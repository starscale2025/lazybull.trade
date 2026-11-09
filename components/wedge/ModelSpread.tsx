"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MODEL_META, probAll, spreadBetween, type ModelKey } from "@/lib/models";
import { Chip, ToolButton } from "@/components/calm/kit";

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
    <div className="bg-bg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="t-label text-fg-dim">Model spread</span>
          <Chip>Consensus {(consensus * 100).toFixed(0)}%</Chip>
          <Chip tone={spread > 0.12 ? "warn" : "neutral"}>
            Spread {(spread * 100).toFixed(0)} pts {spread > 0.12 ? "· high uncertainty" : "· tight"}
          </Chip>
        </div>
        <ToolButton onClick={() => setByoOpen((v) => !v)} className="!h-6 !px-2.5 !text-[0.75rem]">
          + Bring your own model
        </ToolButton>
      </div>

      <div className="space-y-1 p-3">
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
                <span className="font-mono text-[0.625rem]" style={{ color: meta.tone }}>{meta.short}</span>
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
                <div className="mt-0.5 text-[0.6875rem] text-fg-faint">{meta.explain}</div>
              </div>
              <div className="col-span-2 flex items-center justify-end gap-1.5 t-data">
                <span className="text-base text-fg">{v != null ? `${(v * 100).toFixed(0)}%` : "—"}</span>
                {winner && <span className="text-fg-dim text-[0.625rem]">↑</span>}
                {loser && <span className="text-fg-dim text-[0.625rem]">↓</span>}
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
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="t-label text-fg-dim">
                  Your model · runs in a sandboxed Function constructor
                </div>
                {running && <span className="t-label text-fg-faint">Re-evaluating…</span>}
              </div>
              <textarea
                value={userCode}
                onChange={(e) => setUserCode(e.target.value)}
                spellCheck={false}
                rows={12}
                className="w-full resize-y border border-border bg-bg p-3 font-mono text-[0.6875rem] text-fg outline-none focus:border-cyan"
              />
              <div className="mt-2 flex items-center justify-between t-label text-fg-faint">
                <span>Output: <span className={probs.user != null ? "text-bull" : "text-bear"}>{probs.user != null ? `${(probs.user * 100).toFixed(2)}%` : "error / not a number"}</span></span>
                <span>Roadmap: marketplace + accuracy leaderboard</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSafety } from "@/lib/stores";
import { payoff } from "@/lib/pricing";

// Naked short call demo: short 1 call at $100 strike, premium $3
const NAKED_CALL = [{ id: "demo", type: "C" as const, side: "short" as const, strike: 100, qty: 1, premium: 3 }];

export function RiskWizard() {
  const { wizardSeen, setWizardSeen, setTrainingWheels } = useSafety();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [spot, setSpot] = useState(100);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!wizardSeen) {
      // small delay so the page paints first
      const id = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(id);
    }
  }, [wizardSeen]);

  const pnl = payoff(NAKED_CALL, spot);
  const explosion = Math.min(1, Math.max(0, (-pnl) / 5000)); // 0..1 visual intensity

  const finish = () => {
    setTrainingWheels(true);
    setWizardSeen();
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl border border-amber/60 bg-bg shadow-[0_30px_100px_-20px_rgba(255,184,0,0.4)]"
          >
            <div className="border-b border-border bg-bg-soft px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-amber">
              ⚠ first-visit safety briefing · 1 of 1
            </div>
            <div className="p-6">
              <h2 className="font-display text-3xl tracking-tightest text-fg leading-tight">
                Options can lose <span className="italic text-bear">100%</span>.
                <br />
                Some can lose <span className="italic text-bear">more than that</span>.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-fg-dim">
                Slide the stock price below. You're holding a naked short call — you collected $300, and your loss
                grows as the stock goes up. There is no upper bound. Watch the balance.
              </p>

              {/* Live demo */}
              <div className="mt-5 border border-border bg-surface p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                      account balance
                    </div>
                    <motion.div
                      className="font-display text-4xl tracking-tightest tabular-nums"
                      animate={{
                        x: explosion > 0.4 ? [0, -3, 3, -2, 2, 0] : 0,
                        color: pnl < -200 ? "var(--bear)" : pnl > 0 ? "var(--bull)" : "var(--fg)",
                      }}
                      transition={{ duration: 0.4, repeat: explosion > 0.4 ? Infinity : 0 }}
                    >
                      ${(10_000 + pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </motion.div>
                  </div>
                  <div className={`text-right font-mono text-sm ${pnl >= 0 ? "text-bull" : "text-bear"}`}>
                    <div className="text-[10px] uppercase tracking-wider text-fg-faint">P&L</div>
                    <div className="text-2xl">
                      {pnl >= 0 ? "+" : "−"}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>

                {/* Visual P&L bar */}
                <div className="mt-3 relative h-3 w-full overflow-hidden border border-border bg-bg">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-fg-faint" />
                  <motion.div
                    className="absolute inset-y-0"
                    style={{
                      background: pnl >= 0 ? "var(--bull)" : "var(--bear)",
                      width: `${Math.min(50, Math.abs(pnl) / 100)}%`,
                      left: pnl >= 0 ? "50%" : `${50 - Math.min(50, Math.abs(pnl) / 100)}%`,
                    }}
                    animate={{ opacity: explosion > 0.3 ? [1, 0.6, 1] : 1 }}
                    transition={{ duration: 0.4, repeat: explosion > 0.3 ? Infinity : 0 }}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  <span>$80</span>
                  <span className="text-bull">strike $100</span>
                  <span>$160</span>
                </div>
                <input
                  type="range"
                  min={80}
                  max={160}
                  step={1}
                  value={spot}
                  onChange={(e) => setSpot(parseInt(e.target.value))}
                  aria-label="stock price"
                  className="mt-1 w-full accent-bull"
                />
                <div className="mt-1 text-center font-mono text-[11px] text-fg">
                  spot price ${spot}
                </div>
              </div>

              {/* Acknowledgment */}
              <label className="mt-5 flex cursor-pointer items-start gap-3 border border-border bg-bg p-3 hover:border-bull/40">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-bull"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <div className="text-sm text-fg">
                  I understand options can lose more than I put in. I'll start with{" "}
                  <span className="text-bull">training wheels mode on</span> (defined-risk only, daily limit, kill
                  switch).
                </div>
              </label>

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setTrainingWheels(false);
                    setWizardSeen();
                    setOpen(false);
                  }}
                  className="font-mono text-[11px] uppercase tracking-wider text-fg-faint hover:text-fg-dim"
                >
                  skip · I'm a pro
                </button>
                <button
                  onClick={finish}
                  disabled={!accepted}
                  className="inline-flex items-center gap-2 bg-bull px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg transition-opacity disabled:opacity-30"
                >
                  enable training wheels →
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

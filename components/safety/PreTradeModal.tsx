"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  strategy: string;
  unbounded: boolean;
  maxLoss: number;
  maxProfit: number;
  cost: number;
  trainingWheels: boolean;
};

export function PreTradeModal({ open, onClose, onConfirm, strategy, unbounded, maxLoss, maxProfit, cost, trainingWheels }: Props) {
  const isDangerous = unbounded;
  const [secondsLeft, setSecondsLeft] = useState(isDangerous ? 3 : 0);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(isDangerous ? 3 : 0);
    if (!isDangerous) return;
    const id = setInterval(() => {
      setSecondsLeft((n) => {
        if (n <= 1) {
          clearInterval(id);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [open, isDangerous]);

  const blocked = trainingWheels && isDangerous;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full max-w-lg border bg-bg shadow-2xl ${isDangerous ? "border-bear/60 shadow-[0_30px_80px_-20px_rgba(255,46,99,0.4)]" : "border-bull/40 shadow-[0_30px_80px_-20px_rgba(0,255,135,0.3)]"}`}
          >
            <div
              className={`flex items-center justify-between border-b px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] ${
                isDangerous ? "border-bear/40 bg-bear/5 text-bear" : "border-border bg-bg-soft text-bull"
              }`}
            >
              <span>{isDangerous ? "⚠ unbounded risk · review" : "● confirm paper trade"}</span>
              <button onClick={onClose} className="text-fg-faint hover:text-fg">✕</button>
            </div>

            <div className="p-6">
              {isDangerous ? (
                <>
                  <h3 className="font-display text-3xl tracking-tightest text-fg leading-tight">
                    This <span className="text-bear italic">{strategy}</span> can lose more than your account.
                  </h3>
                  <DangerSimulation />
                </>
              ) : (
                <>
                  <h3 className="font-display text-2xl tracking-tightest text-fg leading-tight">
                    Confirm: <span className="text-bull italic">{strategy}</span>
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-dim">
                    Your defined risk on this trade is{" "}
                    <span className="text-bear">${Math.abs(maxLoss).toFixed(0)}</span>. Best case is{" "}
                    <span className="text-bull">${Math.abs(maxProfit).toFixed(0)}</span>.{" "}
                    Net cost ${Math.abs(cost).toFixed(0)} {cost >= 0 ? "debit" : "credit"}.
                  </p>
                </>
              )}

              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-2 border border-border bg-bg px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-fg-dim hover:text-fg transition-colors"
                >
                  cancel
                </button>
                {blocked ? (
                  <button
                    disabled
                    title="Training wheels are on. Disable in safety settings to allow unbounded-risk trades."
                    className="inline-flex items-center gap-2 border border-bear/40 bg-bear/10 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-bear/60 cursor-not-allowed"
                  >
                    blocked by training wheels
                  </button>
                ) : (
                  <button
                    onClick={onConfirm}
                    disabled={secondsLeft > 0}
                    className={`inline-flex items-center gap-2 px-5 py-2 font-mono text-[11px] font-semibold uppercase tracking-wider transition-opacity ${
                      isDangerous ? "bg-bear text-bg" : "bg-bull text-bg"
                    } disabled:opacity-30`}
                  >
                    {secondsLeft > 0
                      ? `wait ${secondsLeft}s…`
                      : isDangerous
                      ? "i understand the risk"
                      : "place paper trade"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Mini animation: an upward arrow with the account balance "exploding" downward.
function DangerSimulation() {
  return (
    <div className="mt-5 border border-bear/30 bg-bear/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">stock price</div>
          <motion.div
            className="font-display text-3xl tabular-nums text-fg tracking-tightest"
            animate={{ y: [-2, -8, -16, -22, -28] }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            ↑
          </motion.div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">your loss</div>
          <motion.div
            className="font-display text-3xl tabular-nums text-bear tracking-tightest"
            animate={{ scale: [1, 1.1, 1.2, 1.3, 1.5], color: ["#ff6b8a", "#ff2e63", "#ff2e63"] }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            −$1,200
          </motion.div>
        </div>
      </div>

      <div className="mt-3 relative h-2 overflow-hidden border border-border">
        <motion.div
          className="absolute inset-y-0 left-0 bg-bear"
          animate={{ width: ["10%", "30%", "60%", "85%", "100%"] }}
          transition={{ duration: 5, repeat: Infinity }}
        />
      </div>
      <p className="mt-3 font-mono text-[10px] leading-relaxed text-fg-dim">
        as the underlying climbs, this position keeps losing. there's no automatic stop —
        you have to close it manually before the loss outpaces your account.
      </p>
    </div>
  );
}

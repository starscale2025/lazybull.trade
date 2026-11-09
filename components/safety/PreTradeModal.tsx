"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "./useModalFocus";
import { AnimatePresence, motion } from "motion/react";
import { ToolButton } from "@/components/calm/kit";

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
  // The step that enforces the unbounded-risk block, so it gets the full dialog
  // contract: role, focus in, Tab kept inside, Escape cancels, focus restored.
  const panelRef = useRef<HTMLDivElement>(null);
  useModalFocus(panelRef, open, { onEscape: onClose });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pretrade-title"
            tabIndex={-1}
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`surface-instrument max-h-[calc(100vh/var(--ui-zoom)-2rem)] w-full max-w-lg overflow-y-auto border bg-bg shadow-2xl ${isDangerous ? "border-amber/60" : "border-border"}`}
          >
            <div
              className={`flex items-center justify-between border-b px-4 py-2 t-eyebrow ${
                isDangerous ? "border-amber/40 bg-amber/5 text-amber" : "border-border bg-bg-soft text-fg-dim"
              }`}
            >
              <span>{isDangerous ? "⚠ Unbounded risk · review" : "Confirm paper trade"}</span>
              <button type="button" onClick={onClose} aria-label="Cancel" className="text-fg-faint hover:text-fg">✕</button>
            </div>

            <div className="p-6">
              {isDangerous ? (
                <>
                  <h3 id="pretrade-title" className="font-display text-3xl tracking-tightest text-fg leading-tight">
                    This <span className="t-accent text-bear">{strategy}</span> can lose more than your account.
                  </h3>
                  <DangerSimulation />
                </>
              ) : (
                <>
                  <h3 id="pretrade-title" className="font-display text-2xl tracking-tightest text-fg leading-tight">
                    Confirm: <span className="t-accent">{strategy}</span>
                  </h3>
                  <p className="t-body-sm mt-2 text-fg-dim">
                    Your defined risk on this trade is{" "}
                    <span className="text-bear">${Math.abs(maxLoss).toFixed(0)}</span>. Best case is{" "}
                    <span className="text-bull">${Math.abs(maxProfit).toFixed(0)}</span>.{" "}
                    Net cost ${Math.abs(cost).toFixed(0)} {cost >= 0 ? "debit" : "credit"}.
                  </p>
                </>
              )}

              <div className="mt-5 flex items-center justify-end gap-3">
                <ToolButton onClick={onClose}>Cancel</ToolButton>
                {blocked ? (
                  <ToolButton
                    disabled
                    title="Training wheels are on. Disable in safety settings to allow unbounded-risk trades."
                    className="!text-amber"
                  >
                    Blocked by training wheels
                  </ToolButton>
                ) : (
                  <ToolButton
                    primary={!isDangerous}
                    onClick={onConfirm}
                    disabled={secondsLeft > 0}
                    className={isDangerous ? "!text-amber" : ""}
                  >
                    {secondsLeft > 0
                      ? `Wait ${secondsLeft}s…`
                      : isDangerous
                      ? "I understand the risk"
                      : "Place paper trade"}
                  </ToolButton>
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
          <div className="t-label text-fg-faint">Stock price</div>
          <motion.div
            className="font-display text-3xl tabular-nums text-fg tracking-tightest"
            animate={{ y: [-2, -8, -16, -22, -28] }}
            transition={{ duration: 5, repeat: Infinity }}
          >
            ↑
          </motion.div>
        </div>
        <div className="text-right">
          <div className="t-label text-fg-faint">Your loss</div>
          <motion.div
            className="font-display text-3xl tabular-nums text-bear tracking-tightest"
            animate={{ scale: [1, 1.1, 1.2, 1.3, 1.5] }}
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
      <p className="mt-3 t-label text-fg-dim">
        As the underlying climbs, this position keeps losing. There’s no automatic stop —
        you have to close it manually before the loss outpaces your account.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DEFAULT_CAPITAL, useSafety } from "@/lib/stores";
import { payoff } from "@/lib/pricing";
import { consentGateNeeded } from "@/lib/consent";
import { useConsent } from "@/components/ConsentGate";
import { useModalFocus } from "./useModalFocus";
import { ToolButton } from "@/components/calm/kit";

// Naked short call demo: short 1 call at $100 strike, premium $3
const NAKED_CALL = [{ id: "demo", type: "C" as const, side: "short" as const, strike: 100, qty: 1, premium: 3 }];
// The slider's travel, and the price where the $5,000 balance crosses $0
// (strike + (capital + premium collected) / 100 shares): $153.
const SPOT_MIN = 80;
const SPOT_MAX = 200;
const ZERO_AT = 100 + (DEFAULT_CAPITAL + 300) / 100;
const zeroPct = ((ZERO_AT - SPOT_MIN) / (SPOT_MAX - SPOT_MIN)) * 100;

// The /trade first-visit briefing. The 2026-11 verification found it invisible
// to assistive tech (no dialog role, no focus), mounting UNDER the open consent
// gate on a first visit, running a $10k demo balance against the $5,000 in
// docs/COMPLIANCE.md (so it could never go negative and never showed "more than
// that"), and offering a "skip" that silently turned training wheels off while
// its own copy claimed training wheels owned the loss limit and kill switch.
//
// 2026-11-06: it then gated BOTH exits on dragging the balance below $0, and
// the safe one on a checkbox too. On an $80–$160 slider $0 only arrives past
// $153, the last tenth of the track, so a visitor who slid to "−$2,000, got
// it" found two dead buttons and read the page as broken. Keeping training
// wheels on is the default and cannot hurt anyone, so it is one click now.
// Only turning them off still waits for the balance to go below $0 and an
// explicit "I understand". The track runs to $200, so $0 arrives at 61% of it,
// and a tick marks where.
export function RiskWizard() {
  const { wizardSeen, setWizardSeen, setTrainingWheels } = useSafety();
  const { consent, ready } = useConsent();
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [spot, setSpot] = useState(100);
  const [sawLoss, setSawLoss] = useState(false);
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  // Only after consent is answered: two dialogs each trapping focus would fight.
  const consentAnswered = ready && !!consent?.adult && !consentGateNeeded(consent);
  useEffect(() => {
    if (wizardSeen || !consentAnswered) return;
    // small delay so the page paints first
    const id = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(id);
  }, [wizardSeen, consentAnswered]);

  useModalFocus(panelRef, open, { initial: "#risk-spot" });

  const pnl = payoff(NAKED_CALL, spot);
  const balance = DEFAULT_CAPITAL + pnl;
  const explosion = Math.min(1, Math.max(0, -pnl / DEFAULT_CAPITAL)); // 0..1 visual intensity
  const shake = explosion > 0.4 && !reduce;
  const pulse = explosion > 0.3 && !reduce;
  const fmt = (v: number) => Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

  const close = (wheels: boolean) => {
    setTrainingWheels(wheels);
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
          className="fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="risk-title"
            aria-describedby="risk-intro"
            tabIndex={-1}
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="surface-instrument max-h-[calc(100vh/var(--ui-zoom)-2rem)] w-full max-w-2xl overflow-y-auto border border-amber/60 bg-bg shadow-2xl outline-none"
          >
            <div className="border-b border-border bg-bg-soft px-4 py-2 t-eyebrow text-amber">
              ⚠ First-visit safety briefing · 1 of 1
            </div>
            <div className="p-6">
              <h2 id="risk-title" className="font-display text-3xl tracking-tightest text-fg leading-tight">
                Options can lose <span className="t-accent text-bear">100%</span>.
                <br />
                Some can lose <span className="t-accent text-bear">more than that</span>.
              </h2>
              <p id="risk-intro" className="t-body-sm mt-3 text-fg-dim">
                Slide the stock price below. You&apos;re holding a naked short call on a $5,000 paper balance — you
                collected $300, and your loss grows as the stock goes up. There is no upper bound. Watch the balance.
              </p>

              {/* Live demo */}
              <div className="mt-5 surface-card border border-border bg-surface p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="t-label text-fg-faint">
                      Account balance
                    </div>
                    <motion.div
                      className="font-display text-4xl tracking-tightest tabular-nums"
                      animate={{
                        x: shake ? [0, -3, 3, -2, 2, 0] : 0,
                        color: balance < 0 ? "var(--bear)" : pnl < -200 ? "var(--bear)" : pnl > 0 ? "var(--bull)" : "var(--fg)",
                      }}
                      transition={{ duration: 0.4, repeat: shake ? Infinity : 0 }}
                    >
                      {balance < 0 ? "−" : ""}${fmt(balance)}
                    </motion.div>
                  </div>
                  <div className={`text-right font-mono text-sm ${pnl >= 0 ? "text-bull" : "text-bear"}`}>
                    <div className="t-label text-fg-faint">P&L</div>
                    <div className="t-data text-2xl">
                      {pnl >= 0 ? "+" : "−"}${fmt(pnl)}
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
                    animate={{ opacity: pulse ? [1, 0.6, 1] : 1 }}
                    transition={{ duration: 0.4, repeat: pulse ? Infinity : 0 }}
                  />
                </div>

                <div className="mt-4 flex items-center justify-between t-label text-fg-dim">
                  <span>${SPOT_MIN}</span>
                  <span>Strike $100</span>
                  <span>${SPOT_MAX}</span>
                </div>
                <input
                  id="risk-spot"
                  type="range"
                  min={SPOT_MIN}
                  max={SPOT_MAX}
                  step={1}
                  value={spot}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setSpot(v);
                    if (DEFAULT_CAPITAL + payoff(NAKED_CALL, v) < 0) setSawLoss(true);
                  }}
                  aria-label="stock price"
                  aria-valuetext={`$${spot}, balance ${balance < 0 ? "minus " : ""}$${fmt(balance)}`}
                  className="mt-1 w-full accent-brand-ink"
                />
                {/* Where the balance crosses $0: past this tick it is debt. */}
                <div className="relative mt-1 h-4" aria-hidden>
                  <span
                    className="absolute top-0 flex -translate-x-1/2 flex-col items-center t-label text-bear"
                    style={{ left: `${zeroPct.toFixed(2)}%` }}
                  >
                    <span className="h-1.5 w-px bg-bear" />
                    $0 balance
                  </span>
                </div>
                <div className="mt-2 text-center t-data text-[0.6875rem] text-fg">
                  Spot price ${spot}
                </div>
              </div>

              <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                {/* The risky exit: it waits for the loss and an explicit yes. */}
                <div className="order-last flex flex-col gap-2.5 border border-border bg-bg p-3 md:order-none">
                  <span className="text-[0.75rem] leading-snug text-fg-faint">
                    Turning training wheels off allows unbounded-risk strategies (naked calls and puts, short
                    straddles) and short selling. Your $500 daily loss limit and kill switch stay on.
                  </span>
                  <label className={`flex items-start gap-2.5 ${sawLoss ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-brand-ink"
                      checked={accepted}
                      disabled={!sawLoss}
                      onChange={(e) => setAccepted(e.target.checked)}
                    />
                    <span className="t-body-sm text-fg">I understand options can lose more than I put in.</span>
                  </label>
                  {!sawLoss && (
                    <p className="t-label text-amber">
                      First slide past ${ZERO_AT} and watch the balance go below $0
                    </p>
                  )}
                  {/* Always mounted, so the crossing is heard: the hint above
                      unmounts at the very moment the balance goes below $0, and
                      a live region that leaves the page announces nothing
                      (Gate A2). */}
                  <p className="sr-only" aria-live="polite">
                    {sawLoss
                      ? "The balance went below $0: this position can lose more than the account holds. You can now turn training wheels off."
                      : ""}
                  </p>
                  <button
                    type="button"
                    onClick={() => close(false)}
                    disabled={!sawLoss || !accepted}
                    className="w-fit t-label text-fg-dim underline-offset-4 hover:text-fg hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:no-underline"
                  >
                    Turn training wheels off
                  </button>
                </div>
                {/* The safe exit is the default and is never gated. */}
                <div className="flex flex-col items-stretch gap-1.5 md:items-end">
                  <ToolButton primary onClick={() => close(true)} className="!h-11 !px-5">
                    Keep training wheels on →
                  </ToolButton>
                  <span className="t-label text-fg-faint md:text-right">Defined-risk strategies only</span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

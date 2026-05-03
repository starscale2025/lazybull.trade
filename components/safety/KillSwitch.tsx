"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useSafety, usePaper } from "@/lib/stores";
import { useTheme } from "@/lib/stores";

export function SafetySettingsButton() {
  const [open, setOpen] = useState(false);
  const safety = useSafety();
  const paper = usePaper();
  const theme = useTheme();

  // Watch realized P&L; trigger kill switch if breach.
  useEffect(() => {
    if (paper.realizedToday <= -safety.dailyLossLimit && !safety.killSwitchTriggered) {
      safety.triggerKillSwitch(`Realized loss $${Math.abs(paper.realizedToday).toFixed(0)} hit limit $${safety.dailyLossLimit}`);
      paper.closeAll("killswitch");
    }
  }, [paper.realizedToday, safety.dailyLossLimit, safety.killSwitchTriggered, safety, paper]);

  return (
    <>
      <button
        aria-label="safety settings"
        onClick={() => setOpen(true)}
        className="group inline-flex h-9 items-center gap-2 border border-border bg-bg px-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim transition-colors hover:border-bull hover:text-bull"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        safety
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md border border-bull/40 bg-bg shadow-[0_30px_80px_-20px_rgba(0,255,135,0.3)]"
            >
              <div className="flex items-center justify-between border-b border-border bg-bg-soft px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                <span className="text-bull">● safety panel</span>
                <button onClick={() => setOpen(false)} className="text-fg-faint hover:text-fg">✕</button>
              </div>
              <div className="space-y-5 p-5">
                <Toggle
                  label="Training wheels"
                  desc="Block unbounded-risk strategies (naked calls/puts, short straddles)."
                  checked={safety.trainingWheels}
                  onChange={safety.setTrainingWheels}
                />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-fg-dim mb-2">
                    Daily loss limit
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-bull">$</span>
                    <input
                      type="number"
                      value={safety.dailyLossLimit}
                      min={0}
                      step={50}
                      onChange={(e) => safety.setDailyLossLimit(parseInt(e.target.value) || 0)}
                      className="flex-1 border border-border bg-surface px-2 py-1.5 font-mono text-sm text-fg outline-none focus:border-bull"
                    />
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-fg-faint">
                    realized today: <span className={paper.realizedToday < 0 ? "text-bear" : "text-bull"}>
                      {paper.realizedToday >= 0 ? "+" : "−"}${Math.abs(paper.realizedToday).toFixed(0)}
                    </span>
                  </div>
                </div>
                <Toggle
                  label="Theme"
                  desc={theme.theme === "dark" ? "Dark trading-desk theme." : "Light theme."}
                  checked={theme.theme === "dark"}
                  onChange={() => theme.toggle()}
                />
                <button
                  onClick={() => {
                    paper.reset();
                    safety.resetKillSwitch();
                  }}
                  className="w-full border border-border bg-bg py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-bull hover:text-bull"
                >
                  reset paper account
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <KillSwitchOverlay />
    </>
  );
}

function Toggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-mono text-[12px] uppercase tracking-wider text-fg">{label}</div>
        <div className="font-mono text-[10px] text-fg-dim">{desc}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-12 shrink-0 border transition-colors ${checked ? "border-bull bg-bull/20" : "border-border bg-surface"}`}
      >
        <motion.span
          animate={{ x: checked ? 24 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          className={`absolute top-0.5 left-0.5 size-5 ${checked ? "bg-bull" : "bg-fg-faint"}`}
        />
      </button>
    </div>
  );
}

function KillSwitchOverlay() {
  const safety = useSafety();
  return (
    <AnimatePresence>
      {safety.killSwitchTriggered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-md border border-bear bg-bg shadow-[0_30px_80px_-20px_rgba(255,46,99,0.5)]"
          >
            <div className="border-b border-bear/40 bg-bear/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-bear">
              🛑 kill switch · all positions closed
            </div>
            <div className="p-6">
              <h3 className="font-display text-3xl tracking-tightest leading-tight">
                We <span className="italic text-bear">stopped you out</span>.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-fg-dim">
                You hit your daily loss limit. All open paper positions have been closed. Take a walk, then come back
                tomorrow with a fresh head.
              </p>
              <div className="mt-3 border border-border bg-surface p-3 font-mono text-[11px] text-fg-dim">
                {safety.killReason}
              </div>
              <button
                onClick={safety.resetKillSwitch}
                className="mt-5 w-full bg-bear py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg hover:bg-bear-dim"
              >
                acknowledge & reset
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

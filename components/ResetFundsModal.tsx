"use client";

// The one confirmation that must never be a reflex click. Resetting funds
// destroys the ENTIRE portfolio — both reset buttons (/portfolio and the /pro
// trading panel) route through this modal so the warning is identical
// everywhere and spelled out in full.

import { useEffect, useRef } from "react";
import { usePaper } from "@/lib/stores";
import { fmt } from "@/components/pro/chartCore";

export function ResetFundsModal({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  /** Runs AFTER the store reset — callers add their own side effects. */
  onConfirm: () => void;
}) {
  const startingCash = usePaper((s) => s.startingCash);
  const resetCount = usePaper((s) => s.resetCount);
  const shares = usePaper((s) => s.shares);
  const orders = usePaper((s) => s.orders);
  const trades = usePaper((s) => s.trades);
  const bets = usePaper((s) => s.positions);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const openPositions = Object.values(shares).filter((p) => p && p.qty !== 0).length;
  const workingOrders = orders.filter((o) => o.status === "working").length;
  const openBets = bets.filter((p) => p.status === "open").length;

  // Focus lands on CANCEL — destruction must never be the default key press.
  useEffect(() => {
    if (open) requestAnimationFrame(() => cancelRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reset-funds-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-[440px] max-w-full border border-bear/50 bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-bear/30 bg-bear/10 px-4 py-2.5">
          <span className="font-mono text-[13px] text-bear">⚠</span>
          <h2 id="reset-funds-title" className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-bear">
            reset funds — this wipes the entire portfolio
          </h2>
        </div>

        <div className="space-y-3 p-4 font-mono text-[11px] leading-relaxed text-fg-dim">
          <p className="text-fg">
            This is not just a balance top-up. Confirming destroys everything this
            account has ever done and starts a brand-new portfolio at{" "}
            <span className="text-bull">${fmt(startingCash, 2)}</span>:
          </p>
          <ul className="space-y-1.5 border border-border-soft bg-bg/60 p-3">
            <li>
              ✕ <span className="text-fg">{openPositions}</span> open position{openPositions === 1 ? "" : "s"} — erased
              without closing (no P&L is realized)
            </li>
            <li>
              ✕ <span className="text-fg">{workingOrders}</span> working order{workingOrders === 1 ? "" : "s"} — cancelled,
              including protective stops and take-profits
            </li>
            <li>
              ✕ <span className="text-fg">{openBets}</span> open option bet{openBets === 1 ? "" : "s"} — gone
            </li>
            <li>
              ✕ <span className="text-fg">{trades.length}</span> round-trip{trades.length === 1 ? "" : "s"} of trade
              history + every journal note attached to them
            </li>
            <li>✕ the cash ledger, the equity curve, wagered totals and all performance stats</li>
          </ul>
          <p>
            If you're signed in, the wipe syncs to your profile — your other devices
            get the fresh account too. There is <span className="text-bear">no undo</span> and no
            export after the fact: download any CSVs you want to keep BEFORE confirming.
          </p>
          <p className="text-fg-faint">
            The portfolio page will record this: reset count becomes{" "}
            <span className="text-fg">{resetCount + 1}</span> and the account start date becomes today.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="bg-surface px-3 py-3 font-mono text-[11px] uppercase tracking-wider text-fg transition-colors hover:bg-surface-2"
          >
            keep my portfolio
          </button>
          <button
            onClick={onConfirm}
            className="bg-surface px-3 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-bear transition-colors hover:bg-bear hover:text-bg"
          >
            wipe it all — restart at ${fmt(startingCash, 0)}
          </button>
        </div>
      </div>
    </div>
  );
}

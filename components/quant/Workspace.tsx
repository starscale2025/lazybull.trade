"use client";

import { useEffect, useRef } from "react";
import type { Candle } from "@/lib/candles";
import type { ActiveBot, BotDef, BotResult } from "@/lib/quant/types";
import { Chip, PillButton, ToolButton } from "@/components/calm/kit";
import { BotCell } from "./BotCell";

/** The kit's square at the reorder rail's size. */
const REORDER_BTN = "!size-5 !p-0 !text-[0.625rem] !bg-bg hover:!text-brand-ink";

export type ResolvedRow = {
  active: ActiveBot;
  def: BotDef;
  result: BotResult | null;
};

export function Workspace({
  rows,
  candles,
  symbol,
  beginner,
  onUpdateParams,
  onRemove,
  onToggleCollapse,
  onRerun,
  onMove,
  onAddPlaceholderClick,
}: {
  rows: ResolvedRow[];
  candles: Candle[];
  symbol: string;
  beginner: boolean;
  onUpdateParams: (uid: string, params: Record<string, number | string | boolean>) => void;
  onRemove: (uid: string) => void;
  onToggleCollapse: (uid: string) => void;
  onRerun: (uid: string) => void;
  onMove: (uid: string, dir: -1 | 1) => void;
  onAddPlaceholderClick: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCount = useRef(rows.length);
  useEffect(() => {
    if (rows.length > lastCount.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
    lastCount.current = rows.length;
  }, [rows.length]);

  /**
   * Stack-in animation gate.
   *
   * `seenUidsRef` is initialised on first mount with the uids of any
   * seeded bots (consensus / direction / sma / zscore from QuantPage).
   * Those should NOT play the drop-in animation — they're just the
   * starting state of the workspace.
   *
   * Anything that arrives later — a user-added bot, an imported bot,
   * a deep-link `?add=` — has a uid not in this set and gets the
   * `cell-stack-in` class so it falls onto the stack with a small
   * overshoot. After render we record it as seen so a re-render
   * (param change, reorder, collapse) doesn't replay the animation.
   */
  const seenUidsRef = useRef<Set<string> | null>(null);
  if (seenUidsRef.current === null) {
    seenUidsRef.current = new Set(rows.map((r) => r.active.uid));
  }
  const seen = seenUidsRef.current;

  // Compute "new" uids for THIS render before the effect runs so the
  // animation class lands on the same render as the cell mounts.
  const newUids = new Set<string>();
  for (const r of rows) {
    if (!seen.has(r.active.uid)) newUids.add(r.active.uid);
  }

  useEffect(() => {
    for (const uid of newUids) seen.add(uid);
    // newUids is a fresh Set every render; safe to depend on rows length.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  return (
    // No panel of its own: each cell is one, and a panel doesn't nest in a panel.
    <section className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <div>
          <span className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">Workspace</span>
          <span className="t-label ml-2 text-fg-faint">
            {rows.length} cell{rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <span className="t-label text-fg-faint">
          Jupyter-style notebook
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
        {rows.length === 0 ? (
          <EmptyState onClick={onAddPlaceholderClick} />
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div
                key={r.active.uid}
                className={`group relative ${newUids.has(r.active.uid) ? "cell-stack-in" : ""}`}
              >
                {/* reorder rail */}
                <div className="absolute -left-1 top-2 z-10 hidden flex-col gap-0.5 group-hover:flex">
                  <ToolButton onClick={() => onMove(r.active.uid, -1)} disabled={i === 0} className={REORDER_BTN}>
                    ▲
                  </ToolButton>
                  <ToolButton onClick={() => onMove(r.active.uid, 1)} disabled={i === rows.length - 1} className={REORDER_BTN}>
                    ▼
                  </ToolButton>
                </div>
                <BotCell
                  index={i}
                  active={r.active}
                  def={r.def}
                  result={r.result}
                  candles={candles}
                  symbol={symbol}
                  beginner={beginner}
                  onUpdateParams={(p) => onUpdateParams(r.active.uid, p)}
                  onRemove={() => onRemove(r.active.uid)}
                  onToggleCollapse={() => onToggleCollapse(r.active.uid)}
                  onRerun={() => onRerun(r.active.uid)}
                />
              </div>
            ))}

            {/* add cell hint */}
            <PillButton size="sm" onClick={onAddPlaceholderClick} className="w-full">
              + Add bot from library
            </PillButton>
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyState({ onClick }: { onClick: () => void }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="max-w-md text-center">
        <div className="mx-auto grid size-16 place-items-center rounded-full bg-fg/[0.07] font-display text-3xl text-brand-ink">
          ⌗
        </div>
        <div className="mt-4 font-display text-2xl tracking-tightest text-fg">Empty workspace</div>
        <p className="mt-2 text-balance t-body-sm text-fg-dim">
          Pick a bot from the bot library, or import your own. Then press
          <Chip tone="brand" className="mx-1">▶ Run all</Chip>
          to fire them all on the dataset above.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {["SMA crossover", "Z-score reversion", "Kelly sizer", "Monte Carlo VaR"].map((b) => (
            <Chip key={b}>{b}</Chip>
          ))}
        </div>
        <PillButton size="sm" onClick={onClick} className="mt-6">
          ↗ Open library
        </PillButton>
      </div>
    </div>
  );
}

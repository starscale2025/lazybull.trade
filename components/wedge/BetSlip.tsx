"use client";

// The always-visible bet slip: the whole page's state, condensed into one
// actionable card. Desktop: a sticky right rail. Mobile: a fixed bottom bar.
// It updates live as the user drags the cone chart or picks a strategy, and
// keeps the PLACE action on screen at all times — decision next to data.

import { MagneticCTA } from "@/components/atmosphere/MagneticCTA";
import type { Strategy } from "@/lib/models";
import { Chip, ToolButton } from "@/components/calm/kit";

type Props = {
  sym: string;
  spot: number;
  low: number;
  high: number;
  expiry: string;
  prob: number;
  selected: Strategy | null;
  openCount: number;
  onPlace: () => void;
  onJump: (id: string) => void;
};

const money = (v: number, sign = false) =>
  `${sign && v > 0 ? "+" : ""}$${Math.abs(v).toFixed(0)}`;

function OddsRing({ prob }: { prob: number }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  const tone = prob > 0.6 ? "var(--bull)" : prob > 0.35 ? "var(--cyan)" : "var(--bear)";
  return (
    <div className="flex items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} stroke="var(--border)" strokeWidth="5" fill="none" />
        <circle
          cx="32"
          cy="32"
          r={r}
          stroke={tone}
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - c * prob}
          transform="rotate(-90 32 32)"
          style={{ transition: "stroke-dashoffset 0.5s cubic-bezier(.22,.68,.26,1), stroke 0.3s" }}
        />
      </svg>
      <div>
        <div className="font-display text-2xl tracking-tightest tabular-nums" style={{ color: tone }}>
          {(prob * 100).toFixed(0)}%
        </div>
        <div className="t-label text-fg-faint">Odds in band · BS</div>
      </div>
    </div>
  );
}

export function BetSlip({ sym, spot, low, high, expiry, prob, selected, openCount, onPlace, onJump }: Props) {
  return (
    <div className="surface-instrument border border-border bg-surface/80 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border bg-bg-soft px-4 py-2.5">
        <span className="t-eyebrow text-fg-dim">Your position</span>
        <Chip dot>Live ${spot.toFixed(2)}</Chip>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {/* the thesis, compact — mirrors the sentence up top */}
        <div>
          <div className="t-label text-fg-faint">Thesis</div>
          <div className="mt-1 font-display text-lg leading-snug tracking-tightest text-fg">
            {sym} closes <span className="text-bull">${low.toFixed(2)}–${high.toFixed(2)}</span>
            <span className="text-fg-dim"> by </span>
            <span className="text-amber">{expiry}</span>
          </div>
        </div>

        <OddsRing prob={prob} />

        <div className="h-px bg-border" />

        {/* chosen strategy */}
        {selected ? (
          <div>
            <div className="flex items-baseline justify-between">
              <div className="t-label text-fg-faint">Strategy</div>
              <button
                onClick={() => onJump("pick")}
                className="t-label text-fg-dim underline-offset-2 hover:text-fg hover:underline"
              >
                Change
              </button>
            </div>
            <div className="mt-1 font-display text-xl tracking-tightest text-fg">{selected.kind}</div>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden border border-border bg-border">
              {[
                {
                  k: "Max profit",
                  v: Number.isFinite(selected.maxProfit) ? money(selected.maxProfit, true) : "uncapped",
                  c: "text-bull",
                },
                {
                  k: "Max loss",
                  v: Number.isFinite(selected.maxLoss) ? `−${money(selected.maxLoss)}` : "unbounded",
                  c: "text-bear",
                },
                {
                  k: selected.cost > 0 ? "You pay" : "You collect",
                  v: money(selected.cost),
                  c: "text-fg",
                },
                {
                  k: "In-range odds · BS model",
                  v: `${(selected.prob * 100).toFixed(0)}%`,
                  c: "text-fg",
                },
              ].map((s) => (
                <div key={s.k} className="bg-bg p-2.5">
                  <div className="t-label text-fg-faint">{s.k}</div>
                  <div className={`mt-0.5 t-data text-sm ${s.c}`}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button
            onClick={() => onJump("pick")}
            className="border border-dashed border-border px-3 py-4 text-center t-label text-fg-dim transition-colors hover:border-fg-dim hover:text-fg"
          >
            Pick a strategy in step 02 →
          </button>
        )}

        <MagneticCTA className="w-full">
          <ToolButton primary onClick={onPlace} disabled={!selected} className="w-full !h-11">
            Place paper trade →
          </ToolButton>
        </MagneticCTA>

        <button
          onClick={() => onJump("manage")}
          className="flex items-center justify-between t-label text-fg-dim hover:text-fg"
        >
          <span>Open positions</span>
          <span className={openCount > 0 ? "text-fg" : "text-fg-faint"}>{openCount} open ↓</span>
        </button>
      </div>
    </div>
  );
}

/** Mobile companion: a slim fixed bottom bar with the essentials + PLACE. */
export function BetBar({
  prob,
  selected,
  onPlace,
  hint,
}: Pick<Props, "prob" | "selected" | "onPlace"> & { hint?: string }) {
  const tone = prob > 0.6 ? "text-bull" : prob > 0.35 ? "text-cyan" : "text-bear";
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 border-t border-border bg-bg/95 px-4 py-3 pr-[calc(var(--dock-gutter)+1rem)] backdrop-blur-md lg:hidden">
      <div className="min-w-0">
        <div className={`t-data text-sm font-semibold ${tone}`}>{(prob * 100).toFixed(0)}% in band</div>
        <div className="truncate t-label text-fg-dim">
          {hint ?? (selected ? selected.kind : "Pick a strategy")}
        </div>
      </div>
      {/* Says what it does, as the desktop slip does (Gate A2, m60): a bare
          "place" on a paper-only product read like the real thing. */}
      <ToolButton primary onClick={onPlace} disabled={!selected} className="shrink-0 !h-11 !px-5">
        Place paper trade →
      </ToolButton>
    </div>
  );
}

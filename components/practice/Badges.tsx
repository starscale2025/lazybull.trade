// The badge case — a hairline grid of glyph tiles, earned ones lit in bull,
// locked ones drawn dashed and faint. The grid is the `gap-px bg-border`
// idiom from components/learn/Diploma.tsx; the tile is the glyph tile from
// components/quant/BotLibrary.tsx (lines 113-118).
//
// PURE — the container decides what is earned.

import type { Badge } from "@/lib/practice/types";

export type BadgeGridProps = {
  badges: Badge[];
  cols?: 3 | 6;
  /** Tighter cells, smaller tile, no hint line — for a sidebar strip. */
  compact?: boolean;
  className?: string;
};

export function BadgeGrid({ badges, cols = 3, compact = false, className = "" }: BadgeGridProps) {
  return (
    <ul className={`grid gap-px border border-border bg-border ${cols === 6 ? "grid-cols-6" : "grid-cols-3"} ${className}`}>
      {badges.map((b) => (
        <li key={b.id} title={b.hint} className={`bg-bg ${compact ? "p-2" : "p-3"}`}>
          <span
            aria-hidden
            className={`grid place-items-center ${
              compact ? "size-7 font-mono text-[0.75rem]" : "size-9 font-display text-xl"
            } ${b.earned ? "border border-bull/40 text-bull" : "border border-dashed border-border text-fg-faint"}`}
          >
            {b.glyph}
          </span>
          <div className={`mt-2 t-chrome ${b.earned ? "text-fg" : "text-fg-faint"}`}>
            {b.label}
            <span className="sr-only">{b.earned ? " — earned" : " — locked"}</span>
          </div>
          {!compact && <div className="mt-0.5 text-[0.625rem] text-fg-faint">{b.hint}</div>}
        </li>
      ))}
    </ul>
  );
}

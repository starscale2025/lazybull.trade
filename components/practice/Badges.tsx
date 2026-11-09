// The badge case: round glyph tiles in an open grid, earned ones lit in the
// reading colour, locked ones a faint fill. Plain rows of a calm panel, so no
// frame of its own. Also the judge's verdict as the kit's one chip, the only
// badge the profile table and the run console share.
//
// PURE — the container decides what is earned.

import { Chip, type ChipTone } from "@/components/calm/kit";
import { VERDICT_LABEL } from "@/components/practice/Chips";
import type { Badge, Verdict } from "@/lib/practice/types";

export type BadgeGridProps = {
  badges: Badge[];
  cols?: 3 | 6;
  /** Tighter cells, smaller tile, no hint line — for a sidebar strip. */
  compact?: boolean;
  className?: string;
};

export function BadgeGrid({ badges, cols = 3, compact = false, className = "" }: BadgeGridProps) {
  return (
    <ul className={`grid gap-3 ${cols === 6 ? "grid-cols-6" : "grid-cols-3"} ${className}`}>
      {badges.map((b) => (
        <li key={b.id} title={b.hint} className="min-w-0">
          <span
            aria-hidden
            className={`grid place-items-center rounded-full ${
              compact ? "size-7 font-mono text-[0.75rem]" : "size-9 font-display text-xl"
            } ${b.earned ? "bg-brand-ink/14 text-brand-ink" : "bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] text-fg-faint"}`}
          >
            {b.glyph}
          </span>
          <div className={`mt-2 t-label ${b.earned ? "text-fg" : "text-fg-faint"}`}>
            {b.label}
            <span className="sr-only">{b.earned ? " — earned" : " — locked"}</span>
          </div>
          {!compact && <div className="mt-0.5 t-label text-fg-faint">{b.hint.charAt(0).toUpperCase() + b.hint.slice(1)}</div>}
        </li>
      ))}
    </ul>
  );
}

const VERDICT_CHIP: Record<Verdict, { tone: ChipTone; glyph: string }> = {
  accepted: { tone: "gain", glyph: "✓" },
  "wrong-answer": { tone: "loss", glyph: "✕" },
  error: { tone: "loss", glyph: "✕" },
};

/** The judge's verdict. Pass and fail are the one thing colour says here. */
export function VerdictChip({ verdict, className = "" }: { verdict: Verdict; className?: string }) {
  const v = VERDICT_CHIP[verdict];
  return (
    <Chip tone={v.tone} className={className}>
      <span aria-hidden>{v.glyph}</span>
      {VERDICT_LABEL[verdict]}
    </Chip>
  );
}

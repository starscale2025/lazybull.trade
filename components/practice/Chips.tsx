// The small chrome of /practice: pills, chips, glyphs. Every class
// string here is lifted from an existing instrument — the verdict pill in
// components/quant/BotCell.tsx (VERDICT_BG), the glyph tile in
// components/quant/BotLibrary.tsx (lines 113-118), the category chip in
// app/learn/bots/[id]/page.tsx (lines 72-80), the <kbd> in
// components/CommandDeck.tsx, the section eyebrow in app/learn/bots/[id]/page.tsx
// (lines 128-132) — so a practice row reads as the same product as a bot row.
//
// PURE. No hooks, no dates, no directive.

import type { ReactNode } from "react";
import { Chip } from "@/components/calm/kit";
import type { Difficulty, Lock, ProblemStatus, TrackId, Verdict } from "@/lib/practice/types";
import { DIFFICULTY_META, LOCK_META } from "@/lib/practice/types";
import { TRACK_META } from "@/lib/practice/tracks";

// Calm (S1, 2026-11-09): the kit's one chip. Difficulty is a word, not a
// colour: red means a loss on this site, and "hard" is not one.
export function DifficultyPill({ difficulty, className = "" }: { difficulty: Difficulty; className?: string }) {
  const meta = DIFFICULTY_META[difficulty];
  return (
    <Chip className={className}>{meta.label.charAt(0).toUpperCase() + meta.label.slice(1)}</Chip>
  );
}

/** Track colours are CSS vars, so the tint goes through color-mix rather than
    the hex-suffix trick the bot page uses. */
export function TrackChip({
  track,
  className = "",
  showGlyph = false,
}: {
  track: TrackId;
  className?: string;
  showGlyph?: boolean;
}) {
  const meta = TRACK_META[track];
  return (
    <Chip className={className}>
      {showGlyph && <span aria-hidden>{meta.glyph}</span>}
      {meta.label}
    </Chip>
  );
}

const GLYPH_SIZE = {
  sm: "size-8 font-mono text-[0.8125rem]",
  md: "size-10 font-display text-xl",
  lg: "size-16 font-display text-3xl",
} as const;

export function TrackGlyph({ track, size = "sm", className = "" }: { track: TrackId; size?: keyof typeof GLYPH_SIZE; className?: string }) {
  const meta = TRACK_META[track];
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full ${GLYPH_SIZE[size]} ${className}`}
      style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}
    >
      {meta.glyph}
    </span>
  );
}

const STATUS = {
  solved: { glyph: "✓", cls: "text-bull", label: "solved" },
  attempted: { glyph: "◐", cls: "text-amber", label: "attempted" },
  todo: { glyph: "○", cls: "text-fg-faint", label: "not started" },
} as const;

export function StatusGlyph({ status, className = "" }: { status: ProblemStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span role="img" aria-label={s.label} className={`font-mono ${s.cls} ${className}`}>
      {s.glyph}
    </span>
  );
}

export function LockPill({ lock, className = "" }: { lock: Lock; className?: string }) {
  const meta = LOCK_META[lock];
  return (
    <Chip tone={lock === "pro" ? "brand" : "neutral"} className={className}>
      {meta.label}
    </Chip>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="border border-border px-1.5 font-mono text-[0.625rem] text-fg-faint">{children}</kbd>;
}

const EYEBROW_TONE = {
  bull: { text: "text-bull", rule: "bg-bull/40" },
  amber: { text: "text-amber", rule: "bg-amber/40" },
  cyan: { text: "text-cyan", rule: "bg-cyan/40" },
  dim: { text: "text-fg-faint", rule: "bg-border" },
} as const;

export function Eyebrow({ children, tone = "bull", className = "" }: { children: ReactNode; tone?: keyof typeof EYEBROW_TONE; className?: string }) {
  const t = EYEBROW_TONE[tone];
  return (
    <div className={`flex items-center gap-3 t-eyebrow ${t.text} ${className}`}>
      <span aria-hidden>⟢</span>
      <span aria-hidden className={`h-px w-12 ${t.rule}`} />
      <span>{children}</span>
    </div>
  );
}

const VERDICT = {
  accepted: { cls: "bg-bull/15 text-bull border-bull/30", label: "Accepted", glyph: "✓" },
  "wrong-answer": { cls: "bg-bear/15 text-bear border-bear/30", label: "Wrong answer", glyph: "✕" },
  error: { cls: "bg-amber/15 text-amber border-amber/30", label: "Did not run", glyph: "✕" },
} as const;

/** The judge's verdict, in the workbench's verdict-pill shape. */
export function VerdictPill({ verdict, className = "" }: { verdict: Verdict; className?: string }) {
  const v = VERDICT[verdict];
  return (
    <span className={`inline-flex items-center gap-2 border px-2 py-1 t-chrome ${v.cls} ${className}`}>
      <span aria-hidden>{v.glyph}</span>
      {v.label}
    </span>
  );
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  accepted: "Accepted",
  "wrong-answer": "Wrong answer",
  error: "Did not run",
};

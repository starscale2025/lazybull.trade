// The small chrome of /practice: chips, glyphs, status circles — in the
// pitch deck's hand (2026-11-17). The tags are the Playground mockup's
// (slide 7): square-ish soft chips, the difficulty in bone, everything else
// grey. Status is the deck's circle legend (slide 15): a filled circle for
// done, a half for in progress, a hollow ring for not yet.
//
// PURE. No hooks, no dates, no directive.

import type { ReactNode } from "react";
import type { Difficulty, Lock, ProblemStatus, TrackId, Verdict } from "@/lib/practice/types";
import { DIFFICULTY_META, LOCK_META } from "@/lib/practice/types";
import { TRACK_META } from "@/lib/practice/tracks";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Difficulty is a word, not a colour: red means a loss on this site, and
    "hard" is not one. Set in bone, as the mockup sets "Medium". */
export function DifficultyPill({ difficulty, className = "" }: { difficulty: Difficulty; className?: string }) {
  return <span className={`deck-chip text-fg ${className}`}>{cap(DIFFICULTY_META[difficulty].label)}</span>;
}

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
    <span className={`deck-chip ${className}`}>
      {showGlyph && (
        <span aria-hidden className="font-mono text-bull">
          {meta.glyph}
        </span>
      )}
      {meta.label}
    </span>
  );
}

const GLYPH_SIZE = {
  sm: "size-8 rounded-[8px] font-mono text-[0.8125rem]",
  md: "size-10 rounded-[10px] font-display text-xl",
  lg: "size-16 rounded-[14px] font-display text-3xl",
} as const;

/** A track's glyph on the deck's tile: the "LB" mark's rounded square. */
export function TrackGlyph({ track, size = "sm", className = "" }: { track: TrackId; size?: keyof typeof GLYPH_SIZE; className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center bg-[var(--deck-green-tint,color-mix(in_srgb,var(--brand-ink)_14%,transparent))] text-bull ${GLYPH_SIZE[size]} ${className}`}
    >
      {TRACK_META[track].glyph}
    </span>
  );
}

const STATUS_LABEL: Record<ProblemStatus, string> = {
  solved: "solved",
  attempted: "attempted",
  todo: "not started",
};

/** The deck's legend: ● solved, ◐ attempted, ○ not yet. Drawn, not typed, so
    the three read at one size and weight in any font. */
export function StatusGlyph({ status, className = "", size = 14 }: { status: ProblemStatus; className?: string; size?: number }) {
  return (
    <svg
      role="img"
      aria-label={STATUS_LABEL[status]}
      width={size}
      height={size}
      viewBox="0 0 14 14"
      className={`inline-block shrink-0 align-[-2px] ${className}`}
    >
      {status === "solved" && (
        <>
          <circle cx="7" cy="7" r="6.25" fill="var(--bull)" />
          <path d="M4.3 7.2l1.8 1.8 3.6-3.8" fill="none" stroke="var(--deck-on-green, #04140b)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {status === "attempted" && (
        <>
          <circle cx="7" cy="7" r="5.75" fill="none" stroke="var(--fg-dim)" strokeWidth="1.25" />
          <path d="M7 1.25a5.75 5.75 0 0 0 0 11.5z" fill="var(--fg-dim)" />
        </>
      )}
      {status === "todo" && <circle cx="7" cy="7" r="5.75" fill="none" stroke="var(--deck-quiet, var(--fg-faint))" strokeWidth="1.25" />}
    </svg>
  );
}

export function LockPill({ lock, className = "" }: { lock: Lock; className?: string }) {
  return (
    <span className={`deck-chip ${lock === "pro" ? "deck-chip-green" : ""} ${className}`}>
      <svg aria-hidden width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
        <rect x="1.5" y="4.25" width="7" height="5" rx="1" fill="currentColor" />
        <path d="M3.25 4.25V3a1.75 1.75 0 0 1 3.5 0v1.25" fill="none" stroke="currentColor" strokeWidth="1.1" />
      </svg>
      {LOCK_META[lock].label}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="deck-kbd">{children}</kbd>;
}

const EYEBROW_TONE = {
  bull: "text-bull",
  amber: "text-amber",
  cyan: "text-cyan",
  dim: "text-fg-faint",
} as const;

/** The deck's section label: the green dot, mono capitals. The tone colours
    the words; the dot stays the brand's. */
export function Eyebrow({ children, tone = "dim", className = "" }: { children: ReactNode; tone?: keyof typeof EYEBROW_TONE; className?: string }) {
  return <div className={`deck-eyebrow ${EYEBROW_TONE[tone]} ${className}`}>{children}</div>;
}

const VERDICT = {
  accepted: { cls: "bg-[var(--deck-green-tint)] text-bull", label: "Accepted", glyph: "✓" },
  "wrong-answer": { cls: "bg-[var(--deck-red-tint)] text-bear", label: "Wrong answer", glyph: "✕" },
  error: { cls: "bg-[var(--deck-amber-tint)] text-amber", label: "Did not run", glyph: "!" },
} as const;

/** The judge's verdict as a chip: tinted, never a fill that shouts. */
export function VerdictPill({ verdict, className = "" }: { verdict: Verdict; className?: string }) {
  const v = VERDICT[verdict];
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2 deck-label ${v.cls} ${className}`}>
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

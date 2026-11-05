// Pure progress math for /practice — importable from tests, API routes and
// the client hook alike (no "use client", no browser globals). Every number
// here is derived from a ProgressState built from REAL verdicts: the
// browser's own ledger (lib/practice/progress.ts) for an anonymous solver, or
// /api/practice/me — lib/db/practice.ts progressFor — once signed in. There is
// no baseline and no seeded history: an empty ledger summarises to zero
// everywhere, and the streak is whatever the calendar says it is.
//
// Day strings are yyyy-mm-dd. `dayKey` names the day of an instant in the
// viewer's zone (a solve at 23:30 belongs to the day the solver saw); every
// other helper steps day strings in UTC arithmetic so DST can never skip or
// double a cell. No Date.now() anywhere in this module: callers pass the day
// they mean.

import type { Badge, Difficulty, ProblemStatus, ProgressState, ProgressSummary, TrackId } from "./types";
import { PROBLEMS } from "./problems";
import { TRACK_ORDER } from "./tracks";

export const EMPTY_PROGRESS: ProgressState = { solved: {}, attempts: {}, submissions: [] };

/* ── days ────────────────────────────────────────────────────────────────── */

/** Names the calendar day of an instant in the viewer's local zone. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Day strings are stepped in UTC arithmetic so DST can never skip a cell. */
export function dayToMs(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(day: string, n: number): string {
  const d = new Date(dayToMs(day) + n * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(day: string): number {
  return (new Date(dayToMs(day)).getUTCDay() + 6) % 7;
}

/** Current streak counts back from today (or from yesterday when today is
    still blank, so a streak is not "broken" before the day is over); longest
    is the best run anywhere in the set. */
export function streaksFrom(activeDays: string[], today: string): { current: number; longest: number } {
  const set = new Set(activeDays);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && addDays(sorted[i - 1], 1) === sorted[i] ? run + 1 : 1;
    if (run > longest) longest = run;
  }
  return { current, longest };
}

/* ── status ──────────────────────────────────────────────────────────────── */

export function statusOf(state: ProgressState, slug: string): ProblemStatus {
  if (state.solved[slug]) return "solved";
  if ((state.attempts[slug] ?? 0) > 0) return "attempted";
  return "todo";
}

/** Problems first solved per day — the heatmap's and the calendar's cells.
    Counted from `solved` (one entry per problem, stamped with its first
    accepted submit), not from the capped `submissions` list. */
export function activityFor(state: ProgressState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const entry of Object.values(state.solved)) {
    const k = dayKey(entry.at);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

export function summarizeProgress(state: ProgressState, today: string): ProgressSummary {
  const byDifficulty: Record<Difficulty, { solved: number; total: number }> = {
    easy: { solved: 0, total: 0 },
    medium: { solved: 0, total: 0 },
    hard: { solved: 0, total: 0 },
  };
  const byTrack = Object.fromEntries(
    TRACK_ORDER.map((t) => [t, { solved: 0, total: 0, nextSlug: null as string | null }])
  ) as Record<TrackId, { solved: number; total: number; nextSlug: string | null }>;

  let solvedCount = 0;
  let attemptedCount = 0;
  for (const p of PROBLEMS) {
    const status = statusOf(state, p.id);
    byDifficulty[p.difficulty].total++;
    byTrack[p.track].total++;
    if (status === "solved") {
      solvedCount++;
      byDifficulty[p.difficulty].solved++;
      byTrack[p.track].solved++;
    } else {
      if (status === "attempted") attemptedCount++;
      if (byTrack[p.track].nextSlug === null) byTrack[p.track].nextSlug = p.id;
    }
  }

  const activeDays = Object.keys(activityFor(state)).sort();

  return {
    solvedCount,
    attemptedCount,
    total: PROBLEMS.length,
    byDifficulty,
    byTrack,
    streak: streaksFrom(activeDays, today),
    activeDays,
  };
}

/* ── mastery badges ──────────────────────────────────────────────────────── */

/** Badges are about mastery and streaks only — never about returns. Every
    one is a plain predicate over the summary, so what the profile shows is
    exactly what the ledger supports. */
export function computeBadges(summary: ProgressSummary): Badge[] {
  const finance = summary.byTrack.finance;
  const tracksTouched = TRACK_ORDER.filter((t) => summary.byTrack[t].solved > 0).length;
  return [
    { id: "first-solve", label: "First solve", glyph: "✓", hint: "accept one submission", earned: summary.solvedCount >= 1 },
    { id: "streak-7", label: "Seven-day streak", glyph: "◆", hint: "solve on seven days in a row", earned: summary.streak.longest >= 7 },
    { id: "ten-easy", label: "Ten easy", glyph: "○", hint: "accept ten easy problems", earned: summary.byDifficulty.easy.solved >= 10 },
    { id: "first-hard", label: "First hard", glyph: "▲", hint: "accept one hard problem", earned: summary.byDifficulty.hard.solved >= 1 },
    {
      id: "track-finance",
      label: "Finance, complete",
      glyph: "Σ",
      hint: "finish every finance problem",
      earned: finance.solved > 0 && finance.solved === finance.total,
    },
    {
      id: "five-tracks",
      label: "Every track",
      glyph: "⟢",
      hint: "accept one problem in each of the five tracks",
      earned: tracksTouched === TRACK_ORDER.length,
    },
  ];
}

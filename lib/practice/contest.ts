// The weekly set — a timed practice set, not a contest with prizes. The
// anchor edition is a fixed instant (Sunday 20:00 IST); every later edition
// is that instant plus whole weeks, and its window is `durationMin` long.
// Pure functions of a "now" the CALLER passes: the countdown lives in a
// client effect, the board's window is computed in the API route from the
// server clock, and nothing here reads Date.now() during a render.

import type { WeeklySet } from "./types";

export const WEEKLY_SET: WeeklySet = {
  num: 14,
  anchorIso: "2026-09-13T14:30:00Z",
  durationMin: 90,
  problems: ["position-size-by-stop", "mean-reversion-half-life", "quantile-signal", "kalman-price-level"],
};

const WEEK_MS = 7 * 86_400_000;

/** The next edition start at or after `nowMs`, as epoch ms. */
export function nextStart(nowMs: number, set: WeeklySet = WEEKLY_SET): number {
  const anchor = Date.parse(set.anchorIso);
  if (nowMs <= anchor) return anchor;
  const weeks = Math.ceil((nowMs - anchor) / WEEK_MS);
  return anchor + weeks * WEEK_MS;
}

export type Edition = {
  num: number;
  /** Epoch ms. */
  start: number;
  end: number;
  /** `nowMs` is inside the window. */
  open: boolean;
  /** The first edition has not started yet. */
  upcoming: boolean;
};

/** The window of edition `num` (≥ the anchor's number), or null. */
export function windowFor(num: number, set: WeeklySet = WEEKLY_SET): { start: number; end: number } | null {
  if (!Number.isInteger(num) || num < set.num) return null;
  const start = Date.parse(set.anchorIso) + (num - set.num) * WEEK_MS;
  return { start, end: start + set.durationMin * 60_000 };
}

/** The edition the board shows at `nowMs`: the one in progress, else the most
    recent finished one, else (before the anchor) the upcoming first one. */
export function editionAt(nowMs: number, set: WeeklySet = WEEKLY_SET): Edition {
  const anchor = Date.parse(set.anchorIso);
  if (nowMs < anchor) {
    return { num: set.num, start: anchor, end: anchor + set.durationMin * 60_000, open: false, upcoming: true };
  }
  const weeks = Math.floor((nowMs - anchor) / WEEK_MS);
  const start = anchor + weeks * WEEK_MS;
  const end = start + set.durationMin * 60_000;
  return { num: set.num + weeks, start, end, open: nowMs < end, upcoming: false };
}

/** Zero-padded parts for a countdown display. Negative input clamps to zero. */
export function formatCountdown(ms: number): { d: string; h: string; m: string; s: string } {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86_400);
  const h = Math.floor((total % 86_400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return { d: pad(d), h: pad(h), m: pad(m), s: pad(s) };
}

/** "1h 12m" / "42m" / "58s" — a solver's time on the board. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

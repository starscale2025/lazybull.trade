// Progress math with NO baseline: an empty ledger is zero everywhere, and
// every figure follows from real solves.

import { describe, expect, it } from "vitest";
import {
  EMPTY_PROGRESS,
  activityFor,
  addDays,
  computeBadges,
  dayToMs,
  statusOf,
  streaksFrom,
  summarizeProgress,
  weekdayOf,
} from "@/lib/practice/summary";
import { PROBLEMS, problemsByTrack } from "@/lib/practice/problems";
import { TRACK_ORDER } from "@/lib/practice/tracks";
import type { ProgressState } from "@/lib/practice/types";

const TODAY = "2026-09-07";
const at = (day: string, hour = 12) => dayToMs(day) + hour * 3_600_000;
const solved = (slug: string, day: string) => ({ [slug]: { at: at(day), lang: "python" as const, runtimeMs: 3 } });

describe("days", () => {
  it("steps day strings without DST surprises", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOf("2026-09-07")).toBe(0); // a Monday
    expect(dayToMs("1970-01-02")).toBe(86_400_000);
  });
});

describe("streaksFrom", () => {
  it("counts back from yesterday when today is blank, and finds the longest run", () => {
    const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-05", "2026-09-06"];
    expect(streaksFrom(days, "2026-09-07")).toEqual({ current: 2, longest: 3 });
    expect(streaksFrom(days, "2026-09-06")).toEqual({ current: 2, longest: 3 });
    expect(streaksFrom(days, "2026-09-09")).toEqual({ current: 0, longest: 3 });
    expect(streaksFrom([], TODAY)).toEqual({ current: 0, longest: 0 });
  });
});

describe("summarizeProgress", () => {
  it("is zero everywhere on an empty ledger and points every track at its first problem", () => {
    const s = summarizeProgress(EMPTY_PROGRESS, TODAY);
    expect(s.total).toBe(PROBLEMS.length);
    expect(s.solvedCount).toBe(0);
    expect(s.attemptedCount).toBe(0);
    expect(s.streak).toEqual({ current: 0, longest: 0 });
    expect(s.activeDays).toEqual([]);
    for (const t of TRACK_ORDER) {
      expect(s.byTrack[t].solved).toBe(0);
      expect(s.byTrack[t].total).toBe(problemsByTrack(t).length);
      expect(s.byTrack[t].nextSlug).toBe(problemsByTrack(t)[0].id);
    }
    expect(s.byDifficulty.easy.total + s.byDifficulty.medium.total + s.byDifficulty.hard.total).toBe(PROBLEMS.length);
  });
  it("counts real solves, moves the track pointer and builds the streak from solve days", () => {
    const state: ProgressState = {
      solved: {
        ...solved("black-scholes-call", "2026-09-05"),
        ...solved("put-call-parity", "2026-09-06"),
        ...solved("normal-cdf", "2026-09-07"),
      },
      attempts: { "implied-vol-bisection": 2, "put-call-parity": 1 },
      submissions: [],
    };
    const s = summarizeProgress(state, TODAY);
    expect(s.solvedCount).toBe(3);
    expect(s.attemptedCount).toBe(1); // put-call-parity is solved, not merely attempted
    expect(s.byTrack.finance.solved).toBe(2);
    expect(s.byTrack.finance.nextSlug).toBe("implied-vol-bisection");
    expect(s.byTrack.maths.solved).toBe(1);
    expect(s.activeDays).toEqual(["2026-09-05", "2026-09-06", "2026-09-07"]);
    expect(s.streak).toEqual({ current: 3, longest: 3 });
    expect(s.byDifficulty.easy.solved).toBe(3);
  });
});

describe("statusOf", () => {
  it("reads solved, then attempted, then todo — nothing else", () => {
    expect(statusOf(EMPTY_PROGRESS, "put-call-parity")).toBe("todo");
    const state: ProgressState = {
      solved: { "monte-carlo-var": { at: 1, lang: "python", runtimeMs: 1 } },
      attempts: { "black-scholes-call": 1 },
      submissions: [],
    };
    expect(statusOf(state, "monte-carlo-var")).toBe("solved");
    expect(statusOf(state, "black-scholes-call")).toBe("attempted");
    expect(statusOf(state, "kelly-fraction")).toBe("todo");
  });
});

describe("activityFor", () => {
  it("counts problems first solved per day, and nothing on an empty ledger", () => {
    expect(activityFor(EMPTY_PROGRESS)).toEqual({});
    const state: ProgressState = {
      solved: {
        a: { at: Date.UTC(2026, 8, 7, 9), lang: "python", runtimeMs: 1 },
        b: { at: Date.UTC(2026, 8, 7, 10), lang: "python", runtimeMs: 1 },
        c: { at: Date.UTC(2026, 8, 1, 10), lang: "python", runtimeMs: 1 },
      },
      attempts: {},
      submissions: [],
    };
    // dayKey names the day in the local zone; these instants fall on the same
    // day in every zone west of UTC+14, which covers the machines this runs on.
    const act = activityFor(state);
    expect(Object.values(act).reduce((n, x) => n + x, 0)).toBe(3);
    expect(Object.keys(act).length).toBe(2);
  });
});

describe("computeBadges", () => {
  it("locks everything on an empty ledger and lights the right ones later", () => {
    const base = summarizeProgress(EMPTY_PROGRESS, TODAY);
    expect(computeBadges(base).every((b) => !b.earned)).toBe(true);
    expect(computeBadges(base).map((b) => b.id)).toEqual(["first-solve", "streak-7", "ten-easy", "first-hard", "track-finance", "five-tracks"]);

    const finance = problemsByTrack("finance");
    const state: ProgressState = {
      solved: Object.fromEntries(finance.map((p, i) => [p.id, { at: at(addDays(TODAY, -i)), lang: "python" as const, runtimeMs: 1 }])),
      attempts: {},
      submissions: [],
    };
    const s = summarizeProgress(state, TODAY);
    const earned = computeBadges(s).filter((b) => b.earned).map((b) => b.id);
    expect(earned).toContain("first-solve");
    expect(earned).toContain("first-hard"); // the binomial American put is hard
    expect(earned).toContain("track-finance");
    expect(earned).toContain("streak-7"); // ten consecutive days
    expect(earned).not.toContain("five-tracks");
  });
});

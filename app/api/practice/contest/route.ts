// GET /api/practice/contest?set=<num> — the board for one edition of the
// weekly set, ranked on solves then time (lib/db/practice.ts contestBoard),
// plus solver counts for the editions before it. Without `set` it picks the
// edition in progress or the most recent finished one (lib/practice/contest.ts
// editionAt). Every number is an aggregation over real submissions; an empty
// board is an empty board.

import { contestBoard, solversPerWindow } from "@/lib/db/practice";
import { WEEKLY_SET, editionAt, windowFor } from "@/lib/practice/contest";
import { gate, json } from "@/lib/practice/http";
import type { PastSet } from "@/lib/practice/types";

export const dynamic = "force-dynamic";

const PAST_EDITIONS = 6;

export async function GET(req: Request) {
  const limited = await gate(req, "contest", 60, 3000);
  if (limited) return limited;

  const now = Date.now();
  const current = editionAt(now);
  const asked = Number(new URL(req.url).searchParams.get("set"));
  const num = Number.isInteger(asked) ? Math.min(current.num, Math.max(WEEKLY_SET.num, asked)) : current.num;
  const win = windowFor(num);
  if (!win) return json({ ok: false, error: "no such set" }, 404);

  const pastNums: number[] = [];
  for (let n = num - 1; n >= WEEKLY_SET.num && pastNums.length < PAST_EDITIONS; n--) pastNums.push(n);
  const pastWindows = pastNums.map((n) => windowFor(n)!);

  const set = {
    num,
    start: new Date(win.start).toISOString(),
    end: new Date(win.end).toISOString(),
    open: now >= win.start && now < win.end,
    upcoming: now < win.start,
    durationMin: WEEKLY_SET.durationMin,
    problems: WEEKLY_SET.problems,
  };

  try {
    const [rows, solvers] = await Promise.all([
      contestBoard(WEEKLY_SET.problems, new Date(win.start), new Date(win.end)),
      solversPerWindow(WEEKLY_SET.problems, pastWindows.map((w) => ({ start: new Date(w.start), end: new Date(w.end) }))),
    ]);
    const past: PastSet[] = pastNums.map((n, i) => ({
      num: n,
      startIso: new Date(pastWindows[i].start).toISOString(),
      solvers: solvers[i] ?? 0,
      total: WEEKLY_SET.problems.length,
    }));
    return json({ ok: true, set, rows, past, dbOk: true });
  } catch {
    return json({ ok: true, set, rows: [], past: [], dbOk: false });
  }
}

// GET /api/practice/stats — per-slug submit and accepted counts from real
// submissions, for the acceptance column on /practice. Cached in memory for
// a minute per instance: the list page is the busiest surface in the module
// and the number moves slowly. `{}` with dbOk:false when the database is
// unreachable, so the UI shows "—" rather than a stale or invented figure.

import { statsFor, MIN_SUBMISSIONS_FOR_RATE } from "@/lib/db/practice";
import { PROBLEMS } from "@/lib/practice/problems";
import { gate, json } from "@/lib/practice/http";
import type { SlugStats } from "@/lib/practice/types";

export const dynamic = "force-dynamic";

const TTL_MS = 60_000;
let cache: { at: number; stats: Record<string, SlugStats> } | null = null;

export async function GET(req: Request) {
  const limited = await gate(req, "stats", 60, 3000);
  if (limited) return limited;

  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) {
    return json({ ok: true, stats: cache.stats, minSubmissions: MIN_SUBMISSIONS_FOR_RATE, cached: true, dbOk: true });
  }
  try {
    const stats = await statsFor(PROBLEMS.map((p) => p.id));
    cache = { at: now, stats };
    return json({ ok: true, stats, minSubmissions: MIN_SUBMISSIONS_FOR_RATE, cached: false, dbOk: true });
  } catch {
    return json({ ok: true, stats: {}, minSubmissions: MIN_SUBMISSIONS_FOR_RATE, cached: false, dbOk: false });
  }
}

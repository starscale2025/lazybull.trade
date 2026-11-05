// GET /api/practice/[slug]/cases?mode=submit — the hidden cases' INPUTS, so
// the browser can run them; their expectations stay here. Without
// mode=submit it answers with the visible cases, which the page already
// carries, so the call is harmless either way. Submitting a locked problem
// needs the plan its lock names, and this route says so before the solver
// spends a run on it: 402 { ok: false, error: "locked", need }.

import { getProblem, hiddenCases, visibleCases } from "@/lib/practice/content";
import { lockNeed, viewer } from "@/lib/practice/access";
import { gate, json } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await gate(req, "cases", 60, 1800);
  if (limited) return limited;

  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) return json({ ok: false, error: "no such problem" }, 404);

  const mode = new URL(req.url).searchParams.get("mode") === "submit" ? "submit" : "run";
  if (mode === "run") {
    return json({ ok: true, mode, cases: visibleCases(problem).map((c) => ({ id: c.id, input: c.input })) });
  }

  const v = await viewer();
  const need = lockNeed(problem.lock, v.limits);
  if (need) return json({ ok: false, error: "locked", need }, 402);

  return json({ ok: true, mode, cases: hiddenCases(problem).map((c) => ({ id: c.id, input: c.input })) });
}

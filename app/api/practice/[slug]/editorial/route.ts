// GET /api/practice/[slug]/editorial — the walkthrough and every hint,
// behind the plan wall. The page ships only the first hint and a flag that
// an editorial exists; the text itself is served here, so a free viewer's RSC
// payload does not contain what the wall is selling. 402 { ok: false,
// error: "locked", need } tells the client which plan opens it.

import { teacherNeed, viewer } from "@/lib/practice/access";
import { getProblem } from "@/lib/practice/content";
import { gate, json } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await gate(req, "editorial", 60, 1800);
  if (limited) return limited;

  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) return json({ ok: false, error: "no such problem" }, 404);

  const v = await viewer();
  const need = teacherNeed(problem.lock, v.limits);
  if (need) return json({ ok: false, error: "locked", need }, 402);

  return json({ ok: true, editorial: problem.editorial ?? null, hints: problem.hints });
}

// POST /api/practice/[slug]/submit — the judge of record.
//
// The browser ran the solver's Python (public/practice/pyodide-worker.js) and
// sends what each case printed; this route compares those strings with the
// expectations only it holds (lib/practice/content), computes the verdict
// with the same rule the UI states (lib/practice/judge.ts), books the row,
// and answers with a report that carries `expected` for VISIBLE cases only.
//
// What the design accepts: the outputs come from the solver's machine, so a
// determined person could post strings by hand. They would still need the
// right answers — hidden expectations never leave this process, and the
// per-IP cap makes the comparison a poor oracle. That is the honest shape of
// browser-side execution, and it costs nothing when someone chooses to fool
// their own streak.
//
// Recording is best-effort: a database blip returns the verdict with
// `recorded: false` and says why, never a fake success and never a 500 that
// hides a real verdict.

import { SubmitBody, MAX_SUBMIT_BODY_BYTES, recordSubmission, runtimePercentile } from "@/lib/db/practice";
import { lockNeed, viewer } from "@/lib/practice/access";
import { getProblem } from "@/lib/practice/content";
import { gate, json, readJson } from "@/lib/practice/http";
import { judgeOutputs, type Judgement } from "@/lib/practice/judge";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await gate(req, "submit", 30, 900);
  if (limited) return limited;

  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) return json({ ok: false, error: "no such problem" }, 404);

  const read = await readJson(req, MAX_SUBMIT_BODY_BYTES);
  if ("response" in read) return read.response;
  const parsed = SubmitBody.safeParse(read.body);
  if (!parsed.success) {
    return json({ ok: false, error: "invalid body", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
  }
  const body = parsed.data;

  const v = await viewer();
  if (body.mode === "submit") {
    const need = lockNeed(problem.lock, v.limits);
    if (need) return json({ ok: false, error: "locked", need }, 402);
  }

  const judgement: Judgement = body.error
    ? { verdict: "error", passed: 0, total: 0, runtimeMs: 0, cases: [] }
    : judgeOutputs(problem.cases, body.outputs, body.mode);

  let beats: number | null = null;
  if (body.mode === "submit" && judgement.verdict === "accepted") {
    beats = await runtimePercentile(slug, judgement.runtimeMs).catch(() => null);
  }

  let recorded = false;
  let id: string | null = null;
  let recordError: string | null = null;
  try {
    const r = await recordSubmission({
      identity: { userId: v.userId, device: body.device },
      slug,
      lang: body.lang,
      mode: body.mode,
      verdict: judgement.verdict,
      passed: judgement.passed,
      total: judgement.total,
      runtimeMs: judgement.runtimeMs,
      code: body.code,
    });
    recorded = true;
    id = r.id;
  } catch (e) {
    recordError = e instanceof Error ? e.message : "database unavailable";
  }

  return json({
    ok: true,
    report: { ...judgement, beats },
    recorded,
    id,
    ...(recordError ? { recordError } : {}),
    ...(body.error ? { error: body.error } : {}),
  });
}

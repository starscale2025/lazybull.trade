// GET /api/practice/me — the signed-in solver's ledger, from the rows: first
// accepted submit per problem, attempt counts, the last 50 submissions, the
// minted certificates, and the plan flags the workspace gates on. Reads by
// user id AND by the device header, so the week someone solved before
// signing in comes with them. Anonymous callers get { ok: true, anonymous:
// true } and keep reading their own device's localStorage.

import { certificatesFor, progressFor } from "@/lib/db/practice";
import { viewer } from "@/lib/practice/access";
import { deviceOf, gate, json } from "@/lib/practice/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limited = await gate(req, "me", 60, 3000);
  if (limited) return limited;

  const v = await viewer();
  if (!v.userId) return json({ ok: true, anonymous: true, plan: v.plan, limits: v.limits });

  try {
    const [progress, certificates] = await Promise.all([
      progressFor({ userId: v.userId, device: deviceOf(req.headers) }),
      certificatesFor(v.userId),
    ]);
    return json({ ok: true, anonymous: false, name: v.name, plan: v.plan, limits: v.limits, progress, certificates, dbOk: true });
  } catch {
    return json({ ok: true, anonymous: false, name: v.name, plan: v.plan, limits: v.limits, progress: null, certificates: [], dbOk: false });
  }
}

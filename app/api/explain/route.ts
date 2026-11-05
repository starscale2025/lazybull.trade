// POST /api/explain — the AI teacher, gated the way /pricing says it is.
//
// The 2026-09 diligence memo, verbatim: "/api/explain … is not gated by
// sign-in, plan, or a daily cap. The '5 explains per day' free-tier limit on
// the pricing page does not exist in code." Three things changed:
//   • a per-UTC-day cap from PLAN_LIMITS[plan].explainsPerDay, counted in
//     lib/billing/usage.ts BEFORE the model is called (a capped request must
//     cost nothing), keyed per user when signed in and per IP otherwise, so
//     the free allowance is five a day whether or not a visitor made an
//     account — the same number the pricing page prints;
//   • the system prompt is the locked one in lib/billing/explain-policy.ts:
//     explain the position you built; never recommend, forecast or size;
//   • every response, mock and live, carries the AI-output disclosure.
// The per-minute limiter stays. The daily cap is a product limit; the
// per-minute one bounds spend against IP rotation (lib/rate-limit.ts).
//
// Sign-in is NOT required. The free tier is the funnel; what an anonymous
// visitor gets is the free allowance on their network address, not an open
// tap. The failure policy is unchanged: no key, an upstream error or a
// timeout all fall back to `source:"mock"` — the deterministic explanation
// built from the numbers the client already computed — so the teacher never
// answers with a 500.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  EXPLAIN_DISCLOSURE,
  ExplainBody,
  MAX_EXPLAIN_BODY_BYTES,
  TEACHER_SYSTEM_PROMPT,
  mockExplanation,
} from "@/lib/billing/explain-policy";
import { PAYWALL_STATUS, paywall } from "@/lib/billing/gate";
import { BILLING_EVENTS, PLAN_LIMITS, type Plan } from "@/lib/billing/types";
import { consumeDaily, type DailyResult } from "@/lib/billing/usage";
import { logServerEvent } from "@/lib/db/events";
import { clientIp, underLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Per-minute caps (per-IP + global) — each request can bill paid gpt-4o-mini.
// KV-backed when configured, per-instance in-memory otherwise; see
// lib/rate-limit.ts for the degradation policy.
const MAX_PER_IP = 10;
const MAX_GLOBAL = 60;

/** JSON has no Infinity: null means unbounded on the wire. */
const num = (n: number | null) =>
  typeof n === "number" && Number.isFinite(n) ? n.toFixed(0) : "unbounded";

type Source = "openai" | "mock";

/** The one response shape, mock or live: text + disclosure + today's tally. */
async function served(source: Source, text: string, plan: Plan, userId: string | null, usage: DailyResult) {
  await logServerEvent(BILLING_EVENTS.explainServed, userId, { source, plan });
  return NextResponse.json({
    source,
    text,
    disclosure: EXPLAIN_DISCLOSURE,
    usage: { count: usage.count, limit: usage.limit, resetsAt: usage.resetsAt },
  });
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!(await underLimit("explain", ip, MAX_PER_IP, MAX_GLOBAL))) {
    return NextResponse.json({ error: "too many explain requests — slow down a moment" }, { status: 429 });
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_EXPLAIN_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_EXPLAIN_BODY_BYTES) {
      return NextResponse.json({ error: "payload too large" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const parsed = ExplainBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 },
    );
  }
  const body: ExplainBody = parsed.data;

  // Who is asking, and on which plan. auth() reads the session cookie; a
  // failure there (no Mongo, no auth secret in local dev) is an anonymous
  // request, never a 500 — the memo's complaint was the missing gate, and a
  // gate that breaks the teacher whenever auth hiccups would be a worse one.
  // The cap is consumed AFTER validation (a malformed body must not spend an
  // explain) and BEFORE the model call (a capped one must not cost anything).
  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;
  const plan: Plan = session?.user?.plan ?? "free";
  const usage = await consumeDaily(
    "explain",
    userId ? `user:${userId}` : `ip:${ip}`,
    PLAN_LIMITS[plan].explainsPerDay,
  );
  if (!usage.allowed) {
    await logServerEvent(BILLING_EVENTS.hitPaywall, userId, { surface: "explain", plan });
    return NextResponse.json(paywall("explain_cap", plan, usage.limit), { status: PAYWALL_STATUS });
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return served("mock", mockExplanation(body), plan, userId, usage);
  }

  try {
    const user = `Explain this position:
Strategy: ${body.strategy}
Underlying: ${body.underlying} (spot $${body.spot.toFixed(2)})
Direction: ${body.bias}
Net: ${body.net}
Max profit: $${num(body.maxProfit)}
Max loss: $${num(body.maxLoss)}
Defined risk: ${body.defined}
Breakevens: ${body.breakevens.map((b) => `$${b.toFixed(2)}`).join(", ") || "n/a"}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(20000), // a hung LLM call must never wedge the server
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          { role: "system", content: TEACHER_SYSTEM_PROMPT },
          { role: "user", content: user },
        ],
      }),
    });
    if (!r.ok) {
      return served("mock", mockExplanation(body), plan, userId, usage);
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return served("mock", mockExplanation(body), plan, userId, usage);
    return served("openai", text, plan, userId, usage);
  } catch {
    return served("mock", mockExplanation(body), plan, userId, usage);
  }
}

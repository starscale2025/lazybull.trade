import { NextResponse } from "next/server";
import { z } from "zod";

// The body used to be cast straight from req.json() with no checks: a missing
// `breakevens` threw on `.length` (raw 500), and unbounded strings flowed into
// the paid LLM prompt. Note JSON has no Infinity — an unlimited maxProfit
// arrives as null, so these are nullable and null MEANS unlimited.
const BodySchema = z.object({
  strategy: z.string().min(1).max(120),
  bias: z.string().min(1).max(40),
  defined: z.boolean(),
  net: z.string().min(1).max(40),
  maxProfit: z.number().nullable().default(null),
  maxLoss: z.number().nullable().default(null),
  breakevens: z.array(z.number().finite()).max(8).default([]),
  spot: z.number().finite().positive(),
  underlying: z.string().min(1).max(20),
});
type Body = z.infer<typeof BodySchema>;

/** JSON has no Infinity: null means unbounded on the wire. */
const num = (n: number | null) =>
  typeof n === "number" && Number.isFinite(n) ? n.toFixed(0) : "unbounded";

/** Largest body we'll accept (chars) — keeps junk out of the LLM bill. */
const MAX_BODY_BYTES = 4_000;

function mockExplanation(b: Body) {
  const fmt = (n: number | null) =>
    typeof n === "number" && Number.isFinite(n) ? `$${Math.abs(n).toFixed(0)}` : "unlimited";
  const lossLine = b.defined
    ? `your worst case is losing ${fmt(b.maxLoss)} — that's the most you can ever lose on this trade.`
    : `your worst case is open-ended. If the move goes the wrong way without you closing, the loss can keep growing.`;
  // null/non-finite maxProfit means UNLIMITED (e.g. a long call), not "you
  // collected premium" — JSON drops Infinity to null, and the old check sent
  // every unlimited-upside trade down the credit-strategy branch.
  const mp = typeof b.maxProfit === "number" && Number.isFinite(b.maxProfit) ? b.maxProfit : null;
  const winLine =
    mp === null
      ? `your best case is open-ended — the further the move runs your way, the more this gains.`
      : mp > 0
        ? `your best case is making ${fmt(mp)}, which happens at expiry if the stock lands in the right zone.`
        : `your best case is the premium you collected up front.`;
  const beLine =
    b.breakevens.length > 0
      ? `Your break-even price${b.breakevens.length > 1 ? "s are" : " is"} ${b.breakevens
          .map((p) => `$${p.toFixed(2)}`)
          .join(" and ")}.`
      : `There's no clean break-even on this one — read the P&L curve closely.`;
  const wrong = b.defined
    ? `The thing that goes wrong: the stock moves against you fast and you panic-close before expiry. Plan your exit before you click trade.`
    : `The thing that goes wrong: a sudden gap (earnings, news) past your strikes. Defined-risk versions exist — consider one.`;

  return [
    `Here's a ${b.strategy} on ${b.underlying} in plain English. It's a ${b.bias} bet you're paying a ${b.net} to enter.`,
    `${winLine} On the other side, ${lossLine}`,
    beLine,
    wrong,
  ].join("\n\n");
}

export async function POST(req: Request) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "payload too large" }, { status: 413 });
    }
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    );
  }
  const body: Body = parsed.data;

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return NextResponse.json({ source: "mock", text: mockExplanation(body) });
  }

  try {
    const sys =
      "You are an options-trading teacher explaining strategies to a curious 12-year-old. Be warm, plain, and concrete. Always cover: the bet being made, max profit, max loss, breakeven price(s), and one specific thing that could go wrong. 4 short paragraphs, no jargon, no markdown.";
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
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });
    if (!r.ok) {
      return NextResponse.json({ source: "mock", text: mockExplanation(body) });
    }
    const data = await r.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return NextResponse.json({ source: "openai", text: text || mockExplanation(body) });
  } catch {
    return NextResponse.json({ source: "mock", text: mockExplanation(body) });
  }
}

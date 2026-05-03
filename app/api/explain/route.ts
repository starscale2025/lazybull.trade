import { NextResponse } from "next/server";

type Body = {
  strategy: string;
  bias: string;
  defined: boolean;
  net: string;
  maxProfit: number;
  maxLoss: number;
  breakevens: number[];
  spot: number;
  underlying: string;
};

function mockExplanation(b: Body) {
  const fmt = (n: number) =>
    Number.isFinite(n) ? `$${Math.abs(n).toFixed(0)}` : "unlimited";
  const lossLine = b.defined
    ? `your worst case is losing ${fmt(b.maxLoss)} — that's the most you can ever lose on this trade.`
    : `your worst case is open-ended. If the move goes the wrong way without you closing, the loss can keep growing.`;
  const winLine =
    Number.isFinite(b.maxProfit) && b.maxProfit > 0
      ? `your best case is making ${fmt(b.maxProfit)}, which happens at expiry if the stock lands in the right zone.`
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
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

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
Max profit: $${Number.isFinite(body.maxProfit) ? body.maxProfit.toFixed(0) : "unbounded"}
Max loss: $${Number.isFinite(body.maxLoss) ? body.maxLoss.toFixed(0) : "unbounded"}
Defined risk: ${body.defined}
Breakevens: ${body.breakevens.map((b) => `$${b.toFixed(2)}`).join(", ") || "n/a"}`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
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

// What the AI teacher is allowed to say, and how every answer is labelled.
//
// The 2026-09 diligence memo asked for two things on /api/explain: lock the
// system prompt to "explain the position you built; never recommend, forecast
// or size", and put an AI-output disclosure on every response. Both live here
// rather than in the route so the client can rely on the exact disclosure
// string and a test can assert the prompt still carries each rule.
//
// Compliance framing (docs/strategy/09-compliance-risk.md): lazybull is a
// paper-only education product with no advisory registration anywhere. The
// teacher describes a position the user already constructed; the moment it
// says what to do next it becomes advice. The prompt is written as hard
// rules, not tone guidance, and the mock fallback below obeys the same rules
// by construction — it is the same four paragraphs, built from the numbers
// the client already computed, and __tests__/explain-cap.test.ts holds it to
// the same "no you-should" bar as the prompt.
//
// PURE. zod only, no server imports: the route (app/api/explain) is the only
// thing that talks to the model, and components render EXPLAIN_DISCLOSURE.

import { z } from "zod";

/** Sent on every /api/explain response — mock and live — and rendered under the text. */
export const EXPLAIN_DISCLOSURE =
  "AI-generated explanation of a position you built · educational · not investment advice";

export const TEACHER_SYSTEM_PROMPT = `You are a patient options teacher inside a paper-trading workbench. The user has already built the position described in the message. Your only job is to explain THAT position in plain English.

Rules you never break:
1. Explain only the position described. Do not recommend opening, closing, adjusting, rolling, hedging or sizing it, and do not suggest a different trade.
2. Do not forecast the underlying, implied volatility or the market. Never say what is likely, probable or expected to happen, and never give a probability.
3. Never write "you should", "I would", "consider", "it may be worth", or any other phrasing that tells the user what to do.
4. Cover, in this order: the bet the position expresses; the maximum profit and when it is reached; the maximum loss and when it is reached; the breakeven price or prices; one specific thing that could go wrong for this position.
5. Plain English. Any term of art gets a one-clause definition the first time it appears. No markdown, no headings, no lists. Four short paragraphs.
6. End on the last fact. No closing encouragement, no question back to the user, nothing that reads as a call to action.`;

/**
 * The request body /api/explain accepts. It used to be cast straight from
 * req.json() with no checks: a missing `breakevens` threw on `.length` (raw
 * 500), and unbounded strings flowed into the paid LLM prompt. Note JSON has
 * no Infinity — an unlimited maxProfit arrives as null, so these are nullable
 * and null MEANS unlimited.
 */
export const ExplainBody = z.object({
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
export type ExplainBody = z.infer<typeof ExplainBody>;

/** Largest body /api/explain accepts (chars) — keeps junk out of the LLM bill. */
export const MAX_EXPLAIN_BODY_BYTES = 4_000;

/**
 * The deterministic fallback — no key, upstream error, timeout. Same four
 * paragraphs the prompt demands, in the same order, from the numbers the
 * client already computed. It describes; it never tells the reader what to
 * do next, which is the one thing the previous wording did ("plan your exit
 * before you click trade", "consider a defined-risk version").
 */
export function mockExplanation(b: ExplainBody): string {
  const fmt = (n: number | null) =>
    typeof n === "number" && Number.isFinite(n) ? `$${Math.abs(n).toFixed(0)}` : "unlimited";
  const lossLine = b.defined
    ? `the worst case is a loss of ${fmt(b.maxLoss)} — the most this position can ever lose.`
    : `the worst case is open-ended: if the move goes the wrong way while the position stays open, the loss keeps growing.`;
  // null/non-finite maxProfit means UNLIMITED (e.g. a long call), not "premium
  // collected" — JSON drops Infinity to null.
  const mp = typeof b.maxProfit === "number" && Number.isFinite(b.maxProfit) ? b.maxProfit : null;
  const winLine =
    mp === null
      ? `the best case is open-ended — the further the move runs in the position's favour, the more it gains.`
      : mp > 0
        ? `the best case is a gain of ${fmt(mp)}, reached at expiry if the stock lands in the right zone.`
        : `the best case is keeping the premium collected up front.`;
  const beLine =
    b.breakevens.length > 0
      ? `The break-even price${b.breakevens.length > 1 ? "s are" : " is"} ${b.breakevens
          .map((p) => `$${p.toFixed(2)}`)
          .join(" and ")} — where the position neither gains nor loses at expiry.`
      : `There is no clean break-even on this one; the P&L curve carries that detail.`;
  const wrong = b.defined
    ? `One thing that can go wrong: the stock moves against the position fast, and a position closed before expiry can lock in a loss that the payoff at expiry would not show.`
    : `One thing that can go wrong: a sudden gap on earnings or news carries the price past the strikes before anything can be done about it, and with undefined risk the loss keeps growing with the move.`;

  return [
    `Here is a ${b.strategy} on ${b.underlying} in plain English. It is a ${b.bias} position entered for a net ${b.net}.`,
    `${winLine} On the other side, ${lossLine}`,
    beLine,
    wrong,
  ].join("\n\n");
}

// The explain cap and the teacher's leash, as the 2026-09 diligence memo
// asked for them: "5 explains per day" must exist in code (explainGate,
// enforced by app/api/explain through consumeDaily), the system prompt must
// say "explain the position you built; never recommend, forecast or size",
// and every answer carries the disclosure. The mock fallback is held to the
// same rules as the prompt, because it ships on every keyless deploy.

import { describe, expect, it } from "vitest";
import { explainGate, paywall } from "@/lib/billing/gate";
import { EXPLAIN_DISCLOSURE, ExplainBody, MAX_EXPLAIN_BODY_BYTES, TEACHER_SYSTEM_PROMPT, mockExplanation } from "@/lib/billing/explain-policy";
import { PLAN_LIMITS } from "@/lib/billing/types";

// Phrases that turn a description into advice. The prompt forbids them; the
// mock must not contain them either.
const ADVICE = /\byou should\b|\bi would\b|\bconsider\b|\bit may be worth\b|\bwe recommend\b|\bbuy now\b|\bclick trade\b/i;

describe("explainGate — the pricing page's number, in code", () => {
  it("free is exactly PLAN_LIMITS.free.explainsPerDay per day, counted per request", () => {
    const cap = PLAN_LIMITS.free.explainsPerDay!;
    expect(cap).toBe(5);
    for (let n = 1; n <= cap; n++) expect(explainGate("free", n).allowed).toBe(true);
    expect(explainGate("free", cap + 1).allowed).toBe(false);
    expect(explainGate("free", cap + 1).limit).toBe(cap);
  });

  it("every paid tier is uncapped", () => {
    for (const p of ["plus", "pro", "power"] as const) {
      expect(PLAN_LIMITS[p].explainsPerDay).toBeNull();
      expect(explainGate(p, 10_000)).toEqual({ allowed: true, limit: null });
    }
  });

  it("the 402 a capped free user gets points at Plus with the cap it hit", () => {
    expect(paywall("explain_cap", "free", 5)).toEqual({
      ok: false,
      error: "explain_cap",
      plan: "free",
      limit: 5,
      upgrade: "/pricing#plus",
    });
  });
});

describe("the teacher's leash", () => {
  it("the disclosure is the exact string the clients render", () => {
    expect(EXPLAIN_DISCLOSURE).toBe("AI-generated explanation of a position you built · educational · not investment advice");
  });

  it("the system prompt carries each rule as a hard rule", () => {
    const p = TEACHER_SYSTEM_PROMPT;
    expect(p).toMatch(/explain only the position described/i);
    expect(p).toMatch(/do not recommend opening, closing, adjusting, rolling, hedging or sizing/i);
    expect(p).toMatch(/do not forecast/i);
    expect(p).toMatch(/never give a probability/i);
    expect(p).toMatch(/never write "you should"/i);
    expect(p).toMatch(/maximum profit/i);
    expect(p).toMatch(/maximum loss/i);
    expect(p).toMatch(/breakeven/i);
    expect(p).toMatch(/one specific thing that could go wrong/i);
    expect(p).toMatch(/plain english/i);
    expect(p).toMatch(/no closing encouragement/i);
    expect(p).toMatch(/call to action/i);
  });

  const base = {
    strategy: "bull call spread",
    bias: "bullish",
    defined: true,
    net: "debit",
    maxProfit: 300,
    maxLoss: 200,
    breakevens: [102],
    spot: 100,
    underlying: "AAPL",
  };

  it("the mock covers max profit, max loss, breakevens and a failure mode without telling the reader what to do", () => {
    for (const body of [
      base,
      { ...base, defined: false, maxLoss: null, strategy: "short strangle", net: "credit", maxProfit: 150, breakevens: [90, 110] },
      { ...base, maxProfit: null, breakevens: [] }, // unlimited upside, no clean break-even
    ]) {
      const text = mockExplanation(ExplainBody.parse(body));
      expect(text.split("\n\n")).toHaveLength(4);
      expect(text).toMatch(/best case/i);
      expect(text).toMatch(/worst case/i);
      expect(text).toMatch(/break-even/i);
      expect(text).toMatch(/go wrong/i);
      expect(text).not.toMatch(ADVICE);
      expect(text).not.toMatch(/\?$/m); // no question back to the user
    }
    expect(mockExplanation(ExplainBody.parse({ ...base, maxProfit: null }))).toMatch(/open-ended/);
    expect(mockExplanation(ExplainBody.parse({ ...base, maxProfit: 0, net: "credit" }))).toMatch(/premium collected/);
    expect(mockExplanation(ExplainBody.parse(base))).toContain("$102.00");
  });

  it("ExplainBody: null means unbounded, breakevens default, oversized strings are refused", () => {
    expect(ExplainBody.safeParse({ ...base, maxProfit: null, maxLoss: null }).success).toBe(true);
    const noBe = ExplainBody.safeParse({ ...base, breakevens: undefined });
    expect(noBe.success && noBe.data.breakevens).toEqual([]);
    expect(ExplainBody.safeParse({ ...base, strategy: "x".repeat(121) }).success).toBe(false);
    expect(ExplainBody.safeParse({ ...base, spot: -1 }).success).toBe(false);
    expect(ExplainBody.safeParse({ ...base, breakevens: Array(9).fill(1) }).success).toBe(false);
    expect(MAX_EXPLAIN_BODY_BYTES).toBe(4_000);
  });
});

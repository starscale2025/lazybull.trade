import { describe, expect, it } from "vitest";
import { DAILY_SLUG, FEATURED, PROBLEMS, RESERVED_SLUGS, neighbours, titleFor, trackStats } from "@/lib/practice/problems";
import { PROBLEM_CONTENT, allProblems, forClient, getProblem, hiddenCases, visibleCases } from "@/lib/practice/content";
import { TRACK_ORDER } from "@/lib/practice/tracks";
import { WEEKLY_SET } from "@/lib/practice/contest";
import { BOT_REGISTRY } from "@/lib/quant/bots";
import { priceOption } from "@/lib/pricing";
import { sharpe } from "@/lib/quant/series";

describe("registry rows", () => {
  it("has 48 numbered rows with unique, URL-safe, non-reserved slugs", () => {
    expect(PROBLEMS.length).toBe(48);
    const ids = PROBLEMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect((RESERVED_SLUGS as readonly string[]).includes(id)).toBe(false);
    }
    expect(PROBLEMS.map((p) => p.num)).toEqual(PROBLEMS.map((_, i) => i + 1));
  });
  it("covers every track in order and knows its neighbours", () => {
    for (const t of TRACK_ORDER) expect(trackStats(t).total).toBeGreaterThanOrEqual(9);
    expect(neighbours(PROBLEMS[0].id).prev).toBeNull();
    expect(neighbours(PROBLEMS[0].id).next?.id).toBe(PROBLEMS[1].id);
    expect(neighbours("nope")).toEqual({ prev: null, next: null });
  });
  it("points every related bot at a real bot", () => {
    const bots = new Set(BOT_REGISTRY.map((b) => b.id));
    for (const p of PROBLEMS) if (p.related?.bot) expect(bots.has(p.related.bot)).toBe(true);
  });
  it("keeps the daily / weekly picks real and titles resolvable", () => {
    expect(titleFor(PROBLEMS[0].id)).toBe(PROBLEMS[0].title);
    expect(titleFor("no-such-slug")).toBe("no-such-slug");
    expect(PROBLEMS.some((p) => p.id === DAILY_SLUG)).toBe(true);
    for (const s of WEEKLY_SET.problems) expect(PROBLEMS.some((p) => p.id === s)).toBe(true);
    expect(FEATURED.length).toBe(5);
  });
});

describe("content", () => {
  it("matches the rows one to one", () => {
    const rows = new Set(PROBLEMS.map((p) => p.id));
    const keys = Object.keys(PROBLEM_CONTENT);
    expect(new Set(keys)).toEqual(rows);
    expect(allProblems().length).toBe(48);
  });
  it("gives every problem a stub, nine cases and a failing case on each side", () => {
    for (const p of allProblems()) {
      expect(p.stubs.python.length).toBeGreaterThan(40);
      expect(p.stubs.python).toContain("# TODO");
      expect(p.statement.length).toBeGreaterThanOrEqual(2);
      expect(p.examples.length).toBeGreaterThanOrEqual(1);
      expect(p.hints.length).toBeGreaterThanOrEqual(1);
      const visible = p.cases.filter((c) => !c.hidden);
      const hidden = p.cases.filter((c) => c.hidden);
      expect(visible.map((c) => c.id)).toEqual(["1", "2", "3"]);
      expect(hidden.length).toBe(6);
      expect(visible.some((c) => c.id === p.failing.caseId)).toBe(true);
      expect(hidden.some((c) => c.id === p.failingHidden.caseId)).toBe(true);
      const c3 = visible.find((c) => c.id === p.failing.caseId)!;
      expect(p.failing.got).not.toBe(c3.expected);
      const h = hidden.find((c) => c.id === p.failingHidden.caseId)!;
      expect(p.failingHidden.got).not.toBe(h.expected);
    }
  });
  it("names an entry function every stub defines at top level", () => {
    for (const p of allProblems()) {
      expect(p.entry).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
      const defs = p.stubs.python.match(/^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/gm) ?? [];
      const names = defs.map((d) => d.replace(/^def\s+/, "").replace(/\s*\($/, ""));
      expect(names.filter((n) => n === p.entry).length).toBe(1);
      expect(p.statement.join(" ")).toContain(`${p.entry}(`);
    }
  });
  it("hands the client the visible cases only — no hidden inputs, no expectations, no editorial", () => {
    for (const p of allProblems()) {
      const c = forClient(p);
      expect(c.cases.map((x) => x.id)).toEqual(visibleCases(p).map((x) => x.id));
      expect(c.cases.every((x) => !x.hidden)).toBe(true);
      expect(c.hiddenCount).toBe(hiddenCases(p).length);
      expect(c.hiddenCount).toBe(6);
      expect(c.firstHint).toBe(p.hints[0]);
      expect(c.hintCount).toBe(p.hints.length);
      expect(c.hasEditorial).toBe(Boolean(p.editorial?.length));
      const json = JSON.stringify(c);
      for (const h of hiddenCases(p)) {
        expect(json).not.toContain(h.input);
        expect(json).not.toContain(`"expected":"${h.expected}","hidden"`);
      }
      expect(json).not.toContain("editorial");
      expect("editorial" in c).toBe(false);
      expect("hints" in c).toBe(false);
    }
  });
  it("gives the featured five a typescript stub, an editorial and three hints", () => {
    for (const slug of FEATURED) {
      const p = getProblem(slug)!;
      expect(p.stubs.typescript).toBeTruthy();
      expect(p.stubs.typescript).toContain("// TODO");
      expect(p.editorial?.length ?? 0).toBeGreaterThanOrEqual(3);
      expect(p.hints.length).toBe(3);
    }
  });
  it("agrees with the site's own pricer and an independent Sharpe on the featured numbers", () => {
    const bs = getProblem("black-scholes-call")!;
    const c3 = bs.cases.find((c) => c.id === "3")!;
    expect(c3.expected).toBe("10.4506");
    // lib/pricing.ts uses the Abramowitz–Stegun CDF (≈1e-7 accurate), the
    // generator used the exact CDF — they must agree to well under a cent.
    expect(Math.abs(priceOption(100, 100, 1, 0.05, 0.2, "C").price - 10.4506)).toBeLessThan(0.002);

    // Sample standard deviation on both sides — the problem statement and
    // lib/quant/series.ts agree — so an independent recomputation and the
    // site's own sharpe() must both land on the generated number.
    const sr = getProblem("sharpe-ratio")!;
    const c1 = sr.cases.find((c) => c.id === "1")!;
    const rets = [0.01, -0.005, 0.012, 0.003, -0.002, 0.008];
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
    expect(Math.abs((mean / sd) * Math.sqrt(252) - Number(c1.expected))).toBeLessThan(0.001);
    expect(Math.abs(sharpe(rets) - Number(c1.expected))).toBeLessThan(0.001);
  });
});

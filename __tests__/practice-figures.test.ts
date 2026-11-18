import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { allProblems } from "@/lib/practice/content";
import { FIGURE_SLUGS, parseArgs, problemFigure } from "@/components/practice/figures";

// Plan A5, Stage 5's gate: every practice problem has a figure, drawn from its
// own first example, with a text alternative; none stretches; none reads a
// hidden case. A problem added without a figure fails here.

describe("a figure for every practice problem", () => {
  const problems = allProblems();

  it("covers every problem, and only real ones", () => {
    const ids = problems.map((p) => p.id).sort();
    expect([...FIGURE_SLUGS].sort()).toEqual(ids);
  });

  it("parses the examples' keyword arguments as the judge takes them", () => {
    expect(parseArgs('S=100.0, kind="call", x=[1.0, -2.0], events=[["put", 150.0]], tol=1e-10')).toEqual({
      S: 100,
      kind: "call",
      x: [1, -2],
      events: [["put", 150]],
      tol: 1e-10,
    });
  });

  for (const p of problems) {
    it(`${p.id}: draws its first example, labelled, never stretched`, () => {
      const node = problemFigure(p);
      expect(node, "no figure (or its builder threw)").not.toBeNull();
      const html = renderToStaticMarkup(node as React.ReactElement);
      expect(html).toContain('role="img"');
      expect(html).toMatch(/<title[^>]*>[^<]{6,}<\/title>/);
      expect(html).toMatch(/<desc[^>]*>[^<]{20,}<\/desc>/);
      expect(html).not.toContain('preserveAspectRatio="none"');
      expect(html).not.toMatch(/NaN|Infinity/);
      // nothing from a hidden case reaches the page
      for (const c of p.cases.filter((c) => c.hidden)) {
        if (c.expected.length > 6) expect(html).not.toContain(c.expected);
      }
    });
  }
});

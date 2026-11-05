import { describe, expect, it } from "vitest";
import { TOKEN_CLASS, tokenize } from "@/lib/practice/tokenize";
import type { Lang } from "@/lib/practice/types";

const SNIPPETS: [Lang, string][] = [
  ["python", "from math import log, sqrt\n\ndef f(x: float) -> float:\n    # a comment with 'quotes'\n    s = \"str with \\\" escape\"\n    return round(x * 1.5e-3, 4)\n"],
  ["python", "t = '''triple\nquoted'''\nvalue = .5 + 10_000\n"],
  ["python", "unterminated = 'oops\nnext_line = 1\n"],
  ["typescript", "export function f(x: number): number {\n  // comment\n  const s = `tmpl ${x}`;\n  /* block\n  comment */\n  return Math.round(x * 1e4) / 1e4;\n}\n"],
  ["typescript", "const a = \"a\"; let b = 'b'; const n = 3.25;\n"],
  ["typescript", ""],
];

describe("tokenize", () => {
  it("round-trips every snippet exactly", () => {
    for (const [lang, code] of SNIPPETS) {
      expect(tokenize(code, lang).map((t) => t.text).join("")).toBe(code);
    }
  });
  it("classifies keywords, strings, numbers, comments and calls", () => {
    const toks = tokenize(SNIPPETS[0][1], "python");
    const kinds = new Map(toks.map((t) => [t.text, t.kind]));
    expect(kinds.get("def")).toBe("kw");
    expect(kinds.get("return")).toBe("kw");
    expect(kinds.get("f")).toBe("fn");
    expect(kinds.get("round")).toBe("fn");
    expect(kinds.get("# a comment with 'quotes'")).toBe("cmt");
    expect(kinds.get('"str with \\" escape"')).toBe("str");
    expect(kinds.get("1.5e-3")).toBe("num");
    expect(kinds.get("4")).toBe("num");
  });
  it("handles triple quotes and underscore numerals", () => {
    const toks = tokenize(SNIPPETS[1][1], "python");
    expect(toks.find((t) => t.kind === "str")?.text).toBe("'''triple\nquoted'''");
    expect(toks.filter((t) => t.kind === "num").map((t) => t.text)).toEqual([".5", "10_000"]);
  });
  it("ends an unterminated string at the line break", () => {
    const toks = tokenize(SNIPPETS[2][1], "python");
    expect(toks.find((t) => t.kind === "str")?.text).toBe("'oops");
  });
  it("knows typescript comments, template literals and keywords", () => {
    const toks = tokenize(SNIPPETS[3][1], "typescript");
    const kinds = new Map(toks.map((t) => [t.text, t.kind]));
    expect(kinds.get("export")).toBe("kw");
    expect(kinds.get("const")).toBe("kw");
    expect(kinds.get("// comment")).toBe("cmt");
    expect(kinds.get("/* block\n  comment */")).toBe("cmt");
    expect(kinds.get("`tmpl ${x}`")).toBe("str");
    expect(kinds.get("1e4")).toBe("num");
  });
  it("has a class for every token kind", () => {
    expect(Object.keys(TOKEN_CLASS).sort()).toEqual(["cmt", "fn", "kw", "num", "plain", "str"]);
  });
});

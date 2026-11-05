// The comparison rule and the verdict — pure, no I/O, no browser or node
// globals, so the server route (app/api/practice/[slug]/submit), the
// device-side fallback in components/practice/RunConsole.tsx and the tests all
// judge with ONE function.
//
// What is compared: the string the worker printed for a case (see `fmt` in
// scripts/practice/gen/common.py, copied verbatim into
// public/practice/pyodide-worker.js) against the `expected` string the
// generator printed with the same `fmt` for the reference implementation.
//
// The rule, as the UI states it: exact match first; failing that, two numbers
// agree when |got − expected| ≤ 1e-6 · max(1, |expected|), and two lists agree
// element-wise under the same rule. Everything else — booleans, None, strings,
// an exception's class name — must match exactly. The tolerance exists because
// the solver's browser runs a different libm than the machine the generator
// ran on, and a Monte Carlo path 1e-16 apart can print a different sixth
// decimal; it is far below anything a wrong formula produces.

import type { CaseOutput, CaseResult, RunMode, TestCase, Verdict } from "./types";

/* ── code normalisation ──────────────────────────────────────────────────── */

/** CRLF → LF, trailing whitespace stripped, blank lines dropped — so adding a
    space or an empty line can never count as an edit, and two submissions of
    the same program hash the same. */
export function normalise(code: string): string {
  return code
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
}

/** Whitespace-only edits do not count as edits. */
export function isEdited(code: string, stub: string): boolean {
  return normalise(code) !== normalise(stub);
}

/** The first top-level `def name(` in a Python source, or null. An authoring
    aid (the generator's `fn` is what the judge calls — four problems keep the
    entry behind a private helper, so this is NOT how `entry` is derived). */
export function firstTopLevelDef(src: string): string | null {
  const m = /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/m.exec(src);
  return m ? m[1] : null;
}

/* ── the comparison ──────────────────────────────────────────────────────── */

export const REL_TOLERANCE = 1e-6;

type Value = { kind: "num"; n: number } | { kind: "list"; items: Value[] } | { kind: "str"; s: string };

const NUM = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

/** Splits "a, [b, c], d" at top-level commas. */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "[" || ch === "{" || ch === "(") depth++;
    else if (ch === "]" || ch === "}" || ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

function parseValue(raw: string): Value {
  const s = raw.trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    const inner = s.slice(1, -1).trim();
    if (inner === "") return { kind: "list", items: [] };
    return { kind: "list", items: splitTopLevel(inner).map(parseValue) };
  }
  if (NUM.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return { kind: "num", n };
  }
  return { kind: "str", s };
}

function valuesMatch(a: Value, b: Value): boolean {
  if (a.kind === "num" && b.kind === "num") return Math.abs(a.n - b.n) <= REL_TOLERANCE * Math.max(1, Math.abs(b.n));
  if (a.kind === "list" && b.kind === "list") {
    if (a.items.length !== b.items.length) return false;
    return a.items.every((x, i) => valuesMatch(x, b.items[i]));
  }
  return a.kind === "str" && b.kind === "str" && a.s === b.s;
}

/** True when `got` counts as `expected` under the rule above. */
export function outputsMatch(got: string, expected: string): boolean {
  if (got === expected) return true;
  return valuesMatch(parseValue(got), parseValue(expected));
}

/* ── the verdict ─────────────────────────────────────────────────────────── */

export type Judgement = {
  verdict: Verdict;
  passed: number;
  total: number;
  runtimeMs: number;
  cases: CaseResult[];
};

/** Which of a problem's cases a mode judges. */
export function casesFor(cases: TestCase[], mode: RunMode): TestCase[] {
  return mode === "submit" ? cases : cases.filter((c) => !c.hidden);
}

/**
 * Grades a set of outputs against the cases a mode judges. A case with no
 * output (the worker never reached it) fails with an empty `got`. `expected`
 * is only echoed for visible cases — this runs on the server with the hidden
 * expectations in hand, and the report goes back to the browser.
 */
export function judgeOutputs(cases: TestCase[], outputs: CaseOutput[], mode: RunMode): Judgement {
  const byId = new Map(outputs.map((o) => [o.id, o]));
  const judged = casesFor(cases, mode);
  const results: CaseResult[] = judged.map((c) => {
    const o = byId.get(c.id);
    const got = o?.got ?? "";
    const pass = o !== undefined && !o.error && outputsMatch(got, c.expected);
    const r: CaseResult = { id: c.id, pass, hidden: Boolean(c.hidden), got, ms: round1(o?.ms ?? 0) };
    if (!c.hidden) r.expected = c.expected;
    if (o?.error) r.error = o.error;
    return r;
  });
  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  return {
    verdict: total > 0 && passed === total ? "accepted" : "wrong-answer",
    passed,
    total,
    runtimeMs: round1(results.reduce((n, r) => n + r.ms, 0)),
    cases: results,
  };
}

function round1(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
}

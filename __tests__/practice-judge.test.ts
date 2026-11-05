// The judge's pure core: the comparison rule, the verdict, the entry names,
// and the one invariant that makes browser output comparable with generated
// expectations — the worker's `fmt` / `parse_input` are the generator's,
// byte for byte.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { casesFor, firstTopLevelDef, isEdited, judgeOutputs, normalise, outputsMatch, REL_TOLERANCE } from "@/lib/practice/judge";
import { PYODIDE_VERSION, PYODIDE_URL, WORKER_URL } from "@/lib/practice/runner";
import { DEVICE_HEADER, MAX_CODE_CHARS, type TestCase } from "@/lib/practice/types";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf-8");

/** From `def fmt(` to the end-of-block marker, trailing whitespace dropped. */
function verbatimBlock(src: string): string {
  const start = src.indexOf("def fmt(");
  const end = src.indexOf("# ── end of the verbatim block");
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return src
    .slice(start, end)
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .trim();
}

describe("the worker reproduces the generator", () => {
  it("carries fmt and parse_input verbatim from scripts/practice/gen/common.py", () => {
    const py = verbatimBlock(read("scripts/practice/gen/common.py"));
    const js = verbatimBlock(read("public/practice/pyodide-worker.js"));
    expect(js).toBe(py);
    expect(py).toContain("def parse_input(");
    expect(py).toContain("ast.literal_eval");
  });
  it("pins one Pyodide version on both sides and loads it from the allowed CDN", () => {
    const worker = read("public/practice/pyodide-worker.js");
    expect(worker).toContain(`const PYODIDE_VERSION = "${PYODIDE_VERSION}";`);
    expect(PYODIDE_VERSION).toBe("0.28.3");
    expect(PYODIDE_URL).toBe("https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.js");
    expect(worker).toContain("https://cdn.jsdelivr.net/pyodide/v");
    expect(WORKER_URL).toBe("/practice/pyodide-worker.js");
    // The runtime's stdout is capped so a print() in a loop cannot flood the page.
    expect(worker).toContain("const STDOUT_CAP = 10000;");
  });
  it("shares the device header and the code cap between client and server", () => {
    expect(DEVICE_HEADER).toBe("x-lb-device");
    expect(read("lib/practice/http.ts")).toContain('import { DEVICE_HEADER } from "@/lib/practice/types"');
    expect(read("lib/practice/client.ts")).toContain('import { DEVICE_HEADER } from "./types"');
    expect(MAX_CODE_CHARS).toBe(20_000);
    expect(read("lib/db/practice.ts")).toContain('import { MAX_CODE_CHARS } from "../practice/types"');
  });
});

describe("normalise / isEdited / firstTopLevelDef", () => {
  const STUB = "def f(x):\n    # TODO: the gap\n    return x\n";
  it("ignores trailing whitespace, CRLF and blank runs", () => {
    const messy = "def f(x):   \r\n\r\n\r\n    # TODO: the gap\r\n    return x   \r\n\r\n";
    expect(normalise(messy)).toBe(normalise(STUB));
    expect(isEdited(messy, STUB)).toBe(false);
    expect(isEdited(STUB + "   \n", STUB)).toBe(false);
  });
  it("counts a real character as an edit", () => {
    expect(isEdited(STUB.replace("return x", "return x * 1"), STUB)).toBe(true);
  });
  it("finds the first top-level def and ignores nested ones", () => {
    expect(firstTopLevelDef(STUB)).toBe("f");
    expect(firstTopLevelDef("from math import exp\n\nN = 1\n\ndef price(S, K):\n    def inner():\n        pass\n    return S\n")).toBe("price");
    expect(firstTopLevelDef("class A:\n    def method(self):\n        pass\n")).toBeNull();
    expect(firstTopLevelDef("x = 1\n")).toBeNull();
  });
});

describe("outputsMatch — exact, then 1e-6 relative", () => {
  it("accepts an exact string", () => {
    expect(outputsMatch("7.9656", "7.9656")).toBe(true);
    expect(outputsMatch("True", "True")).toBe(true);
    expect(outputsMatch("None", "None")).toBe(true);
    expect(outputsMatch("nan", "nan")).toBe(true);
  });
  it("accepts numbers within |a − b| ≤ 1e-6 · max(1, |b|) and nothing looser", () => {
    expect(REL_TOLERANCE).toBe(1e-6);
    expect(outputsMatch("7.9656000001", "7.9656")).toBe(true);
    expect(outputsMatch("7.9657", "7.9656")).toBe(false);
    expect(outputsMatch("1000000.5", "1000000")).toBe(true);
    expect(outputsMatch("10.00002", "10")).toBe(false);
    expect(outputsMatch("0.0000005", "0")).toBe(true);
    expect(outputsMatch("0.000002", "0")).toBe(false);
    expect(outputsMatch(".1", "0.1")).toBe(true);
    expect(outputsMatch("-2", "-2.0000001")).toBe(true);
  });
  it("compares lists element-wise, nested, and never across lengths", () => {
    expect(outputsMatch("[1, 2.0000001, 3]", "[1, 2, 3]")).toBe(true);
    expect(outputsMatch("[1, 2, 3]", "[1, 2]")).toBe(false);
    expect(outputsMatch("[[1, 2], [3, 4.0000004]]", "[[1, 2], [3, 4]]")).toBe(true);
    expect(outputsMatch("[[1, 2], [3, 4.1]]", "[[1, 2], [3, 4]]")).toBe(false);
    expect(outputsMatch("[]", "[]")).toBe(true);
  });
  it("keeps everything else exact — booleans, strings, exception names", () => {
    expect(outputsMatch("True", "False")).toBe(false);
    expect(outputsMatch("ValueError", "0")).toBe(false);
    expect(outputsMatch("1", "True")).toBe(false);
    expect(outputsMatch("[1, 2]", "1")).toBe(false);
    expect(outputsMatch("", "0")).toBe(false);
  });
});

describe("judgeOutputs — the verdict", () => {
  const cases: TestCase[] = [
    { id: "1", input: "x=1", expected: "1" },
    { id: "2", input: "x=2", expected: "2" },
    { id: "3", input: "x=3", expected: "3" },
    { id: "h1", input: "x=4", expected: "4", hidden: true },
    { id: "h2", input: "x=5", expected: "5", hidden: true },
  ];
  const out = (id: string, got: string, ms = 1) => ({ id, got, ms });

  it("judges only the visible cases on a run and echoes their expectations", () => {
    expect(casesFor(cases, "run").map((c) => c.id)).toEqual(["1", "2", "3"]);
    const j = judgeOutputs(cases, [out("1", "1"), out("2", "2"), out("3", "3.0000001"), out("h1", "4"), out("h2", "5")], "run");
    expect(j.verdict).toBe("accepted");
    expect(j.total).toBe(3);
    expect(j.passed).toBe(3);
    expect(j.cases.every((c) => c.expected !== undefined && !c.hidden)).toBe(true);
    expect(j.runtimeMs).toBe(3);
  });
  it("judges everything on a submit and never echoes a hidden expectation", () => {
    const j = judgeOutputs(cases, [out("1", "1"), out("2", "2"), out("3", "3"), out("h1", "4"), out("h2", "-5")], "submit");
    expect(j.verdict).toBe("wrong-answer");
    expect(j.total).toBe(5);
    expect(j.passed).toBe(4);
    const h2 = j.cases.find((c) => c.id === "h2")!;
    expect(h2.pass).toBe(false);
    expect(h2.hidden).toBe(true);
    expect(h2.expected).toBeUndefined();
    expect(h2.got).toBe("-5");
    expect(j.cases.find((c) => c.id === "1")!.expected).toBe("1");
  });
  it("fails a case the worker never reached, and one that raised even if the text matches", () => {
    const j = judgeOutputs(cases, [out("1", "1"), { id: "2", got: "2", ms: 1, error: "ZeroDivisionError: division by zero" }], "run");
    expect(j.verdict).toBe("wrong-answer");
    expect(j.passed).toBe(1);
    expect(j.cases.find((c) => c.id === "2")!.pass).toBe(false);
    expect(j.cases.find((c) => c.id === "2")!.error).toContain("ZeroDivisionError");
    expect(j.cases.find((c) => c.id === "3")!.got).toBe("");
    expect(j.cases.find((c) => c.id === "3")!.pass).toBe(false);
  });
  it("rounds runtimes to a tenth and sums them", () => {
    const j = judgeOutputs(cases, [out("1", "1", 0.44), out("2", "2", 0.26), out("3", "3", 12.345)], "run");
    expect(j.cases.map((c) => c.ms)).toEqual([0.4, 0.3, 12.3]);
    expect(j.runtimeMs).toBe(13);
  });
  it("is never accepted with nothing judged", () => {
    expect(judgeOutputs([], [], "run").verdict).toBe("wrong-answer");
  });
});

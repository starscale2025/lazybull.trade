"""Shared harness for the /practice content generator.

Every problem is a spec: prose, a REFERENCE implementation (correct), a STUB
(the partial implementation the solver starts from, with one `# TODO` gap),
the name of the ENTRY function the judge calls, and nine testcases. The
generator runs the reference and the stub on every case, so `expected` and
`got` in the emitted TypeScript are computed, never typed by hand — and it
refuses to emit a problem whose stub does not fail exactly visible case "3"
and hidden case "h2", so the starting point is guaranteed to be wrong in the
way the hints describe.

THE BROWSER MUST REPRODUCE THIS FILE. The judge in public/practice/pyodide-worker.js
runs the solver's own Python in Pyodide and calls `entry(**kwargs)` with the
kwargs parsed from the case's `input` string by `parse_input` below, then
prints the return value with `fmt` below. Both helpers are copied VERBATIM
into the worker's harness (a vitest, __tests__/practice-judge.test.ts, diffs
the two copies), and `build` checks that calling the reference through the
parsed `input` gives the same string as calling it with the original values —
so what the browser computes is what this generator computed.
"""

from __future__ import annotations

import ast
import json
import math
import traceback
from dataclasses import dataclass, field
from typing import Any


def rep(v: Any) -> str:
    """Compact Python-ish repr for an input value in the UI. Every value it
    prints must parse back (see parse_input) to the value it was given."""
    if isinstance(v, bool):
        return "True" if v else "False"
    if isinstance(v, float):
        if v == int(v) and abs(v) < 1e15:
            return f"{v:.1f}"
        return f"{v:.10g}"
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(rep(x) for x in v) + "]"
    if isinstance(v, str):
        return json.dumps(v)
    return str(v)


# ── copied verbatim into public/practice/pyodide-worker.js ────────────────────
def fmt(v: Any) -> str:
    """How a returned value prints in the console. Floats to ≤6 dp unless
    already rounded further by the function (we print what round() gave)."""
    if isinstance(v, bool):
        return "True" if v else "False"
    if v is None:
        return "None"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        if math.isnan(v):
            return "nan"
        if math.isinf(v):
            return "inf" if v > 0 else "-inf"
        s = f"{v:.6f}".rstrip("0").rstrip(".")
        if s in ("", "-0"):
            return "0"
        return s
    if isinstance(v, (list, tuple)):
        return "[" + ", ".join(fmt(x) for x in v) + "]"
    if isinstance(v, dict):
        return "{" + ", ".join(f"{k}: {fmt(x)}" for k, x in v.items()) + "}"
    return str(v)


def parse_input(s: str) -> dict[str, Any]:
    """'S=100.0, K=[1, 2]' → {"S": 100.0, "K": [1, 2]}. Literals only —
    ast.literal_eval never runs code, so a case input can carry nothing but
    numbers, strings, lists, tuples, dicts, booleans and None."""
    tree = ast.parse(f"f({s})", mode="eval")
    call = tree.body
    if not isinstance(call, ast.Call) or call.args:
        raise ValueError("case input must be keyword arguments only")
    return {kw.arg: ast.literal_eval(kw.value) for kw in call.keywords if kw.arg}
# ── end of the verbatim block ─────────────────────────────────────────────────


@dataclass
class Case:
    id: str
    args: dict[str, Any]
    hidden: bool = False

    @property
    def input(self) -> str:
        return ", ".join(f"{k}={rep(v)}" for k, v in self.args.items())


def case(id: str, **args: Any) -> Case:
    return Case(id=id, args=args, hidden=id.startswith("h"))


@dataclass
class Spec:
    slug: str
    """The entry function: what the judge calls on every case."""
    fn: str
    statement: list[str]
    constraints: list[str]
    hints: list[str]
    ref: str
    stub_py: str
    cases: list[Case]
    examples: list[str] = field(default_factory=lambda: ["1"])
    example_notes: dict[str, str] = field(default_factory=dict)
    stub_ts: str | None = None
    """Authoring note only — which tape the problem was cut from. Not emitted:
    the judge loads nothing, so the console must not say it does."""
    dataset: str | None = None
    editorial: list[str] | None = None


def _load(src: str, fn: str):
    ns: dict[str, Any] = {}
    exec(compile(src, "<spec>", "exec"), ns)
    if fn not in ns:
        raise RuntimeError(f"function {fn!r} not defined in source")
    return ns[fn]


def _run(f, args: dict[str, Any]) -> str:
    try:
        return fmt(f(**args))
    except Exception as e:  # noqa: BLE001 — the stub is allowed to crash; that is the "got"
        return type(e).__name__


def build(spec: Spec) -> dict[str, Any]:
    ref = _load(spec.ref, spec.fn)
    stub = _load(spec.stub_py, spec.fn)
    ids = [c.id for c in spec.cases]
    if ids[:3] != ["1", "2", "3"] or ids[3:] != ["h1", "h2", "h3", "h4", "h5", "h6"]:
        raise RuntimeError(f"{spec.slug}: cases must be 1,2,3,h1..h6, got {ids}")

    cases_out = []
    failing: dict[str, str] = {}
    for c in spec.cases:
        expected = _run(ref, c.args)
        got = _run(stub, c.args)
        if expected in ("ZeroDivisionError", "IndexError", "ValueError", "TypeError", "KeyError"):
            raise RuntimeError(f"{spec.slug} case {c.id}: reference raised {expected}")
        # The browser only ever sees the `input` string. Calling the reference
        # through the parsed string must land on the same output, or the judge
        # would grade against a number no solver can reproduce.
        parsed = parse_input(c.input)
        if parsed != c.args or _run(ref, parsed) != expected:
            raise RuntimeError(f"{spec.slug} case {c.id}: input string does not round-trip: {c.input!r}")
        entry: dict[str, Any] = {"id": c.id, "input": c.input, "expected": expected}
        if c.hidden:
            entry["hidden"] = True
        cases_out.append(entry)
        if got != expected:
            failing[c.id] = got

    visible_fail = sorted(k for k in failing if not k.startswith("h"))
    hidden_fail = sorted(k for k in failing if k.startswith("h"))
    if visible_fail != ["3"]:
        raise RuntimeError(f"{spec.slug}: stub fails visible {visible_fail}, need exactly ['3'] — {failing}")
    if "h2" not in hidden_fail:
        raise RuntimeError(f"{spec.slug}: stub must fail h2 — failing={failing}")
    extra = [k for k in hidden_fail if k != "h2"]
    if extra:
        print(f"  note: {spec.slug} stub also fails hidden {extra}")

    by_id = {c["id"]: c for c in cases_out}
    examples = []
    for eid in spec.examples:
        c = by_id[eid]
        ex: dict[str, Any] = {"input": c["input"], "output": c["expected"]}
        if eid in spec.example_notes:
            ex["note"] = spec.example_notes[eid]
        examples.append(ex)

    content: dict[str, Any] = {
        "entry": spec.fn,
        "statement": spec.statement,
        "examples": examples,
        "constraints": spec.constraints,
        "hints": spec.hints,
        "stubs": {"python": spec.stub_py.strip("\n") + "\n"},
        "cases": cases_out,
        "failing": {"caseId": "3", "got": failing["3"]},
        "failingHidden": {"caseId": "h2", "got": failing["h2"]},
    }
    if spec.stub_ts:
        content["stubs"]["typescript"] = spec.stub_ts.strip("\n") + "\n"
    if spec.editorial:
        content["editorial"] = spec.editorial
    return content


def emit(track: str, export_name: str, specs: list[Spec], out_path: str) -> None:
    body = {}
    for s in specs:
        print(f"· {s.slug}")
        body[s.slug] = build(s)
    js = json.dumps(body, indent=2, ensure_ascii=False)
    header = (
        "// GENERATED by scripts/practice/gen-content.py — do not edit by hand.\n"
        f"// {track} track: statements, partial stubs, entry names and testcases.\n"
        "// Every `expected` and `got` below was computed by running a reference\n"
        "// implementation and the exact stub text on the case inputs (see\n"
        "// scripts/practice/gen/). The judge — public/practice/pyodide-worker.js in\n"
        "// the browser, app/api/practice/[slug]/submit on the server — calls `entry`\n"
        "// with each case's `input` and compares what comes back with `expected`.\n\n"
        'import type { ProblemContent } from "../types";\n\n'
        f"export const {export_name}: Record<string, ProblemContent> = "
    )
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(header + js + ";\n")
    print(f"wrote {out_path} ({len(specs)} problems)")


def safe_traceback() -> str:
    return traceback.format_exc()

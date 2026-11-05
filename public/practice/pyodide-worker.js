/* The /practice judge's worker: real CPython, in the browser, off the main
 * thread. Loaded by lib/practice/runner.ts the first time a solver presses
 * ▶ run or submit — never before — as a classic same-origin worker, so the
 * document's CSP (proxy.ts: worker-src 'self') admits it and this file can
 * importScripts() the pinned Pyodide build from jsDelivr. Pyodide then fetches
 * its .wasm and the stdlib zip from the same `indexURL`; the browser caches
 * all of it, so the ~15 MB download happens once per version.
 *
 * Protocol (main → worker):
 *   { type: "run", id, code, entry, cases: [{ id, input }] }
 * (worker → main):
 *   { type: "status", id, phase: "loading" | "ready" }
 *   { type: "case",   id, result: { id, got, ms, error? } }       one per case, as it lands
 *   { type: "result", id, results: [...], stdout, stderr, truncated, error?: { title, detail } }
 *
 * There is no cancel message: Python runs synchronously in here, so an
 * infinite loop can only be stopped by worker.terminate() from the main
 * thread, which the runner does on its timeout and then recreates the worker
 * (the runtime reloads from cache on the next run).
 *
 * What runs: the solver's own code, exec'd into a fresh namespace per run,
 * then `entry(**kwargs)` for every case with the kwargs parsed from the
 * case's `input` string by ast.literal_eval — literals only, so a case input
 * can never be code. The return value is printed by `fmt`, copied VERBATIM
 * from scripts/practice/gen/common.py (a vitest diffs the two), which is what
 * makes a browser output comparable with the generator's `expected` string.
 * stdout and stderr are captured and capped at STDOUT_CAP characters each.
 */

/* global importScripts, loadPyodide */

const PYODIDE_VERSION = "0.28.3";
const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v" + PYODIDE_VERSION + "/full/";
const STDOUT_CAP = 10000;

const HARNESS = `
import ast
import io
import json
import math
import sys
import time
import traceback
from typing import Any


# ── copied verbatim from scripts/practice/gen/common.py ───────────────────────
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


class _LbCapped(io.StringIO):
    """A StringIO that stops growing at cap characters and counts the rest."""

    def __init__(self, cap):
        super().__init__()
        self.cap = cap
        self.size = 0
        self.dropped = 0

    def write(self, s):
        n = len(s)
        room = self.cap - self.size
        if room <= 0:
            self.dropped += n
            return n
        if n > room:
            self.dropped += n - room
            s = s[:room]
        self.size += len(s)
        return super().write(s)


_lb = {"ns": None, "out": None, "err": None, "entry": None}


def _lb_where(e):
    """The last frame of the solver's own file, as ' (solution.py, line N)'."""
    for fr in reversed(traceback.extract_tb(e.__traceback__)):
        if fr.filename == "solution.py":
            return f" (solution.py, line {fr.lineno})"
    return ""


def _lb_detail(e):
    msg = str(e)
    return (f"{type(e).__name__}: {msg}" if msg else type(e).__name__) + _lb_where(e)


def _lb_prepare(code, entry, cap):
    """exec the solver's code into a fresh namespace. Returns "" on success or
    a JSON {title, detail} describing why nothing can be judged."""
    out, err = _LbCapped(cap), _LbCapped(cap)
    _lb.update(ns=None, out=out, err=err, entry=entry)
    ns = {"__name__": "__main__"}
    saved = (sys.stdout, sys.stderr)
    sys.stdout, sys.stderr = out, err
    try:
        exec(compile(code, "solution.py", "exec"), ns)
    except SyntaxError as e:
        return json.dumps({"title": "SyntaxError", "detail": f"{e.msg} (solution.py, line {e.lineno})"})
    except BaseException as e:  # SystemExit and KeyboardInterrupt included
        return json.dumps({"title": type(e).__name__, "detail": _lb_detail(e)})
    finally:
        sys.stdout, sys.stderr = saved
    if not callable(ns.get(entry)):
        return json.dumps({
            "title": "NameError",
            "detail": f"solution.py defines no function named {entry!r} — the judge calls {entry}(...) on every case",
        })
    _lb["ns"] = ns
    return ""


def _lb_case(case_id, inp):
    """Run one case. An exception is the case's 'got' (its class name, as the
    generator records it) plus a detail line; the case simply fails."""
    fn = _lb["ns"][_lb["entry"]]
    saved = (sys.stdout, sys.stderr)
    sys.stdout, sys.stderr = _lb["out"], _lb["err"]
    t0 = time.perf_counter()
    try:
        kwargs = parse_input(inp)
        r = {"id": case_id, "got": fmt(fn(**kwargs))}
    except BaseException as e:
        r = {"id": case_id, "got": type(e).__name__, "error": _lb_detail(e)}
    finally:
        sys.stdout, sys.stderr = saved
    r["ms"] = round((time.perf_counter() - t0) * 1000, 2)
    return json.dumps(r)


def _lb_drain():
    out, err = _lb["out"], _lb["err"]
    return json.dumps({
        "stdout": out.getvalue(),
        "stderr": err.getvalue(),
        "truncated": (out.dropped + err.dropped) > 0,
    })
`;

let bootPromise = null;

function boot() {
  if (!bootPromise) {
    bootPromise = (async () => {
      importScripts(INDEX_URL + "pyodide.js");
      const py = await loadPyodide({ indexURL: INDEX_URL });
      py.runPython(HARNESS);
      return py;
    })();
    // A failed download must not poison the worker for good: drop the memo so
    // the next run dials again.
    bootPromise.catch(() => {
      bootPromise = null;
    });
  }
  return bootPromise;
}

function post(msg) {
  self.postMessage(msg);
}

/** Calls a harness function by name and returns its (string) result, freeing
    the proxy — every call leaks a PyProxy otherwise. */
function call(py, name, ...args) {
  const fn = py.globals.get(name);
  try {
    return fn(...args);
  } finally {
    fn.destroy();
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  if (!msg || typeof msg !== "object" || msg.type !== "run") return;
  const { id, code, entry, cases } = msg;

  let py;
  try {
    post({ type: "status", id, phase: "loading" });
    py = await boot();
    post({ type: "status", id, phase: "ready" });
  } catch (err) {
    post({
      type: "result",
      id,
      results: [],
      stdout: "",
      stderr: "",
      truncated: false,
      error: {
        title: "RuntimeUnavailable",
        detail: "could not load the Python runtime — " + String((err && err.message) || err),
      },
    });
    return;
  }

  const failed = call(py, "_lb_prepare", String(code), String(entry), STDOUT_CAP);
  if (failed) {
    const drained = JSON.parse(call(py, "_lb_drain"));
    post({ type: "result", id, results: [], ...drained, error: JSON.parse(failed) });
    return;
  }

  const results = [];
  for (const c of Array.isArray(cases) ? cases : []) {
    const result = JSON.parse(call(py, "_lb_case", String(c.id), String(c.input)));
    results.push(result);
    post({ type: "case", id, result });
  }
  const drained = JSON.parse(call(py, "_lb_drain"));
  post({ type: "result", id, results, ...drained });
};

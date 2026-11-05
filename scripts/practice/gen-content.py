#!/usr/bin/env python3
"""Generate lib/practice/content/*.ts from the specs in scripts/practice/gen/.

    python3 scripts/practice/gen-content.py            # all five tracks
    python3 scripts/practice/gen-content.py finance    # one track

For every problem the generator runs a REFERENCE implementation and the
exact STUB text the solver starts from on all nine testcases, writes the
computed `expected` / `got` strings and the ENTRY function name into the
TypeScript, and refuses to emit a problem whose stub does not fail exactly
visible case "3" and hidden case "h2" — so the starting point is wrong in
precisely the way the hints describe.

At runtime the browser judge (public/practice/pyodide-worker.js) runs the
solver's Python in Pyodide, calls `entry` with each case's parsed `input`
and formats the result with the same `fmt` as gen/common.py; the server
(app/api/practice/[slug]/submit) compares those strings with `expected`.
This script is where the expected numbers come from — edit the specs, rerun
it, commit the output.
"""

from __future__ import annotations

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "gen"))

from common import emit  # noqa: E402
from finance import FINANCE  # noqa: E402
from maths import MATHS  # noqa: E402
from ml import ML  # noqa: E402
from quant import QUANT  # noqa: E402
from trading import TRADING  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "lib", "practice", "content")

TRACKS = [
    ("finance", "FINANCE_CONTENT", FINANCE),
    ("quant", "QUANT_CONTENT", QUANT),
    ("ml", "ML_CONTENT", ML),
    ("maths", "MATHS_CONTENT", MATHS),
    ("trading", "TRADING_CONTENT", TRADING),
]


def main() -> int:
    only = set(sys.argv[1:])
    failures = 0
    for track, export_name, specs in TRACKS:
        if only and track not in only:
            continue
        print(f"== {track}")
        try:
            emit(track, export_name, specs, os.path.join(OUT, f"{track}.ts"))
        except Exception as e:  # noqa: BLE001
            failures += 1
            print(f"!! {track}: {e}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

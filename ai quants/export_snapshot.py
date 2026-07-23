#!/usr/bin/env python3
"""Bake the trained models' outputs into a static snapshot the site ships.

This is the zero-hosting path to real Python-NN predictions: instead of the
browser calling a live FastAPI (which needs a paid/hosted server), the site
reads public/quant-snapshot.json — real model output for the popular tickers,
labelled "Python NN · snapshot". Re-run whenever you want fresh numbers; the
local service on :8000 must be running:

    cd "ai quants" && .venv/bin/uvicorn serve:app --port 8000   # terminal 1
    python3 export_snapshot.py                                   # terminal 2
"""
import datetime
import json
import sys
import urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8000"
ENDPOINTS = ["/api/direction", "/api/magnitude", "/api/sequence",
             "/api/transformer", "/api/quantile", "/api/consensus"]
TICKERS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "AMD",
           "NFLX", "AVGO", "COIN", "PLTR", "GME", "SPY", "QQQ"]
OUT = Path(__file__).resolve().parent.parent / "public" / "quant-snapshot.json"


def call(ep: str, ticker: str):
    req = urllib.request.Request(
        BASE + ep,
        data=json.dumps({"ticker": ticker}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)


snap = {
    "generated": datetime.date.today().isoformat(),
    "tickers": {},
}
for t in TICKERS:
    entry = {}
    for ep in ENDPOINTS:
        try:
            entry[ep] = call(ep, t)
            print(f"  {t:6} {ep} ok")
        except Exception as e:  # noqa: BLE001
            print(f"  {t:6} {ep} FAILED: {e}", file=sys.stderr)
    if entry:
        snap["tickers"][t] = entry

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(json.dumps(snap, separators=(",", ":")))
print(f"\nwrote {OUT}")
print(f"  {len(snap['tickers'])} tickers · {OUT.stat().st_size // 1024} KB")

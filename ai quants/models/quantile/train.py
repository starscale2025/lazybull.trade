"""Lever 13 — Quantile regression.

Predict p10, p50, p90 of forward return. Trade rule:
  - long when p10 > 0 (90% chance return is positive)
  - short when p90 < 0 (90% chance return is negative)
  - flat otherwise

This naturally produces high-conviction subsets without ad-hoc thresholds.
"""
from __future__ import annotations
import sys, json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
import joblib

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.market_data import fetch_basket
from shared.features import make_features
from shared.macro import fetch_macro
from shared.embargo import embargo_split

WEIGHTS = ROOT / "weights"

TICKERS = [
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLU", "XLP", "XLRE",
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "JPM", "V",
    "UNH", "JNJ", "WMT", "PG", "HD", "MA", "BAC", "XOM", "CVX", "KO", "PEP",
]


def build(period="10y", horizon=20, with_macro=True):
    data = fetch_basket(TICKERS, period=period)
    macro = fetch_macro(period=period).ffill().dropna() if with_macro else None
    Xs, ys, dates = [], [], []
    for sym, df in data.items():
        if len(df) < 400:
            continue
        c = df["Close"].astype(float)
        X, _, idx = make_features(df, horizon=horizon)
        if len(X) == 0:
            continue
        if with_macro:
            ma = macro.reindex(idx).ffill().values
            keep = ~np.isnan(ma).any(axis=1)
            X = X[keep]; ma = ma[keep]; idx = idx[keep]
            X = np.concatenate([X, ma.astype(np.float32)], axis=1)
        fwd = c.pct_change(horizon).shift(-horizon).reindex(idx).values
        Xs.append(X); ys.append(fwd); dates.append(idx)
    X = np.concatenate(Xs); y = np.concatenate(ys)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in dates]))
    keep = ~np.isnan(y)
    return X[keep].astype(np.float32), y[keep].astype(np.float32), d[keep]


def main(period="10y", horizon=20):
    X, y, dates = build(period=period, horizon=horizon, with_macro=True)
    print(f"Total: {len(X):,}  features: {X.shape[1]}")

    tr, vl, cutoff = embargo_split(dates, val_frac=0.2, embargo_days=20)
    Xtr, ytr = X[tr], y[tr]
    Xv, yv = X[vl], y[vl]
    print(f"Train: {len(Xtr):,}  Val: {len(Xv):,}  cutoff={cutoff.date()}")

    quantiles = [0.1, 0.5, 0.9]
    models = {}
    preds = {}
    for q in quantiles:
        print(f"  training q={q}...")
        m = HistGradientBoostingRegressor(
            loss="quantile", quantile=q,
            max_iter=1500, learning_rate=0.02, max_leaf_nodes=31,
            min_samples_leaf=300, l2_regularization=1.0,
            early_stopping=True, validation_fraction=0.15, n_iter_no_change=80, random_state=0,
        )
        m.fit(Xtr, ytr)
        models[q] = m
        preds[q] = m.predict(Xv)

    p10, p50, p90 = preds[0.1], preds[0.5], preds[0.9]
    width = p90 - p10  # uncertainty width (wider = less confident)

    print("\n=== QUANTILE TRADE RULES ===")
    # Rule A: long when p10 > 0 (90%+ confidence positive)
    long_mask = p10 > 0
    if long_mask.sum() > 0:
        long_acc = (yv[long_mask] > 0).mean()
        long_avg = yv[long_mask].mean()
        print(f"  LONG (p10>0):  n={long_mask.sum():>5,}  hit_rate={long_acc:.4f}  avg_ret={long_avg:+.4f}")
    # Rule B: short when p90 < 0
    short_mask = p90 < 0
    if short_mask.sum() > 0:
        short_acc = (yv[short_mask] < 0).mean()
        short_avg = yv[short_mask].mean()
        print(f"  SHORT (p90<0): n={short_mask.sum():>5,}  hit_rate={short_acc:.4f}  avg_ret={short_avg:+.4f}")
    # Rule C: long when p50 > 0 AND width is in bottom 25% (high confidence)
    narrow_thr = np.quantile(width, 0.25)
    confident = width <= narrow_thr
    cl_mask = (p50 > 0) & confident
    if cl_mask.sum() > 0:
        cl_acc = (yv[cl_mask] > 0).mean()
        print(f"  CONFIDENT-LONG  (p50>0 & width<=p25):  n={cl_mask.sum():>5,}  hit_rate={cl_acc:.4f}")
    cs_mask = (p50 < 0) & confident
    if cs_mask.sum() > 0:
        cs_acc = (yv[cs_mask] < 0).mean()
        print(f"  CONFIDENT-SHORT (p50<0 & width<=p25):  n={cs_mask.sum():>5,}  hit_rate={cs_acc:.4f}")

    # All-sample dir acc using p50
    all_dir = (np.sign(p50) == np.sign(yv)).mean()
    print(f"\nAll-sample dir acc (p50): {all_dir:.4f}")
    for q_thr, label in [(0.5, "p50"), (0.75, "p75"), (0.90, "p90"), (0.95, "p95"), (0.99, "p99")]:
        thr = np.quantile(np.abs(p50), q_thr)
        m = np.abs(p50) >= thr
        if m.sum() > 0:
            print(f"  |p50|>{label}: n={m.sum():,}  dir_acc={(np.sign(p50[m])==np.sign(yv[m])).mean():.4f}")

    joblib.dump(models, WEIGHTS / "quantile_models.pkl")
    info = {"horizon": horizon, "quantiles": quantiles, "cutoff": str(cutoff.date())}
    (WEIGHTS / "quantile_models.json").write_text(json.dumps(info, indent=2))
    print("\nSaved quantile models.")


if __name__ == "__main__":
    main()

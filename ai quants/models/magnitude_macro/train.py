"""Lever 2+4 — Magnitude regression WITH macro features.

Same model as magnitude/, but each row gets 11 macro features (VIX level, yield
curve, dollar level, credit spread, gold/stocks ratio) joined by date.
"""
from __future__ import annotations
import sys, json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
import joblib

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.market_data import fetch_basket
from shared.features import make_features
from shared.macro import fetch_macro

WEIGHTS = ROOT / "weights"

TICKERS = [
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLU", "XLP", "XLRE",
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "JPM", "V",
    "UNH", "JNJ", "WMT", "PG", "HD", "MA", "BAC", "XOM", "CVX", "KO", "PEP",
]


def build_dataset(period: str = "10y", horizon: int = 20):
    print(f"[MAG+MACRO] Fetching {len(TICKERS)} tickers + macro, {period}...")
    data = fetch_basket(TICKERS, period=period)
    macro = fetch_macro(period=period).ffill().dropna()
    print(f"  macro features: {macro.shape[1]}")

    Xs, ys, dates = [], [], []
    for sym, df in data.items():
        if len(df) < 400:
            continue
        c = df["Close"].astype(float)
        X, _, idx = make_features(df, horizon=horizon)
        if len(X) == 0:
            continue
        # join macro by date
        macro_aligned = macro.reindex(idx).ffill().values
        if np.isnan(macro_aligned).any():
            keep = ~np.isnan(macro_aligned).any(axis=1)
            X = X[keep]
            macro_aligned = macro_aligned[keep]
            idx = idx[keep]
        X_full = np.concatenate([X, macro_aligned.astype(np.float32)], axis=1)
        fwd = c.pct_change(horizon).shift(-horizon).reindex(idx).values
        Xs.append(X_full); ys.append(fwd); dates.append(idx)
    X = np.concatenate(Xs); y = np.concatenate(ys)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in dates]))
    keep = ~np.isnan(y)
    return X[keep], y[keep], d[keep]


def main(period: str = "10y", horizon: int = 20):
    X, y, dates = build_dataset(period=period, horizon=horizon)
    print(f"\nTotal samples: {len(X):,}  features: {X.shape[1]}  fwd_ret std: {y.std():.4f}")

    sorted_dates = np.sort(dates.values)
    cutoff = pd.Timestamp(sorted_dates[int(0.8 * len(sorted_dates))])
    is_tr = dates < cutoff
    Xtr, ytr = X[is_tr], y[is_tr]
    Xv, yv = X[~is_tr], y[~is_tr]
    print(f"Train: {len(Xtr):,}  Val: {len(Xv):,}  cutoff={cutoff.date()}")

    configs = [
        dict(max_leaf_nodes=31, min_samples_leaf=300, learning_rate=0.02, loss="squared_error"),
        dict(max_leaf_nodes=63, min_samples_leaf=200, learning_rate=0.02, loss="squared_error"),
        dict(max_leaf_nodes=15, min_samples_leaf=500, learning_rate=0.03, loss="squared_error"),
        dict(max_leaf_nodes=31, min_samples_leaf=300, learning_rate=0.015, loss="absolute_error"),
        dict(max_leaf_nodes=63, min_samples_leaf=400, learning_rate=0.025, loss="absolute_error"),
    ]
    models = []
    for seed, cfg in enumerate(configs):
        m = HistGradientBoostingRegressor(
            max_iter=1500, l2_regularization=1.0,
            early_stopping=True, validation_fraction=0.15, n_iter_no_change=80,
            random_state=seed, **cfg,
        )
        m.fit(Xtr, ytr)
        models.append(m)
        print(f"  trained reg seed={seed}")

    pv = np.stack([m.predict(Xv) for m in models], axis=0).mean(axis=0)
    print(f"\nMAE: {mean_absolute_error(yv, pv):.4f}  (truth std: {yv.std():.4f})")
    print("\n=== DIRECTIONAL ACCURACY BY MAGNITUDE BAND (with macro) ===")
    for q, label in [(0.0, "All"), (0.50, "|pred|>p50"), (0.75, "|pred|>p75"),
                     (0.90, "|pred|>p90"), (0.95, "|pred|>p95"), (0.99, "|pred|>p99")]:
        mag = np.abs(pv)
        thr = np.quantile(mag, q)
        mask = mag >= thr
        if mask.sum() == 0:
            continue
        a = (np.sign(pv[mask]) == np.sign(yv[mask])).mean()
        avg = yv[mask].mean()
        print(f"  {label:14}  thr={thr:+.4f}  n={mask.sum():>6,}  dir_acc={a:.4f}  avg_realized={avg:+.4f}")

    joblib.dump(models, WEIGHTS / "magnitude_macro_ensemble.pkl")
    meta = {"horizon": horizon, "n_features": int(X.shape[1]), "cutoff": str(cutoff.date()),
            "metrics": {"mae": float(mean_absolute_error(yv, pv))}}
    (WEIGHTS / "magnitude_macro_ensemble.json").write_text(json.dumps(meta, indent=2))
    print("\nSaved magnitude+macro ensemble.")


if __name__ == "__main__":
    main()

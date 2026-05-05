"""Honest re-evaluation of all direction models with embargo CV."""
import sys, json
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
import torch

ROOT = Path(__file__).resolve().parents[1]
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


def build(period="10y", horizon=20, with_macro=False):
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
            X, ma, idx = X[keep], ma[keep], idx[keep]
            X = np.concatenate([X, ma.astype(np.float32)], axis=1)
        fwd = c.pct_change(horizon).shift(-horizon).reindex(idx).values
        Xs.append(X); ys.append(fwd); dates.append(idx)
    X = np.concatenate(Xs); y = np.concatenate(ys)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in dates]))
    keep = ~np.isnan(y)
    return X[keep], y[keep], d[keep]


def eval_model_with_predictions(name, pv, yv, header=False):
    if header:
        print(f"\n{'model':<32} {'all':>8} {'p50':>8} {'p75':>8} {'p90':>8} {'p95':>8} {'p99':>8}")
    out = {"model": name}
    out["all"] = (np.sign(pv) == np.sign(yv)).mean()
    for q, label in [(0.50, "p50"), (0.75, "p75"), (0.90, "p90"), (0.95, "p95"), (0.99, "p99")]:
        thr = np.quantile(np.abs(pv), q)
        m = np.abs(pv) >= thr
        out[label] = (np.sign(pv[m]) == np.sign(yv[m])).mean() if m.sum() > 0 else float("nan")
    print(f"{name:<32} {out['all']:>8.4f} {out['p50']:>8.4f} {out['p75']:>8.4f} "
          f"{out['p90']:>8.4f} {out['p95']:>8.4f} {out['p99']:>8.4f}")
    return out


def retrain_and_eval():
    """Retrain all models with embargo split, report honest accuracy."""
    from sklearn.ensemble import HistGradientBoostingRegressor

    # build no-macro
    X, y, dates = build(with_macro=False)
    tr, vl, cutoff = embargo_split(dates, val_frac=0.2, embargo_days=20)
    Xtr, ytr, Xv, yv = X[tr], y[tr], X[vl], y[vl]
    print(f"=== EMBARGO CV (20 days purged) ===")
    print(f"NO macro:   X={X.shape}  train={tr.sum():,}  val={vl.sum():,}  "
          f"purged={(~tr & ~vl).sum():,}  cutoff={cutoff.date()}")

    # build macro
    Xm, ym, dm = build(with_macro=True)
    trm, vlm, _ = embargo_split(dm, val_frac=0.2, embargo_days=20)
    Xtrm, ytrm, Xvm, yvm = Xm[trm], ym[trm], Xm[vlm], ym[vlm]
    print(f"WITH macro: X={Xm.shape}  train={trm.sum():,}  val={vlm.sum():,}  purged={(~trm & ~vlm).sum():,}")

    print(f"\n{'model':<32} {'all':>8} {'p50':>8} {'p75':>8} {'p90':>8} {'p95':>8} {'p99':>8}")
    print("-" * 80)

    # magnitude (no macro)
    configs = [
        dict(max_leaf_nodes=31, min_samples_leaf=300, learning_rate=0.02, loss="squared_error"),
        dict(max_leaf_nodes=63, min_samples_leaf=200, learning_rate=0.02, loss="squared_error"),
        dict(max_leaf_nodes=15, min_samples_leaf=500, learning_rate=0.03, loss="squared_error"),
        dict(max_leaf_nodes=31, min_samples_leaf=300, learning_rate=0.015, loss="absolute_error"),
        dict(max_leaf_nodes=63, min_samples_leaf=400, learning_rate=0.025, loss="absolute_error"),
    ]
    preds = []
    for seed, cfg in enumerate(configs):
        m = HistGradientBoostingRegressor(
            max_iter=1500, l2_regularization=1.0, early_stopping=True,
            validation_fraction=0.15, n_iter_no_change=80, random_state=seed, **cfg,
        )
        m.fit(Xtr, ytr)
        preds.append(m.predict(Xv))
    pv_mag = np.mean(preds, axis=0)
    out_mag = eval_model_with_predictions("magnitude (embargo)", pv_mag, yv)

    # magnitude + macro
    preds = []
    for seed, cfg in enumerate(configs):
        m = HistGradientBoostingRegressor(
            max_iter=1500, l2_regularization=1.0, early_stopping=True,
            validation_fraction=0.15, n_iter_no_change=80, random_state=seed, **cfg,
        )
        m.fit(Xtrm, ytrm)
        preds.append(m.predict(Xvm))
    pv_macro = np.mean(preds, axis=0)
    out_macro = eval_model_with_predictions("magnitude+macro (embargo)", pv_macro, yvm)

    return {"no_macro": out_mag, "with_macro": out_macro}


if __name__ == "__main__":
    retrain_and_eval()

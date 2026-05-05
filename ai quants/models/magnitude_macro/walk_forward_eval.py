"""Walk-forward CV evaluation for magnitude (no macro) vs magnitude+macro."""
from __future__ import annotations
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.market_data import fetch_basket
from shared.features import make_features
from shared.macro import fetch_macro
from shared.walk_forward import walk_forward_splits

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
            macro_aligned = macro.reindex(idx).ffill().values
            keep = ~np.isnan(macro_aligned).any(axis=1)
            X = X[keep]
            macro_aligned = macro_aligned[keep]
            idx = idx[keep]
            X = np.concatenate([X, macro_aligned.astype(np.float32)], axis=1)
        fwd = c.pct_change(horizon).shift(-horizon).reindex(idx).values
        Xs.append(X); ys.append(fwd); dates.append(idx)
    X = np.concatenate(Xs); y = np.concatenate(ys)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in dates]))
    keep = ~np.isnan(y)
    return X[keep], y[keep], d[keep]


def eval_one_fold(Xtr, ytr, Xv, yv, n_models=3):
    configs = [
        dict(max_leaf_nodes=31, min_samples_leaf=300, learning_rate=0.02),
        dict(max_leaf_nodes=63, min_samples_leaf=200, learning_rate=0.02),
        dict(max_leaf_nodes=15, min_samples_leaf=500, learning_rate=0.03),
    ]
    preds = []
    for seed, cfg in enumerate(configs[:n_models]):
        m = HistGradientBoostingRegressor(
            max_iter=800, l2_regularization=1.0, loss="squared_error",
            early_stopping=True, validation_fraction=0.15, n_iter_no_change=60,
            random_state=seed, **cfg,
        )
        m.fit(Xtr, ytr)
        preds.append(m.predict(Xv))
    pv = np.mean(preds, axis=0)
    out = {"all": (np.sign(pv) == np.sign(yv)).mean()}
    for q, label in [(0.50, "p50"), (0.75, "p75"), (0.90, "p90"), (0.95, "p95"), (0.99, "p99")]:
        thr = np.quantile(np.abs(pv), q)
        mask = np.abs(pv) >= thr
        if mask.sum() > 0:
            out[label] = (np.sign(pv[mask]) == np.sign(yv[mask])).mean()
        else:
            out[label] = float("nan")
    return out


def run(label: str, with_macro: bool):
    print(f"\n========== {label} ==========")
    X, y, dates = build(with_macro=with_macro)
    print(f"Total: {len(X):,}  features: {X.shape[1]}")
    rows = []
    for fold, tr, vl, vs, ve in walk_forward_splits(dates, n_folds=5, train_min_years=4.0):
        out = eval_one_fold(X[tr], y[tr], X[vl], y[vl])
        out["fold"] = fold
        out["val_start"] = vs.date(); out["val_end"] = ve.date()
        out["n_val"] = int(vl.sum())
        rows.append(out)
        print(f"  fold {fold} {vs.date()}..{ve.date()} (n={vl.sum():,})  "
              f"all={out['all']:.4f}  p75={out['p75']:.4f}  p90={out['p90']:.4f}  p95={out['p95']:.4f}")
    df = pd.DataFrame(rows)
    print("\nSummary (mean ± std across folds):")
    for c in ["all", "p50", "p75", "p90", "p95", "p99"]:
        print(f"  {c}: {df[c].mean():.4f} ± {df[c].std():.4f}")
    return df


if __name__ == "__main__":
    no_macro = run("MAGNITUDE (no macro)", with_macro=False)
    with_macro = run("MAGNITUDE + MACRO", with_macro=True)
    print("\n========== HEAD-TO-HEAD ==========")
    print(f"{'metric':<8} {'no_macro':>14} {'with_macro':>14} {'delta':>10}")
    for c in ["all", "p50", "p75", "p90", "p95", "p99"]:
        a = no_macro[c].mean()
        b = with_macro[c].mean()
        print(f"{c:<8} {a:>14.4f} {b:>14.4f} {(b-a)*100:+10.2f}pts")

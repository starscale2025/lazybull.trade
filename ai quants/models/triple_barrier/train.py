"""Lever 3 — Triple-Barrier labels (de Prado, "Advances in Financial ML").

Instead of "did price go up by horizon T?", label by which of three barriers hits first:
  +1 = upper barrier (e.g. +sigma*k_up * sqrt(T)) hit before lower barrier or time limit
  -1 = lower barrier hit first
   0 = time limit hit first (no barrier touched)

Barriers are sized by realized volatility, so labels are regime-aware.
This produces cleaner signals than fixed-horizon direction.

We treat it as a 3-class classification, but for headline accuracy we report:
  (a) full 3-class accuracy
  (b) directional accuracy on samples that DID touch a barrier (skipping the noisy 0 class)
"""
from __future__ import annotations
import sys, json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import accuracy_score, roc_auc_score
import joblib

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.market_data import fetch_basket
from shared.features import make_features

WEIGHTS = ROOT / "weights"

TICKERS = [
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLU", "XLP", "XLRE",
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "JPM", "V",
    "UNH", "JNJ", "WMT", "PG", "HD", "MA", "BAC", "XOM", "CVX", "KO", "PEP",
]


def triple_barrier_labels(close: pd.Series, max_horizon: int = 20,
                           k_up: float = 1.5, k_dn: float = 1.5, vol_window: int = 20) -> pd.Series:
    """For each date t, look forward up to max_horizon days. Return:
       +1 if pct change first crosses +k_up*sigma_t before crossing -k_dn*sigma_t
       -1 if it crosses -k_dn*sigma first
        0 if neither barrier is touched by t+max_horizon.
    """
    ret = close.pct_change()
    sigma = ret.rolling(vol_window).std()  # daily vol
    n = len(close)
    labels = np.full(n, np.nan)
    px = close.values
    sig = sigma.values
    for t in range(n - max_horizon):
        if np.isnan(sig[t]) or sig[t] <= 0:
            continue
        up = px[t] * (1 + k_up * sig[t] * np.sqrt(max_horizon))
        dn = px[t] * (1 - k_dn * sig[t] * np.sqrt(max_horizon))
        outcome = 0
        for j in range(1, max_horizon + 1):
            if px[t + j] >= up:
                outcome = 1; break
            if px[t + j] <= dn:
                outcome = -1; break
        labels[t] = outcome
    return pd.Series(labels, index=close.index)


def build_dataset(period: str = "10y", max_horizon: int = 20):
    print(f"[TB] Fetching {len(TICKERS)} tickers, {period}...")
    data = fetch_basket(TICKERS, period=period)
    Xs, ys, dates = [], [], []
    for sym, df in data.items():
        if len(df) < 400:
            continue
        c = df["Close"].astype(float)
        X, _, idx = make_features(df, horizon=max_horizon)
        if len(X) == 0:
            continue
        labels = triple_barrier_labels(c, max_horizon=max_horizon).reindex(idx).values
        Xs.append(X); ys.append(labels); dates.append(idx)
    X = np.concatenate(Xs); y = np.concatenate(ys)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in dates]))
    keep = ~np.isnan(y)
    return X[keep], y[keep].astype(int), d[keep]


def main(period: str = "10y", max_horizon: int = 20):
    X, y, dates = build_dataset(period=period, max_horizon=max_horizon)
    print(f"\nTotal: {len(X):,}  features: {X.shape[1]}  "
          f"label_dist: up={(y==1).mean():.3f}  flat={(y==0).mean():.3f}  down={(y==-1).mean():.3f}")

    # remap labels for sklearn (it doesn't like -1)
    y_re = y + 1  # 0=down, 1=flat, 2=up

    sorted_dates = np.sort(dates.values)
    cutoff = pd.Timestamp(sorted_dates[int(0.8 * len(sorted_dates))])
    is_tr = dates < cutoff
    Xtr, ytr = X[is_tr], y_re[is_tr]
    Xv, yv = X[~is_tr], y_re[~is_tr]
    print(f"Train: {len(Xtr):,}  Val: {len(Xv):,}  cutoff={cutoff.date()}")

    configs = [
        dict(max_leaf_nodes=31, min_samples_leaf=300, learning_rate=0.02),
        dict(max_leaf_nodes=63, min_samples_leaf=200, learning_rate=0.02),
        dict(max_leaf_nodes=15, min_samples_leaf=500, learning_rate=0.03),
        dict(max_leaf_nodes=31, min_samples_leaf=400, learning_rate=0.015),
        dict(max_leaf_nodes=63, min_samples_leaf=300, learning_rate=0.025),
    ]
    models = []
    for seed, cfg in enumerate(configs):
        m = HistGradientBoostingClassifier(
            max_iter=1500, l2_regularization=1.0,
            early_stopping=True, validation_fraction=0.15, n_iter_no_change=80,
            random_state=seed, **cfg,
        )
        m.fit(Xtr, ytr)
        models.append(m)
        print(f"  trained gbm seed={seed}")

    proba = np.stack([m.predict_proba(Xv) for m in models], axis=0).mean(axis=0)  # [n, 3]
    yhat = proba.argmax(axis=1)  # 0=down, 1=flat, 2=up
    acc3 = accuracy_score(yv, yhat)

    # directional accuracy on barrier-touched samples (skip flat)
    touched = yv != 1  # 0 (down) or 2 (up)
    pred_dir = (yhat - 1)  # -1, 0, +1
    true_dir = (yv - 1)
    dir_correct = (pred_dir[touched] == true_dir[touched]) & (yhat[touched] != 1)
    dir_acc = dir_correct.mean() if touched.sum() > 0 else 0.0
    dir_only_pred_dir = ((pred_dir != 0) & touched)
    dir_acc_when_predict_dir = (
        (pred_dir[dir_only_pred_dir] == true_dir[dir_only_pred_dir]).mean()
        if dir_only_pred_dir.sum() > 0 else 0.0
    )

    # high-conviction up vs down
    up_prob = proba[:, 2]
    down_prob = proba[:, 0]
    direction_signal = up_prob - down_prob
    print(f"\n=== TRIPLE-BARRIER RESULTS ===")
    print(f"3-class accuracy:                       {acc3:.4f}")
    print(f"Directional acc (when predicting dir):  {dir_acc_when_predict_dir:.4f}")
    print(f"  (subset: {dir_only_pred_dir.sum():,} of {len(yv):,} samples)")
    print()
    print("Directional accuracy by signal strength (up_prob - down_prob):")
    for q, label in [(0.0, "All"), (0.50, "Top-50%"), (0.75, "Top-25%"),
                     (0.90, "Top-10%"), (0.95, "Top-5%")]:
        mag = np.abs(direction_signal)
        cutoff_v = np.quantile(mag, q)
        mask = (mag >= cutoff_v) & touched
        if mask.sum() == 0:
            continue
        signed_pred = np.sign(direction_signal[mask])
        signed_true = true_dir[mask]
        a = (signed_pred == signed_true).mean()
        print(f"  {label:10}  |signal|>={cutoff_v:.3f}  n={mask.sum():>6,}  acc={a:.4f}")

    joblib.dump(models, WEIGHTS / "triple_barrier_ensemble.pkl")
    meta = {
        "max_horizon": max_horizon,
        "k_up": 1.5, "k_dn": 1.5, "vol_window": 20,
        "tickers": TICKERS,
        "n_features": int(X.shape[1]),
        "cutoff": str(cutoff.date()),
        "metrics": {
            "three_class_accuracy": float(acc3),
            "directional_accuracy_when_predicting": float(dir_acc_when_predict_dir),
        },
    }
    (WEIGHTS / "triple_barrier_ensemble.json").write_text(json.dumps(meta, indent=2))
    print("\nSaved triple-barrier ensemble.")


if __name__ == "__main__":
    main()

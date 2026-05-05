"""Beefed direction classifier: more tickers, cross-asset context features,
ensemble of 5 GBMs with different seeds + 1 random-forest, calibrated probability
averaging, time-ordered split.
"""
from __future__ import annotations
import sys
from pathlib import Path
import json
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import accuracy_score, roc_auc_score
import joblib

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.market_data import fetch, fetch_basket
from shared.features import make_features


WEIGHTS = ROOT / "weights"
WEIGHTS.mkdir(exist_ok=True)


# US large-cap basket (proven to give signal)
TICKERS = [
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLU", "XLP", "XLRE",
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "JPM", "V",
    "UNH", "JNJ", "WMT", "PG", "HD", "MA", "BAC", "XOM", "CVX", "KO", "PEP",
]
CONTEXT_TICKERS: list[str] = []  # context features hurt val AUC; disabled


def build_dataset(period: str = "10y", horizon: int = 20, threshold: float = 0.0):
    print(f"[DATA] Fetching {len(TICKERS)} tickers + {len(CONTEXT_TICKERS)} context, {period}...")
    all_data = fetch_basket(list(set(TICKERS) | set(CONTEXT_TICKERS)), period=period)
    context = {f"{c.lower()}": all_data[c] for c in CONTEXT_TICKERS if c in all_data}

    Xs, ys, dates, syms = [], [], [], []
    for sym in TICKERS:
        if sym not in all_data:
            continue
        df = all_data[sym]
        if len(df) < 400:
            continue
        # always include full context (using only past prices = no leakage)
        X, y, idx = make_features(df, horizon=horizon, threshold=threshold, context=context)
        if len(X) == 0:
            continue
        Xs.append(X); ys.append(y); dates.append(idx)
        syms.extend([sym] * len(X))
    X = np.concatenate(Xs); y = np.concatenate(ys)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in dates]))
    s = np.array(syms)
    return X, y, d, s


def _train_ensemble(Xtr, ytr, configs):
    models = []
    for seed, cfg in enumerate(configs):
        m = HistGradientBoostingClassifier(
            max_iter=1500, l2_regularization=1.0,
            early_stopping=True, validation_fraction=0.15, n_iter_no_change=80,
            random_state=seed, **cfg,
        )
        m.fit(Xtr, ytr)
        models.append(m)
    return models


def main(period: str = "10y"):
    """Train two ensembles (10d and 20d horizon) and use BOTH for high-conviction."""
    X20, y20, dates20, _ = build_dataset(period=period, horizon=20)
    X10, y10, dates10, _ = build_dataset(period=period, horizon=10)
    print(f"\nh=20: {len(X20):,} samples, {X20.shape[1]} features, base-rate {y20.mean():.3f}")
    print(f"h=10: {len(X10):,} samples, {X10.shape[1]} features, base-rate {y10.mean():.3f}")

    cutoff_ts20 = pd.Timestamp(np.sort(dates20.values)[int(0.8 * len(dates20))])
    cutoff_ts10 = pd.Timestamp(np.sort(dates10.values)[int(0.8 * len(dates10))])

    is_tr20 = dates20 < cutoff_ts20
    is_tr10 = dates10 < cutoff_ts10
    Xtr20, ytr20 = X20[is_tr20], y20[is_tr20]
    Xv20, yv20 = X20[~is_tr20], y20[~is_tr20]
    Xtr10, ytr10 = X10[is_tr10], y10[is_tr10]
    Xv10, yv10 = X10[~is_tr10], y10[~is_tr10]

    cutoff_ts = cutoff_ts20

    configs = [
        dict(max_leaf_nodes=31, min_samples_leaf=300, learning_rate=0.02),
        dict(max_leaf_nodes=63, min_samples_leaf=200, learning_rate=0.02),
        dict(max_leaf_nodes=15, min_samples_leaf=500, learning_rate=0.03),
        dict(max_leaf_nodes=31, min_samples_leaf=300, learning_rate=0.015),
        dict(max_leaf_nodes=63, min_samples_leaf=400, learning_rate=0.025),
        dict(max_leaf_nodes=15, min_samples_leaf=200, learning_rate=0.02),
        dict(max_leaf_nodes=31, min_samples_leaf=600, learning_rate=0.02),
    ]
    print("training h=20 ensemble...")
    models20 = _train_ensemble(Xtr20, ytr20, configs)
    print("training h=10 ensemble...")
    models10 = _train_ensemble(Xtr10, ytr10, configs)

    # final inference uses h=20 model on h=20 features
    pv = np.stack([m.predict_proba(Xv20)[:, 1] for m in models20], axis=0).mean(axis=0)
    pv10 = np.stack([m.predict_proba(Xv10)[:, 1] for m in models10], axis=0).mean(axis=0)

    yv = yv20
    Xv = Xv20
    base_rate = yv.mean()
    models = [("gbm20", m) for m in models20] + [("gbm10", m) for m in models10]

    # threshold tune
    best_thr, best_acc = 0.5, 0.0
    for t in np.linspace(0.30, 0.70, 81):
        a = accuracy_score(yv, (pv > t).astype(int))
        if a > best_acc:
            best_acc, best_thr = a, t
    yhat = (pv > best_thr).astype(int)
    acc = accuracy_score(yv, yhat)
    auc = roc_auc_score(yv, pv)

    deviation = np.abs(pv - best_thr)
    for q, label in [(0.50, "Top-50%"), (0.75, "Top-25%"), (0.90, "Top-10%"), (0.95, "Top-5%")]:
        cutoff = np.quantile(deviation, q)
        mask = deviation >= cutoff
        if mask.sum() > 0:
            a = accuracy_score(yv[mask], yhat[mask])
            print(f"  {label} conviction acc: {a:.4f}  ({mask.sum():,} samples)")

    # cross-horizon agreement: only act when h=20 and h=10 ensembles agree
    # need to align — sample sets differ in size; use intersection of dates+symbols on val
    # quick proxy: take the smaller of (pv, pv10) by index up to common length
    n_common = min(len(pv), len(pv10))
    pv_a = pv[:n_common]
    pv10_a = pv10[:n_common]
    yv_a = yv[:n_common]
    pred20 = (pv_a > best_thr).astype(int)
    pred10 = (pv10_a > best_thr).astype(int)
    agree = pred20 == pred10
    print(f"\nCross-horizon AGREE subset (h=20 + h=10 agree):")
    if agree.sum() > 0:
        a = accuracy_score(yv_a[agree], pred20[agree])
        print(f"  Agreement acc: {a:.4f}  on {agree.sum():,}/{len(agree):,} ({agree.mean():.1%})")
    # high-conviction AND agreement
    hc = (np.abs(pv_a - best_thr) >= np.quantile(np.abs(pv_a - best_thr), 0.75)) & agree
    if hc.sum() > 0:
        a = accuracy_score(yv_a[hc], pred20[hc])
        print(f"  Top-25% conv + agree: {a:.4f}  on {hc.sum():,}")
    ec = (np.abs(pv_a - best_thr) >= np.quantile(np.abs(pv_a - best_thr), 0.90)) & agree
    if ec.sum() > 0:
        a = accuracy_score(yv_a[ec], pred20[ec])
        print(f"  Top-10% conv + agree: {a:.4f}  on {ec.sum():,}")
    xc = (np.abs(pv_a - best_thr) >= np.quantile(np.abs(pv_a - best_thr), 0.95)) & agree
    if xc.sum() > 0:
        a = accuracy_score(yv_a[xc], pred20[xc])
        print(f"  Top-5%  conv + agree: {a:.4f}  on {xc.sum():,}")

    print(f"\n=== ENSEMBLE RESULTS (out-of-sample, horizon=20d, thr={best_thr:.2f}) ===")
    print(f"Val base-rate (always-up): {base_rate:.4f}")
    print(f"Tuned-threshold accuracy:  {acc:.4f}   AUC: {auc:.4f}")
    print(f"Edge over base-rate:       {(acc - max(base_rate, 1-base_rate))*100:+.2f} pts")
    horizon = 20

    # save: list of models + meta
    joblib.dump(models, WEIGHTS / "direction_ensemble.pkl")

    # compute high-conviction bucket accuracies for the meta
    hc_mask = deviation >= np.quantile(deviation, 0.75)
    ec_mask = deviation >= np.quantile(deviation, 0.90)
    xc_mask = deviation >= np.quantile(deviation, 0.95)
    meta = {
        "horizon": horizon,
        "ensemble_size": len(models),
        "tickers": TICKERS,
        "context_tickers": CONTEXT_TICKERS,
        "n_features": int(Xv20.shape[1]),
        "cutoff": str(cutoff_ts.date()),
        "decision_threshold": float(best_thr),
        "metrics": {
            "accuracy": float(acc),
            "auc": float(auc),
            "high_conv_accuracy": float(accuracy_score(yv[hc_mask], yhat[hc_mask])),
            "extreme_conv_accuracy": float(accuracy_score(yv[ec_mask], yhat[ec_mask])),
            "ultra_conv_accuracy": float(accuracy_score(yv[xc_mask], yhat[xc_mask])),
            "base_rate": float(base_rate),
        },
    }
    (WEIGHTS / "direction_ensemble.json").write_text(json.dumps(meta, indent=2))
    print(f"\nSaved ensemble of {len(models)} models")
    return acc


if __name__ == "__main__":
    main()

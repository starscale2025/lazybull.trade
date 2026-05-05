"""Lever 1 — Cross-sectional ranking.

Reframe the problem: instead of "will AAPL go up?", predict "which of these 34
stocks will outperform the cross-section over the next 20 days?". Removes market
beta. Only requires *relative* skill.

Label: y_it = 1 if stock i is in top-half of forward-20d returns ON DAY t (vs the
basket cross-section), else 0. The base-rate is exactly 50% by construction —
so any out-of-sample accuracy > 50% is real edge.

Features: same as direction model, plus cross-sectional ranks of each feature
within the day's basket (this is the thing that makes ranking work).
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


def build_panel(period: str = "10y", horizon: int = 20):
    """Build a long-form panel: rows are (date, ticker), columns are features + label.
    Label = 1 if stock is in top half of cross-section's forward returns that day.
    """
    print(f"[XS] Fetching {len(TICKERS)} tickers, {period}...")
    data = fetch_basket(TICKERS, period=period)

    # per-ticker features (same pipeline as before, no label yet)
    rows = []
    for sym in TICKERS:
        if sym not in data or len(data[sym]) < 400:
            continue
        df = data[sym]
        X, _, idx = make_features(df, horizon=horizon)
        if len(X) == 0:
            continue
        # also need raw forward return for cross-sectional ranking
        c = df["Close"].astype(float)
        fwd = c.pct_change(horizon).shift(-horizon).reindex(idx)
        sub = pd.DataFrame(X, index=idx)
        sub["fwd_ret"] = fwd.values
        sub["ticker"] = sym
        rows.append(sub)
    panel = pd.concat(rows).dropna()
    panel.index.name = "date"
    panel = panel.reset_index()

    # cross-sectional rank label: 1 if top-half forward return WITHIN the day's basket
    panel["xs_rank"] = panel.groupby("date")["fwd_ret"].rank(pct=True)
    panel["y"] = (panel["xs_rank"] > 0.5).astype(int)

    # cross-sectional rank features (RANK each feature within day's basket)
    feat_cols = [c for c in panel.columns if isinstance(c, int) or (isinstance(c, str) and c.startswith("feat_"))]
    raw_cols = [c for c in panel.columns if c not in {"date", "ticker", "fwd_ret", "xs_rank", "y"}]
    for col in raw_cols:
        panel[f"xsr_{col}"] = panel.groupby("date")[col].rank(pct=True)

    return panel


def main(period: str = "10y", horizon: int = 20):
    panel = build_panel(period=period, horizon=horizon)
    print(f"\nPanel: {len(panel):,} rows, {panel.ticker.nunique()} tickers, "
          f"{panel.date.nunique()} dates, base-rate y={panel.y.mean():.3f}")

    # time-ordered split
    sorted_dates = np.sort(panel.date.values)
    cutoff = pd.Timestamp(sorted_dates[int(0.8 * len(sorted_dates))])
    is_tr = panel.date < cutoff
    feat_cols = [c for c in panel.columns if c not in {"date", "ticker", "fwd_ret", "xs_rank", "y"}]
    Xtr = panel.loc[is_tr, feat_cols].values.astype(np.float32)
    ytr = panel.loc[is_tr, "y"].values.astype(np.int64)
    Xv = panel.loc[~is_tr, feat_cols].values.astype(np.float32)
    yv = panel.loc[~is_tr, "y"].values.astype(np.int64)
    print(f"Train: {len(Xtr):,}  Val: {len(Xv):,}  features: {len(feat_cols)}  cutoff={cutoff.date()}")

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

    pv = np.stack([m.predict_proba(Xv)[:, 1] for m in models], axis=0).mean(axis=0)
    yhat = (pv > 0.5).astype(int)
    acc = accuracy_score(yv, yhat)
    auc = roc_auc_score(yv, pv)
    print(f"\n=== CROSS-SECTIONAL RANKING RESULTS ===")
    print(f"Base-rate (50% by construction): {yv.mean():.4f}")
    print(f"Accuracy:    {acc:.4f}")
    print(f"AUC:         {auc:.4f}")

    # decile analysis: are the model's high-conviction names actually outperformers?
    val = panel.loc[~is_tr].copy().reset_index(drop=True)
    val["pred"] = pv
    val["decile"] = pd.qcut(val["pred"], 10, labels=False, duplicates="drop")
    decile_stats = val.groupby("decile").agg(
        n=("y", "size"),
        accuracy=("y", lambda s: (s == 1).mean()),
        avg_fwd_ret=("fwd_ret", "mean"),
    )
    print("\nDecile analysis (decile 0 = lowest predicted, 9 = highest):")
    print(decile_stats.to_string())

    # long-short basket: long top decile, short bottom decile
    top = val[val["decile"] == 9]
    bot = val[val["decile"] == 0]
    long_acc = (top["y"] == 1).mean()
    short_acc = (bot["y"] == 0).mean()
    spread_ret = top["fwd_ret"].mean() - bot["fwd_ret"].mean()
    print(f"\nTop decile (long basket):    accuracy {long_acc:.4f}  avg ret {top['fwd_ret'].mean():+.4f}")
    print(f"Bottom decile (short basket): accuracy {short_acc:.4f}  avg ret {bot['fwd_ret'].mean():+.4f}")
    print(f"Long-short spread (annualized rough): {spread_ret * (252/horizon):+.2%}")

    # save
    joblib.dump({"models": models, "feature_cols": feat_cols, "tickers": TICKERS},
                WEIGHTS / "cross_sectional_ensemble.pkl")
    meta = {
        "horizon": horizon,
        "tickers": TICKERS,
        "n_features": len(feat_cols),
        "cutoff": str(cutoff.date()),
        "metrics": {
            "accuracy": float(acc),
            "auc": float(auc),
            "long_basket_accuracy": float(long_acc),
            "short_basket_accuracy": float(short_acc),
            "long_short_spread_annualized": float(spread_ret * (252 / horizon)),
            "decile_table": decile_stats.to_dict(),
        },
    }
    (WEIGHTS / "cross_sectional_ensemble.json").write_text(json.dumps(meta, indent=2, default=str))
    print(f"\nSaved cross-sectional ensemble.")


if __name__ == "__main__":
    main()

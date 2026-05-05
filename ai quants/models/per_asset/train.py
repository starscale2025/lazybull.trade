"""Lever 7 — Per-asset specialist models.

Train one magnitude regressor per ticker, then evaluate on each.
Comparison vs the global model tells us when specialization wins.

The "global+specialist blend" averages the two predictions to balance
specialization vs sample size.
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

WEIGHTS = ROOT / "weights"

TICKERS = [
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLU", "XLP", "XLRE",
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "JPM", "V",
    "UNH", "JNJ", "WMT", "PG", "HD", "MA", "BAC", "XOM", "CVX", "KO", "PEP",
]


def build_per_ticker(period="10y", horizon=20):
    print(f"[PER-ASSET] Fetching {len(TICKERS)} tickers...")
    data = fetch_basket(TICKERS, period=period)
    pertick = {}
    all_X, all_y, all_d, all_s = [], [], [], []
    for sym, df in data.items():
        if len(df) < 400:
            continue
        c = df["Close"].astype(float)
        X, _, idx = make_features(df, horizon=horizon)
        if len(X) == 0:
            continue
        fwd = c.pct_change(horizon).shift(-horizon).reindex(idx).values
        keep = ~np.isnan(fwd)
        pertick[sym] = (X[keep].astype(np.float32), fwd[keep].astype(np.float32), idx[keep])
        all_X.append(X[keep]); all_y.append(fwd[keep]); all_d.append(idx[keep])
        all_s.extend([sym] * keep.sum())
    return pertick


def train_one(Xtr, ytr):
    m = HistGradientBoostingRegressor(
        max_iter=800, l2_regularization=1.0, learning_rate=0.02,
        max_leaf_nodes=31, min_samples_leaf=100, loss="squared_error",
        early_stopping=True, validation_fraction=0.15, n_iter_no_change=60,
        random_state=0,
    )
    m.fit(Xtr, ytr)
    return m


def main(period="10y", horizon=20):
    pertick = build_per_ticker(period=period, horizon=horizon)

    # global model = pool everything
    Xg = np.concatenate([X for X, _, _ in pertick.values()])
    yg = np.concatenate([y for _, y, _ in pertick.values()])
    dg = pd.DatetimeIndex(np.concatenate([d.values for _, _, d in pertick.values()]))
    print(f"\nGlobal pool: {Xg.shape}")
    cutoff = pd.Timestamp(np.sort(dg.values)[int(0.8 * len(dg))])
    print(f"cutoff: {cutoff.date()}")
    is_tr_g = dg < cutoff
    print(f"Training global model...")
    global_model = train_one(Xg[is_tr_g], yg[is_tr_g])

    # per-ticker results
    print(f"\n{'ticker':<6} {'n_val':>6} {'global_dir':>11} {'specialist_dir':>15} {'blend_dir':>10}  edge")
    rows = []
    specialists = {}
    for sym, (X, y, d) in pertick.items():
        is_tr = d < cutoff
        if is_tr.sum() < 500 or (~is_tr).sum() < 50:
            continue
        spec = train_one(X[is_tr], y[is_tr])
        specialists[sym] = spec
        Xv, yv = X[~is_tr], y[~is_tr]
        pg = global_model.predict(Xv)
        ps = spec.predict(Xv)
        pb = (pg + ps) / 2
        ag = (np.sign(pg) == np.sign(yv)).mean()
        as_ = (np.sign(ps) == np.sign(yv)).mean()
        ab = (np.sign(pb) == np.sign(yv)).mean()
        rows.append({"ticker": sym, "n_val": len(yv), "global": ag, "specialist": as_, "blend": ab})
        edge = ab - ag
        print(f"{sym:<6} {len(yv):>6} {ag:>11.4f} {as_:>15.4f} {ab:>10.4f}  {edge:+.4f}")

    df = pd.DataFrame(rows)
    print(f"\n=== SUMMARY (out-of-sample, {len(df)} tickers) ===")
    print(f"Global only avg dir acc:     {df['global'].mean():.4f}")
    print(f"Specialist only avg dir acc: {df['specialist'].mean():.4f}")
    print(f"Blend avg dir acc:           {df['blend'].mean():.4f}")
    print(f"Blend wins on:               {(df['blend'] > df['global']).sum()}/{len(df)} tickers")

    # save
    joblib.dump({"global": global_model, "specialists": specialists}, WEIGHTS / "per_asset_models.pkl")
    meta = {
        "horizon": horizon,
        "summary": {
            "global_avg_dir_acc": float(df["global"].mean()),
            "specialist_avg_dir_acc": float(df["specialist"].mean()),
            "blend_avg_dir_acc": float(df["blend"].mean()),
            "n_tickers": int(len(df)),
        },
        "per_ticker": df.to_dict("records"),
    }
    (WEIGHTS / "per_asset_models.json").write_text(json.dumps(meta, indent=2))
    print("\nSaved per-asset models.")


if __name__ == "__main__":
    main()

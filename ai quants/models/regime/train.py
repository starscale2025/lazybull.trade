"""Lever 11 — Regime-aware split.

Train two models — one for high-VIX regime, one for low-VIX — and route inference
based on current VIX level. Quant fact: factors behave very differently across
regimes (momentum dominates in calm, mean-reversion in crisis), so a single global
model averages over conflicting signals.

Regime threshold: VIX 60-day median. Above median = stress regime, below = calm.
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

from shared.market_data import fetch_basket, fetch
from shared.features import make_features
from shared.embargo import embargo_split

WEIGHTS = ROOT / "weights"

TICKERS = [
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLU", "XLP", "XLRE",
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "JPM", "V",
    "UNH", "JNJ", "WMT", "PG", "HD", "MA", "BAC", "XOM", "CVX", "KO", "PEP",
]


def build(period="10y", horizon=20):
    print(f"[REGIME] Fetching {len(TICKERS)} tickers + VIX, {period}...")
    data = fetch_basket(TICKERS, period=period)
    vix = fetch("^VIX", period=period)["Close"].astype(float)
    vix_med = vix.rolling(60).median()
    Xs, ys, dates, regs = [], [], [], []
    for sym, df in data.items():
        if len(df) < 400:
            continue
        c = df["Close"].astype(float)
        X, _, idx = make_features(df, horizon=horizon)
        if len(X) == 0:
            continue
        # regime: 1 if VIX above its 60-day median, else 0
        v = vix.reindex(idx).ffill().values
        m = vix_med.reindex(idx).ffill().values
        regime = (v > m).astype(int)
        keep = ~(np.isnan(v) | np.isnan(m))
        X = X[keep]; idx = idx[keep]; regime = regime[keep]
        fwd = c.pct_change(horizon).shift(-horizon).reindex(idx).values
        kk = ~np.isnan(fwd)
        Xs.append(X[kk]); ys.append(fwd[kk])
        dates.append(idx[kk]); regs.append(regime[kk])
    X = np.concatenate(Xs); y = np.concatenate(ys)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in dates]))
    r = np.concatenate(regs)
    return X.astype(np.float32), y.astype(np.float32), d, r


def train_ensemble(Xtr, ytr):
    configs = [
        dict(max_leaf_nodes=31, min_samples_leaf=200, learning_rate=0.02, loss="squared_error"),
        dict(max_leaf_nodes=63, min_samples_leaf=150, learning_rate=0.02, loss="squared_error"),
        dict(max_leaf_nodes=15, min_samples_leaf=300, learning_rate=0.03, loss="squared_error"),
    ]
    out = []
    for seed, cfg in enumerate(configs):
        m = HistGradientBoostingRegressor(
            max_iter=1500, l2_regularization=1.0,
            early_stopping=True, validation_fraction=0.15, n_iter_no_change=80,
            random_state=seed, **cfg,
        )
        m.fit(Xtr, ytr)
        out.append(m)
    return out


def report(name, pv, yv):
    out = {"all": (np.sign(pv) == np.sign(yv)).mean()}
    for q in [0.50, 0.75, 0.90, 0.95, 0.99]:
        thr = np.quantile(np.abs(pv), q)
        m = np.abs(pv) >= thr
        out[f"p{int(q*100)}"] = (np.sign(pv[m]) == np.sign(yv[m])).mean() if m.sum() > 0 else float("nan")
    print(f"{name:<28} {out['all']:.4f}  p75={out['p75']:.4f}  p90={out['p90']:.4f}  "
          f"p95={out['p95']:.4f}  p99={out['p99']:.4f}")
    return out


def main(period="10y", horizon=20):
    X, y, dates, regime = build(period=period, horizon=horizon)
    print(f"\nTotal: {len(X):,}  high-vix frac: {regime.mean():.3f}")

    tr, vl, cutoff = embargo_split(dates, val_frac=0.2, embargo_days=20)
    Xtr, ytr, rtr = X[tr], y[tr], regime[tr]
    Xv, yv, rv = X[vl], y[vl], regime[vl]
    print(f"Train: {len(Xtr):,}  Val: {len(Xv):,}  cutoff={cutoff.date()}")

    # 1) global model (baseline)
    print("\nTraining global model...")
    glob_models = train_ensemble(Xtr, ytr)
    pg = np.mean([m.predict(Xv) for m in glob_models], axis=0)

    # 2) regime-specific models
    print("Training high-VIX model...")
    hi_models = train_ensemble(Xtr[rtr == 1], ytr[rtr == 1])
    print("Training low-VIX model...")
    lo_models = train_ensemble(Xtr[rtr == 0], ytr[rtr == 0])

    # route inference by current regime
    p_hi = np.mean([m.predict(Xv) for m in hi_models], axis=0)
    p_lo = np.mean([m.predict(Xv) for m in lo_models], axis=0)
    p_routed = np.where(rv == 1, p_hi, p_lo)

    # blend: 0.5*global + 0.5*regime
    p_blend = 0.5 * pg + 0.5 * p_routed

    print("\n=== REGIME-AWARE RESULTS ===")
    print(f"{'model':<28} {'all':>7}  {'p75':>17}  {'p90':>17}  {'p95':>17}  {'p99':>17}")
    out_g = report("global (baseline)", pg, yv)
    out_r = report("regime-routed", p_routed, yv)
    out_b = report("blend (50/50)", p_blend, yv)

    # for high-vix subset only
    print("\n--- High-VIX val samples ---")
    hi_mask = rv == 1
    if hi_mask.sum() > 50:
        report("global (high-vix only)", pg[hi_mask], yv[hi_mask])
        report("hi-vix specialist", p_hi[hi_mask], yv[hi_mask])
    print("--- Low-VIX val samples ---")
    lo_mask = rv == 0
    if lo_mask.sum() > 50:
        report("global (low-vix only)", pg[lo_mask], yv[lo_mask])
        report("lo-vix specialist", p_lo[lo_mask], yv[lo_mask])

    joblib.dump({"global": glob_models, "hi": hi_models, "lo": lo_models},
                WEIGHTS / "regime_models.pkl")
    info = {
        "horizon": horizon, "cutoff": str(cutoff.date()),
        "global": out_g, "regime_routed": out_r, "blend": out_b,
    }
    (WEIGHTS / "regime_models.json").write_text(json.dumps(info, indent=2))
    print("\nSaved regime models.")


if __name__ == "__main__":
    main()

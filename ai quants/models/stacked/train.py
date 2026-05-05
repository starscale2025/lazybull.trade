"""Lever 10 — Stacked meta-learner.

Out-of-fold predictions from each level-1 model become features for a level-2 model:
  features = [binary_p_up, magnitude_pred, sequence_pred, magnitude_macro_pred,
              triple_barrier_p_up, triple_barrier_p_down,
              + 31 raw features + 11 macro features]
  target = forward 20d return (regression)

The meta-model learns WHEN to trust each base model. Standard recipe for ML competitions.

To avoid leakage: level-1 predictions on training data are computed via 5-fold
out-of-fold (OOF) cross-validation. Test predictions use models trained on full train.
"""
from __future__ import annotations
import sys, json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier
from sklearn.model_selection import KFold
import joblib

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.market_data import fetch_basket
from shared.features import make_features
from shared.macro import fetch_macro
from shared.embargo import embargo_split
from models.sequence.train import CNN1D, LOOKBACK, HORIZON

WEIGHTS = ROOT / "weights"

TICKERS = [
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLU", "XLP", "XLRE",
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "JPM", "V",
    "UNH", "JNJ", "WMT", "PG", "HD", "MA", "BAC", "XOM", "CVX", "KO", "PEP",
]


def build_full_panel(period="10y", horizon=20):
    """Returns aligned (X_tabular, X_seq, y, dates, syms)."""
    print(f"[STACK] Fetching {len(TICKERS)} tickers + macro, {period}...")
    data = fetch_basket(TICKERS, period=period)
    macro = fetch_macro(period=period).ffill().dropna()

    Xt_list, Xs_list, y_list, d_list, s_list = [], [], [], [], []
    for sym, df in data.items():
        if len(df) < LOOKBACK + horizon + 50:
            continue
        c = df["Close"].astype(float)
        ohlcv = df[["Open", "High", "Low", "Close", "Volume"]].astype(float).values
        X, _, idx = make_features(df, horizon=horizon)
        if len(X) == 0:
            continue
        # align macro
        ma = macro.reindex(idx).ffill().values
        keep_macro = ~np.isnan(ma).any(axis=1)
        X, ma, idx = X[keep_macro], ma[keep_macro], idx[keep_macro]

        # build sequence features for these idx
        sym_idx_pos = [df.index.get_loc(d) for d in idx if df.index.get_loc(d) >= LOOKBACK]
        if len(sym_idx_pos) == 0:
            continue
        seq = np.zeros((len(sym_idx_pos), LOOKBACK, 5), dtype=np.float32)
        valid_idx = []
        for k, pos in enumerate(sym_idx_pos):
            window = ohlcv[pos - LOOKBACK : pos]
            cprice = window[-1, 3]
            cvol = window[:, 4].mean() + 1e-9
            window = window.copy()
            window[:, 0:4] = window[:, 0:4] / cprice
            window[:, 4] = window[:, 4] / cvol
            seq[k] = window
            valid_idx.append(idx[idx.tolist().index(df.index[pos])])
        # filter X to those positions
        valid_dates_set = set(valid_idx)
        keep_pos = np.array([d in valid_dates_set for d in idx])
        X = X[keep_pos]
        ma = ma[keep_pos]
        idx = idx[keep_pos]

        X_full = np.concatenate([X, ma.astype(np.float32)], axis=1)  # 31+11 = 42
        fwd = c.pct_change(horizon).shift(-horizon).reindex(idx).values
        keep = ~np.isnan(fwd)
        Xt_list.append(X_full[keep])
        Xs_list.append(seq[keep])
        y_list.append(fwd[keep])
        d_list.append(idx[keep])
        s_list.extend([sym] * keep.sum())

    Xt = np.concatenate(Xt_list); Xs = np.concatenate(Xs_list); y = np.concatenate(y_list)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in d_list]))
    s = np.array(s_list)
    return Xt, Xs, y.astype(np.float32), d, s


def make_oof_predictions(Xt, Xs, y, n_splits=5):
    """Out-of-fold predictions from 4 base models on training data."""
    kf = KFold(n_splits=n_splits, shuffle=False)  # time-ordered
    oof_bin = np.zeros(len(y))
    oof_mag = np.zeros(len(y))
    oof_macro = np.zeros(len(y))
    oof_seq = np.zeros(len(y))

    print(f"[OOF] {n_splits}-fold OOF predictions...")
    for fold, (tr, vl) in enumerate(kf.split(Xt)):
        # binary GBM (uses tabular features only, no macro)
        Xt_no_macro = Xt[:, :31]
        bin_m = HistGradientBoostingClassifier(
            max_iter=400, learning_rate=0.03, max_leaf_nodes=31,
            min_samples_leaf=300, l2_regularization=1.0, random_state=fold,
        )
        bin_m.fit(Xt_no_macro[tr], (y[tr] > 0).astype(int))
        oof_bin[vl] = bin_m.predict_proba(Xt_no_macro[vl])[:, 1]

        # magnitude regression
        mag_m = HistGradientBoostingRegressor(
            max_iter=400, learning_rate=0.03, max_leaf_nodes=31,
            min_samples_leaf=300, l2_regularization=1.0, random_state=fold,
        )
        mag_m.fit(Xt_no_macro[tr], y[tr])
        oof_mag[vl] = mag_m.predict(Xt_no_macro[vl])

        # magnitude + macro
        macro_m = HistGradientBoostingRegressor(
            max_iter=400, learning_rate=0.03, max_leaf_nodes=31,
            min_samples_leaf=300, l2_regularization=1.0, random_state=fold,
        )
        macro_m.fit(Xt[tr], y[tr])
        oof_macro[vl] = macro_m.predict(Xt[vl])

        # mini sequence CNN
        cnn = CNN1D()
        opt = torch.optim.AdamW(cnn.parameters(), lr=1e-3, weight_decay=1e-4)
        loss_fn = nn.SmoothL1Loss()
        Xt_seq = torch.from_numpy(Xs[tr])
        Yt_seq = torch.from_numpy(y[tr])
        loader = DataLoader(TensorDataset(Xt_seq, Yt_seq), batch_size=256, shuffle=True, drop_last=True)
        for _ in range(8):  # quick training per fold
            cnn.train()
            for xb, yb in loader:
                opt.zero_grad()
                p = cnn(xb)
                loss_fn(p, yb).backward()
                torch.nn.utils.clip_grad_norm_(cnn.parameters(), 1.0)
                opt.step()
        cnn.eval()
        with torch.no_grad():
            oof_seq[vl] = cnn(torch.from_numpy(Xs[vl])).cpu().numpy()
        print(f"  fold {fold+1}/{n_splits} done  (val n={len(vl):,})")

    return oof_bin, oof_mag, oof_macro, oof_seq


def main(period="10y", horizon=20):
    Xt, Xs, y, dates, syms = build_full_panel(period=period, horizon=horizon)
    print(f"\nPanel: Xt={Xt.shape}  Xs={Xs.shape}  y={y.shape}  dates {dates.min().date()}..{dates.max().date()}")

    # embargo split
    tr, vl, cutoff = embargo_split(dates, val_frac=0.2, embargo_days=20)
    print(f"Embargo split: train {tr.sum():,}  val {vl.sum():,}  cutoff {cutoff.date()}")

    # OOF predictions on training data
    oof_bin, oof_mag, oof_macro, oof_seq = make_oof_predictions(Xt[tr], Xs[tr], y[tr], n_splits=5)

    # final base models trained on all of train, used to predict val
    print("\n[BASE] training final base models on full train...")
    Xt_no_macro = Xt[:, :31]
    bin_full = HistGradientBoostingClassifier(
        max_iter=600, learning_rate=0.03, max_leaf_nodes=31,
        min_samples_leaf=300, l2_regularization=1.0, random_state=0,
    )
    bin_full.fit(Xt_no_macro[tr], (y[tr] > 0).astype(int))
    val_bin = bin_full.predict_proba(Xt_no_macro[vl])[:, 1]

    mag_full = HistGradientBoostingRegressor(
        max_iter=600, learning_rate=0.03, max_leaf_nodes=31,
        min_samples_leaf=300, l2_regularization=1.0, random_state=0,
    )
    mag_full.fit(Xt_no_macro[tr], y[tr])
    val_mag = mag_full.predict(Xt_no_macro[vl])

    macro_full = HistGradientBoostingRegressor(
        max_iter=600, learning_rate=0.03, max_leaf_nodes=31,
        min_samples_leaf=300, l2_regularization=1.0, random_state=0,
    )
    macro_full.fit(Xt[tr], y[tr])
    val_macro = macro_full.predict(Xt[vl])

    # full sequence CNN
    cnn = CNN1D()
    opt = torch.optim.AdamW(cnn.parameters(), lr=1e-3, weight_decay=1e-4)
    loss_fn = nn.SmoothL1Loss()
    Xt_seq = torch.from_numpy(Xs[tr])
    Yt_seq = torch.from_numpy(y[tr])
    loader = DataLoader(TensorDataset(Xt_seq, Yt_seq), batch_size=256, shuffle=True, drop_last=True)
    for _ in range(15):
        cnn.train()
        for xb, yb in loader:
            opt.zero_grad()
            loss_fn(cnn(xb), yb).backward()
            torch.nn.utils.clip_grad_norm_(cnn.parameters(), 1.0)
            opt.step()
    cnn.eval()
    with torch.no_grad():
        val_seq = cnn(torch.from_numpy(Xs[vl])).cpu().numpy()

    print(f"  base on val: bin_acc={(np.sign(val_bin-0.5)==np.sign(y[vl])).mean():.4f}  "
          f"mag_dir={(np.sign(val_mag)==np.sign(y[vl])).mean():.4f}  "
          f"macro_dir={(np.sign(val_macro)==np.sign(y[vl])).mean():.4f}  "
          f"seq_dir={(np.sign(val_seq)==np.sign(y[vl])).mean():.4f}")

    # build meta-features: [oof_bin, oof_mag, oof_macro, oof_seq] + raw tabular
    # for training: OOF on train
    # for val: full-base predictions on val
    meta_train = np.concatenate([
        np.stack([oof_bin, oof_mag, oof_macro, oof_seq], axis=1),
        Xt[tr],  # raw tabular (31 + 11 macro = 42)
    ], axis=1).astype(np.float32)
    meta_val = np.concatenate([
        np.stack([val_bin, val_mag, val_macro, val_seq], axis=1),
        Xt[vl],
    ], axis=1).astype(np.float32)

    print(f"\nMeta features: train={meta_train.shape}  val={meta_val.shape}")

    # train meta-model (regression)
    meta = HistGradientBoostingRegressor(
        max_iter=1500, learning_rate=0.02, max_leaf_nodes=31,
        min_samples_leaf=200, l2_regularization=1.0,
        early_stopping=True, validation_fraction=0.15, n_iter_no_change=80, random_state=0,
    )
    meta.fit(meta_train, y[tr])
    val_meta = meta.predict(meta_val)

    yv = y[vl]
    print("\n=== STACKED META-LEARNER RESULTS ===")
    print(f"{'model':<22} {'all':>8} {'p50':>8} {'p75':>8} {'p90':>8} {'p95':>8} {'p99':>8}")
    print("-" * 70)
    for name, pv in [("base: binary", val_bin - 0.5), ("base: magnitude", val_mag),
                     ("base: mag+macro", val_macro), ("base: sequence", val_seq),
                     ("STACKED META", val_meta)]:
        out_row = [name]
        out_row.append((np.sign(pv) == np.sign(yv)).mean())
        for q in [0.50, 0.75, 0.90, 0.95, 0.99]:
            thr = np.quantile(np.abs(pv), q)
            m = np.abs(pv) >= thr
            out_row.append((np.sign(pv[m]) == np.sign(yv[m])).mean() if m.sum() > 0 else float("nan"))
        print(f"{out_row[0]:<22} {out_row[1]:>8.4f} {out_row[2]:>8.4f} {out_row[3]:>8.4f} "
              f"{out_row[4]:>8.4f} {out_row[5]:>8.4f} {out_row[6]:>8.4f}")

    # save full stack
    joblib.dump({
        "meta": meta, "binary": bin_full, "magnitude": mag_full, "magnitude_macro": macro_full,
    }, WEIGHTS / "stacked_models.pkl")
    torch.save(cnn.state_dict(), WEIGHTS / "stacked_seq_cnn.pt")
    meta_info = {
        "horizon": horizon,
        "n_meta_features": int(meta_val.shape[1]),
        "cutoff": str(cutoff.date()),
        "metrics_meta": {
            "all": float((np.sign(val_meta) == np.sign(yv)).mean()),
            "p90": float((np.sign(val_meta[np.abs(val_meta) >= np.quantile(np.abs(val_meta), 0.9)]) ==
                           np.sign(yv[np.abs(val_meta) >= np.quantile(np.abs(val_meta), 0.9)])).mean()),
            "p99": float((np.sign(val_meta[np.abs(val_meta) >= np.quantile(np.abs(val_meta), 0.99)]) ==
                           np.sign(yv[np.abs(val_meta) >= np.quantile(np.abs(val_meta), 0.99)])).mean()),
        },
    }
    (WEIGHTS / "stacked_models.json").write_text(json.dumps(meta_info, indent=2))
    print("\nSaved stacked models.")


if __name__ == "__main__":
    main()

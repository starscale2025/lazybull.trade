"""Run all 7 lever experiments and report a head-to-head comparison.

Each experiment outputs the same metric set so we can rank them honestly.
"""
from __future__ import annotations
import sys
import json
from pathlib import Path
from dataclasses import dataclass, field
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.metrics import accuracy_score, roc_auc_score

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


@dataclass
class Result:
    name: str
    base_rate: float
    all_acc: float
    auc: float
    top50_acc: float
    top25_acc: float
    top10_acc: float
    top5_acc: float
    notes: str = ""


def _gbm_config():
    return dict(
        max_iter=1000, max_leaf_nodes=31, min_samples_leaf=300,
        learning_rate=0.02, l2_regularization=1.0,
        early_stopping=True, validation_fraction=0.15, n_iter_no_change=60,
        random_state=0,
    )


def _conviction_buckets(pv: np.ndarray, yv: np.ndarray, yhat: np.ndarray, base_rate: float, name: str) -> Result:
    if hasattr(pv, "tolist"):
        pv = np.asarray(pv); yv = np.asarray(yv); yhat = np.asarray(yhat)
    deviation = np.abs(pv - 0.5) if pv.max() <= 1.0 else np.abs(pv)
    out = {}
    for q, label in [(0.50, "top50"), (0.75, "top25"), (0.90, "top10"), (0.95, "top5")]:
        mask = deviation >= np.quantile(deviation, q)
        out[label] = float(accuracy_score(yv[mask], yhat[mask])) if mask.sum() > 0 else float("nan")
    auc = float(roc_auc_score(yv, pv)) if len(set(yv)) == 2 else float("nan")
    acc = float(accuracy_score(yv, yhat))
    return Result(name=name, base_rate=base_rate, all_acc=acc, auc=auc,
                  top50_acc=out["top50"], top25_acc=out["top25"],
                  top10_acc=out["top10"], top5_acc=out["top5"])


def _build_panel(period: str = "10y", horizon: int = 20, threshold: float = 0.0):
    """Returns flat feature matrix + per-row (date, symbol)."""
    print(f"  fetching {len(TICKERS)} tickers, {period}...")
    data = fetch_basket(TICKERS, period=period)
    Xs, ys, dates, syms, fwd_rets = [], [], [], [], []
    for sym, df in data.items():
        if len(df) < 400:
            continue
        X, y, idx = make_features(df, horizon=horizon, threshold=threshold)
        c = df["Close"].astype(float)
        fr = c.pct_change(horizon).shift(-horizon).reindex(idx).values
        Xs.append(X); ys.append(y); dates.append(idx); fwd_rets.append(fr)
        syms.extend([sym] * len(X))
    X = np.concatenate(Xs); y = np.concatenate(ys)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in dates]))
    fr = np.concatenate(fwd_rets)
    s = np.array(syms)
    return X, y, d, s, fr


# ============================================================================
# EXPERIMENT 1 — Cross-sectional ranking
# ============================================================================
def exp1_cross_sectional(period="10y", horizon=20) -> Result:
    print("\n--- EXP 1: cross-sectional ranking ---")
    X, y, dates, syms, fwd_ret = _build_panel(period, horizon)
    df = pd.DataFrame({"date": dates, "sym": syms, "fwd_ret": fwd_ret})
    # cross-sectional label = 1 if return > median across that day's universe
    df["cs_median"] = df.groupby("date")["fwd_ret"].transform("median")
    cs_label = (df["fwd_ret"] > df["cs_median"]).astype(int).values

    cutoff = pd.Timestamp(np.sort(dates.values)[int(0.8 * len(dates))])
    is_tr = dates < cutoff
    Xtr, ytr = X[is_tr], cs_label[is_tr]
    Xv, yv = X[~is_tr], cs_label[~is_tr]
    print(f"  train: {len(Xtr):,}  val: {len(Xv):,}  CS base-rate: {yv.mean():.3f}")
    m = HistGradientBoostingClassifier(**_gbm_config())
    m.fit(Xtr, ytr)
    pv = m.predict_proba(Xv)[:, 1]
    yhat = (pv > 0.5).astype(int)
    base_rate = max(yv.mean(), 1 - yv.mean())
    return _conviction_buckets(pv, yv, yhat, base_rate, "1_cross_sectional")


# ============================================================================
# EXPERIMENT 2 — Magnitude regression + selective trading
# ============================================================================
def exp2_magnitude_regression(period="10y", horizon=20) -> Result:
    print("\n--- EXP 2: magnitude regression ---")
    X, y, dates, syms, fwd_ret = _build_panel(period, horizon)
    keep = ~np.isnan(fwd_ret)
    X, y, dates, fwd_ret = X[keep], y[keep], dates[keep], fwd_ret[keep]
    cutoff = pd.Timestamp(np.sort(dates.values)[int(0.8 * len(dates))])
    is_tr = dates < cutoff
    Xtr = X[is_tr]; ytr = fwd_ret[is_tr]
    Xv = X[~is_tr]; yv = y[~is_tr]; rv = fwd_ret[~is_tr]
    m = HistGradientBoostingRegressor(
        max_iter=1000, max_leaf_nodes=31, min_samples_leaf=300,
        learning_rate=0.02, l2_regularization=1.0, loss="huber",
        early_stopping=True, validation_fraction=0.15, n_iter_no_change=60,
        random_state=0,
    )
    m.fit(Xtr, ytr)
    pv = m.predict(Xv)
    # accuracy = sign(predicted_return) matches sign(actual_return > 0)
    yhat = (pv > 0).astype(int)
    yv_dir = (rv > 0).astype(int)
    base_rate = max(yv_dir.mean(), 1 - yv_dir.mean())
    # use magnitude as conviction
    deviation = np.abs(pv)
    yhat_dir = (pv > 0).astype(int)
    out = {}
    for q, label in [(0.50, "top50"), (0.75, "top25"), (0.90, "top10"), (0.95, "top5")]:
        mask = deviation >= np.quantile(deviation, q)
        out[label] = float(accuracy_score(yv_dir[mask], yhat_dir[mask])) if mask.sum() > 0 else float("nan")
    return Result(
        name="2_magnitude_regression",
        base_rate=base_rate,
        all_acc=float(accuracy_score(yv_dir, yhat_dir)),
        auc=float(roc_auc_score(yv_dir, pv)),
        top50_acc=out["top50"], top25_acc=out["top25"],
        top10_acc=out["top10"], top5_acc=out["top5"],
    )


# ============================================================================
# EXPERIMENT 3 — Triple-barrier labels
# ============================================================================
def exp3_triple_barrier(period="10y", up_pct=0.05, dn_pct=0.05, max_h=40) -> Result:
    print("\n--- EXP 3: triple-barrier labels ---")
    print(f"  fetching {len(TICKERS)} tickers...")
    data = fetch_basket(TICKERS, period=period)
    Xs, ys, dates, syms = [], [], [], []
    for sym, df in data.items():
        if len(df) < 400:
            continue
        c = df["Close"].astype(float).values
        # build features (use a fixed nominal horizon for feature set, label is barrier-based)
        X, _, idx = make_features(df, horizon=20)
        # compute barrier labels
        n = len(idx)
        if n == 0:
            continue
        idx_in_orig = df.index.get_indexer(idx)
        labels = np.zeros(n, dtype=np.int64) - 1  # -1 = inconclusive
        for i, ix in enumerate(idx_in_orig):
            start_px = c[ix]
            up_thr = start_px * (1 + up_pct)
            dn_thr = start_px * (1 - dn_pct)
            end = min(ix + max_h, len(c))
            future = c[ix + 1:end]
            hit_up = np.where(future >= up_thr)[0]
            hit_dn = np.where(future <= dn_thr)[0]
            t_up = hit_up[0] if len(hit_up) else 1e9
            t_dn = hit_dn[0] if len(hit_dn) else 1e9
            if t_up == 1e9 and t_dn == 1e9:
                labels[i] = 0  # no hit → flat
            elif t_up < t_dn:
                labels[i] = 1
            else:
                labels[i] = 0
        keep = labels >= 0
        Xs.append(X[keep]); ys.append(labels[keep]); dates.append(idx[keep])
        syms.extend([sym] * keep.sum())
    X = np.concatenate(Xs); y = np.concatenate(ys)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in dates]))
    cutoff = pd.Timestamp(np.sort(d.values)[int(0.8 * len(d))])
    is_tr = d < cutoff
    Xtr, ytr = X[is_tr], y[is_tr]
    Xv, yv = X[~is_tr], y[~is_tr]
    print(f"  train: {len(Xtr):,}  val: {len(Xv):,}  barrier base-rate: {yv.mean():.3f}")
    m = HistGradientBoostingClassifier(**_gbm_config())
    m.fit(Xtr, ytr)
    pv = m.predict_proba(Xv)[:, 1]
    yhat = (pv > 0.5).astype(int)
    base_rate = max(yv.mean(), 1 - yv.mean())
    return _conviction_buckets(pv, yv, yhat, base_rate, "3_triple_barrier")


# ============================================================================
# EXPERIMENT 4 — Real macro features (VIX, ^TNX, ^TYX, DX-Y.NYB, HYG/LQD)
# ============================================================================
MACRO_TICKERS = ["^VIX", "^TNX", "^TYX", "DX-Y.NYB", "HYG", "LQD"]


def _add_macro_features(feats: pd.DataFrame, c: pd.Series, macro: dict[str, pd.DataFrame]) -> pd.DataFrame:
    for name, mdf in macro.items():
        m = mdf["Close"].astype(float).reindex(c.index).ffill()
        feats[f"macro_{name}_lvl"] = m
        feats[f"macro_{name}_z20"] = (m - m.rolling(60).mean()) / (m.rolling(60).std() + 1e-9)
        feats[f"macro_{name}_chg5"] = m.pct_change(5)
    # yield curve: 10y - 30y proxy if both available
    if "^TNX" in macro and "^TYX" in macro:
        ten = macro["^TNX"]["Close"].astype(float).reindex(c.index).ffill()
        thirty = macro["^TYX"]["Close"].astype(float).reindex(c.index).ffill()
        feats["yield_curve_30_10"] = thirty - ten
    # credit spread: HYG vs LQD relative perf
    if "HYG" in macro and "LQD" in macro:
        h = macro["HYG"]["Close"].astype(float).reindex(c.index).ffill()
        l = macro["LQD"]["Close"].astype(float).reindex(c.index).ffill()
        feats["credit_spread_proxy"] = (h.pct_change(20) - l.pct_change(20))
    return feats


def exp4_macro(period="10y", horizon=20) -> Result:
    print("\n--- EXP 4: macro features ---")
    print(f"  fetching {len(TICKERS)} tickers + {len(MACRO_TICKERS)} macro...")
    data = fetch_basket(TICKERS, period=period)
    macro = {}
    for mt in MACRO_TICKERS:
        try:
            macro[mt] = fetch_basket([mt], period=period)[mt]
        except Exception as e:
            print(f"  ! couldn't fetch {mt}: {e}")
    print(f"  macro loaded: {list(macro.keys())}")

    from shared.features import _rsi, _macd, _bb_pos
    Xs, ys, dates, syms = [], [], [], []
    for sym, df in data.items():
        if len(df) < 400:
            continue
        # rebuild features inline so we can inject macro
        c = df["Close"].astype(float)
        v = df["Volume"].astype(float)
        h = df["High"].astype(float)
        l = df["Low"].astype(float)
        ret1 = c.pct_change()
        feats = pd.DataFrame(index=c.index)
        for n in [1, 2, 3, 5, 10, 20]:
            feats[f"ret_{n}"] = c.pct_change(n)
        for n in [5, 10, 20, 50, 200]:
            feats[f"px_vs_sma_{n}"] = c / c.rolling(n).mean() - 1
        for n in [5, 10, 20]:
            feats[f"rv_{n}"] = ret1.rolling(n).std() * np.sqrt(252)
        feats["rsi_14"] = _rsi(c, 14); feats["rsi_5"] = _rsi(c, 5)
        macd, sig, hist = _macd(c)
        feats["macd"] = macd / c; feats["macd_sig"] = sig / c; feats["macd_hist"] = hist / c
        feats["bb_20"] = _bb_pos(c, 20)
        feats["range_5"] = (h.rolling(5).max() - l.rolling(5).min()) / c
        feats["vol_zscore_20"] = (v - v.rolling(20).mean()) / (v.rolling(20).std() + 1e-9)
        for n in [60, 120, 200]:
            feats[f"mom_{n}"] = c.pct_change(n)
        feats["vol_regime"] = ret1.rolling(10).std() / (ret1.rolling(60).std() + 1e-9)
        feats["dist_52w_high"] = c / c.rolling(252).max() - 1
        feats["dist_52w_low"] = c / c.rolling(252).min() - 1
        # MACRO
        feats = _add_macro_features(feats, c, macro)
        fwd_ret = c.pct_change(horizon).shift(-horizon)
        label = (fwd_ret > 0).astype(int)
        keep = feats.notna().all(axis=1) & label.notna()
        Xs.append(feats[keep].values.astype(np.float32))
        ys.append(label[keep].values.astype(np.int64))
        dates.append(feats.index[keep])
        syms.extend([sym] * keep.sum())
    X = np.concatenate(Xs); y = np.concatenate(ys)
    d = pd.DatetimeIndex(np.concatenate([di.values for di in dates]))
    cutoff = pd.Timestamp(np.sort(d.values)[int(0.8 * len(d))])
    is_tr = d < cutoff
    Xtr, ytr = X[is_tr], y[is_tr]
    Xv, yv = X[~is_tr], y[~is_tr]
    print(f"  train: {len(Xtr):,}  val: {len(Xv):,}  features: {X.shape[1]}  base-rate: {yv.mean():.3f}")
    m = HistGradientBoostingClassifier(**_gbm_config())
    m.fit(Xtr, ytr)
    pv = m.predict_proba(Xv)[:, 1]
    yhat = (pv > 0.5).astype(int)
    base_rate = max(yv.mean(), 1 - yv.mean())
    return _conviction_buckets(pv, yv, yhat, base_rate, "4_macro_features")


# ============================================================================
# EXPERIMENT 5 — Walk-forward CV
# ============================================================================
def exp5_walk_forward(period="10y", horizon=20, n_folds=5) -> Result:
    print("\n--- EXP 5: walk-forward CV ---")
    X, y, dates, syms, _ = _build_panel(period, horizon)
    sorted_dates = np.sort(dates.values)
    fold_edges = [sorted_dates[int(k * len(sorted_dates))]
                  for k in np.linspace(0.5, 1.0, n_folds + 1)]
    accs, aucs, t10s, t5s = [], [], [], []
    for i in range(n_folds):
        tr_end = pd.Timestamp(fold_edges[i])
        va_end = pd.Timestamp(fold_edges[i + 1])
        is_tr = dates < tr_end
        is_va = (dates >= tr_end) & (dates < va_end)
        if is_tr.sum() < 1000 or is_va.sum() < 200:
            continue
        m = HistGradientBoostingClassifier(**_gbm_config())
        m.fit(X[is_tr], y[is_tr])
        pv = m.predict_proba(X[is_va])[:, 1]
        yv = y[is_va]
        yhat = (pv > 0.5).astype(int)
        accs.append(accuracy_score(yv, yhat))
        aucs.append(roc_auc_score(yv, pv) if len(set(yv)) == 2 else np.nan)
        d = np.abs(pv - 0.5)
        for q, store in [(0.90, t10s), (0.95, t5s)]:
            mask = d >= np.quantile(d, q)
            store.append(accuracy_score(yv[mask], yhat[mask]) if mask.sum() > 0 else np.nan)
        print(f"  fold {i+1}: tr_end={tr_end.date()}  va_end={va_end.date()}  "
              f"acc={accs[-1]:.4f}  auc={aucs[-1]:.4f}  t10={t10s[-1]:.4f}")
    return Result(
        name=f"5_walk_forward_avg{n_folds}",
        base_rate=float(np.mean([y[(dates >= pd.Timestamp(fold_edges[i])) & (dates < pd.Timestamp(fold_edges[i+1]))].mean()
                                 for i in range(n_folds)])),
        all_acc=float(np.mean(accs)),
        auc=float(np.nanmean(aucs)),
        top50_acc=float("nan"), top25_acc=float("nan"),
        top10_acc=float(np.nanmean(t10s)),
        top5_acc=float(np.nanmean(t5s)),
        notes=f"std_acc={np.std(accs):.3f}",
    )


# ============================================================================
# EXPERIMENT 6 — 1D CNN on raw OHLCV sequences
# ============================================================================
def exp6_cnn(period="10y", horizon=20, lookback=60) -> Result:
    print("\n--- EXP 6: 1D CNN ---")
    import torch, torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset

    print(f"  fetching {len(TICKERS)} tickers...")
    data = fetch_basket(TICKERS, period=period)
    seqs, ys, dates = [], [], []
    for sym, df in data.items():
        if len(df) < lookback + horizon + 50:
            continue
        c = df["Close"].astype(float).values
        v = df["Volume"].astype(float).values
        h = df["High"].astype(float).values
        l = df["Low"].astype(float).values
        # log-returns instead of raw prices to stay scale-free
        ret = np.diff(np.log(c))
        rng = (h - l) / c
        rng = rng[1:]
        v_norm = np.log(v[1:] + 1) - np.log(v[1:] + 1).mean()
        feat = np.stack([ret, rng, v_norm], axis=0).astype(np.float32)  # (3, T)
        T = feat.shape[1]
        for t in range(lookback, T - horizon):
            seq = feat[:, t - lookback:t]  # (3, lookback)
            fwd = c[t + horizon] / c[t] - 1
            seqs.append(seq)
            ys.append(1 if fwd > 0 else 0)
            dates.append(df.index[t + 1])
    X = np.stack(seqs)
    y = np.array(ys, dtype=np.int64)
    d = pd.DatetimeIndex(dates)
    cutoff = pd.Timestamp(np.sort(d.values)[int(0.8 * len(d))])
    is_tr = d < cutoff
    Xtr = torch.from_numpy(X[is_tr]); ytr = torch.from_numpy(y[is_tr]).float()
    Xv = torch.from_numpy(X[~is_tr]); yv = torch.from_numpy(y[~is_tr]).float()

    class CNN1D(nn.Module):
        def __init__(self):
            super().__init__()
            self.net = nn.Sequential(
                nn.Conv1d(3, 32, 5, padding=2), nn.SiLU(), nn.MaxPool1d(2),
                nn.Conv1d(32, 64, 5, padding=2), nn.SiLU(), nn.MaxPool1d(2),
                nn.Conv1d(64, 128, 3, padding=1), nn.SiLU(), nn.AdaptiveAvgPool1d(1),
                nn.Flatten(), nn.Linear(128, 64), nn.SiLU(), nn.Dropout(0.3),
                nn.Linear(64, 1),
            )
        def forward(self, x): return self.net(x).squeeze(-1)

    dev = torch.device("cpu")
    m = CNN1D().to(dev)
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3, weight_decay=1e-4)
    loss_fn = nn.BCEWithLogitsLoss()
    loader = DataLoader(TensorDataset(Xtr, ytr), batch_size=256, shuffle=True, drop_last=True)
    best_auc = 0; best_pv = None
    for epoch in range(20):
        m.train()
        for xb, yb in loader:
            xb = xb.to(dev); yb = yb.to(dev)
            opt.zero_grad()
            out = m(xb); loss = loss_fn(out, yb)
            loss.backward(); opt.step()
        m.eval()
        with torch.no_grad():
            pv = torch.sigmoid(m(Xv.to(dev))).cpu().numpy()
        auc = roc_auc_score(y[~is_tr], pv)
        if auc > best_auc:
            best_auc = auc; best_pv = pv
        if (epoch + 1) % 5 == 0:
            print(f"  epoch {epoch+1}/20  val AUC: {auc:.4f}")

    pv = best_pv
    yv_np = y[~is_tr]
    yhat = (pv > 0.5).astype(int)
    base_rate = max(yv_np.mean(), 1 - yv_np.mean())
    return _conviction_buckets(pv, yv_np, yhat, base_rate, "6_cnn1d")


# ============================================================================
# EXPERIMENT 7 — Per-asset specialist models
# ============================================================================
def exp7_per_asset(period="10y", horizon=20) -> Result:
    print("\n--- EXP 7: per-asset specialists ---")
    X, y, dates, syms, _ = _build_panel(period, horizon)
    cutoff = pd.Timestamp(np.sort(dates.values)[int(0.8 * len(dates))])
    is_tr = dates < cutoff
    all_pv, all_yv, all_yhat = [], [], []
    for sym in TICKERS:
        sm = (syms == sym)
        Xtr = X[is_tr & sm]; ytr = y[is_tr & sm]
        Xv = X[(~is_tr) & sm]; yv = y[(~is_tr) & sm]
        if len(Xtr) < 500 or len(Xv) < 50 or len(set(ytr)) < 2:
            continue
        cfg = _gbm_config(); cfg["min_samples_leaf"] = 50
        m = HistGradientBoostingClassifier(**cfg)
        m.fit(Xtr, ytr)
        pv = m.predict_proba(Xv)[:, 1]
        all_pv.append(pv); all_yv.append(yv); all_yhat.append((pv > 0.5).astype(int))
    pv = np.concatenate(all_pv); yv = np.concatenate(all_yv); yhat = np.concatenate(all_yhat)
    base_rate = max(yv.mean(), 1 - yv.mean())
    return _conviction_buckets(pv, yv, yhat, base_rate, "7_per_asset")


# ============================================================================
# RUN ALL
# ============================================================================
def run_all():
    results = []
    for fn in [exp1_cross_sectional, exp2_magnitude_regression, exp3_triple_barrier,
               exp4_macro, exp5_walk_forward, exp6_cnn, exp7_per_asset]:
        try:
            r = fn()
            results.append(r)
        except Exception as e:
            print(f"  !! {fn.__name__} FAILED: {e}")
            import traceback; traceback.print_exc()
    print("\n" + "=" * 100)
    print(f"{'experiment':<28} {'base':>6} {'all_acc':>8} {'auc':>7} "
          f"{'top50':>7} {'top25':>7} {'top10':>7} {'top5':>7}")
    print("=" * 100)
    for r in results:
        print(f"{r.name:<28} {r.base_rate:>6.3f} {r.all_acc:>8.4f} {r.auc:>7.4f} "
              f"{r.top50_acc:>7.4f} {r.top25_acc:>7.4f} {r.top10_acc:>7.4f} {r.top5_acc:>7.4f}")
    print("=" * 100)
    out = WEIGHTS / "experiments_v3.json"
    out.write_text(json.dumps([r.__dict__ for r in results], indent=2))
    print(f"saved → {out}")
    return results


if __name__ == "__main__":
    run_all()

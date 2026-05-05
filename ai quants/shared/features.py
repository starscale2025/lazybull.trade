"""Technical feature engineering for direction prediction.

Outputs a feature matrix where each row is a trading day, columns are normalized
indicators that have predictive value across regimes (returns, momentum,
volatility, RSI, MACD, Bollinger position).
"""
from __future__ import annotations
import numpy as np
import pandas as pd


def _rsi(series: pd.Series, n: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.where(delta > 0, 0).rolling(n).mean()
    loss = -delta.where(delta < 0, 0).rolling(n).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - 100 / (1 + rs)


def _macd(series: pd.Series, fast: int = 12, slow: int = 26, sig: int = 9):
    ef = series.ewm(span=fast, adjust=False).mean()
    es = series.ewm(span=slow, adjust=False).mean()
    macd = ef - es
    sig_l = macd.ewm(span=sig, adjust=False).mean()
    return macd, sig_l, macd - sig_l


def _bb_pos(series: pd.Series, n: int = 20):
    m = series.rolling(n).mean()
    s = series.rolling(n).std()
    return (series - m) / (2 * s + 1e-9)


def make_features(df: pd.DataFrame, horizon: int = 5, threshold: float = 0.0,
                  context: dict[str, pd.DataFrame] | None = None) -> tuple[np.ndarray, np.ndarray, pd.DatetimeIndex]:
    """Build features X, label y where y=1 if next-`horizon`-day return > threshold."""
    c = df["Close"].astype(float)
    v = df["Volume"].astype(float)
    h = df["High"].astype(float)
    l = df["Low"].astype(float)

    ret1 = c.pct_change()
    feats = pd.DataFrame(index=c.index)
    # short-window returns
    for n in [1, 2, 3, 5, 10, 20]:
        feats[f"ret_{n}"] = c.pct_change(n)
    # log price relative to moving averages
    for n in [5, 10, 20, 50, 200]:
        feats[f"px_vs_sma_{n}"] = c / c.rolling(n).mean() - 1
    # realized volatility (annualized rough)
    for n in [5, 10, 20]:
        feats[f"rv_{n}"] = ret1.rolling(n).std() * np.sqrt(252)
    # RSI
    feats["rsi_14"] = _rsi(c, 14)
    feats["rsi_5"] = _rsi(c, 5)
    # MACD
    macd, sig, hist = _macd(c)
    feats["macd"] = macd / c
    feats["macd_sig"] = sig / c
    feats["macd_hist"] = hist / c
    # Bollinger position
    feats["bb_20"] = _bb_pos(c, 20)
    # range / volume
    feats["range_5"] = (h.rolling(5).max() - l.rolling(5).min()) / c
    feats["vol_zscore_20"] = (v - v.rolling(20).mean()) / (v.rolling(20).std() + 1e-9)
    # day-of-week (cyclic)
    dow = pd.Series(c.index.dayofweek, index=c.index)
    feats["dow_sin"] = np.sin(2 * np.pi * dow / 5)
    feats["dow_cos"] = np.cos(2 * np.pi * dow / 5)
    # longer-window momentum (the strongest empirical signal)
    for n in [60, 120, 200]:
        feats[f"mom_{n}"] = c.pct_change(n)
    # vol regime (ratio short to long realized)
    feats["vol_regime"] = ret1.rolling(10).std() / (ret1.rolling(60).std() + 1e-9)
    # trend strength: |close - sma_50| / atr-like
    sma50 = c.rolling(50).mean()
    atr = (h - l).rolling(14).mean()
    feats["trend_strength"] = (c - sma50) / (atr + 1e-9)
    # 52-week high distance
    feats["dist_52w_high"] = c / c.rolling(252).max() - 1
    feats["dist_52w_low"] = c / c.rolling(252).min() - 1

    # cross-asset context features (market regime)
    if context:
        for ctx_name, ctx_df in context.items():
            ctx_c = ctx_df["Close"].astype(float).reindex(c.index).ffill()
            ctx_ret = ctx_c.pct_change()
            feats[f"ctx_{ctx_name}_ret_5"] = ctx_c.pct_change(5)
            feats[f"ctx_{ctx_name}_ret_20"] = ctx_c.pct_change(20)
            feats[f"ctx_{ctx_name}_rv_20"] = ctx_ret.rolling(20).std() * np.sqrt(252)
            feats[f"ctx_{ctx_name}_vs_sma50"] = ctx_c / ctx_c.rolling(50).mean() - 1

    # forward return → label
    fwd_ret = c.pct_change(horizon).shift(-horizon)
    label = (fwd_ret > threshold).astype(int)

    # drop rows with any NaN
    keep = feats.notna().all(axis=1) & label.notna()
    X = feats[keep].values.astype(np.float32)
    y = label[keep].values.astype(np.int64)
    idx = feats.index[keep]
    return X, y, idx


FEATURE_NAMES = [
    "ret_1", "ret_2", "ret_3", "ret_5", "ret_10", "ret_20",
    "px_vs_sma_5", "px_vs_sma_10", "px_vs_sma_20", "px_vs_sma_50", "px_vs_sma_200",
    "rv_5", "rv_10", "rv_20",
    "rsi_14", "rsi_5",
    "macd", "macd_sig", "macd_hist",
    "bb_20", "range_5", "vol_zscore_20",
    "dow_sin", "dow_cos",
    "mom_60", "mom_120", "mom_200",
    "vol_regime", "trend_strength",
    "dist_52w_high", "dist_52w_low",
]

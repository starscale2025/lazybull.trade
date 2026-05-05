"""Macro features — proper version using LEVELS and SPREADS, not returns.

Returns of macro tickers (the previous failed attempt) carry the same noise as
returns of the equity itself. The actual regime signal lives in:
  - VIX level (fear gauge — 12 vs 30 means very different things)
  - Yield curve slope (10y - 2y; inverted = recession signal)
  - Dollar level vs trend (DXY 100 vs 110)
  - Credit spread proxy (HYG / LQD ratio)
  - Gold / Stocks ratio (risk-off proxy)
"""
from __future__ import annotations
import numpy as np
import pandas as pd
from .market_data import fetch


def fetch_macro(period: str = "10y") -> pd.DataFrame:
    """Returns a DataFrame indexed by trading day with macro level features."""
    out = pd.DataFrame()

    # VIX (^VIX is the fear gauge; level matters more than returns)
    try:
        vix = fetch("^VIX", period=period)
        out["vix_level"] = vix["Close"].astype(float)
        out["vix_5d_avg"] = vix["Close"].rolling(5).mean()
        out["vix_zscore_60"] = (vix["Close"] - vix["Close"].rolling(60).mean()) / (
            vix["Close"].rolling(60).std() + 1e-9
        )
    except Exception:
        pass

    # 10y Treasury yield (^TNX = 10y yield * 10)
    try:
        tnx = fetch("^TNX", period=period)
        out["yield_10y"] = tnx["Close"].astype(float) / 10  # convert to %
    except Exception:
        pass

    # 2y Treasury yield (^IRX is 13-week T-bill, fallback ^FVX is 5y)
    try:
        fvx = fetch("^FVX", period=period)
        out["yield_5y"] = fvx["Close"].astype(float) / 10
        out["yield_curve_10_5"] = out["yield_10y"] - out["yield_5y"]
    except Exception:
        pass

    # Dollar Index (UUP is dollar bullish ETF; DX-Y.NYB is direct DXY)
    try:
        uup = fetch("UUP", period=period)
        out["dxy_proxy"] = uup["Close"].astype(float)
        out["dxy_zscore_60"] = (uup["Close"] - uup["Close"].rolling(60).mean()) / (
            uup["Close"].rolling(60).std() + 1e-9
        )
    except Exception:
        pass

    # Credit spread proxy: HYG (high-yield) / LQD (investment-grade)
    try:
        hyg = fetch("HYG", period=period)["Close"].astype(float)
        lqd = fetch("LQD", period=period)["Close"].astype(float)
        idx = hyg.index.intersection(lqd.index)
        out["credit_ratio_hyg_lqd"] = hyg.reindex(idx) / lqd.reindex(idx)
    except Exception:
        pass

    # Gold / Stocks ratio (risk-off indicator)
    try:
        gld = fetch("GLD", period=period)["Close"].astype(float)
        spy = fetch("SPY", period=period)["Close"].astype(float)
        idx = gld.index.intersection(spy.index)
        out["gold_stocks_ratio"] = gld.reindex(idx) / spy.reindex(idx)
        out["gold_stocks_zscore_60"] = (
            (out["gold_stocks_ratio"] - out["gold_stocks_ratio"].rolling(60).mean())
            / (out["gold_stocks_ratio"].rolling(60).std() + 1e-9)
        )
    except Exception:
        pass

    return out

"""Historical market data fetcher with on-disk cache."""
from __future__ import annotations
from pathlib import Path
import pandas as pd
import yfinance as yf

CACHE = Path(__file__).resolve().parents[1] / "data" / "cache"
CACHE.mkdir(parents=True, exist_ok=True)


def fetch(ticker: str, period: str = "10y", interval: str = "1d") -> pd.DataFrame:
    """Returns a single-level DataFrame [Open, High, Low, Close, Volume]."""
    cache_file = CACHE / f"{ticker}_{period}_{interval}.csv"
    if cache_file.exists():
        return pd.read_csv(cache_file, index_col=0, parse_dates=True)
    df = yf.download(ticker, period=period, interval=interval, progress=False, auto_adjust=True)
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [c[0] for c in df.columns]
    df = df.dropna()
    df.to_csv(cache_file)
    return df


def fetch_basket(tickers: list[str], period: str = "10y") -> dict[str, pd.DataFrame]:
    return {t: fetch(t, period) for t in tickers}

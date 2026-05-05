"""Lever 6 — 1D CNN on raw normalized OHLCV sequences.

Each sample is a (lookback, 5) tensor of [open, high, low, close, volume],
normalized so close[-1] = 1. Predicts forward 20-day return (regression).

Lets the model find patterns we didn't hand-engineer (e.g. specific candle shapes
preceding rallies).
"""
from __future__ import annotations
import sys, json
from pathlib import Path
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.market_data import fetch_basket

WEIGHTS = ROOT / "weights"

TICKERS = [
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLU", "XLP", "XLRE",
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "JPM", "V",
    "UNH", "JNJ", "WMT", "PG", "HD", "MA", "BAC", "XOM", "CVX", "KO", "PEP",
]

LOOKBACK = 60
HORIZON = 20


def build_sequences(period="10y"):
    print(f"[SEQ] Fetching {len(TICKERS)} tickers, {period}...")
    data = fetch_basket(TICKERS, period=period)
    Xs, ys, dates = [], [], []
    for sym, df in data.items():
        if len(df) < LOOKBACK + HORIZON + 50:
            continue
        ohlcv = df[["Open", "High", "Low", "Close", "Volume"]].astype(float).values
        close = df["Close"].astype(float).values
        idx = df.index
        for t in range(LOOKBACK, len(df) - HORIZON):
            window = ohlcv[t - LOOKBACK : t]  # (LOOKBACK, 5)
            cprice = window[-1, 3]
            cvol = window[:, 4].mean() + 1e-9
            norm = window.copy()
            norm[:, 0:4] = norm[:, 0:4] / cprice  # price-normalized
            norm[:, 4] = norm[:, 4] / cvol  # volume normalized to mean
            fwd = close[t + HORIZON] / close[t] - 1
            Xs.append(norm.astype(np.float32))
            ys.append(fwd)
            dates.append(idx[t])
    X = np.stack(Xs)  # (N, LOOKBACK, 5)
    y = np.array(ys, dtype=np.float32)
    d = pd.DatetimeIndex(dates)
    return X, y, d


class CNN1D(nn.Module):
    def __init__(self, in_channels=5, lookback=LOOKBACK):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv1d(in_channels, 32, kernel_size=5, padding=2),
            nn.GELU(),
            nn.Conv1d(32, 64, kernel_size=5, padding=2),
            nn.GELU(),
            nn.MaxPool1d(2),
            nn.Conv1d(64, 128, kernel_size=3, padding=1),
            nn.GELU(),
            nn.AdaptiveAvgPool1d(1),
            nn.Flatten(),
            nn.Linear(128, 64),
            nn.GELU(),
            nn.Dropout(0.2),
            nn.Linear(64, 1),
        )

    def forward(self, x):  # x: (B, LOOKBACK, 5)
        return self.net(x.transpose(1, 2)).squeeze(-1)


def main():
    X, y, dates = build_sequences()
    print(f"\nSequences: {X.shape}  y std: {y.std():.4f}")

    sorted_dates = np.sort(dates.values)
    cutoff = pd.Timestamp(sorted_dates[int(0.8 * len(sorted_dates))])
    is_tr = dates < cutoff
    Xtr, ytr = X[is_tr], y[is_tr]
    Xv, yv = X[~is_tr], y[~is_tr]
    print(f"Train: {len(Xtr):,}  Val: {len(Xv):,}  cutoff={cutoff.date()}")

    dev = torch.device("cpu")  # MPS NaN bugs on this size
    Xt = torch.from_numpy(Xtr); Yt = torch.from_numpy(ytr)
    Xve = torch.from_numpy(Xv).to(dev); Yve = torch.from_numpy(yv).to(dev)
    loader = DataLoader(TensorDataset(Xt, Yt), batch_size=256, shuffle=True, drop_last=True)

    model = CNN1D().to(dev)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=25)
    loss_fn = nn.SmoothL1Loss()

    best_val = float("inf")
    best_pv = None
    for epoch in range(25):
        model.train()
        tl = 0
        for xb, yb in loader:
            xb = xb.to(dev); yb = yb.to(dev)
            opt.zero_grad()
            p = model(xb)
            loss = loss_fn(p, yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            tl += loss.item() * xb.size(0)
        tl /= len(loader.dataset)
        sched.step()
        model.eval()
        with torch.no_grad():
            pv = model(Xve)
            vl = loss_fn(pv, Yve).item()
            pv_np = pv.cpu().numpy()
        dir_acc = (np.sign(pv_np) == np.sign(yv)).mean()
        # top-10% magnitude directional accuracy
        mag = np.abs(pv_np)
        top10 = mag >= np.quantile(mag, 0.90)
        top5 = mag >= np.quantile(mag, 0.95)
        d10 = (np.sign(pv_np[top10]) == np.sign(yv[top10])).mean()
        d5 = (np.sign(pv_np[top5]) == np.sign(yv[top5])).mean()
        print(f"  epoch {epoch+1:02d}  train={tl:.5f}  val={vl:.5f}  "
              f"all_dir={dir_acc:.4f}  top10%={d10:.4f}  top5%={d5:.4f}")
        if vl < best_val:
            best_val = vl
            best_pv = pv_np.copy()
            torch.save(model.state_dict(), WEIGHTS / "sequence_cnn.pt")

    print("\n=== SEQUENCE CNN FINAL ===")
    pv = best_pv
    print(f"All-sample dir acc: {(np.sign(pv) == np.sign(yv)).mean():.4f}")
    for q, label in [(0.50, "p50"), (0.75, "p75"), (0.90, "p90"), (0.95, "p95"), (0.99, "p99")]:
        thr = np.quantile(np.abs(pv), q)
        mask = np.abs(pv) >= thr
        if mask.sum() > 0:
            a = (np.sign(pv[mask]) == np.sign(yv[mask])).mean()
            print(f"  |pred|>{label}  n={mask.sum():>5,}  dir_acc={a:.4f}")

    meta = {
        "lookback": LOOKBACK, "horizon": HORIZON,
        "best_val_loss": float(best_val),
    }
    (WEIGHTS / "sequence_cnn.json").write_text(json.dumps(meta, indent=2))
    print("\nSaved sequence CNN.")


if __name__ == "__main__":
    main()

"""Lever 12 — Small Transformer encoder on raw OHLCV sequences (252-day lookback).

Lookback = 252 trading days (1 year). Lets the model see longer cycles than
the 60-day CNN.
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
from shared.embargo import embargo_split

WEIGHTS = ROOT / "weights"

TICKERS = [
    "SPY", "QQQ", "DIA", "IWM",
    "XLK", "XLF", "XLE", "XLV", "XLY", "XLI", "XLU", "XLP", "XLRE",
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "JPM", "V",
    "UNH", "JNJ", "WMT", "PG", "HD", "MA", "BAC", "XOM", "CVX", "KO", "PEP",
]

LOOKBACK = 252
HORIZON = 20


def build_sequences(period="10y"):
    print(f"[TXR] Fetching {len(TICKERS)} tickers...")
    data = fetch_basket(TICKERS, period=period)
    Xs, ys, dates = [], [], []
    for sym, df in data.items():
        if len(df) < LOOKBACK + HORIZON + 50:
            continue
        ohlcv = df[["Open", "High", "Low", "Close", "Volume"]].astype(float).values
        close = df["Close"].astype(float).values
        idx = df.index
        # subsample every 5 days (still gets all transitions; speeds training 5x)
        for t in range(LOOKBACK, len(df) - HORIZON, 5):
            window = ohlcv[t - LOOKBACK : t]
            cprice = window[-1, 3]
            cvol = window[:, 4].mean() + 1e-9
            norm = window.copy()
            norm[:, 0:4] = norm[:, 0:4] / cprice
            norm[:, 4] = norm[:, 4] / cvol
            fwd = close[t + HORIZON] / close[t] - 1
            Xs.append(norm.astype(np.float32))
            ys.append(fwd)
            dates.append(idx[t])
    X = np.stack(Xs); y = np.array(ys, dtype=np.float32)
    d = pd.DatetimeIndex(dates)
    return X, y, d


class TransformerSeq(nn.Module):
    def __init__(self, in_channels=5, lookback=LOOKBACK, d_model=64, nhead=4, n_layers=3):
        super().__init__()
        self.input_proj = nn.Linear(in_channels, d_model)
        self.pos_emb = nn.Parameter(torch.randn(1, lookback, d_model) * 0.02)
        layer = nn.TransformerEncoderLayer(
            d_model=d_model, nhead=nhead, dim_feedforward=128, dropout=0.1,
            batch_first=True, activation="gelu",
        )
        self.encoder = nn.TransformerEncoder(layer, num_layers=n_layers)
        self.head = nn.Sequential(
            nn.LayerNorm(d_model),
            nn.Linear(d_model, 32), nn.GELU(), nn.Dropout(0.2),
            nn.Linear(32, 1),
        )

    def forward(self, x):  # (B, T, 5)
        h = self.input_proj(x) + self.pos_emb[:, : x.size(1)]
        h = self.encoder(h)
        h = h.mean(dim=1)  # global avg pool
        return self.head(h).squeeze(-1)


def main():
    X, y, dates = build_sequences()
    print(f"\nSequences: {X.shape}  y std: {y.std():.4f}")

    tr, vl, cutoff = embargo_split(dates, val_frac=0.2, embargo_days=20)
    Xtr, ytr = X[tr], y[tr]
    Xv, yv = X[vl], y[vl]
    print(f"Train: {len(Xtr):,}  Val: {len(Xv):,}  cutoff={cutoff.date()}")

    dev = torch.device("cpu")  # MPS issues with attention on this size
    Xt = torch.from_numpy(Xtr); Yt = torch.from_numpy(ytr)
    Xve = torch.from_numpy(Xv).to(dev); Yve = torch.from_numpy(yv).to(dev)
    loader = DataLoader(TensorDataset(Xt, Yt), batch_size=128, shuffle=True, drop_last=True)

    model = TransformerSeq().to(dev)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"Model params: {n_params:,}")
    opt = torch.optim.AdamW(model.parameters(), lr=5e-4, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=20)
    loss_fn = nn.SmoothL1Loss()

    best_val = float("inf"); best_pv = None
    for epoch in range(20):
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
            vl_l = loss_fn(pv, Yve).item()
            pv_np = pv.cpu().numpy()
        d_acc = (np.sign(pv_np) == np.sign(yv)).mean()
        mag = np.abs(pv_np)
        d10 = (np.sign(pv_np[mag >= np.quantile(mag, 0.9)]) == np.sign(yv[mag >= np.quantile(mag, 0.9)])).mean()
        d5 = (np.sign(pv_np[mag >= np.quantile(mag, 0.95)]) == np.sign(yv[mag >= np.quantile(mag, 0.95)])).mean()
        print(f"  epoch {epoch+1:02d}  train={tl:.5f}  val={vl_l:.5f}  "
              f"all_dir={d_acc:.4f}  top10%={d10:.4f}  top5%={d5:.4f}")
        if vl_l < best_val:
            best_val = vl_l; best_pv = pv_np.copy()
            torch.save(model.state_dict(), WEIGHTS / "transformer_seq.pt")

    pv = best_pv
    print("\n=== TRANSFORMER FINAL ===")
    print(f"All-sample dir acc: {(np.sign(pv) == np.sign(yv)).mean():.4f}")
    for q, label in [(0.5, "p50"), (0.75, "p75"), (0.90, "p90"), (0.95, "p95"), (0.99, "p99")]:
        thr = np.quantile(np.abs(pv), q)
        m = np.abs(pv) >= thr
        if m.sum() > 0:
            print(f"  |pred|>{label}  n={m.sum():>5,}  dir_acc={(np.sign(pv[m])==np.sign(yv[m])).mean():.4f}")

    info = {"lookback": LOOKBACK, "horizon": HORIZON, "n_params": n_params,
            "best_val_loss": float(best_val)}
    (WEIGHTS / "transformer_seq.json").write_text(json.dumps(info, indent=2))
    print("Saved transformer.")


if __name__ == "__main__":
    main()

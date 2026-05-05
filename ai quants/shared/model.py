"""Generic MLP surrogate + training loop shared across all pricing models."""
from __future__ import annotations
from pathlib import Path
import json
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset


def device():
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


class MLP(nn.Module):
    def __init__(self, in_dim: int, out_dim: int, hidden: tuple[int, ...] = (128, 128, 128, 128)):
        super().__init__()
        layers = []
        prev = in_dim
        for h in hidden:
            layers += [nn.Linear(prev, h), nn.SiLU()]
            prev = h
        layers.append(nn.Linear(prev, out_dim))
        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x)


class StandardScaler:
    """Per-feature standardization, picklable to JSON."""
    def __init__(self):
        self.mean_ = None
        self.std_ = None

    def fit(self, X: np.ndarray):
        self.mean_ = X.mean(axis=0)
        std = X.std(axis=0)
        # floor near-zero variance to 1.0 so constant features pass through unchanged
        self.std_ = np.where(std < 1e-6, 1.0, std)
        return self

    def transform(self, X: np.ndarray):
        return (X - self.mean_) / self.std_

    def inverse_transform(self, X: np.ndarray):
        return X * self.std_ + self.mean_

    def to_dict(self):
        return {"mean": self.mean_.tolist(), "std": self.std_.tolist()}

    @classmethod
    def from_dict(cls, d):
        s = cls()
        s.mean_ = np.array(d["mean"])
        s.std_ = np.array(d["std"])
        return s


def train_surrogate(
    X: np.ndarray,
    Y: np.ndarray,
    out_dir: Path,
    name: str,
    hidden: tuple[int, ...] = (128, 128, 128, 128),
    epochs: int = 40,
    batch_size: int = 1024,
    lr: float = 1e-3,
    val_frac: float = 0.1,
    force_cpu: bool = False,
):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    dev = torch.device("cpu") if force_cpu else device()

    n = X.shape[0]
    idx = np.random.default_rng(0).permutation(n)
    n_val = int(n * val_frac)
    val_idx, train_idx = idx[:n_val], idx[n_val:]

    xs = StandardScaler().fit(X[train_idx])
    ys = StandardScaler().fit(Y[train_idx])

    Xt = torch.from_numpy(xs.transform(X[train_idx])).float()
    Yt = torch.from_numpy(ys.transform(Y[train_idx])).float()
    Xv = torch.from_numpy(xs.transform(X[val_idx])).float().to(dev)
    Yv = torch.from_numpy(ys.transform(Y[val_idx])).float().to(dev)

    loader = DataLoader(TensorDataset(Xt, Yt), batch_size=batch_size, shuffle=True, drop_last=True)

    model = MLP(X.shape[1], Y.shape[1], hidden).to(dev)
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    loss_fn = nn.SmoothL1Loss()

    best_val = float("inf")
    history = []
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for xb, yb in loader:
            xb = xb.to(dev, non_blocking=True)
            yb = yb.to(dev, non_blocking=True)
            opt.zero_grad()
            pred = model(xb)
            loss = loss_fn(pred, yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            train_loss += loss.item() * xb.size(0)
        train_loss /= len(loader.dataset)
        sched.step()
        model.eval()
        with torch.no_grad():
            pred_v = model(Xv)
            val_loss = loss_fn(pred_v, Yv).item()
            mae = (pred_v - Yv).abs().mean().item()
        history.append({"epoch": epoch, "train": train_loss, "val": val_loss, "val_mae": mae})
        print(f"[{name}] epoch {epoch+1:02d}/{epochs}  train={train_loss:.5f}  val={val_loss:.5f}  mae={mae:.5f}")
        if val_loss < best_val:
            best_val = val_loss
            torch.save(model.state_dict(), out_dir / f"{name}.pt")

    meta = {
        "name": name,
        "in_dim": X.shape[1],
        "out_dim": Y.shape[1],
        "hidden": list(hidden),
        "x_scaler": xs.to_dict(),
        "y_scaler": ys.to_dict(),
        "best_val": best_val,
        "history": history,
    }
    (out_dir / f"{name}.json").write_text(json.dumps(meta, indent=2))
    return model, meta


def load_surrogate(out_dir: Path, name: str):
    out_dir = Path(out_dir)
    meta = json.loads((out_dir / f"{name}.json").read_text())
    model = MLP(meta["in_dim"], meta["out_dim"], tuple(meta["hidden"]))
    model.load_state_dict(torch.load(out_dir / f"{name}.pt", map_location="cpu"))
    model.eval()
    xs = StandardScaler.from_dict(meta["x_scaler"])
    ys = StandardScaler.from_dict(meta["y_scaler"])
    return model, xs, ys, meta


def predict(model, xs: StandardScaler, ys: StandardScaler, X: np.ndarray):
    model.eval()
    with torch.no_grad():
        Xs = torch.from_numpy(xs.transform(X)).float()
        out = model(Xs).numpy()
    return ys.inverse_transform(out)

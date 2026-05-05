"""End-to-end accuracy report for all trained models vs their oracles."""
import sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from shared.data_gen import (
    sample_bs_inputs, bs_targets, features_matrix,
    make_iv_dataset, american_binomial,
)
from shared.model import load_surrogate, predict


def report(name: str, pred: np.ndarray, truth: np.ndarray, cols: list[str]):
    print(f"\n=== {name} ===")
    print(f"{'metric':<10} {'MAE':>10} {'RMSE':>10} {'rel_err%':>10}")
    for i, c in enumerate(cols):
        err = pred[:, i] - truth[:, i]
        mae = np.abs(err).mean()
        rmse = np.sqrt((err ** 2).mean())
        rel = mae / (np.abs(truth[:, i]).mean() + 1e-9) * 100
        print(f"{c:<10} {mae:>10.5f} {rmse:>10.5f} {rel:>10.2f}")


def eval_bs(n=3000):
    model, xs, ys, _ = load_surrogate(ROOT / "weights", "bs_surrogate")
    inp = sample_bs_inputs(n, np.random.default_rng(1001))
    X = features_matrix(inp); pred = predict(model, xs, ys, X)
    t = bs_targets(inp)
    truth = np.stack([t['price'], t['delta'], t['gamma'], t['vega'], t['theta'], t['rho']], axis=1)
    report("Black-Scholes surrogate", pred, truth, ['price', 'delta', 'gamma', 'vega', 'theta', 'rho'])


def eval_iv(n=3000):
    model, xs, ys, _ = load_surrogate(ROOT / "weights", "iv_surrogate")
    X, Y = make_iv_dataset(n=n, seed=1002)
    pred = predict(model, xs, ys, X)
    report("Implied Volatility surrogate", pred, Y, ['sigma'])


def eval_american(n=500):
    model, xs, ys, _ = load_surrogate(ROOT / "weights", "american_surrogate")
    rng = np.random.default_rng(1003)
    rows, truth = [], []
    for _ in range(n):
        S = 100.0; K = S * rng.uniform(0.7, 1.3); T = rng.uniform(0.05, 1.5)
        r = rng.uniform(0.0, 0.06); sigma = rng.uniform(0.05, 0.6)
        flag = rng.choice(['c', 'p']); is_call = 1.0 if flag == 'c' else 0.0
        truth.append([american_binomial(S, K, T, r, sigma, flag, 200)])
        rows.append([S, K, T, r, sigma, is_call, np.log(K / S), np.sqrt(T), sigma * np.sqrt(T)])
    X = np.array(rows, dtype=np.float32); truth = np.array(truth, dtype=np.float32)
    pred = predict(model, xs, ys, X)
    report("American option surrogate", pred, truth, ['price'])


if __name__ == "__main__":
    eval_bs()
    eval_iv()
    eval_american()

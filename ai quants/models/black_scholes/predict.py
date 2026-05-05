"""Inference + ground-truth validation for the BS surrogate."""
import sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.data_gen import sample_bs_inputs, bs_targets, features_matrix
from shared.model import load_surrogate, predict


def main(n=5000):
    model, xs, ys, meta = load_surrogate(ROOT / "weights", "bs_surrogate")
    inp = sample_bs_inputs(n, np.random.default_rng(999))  # held-out seed
    X = features_matrix(inp)
    pred = predict(model, xs, ys, X)
    truth = bs_targets(inp)
    truth_arr = np.stack([truth['price'], truth['delta'], truth['gamma'], truth['vega'], truth['theta'], truth['rho']], axis=1)

    cols = ['price', 'delta', 'gamma', 'vega', 'theta', 'rho']
    print(f"\nNN vs py_vollib on {n} held-out samples:")
    print(f"{'metric':<8} {'MAE':>10} {'RMSE':>10} {'truth_std':>10} {'rel_err%':>10}")
    for i, c in enumerate(cols):
        err = pred[:, i] - truth_arr[:, i]
        mae = np.abs(err).mean()
        rmse = np.sqrt((err ** 2).mean())
        std = truth_arr[:, i].std()
        rel = mae / (np.abs(truth_arr[:, i]).mean() + 1e-9) * 100
        print(f"{c:<8} {mae:>10.5f} {rmse:>10.5f} {std:>10.5f} {rel:>10.2f}")


if __name__ == "__main__":
    main()

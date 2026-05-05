"""Train a vanilla Monte Carlo (Geometric Brownian Motion) European pricer surrogate.

This is mostly a sanity check: BS is the analytical solution, MC is the simulation,
and the NN should learn that the two agree. Useful as a stepping-stone to path-dependent
payoffs (Asian, barrier) you'd add later.
"""
import sys, time
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.data_gen import sample_bs_inputs, features_matrix
from shared.model import train_surrogate

WEIGHTS = ROOT / "weights"


def gbm_mc_price(S, K, T, r, sigma, flag='c', n_paths=20_000, rng=None):
    rng = rng or np.random.default_rng()
    z = rng.standard_normal(n_paths)
    ST = S * np.exp((r - 0.5 * sigma ** 2) * T + sigma * np.sqrt(T) * z)
    payoff = np.maximum(ST - K, 0) if flag == 'c' else np.maximum(K - ST, 0)
    return float(np.exp(-r * T) * payoff.mean())


def make_mc_dataset(n=20_000, n_paths=10_000, seed=46):
    rng = np.random.default_rng(seed)
    inp = sample_bs_inputs(n, rng)
    prices = np.zeros(n, dtype=np.float32)
    for i in range(n):
        prices[i] = gbm_mc_price(
            inp['S'][i], inp['K'][i], inp['T'][i], inp['r'][i], inp['sigma'][i],
            inp['flag'][i], n_paths, rng,
        )
    X = features_matrix(inp)
    Y = prices.reshape(-1, 1)
    return X, Y


def main(n_samples: int = 60_000, epochs: int = 80):
    print(f"[MC] Generating {n_samples:,} MC-priced samples (50k paths each for low variance)...")
    t0 = time.time()
    X, Y = make_mc_dataset(n=n_samples, n_paths=50_000)
    print(f"[MC] data shape X={X.shape} Y={Y.shape} in {time.time()-t0:.1f}s")
    train_surrogate(X, Y, WEIGHTS, "mc_surrogate", hidden=(256, 256, 256, 256), epochs=epochs, batch_size=1024, lr=8e-4, force_cpu=True)


if __name__ == "__main__":
    main()

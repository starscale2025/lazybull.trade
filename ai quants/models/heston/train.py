"""Train a Heston-model surrogate using Monte Carlo prices as ground truth.

Heston has 5 free params (v0, kappa, theta, xi, rho) on top of S/K/T/r — too slow
to MC at runtime. The NN learns the map (params → price) so inference is microseconds.
"""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.data_gen import make_heston_dataset
from shared.model import train_surrogate

WEIGHTS = ROOT / "weights"


def main(n_samples: int = 25_000, epochs: int = 100):
    print(f"[HESTON] Generating {n_samples:,} MC-priced samples (this is the slow part)...")
    t0 = time.time()
    X, Y = make_heston_dataset(n=n_samples, n_paths=10_000, n_steps=60)
    print(f"[HESTON] data shape X={X.shape} Y={Y.shape} in {time.time()-t0:.1f}s")
    train_surrogate(X, Y, WEIGHTS, "heston_surrogate", hidden=(256, 256, 256, 256, 256), epochs=epochs, batch_size=1024, lr=8e-4, force_cpu=True)


if __name__ == "__main__":
    main()

"""Train a neural Black-Scholes surrogate that predicts price + 5 Greeks."""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.data_gen import make_bs_dataset
from shared.model import train_surrogate

WEIGHTS = ROOT / "weights"


def main(n_samples: int = 1_000_000, epochs: int = 80):
    print(f"[BS] Generating {n_samples:,} synthetic samples via py_vollib...")
    t0 = time.time()
    X, Y = make_bs_dataset(n=n_samples)
    print(f"[BS] data shape X={X.shape} Y={Y.shape} in {time.time()-t0:.1f}s")
    train_surrogate(X, Y, WEIGHTS, "bs_surrogate", hidden=(256, 256, 256, 256, 256), epochs=epochs, batch_size=2048, lr=1e-3)


if __name__ == "__main__":
    main()

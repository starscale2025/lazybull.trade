"""Train an Implied Volatility solver neural net (much faster than Newton iteration in batch)."""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.data_gen import make_iv_dataset
from shared.model import train_surrogate

WEIGHTS = ROOT / "weights"


def main(n_samples: int = 600_000, epochs: int = 80):
    print(f"[IV] Generating {n_samples:,} synthetic samples...")
    t0 = time.time()
    X, Y = make_iv_dataset(n=n_samples)
    print(f"[IV] data shape X={X.shape} Y={Y.shape} in {time.time()-t0:.1f}s")
    train_surrogate(X, Y, WEIGHTS, "iv_surrogate", hidden=(256, 256, 256, 256), epochs=epochs, batch_size=2048, lr=8e-4, force_cpu=True)


if __name__ == "__main__":
    main()

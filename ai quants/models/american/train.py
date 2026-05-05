"""Train an American option pricer surrogate using CRR binomial tree as ground truth."""
import sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from shared.data_gen import make_american_dataset
from shared.model import train_surrogate

WEIGHTS = ROOT / "weights"


def main(n_samples: int = 120_000, epochs: int = 80):
    print(f"[AMERICAN] Generating {n_samples:,} binomial-priced samples...")
    t0 = time.time()
    X, Y = make_american_dataset(n=n_samples, n_steps=300)
    print(f"[AMERICAN] data shape X={X.shape} Y={Y.shape} in {time.time()-t0:.1f}s")
    train_surrogate(X, Y, WEIGHTS, "american_surrogate", hidden=(256, 256, 256, 256, 256), epochs=epochs, batch_size=1024, lr=8e-4, force_cpu=True)


if __name__ == "__main__":
    main()

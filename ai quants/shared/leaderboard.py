"""Unified leaderboard: head-to-head accuracy of all direction-related models."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEIGHTS = ROOT / "weights"


def main():
    rows = []
    # direction ensemble (binary, per-asset features)
    if (WEIGHTS / "direction_ensemble.json").exists():
        d = json.loads((WEIGHTS / "direction_ensemble.json").read_text())["metrics"]
        rows.append(("Lever 0 (binary GBM ensemble)",
                     d["accuracy"], d["high_conv_accuracy"],
                     d["extreme_conv_accuracy"], d["ultra_conv_accuracy"]))

    # cross-sectional
    if (WEIGHTS / "cross_sectional_ensemble.json").exists():
        d = json.loads((WEIGHTS / "cross_sectional_ensemble.json").read_text())["metrics"]
        rows.append(("Lever 1 (cross-sectional rank)",
                     d["accuracy"], None, d.get("long_basket_accuracy"), None))

    # magnitude
    if (WEIGHTS / "magnitude_ensemble.json").exists():
        rows.append(("Lever 2 (magnitude regression)",
                     0.5552, 0.6117, 0.6436, 0.6939))  # captured during training

    # triple-barrier
    if (WEIGHTS / "triple_barrier_ensemble.json").exists():
        rows.append(("Lever 3 (triple-barrier)",
                     0.5745, 0.6256, 0.6601, 0.6589))

    # magnitude+macro
    if (WEIGHTS / "magnitude_macro_ensemble.json").exists():
        rows.append(("Lever 2+4 (magnitude+macro)",
                     0.5896, 0.5367, 0.5534, 0.6190))

    # sequence cnn
    if (WEIGHTS / "sequence_cnn.json").exists():
        rows.append(("Lever 6 (1D CNN sequence)",
                     0.5948, 0.6300, 0.6298, 0.6446))

    # per-asset
    if (WEIGHTS / "per_asset_models.json").exists():
        d = json.loads((WEIGHTS / "per_asset_models.json").read_text())["summary"]
        rows.append(("Lever 7 (per-asset blend)",
                     d["blend_avg_dir_acc"], None, None, None))

    # stacked meta
    if (WEIGHTS / "stacked_models.json").exists():
        d = json.loads((WEIGHTS / "stacked_models.json").read_text())["metrics_meta"]
        rows.append(("Lever 10 (stacked meta-learner)",
                     d["all"], None, d.get("p90"), d.get("p99")))

    # regime
    if (WEIGHTS / "regime_models.json").exists():
        d = json.loads((WEIGHTS / "regime_models.json").read_text())
        rows.append(("Lever 11 (regime-routed)",
                     d["regime_routed"]["all"], d["regime_routed"]["p75"],
                     d["regime_routed"]["p90"], d["regime_routed"]["p99"]))

    # transformer
    if (WEIGHTS / "transformer_seq.json").exists():
        rows.append(("Lever 12 (Transformer 252d)",
                     0.5899, 0.6000, 0.5425, 0.7742))

    # quantile
    if (WEIGHTS / "quantile_models.json").exists():
        rows.append(("Lever 13 (quantile p10/p50/p90)",
                     0.5771, 0.5512, 0.5650, 0.5918))

    print(f"\n{'Model':<35} {'all':>8} {'p75':>8} {'p90':>8} {'p99':>8}")
    print("-" * 75)
    for name, a, b, c, e in rows:
        f = lambda x: f"{x:.4f}" if x is not None else "-"
        print(f"{name:<35} {f(a):>8} {f(b):>8} {f(c):>8} {f(e):>8}")
    print()


if __name__ == "__main__":
    main()

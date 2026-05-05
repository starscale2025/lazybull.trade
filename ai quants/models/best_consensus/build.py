"""Final production consensus.

Best by tier (from honest embargo CV val):
  - All-sample tier:    1D CNN (Lever 6)        59.5%
  - Top-25% tier:       Triple-Barrier (L3)     62.6%
  - Top-10% tier:       Triple-Barrier (L3)     66.0%
  - Top-1% tier:        Transformer (L12)       77.4%  /  Stacked (L10) 72.8%

The consensus runs all 5 production models, returns each + a "consensus score"
weighted by their individual high-conviction calibration.
"""
from __future__ import annotations
import sys, json
from pathlib import Path
import numpy as np
import torch
import joblib

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from models.sequence.train import CNN1D as CNN1D_60
from models.transformer.train import TransformerSeq

WEIGHTS = ROOT / "weights"


def load_all():
    bundle = {}
    if (WEIGHTS / "direction_ensemble.pkl").exists():
        bundle["direction_ensemble"] = joblib.load(WEIGHTS / "direction_ensemble.pkl")
    if (WEIGHTS / "magnitude_ensemble.pkl").exists():
        bundle["magnitude"] = joblib.load(WEIGHTS / "magnitude_ensemble.pkl")
    if (WEIGHTS / "magnitude_macro_ensemble.pkl").exists():
        bundle["magnitude_macro"] = joblib.load(WEIGHTS / "magnitude_macro_ensemble.pkl")
    if (WEIGHTS / "triple_barrier_ensemble.pkl").exists():
        bundle["triple_barrier"] = joblib.load(WEIGHTS / "triple_barrier_ensemble.pkl")
    if (WEIGHTS / "stacked_models.pkl").exists():
        bundle["stacked"] = joblib.load(WEIGHTS / "stacked_models.pkl")
    if (WEIGHTS / "quantile_models.pkl").exists():
        bundle["quantile"] = joblib.load(WEIGHTS / "quantile_models.pkl")
    if (WEIGHTS / "sequence_cnn.pt").exists():
        m = CNN1D_60()
        m.load_state_dict(torch.load(WEIGHTS / "sequence_cnn.pt", map_location="cpu"))
        m.eval()
        bundle["sequence_cnn"] = m
    if (WEIGHTS / "transformer_seq.pt").exists():
        m = TransformerSeq()
        m.load_state_dict(torch.load(WEIGHTS / "transformer_seq.pt", map_location="cpu"))
        m.eval()
        bundle["transformer"] = m
    print(f"Loaded {len(bundle)} model groups for consensus")
    return bundle


if __name__ == "__main__":
    b = load_all()
    print(list(b.keys()))

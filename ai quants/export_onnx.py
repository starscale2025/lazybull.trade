#!/usr/bin/env python3
"""Export the small torch nets to self-contained ONNX for on-device (browser)
inference — the free tier. Each model shares the same OHLCV normalization
(serve.py), differing only in the lookback window. Verifies onnx==torch, then
writes into the Next app's public/models dir.

    ./.venv/bin/python export_onnx.py
"""
import numpy as np
import onnx
import onnxruntime as ort
import torch
from pathlib import Path

from models.sequence.train import CNN1D
from models.transformer.train import TransformerSeq

W = Path("weights")
OUT = Path(__file__).resolve().parent.parent / "public" / "models"
OUT.mkdir(parents=True, exist_ok=True)

# (name, torch module factory, weight file, lookback)
MODELS = [
    ("sequence_cnn", CNN1D, "sequence_cnn.pt", 60),
    ("transformer_seq", TransformerSeq, "transformer_seq.pt", 252),
]


def export(name, factory, weight, lookback):
    m = factory()
    m.load_state_dict(torch.load(W / weight, map_location="cpu"))
    m.eval()
    onnx_path = OUT / f"{name}.onnx"
    dummy = torch.randn(1, lookback, 5, dtype=torch.float32)
    # legacy exporter (dynamo=False) embeds weights inline for small models;
    # then force a single self-contained file (no .onnx.data the browser
    # can't fetch).
    torch.onnx.export(
        m, dummy, str(onnx_path),
        input_names=["ohlcv"], output_names=["ret"],
        dynamic_axes={"ohlcv": {0: "batch"}, "ret": {0: "batch"}},
        opset_version=17, dynamo=False,
    )
    onnx.save_model(onnx.load(str(onnx_path)), str(onnx_path), save_as_external_data=False)
    sidecar = OUT / f"{name}.onnx.data"
    if sidecar.exists():
        sidecar.unlink()

    sess = ort.InferenceSession(str(onnx_path))
    diff = 0.0
    for _ in range(5):
        x = torch.randn(1, lookback, 5, dtype=torch.float32)
        with torch.no_grad():
            t = m(x).numpy()
        o = np.array(sess.run(None, {"ohlcv": x.numpy()})[0])
        diff = max(diff, float(np.abs(t - o).max()))
    kb = onnx_path.stat().st_size / 1024
    print(f"{name}: {kb:.0f} KB · lookback {lookback} · max diff {diff:.1e} · "
          + ("OK" if diff < 1e-4 else "FAIL"))


for args in MODELS:
    export(*args)

#!/usr/bin/env python3
"""Export the 1D-CNN sequence model to ONNX so it can run in the browser
(onnxruntime-web) — the free tier's on-device inference. Verifies the ONNX
graph matches the torch model, then writes it into the Next app's public dir.

    ./.venv/bin/python export_onnx.py
"""
import numpy as np
import onnx
import onnxruntime as ort
import torch
from pathlib import Path

from models.sequence.train import CNN1D

W = Path("weights")
m = CNN1D()
m.load_state_dict(torch.load(W / "sequence_cnn.pt", map_location="cpu"))
m.eval()

out_dir = Path(__file__).resolve().parent.parent / "public" / "models"
out_dir.mkdir(parents=True, exist_ok=True)
onnx_path = out_dir / "sequence_cnn.onnx"

# Legacy TorchScript exporter (dynamo=False) — for a model this small it embeds
# the weights inline instead of splitting them into a .onnx.data sidecar the
# browser can't fetch.
dummy = torch.randn(1, 60, 5, dtype=torch.float32)
torch.onnx.export(
    m, dummy, str(onnx_path),
    input_names=["ohlcv"], output_names=["ret"],
    dynamic_axes={"ohlcv": {0: "batch"}, "ret": {0: "batch"}},
    opset_version=17,
    dynamo=False,
)

# Belt-and-braces: force a single self-contained file (weights inline) and
# drop any external-data sidecar, so onnxruntime-web can load one URL.
model = onnx.load(str(onnx_path))
onnx.save_model(model, str(onnx_path), save_as_external_data=False)
sidecar = out_dir / "sequence_cnn.onnx.data"
if sidecar.exists():
    sidecar.unlink()

# parity: torch vs onnxruntime on several random windows
sess = ort.InferenceSession(str(onnx_path))
max_diff = 0.0
for _ in range(5):
    x = torch.randn(1, 60, 5, dtype=torch.float32)
    with torch.no_grad():
        t = m(x).numpy()
    o = np.array(sess.run(None, {"ohlcv": x.numpy()})[0])
    max_diff = max(max_diff, float(np.abs(t - o).max()))

print(f"onnx saved: {onnx_path} ({onnx_path.stat().st_size/1024:.0f} KB)")
print(f"max abs diff (torch vs onnx), 5 windows: {max_diff:.2e}")
print("PARITY OK" if max_diff < 1e-4 else "PARITY FAIL")

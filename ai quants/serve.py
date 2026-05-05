"""FastAPI inference service for all trained option-pricing surrogates.

Run:
    uvicorn serve:app --reload --port 8000

LAZYBULL Next.js calls these endpoints from /lib/pricing.ts.
"""
from __future__ import annotations
from pathlib import Path
from typing import Literal
import json
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import torch
from shared.model import load_surrogate, predict
from shared.market_data import fetch
from shared.features import make_features
from shared.macro import fetch_macro

ROOT = Path(__file__).resolve().parent
WEIGHTS = ROOT / "weights"

app = FastAPI(title="LAZYBULL Quant AI", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)

# load all models at startup
MODELS: dict[str, tuple] = {}
for name in ["bs_surrogate", "iv_surrogate", "mc_surrogate", "american_surrogate", "heston_surrogate"]:
    try:
        MODELS[name] = load_surrogate(WEIGHTS, name)
        print(f"loaded {name}")
    except FileNotFoundError:
        print(f"skip {name} (no weights yet)")

# load direction ensemble (list of (kind, sklearn_model) tuples)
DIRECTION_ENSEMBLE = None
DIRECTION_META = None
if (WEIGHTS / "direction_ensemble.pkl").exists():
    DIRECTION_ENSEMBLE = joblib.load(WEIGHTS / "direction_ensemble.pkl")
    DIRECTION_META = json.loads((WEIGHTS / "direction_ensemble.json").read_text())
    print(f"loaded direction_ensemble ({len(DIRECTION_ENSEMBLE)} models, "
          f"horizon={DIRECTION_META['horizon']}d)")

# load magnitude ensemble (regression)
MAGNITUDE_MODELS = None
if (WEIGHTS / "magnitude_ensemble.pkl").exists():
    MAGNITUDE_MODELS = joblib.load(WEIGHTS / "magnitude_ensemble.pkl")
    print(f"loaded magnitude_ensemble ({len(MAGNITUDE_MODELS)} regressors)")

# load magnitude+macro ensemble
MAGNITUDE_MACRO_MODELS = None
if (WEIGHTS / "magnitude_macro_ensemble.pkl").exists():
    MAGNITUDE_MACRO_MODELS = joblib.load(WEIGHTS / "magnitude_macro_ensemble.pkl")
    print(f"loaded magnitude_macro_ensemble ({len(MAGNITUDE_MACRO_MODELS)} regressors)")

# load 1D CNN sequence model
SEQ_CNN = None
if (WEIGHTS / "sequence_cnn.pt").exists():
    from models.sequence.train import CNN1D
    SEQ_CNN = CNN1D()
    SEQ_CNN.load_state_dict(torch.load(WEIGHTS / "sequence_cnn.pt", map_location="cpu"))
    SEQ_CNN.eval()
    print("loaded sequence_cnn (1D CNN)")

# load Transformer (252-day lookback)
TRANSFORMER = None
if (WEIGHTS / "transformer_seq.pt").exists():
    from models.transformer.train import TransformerSeq, LOOKBACK as TXR_LOOKBACK
    TRANSFORMER = TransformerSeq()
    TRANSFORMER.load_state_dict(torch.load(WEIGHTS / "transformer_seq.pt", map_location="cpu"))
    TRANSFORMER.eval()
    print(f"loaded transformer (lookback={TXR_LOOKBACK})")

# load triple-barrier ensemble
TRIPLE_BARRIER = None
if (WEIGHTS / "triple_barrier_ensemble.pkl").exists():
    TRIPLE_BARRIER = joblib.load(WEIGHTS / "triple_barrier_ensemble.pkl")
    print(f"loaded triple_barrier ({len(TRIPLE_BARRIER)} models)")

# load stacked meta-learner
STACKED = None
if (WEIGHTS / "stacked_models.pkl").exists():
    STACKED = joblib.load(WEIGHTS / "stacked_models.pkl")
    if (WEIGHTS / "stacked_seq_cnn.pt").exists():
        from models.sequence.train import CNN1D as _CNN
        STACKED["seq_cnn"] = _CNN()
        STACKED["seq_cnn"].load_state_dict(torch.load(WEIGHTS / "stacked_seq_cnn.pt", map_location="cpu"))
        STACKED["seq_cnn"].eval()
    print("loaded stacked meta-learner")

# load quantile (p10/p50/p90)
QUANTILE = None
if (WEIGHTS / "quantile_models.pkl").exists():
    QUANTILE = joblib.load(WEIGHTS / "quantile_models.pkl")
    print(f"loaded quantile_models ({list(QUANTILE.keys())})")


# ---------- request models ----------
class BSReq(BaseModel):
    S: float = Field(..., description="spot price")
    K: float = Field(..., description="strike")
    T: float = Field(..., description="time to expiry in years")
    r: float = Field(..., description="risk-free rate (e.g. 0.05)")
    sigma: float = Field(..., description="implied volatility (e.g. 0.2)")
    flag: Literal["c", "p"] = "c"


class IVReq(BaseModel):
    price: float
    S: float
    K: float
    T: float
    r: float
    flag: Literal["c", "p"] = "c"


class HestonReq(BaseModel):
    S: float; K: float; T: float; r: float
    v0: float; kappa: float; theta: float; xi: float; rho: float
    flag: Literal["c", "p"] = "c"


# ---------- helpers ----------
def _bs_features(req: BSReq) -> np.ndarray:
    is_call = 1.0 if req.flag == "c" else 0.0
    return np.array([[req.S, req.K, req.T, req.r, req.sigma, is_call,
                      np.log(req.K / req.S), np.sqrt(req.T), req.sigma * np.sqrt(req.T)]],
                    dtype=np.float32)


# ---------- endpoints ----------
@app.get("/health")
def health():
    return {"ok": True, "loaded": list(MODELS.keys())}


@app.post("/api/bs")
def bs(req: BSReq):
    model, xs, ys, _ = MODELS["bs_surrogate"]
    out = predict(model, xs, ys, _bs_features(req))[0]
    return {"price": float(out[0]), "delta": float(out[1]), "gamma": float(out[2]),
            "vega": float(out[3]), "theta": float(out[4]), "rho": float(out[5])}


@app.post("/api/mc")
def mc(req: BSReq):
    model, xs, ys, _ = MODELS["mc_surrogate"]
    out = predict(model, xs, ys, _bs_features(req))[0]
    return {"price": float(out[0])}


@app.post("/api/american")
def american(req: BSReq):
    model, xs, ys, _ = MODELS["american_surrogate"]
    out = predict(model, xs, ys, _bs_features(req))[0]
    return {"price": float(out[0])}


@app.post("/api/iv")
def iv(req: IVReq):
    model, xs, ys, _ = MODELS["iv_surrogate"]
    is_call = 1.0 if req.flag == "c" else 0.0
    X = np.array([[req.price, req.S, req.K, req.T, req.r, is_call,
                   np.log(req.K / req.S), np.sqrt(req.T), req.price / req.S]],
                 dtype=np.float32)
    out = predict(model, xs, ys, X)[0]
    return {"sigma": float(out[0])}


class DirectionReq(BaseModel):
    ticker: str = Field(..., description="e.g. SPY, AAPL")
    period: str = Field("2y", description="yfinance period for historical fetch")


@app.post("/api/direction")
def direction(req: DirectionReq):
    """Predict next-20-day direction using ensemble (mean of model probabilities)."""
    if DIRECTION_ENSEMBLE is None:
        raise HTTPException(503, "direction ensemble not trained")
    df = fetch(req.ticker.upper(), period=req.period)
    if len(df) < 250:
        raise HTTPException(400, f"need >=250 bars, got {len(df)}")
    X, _, idx = make_features(df, horizon=DIRECTION_META["horizon"])
    if len(X) == 0:
        raise HTTPException(400, "no usable feature rows")
    last_x = X[-1:].astype(np.float32)
    last_date = str(idx[-1].date())
    # Use only h=20 models for the published prediction
    h20_models = [m for kind, m in DIRECTION_ENSEMBLE if kind == "gbm20"] or [m for _, m in DIRECTION_ENSEMBLE]
    probs = np.array([m.predict_proba(last_x)[0, 1] for m in h20_models])
    p_up = float(probs.mean())
    p_std = float(probs.std())
    thr = DIRECTION_META["decision_threshold"]
    conviction = abs(p_up - thr)
    label = "up" if p_up > thr else "down"
    band = "ultra" if conviction > 0.20 else ("extreme" if conviction > 0.15 else
            ("high" if conviction > 0.07 else "low"))
    exp_acc = (
        DIRECTION_META["metrics"]["ultra_conv_accuracy"] if band == "ultra"
        else DIRECTION_META["metrics"]["extreme_conv_accuracy"] if band == "extreme"
        else DIRECTION_META["metrics"]["high_conv_accuracy"] if band == "high"
        else DIRECTION_META["metrics"]["accuracy"]
    )
    return {
        "ticker": req.ticker.upper(),
        "as_of": last_date,
        "horizon_days": DIRECTION_META["horizon"],
        "p_up": p_up,
        "ensemble_std": p_std,
        "ensemble_size": len(h20_models),
        "decision_threshold": thr,
        "prediction": label,
        "conviction_band": band,
        "expected_accuracy": exp_acc,
    }


@app.post("/api/magnitude")
def magnitude(req: DirectionReq):
    """Predict expected 20d return (regression). Sign = direction; abs = conviction."""
    if MAGNITUDE_MODELS is None:
        raise HTTPException(503, "magnitude model not trained")
    df = fetch(req.ticker.upper(), period=req.period)
    if len(df) < 250:
        raise HTTPException(400, f"need >=250 bars, got {len(df)}")
    X, _, idx = make_features(df, horizon=20)
    if len(X) == 0:
        raise HTTPException(400, "no usable feature rows")
    last_x = X[-1:].astype(np.float32)
    preds = np.array([m.predict(last_x)[0] for m in MAGNITUDE_MODELS])
    expected_return = float(preds.mean())
    p_std = float(preds.std())
    direction = "up" if expected_return > 0 else "down"
    abs_mag = abs(expected_return)
    if abs_mag > 0.07:
        band, exp_acc = "ultra", 0.66
    elif abs_mag > 0.045:
        band, exp_acc = "extreme", 0.64
    elif abs_mag > 0.027:
        band, exp_acc = "high", 0.61
    elif abs_mag > 0.015:
        band, exp_acc = "medium", 0.60
    else:
        band, exp_acc = "low", 0.555
    return {
        "ticker": req.ticker.upper(),
        "as_of": str(idx[-1].date()),
        "horizon_days": 20,
        "expected_return": expected_return,
        "ensemble_std": p_std,
        "direction": direction,
        "magnitude_band": band,
        "expected_dir_accuracy": exp_acc,
    }


@app.post("/api/sequence")
def sequence_pred(req: DirectionReq):
    """Predict 20d return using 1D CNN on raw 60-day OHLCV window."""
    if SEQ_CNN is None:
        raise HTTPException(503, "sequence CNN not trained")
    df = fetch(req.ticker.upper(), period=req.period)
    if len(df) < 80:
        raise HTTPException(400, f"need >=80 bars, got {len(df)}")
    ohlcv = df[["Open", "High", "Low", "Close", "Volume"]].astype(float).values[-60:]
    cprice = ohlcv[-1, 3]
    cvol = ohlcv[:, 4].mean() + 1e-9
    norm = ohlcv.copy()
    norm[:, 0:4] = norm[:, 0:4] / cprice
    norm[:, 4] = norm[:, 4] / cvol
    x = torch.from_numpy(norm.astype(np.float32)).unsqueeze(0)
    with torch.no_grad():
        pred = float(SEQ_CNN(x).item())
    return {
        "ticker": req.ticker.upper(),
        "as_of": str(df.index[-1].date()),
        "horizon_days": 20,
        "expected_return": pred,
        "direction": "up" if pred > 0 else "down",
    }


@app.post("/api/transformer")
def transformer_pred(req: DirectionReq):
    """Predict 20d return using Transformer encoder on 252-day OHLCV."""
    if TRANSFORMER is None:
        raise HTTPException(503, "transformer not trained")
    df = fetch(req.ticker.upper(), period=req.period)
    if len(df) < 270:
        raise HTTPException(400, f"need >=270 bars, got {len(df)}")
    ohlcv = df[["Open", "High", "Low", "Close", "Volume"]].astype(float).values[-252:]
    cprice = ohlcv[-1, 3]
    cvol = ohlcv[:, 4].mean() + 1e-9
    norm = ohlcv.copy()
    norm[:, 0:4] = norm[:, 0:4] / cprice
    norm[:, 4] = norm[:, 4] / cvol
    x = torch.from_numpy(norm.astype(np.float32)).unsqueeze(0)
    with torch.no_grad():
        pred = float(TRANSFORMER(x).item())
    return {
        "ticker": req.ticker.upper(),
        "as_of": str(df.index[-1].date()),
        "horizon_days": 20,
        "expected_return": pred,
        "direction": "up" if pred > 0 else "down",
    }


@app.post("/api/quantile")
def quantile_pred(req: DirectionReq):
    """Return p10, p50, p90 forecast of 20d return — natural confidence intervals."""
    if QUANTILE is None:
        raise HTTPException(503, "quantile model not trained")
    df = fetch(req.ticker.upper(), period=req.period)
    if len(df) < 250:
        raise HTTPException(400, f"need >=250 bars")
    X, _, idx = make_features(df, horizon=20)
    if len(X) == 0:
        raise HTTPException(400, "no usable rows")
    macro = fetch_macro(period=req.period).ffill().reindex(idx).ffill().values
    last_x = np.concatenate([X[-1:], macro[-1:].astype(np.float32)], axis=1).astype(np.float32)
    p10 = float(QUANTILE[0.1].predict(last_x)[0])
    p50 = float(QUANTILE[0.5].predict(last_x)[0])
    p90 = float(QUANTILE[0.9].predict(last_x)[0])
    decision = "long" if p10 > 0 else ("short" if p90 < 0 else "flat")
    return {
        "ticker": req.ticker.upper(),
        "as_of": str(idx[-1].date()),
        "p10": p10, "p50": p50, "p90": p90,
        "uncertainty_width": p90 - p10,
        "decision": decision,
    }


@app.post("/api/consensus")
def consensus(req: DirectionReq):
    """All 6 production models + agreement-weighted confidence score.

    Models: binary GBM, magnitude regression, mag+macro, sequence CNN, transformer, quantile.
    Consensus tier:
      - "ultra"  = all signed-direction models agree AND |magnitude| in top 10%
      - "high"   = ≥5/6 agree
      - "medium" = ≥4/6 agree
      - "low"    = otherwise
    """
    out = {"ticker": req.ticker.upper(), "models": {}}
    votes, magnitudes = [], []
    if DIRECTION_ENSEMBLE is not None:
        d = direction(req)
        out["models"]["binary"] = d
        votes.append(1 if d["prediction"] == "up" else -1)
    if MAGNITUDE_MODELS is not None:
        m = magnitude(req)
        out["models"]["magnitude"] = m
        votes.append(int(np.sign(m["expected_return"])))
        magnitudes.append(abs(m["expected_return"]))
    if SEQ_CNN is not None:
        s = sequence_pred(req)
        out["models"]["sequence"] = s
        votes.append(int(np.sign(s["expected_return"])))
        magnitudes.append(abs(s["expected_return"]))
    if TRANSFORMER is not None:
        t = transformer_pred(req)
        out["models"]["transformer"] = t
        votes.append(int(np.sign(t["expected_return"])))
        magnitudes.append(abs(t["expected_return"]))
    if QUANTILE is not None:
        q = quantile_pred(req)
        out["models"]["quantile"] = q
        votes.append(int(np.sign(q["p50"])))
    # tally
    n = len(votes)
    agree_votes = sum(1 for v in votes if v == 1) if sum(votes) > 0 else sum(1 for v in votes if v == -1)
    direction_label = "up" if sum(votes) > 0 else "down" if sum(votes) < 0 else "split"
    avg_mag = float(np.mean(magnitudes)) if magnitudes else 0.0
    if agree_votes == n and avg_mag > 0.04:
        tier = "ultra"
    elif agree_votes >= n - 1:
        tier = "high"
    elif agree_votes >= n - 2:
        tier = "medium"
    else:
        tier = "low"
    out["consensus"] = {
        "n_models": n,
        "agree_count": agree_votes,
        "direction": direction_label,
        "avg_magnitude": avg_mag,
        "tier": tier,
        "expected_accuracy_band": {
            "ultra": "65-77%", "high": "60-66%", "medium": "55-60%", "low": "≤55%",
        }[tier],
    }
    return out


@app.post("/api/heston")
def heston(req: HestonReq):
    model, xs, ys, _ = MODELS["heston_surrogate"]
    is_call = 1.0 if req.flag == "c" else 0.0
    X = np.array([[req.S, req.K, req.T, req.r, req.v0, req.kappa, req.theta,
                   req.xi, req.rho, is_call, np.log(req.K / req.S), np.sqrt(req.T)]],
                 dtype=np.float32)
    out = predict(model, xs, ys, X)[0]
    return {"price": float(out[0])}

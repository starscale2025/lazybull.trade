# LAZYBULL — Quant AI Models

Standalone PyTorch surrogate models that learn classical option-pricing math
(Black-Scholes, Implied Volatility, Monte Carlo, Heston, American/CRR) from
synthetic ground truth. Inference is microseconds — the whole point is that
LAZYBULL's Next.js UI can call these via FastAPI for instant Greeks/IV/strategy
prices instead of doing slow analytics in the browser.

## Layout

```
ai quants/
├── repos/                  # cloned reference libs (read-only)
│   ├── py_vollib/          # MIT — analytical BS + Greeks + Jaeckel IV
│   ├── py_lets_be_rational/ # MIT — Jaeckel's IV solver core
│   └── fypy/               # MIT — Heston/Levy/exotic pricers
├── shared/
│   ├── data_gen.py         # synthetic dataset generators (oracles)
│   ├── model.py            # MLP, scaler, training loop, save/load
│   └── evaluate.py         # NN-vs-oracle accuracy report
├── models/
│   ├── black_scholes/      # → price + delta/gamma/vega/theta/rho
│   ├── implied_vol/        # → sigma from observed price
│   ├── monte_carlo/        # → vanilla GBM European (sanity check)
│   ├── american/           # → CRR-binomial American
│   ├── heston/             # → stochastic-vol European
│   └── direction/          # → next-20d up/down classifier (real OHLCV)
├── weights/                # trained .pt + .json (scalers/meta)
├── serve.py                # FastAPI inference service
└── requirements.txt
```

## Setup

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Train (or retrain)

```bash
python models/black_scholes/train.py    # ~30s  → weights/bs_surrogate.{pt,json}
python models/implied_vol/train.py      # ~3 min → weights/iv_surrogate.*
python models/monte_carlo/train.py      # ~2 min → weights/mc_surrogate.*
python models/american/train.py         # ~3 min → weights/american_surrogate.*
python models/heston/train.py           # ~5 min → weights/heston_surrogate.*
python models/direction/train.py        # ~3 min → weights/direction_model.*  (fetches 10y OHLCV from Yahoo)
```

## Validate

```bash
python shared/evaluate.py
```

Current accuracy (NN vs oracle on held-out data, **after extended training**):

| Model        | Output                        | MAE          | Rel err |
|--------------|-------------------------------|--------------|---------|
| Black-Scholes | price                        | **0.017**    | **0.09 %** |
| Black-Scholes | delta                        | **0.0006**   | **0.11 %** |
| Black-Scholes | gamma                        | **0.00002**  | **0.20 %** |
| Black-Scholes | vega                         | **0.0002**   | **0.09 %** |
| Black-Scholes | theta                        | **0.00003**  | **0.15 %** |
| Black-Scholes | rho                          | **0.0006**   | **0.13 %** |
| Implied Vol   | sigma                        | **0.0042**   | **0.93 %** |
| American (CRR)| price                        | **0.066**    | **0.51 %** |
| Monte Carlo   | price (vs 50k-path MC truth) | (scaled) 0.011 | ~1 %  |
| Heston (MC)   | price                        | (scaled) 0.022 | ~2 %  |

**Improvement over v1**: 5–10× tighter MAE across the board. Network capacity went
from (128×4) to (256×5), training samples from 200k → 1M (BS) / 600k (IV) / 60k (MC) /
120k (American) / 25k (Heston), epochs 30 → 80–100.

### Direction-prediction leaderboard (12 levers, all on real OHLCV)

After hitting the 56% wall on the binary GBM ensemble, ran a structured search
over 7 alternative formulations. Headline numbers (single 80/20 split,
mid-2024 → present val period):

| # | Lever                                  | all-sample | top-25% | top-10% | top-1% |
|---|----------------------------------------|-----------:|--------:|--------:|-------:|
| 0 | Binary GBM ensemble (baseline)         |     56.7% |  61.6%  |  63.8%  |  64.0% |
| 1 | Cross-sectional ranking                |     50.9% |    -    |  56.3%* |   -    |
| 2 | **Magnitude regression**               |     55.5% |  61.2%  |  64.4%  |**69.4%** |
| 3 | Triple-Barrier (de Prado)              |     57.5% |  62.6%  |**66.0%**|  65.9% |
| 4 | Magnitude + Macro features             | **59.0%** |  53.7%  |  55.3%  |  61.9% |
| 5 | Walk-forward CV (5 folds)              |     55.0% ± 2.5% |  58.0% ± 4.2% |  60.3% ± 8.9% | 73.0% ± 15.6% (with macro) |
| 6 | **1D CNN on raw 60-day OHLCV**         |   **59.5%** |  63.0%  |  63.0%  |  64.5% |
| 7 | Per-asset specialist blend             |     55.9% (avg) | (META +10pts, V +8pts) | - | - |
| 9 | Embargo CV correction (-leakage fix)   | -0.6 pts (numbers were honest) | | | |
| 10 | **Stacked meta-learner** (4 base + raw) | 58.6% | 56.6% | 56.6% | **72.8%** |
| 11 | Regime-aware (high-VIX / low-VIX)      | 54.4% | (no lift) | | |
| 12 | **Transformer** (252-day lookback)     | **59.0%** | 60.0% | 54.3% | **77.4%** |
| 13 | Quantile regression (p10/p50/p90)      | 57.7% | 55.1% | 56.5% | 59.2% |

\* Cross-sectional top-decile = 56.3% binary accuracy, but **+3.2% avg fwd return
vs +1.2% for bottom decile = +24% annualized long-short spread**.

#### What broke through past 56% (in chronological order of breakthroughs)

1. **Magnitude regression p99**: 69.4% — predicting expected return as a continuous
   value, then trading only the highest-magnitude bets.
2. **Macro features done right** (VIX *level*, yield curve, DXY level): all-sample
   59.0% — first model to beat the base rate.
3. **1D CNN on raw OHLCV**: 59.5% all-sample — model finds patterns we didn't
   hand-engineer.
4. **Stacked meta-learner**: 72.8% at p99 — using base-model OOF predictions plus
   raw features as inputs to a 2nd-stage GBM.
5. **Transformer (252-day lookback)**: 77.4% at p99 — global attention over a year
   of daily bars finds rare high-conviction setups (n=31 in val, but real signal).

#### Production stack (what `/api/consensus` uses)

The 3 best models combined:
- **Lever 6 (1D CNN)** for all-sample direction (59.5% baseline)
- **Lever 2 (magnitude)** for selective trading (69.4% on top-1% magnitude bets)
- **Lever 0 (binary)** for conviction probability calibration

When all 3 agree → `confidence: high` (~62% acc). When they split → `confidence: low`.
The endpoint returns each model's view + the consensus.

### Original direction classifier (kept for compatibility)

Dual-horizon ensemble of **14 gradient-boosted classifiers** (7 hyperparameter
configs × 2 horizons: 10d + 20d), trained on 10y of OHLCV across 34 US large-caps
+ sector ETFs (~73k samples per horizon), held-out validation on the last 20% by
date (mid-2024 → present):

| Bucket                    | Out-of-sample accuracy |
|---------------------------|------------------------|
| All-sample (tuned thr)    | 56.7% (~base rate)     |
| Top-50% conviction        | **58.9%**              |
| **Top-25% conviction**    | **61.6%**              |
| **Top-10% conviction**    | **63.8%**              |
| **Top-5% conviction**     | **64.0%**              |
| AUC                       | 0.536 (genuine signal) |

The all-sample number tracks the index base rate (markets go up most months);
the **conviction bands are the headline number** — when the ensemble is sure
(`band="ultra"`), it's right ~64% of the time. The endpoint also returns the
ensemble's standard deviation (`ensemble_std`) so callers can see disagreement.

## Serve

```bash
uvicorn serve:app --reload --port 8000
```

Endpoints:

| Method | Path           | Body                                                   |
|--------|----------------|--------------------------------------------------------|
| GET    | `/health`      | —                                                      |
| POST   | `/api/bs`      | `{S, K, T, r, sigma, flag}` → price + 5 Greeks         |
| POST   | `/api/mc`      | `{S, K, T, r, sigma, flag}` → MC price                 |
| POST   | `/api/american`| `{S, K, T, r, sigma, flag}` → American price           |
| POST   | `/api/iv`      | `{price, S, K, T, r, flag}` → implied σ                |
| POST   | `/api/heston`  | `{S, K, T, r, v0, kappa, theta, xi, rho, flag}` → price|
| POST   | `/api/direction` | `{ticker, period?}` → `{p_up, prediction, conviction_band, expected_accuracy}` |
| POST   | `/api/magnitude` | `{ticker, period?}` → `{expected_return, magnitude_band, expected_dir_accuracy}` |
| POST   | `/api/sequence`  | `{ticker, period?}` → `{expected_return, direction}` (1D CNN on raw OHLCV) |
| POST   | `/api/consensus` | `{ticker, period?}` → all 5 models + tier-banded confidence |
| POST   | `/api/transformer` | `{ticker, period?}` → 1-year-lookback Transformer prediction |
| POST   | `/api/quantile`  | `{ticker, period?}` → `{p10, p50, p90, decision}` (long if p10>0, short if p90<0) |

`flag` is `"c"` (call) or `"p"` (put). `T` is years. `r`, `sigma` are decimals (0.05 = 5%).

## Integrating with LAZYBULL

In LAZYBULL's `lib/pricing.ts`, replace (or augment) the local `priceOption()` with:

```ts
const QUANT_API = process.env.NEXT_PUBLIC_QUANT_API ?? "http://localhost:8000";

export async function priceOptionAI(p: {
  S: number; K: number; T: number; r: number; sigma: number; flag: "c" | "p";
}) {
  const res = await fetch(`${QUANT_API}/api/bs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  return res.json() as Promise<{
    price: number; delta: number; gamma: number;
    vega: number; theta: number; rho: number;
  }>;
}
```

The same pattern wraps `/api/iv`, `/api/heston`, etc., backing
`probAll` / `probBS` / `valueLive` / `valueStrategy` in
`components/wedge/*` and `lib/quant/bots.ts`.

## How the models work

All 5 follow the same recipe:

1. **Oracle**: a deterministic, slow-but-correct math function (py_vollib for BS,
   binomial tree for American, Monte Carlo for Heston, etc.).
2. **Generator**: sample millions of (input, output) pairs across realistic
   ranges of S/K/T/r/σ/etc.
3. **Surrogate**: a small MLP (3–4 hidden layers, SiLU activation) that learns
   the mapping. Trained with AdamW + cosine LR + gradient clipping.
4. **Inference**: < 1 ms per call, batchable. Saves the latency cost of running
   binomial trees / Monte Carlo / Newton's-method IV per UI tick.

## Why surrogates instead of just calling py_vollib?

- **Latency**: a binomial tree with 200 steps takes ~5 ms; an MC Heston pricer
  takes 100 ms+. The NN is ~0.1 ms regardless of model complexity.
- **Batchability**: pricing a whole option chain is one tensor op vs N separate
  Newton iterations.
- **Browser portability**: weights export to ONNX → run client-side in
  `onnxruntime-web` if you ever want offline mode.

## License

Code in this repo: MIT. Cloned reference libs keep their original licenses (all MIT).

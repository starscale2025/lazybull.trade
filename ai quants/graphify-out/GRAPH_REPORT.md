# Graph Report - /Users/shaurya555/Desktop/ai quants  (2026-05-04)

## Corpus Check
- 35 files · ~25,578 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 285 nodes · 547 edges · 17 communities detected
- Extraction: 73% EXTRACTED · 27% INFERRED · 0% AMBIGUOUS · INFERRED: 150 edges (avg confidence: 0.83)
- Token cost: 148,865 input · 12,944 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Direction Lever Search Concepts|Direction Lever Search Concepts]]
- [[_COMMUNITY_Pricing Surrogate Trainers|Pricing Surrogate Trainers]]
- [[_COMMUNITY_Cross-Sectional & Magnitude Models|Cross-Sectional & Magnitude Models]]
- [[_COMMUNITY_Feature Engineering Helpers|Feature Engineering Helpers]]
- [[_COMMUNITY_FastAPI Request Schemas|FastAPI Request Schemas]]
- [[_COMMUNITY_Synthetic Data Oracles|Synthetic Data Oracles]]
- [[_COMMUNITY_FastAPI Pricing Endpoints|FastAPI Pricing Endpoints]]
- [[_COMMUNITY_Magnitude + Macro Walk-Forward|Magnitude + Macro Walk-Forward]]
- [[_COMMUNITY_Oracle-Surrogate Recipe Concepts|Oracle-Surrogate Recipe Concepts]]
- [[_COMMUNITY_Regime-Aware Models|Regime-Aware Models]]
- [[_COMMUNITY_Triple-Barrier Labels|Triple-Barrier Labels]]
- [[_COMMUNITY_Direction Classifier Ensemble|Direction Classifier Ensemble]]
- [[_COMMUNITY_Leaderboard|Leaderboard]]
- [[_COMMUNITY_Feature Names Constant|Feature Names Constant]]
- [[_COMMUNITY_FastAPI Dependency|FastAPI Dependency]]
- [[_COMMUNITY_Pandas Dependency|Pandas Dependency]]
- [[_COMMUNITY_NumPy Dependency|NumPy Dependency]]

## God Nodes (most connected - your core abstractions)
1. `make_features()` - 36 edges
2. `fetch_basket()` - 32 edges
3. `predict()` - 19 edges
4. `train_surrogate()` - 17 edges
5. `fetch()` - 16 edges
6. `fetch_macro()` - 14 edges
7. `LAZYBULL README` - 14 edges
8. `embargo_split()` - 12 edges
9. `load_surrogate()` - 11 edges
10. `CNN1D` - 11 edges

## Surprising Connections (you probably didn't know these)
- `features_matrix()` --semantically_similar_to--> `_bs_features helper`  [INFERRED] [semantically similar]
  shared/data_gen.py → serve.py
- `Quantile Regression Trainer (Lever 13)` --references--> `Lever 13 Quantile Regression`  [INFERRED]
  models/quantile/train.py → README.md
- `Black-Scholes Surrogate Trainer` --references--> `py_vollib 1.0.1`  [INFERRED]
  models/black_scholes/train.py → requirements.txt
- `Transformer Sequence Trainer (Lever 12)` --references--> `Lever 12 Transformer 252-day`  [INFERRED]
  models/transformer/train.py → README.md
- `Cross-Sectional Ranking Trainer (Lever 1)` --references--> `Lever 1 Cross-Sectional Ranking`  [INFERRED]
  models/cross_sectional/train.py → README.md

## Hyperedges (group relationships)
- **NN-surrogate pricing pipeline** — data_gen_make_bs_dataset, model_train_surrogate, model_load_surrogate, serve_bs [INFERRED 0.95]
- **Multi-model direction consensus** — serve_direction, serve_magnitude, serve_sequence_pred, serve_transformer_pred, serve_quantile_pred, serve_consensus [EXTRACTED 1.00]
- **Honest embargo cross-validation flow** — honest_eval_build, embargo_split, honest_eval_eval_model, walk_forward_splits [INFERRED 0.85]
- **Direction Forecasting Lever Search (12 Levers)** — train_direction_main, train_crosssectional_main, train_magnitude_main, train_triplebarrier_main, train_sequence_main, train_perasset_main, train_stacked_main, train_regime_main, train_transformer_main, train_quantile_main [EXTRACTED 1.00]
- **Option Pricing NN Surrogates** — train_bs_main, train_iv_main, train_montecarlo_main, train_american_main, shared_model_trainsurrogate, concept_oracle_surrogate_recipe [INFERRED 0.95]
- **Stacked Meta-Learner Base Models** — train_stacked_main, train_direction_main, train_magnitude_main, train_sequence_cnn1d, shared_macro_fetchmacro [EXTRACTED 1.00]

## Communities

### Community 0 - "Direction Lever Search Concepts"
Cohesion: 0.06
Nodes (51): main(), Train an American option pricer surrogate using CRR binomial tree as ground trut, main(), Inference + ground-truth validation for the BS surrogate., main(), Train a neural Black-Scholes surrogate that predicts price + 5 Greeks., Oracle-to-Surrogate NN Recipe, evaluate.report (+43 more)

### Community 1 - "Pricing Surrogate Trainers"
Cohesion: 0.08
Nodes (46): de Prado Triple-Barrier Method, Embargo Time-Series Split, High-Conviction Subset Strategy, HistGradientBoosting Ensemble Pattern, US Large-Cap 34-Ticker Basket, /api/consensus 3-Model Consensus, fypy reference library (Heston/Levy), LAZYBULL README (+38 more)

### Community 2 - "Cross-Sectional & Magnitude Models"
Cohesion: 0.1
Nodes (30): consensus(), direction(), magnitude(), quantile_pred(), Predict next-20-day direction using ensemble (mean of model probabilities)., Predict expected 20d return (regression). Sign = direction; abs = conviction., Predict 20d return using 1D CNN on raw 60-day OHLCV window., Predict 20d return using Transformer encoder on 252-day OHLCV. (+22 more)

### Community 3 - "Feature Engineering Helpers"
Cohesion: 0.12
Nodes (19): BSReq, DirectionReq, HestonReq, IVReq, BaseModel, build_sequences(), CNN1D, main() (+11 more)

### Community 4 - "FastAPI Request Schemas"
Cohesion: 0.1
Nodes (19): load_all(), Final production consensus.  Best by tier (from honest embargo CV val):   - All-, honest_eval.build (basket+macro builder), leaderboard.main (unified accuracy table), build(), main(), Lever 13 — Quantile regression.  Predict p10, p50, p90 of forward return. Trade, FastAPI App (LAZYBULL Quant AI) (+11 more)

### Community 5 - "Synthetic Data Oracles"
Cohesion: 0.29
Nodes (17): _add_macro_features(), _build_panel(), _conviction_buckets(), exp1_cross_sectional(), exp2_magnitude_regression(), exp3_triple_barrier(), exp4_macro(), exp5_walk_forward() (+9 more)

### Community 6 - "FastAPI Pricing Endpoints"
Cohesion: 0.18
Nodes (14): american(), bs(), _bs_features(), heston(), iv(), mc(), FastAPI inference service for all trained option-pricing surrogates.  Run:     u, POST /api/american endpoint (+6 more)

### Community 7 - "Magnitude + Macro Walk-Forward"
Cohesion: 0.15
Nodes (14): TICKERS basket (35 symbols), magnitude_macro/train.main, magnitude_macro/walk_forward_eval.build, magnitude_macro/walk_forward_eval.run, build_dataset(), main(), Lever 2+4 — Magnitude regression WITH macro features.  Same model as magnitude/,, build() (+6 more)

### Community 8 - "Oracle-Surrogate Recipe Concepts"
Cohesion: 0.24
Nodes (9): build_per_ticker(), main(), Lever 7 — Per-asset specialist models.  Train one magnitude regressor per ticker, train_one(), build_dataset(), main(), Lever 3 — Triple-Barrier labels (de Prado, "Advances in Financial ML").  Instead, For each date t, look forward up to max_horizon days. Return:        +1 if pct c (+1 more)

### Community 9 - "Regime-Aware Models"
Cohesion: 0.53
Nodes (5): build(), main(), Lever 11 — Regime-aware split.  Train two models — one for high-VIX regime, one, report(), train_ensemble()

### Community 10 - "Triple-Barrier Labels"
Cohesion: 0.47
Nodes (5): build_dataset(), main(), Beefed direction classifier: more tickers, cross-asset context features, ensembl, Train two ensembles (10d and 20d horizon) and use BOTH for high-conviction., _train_ensemble()

### Community 11 - "Direction Classifier Ensemble"
Cohesion: 0.5
Nodes (4): build_panel(), main(), Lever 1 — Cross-sectional ranking.  Reframe the problem: instead of "will AAPL g, Build a long-form panel: rows are (date, ticker), columns are features + label.

### Community 12 - "Leaderboard"
Cohesion: 0.67
Nodes (1): Unified leaderboard: head-to-head accuracy of all direction-related models.

### Community 15 - "Feature Names Constant"
Cohesion: 1.0
Nodes (1): FEATURE_NAMES list

### Community 16 - "FastAPI Dependency"
Cohesion: 1.0
Nodes (1): fastapi 0.136.1

### Community 17 - "Pandas Dependency"
Cohesion: 1.0
Nodes (1): pandas 3.0.2

### Community 18 - "NumPy Dependency"
Cohesion: 1.0
Nodes (1): numpy 2.4.4

## Knowledge Gaps
- **69 isolated node(s):** `FastAPI inference service for all trained option-pricing surrogates.  Run:     u`, `Predict next-20-day direction using ensemble (mean of model probabilities).`, `Predict expected 20d return (regression). Sign = direction; abs = conviction.`, `Predict 20d return using 1D CNN on raw 60-day OHLCV window.`, `Predict 20d return using Transformer encoder on 252-day OHLCV.` (+64 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Leaderboard`** (3 nodes): `main()`, `leaderboard.py`, `Unified leaderboard: head-to-head accuracy of all direction-related models.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Feature Names Constant`** (1 nodes): `FEATURE_NAMES list`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `FastAPI Dependency`** (1 nodes): `fastapi 0.136.1`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pandas Dependency`** (1 nodes): `pandas 3.0.2`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `NumPy Dependency`** (1 nodes): `numpy 2.4.4`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `make_features()` connect `Cross-Sectional & Magnitude Models` to `Direction Lever Search Concepts`, `Pricing Surrogate Trainers`, `Feature Engineering Helpers`, `FastAPI Request Schemas`, `Synthetic Data Oracles`, `Magnitude + Macro Walk-Forward`, `Oracle-Surrogate Recipe Concepts`, `Regime-Aware Models`, `Triple-Barrier Labels`, `Direction Classifier Ensemble`?**
  _High betweenness centrality (0.408) - this node is a cross-community bridge._
- **Why does `features_matrix()` connect `Direction Lever Search Concepts` to `Cross-Sectional & Magnitude Models`, `FastAPI Pricing Endpoints`?**
  _High betweenness centrality (0.255) - this node is a cross-community bridge._
- **Why does `fetch_basket()` connect `Synthetic Data Oracles` to `Pricing Surrogate Trainers`, `Cross-Sectional & Magnitude Models`, `Feature Engineering Helpers`, `FastAPI Request Schemas`, `Magnitude + Macro Walk-Forward`, `Oracle-Surrogate Recipe Concepts`, `Regime-Aware Models`, `Triple-Barrier Labels`, `Direction Classifier Ensemble`?**
  _High betweenness centrality (0.172) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `make_features()` (e.g. with `direction()` and `magnitude()`) actually correct?**
  _`make_features()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `fetch_basket()` (e.g. with `build()` and `build()`) actually correct?**
  _`fetch_basket()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `predict()` (e.g. with `bs()` and `mc()`) actually correct?**
  _`predict()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `train_surrogate()` (e.g. with `main()` and `main()`) actually correct?**
  _`train_surrogate()` has 4 INFERRED edges - model-reasoned connections that need verification._
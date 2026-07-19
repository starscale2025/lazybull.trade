# Graph Report - __tests__  (2026-07-20)

## Corpus Check
- Corpus is ~3,312 words - fits in a single context window. You may not need a graph.

## Summary
- 141 nodes · 174 edges · 11 communities detected
- Extraction: 71% EXTRACTED · 29% INFERRED · 0% AMBIGUOUS · INFERRED: 50 edges (avg confidence: 0.84)
- Token cost: 100,938 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Cinema Act Windows|Cinema Act Windows]]
- [[_COMMUNITY_Market Session State|Market Session State]]
- [[_COMMUNITY_Warmup & Non-Finite Guards|Warmup & Non-Finite Guards]]
- [[_COMMUNITY_Hurst Regime Estimation|Hurst Regime Estimation]]
- [[_COMMUNITY_Probability & Strike Safety|Probability & Strike Safety]]
- [[_COMMUNITY_Strategy Shape Detection|Strategy Shape Detection]]
- [[_COMMUNITY_Backtest P&L Accounting|Backtest P&L Accounting]]
- [[_COMMUNITY_Cinema 3D Layer Opacity|Cinema 3D Layer Opacity]]
- [[_COMMUNITY_Paper Account & Kill Switch|Paper Account & Kill Switch]]
- [[_COMMUNITY_Copy Beat Fade Ramp|Copy Beat Fade Ramp]]
- [[_COMMUNITY_Canvas Handoff Fade|Canvas Handoff Fade]]

## God Nodes (most connected - your core abstractions)
1. `detect` - 11 edges
2. `deriveMarketState` - 10 edges
3. `generateStrategies` - 8 edges
4. `ACTS` - 8 edges
5. `hurst` - 7 edges
6. `series() deterministic GBM-ish fixture` - 7 edges
7. `backtestLongOnly` - 6 edges
8. `describe: backtestLongOnly` - 6 edges
9. `clamp01 clamps and neutralizes non-finite input` - 6 edges
10. `macd` - 5 edges

## Surprising Connections (you probably didn't know these)
- `no longer returns the -6.59 outlier at the 65/66-bar boundary` --references--> `hurst`  [EXTRACTED]
  __tests__/quant-math.test.ts → lib/quant/series.ts
- `does not emit the fabricated first-bar crossover` --references--> `macd`  [EXTRACTED]
  __tests__/quant-math.test.ts → lib/quant/series.ts
- `matches hand-computed downside deviation` --references--> `sortino`  [EXTRACTED]
  __tests__/quant-math.test.ts → lib/quant/series.ts
- `long put max profit subtracts the premium paid` --references--> `generateStrategies`  [EXTRACTED]
  __tests__/strategy-math.test.ts → lib/models.ts
- `detects a long call` --references--> `detect`  [EXTRACTED]
  __tests__/detector.test.ts → lib/detector.ts

## Hyperedges (group relationships)
- **3D layer handoff choreography across the act timeline** — cinema_test_bull3dopacity_hands_off_before_homepage, cinema_test_dive3dopacity_clears_before_regime, cinema_test_candle3dopacity_clears_before_safety_copy, cinema_test_acts_cover_0_1_contiguously, cinema_test_copy_beats_inside_act_window [INFERRED 0.85]
- **NaN / non-finite containment at input boundaries** — cinema_test_clamp01_neutralizes_non_finite, quant_math_test_probbs_no_nan_non_positive_band, quant_math_test_strikes_finite_money_every_card, strategy_math_test_no_nan_anywhere, quant_math_test_hurst_stays_in_0_1, quant_math_test_macd_histogram_null_propagation [INFERRED 0.85]
- **Degenerate-input fallback to a safe documented default** — quant_math_test_hurst_degenerate_fallback, quant_math_test_sortino_empty_series, market_state_test_empty_meta_never_throws, market_state_test_no_periods_recency_fallback, material_hero_test_clamps_out_of_range_markers, safety_test_daily_loss_limit_clamps_negative [INFERRED 0.85]

## Communities

### Community 0 - "Cinema Act Windows"
Cohesion: 0.12
Nodes (20): ACTS, BULL3D window constants, CANDLE3D window constants, COPY_BEATS, DIVE3D window constants, flashOpacity, describe: ACTS, every act has positive width (+12 more)

### Community 1 - "Market Session State"
Cohesion: 0.14
Nodes (17): deriveMarketState, CLOSED before the pre session opens, CLOSED overnight/weekend, describe: deriveMarketState, empty meta never throws, honours an explicit provider state when present, POST inside the post session, PRE inside the pre session (+9 more)

### Community 2 - "Warmup & Non-Finite Guards"
Cohesion: 0.16
Nodes (14): clamp01 clamps and neutralizes non-finite input, no trading periods: recent trade => REGULAR, stale => CLOSED, clamps out-of-range markers, describe: splitLayers, splits lines into behind/front by the marker index, splitLayers, hurst falls back to 0.5 on degenerate input, describe: macd (+6 more)

### Community 3 - "Hurst Regime Estimation"
Cohesion: 0.2
Nodes (14): falls back to Custom for unknown shape, describe: buildColumns, buildColumns is deterministic for a given seed, keeps phase and speed in sane ranges, buildColumns, describe: hurst, centres a random walk near 0.5 instead of the old ~0.19, the documented RANDOM regime is actually reachable (+6 more)

### Community 4 - "Probability & Strike Safety"
Cohesion: 0.21
Nodes (14): ACT_ORDER, acts cover [0,1] contiguously in ACT_ORDER, describe: strategy detector, generateStrategies, probBS, Leg, describe: probBS input clamping, probBS never returns NaN for a non-positive band (+6 more)

### Community 5 - "Strategy Shape Detection"
Cohesion: 0.27
Nodes (10): detect, detects bull call spread, detects bull put spread, detects iron butterfly when middle strikes coincide, detects iron condor (4 legs, condor shape), detects a long put, detects long straddle (same strike, long both), detects long strangle (different strikes, long both) (+2 more)

### Community 6 - "Backtest P&L Accounting"
Cohesion: 0.36
Nodes (9): describe: backtestLongOnly, multi-bar +10% trade returns +10%, multi-bar loss is exact, one-bar trade unchanged, still counts trades and win rate at trade level, two sequential trades compound correctly, matches hand-computed downside deviation, backtestLongOnly (+1 more)

### Community 7 - "Cinema 3D Layer Opacity"
Cohesion: 0.22
Nodes (9): bull3dOpacity, candle3dOpacity, clamp01, dive3dOpacity, describe: bull3dOpacity, bull3dOpacity fades in, holds opaque, then dissolves out, describe: candle3dOpacity, describe: clamp01 (+1 more)

### Community 8 - "Paper Account & Kill Switch"
Cohesion: 0.29
Nodes (8): detects a long call, trigger fires when realized loss exceeds limit, paper.close updates realizedToday, paper.open subtracts cost and adds position, describe: safety + kill switch, triggerKillSwitch, usePaper, useSafety

### Community 10 - "Copy Beat Fade Ramp"
Cohesion: 0.5
Nodes (4): beatOpacity, describe: beatOpacity, beatOpacity ramps over the fade width and plateaus at 1, beatOpacity is 0 outside the window (inclusive edges)

### Community 12 - "Canvas Handoff Fade"
Cohesion: 0.67
Nodes (3): canvasOpacity, describe: canvasOpacity, canvasOpacity holds 1 almost to the end, then a short crossfade to 0

## Knowledge Gaps
- **34 isolated node(s):** `ACT_ORDER`, `describe: ACTS`, `every act has positive width`, `describe: COPY_BEATS`, `describe: clamp01` (+29 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `clamp01 clamps and neutralizes non-finite input` connect `Warmup & Non-Finite Guards` to `Hurst Regime Estimation`, `Probability & Strike Safety`, `Cinema 3D Layer Opacity`?**
  _High betweenness centrality (0.167) - this node is a cross-community bridge._
- **Why does `generateStrategies` connect `Probability & Strike Safety` to `Strategy Shape Detection`, `Backtest P&L Accounting`?**
  _High betweenness centrality (0.164) - this node is a cross-community bridge._
- **Why does `hurst` connect `Hurst Regime Estimation` to `Market Session State`, `Warmup & Non-Finite Guards`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **What connects `ACT_ORDER`, `describe: ACTS`, `every act has positive width` to the rest of the system?**
  _34 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Cinema Act Windows` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
- **Should `Market Session State` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
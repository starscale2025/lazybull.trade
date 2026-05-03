# Graph Report - /Users/shaurya555/Desktop/lazybull1  (2026-05-03)

## Corpus Check
- 81 files · ~60,922 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 531 nodes · 665 edges · 45 communities detected
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.82)
- Token cost: 88,638 input · 15,642 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Strategy & Math Internals|Strategy & Math Internals]]
- [[_COMMUNITY_Quant Bot Catalog|Quant Bot Catalog]]
- [[_COMMUNITY_Pro Chart Engine|Pro Chart Engine]]
- [[_COMMUNITY_Chart Overlays & Indicators|Chart Overlays & Indicators]]
- [[_COMMUNITY_Quant UI Components|Quant UI Components]]
- [[_COMMUNITY_Bot Cell & Series Helpers|Bot Cell & Series Helpers]]
- [[_COMMUNITY_Trade Page UI & AI Teacher|Trade Page UI & AI Teacher]]
- [[_COMMUNITY_Wedge Position Tools|Wedge Position Tools]]
- [[_COMMUNITY_Product Concepts & Thesis|Product Concepts & Thesis]]
- [[_COMMUNITY_Pricing Models & Events|Pricing Models & Events]]
- [[_COMMUNITY_Probability Models|Probability Models]]
- [[_COMMUNITY_Quant Page Container|Quant Page Container]]
- [[_COMMUNITY_Pro Page Bottom Controls|Pro Page Bottom Controls]]
- [[_COMMUNITY_Greek Icons & Teacher|Greek Icons & Teacher]]
- [[_COMMUNITY_Quote API & Workspace State|Quote API & Workspace State]]
- [[_COMMUNITY_Trading Safety System|Trading Safety System]]
- [[_COMMUNITY_Options Strategy Card|Options Strategy Card]]
- [[_COMMUNITY_Market Events Timeline|Market Events Timeline]]
- [[_COMMUNITY_Root Layout & Theme|Root Layout & Theme]]
- [[_COMMUNITY_Project Documentation|Project Documentation]]
- [[_COMMUNITY_Symbol Search API|Symbol Search API]]
- [[_COMMUNITY_Store Helpers|Store Helpers]]
- [[_COMMUNITY_Marketing Components|Marketing Components]]
- [[_COMMUNITY_Pro Constants|Pro Constants]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Random Bar Generation|Random Bar Generation]]
- [[_COMMUNITY_Bottom Bar (orphan)|Bottom Bar (orphan)]]
- [[_COMMUNITY_Replay Bar (orphan)|Replay Bar (orphan)]]
- [[_COMMUNITY_Greek Key Type|Greek Key Type]]
- [[_COMMUNITY_Positions Panel (orphan)|Positions Panel (orphan)]]
- [[_COMMUNITY_Theme Store|Theme Store]]
- [[_COMMUNITY_Teacher Store|Teacher Store]]
- [[_COMMUNITY_Nearest Event Helper|Nearest Event Helper]]
- [[_COMMUNITY_Last Change Helper|Last Change Helper]]
- [[_COMMUNITY_Project README|Project README]]
- [[_COMMUNITY_File Icon Asset|File Icon Asset]]
- [[_COMMUNITY_Vercel Logo|Vercel Logo]]
- [[_COMMUNITY_Next.js Logo|Next.js Logo]]
- [[_COMMUNITY_Globe Icon Asset|Globe Icon Asset]]
- [[_COMMUNITY_Window Icon Asset|Window Icon Asset]]
- [[_COMMUNITY_Run Row Type|Run Row Type]]
- [[_COMMUNITY_Custom Bot Input Type|Custom Bot Input Type]]
- [[_COMMUNITY_Bot Context Type|Bot Context Type]]
- [[_COMMUNITY_Metric Type|Metric Type]]
- [[_COMMUNITY_Log Returns Helper|Log Returns Helper]]

## God Nodes (most connected - your core abstractions)
1. `Chart` - 26 edges
2. `BotDef interface` - 17 edges
3. `QuantPage` - 16 edges
4. `priceOption Black-Scholes` - 12 edges
5. `priceOption()` - 11 edges
6. `GreekMeta` - 9 edges
7. `BotCell` - 9 edges
8. `probAll()` - 8 edges
9. `probAll` - 8 edges
10. `backtestLongOnly` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Next.js Agent Rules (breaking changes notice)` --rationale_for--> `RootLayout — global app shell with fonts`  [INFERRED]
  AGENTS.md → app/layout.tsx
- `valueStrategy()` --calls--> `priceOption()`  [INFERRED]
  components/wedge/TimeMachine.tsx → lib/pricing.ts
- `getDef()` --calls--> `getBot()`  [INFERRED]
  components/quant/QuantPage.tsx → lib/quant/bots.ts
- `valueLive()` --calls--> `priceOption()`  [INFERRED]
  components/wedge/ManagePanel.tsx → lib/pricing.ts
- `Home page composition (landing)` --references--> `Footer — landing site footer with disclaimer`  [EXTRACTED]
  app/page.tsx → components/Footer.tsx

## Hyperedges (group relationships)
- **Landing page composition (Home → Hero → Partners → SocialProof → Footer)** — page_home, hero_hero, partners_partners, socialproof_socialproof, footer_footer, nav_nav [EXTRACTED 1.00]
- **AI teacher narration flow (trade page → /api/explain → OpenAI fallback)** — trade_page_narrate, explain_route_post, explain_route_openai_call, explain_route_mockexplanation, concept_ai_teacher [INFERRED 0.85]
- **Yahoo Finance proxy data pipeline** — quote_route_get, quote_batch_route_get, symbol_search_route_get, yahoo_finance_chart_endpoint, yahoo_finance_search_endpoint [INFERRED 0.85]
- **Chart coordinate transform pipeline** — chart_chart, chartcore_xofbar, chartcore_yofprice, chartcore_barofx, chartcore_priceofy, chart_drawingshape [INFERRED 0.95]
- **AI Teacher Greek explainer system** — avatar_teacheravatar, speechbubble_greektrigger, speechbubble_greekchip, greekicons_greekmeta, optionschain_optionschain [INFERRED 0.85]
- **Pre-trade safety check pipeline** — strategycard_strategycard, pretrademodal_pretrademodal, killswitch_safetysettingsbutton, killswitch_killswitchoverlay [INFERRED 0.85]
- **Strategy card display pipeline** —  [INFERRED 0.85]
- **Zustand persisted client stores** —  [EXTRACTED 1.00]
- **Probability model implementations sharing ModelInput contract** —  [EXTRACTED 1.00]
- **Bot Registry — 15 BotDef implementations** — bots_smacrossover, bots_rsibot, bots_macdbot, bots_donchianbot, bots_bollbot, bots_zscorebot, bots_hurstbot, bots_kalmanbot, bots_linregbot, bots_kellybot, bots_varbot, bots_sharpebot, bots_bsbot, bots_ivcrushbot, bots_wheelbot, bots_botregistry, types_botdef [EXTRACTED 1.00]
- **Quant workbench 3-column workspace layout** — botlibrary_botlibrary, workspace_workspace, outputpanel_outputpanel, quantpage_quantpage [EXTRACTED 1.00]
- **Time-series math helpers shared across all bots** — series_closes, series_returns, series_logreturns, series_sma, series_ema, series_std, series_rollingstd, series_zscore, series_rsi, series_macd, series_bollinger, series_donchian, series_hurst, series_kalman, series_linregchannel, series_sharpe, series_sortino, series_maxdrawdown, series_makerand, series_makenorm, series_backtestlongonly, series_fmtpct, series_fmtnum, series_fmtmoney [EXTRACTED 1.00]

## Communities

### Community 0 - "Strategy & Math Internals"
Cohesion: 0.05
Nodes (43): Abramowitz & Stegun 26.2.17 normal CDF approximation, IV Crush Detector bot, detect strategy, sortByStrike helper, StrategyKind type, eventsFor, hash util, ManagePanel (+35 more)

### Community 1 - "Quant Bot Catalog"
Cohesion: 0.07
Nodes (42): Bollinger Bands bot, Black-Scholes Solver bot, Donchian Breakout bot, Hurst Exponent bot, Kalman Filter bot, Kelly Criterion bot, LinReg Channel bot, MACD Histogram bot (+34 more)

### Community 2 - "Pro Chart Engine"
Cohesion: 0.1
Nodes (32): dataPt(), newId(), onMouseDown(), onMouseLeave(), onMouseMove(), onMouseUp(), onWheel(), pickDrawing() (+24 more)

### Community 3 - "Chart Overlays & Indicators"
Cohesion: 0.07
Nodes (35): AlertsPanel, Alert, BBOverlay, Chart, DrawingShape, IchimokuOverlay, MacdPane, RsiPane (+27 more)

### Community 4 - "Quant UI Components"
Cohesion: 0.07
Nodes (34): BotCell, ParamControl, BotLibrary, BOT_REGISTRY, botsByCategory, getBot, Field helper, ImportBotModal (+26 more)

### Community 5 - "Bot Cell & Series Helpers"
Cohesion: 0.12
Nodes (24): PriceWithOverlay(), backtestLongOnly(), bollinger(), closes(), donchian(), ema(), fmtMoney(), fmtNum() (+16 more)

### Community 6 - "Trade Page UI & AI Teacher"
Cohesion: 0.08
Nodes (10): GreekChip(), GreekTrigger(), CandleChart(), SocialProof(), TickerBar(), UseCases(), generateCandles(), lastChange() (+2 more)

### Community 7 - "Wedge Position Tools"
Cohesion: 0.09
Nodes (14): midPrice(), ncdf(), ndf(), payoff(), pnlCurve(), pnlSummary(), priceOption(), recommendation() (+6 more)

### Community 8 - "Product Concepts & Thesis"
Cohesion: 0.09
Nodes (26): CandleChart — SVG OHLC + close-line chart, MiniSpark — small line sparkline, AI teacher explains Greeks/strategies in plain English, Paper-only / training-wheels / kill-switch safety model, Synthetic live-spot random-walk for UI liveness, Visual options chain (drag to build) product thesis, mk(): Leg factory helper, Strategy Detector Test Suite (+18 more)

### Community 9 - "Pricing Models & Events"
Cohesion: 0.1
Nodes (23): Black-Scholes options pricing model, Box-Muller normal sampling, generateCandles, mulberry32 PRNG, eventTone, MarketEvent type, EventTimeline, Legend subcomponent (+15 more)

### Community 10 - "Probability Models"
Cohesion: 0.16
Nodes (18): biasFromThesis(), generateStrategies(), histRet(), ncdf(), pnlAt(), probAll(), probBS(), probEmpirical() (+10 more)

### Community 11 - "Quant Page Container"
Cohesion: 0.13
Nodes (9): getBot(), ImportBotModal(), addBot(), getDef(), importBot(), runOne(), updateParams(), compileCustomBot() (+1 more)

### Community 12 - "Pro Page Bottom Controls"
Cohesion: 0.17
Nodes (8): BottomBar(), onCompare(), onKey(), redo(), saveWorkspace(), showToast(), undo(), ReplayBar()

### Community 13 - "Greek Icons & Teacher"
Cohesion: 0.15
Nodes (15): TeacherAvatar, Drag-select Options Chain, IV Heatmap, DeltaIcon, GammaIcon, GreekMeta, IvIcon, RhoIcon (+7 more)

### Community 14 - "Quote API & Workspace State"
Cohesion: 0.24
Nodes (9): Workspace persistence + base64 share-link mechanism, PaneChart — per-pane chart sub-component, ProPage — godmode trading workspace, Workspace state model (symbol/timeframe/drawings/...), fetchOne(), GET(), GET(), RANGE_INTERVAL timeframe map (+1 more)

### Community 15 - "Trading Safety System"
Cohesion: 0.22
Nodes (10): Paper Trading Safety Pipeline, KillSwitchOverlay, SafetySettingsButton, Toggle, PnLDiagram, DangerSimulation, PreTradeModal, explain (+2 more)

### Community 16 - "Options Strategy Card"
Cohesion: 0.25
Nodes (2): detect(), sortByStrike()

### Community 17 - "Market Events Timeline"
Cohesion: 0.36
Nodes (5): addDays(), eventsFor(), eventTone(), hash(), iso()

### Community 21 - "Root Layout & Theme"
Cohesion: 0.5
Nodes (1): ThemeProvider()

### Community 22 - "Project Documentation"
Cohesion: 0.5
Nodes (4): Next.js Agent Rules (breaking changes notice), Claude Project Instructions, RootLayout — global app shell with fonts, ThemeProvider — sets data-theme on <html>

### Community 23 - "Symbol Search API"
Cohesion: 0.67
Nodes (2): GET(), Yahoo Finance v1/finance/search endpoint

### Community 24 - "Store Helpers"
Cohesion: 1.0
Nodes (2): cellKey(), legId()

### Community 25 - "Marketing Components"
Cohesion: 0.67
Nodes (3): TickerBar, TradeOverview, UseCases

### Community 26 - "Pro Constants"
Cohesion: 0.67
Nodes (3): INDICATORS, SEED_SYMBOLS, TopBar

### Community 29 - "PostCSS Config"
Cohesion: 1.0
Nodes (1): @tailwindcss/postcss

### Community 30 - "Random Bar Generation"
Cohesion: 1.0
Nodes (2): genBars, mulberry32

### Community 49 - "Bottom Bar (orphan)"
Cohesion: 1.0
Nodes (1): BottomBar

### Community 50 - "Replay Bar (orphan)"
Cohesion: 1.0
Nodes (1): ReplayBar

### Community 51 - "Greek Key Type"
Cohesion: 1.0
Nodes (1): GreekKey

### Community 52 - "Positions Panel (orphan)"
Cohesion: 1.0
Nodes (1): PositionsPanel

### Community 53 - "Theme Store"
Cohesion: 1.0
Nodes (1): useTheme zustand store

### Community 54 - "Teacher Store"
Cohesion: 1.0
Nodes (1): useTeacher zustand store

### Community 55 - "Nearest Event Helper"
Cohesion: 1.0
Nodes (1): nearestEvent

### Community 56 - "Last Change Helper"
Cohesion: 1.0
Nodes (1): lastChange

### Community 57 - "Project README"
Cohesion: 1.0
Nodes (1): LAZYBULL Project README (Next.js bootstrap)

### Community 58 - "File Icon Asset"
Cohesion: 1.0
Nodes (1): File Document Icon

### Community 59 - "Vercel Logo"
Cohesion: 1.0
Nodes (1): Vercel Logo SVG

### Community 60 - "Next.js Logo"
Cohesion: 1.0
Nodes (1): Next.js Logo

### Community 61 - "Globe Icon Asset"
Cohesion: 1.0
Nodes (1): Globe Icon

### Community 62 - "Window Icon Asset"
Cohesion: 1.0
Nodes (1): Window Icon

### Community 63 - "Run Row Type"
Cohesion: 1.0
Nodes (1): RunRow type

### Community 64 - "Custom Bot Input Type"
Cohesion: 1.0
Nodes (1): CustomBotInput type

### Community 65 - "Bot Context Type"
Cohesion: 1.0
Nodes (1): BotContext type

### Community 66 - "Metric Type"
Cohesion: 1.0
Nodes (1): Metric type

### Community 67 - "Log Returns Helper"
Cohesion: 1.0
Nodes (1): logReturns

## Knowledge Gaps
- **109 isolated node(s):** `@tailwindcss/postcss`, `Workspace state model (symbol/timeframe/drawings/...)`, `Workspace persistence + base64 share-link mechanism`, `ThesisLine — highlights price/date in sentence`, `ProbabilityRing — circular prob indicator` (+104 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Options Strategy Card`** (9 nodes): `StrategyCard.tsx`, `detect()`, `sortByStrike()`, `detector.ts`, `explain()`, `fmt()`, `placeTrade()`, `mk()`, `detector.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Root Layout & Theme`** (4 nodes): `RootLayout()`, `layout.tsx`, `ThemeProvider()`, `ThemeProvider.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Symbol Search API`** (3 nodes): `route.ts`, `GET()`, `Yahoo Finance v1/finance/search endpoint`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Store Helpers`** (3 nodes): `cellKey()`, `legId()`, `stores.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `PostCSS Config`** (2 nodes): `postcss.config.mjs`, `@tailwindcss/postcss`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Random Bar Generation`** (2 nodes): `genBars`, `mulberry32`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Bottom Bar (orphan)`** (1 nodes): `BottomBar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Replay Bar (orphan)`** (1 nodes): `ReplayBar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Greek Key Type`** (1 nodes): `GreekKey`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Positions Panel (orphan)`** (1 nodes): `PositionsPanel`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Store`** (1 nodes): `useTheme zustand store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Teacher Store`** (1 nodes): `useTeacher zustand store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Nearest Event Helper`** (1 nodes): `nearestEvent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Last Change Helper`** (1 nodes): `lastChange`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Project README`** (1 nodes): `LAZYBULL Project README (Next.js bootstrap)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Icon Asset`** (1 nodes): `File Document Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vercel Logo`** (1 nodes): `Vercel Logo SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next.js Logo`** (1 nodes): `Next.js Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Globe Icon Asset`** (1 nodes): `Globe Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Window Icon Asset`** (1 nodes): `Window Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Run Row Type`** (1 nodes): `RunRow type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Custom Bot Input Type`** (1 nodes): `CustomBotInput type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Bot Context Type`** (1 nodes): `BotContext type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Metric Type`** (1 nodes): `Metric type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Log Returns Helper`** (1 nodes): `logReturns`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `QuantPage` connect `Quant UI Components` to `Pricing Models & Events`?**
  _High betweenness centrality (0.200) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `QuantPage` (e.g. with `QuantHero` and `Workspace`) actually correct?**
  _`QuantPage` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `priceOption()` (e.g. with `valueLive()` and `valueStrategy()`) actually correct?**
  _`priceOption()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@tailwindcss/postcss`, `Workspace state model (symbol/timeframe/drawings/...)`, `Workspace persistence + base64 share-link mechanism` to the rest of the system?**
  _109 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Strategy & Math Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Quant Bot Catalog` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Pro Chart Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
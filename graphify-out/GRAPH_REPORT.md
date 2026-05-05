# Graph Report - /Users/shaurya555/Desktop/lazybull1  (2026-05-05)

## Corpus Check
- 98 files · ~102,316 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 645 nodes · 850 edges · 53 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 69 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Strategy & Math Internals|Strategy & Math Internals]]
- [[_COMMUNITY_Quant UI & Learn-Page Plan|Quant UI & Learn-Page Plan]]
- [[_COMMUNITY_Pro Chart Engine|Pro Chart Engine]]
- [[_COMMUNITY_Trade Page UI & AI Teacher|Trade Page UI & AI Teacher]]
- [[_COMMUNITY_Chart Overlays & Indicators|Chart Overlays & Indicators]]
- [[_COMMUNITY_Quant Bot Catalog|Quant Bot Catalog]]
- [[_COMMUNITY_Learn Pages & App Routes|Learn Pages & App Routes]]
- [[_COMMUNITY_Options Strategy Detector|Options Strategy Detector]]
- [[_COMMUNITY_Wedge & Options Chain Tools|Wedge & Options Chain Tools]]
- [[_COMMUNITY_AI Bots FastAPI Wrapper|AI Bots FastAPI Wrapper]]
- [[_COMMUNITY_Quant Page Container|Quant Page Container]]
- [[_COMMUNITY_About Page & Team|About Page & Team]]
- [[_COMMUNITY_Probability Models (Wedge)|Probability Models (Wedge)]]
- [[_COMMUNITY_Pricing Models & Simulation|Pricing Models & Simulation]]
- [[_COMMUNITY_Pro Page Bottom Controls|Pro Page Bottom Controls]]
- [[_COMMUNITY_Hero & Candle Chart|Hero & Candle Chart]]
- [[_COMMUNITY_Greek Icons & Teacher Avatar|Greek Icons & Teacher Avatar]]
- [[_COMMUNITY_AI Bots Module (alt stem)|AI Bots Module (alt stem)]]
- [[_COMMUNITY_Quote API & Workspace State|Quote API & Workspace State]]
- [[_COMMUNITY_Pro Alerts & Trade Drawer|Pro Alerts & Trade Drawer]]
- [[_COMMUNITY_Trading Safety System|Trading Safety System]]
- [[_COMMUNITY_Market Events Timeline|Market Events Timeline]]
- [[_COMMUNITY_Probability Models (alt)|Probability Models (alt)]]
- [[_COMMUNITY_Root Layout & Theme|Root Layout & Theme]]
- [[_COMMUNITY_Project Documentation|Project Documentation]]
- [[_COMMUNITY_Symbol Search API|Symbol Search API]]
- [[_COMMUNITY_Store Helpers|Store Helpers]]
- [[_COMMUNITY_Marketing Components|Marketing Components]]
- [[_COMMUNITY_Pro Constants|Pro Constants]]
- [[_COMMUNITY_Shaurya Portrait (About)|Shaurya Portrait (About)]]
- [[_COMMUNITY_Joshmann Portrait (About)|Joshmann Portrait (About)]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Random Bar Generation|Random Bar Generation]]
- [[_COMMUNITY_Project Root Configs|Project Root Configs]]
- [[_COMMUNITY_Bottom Bar (orphan)|Bottom Bar (orphan)]]
- [[_COMMUNITY_Replay Bar (orphan)|Replay Bar (orphan)]]
- [[_COMMUNITY_Greek Key Type|Greek Key Type]]
- [[_COMMUNITY_Positions Panel (orphan)|Positions Panel (orphan)]]
- [[_COMMUNITY_Theme Store|Theme Store]]
- [[_COMMUNITY_Teacher Store|Teacher Store]]
- [[_COMMUNITY_Nearest Event Helper|Nearest Event Helper]]
- [[_COMMUNITY_Last Change Helper|Last Change Helper]]
- [[_COMMUNITY_Lazybull README Overview|Lazybull README Overview]]
- [[_COMMUNITY_File Icon Asset|File Icon Asset]]
- [[_COMMUNITY_Vercel Logo|Vercel Logo]]
- [[_COMMUNITY_Next.js Logo|Next.js Logo]]
- [[_COMMUNITY_Globe Icon Asset|Globe Icon Asset]]
- [[_COMMUNITY_Window Icon Asset|Window Icon Asset]]
- [[_COMMUNITY_Run Row Type|Run Row Type]]
- [[_COMMUNITY_Custom Bot Input Type|Custom Bot Input Type]]
- [[_COMMUNITY_Metric Type|Metric Type]]
- [[_COMMUNITY_Log Returns Helper|Log Returns Helper]]
- [[_COMMUNITY_Project README|Project README]]

## God Nodes (most connected - your core abstractions)
1. `Chart` - 26 edges
2. `BotDef type` - 26 edges
3. `QuantPage (workbench root)` - 23 edges
4. `BOT_REGISTRY array (all bots)` - 21 edges
5. `Learn page & per-bot pages — design plan` - 19 edges
6. `aiBot() factory` - 13 edges
7. `AI_BOTS array (12 bots)` - 13 edges
8. `FastAPI service (ai quants/serve.py)` - 13 edges
9. `priceOption Black-Scholes` - 12 edges
10. `priceOption()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `BotDef type` --semantically_similar_to--> `/learn/bots/[id] per-bot pages`  [INFERRED] [semantically similar]
  lib/quant/types.ts → docs/learn-page-plan.md
- `QuantPage.removeBotsByDefId` --semantically_similar_to--> `BotLibrary toggle bug fix`  [INFERRED] [semantically similar]
  components/quant/QuantPage.tsx → docs/learn-page-plan.md
- `QuantPage.flashLibrary (librarySpotlight flash)` --semantically_similar_to--> `Soft pointer banner (lb_quant_seen_v1)`  [INFERRED] [semantically similar]
  components/quant/QuantPage.tsx → docs/learn-page-plan.md
- `RootLayout — global app shell with fonts` --rationale_for--> `Next.js Agent Rules (breaking changes notice)`  [INFERRED]
  app/layout.tsx → AGENTS.md
- `BotCell (workspace cell)` --conceptually_related_to--> `Live demo (inline BotCell)`  [EXTRACTED]
  components/quant/BotCell.tsx → docs/learn-page-plan.md

## Communities

### Community 0 - "Strategy & Math Internals"
Cohesion: 0.06
Nodes (57): Abramowitz & Stegun 26.2.17 normal CDF approximation, Black-Scholes options pricing model, Bollinger Bands bot, BOT_REGISTRY array (all bots), Black-Scholes Solver bot, Donchian Breakout bot, getBot(), Hurst Exponent bot (+49 more)

### Community 1 - "Quant UI & Learn-Page Plan"
Cohesion: 0.05
Nodes (50): BotCell (workspace cell), BotCell.ParamControl, BotLibrary (sidebar), Field helper, ImportBotModal, BotLibrary toggle bug fix, Bring your own bot section, Workbench decluttering plan (+42 more)

### Community 2 - "Pro Chart Engine"
Cohesion: 0.09
Nodes (31): dataPt(), newId(), onMouseDown(), onMouseLeave(), onMouseMove(), onMouseUp(), onWheel(), pickDrawing() (+23 more)

### Community 3 - "Trade Page UI & AI Teacher"
Cohesion: 0.07
Nodes (22): AI teacher explains Greeks/strategies in plain English, Synthetic live-spot random-walk for UI liveness, mockExplanation(), OpenAI gpt-4o-mini chat call, POST(), addDays(), eventsFor(), eventTone() (+14 more)

### Community 4 - "Chart Overlays & Indicators"
Cohesion: 0.07
Nodes (35): AlertsPanel, Alert, BBOverlay, Chart, DrawingShape, IchimokuOverlay, MacdPane, RsiPane (+27 more)

### Community 5 - "Quant Bot Catalog"
Cohesion: 0.12
Nodes (24): PriceWithOverlay(), backtestLongOnly(), bollinger(), closes(), donchian(), ema(), fmtMoney(), fmtNum() (+16 more)

### Community 6 - "Learn Pages & App Routes"
Cohesion: 0.07
Nodes (10): GreekChip(), GreekTrigger(), TickerBar(), generateStaticParams(), map(), LearnLiveDemo(), priceChain(), getBotSource() (+2 more)

### Community 7 - "Options Strategy Detector"
Cohesion: 0.07
Nodes (30): detect strategy, sortByStrike helper, StrategyKind type, ManagePanel, recommendation, valueLive, Strategy type, PlainGreeks (+22 more)

### Community 8 - "Wedge & Options Chain Tools"
Cohesion: 0.09
Nodes (12): detect(), sortByStrike(), midPrice(), ncdf(), ndf(), payoff(), pnlCurve(), pnlSummary() (+4 more)

### Community 9 - "AI Bots FastAPI Wrapper"
Cohesion: 0.21
Nodes (23): aiBot() factory, AI_BOTS array (12 bots), American Pricer (NN) bot, API_BASE (FastAPI URL), bsRequest() helper, BS Surrogate (NN) bot, callApi() — POST to FastAPI, 6-Model Consensus bot (+15 more)

### Community 10 - "Quant Page Container"
Cohesion: 0.11
Nodes (9): getBot(), ImportBotModal(), addBot(), getDef(), importBot(), runOne(), updateParams(), compileCustomBot() (+1 more)

### Community 11 - "About Page & Team"
Cohesion: 0.1
Nodes (21): About page component, About.Counter (animated number), About.FounderPhoto, About.TimelineItem, AboutPage, CandleChart — SVG OHLC + close-line chart, MiniSpark — small line sparkline, Paper-only / training-wheels / kill-switch safety model (+13 more)

### Community 12 - "Probability Models (Wedge)"
Cohesion: 0.21
Nodes (15): biasFromThesis(), generateStrategies(), histRet(), ncdf(), pnlAt(), probAll(), probBS(), probEmpirical() (+7 more)

### Community 13 - "Pricing Models & Simulation"
Cohesion: 0.14
Nodes (16): Box-Muller normal sampling, generateCandles, mulberry32 PRNG, Heston stochastic volatility model, MODEL_META, ncdf normal CDF, probAll, probBS Black-Scholes (+8 more)

### Community 14 - "Pro Page Bottom Controls"
Cohesion: 0.17
Nodes (10): BottomBar(), onCompare(), onKey(), redo(), saveWorkspace(), showToast(), startReplay(), toggleFullscreen() (+2 more)

### Community 15 - "Hero & Candle Chart"
Cohesion: 0.17
Nodes (6): CandleChart(), SocialProof(), UseCases(), generateCandles(), lastChange(), mulberry32()

### Community 16 - "Greek Icons & Teacher Avatar"
Cohesion: 0.15
Nodes (15): TeacherAvatar, Drag-select Options Chain, IV Heatmap, DeltaIcon, GammaIcon, GreekMeta, IvIcon, RhoIcon (+7 more)

### Community 17 - "AI Bots Module (alt stem)"
Cohesion: 0.19
Nodes (5): bsRequest(), num(), statusMetric(), str(), withStatus()

### Community 18 - "Quote API & Workspace State"
Cohesion: 0.24
Nodes (9): Workspace persistence + base64 share-link mechanism, PaneChart — per-pane chart sub-component, ProPage — godmode trading workspace, Workspace state model (symbol/timeframe/drawings/...), fetchOne(), GET(), GET(), RANGE_INTERVAL timeframe map (+1 more)

### Community 19 - "Pro Alerts & Trade Drawer"
Cohesion: 0.2
Nodes (1): fmt()

### Community 20 - "Trading Safety System"
Cohesion: 0.22
Nodes (10): Paper Trading Safety Pipeline, KillSwitchOverlay, SafetySettingsButton, Toggle, PnLDiagram, DangerSimulation, PreTradeModal, explain (+2 more)

### Community 23 - "Market Events Timeline"
Cohesion: 0.4
Nodes (6): eventTone, MarketEvent type, EventTimeline, Legend subcomponent, ProbabilityCone, eventColor

### Community 24 - "Probability Models (alt)"
Cohesion: 0.4
Nodes (6): biasFromThesis, generateStrategies, midPrice helper, pnlAt expiry, probProfit MC, summarise (max P/L, breakevens)

### Community 25 - "Root Layout & Theme"
Cohesion: 0.5
Nodes (1): ThemeProvider()

### Community 26 - "Project Documentation"
Cohesion: 0.5
Nodes (4): Next.js Agent Rules (breaking changes notice), Claude Project Instructions, RootLayout — global app shell with fonts, ThemeProvider — sets data-theme on <html>

### Community 27 - "Symbol Search API"
Cohesion: 0.67
Nodes (2): GET(), Yahoo Finance v1/finance/search endpoint

### Community 28 - "Store Helpers"
Cohesion: 1.0
Nodes (2): cellKey(), legId()

### Community 29 - "Marketing Components"
Cohesion: 0.67
Nodes (3): TickerBar, TradeOverview, UseCases

### Community 30 - "Pro Constants"
Cohesion: 0.67
Nodes (3): INDICATORS, SEED_SYMBOLS, TopBar

### Community 31 - "Shaurya Portrait (About)"
Cohesion: 1.0
Nodes (3): About Page Team Headshot Usage, Shaurya (Team Member), Shaurya Portrait Headshot

### Community 32 - "Joshmann Portrait (About)"
Cohesion: 1.0
Nodes (3): About Page Team Headshot Usage, Josh Mann, Josh Mann Portrait

### Community 36 - "PostCSS Config"
Cohesion: 1.0
Nodes (1): @tailwindcss/postcss

### Community 37 - "Random Bar Generation"
Cohesion: 1.0
Nodes (2): genBars, mulberry32

### Community 40 - "Project Root Configs"
Cohesion: 1.0
Nodes (2): next.config.ts (empty config), TODO.md (Next.js dev fix tracker)

### Community 60 - "Bottom Bar (orphan)"
Cohesion: 1.0
Nodes (1): BottomBar

### Community 61 - "Replay Bar (orphan)"
Cohesion: 1.0
Nodes (1): ReplayBar

### Community 62 - "Greek Key Type"
Cohesion: 1.0
Nodes (1): GreekKey

### Community 63 - "Positions Panel (orphan)"
Cohesion: 1.0
Nodes (1): PositionsPanel

### Community 64 - "Theme Store"
Cohesion: 1.0
Nodes (1): useTheme zustand store

### Community 65 - "Teacher Store"
Cohesion: 1.0
Nodes (1): useTeacher zustand store

### Community 66 - "Nearest Event Helper"
Cohesion: 1.0
Nodes (1): nearestEvent

### Community 67 - "Last Change Helper"
Cohesion: 1.0
Nodes (1): lastChange

### Community 68 - "Lazybull README Overview"
Cohesion: 1.0
Nodes (1): LAZYBULL Project README (Next.js bootstrap)

### Community 69 - "File Icon Asset"
Cohesion: 1.0
Nodes (1): File Document Icon

### Community 70 - "Vercel Logo"
Cohesion: 1.0
Nodes (1): Vercel Logo SVG

### Community 71 - "Next.js Logo"
Cohesion: 1.0
Nodes (1): Next.js Logo

### Community 72 - "Globe Icon Asset"
Cohesion: 1.0
Nodes (1): Globe Icon

### Community 73 - "Window Icon Asset"
Cohesion: 1.0
Nodes (1): Window Icon

### Community 74 - "Run Row Type"
Cohesion: 1.0
Nodes (1): RunRow type

### Community 75 - "Custom Bot Input Type"
Cohesion: 1.0
Nodes (1): CustomBotInput type

### Community 76 - "Metric Type"
Cohesion: 1.0
Nodes (1): Metric type

### Community 77 - "Log Returns Helper"
Cohesion: 1.0
Nodes (1): logReturns

### Community 78 - "Project README"
Cohesion: 1.0
Nodes (1): README (Next.js bootstrap)

## Knowledge Gaps
- **123 isolated node(s):** `@tailwindcss/postcss`, `Workspace state model (symbol/timeframe/drawings/...)`, `Workspace persistence + base64 share-link mechanism`, `ThesisLine — highlights price/date in sentence`, `ProbabilityRing — circular prob indicator` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Pro Alerts & Trade Drawer`** (10 nodes): `AlertsPanel.tsx`, `RightPanel.tsx`, `TradeDrawer.tsx`, `add()`, `fmt()`, `addSym()`, `fetchQuotes()`, `findOldest()`, `removeSym()`, `place()`
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
- **Thin community `Project Root Configs`** (2 nodes): `next.config.ts (empty config)`, `TODO.md (Next.js dev fix tracker)`
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
- **Thin community `Lazybull README Overview`** (1 nodes): `LAZYBULL Project README (Next.js bootstrap)`
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
- **Thin community `Metric Type`** (1 nodes): `Metric type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Log Returns Helper`** (1 nodes): `logReturns`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Project README`** (1 nodes): `README (Next.js bootstrap)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `QuantPage (workbench root)` connect `Quant UI & Learn-Page Plan` to `Strategy & Math Internals`, `AI Bots FastAPI Wrapper`, `Pricing Models & Simulation`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **Why does `Nav (top navigation)` connect `About Page & Team` to `Quant UI & Learn-Page Plan`?**
  _High betweenness centrality (0.191) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `BotDef type` (e.g. with `QuantPage.runOne` and `/learn/bots/[id] per-bot pages`) actually correct?**
  _`BotDef type` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `QuantPage (workbench root)` (e.g. with `QuantHero` and `Workspace`) actually correct?**
  _`QuantPage (workbench root)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@tailwindcss/postcss`, `Workspace state model (symbol/timeframe/drawings/...)`, `Workspace persistence + base64 share-link mechanism` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Strategy & Math Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Quant UI & Learn-Page Plan` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
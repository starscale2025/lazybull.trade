# Graph Report - /Users/shaurya555/Desktop/lazybull1  (2026-05-08)

## Corpus Check
- 153 files · ~127,548 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 787 nodes · 1020 edges · 57 communities detected
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 86 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Strategy & Math Internals|Strategy & Math Internals]]
- [[_COMMUNITY_Pro Chart Engine|Pro Chart Engine]]
- [[_COMMUNITY_Quant UI & Learn-Page Plan|Quant UI & Learn-Page Plan]]
- [[_COMMUNITY_Ambient Motion & Speech|Ambient Motion & Speech]]
- [[_COMMUNITY_Quant Bot Catalog|Quant Bot Catalog]]
- [[_COMMUNITY_Options Strategy & Safety|Options Strategy & Safety]]
- [[_COMMUNITY_Hero & Atmosphere|Hero & Atmosphere]]
- [[_COMMUNITY_Chart Overlays|Chart Overlays]]
- [[_COMMUNITY_Strategy Detector|Strategy Detector]]
- [[_COMMUNITY_Trade Page UI & Teacher|Trade Page UI & Teacher]]
- [[_COMMUNITY_Mongo API Routes|Mongo API Routes]]
- [[_COMMUNITY_Admin Cockpit|Admin Cockpit]]
- [[_COMMUNITY_Pricing Models & Sim|Pricing Models & Sim]]
- [[_COMMUNITY_AI Bots FastAPI Wrapper|AI Bots FastAPI Wrapper]]
- [[_COMMUNITY_Quant Page Container|Quant Page Container]]
- [[_COMMUNITY_About Page & Team|About Page & Team]]
- [[_COMMUNITY_Probability Models (Wedge)|Probability Models (Wedge)]]
- [[_COMMUNITY_Pro Page Bottom|Pro Page Bottom]]
- [[_COMMUNITY_Greek Icons & Avatar|Greek Icons & Avatar]]
- [[_COMMUNITY_AI Bots Module (alt)|AI Bots Module (alt)]]
- [[_COMMUNITY_Quote API & Workspace|Quote API & Workspace]]
- [[_COMMUNITY_Trading Safety System|Trading Safety System]]
- [[_COMMUNITY_Root Layout & GSAP|Root Layout & GSAP]]
- [[_COMMUNITY_Probability Comparison Demo|Probability Comparison Demo]]
- [[_COMMUNITY_Regime Visualizer Demo|Regime Visualizer Demo]]
- [[_COMMUNITY_Probability Models (alt)|Probability Models (alt)]]
- [[_COMMUNITY_Vol Smile Demo|Vol Smile Demo]]
- [[_COMMUNITY_Project Documentation|Project Documentation]]
- [[_COMMUNITY_App Api Symbol Search Route Ts|App Api Symbol Search Route Ts]]
- [[_COMMUNITY_Lib Stores Cellkey|Lib Stores Cellkey]]
- [[_COMMUNITY_Tickerbar Tickerbar|Tickerbar Tickerbar]]
- [[_COMMUNITY_Topbar Indicators Const|Topbar Indicators Const]]
- [[_COMMUNITY_Shaurya About Usage|Shaurya About Usage]]
- [[_COMMUNITY_Joshmann About Usage|Joshmann About Usage]]
- [[_COMMUNITY_Lib Admin Adminemails|Lib Admin Adminemails]]
- [[_COMMUNITY_Postcss Config|Postcss Config]]
- [[_COMMUNITY_Chartcore Genbars|Chartcore Genbars]]
- [[_COMMUNITY_Nextconfig Default|Nextconfig Default]]
- [[_COMMUNITY_Bottombar Bottombar|Bottombar Bottombar]]
- [[_COMMUNITY_Replaybar Replaybar|Replaybar Replaybar]]
- [[_COMMUNITY_Greekicons Greekkey|Greekicons Greekkey]]
- [[_COMMUNITY_Positionspanel Positionspanel|Positionspanel Positionspanel]]
- [[_COMMUNITY_Stores Usetheme|Stores Usetheme]]
- [[_COMMUNITY_Stores Useteacher|Stores Useteacher]]
- [[_COMMUNITY_Events Nearestevent|Events Nearestevent]]
- [[_COMMUNITY_Candles Lastchange|Candles Lastchange]]
- [[_COMMUNITY_Readme Lazybull Overview|Readme Lazybull Overview]]
- [[_COMMUNITY_File Svg Icon|File Svg Icon]]
- [[_COMMUNITY_Vercel Svg Logo|Vercel Svg Logo]]
- [[_COMMUNITY_Next Svg Logo|Next Svg Logo]]
- [[_COMMUNITY_Globe Svg Icon|Globe Svg Icon]]
- [[_COMMUNITY_Window Svg Icon|Window Svg Icon]]
- [[_COMMUNITY_Outputpanel Runrow|Outputpanel Runrow]]
- [[_COMMUNITY_Runtime Custombotinput|Runtime Custombotinput]]
- [[_COMMUNITY_Types Metric|Types Metric]]
- [[_COMMUNITY_Series Logreturns|Series Logreturns]]
- [[_COMMUNITY_Readme Root|Readme Root]]

## God Nodes (most connected - your core abstractions)
1. `Chart` - 26 edges
2. `BotDef type` - 26 edges
3. `QuantPage (workbench root)` - 23 edges
4. `BOT_REGISTRY array (all bots)` - 21 edges
5. `Learn page & per-bot pages — design plan` - 19 edges
6. `db()` - 15 edges
7. `aiBot() factory` - 13 edges
8. `AI_BOTS array (12 bots)` - 13 edges
9. `FastAPI service (ai quants/serve.py)` - 13 edges
10. `priceOption Black-Scholes` - 12 edges

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
Nodes (56): Abramowitz & Stegun 26.2.17 normal CDF approximation, Bollinger Bands bot, BOT_REGISTRY array (all bots), Black-Scholes Solver bot, Donchian Breakout bot, getBot(), Hurst Exponent bot, IV Crush Detector bot (+48 more)

### Community 1 - "Pro Chart Engine"
Cohesion: 0.07
Nodes (32): dataPt(), newId(), onMouseDown(), onMouseLeave(), onMouseMove(), onMouseUp(), onWheel(), pickDrawing() (+24 more)

### Community 2 - "Quant UI & Learn-Page Plan"
Cohesion: 0.05
Nodes (50): BotCell (workspace cell), BotCell.ParamControl, BotLibrary (sidebar), Field helper, ImportBotModal, BotLibrary toggle bug fix, Bring your own bot section, Workbench decluttering plan (+42 more)

### Community 3 - "Ambient Motion & Speech"
Cohesion: 0.06
Nodes (14): GreekChip(), GreekTrigger(), BootSequence(), DataStreamRail(), LiveBadge(), ScrollProgressBar(), TickerBar(), generateStaticParams() (+6 more)

### Community 4 - "Quant Bot Catalog"
Cohesion: 0.1
Nodes (27): DecimatedNumber(), randomGlyph(), scrambleAll(), PriceWithOverlay(), backtestLongOnly(), bollinger(), closes(), donchian() (+19 more)

### Community 5 - "Options Strategy & Safety"
Cohesion: 0.07
Nodes (15): detect(), sortByStrike(), midPrice(), ncdf(), ndf(), payoff(), pnlCurve(), pnlSummary() (+7 more)

### Community 6 - "Hero & Atmosphere"
Cohesion: 0.07
Nodes (14): CountUp(), CursorSpotlight(), IntroSequence(), MagneticCTA(), ScrollProgress(), ScrollReveal(), SectionDivider(), TerminalTilt() (+6 more)

### Community 7 - "Chart Overlays"
Cohesion: 0.07
Nodes (35): AlertsPanel, Alert, BBOverlay, Chart, DrawingShape, IchimokuOverlay, MacdPane, RsiPane (+27 more)

### Community 8 - "Strategy Detector"
Cohesion: 0.07
Nodes (30): detect strategy, sortByStrike helper, StrategyKind type, ManagePanel, recommendation, valueLive, Strategy type, PlainGreeks (+22 more)

### Community 9 - "Trade Page UI & Teacher"
Cohesion: 0.09
Nodes (19): AI teacher explains Greeks/strategies in plain English, Synthetic live-spot random-walk for UI liveness, mockExplanation(), OpenAI gpt-4o-mini chat call, POST(), addDays(), eventsFor(), eventTone() (+11 more)

### Community 10 - "Mongo API Routes"
Cohesion: 0.15
Nodes (19): createWorkspace(), deleteWorkspace(), getPublicWorkspace(), getWorkspace(), listWorkspaces(), updateWorkspace(), GET(), DELETE() (+11 more)

### Community 11 - "Admin Cockpit"
Cohesion: 0.14
Nodes (15): CockpitTopBar(), KillSwitchPanel(), LiveEventStream(), RecentTrades(), geoDots(), healthSeries(), kpis(), mulberry32() (+7 more)

### Community 12 - "Pricing Models & Sim"
Cohesion: 0.1
Nodes (23): Black-Scholes options pricing model, Box-Muller normal sampling, generateCandles, mulberry32 PRNG, eventTone, MarketEvent type, EventTimeline, Legend subcomponent (+15 more)

### Community 13 - "AI Bots FastAPI Wrapper"
Cohesion: 0.21
Nodes (23): aiBot() factory, AI_BOTS array (12 bots), American Pricer (NN) bot, API_BASE (FastAPI URL), bsRequest() helper, BS Surrogate (NN) bot, callApi() — POST to FastAPI, 6-Model Consensus bot (+15 more)

### Community 14 - "Quant Page Container"
Cohesion: 0.11
Nodes (9): getBot(), ImportBotModal(), addBot(), getDef(), importBot(), runOne(), updateParams(), compileCustomBot() (+1 more)

### Community 15 - "About Page & Team"
Cohesion: 0.1
Nodes (21): About page component, About.Counter (animated number), About.FounderPhoto, About.TimelineItem, AboutPage, CandleChart — SVG OHLC + close-line chart, MiniSpark — small line sparkline, Paper-only / training-wheels / kill-switch safety model (+13 more)

### Community 16 - "Probability Models (Wedge)"
Cohesion: 0.21
Nodes (15): biasFromThesis(), generateStrategies(), histRet(), ncdf(), pnlAt(), probAll(), probBS(), probEmpirical() (+7 more)

### Community 17 - "Pro Page Bottom"
Cohesion: 0.17
Nodes (10): BottomBar(), onCompare(), onKey(), redo(), saveWorkspace(), showToast(), startReplay(), toggleFullscreen() (+2 more)

### Community 18 - "Greek Icons & Avatar"
Cohesion: 0.15
Nodes (15): TeacherAvatar, Drag-select Options Chain, IV Heatmap, DeltaIcon, GammaIcon, GreekMeta, IvIcon, RhoIcon (+7 more)

### Community 19 - "AI Bots Module (alt)"
Cohesion: 0.19
Nodes (5): bsRequest(), num(), statusMetric(), str(), withStatus()

### Community 20 - "Quote API & Workspace"
Cohesion: 0.24
Nodes (9): Workspace persistence + base64 share-link mechanism, PaneChart — per-pane chart sub-component, ProPage — godmode trading workspace, Workspace state model (symbol/timeframe/drawings/...), fetchOne(), GET(), GET(), RANGE_INTERVAL timeframe map (+1 more)

### Community 21 - "Trading Safety System"
Cohesion: 0.22
Nodes (10): Paper Trading Safety Pipeline, KillSwitchOverlay, SafetySettingsButton, Toggle, PnLDiagram, DangerSimulation, PreTradeModal, explain (+2 more)

### Community 22 - "Root Layout & GSAP"
Cohesion: 0.25
Nodes (3): GsapScroller(), SessionProvider(), ThemeProvider()

### Community 23 - "Probability Comparison Demo"
Cohesion: 0.29
Nodes (2): ncdf(), probBS()

### Community 26 - "Regime Visualizer Demo"
Cohesion: 0.33
Nodes (2): generateRegimeSeries(), mulberry32()

### Community 27 - "Probability Models (alt)"
Cohesion: 0.4
Nodes (6): biasFromThesis, generateStrategies, midPrice helper, pnlAt expiry, probProfit MC, summarise (max P/L, breakevens)

### Community 28 - "Vol Smile Demo"
Cohesion: 0.6
Nodes (3): smileIV(), xOf(), yOf()

### Community 29 - "Project Documentation"
Cohesion: 0.5
Nodes (4): Next.js Agent Rules (breaking changes notice), Claude Project Instructions, RootLayout — global app shell with fonts, ThemeProvider — sets data-theme on <html>

### Community 30 - "App Api Symbol Search Route Ts"
Cohesion: 0.67
Nodes (2): GET(), Yahoo Finance v1/finance/search endpoint

### Community 31 - "Lib Stores Cellkey"
Cohesion: 1.0
Nodes (2): cellKey(), legId()

### Community 32 - "Tickerbar Tickerbar"
Cohesion: 0.67
Nodes (3): TickerBar, TradeOverview, UseCases

### Community 33 - "Topbar Indicators Const"
Cohesion: 0.67
Nodes (3): INDICATORS, SEED_SYMBOLS, TopBar

### Community 34 - "Shaurya About Usage"
Cohesion: 1.0
Nodes (3): About Page Team Headshot Usage, Shaurya (Team Member), Shaurya Portrait Headshot

### Community 35 - "Joshmann About Usage"
Cohesion: 1.0
Nodes (3): About Page Team Headshot Usage, Josh Mann, Josh Mann Portrait

### Community 39 - "Lib Admin Adminemails"
Cohesion: 1.0
Nodes (2): adminEmails(), isAdmin()

### Community 42 - "Postcss Config"
Cohesion: 1.0
Nodes (1): @tailwindcss/postcss

### Community 43 - "Chartcore Genbars"
Cohesion: 1.0
Nodes (2): genBars, mulberry32

### Community 46 - "Nextconfig Default"
Cohesion: 1.0
Nodes (2): next.config.ts (empty config), TODO.md (Next.js dev fix tracker)

### Community 73 - "Bottombar Bottombar"
Cohesion: 1.0
Nodes (1): BottomBar

### Community 74 - "Replaybar Replaybar"
Cohesion: 1.0
Nodes (1): ReplayBar

### Community 75 - "Greekicons Greekkey"
Cohesion: 1.0
Nodes (1): GreekKey

### Community 76 - "Positionspanel Positionspanel"
Cohesion: 1.0
Nodes (1): PositionsPanel

### Community 77 - "Stores Usetheme"
Cohesion: 1.0
Nodes (1): useTheme zustand store

### Community 78 - "Stores Useteacher"
Cohesion: 1.0
Nodes (1): useTeacher zustand store

### Community 79 - "Events Nearestevent"
Cohesion: 1.0
Nodes (1): nearestEvent

### Community 80 - "Candles Lastchange"
Cohesion: 1.0
Nodes (1): lastChange

### Community 81 - "Readme Lazybull Overview"
Cohesion: 1.0
Nodes (1): LAZYBULL Project README (Next.js bootstrap)

### Community 82 - "File Svg Icon"
Cohesion: 1.0
Nodes (1): File Document Icon

### Community 83 - "Vercel Svg Logo"
Cohesion: 1.0
Nodes (1): Vercel Logo SVG

### Community 84 - "Next Svg Logo"
Cohesion: 1.0
Nodes (1): Next.js Logo

### Community 85 - "Globe Svg Icon"
Cohesion: 1.0
Nodes (1): Globe Icon

### Community 86 - "Window Svg Icon"
Cohesion: 1.0
Nodes (1): Window Icon

### Community 87 - "Outputpanel Runrow"
Cohesion: 1.0
Nodes (1): RunRow type

### Community 88 - "Runtime Custombotinput"
Cohesion: 1.0
Nodes (1): CustomBotInput type

### Community 89 - "Types Metric"
Cohesion: 1.0
Nodes (1): Metric type

### Community 90 - "Series Logreturns"
Cohesion: 1.0
Nodes (1): logReturns

### Community 91 - "Readme Root"
Cohesion: 1.0
Nodes (1): README (Next.js bootstrap)

## Knowledge Gaps
- **123 isolated node(s):** `@tailwindcss/postcss`, `Workspace state model (symbol/timeframe/drawings/...)`, `Workspace persistence + base64 share-link mechanism`, `ThesisLine — highlights price/date in sentence`, `ProbabilityRing — circular prob indicator` (+118 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Probability Comparison Demo`** (8 nodes): `LearnProbabilityComparison.tsx`, `density()`, `ncdf()`, `probBS()`, `probEmpirical()`, `probMC()`, `xOf()`, `yOf()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Regime Visualizer Demo`** (7 nodes): `LearnRegimeVisualizer.tsx`, `generateRegimeSeries()`, `mulberry32()`, `recommendedBot()`, `regimeLabel()`, `xOf()`, `yOf()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Api Symbol Search Route Ts`** (3 nodes): `route.ts`, `GET()`, `Yahoo Finance v1/finance/search endpoint`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Lib Stores Cellkey`** (3 nodes): `cellKey()`, `legId()`, `stores.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Lib Admin Adminemails`** (3 nodes): `adminEmails()`, `isAdmin()`, `admin.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Postcss Config`** (2 nodes): `postcss.config.mjs`, `@tailwindcss/postcss`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Chartcore Genbars`** (2 nodes): `genBars`, `mulberry32`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Nextconfig Default`** (2 nodes): `next.config.ts (empty config)`, `TODO.md (Next.js dev fix tracker)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Bottombar Bottombar`** (1 nodes): `BottomBar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Replaybar Replaybar`** (1 nodes): `ReplayBar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Greekicons Greekkey`** (1 nodes): `GreekKey`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Positionspanel Positionspanel`** (1 nodes): `PositionsPanel`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Stores Usetheme`** (1 nodes): `useTheme zustand store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Stores Useteacher`** (1 nodes): `useTeacher zustand store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Events Nearestevent`** (1 nodes): `nearestEvent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Candles Lastchange`** (1 nodes): `lastChange`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Readme Lazybull Overview`** (1 nodes): `LAZYBULL Project README (Next.js bootstrap)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `File Svg Icon`** (1 nodes): `File Document Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Vercel Svg Logo`** (1 nodes): `Vercel Logo SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Svg Logo`** (1 nodes): `Next.js Logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Globe Svg Icon`** (1 nodes): `Globe Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Window Svg Icon`** (1 nodes): `Window Icon`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Outputpanel Runrow`** (1 nodes): `RunRow type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Runtime Custombotinput`** (1 nodes): `CustomBotInput type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Types Metric`** (1 nodes): `Metric type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Series Logreturns`** (1 nodes): `logReturns`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Readme Root`** (1 nodes): `README (Next.js bootstrap)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `QuantPage (workbench root)` connect `Quant UI & Learn-Page Plan` to `Strategy & Math Internals`, `Pricing Models & Sim`, `AI Bots FastAPI Wrapper`?**
  _High betweenness centrality (0.158) - this node is a cross-community bridge._
- **Why does `Nav (top navigation)` connect `About Page & Team` to `Quant UI & Learn-Page Plan`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `BotDef type` (e.g. with `QuantPage.runOne` and `/learn/bots/[id] per-bot pages`) actually correct?**
  _`BotDef type` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `QuantPage (workbench root)` (e.g. with `QuantHero` and `Workspace`) actually correct?**
  _`QuantPage (workbench root)` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `@tailwindcss/postcss`, `Workspace state model (symbol/timeframe/drawings/...)`, `Workspace persistence + base64 share-link mechanism` to the rest of the system?**
  _123 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Strategy & Math Internals` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Pro Chart Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
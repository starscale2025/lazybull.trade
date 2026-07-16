# Graph Report - .  (2026-07-15)

## Corpus Check
- Large corpus: 493 files · ~2,172,644 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1295 nodes · 1689 edges · 98 communities detected
- Extraction: 86% EXTRACTED · 13% INFERRED · 1% AMBIGUOUS · INFERRED: 228 edges (avg confidence: 0.82)
- Token cost: 267,036 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Strategy & Market Positioning|Strategy & Market Positioning]]
- [[_COMMUNITY_Draco Decoder Vendor Internals|Draco Decoder Vendor Internals]]
- [[_COMMUNITY_Ambient UI Widgets|Ambient UI Widgets]]
- [[_COMMUNITY_Homepage & Atmosphere Shell|Homepage & Atmosphere Shell]]
- [[_COMMUNITY_Quant Math Engine|Quant Math Engine]]
- [[_COMMUNITY_API Routes & Data Proxies|API Routes & Data Proxies]]
- [[_COMMUNITY_Quant Workbench UI|Quant Workbench UI]]
- [[_COMMUNITY_Scroll Cinema Design Docs|Scroll Cinema Design Docs]]
- [[_COMMUNITY_Pro Charts Interactions|Pro Charts Interactions]]
- [[_COMMUNITY_Bot Registry & AI Bots|Bot Registry & AI Bots]]
- [[_COMMUNITY_Trade Chain UI|Trade Chain UI]]
- [[_COMMUNITY_Admin Mock Data|Admin Mock Data]]
- [[_COMMUNITY_Auth & Workspaces|Auth & Workspaces]]
- [[_COMMUNITY_Admin Cockpit|Admin Cockpit]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 114|Community 114]]
- [[_COMMUNITY_Community 115|Community 115]]
- [[_COMMUNITY_Community 116|Community 116]]
- [[_COMMUNITY_Community 117|Community 117]]
- [[_COMMUNITY_Community 118|Community 118]]
- [[_COMMUNITY_Community 119|Community 119]]
- [[_COMMUNITY_Community 120|Community 120]]
- [[_COMMUNITY_Community 121|Community 121]]
- [[_COMMUNITY_Community 122|Community 122]]
- [[_COMMUNITY_Community 123|Community 123]]
- [[_COMMUNITY_Community 124|Community 124]]
- [[_COMMUNITY_Community 125|Community 125]]
- [[_COMMUNITY_Community 126|Community 126]]
- [[_COMMUNITY_Community 127|Community 127]]
- [[_COMMUNITY_Community 128|Community 128]]
- [[_COMMUNITY_Community 129|Community 129]]
- [[_COMMUNITY_Community 130|Community 130]]
- [[_COMMUNITY_Community 131|Community 131]]
- [[_COMMUNITY_Community 132|Community 132]]
- [[_COMMUNITY_Community 133|Community 133]]
- [[_COMMUNITY_Community 134|Community 134]]
- [[_COMMUNITY_Community 135|Community 135]]
- [[_COMMUNITY_Community 136|Community 136]]
- [[_COMMUNITY_Community 137|Community 137]]
- [[_COMMUNITY_Community 138|Community 138]]
- [[_COMMUNITY_Community 139|Community 139]]
- [[_COMMUNITY_Community 140|Community 140]]
- [[_COMMUNITY_Community 141|Community 141]]
- [[_COMMUNITY_Community 142|Community 142]]
- [[_COMMUNITY_Community 143|Community 143]]
- [[_COMMUNITY_Community 144|Community 144]]
- [[_COMMUNITY_Community 145|Community 145]]
- [[_COMMUNITY_Community 146|Community 146]]
- [[_COMMUNITY_Community 147|Community 147]]
- [[_COMMUNITY_Community 148|Community 148]]
- [[_COMMUNITY_Community 149|Community 149]]
- [[_COMMUNITY_Community 150|Community 150]]
- [[_COMMUNITY_Community 151|Community 151]]
- [[_COMMUNITY_Community 152|Community 152]]
- [[_COMMUNITY_Community 153|Community 153]]
- [[_COMMUNITY_Community 154|Community 154]]
- [[_COMMUNITY_Community 155|Community 155]]

## God Nodes (most connected - your core abstractions)
1. `getCache()` - 21 edges
2. `w()` - 20 edges
3. `Learn page & per-bot pages — design plan` - 19 edges
4. `LazyBull /quant workbench screenshot — brass difference-engine hero over a dark quant trading workbench` - 17 edges
5. `LazyBull /learn page hero — 'Trading, visualized.' editorial-terminal landing screen used as a scroll-cinema panel` - 16 edges
6. `db()` - 15 edges
7. `AdminPage cockpit (auth gate commented out, seeded mock data)` - 14 edges
8. `BotCell (bot backtest cell UI)` - 14 edges
9. `priceOption()` - 13 edges
10. `TradePage — bet builder workbench (/trade)` - 13 edges

## Surprising Connections (you probably didn't know these)
- `/learn/bots/[id] per-bot pages` --semantically_similar_to--> `BotDef (bot definition type: params, formula, endpoint, run)`  [INFERRED] [semantically similar]
  docs/learn-page-plan.md → lib/quant/types.ts
- `BotCell (bot backtest cell UI)` --conceptually_related_to--> `Fully synthetic admin conversion funnel`  [AMBIGUOUS]
  components/quant/BotCell.tsx → docs/strategy/11-gaps-to-revenue.md
- `scene.html (2D cinema iframe scene exposing initScene/renderAt)` --shares_data_with--> `cinemaClock (shared one-clock singleton: progress, px/py pointer, click, vel, hover)`  [AMBIGUOUS]
  public/cinema/scene.html → lib/cinema-clock.ts
- `teacherNote (plain-English consensus explainer)` --implements--> `AI-as-teacher wired to conversion (never AI-as-oracle)`  [INFERRED]
  components/quant/OutputPanel.tsx → docs/strategy/02-north-star.md
- `QuantPage (quant workbench orchestrator: state, runAll stagger, live Yahoo fetch w/ synthetic fallback, deep-link ?add=)` --conceptually_related_to--> `F2: undelayed live Yahoo data served to India`  [INFERRED]
  components/quant/QuantPage.tsx → docs/strategy/09-compliance-risk.md

## Hyperedges (group relationships)
- **Chart coordinate transform pipeline** — chart_chart, chartcore_xofbar, chartcore_yofprice, chartcore_barofx, chartcore_priceofy, chart_drawingshape [INFERRED 0.95]
- **AI Teacher Greek explainer system** — avatar_teacheravatar, speechbubble_greektrigger, speechbubble_greekchip, greekicons_greekmeta, optionschain_optionschain [INFERRED 0.85]
- **Pre-trade safety check pipeline** — strategycard_strategycard, pretrademodal_pretrademodal, killswitch_safetysettingsbutton, killswitch_killswitchoverlay [INFERRED 0.85]
- **Strategy card display pipeline** —  [INFERRED 0.85]
- **Zustand persisted client stores** —  [EXTRACTED 1.00]
- **Probability model implementations sharing ModelInput contract** —  [EXTRACTED 1.00]
- **Time-series math helpers shared across all bots** — series_closes, series_returns, series_logreturns, series_sma, series_ema, series_std, series_rollingstd, series_zscore, series_rsi, series_macd, series_bollinger, series_donchian, series_hurst, series_kalman, series_linregchannel, series_sharpe, series_sortino, series_maxdrawdown, series_makerand, series_makenorm, series_backtestlongonly, series_fmtpct, series_fmtnum, series_fmtmoney [EXTRACTED 1.00]
- **/learn page narrative sections** — learnpageplan_hero, learnpageplan_threepieces, learnpageplan_livedemo, learnpageplan_whystackbots, learnpageplan_fivefamilies, learnpageplan_slidersdemystified, learnpageplan_teachermode, learnpageplan_byob, learnpageplan_nowgo [EXTRACTED 1.00]
- **Homepage scroll-cinema choreography: one normalized scroll clock [0,1] drives 9 act windows, copy beats, 2D canvas crossfade and three 3D set-piece opacity windows (dive tunnel, candle, bull) with clean handoffs before the homepage resolve** — cinema_acts, cinema_copybeats, cinema_canvasopacity, cinema_bull3dopacity, cinema_dive3dopacity, cinema_candle3dopacity, cinemagate_cinemagate, home_page_home [EXTRACTED 1.00]
- **AI-teacher monetization flow: the paywall decision gates POST /api/explain (6th call/day) via a plan field to be added to the NextAuth session, instrumented against proFunnel's five funnel labels, priced by the Free/Pro ladder, charged over the MoR + Razorpay rail** — strategy_aiteacherpaywall, strategy_pricingladder, strategy_merchantofrecordrail, explain_route_post, admin_data_profunnel, next_auth_session [EXTRACTED 1.00]
- **Three fatal compliance flags that flip the paper-only moat into liability at the first paid charge: F1 signal/sizing copy, F2 undelayed Yahoo data to India, F3 public 77% performance claim — all must be fixed before the first charge** — strategy_fatalflagf1, strategy_fatalflagf2, strategy_fatalflagf3, strategy_paperonlyposture, learn_page_learnpage, quote_route_get, learnconsensusplayground_learnconsensusplayground [EXTRACTED 1.00]
- **Live Yahoo quote polling pattern: client surfaces poll /api/quote and /api/quote-batch on 10-30s intervals, keep prior values on transient error, and fall back to synthetic data only on total failure** — tickerbar_tickerbar, trade_page_tradepage, trade_chain_page_tradepage, pro_page_propage, api_quote_batch_route, api_quote_route [INFERRED 0.85]
- **Admin dashboard: presentational panels all consuming shared row types from lib/admin-data (SignupBucket, GeoDot, SymbolRow, ErrorRow), plus the cmd-K CommandPalette as the action surface** — signuptimeline_signuptimeline, usergeomap_usergeomap, symbolheatmap_symbolheatmap, errortoplist_errortoplist, commandpalette_commandpalette, admin_data_admin_data [INFERRED 0.85]
- **Homepage marketing funnel: hero, use-cases, how-it-works, promises, stack, and final CTA sections share the terminal/candlestick visual language and all route the visitor to /trade** — hero_hero, usecases_usecases, tradeoverview_tradeoverview, socialproof_socialproof, partners_partners, getstarted_getstarted, footer_footer [INFERRED 0.85]
- **Admin cockpit panels consuming typed mock rows from lib/admin-data (shared data-module architecture)** — botrundistribution_botrundistribution, kpistrip_kpistrip, recenttrades_recenttrades, systemhealthchart_systemhealthchart, profunnel_profunnel, liveeventstream_liveeventstream [INFERRED 0.95]
- **Cursor-reactive components: pointer-fine guard, mousemove listener, rAF-throttled writes to CSS custom properties, reset on leave** — magneticcta_magneticcta, cursorspotlight_cursorspotlight, terminaltilt_terminaltilt [INFERRED 0.95]
- **Scroll/viewport-progress driven atmosphere: IntersectionObserver or scroll position mapped to visual state (reveal class, count-up, frame scrub, progress fill, ScrollTrigger patterns)** — scrollprogress_scrollprogress, scrollscrub_scrollscrub, scrollreveal_scrollreveal, gsapscroller_gsapscroller, countup_countup [INFERRED 0.85]
- **Learn-page interactive teaching demos: client components with sliders/toggles driving live SVG math visualizations plus a mono 'read this' explainer footer** — learnprobabilitycomparison_learnprobabilitycomparison, learnregimevisualizer_learnregimevisualizer, learnbotdemo_learnbotdemo, learnlivedemo_learnlivedemo, learndatasetplayground_learndatasetplayground, learnbacktestbuilder_learnbacktestbuilder, learnconsensusplayground_learnconsensusplayground, learnvolsmile_learnvolsmile, learngreeksurface_learngreeksurface [INFERRED 0.85]
- **Learn-page ambient atmosphere layer: fixed/decorative terminal-aesthetic components (scroll progress, boot intro, badges, dividers, count-up stats, chapter index, telemetry rail, marquees) sharing the --bull/pulse-dot design language** — scrollprogressbar_scrollprogressbar, bootsequence_bootsequence, livebadge_livebadge, animateddivider_animateddivider, bigstat_bigstat, sectionindex_sectionindex, datastreamrail_datastreamrail, tickerstrip_tickerstrip [INFERRED 0.85]
- **Pro trading workbench shell: TopBar (symbol/timeframe/indicator controls), Chart (candles+drawings+panes), RightPanel (watchlist/quotes), BottomBar (range presets/clock) composed around chartCore geometry and Yahoo-backed /api routes** — topbar_topbar, chart_chart, rightpanel_rightpanel, bottombar_bottombar, chartcore_chartcore, indicators_indicators [INFERRED 0.85]
- **Scroll-cinema pipeline: one shared clock drives the 2D iframe scene and three crossfaded 3D acts, gated by CinemaGate** — cinemagate_cinemagate, scrollcinema_scrollcinema, cinema_clock_cinemaclock, scene_scene, tunnel3d_tunnel3d, candlefield3d_candlefield3d, bull3d_bull3d [EXTRACTED 1.00]
- **Quant workbench run flow: QuantPage orchestrates hero controls, library, workspace cells (stream -> decimate -> done) and the aggregate output panel** — quantpage_quantpage, quanthero_quanthero, botlibrary_botlibrary, workspace_workspace, botcell_botcell, runstream_runstream, decimatednumber_decimatednumber, outputpanel_outputpanel [EXTRACTED 1.00]
- **Path to first dollar: monetization ladder -> paywall build + compliance sprint/punch-list, funded by the bootstrap spine under CAC-by-cohort discipline** — north_star_monetization_ladder, gaps_to_revenue_paywall_payments, gaps_to_revenue_compliance_sprint, compliance_risk_punch_list, capital_strategy_bootstrap_spine, growth_playbook_cac_by_cohort [INFERRED 0.85]
- **The $59 Power tier's contradictory status across the strategy package: killed by Brand, kept as ARPU anchor by Monetization, hero of AI-roadmap Build E, live on the 90-Day Plan pricing page — flagged by the red-team as the package's top contradiction** — 12_critic_redteam_power_tier_contradiction, 08_brand_positioning_power_tier_kill, 03_pricing_and_packaging_tier_ladder, 06_ai_roadmap_confusion_finetune, 04_90_day_plan_doc [EXTRACTED 1.00]
- **Shared mulberry32 (0x6d2b79f5) deterministic seeded-PRNG pattern: stable mock admin data, AI-bot TS fallbacks, ParticleCurtain columns, and the scroll-cinema scene particles all use the same generator so UIs never flicker across renders** — admin_data_mulberry32, ai_bots_seed_rand, 2026_07_14_cinematic_materials_makeover_particle_curtain, 2026_07_03_scroll_cinema_homepage_doc [EXTRACTED 1.00]
- **'Source: Mock' honest-fallback disclosure as a deliberate trust and compliance feature: implemented as the statusMetric on every AI bot card, named a physical trust signal by Brand, a compliance-by-design asset by the research brief, and a keep-proprietary layer by the AI roadmap** — ai_bots_status_metric, 08_brand_positioning_trust_signals, 01_research_brief_compliance_by_design, 06_ai_roadmap_rent_vs_own [EXTRACTED 1.00]
- **Scroll-cinema shot pipeline: capture.mjs screenshots app pages and encodes committed webp shots, scene.html composites them into panels/hero, ScrollCinema drives renderAt, README documents regeneration** — capture_script, cinema_shots, scene_html, scrollcinema_component, cinema_readme [EXTRACTED 1.00]
- **Playwright cinema verification harness: wait for preloader overflow unlock or __cinemaClock, seek or skip the scroll cinema, screenshot to scratchpad** — verify_bull_script, debug_seek_script, debug_clock_script, sweep_script, sweep_home_script, verify_getstarted_script, verify_eye_script, verify_smoke_script, scrollcinema_component [INFERRED 0.85]
- **Higgsfield media pipeline: generate once, finish masters or scrub clips into committed webp under documented budgets, prompts preserved in the makeover plan** — media_readme, finish_script, scrub_frames_script, cinematic_materials_plan [INFERRED 0.85]

## Communities

### Community 0 - "Strategy & Market Positioning"
Cohesion: 0.03
Nodes (89): SEBI statistic: 91-93% of individual F&O traders lose money (₹1.05 lakh crore lost FY25) as the demand hook, AI-as-teacher and conversion engine (real) vs AI-as-oracle (hype to avoid), Compliance-by-design: paper-only, no signals, lagged India data, hypothetical-performance disclaimers, gamify learning never P&L, Market Research Brief — lazybull.trade 'Options You Can See', India as the counter-cyclical, regulation-aligned free beachhead; monetize via brokers, export credibility globally, Open competitive gap: the visual, AI-narrated, learn-by-doing → paper-trade beginner journey nobody owns, Card-required 7-day Pro trial on every wall hit; annual pushed as default, Monetization & Pricing/Packaging (+81 more)

### Community 1 - "Draco Decoder Vendor Internals"
Cohesion: 0.04
Nodes (53): abort(), addOnPostRun(), addOnPreRun(), addRunDependency(), assert(), AttributeOctahedronTransform(), AttributeQuantizationTransform(), AttributeTransformData() (+45 more)

### Community 2 - "Ambient UI Widgets"
Cohesion: 0.03
Nodes (30): BootSequence(), DataStreamRail(), LiveBadge(), ScrollProgressBar(), CountUp(), HungCard(), MagneticCTA(), ScrollScrub() (+22 more)

### Community 3 - "Homepage & Atmosphere Shell"
Cohesion: 0.04
Nodes (32): CursorSpotlight(), ScrollProgress(), ScrollReveal(), TickerBar(), ncdf(), probBS(), probEmpirical(), generateRegimeSeries() (+24 more)

### Community 4 - "Quant Math Engine"
Cohesion: 0.04
Nodes (65): Abramowitz & Stegun 26.2.17 normal CDF approximation, Black-Scholes options pricing model, Box-Muller normal sampling, detect strategy, sortByStrike helper, StrategyKind type, Heston stochastic volatility model, /learn/bots/[id] bot detail pages (+57 more)

### Community 5 - "API Routes & Data Proxies"
Cohesion: 0.05
Nodes (56): About — founders, timeline, values page body, /api/explain — LLM strategy narration endpoint, /api/quote (Yahoo Finance OHLCV proxy), /api/quote-batch (batch live quotes), /api/quote-batch — batched live quotes endpoint, /api/quote — Yahoo historical bars endpoint, /api/symbol-search (Yahoo symbol lookup), /api/workspaces — Mongo workspace persistence endpoint (+48 more)

### Community 6 - "Quant Workbench UI"
Cohesion: 0.04
Nodes (59): BotCell (bot backtest cell UI), ParamControl (slider/select/checkbox param editor), BotLibrary (searchable/filterable bot list + import footer), F2: undelayed live Yahoo data served to India, DecimatedNumber (scramble-to-resolve numeric reveal, rAF driven), Field helper, ImportBotModal, BotLibrary toggle bug fix (+51 more)

### Community 7 - "Scroll Cinema Design Docs"
Cohesion: 0.05
Nodes (57): Act-timeline invariant: act boundaries in lib/cinema.ts ACTS and the scene's PHASES are the same numbers — single source of truth, no drift, Placeholder-first bull: seeded green particle silhouette ships until the user generates the Veo bull.mp4; swap is a pipeline re-run, zero code changes, Scroll Cinema Homepage Hero — Design Spec (approved 2026-07-03, owner Shaurya), Fallback ladder: prefers-reduced-motion gets a static hero with plain copy; no-JS gets poster + DOM copy; manifest/frame failure flips to static mode, Scroll Cinema Homepage Hero — Implementation Plan, Offline frame pipeline (npm run cinema:capture): Playwright screenshots real pages → deterministic scene.html renderAt(t) steps 160 frames → ffmpeg WebP encode + manifest + poster, Obsidian bull brand object: Higgsfield-generated hero stills + image_to_3d GLB replacing the CC-BY Poly bull, retiring the license debt, Cinematic Materials Makeover Implementation Plan (Higgsfield photoreal assets) (+49 more)

### Community 8 - "Pro Charts Interactions"
Cohesion: 0.07
Nodes (33): dataPt(), newId(), onMouseDown(), onMouseLeave(), onMouseMove(), onMouseUp(), onXAxisDoubleClick(), onYAxisDoubleClick() (+25 more)

### Community 9 - "Bot Registry & AI Bots"
Cohesion: 0.07
Nodes (32): bsRequest(), num(), statusMetric(), str(), withStatus(), DecimatedNumber(), randomGlyph(), scrambleAll() (+24 more)

### Community 10 - "Trade Chain UI"
Cohesion: 0.05
Nodes (18): GreekChip(), GreekTrigger(), toggle(), detect(), sortByStrike(), midPrice(), ncdf(), ndf() (+10 more)

### Community 11 - "Admin Mock Data"
Cohesion: 0.04
Nodes (46): BotRunRow — bot run-count row type from admin mock data, FunnelStep — funnel step (label, count) type from admin mock data, proFunnel() — mulberry32-seeded mock Pro conversion funnel (visit → build → paper trade → paywall → upgrade), AI-bot deterministic TS surrogate fallback ('Source: Mock' chip when Python service is down), AmbientOrbs — pure-CSS fixed background of drifting blurred gradient orbs, BetBar (mobile fixed bottom bet bar), BetSlip (sticky bet card: thesis, odds ring, strategy stats, PLACE CTA), OddsRing (SVG probability donut with tone thresholds) (+38 more)

### Community 12 - "Auth & Workspaces"
Cohesion: 0.08
Nodes (34): auth() — NextAuth session accessor, createWorkspace(), deleteWorkspace(), getPublicWorkspace(), getWorkspace(), listWorkspaces(), updateWorkspace(), GET() (+26 more)

### Community 13 - "Admin Cockpit"
Cohesion: 0.06
Nodes (34): AboutPage(), geoDots() — seeded mock user geo map dots, healthSeries() — seeded mock system-health series, KpiCell — KPI cell type (value, tone, delta, sparkline) from admin mock data, recentEvents() — seeded mock event stream, recentTrades() — seeded mock paper trades, signupTimeline() — seeded mock signup timeline, topBots() — seeded mock bot-run distribution (+26 more)

### Community 14 - "Community 14"
Cohesion: 0.18
Nodes (24): A(), B(), C(), D(), E(), f(), G(), H() (+16 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (16): CockpitTopBar(), KillSwitchPanel(), LiveEventStream(), RecentTrades(), R(), geoDots(), healthSeries(), kpis() (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.17
Nodes (13): beatOpacity(), bull3dOpacity(), candle3dOpacity(), canvasOpacity(), clamp01(), dive3dOpacity(), flashOpacity(), windowOpacity() (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (24): Obsidian Bull GLB (Draco-compressed, 13.2MB to 400KB), Cinema shot capture pipeline (Playwright + cwebp), Cinema timeline lib (ACTS, COPY_BEATS — single source of truth), Scroll-cinema README (pipeline + tuning docs), Committed cinema shots (app-page webp panels + hero), Cinematic materials makeover plan (regeneration prompts), Cinema clock probe (__cinemaClock global inspection), Cinema clock seek debugger (scroll fraction vs progress) (+16 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (21): At most one $150-300K angel SAFE (for introductions, not cash), Paper-only / no-signals / lagged-data compliance moat, DO NEXT: license real IV/Greeks feed, CAC-by-cohort frame (India ~Rs 0 / global < $28), Founder-led short-form (the Phase-1 cold-start engine), Two-tier referral (global double-sided months / India non-cash status), 'Explain this trade' share card (CAC-reducer, not engine), India F&O wedge ('The 91% Club', free beachhead) (+13 more)

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (19): Bet Builder workbench: converts a plain-English market thesis into a concrete options bet, 'Your Bet' slip panel that rebuilds live as the chart is dragged: restated thesis, odds gauge, strategy, risk numbers, CTA, Semantic color coding: green = price zone/profit, red-pink = loss/negative, amber-orange = time/expiry date — consistent across headline, chart, and slip, 'Stop showing the chain. Show the bet.' — hides the raw options chain behind an outcome-first interface, with 'Advanced view: see the chain' as progressive disclosure, Direct-manipulation forecast chart: draggable green price band sets the zone, draggable orange dashed expiry line sets the date, Editorial type mix: large serif display headlines (with italic emphasis) against all-caps letterspaced monospace microcopy labels, Four-step tab stepper: 01 Thesis, 02 Pick a Bet, 03 Under the Hood, 04 Manage — numbered progressive workflow, Natural-language thesis headline ('I think AMZN will fall into $215.13 and $240.04 by Aug 19') with inline color-coded editable values (+11 more)

### Community 20 - "Community 20"
Cohesion: 0.2
Nodes (18): Output panel: aggregate BUY verdict for AMZN with BUY 3 / SELL 0 / HOLD 1 / WARN 0 counts, 55% conviction meter, and per-bot verdict list (SMA Crossover BUY, Z-Score Reversion HOLD, etc.), Bot library panel: 27 bots loaded, search field, category filter chips (ALL / AI / TREND / STATISTICAL / RISK / OPTIONS / YOUR), bot cards with AI tags, ADDED state and ABOUT buttons, Brass difference-engine hero image: antique geared calculating machine as full-bleed dark background, a mechanical-computation metaphor for running math on markets, 6-Model Consensus cell: BUY pill with 'ULTRA consensus — 6/6 say UP', CONF 95%, data grid (source Mock, direction UP, agree 6/6, tier ULTRA, expected acc band 65-77%) and per-model P(UP) bar chart, Hero-embedded dataset control panel: AMZN symbol select, LIVE badge, SPOT $247.49, sliders for BARS 180 / SEED 11 / DRIFT M 0.18 / VOL sigma 1.60, RUN ALL (4) and CLEAR WORKSPACE actions, Page purpose: democratized quant workbench — 'for quant traders and a class-12 math kid alike', stack bots, tune the math, see where they agree and what the combined edge says, bring your own bot, Deterministic seed + client-side math: reproducible simulation advertised in the status strip and exposed as a SEED slider, First-time onboarding banner: 'Stack bots like Lego blocks. The Learn page walks through it in 3 minutes.' with SEE HOW IT WORKS CTA (+10 more)

### Community 21 - "Community 21"
Cohesion: 0.23
Nodes (17): Pre-headline badge chips setting expectations — 'LEARN · 8 MIN · ALL LIVE', 'EVERY CHART RESPONDS TO YOU', 'DRAG · TUNE · RUN', Book/magazine metaphor: edition number, 14 chapters, chapter index, 'read it like a book — but every page argues with you', Right-edge chapter index rail: tick-mark progress list with '00 · INTRO' highlighted and an '01 / 15' position counter, Dual-CTA hierarchy: solid green 'Begin Chapter 01 ↓' primary vs ghost-outline 'Skip — open the workbench →' secondary, Editorial-terminal hybrid design language: high-contrast didone serif display type layered over a monospace trading-terminal chrome, Giant ghosted '00' watermark numeral behind the hero, marking the intro chapter as an editorial section device, Two-tone serif hero headline — 'Trading,' in white roman, 'visualized.' in neon-green italic, at massive display scale, Interactive-first pedagogy: every concept ships with a draggable chart, a market-morphing slider, or a runnable bot — 'zero textbooks' (+9 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (9): BottomBar(), onKey(), redo(), saveWorkspace(), showToast(), startReplay(), toggleFullscreen(), undo() (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (15): TeacherAvatar, Drag-select Options Chain, IV Heatmap, DeltaIcon, GammaIcon, GreekMeta, IvIcon, RhoIcon (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.24
Nodes (13): Design pattern: technical-blueprint annotation — feature pills attached by thin vertical leader lines and HUD tags pinned to the imagery, framing the page as an instrumented schematic, Design decision: near-black canvas with faint grid texture, deep-green ambient glow, and a single neon-green accent — a trading-terminal aesthetic, Macro human-eye hero image with a green candlestick chart reflected in the iris, filling the lower half of the frame, Four annotated feature pills hung from thin leader lines: VISUAL OPTIONS CHAIN, 27 QUANT BOTS / 13 MODELS, AI CRASH DETECTION, $100K PAPER ACCOUNT, Primary CTA pair: solid neon-green 'GET STARTED ->' button with quiet 'OR SIGN IN' text alternative, Display headline 'Options you can see.' in editorial serif, with 'see' in a green-to-blue gradient italic, Floating terminal-style metric tags over the eye imagery: 'IV 0.41' and 'P(DOWN) 71%', Numbered top navigation (01 LEARN, 02 VISUAL CHAIN, 03 PRO CHARTS, 04 QUANT, 05 ABOUT) with LB logo, cmd-K search, Sign In, and neon OPEN THE CHAIN CTA (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.27
Nodes (5): camZAt(), clamp(), diveT(), lerp(), smooth()

### Community 26 - "Community 26"
Cohesion: 0.22
Nodes (10): Paper Trading Safety Pipeline, KillSwitchOverlay, SafetySettingsButton, Toggle, PnLDiagram, DangerSimulation, PreTradeModal, explain (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (3): GsapScroller(), SessionProvider(), ThemeProvider()

### Community 28 - "Community 28"
Cohesion: 0.39
Nodes (4): buildAt(), clamp(), revealF(), smooth()

### Community 29 - "Community 29"
Cohesion: 0.36
Nodes (5): addDays(), eventsFor(), eventTone(), hash(), iso()

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (2): clamp(), smooth()

### Community 33 - "Community 33"
Cohesion: 0.29
Nodes (7): Bar, atr, bollinger, ema, macd, sma, supertrend

### Community 34 - "Community 34"
Cohesion: 0.6
Nodes (3): smileIV(), xOf(), yOf()

### Community 35 - "Community 35"
Cohesion: 0.4
Nodes (5): EventRow — event feed row type with level union from admin mock data, TradeRow — paper-trade row type with status union from admin mock data, KillSwitchPanel — admin arm/countdown kill-switch panel with fire history, LiveEventStream — synthetic live-tail event feed with level filters and pause, RecentTrades — recent paper-trade table with status badges and P/L coloring

### Community 36 - "Community 36"
Cohesion: 0.5
Nodes (1): buildColumns()

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (1): splitLayers()

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (4): eventTone, MarketEvent type, EventTimeline, Legend subcomponent

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (2): adminEmails(), isAdmin()

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (2): cellKey(), legId()

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (3): AlertsPanel, fmt, TradeDrawer

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (3): handlers — NextAuth route handlers, NextAuth catch-all API route (GET/POST re-export), SignInPanel — Google-only sign-in page

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (3): The 91% Club India wedge — India free as dataset/trust/SEO beachhead, Paper-only, no-signals, lagged-data posture — the compliance moat, SEBI loss statistic — ~91% of individual F&O traders had net losses, ~₹1.05 lakh crore aggregate FY25

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (1): @tailwindcss/postcss

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (2): ToolKind, LeftToolbar

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (2): genBars, mulberry32

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (2): mk(): Leg factory helper, Strategy Detector Test Suite

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (2): makeNorm, makeRand

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (2): next.config.ts (empty config), TODO.md (Next.js dev fix tracker)

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (2): CockpitTopBar — sticky admin status bar (UTC clock, uptime, live FPS meter, sign-out), /api/auth/signout — auth sign-out endpoint (target of CockpitTopBar link; file not verified, possibly framework-provided)

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (2): LearnApiStatus (FastAPI health pinger), QuantAI FastAPI /health endpoint (NEXT_PUBLIC_QUANTAI_URL)

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (2): ScrollProgressBar, SectionIndex (right-rail chapter nav)

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (2): DataStreamRail (fake telemetry rail), TickerStrip (CSS marquee)

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (2): Dilution math ($10M vs $5.5M vs $4.5M per founder), No priced seed (misaligned with sub-$70M exit)

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (2): Mongo index init script (idempotent), Mongo connection lib (db, mongo)

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (2): Learn TAUGHT element style debugger, Trade/learn page screenshot verify

### Community 113 - "Community 113"
Cohesion: 1.0
Nodes (1): ThemeProvider — sets data-theme on <html>

### Community 114 - "Community 114"
Cohesion: 1.0
Nodes (1): Viewport

### Community 115 - "Community 115"
Cohesion: 1.0
Nodes (1): ChartGeom

### Community 116 - "Community 116"
Cohesion: 1.0
Nodes (1): Drawing

### Community 117 - "Community 117"
Cohesion: 1.0
Nodes (1): xOfBar

### Community 118 - "Community 118"
Cohesion: 1.0
Nodes (1): barOfX

### Community 119 - "Community 119"
Cohesion: 1.0
Nodes (1): yOfPrice

### Community 120 - "Community 120"
Cohesion: 1.0
Nodes (1): priceOfY

### Community 121 - "Community 121"
Cohesion: 1.0
Nodes (1): autoY

### Community 122 - "Community 122"
Cohesion: 1.0
Nodes (1): distToSeg

### Community 123 - "Community 123"
Cohesion: 1.0
Nodes (1): fmtTime

### Community 124 - "Community 124"
Cohesion: 1.0
Nodes (1): rsi

### Community 125 - "Community 125"
Cohesion: 1.0
Nodes (1): vwap

### Community 126 - "Community 126"
Cohesion: 1.0
Nodes (1): ichimoku

### Community 127 - "Community 127"
Cohesion: 1.0
Nodes (1): ReplayBar

### Community 128 - "Community 128"
Cohesion: 1.0
Nodes (1): GreekKey

### Community 129 - "Community 129"
Cohesion: 1.0
Nodes (1): PositionsPanel

### Community 130 - "Community 130"
Cohesion: 1.0
Nodes (1): Safety + Kill Switch Test Suite

### Community 131 - "Community 131"
Cohesion: 1.0
Nodes (1): useTheme zustand store

### Community 132 - "Community 132"
Cohesion: 1.0
Nodes (1): nearestEvent

### Community 133 - "Community 133"
Cohesion: 1.0
Nodes (1): CustomBotInput type

### Community 134 - "Community 134"
Cohesion: 1.0
Nodes (1): returns

### Community 135 - "Community 135"
Cohesion: 1.0
Nodes (1): logReturns

### Community 136 - "Community 136"
Cohesion: 1.0
Nodes (1): donchian

### Community 137 - "Community 137"
Cohesion: 1.0
Nodes (1): kalman

### Community 138 - "Community 138"
Cohesion: 1.0
Nodes (1): maxDrawdown

### Community 139 - "Community 139"
Cohesion: 1.0
Nodes (1): backtestLongOnly

### Community 140 - "Community 140"
Cohesion: 1.0
Nodes (1): fmtPct

### Community 141 - "Community 141"
Cohesion: 1.0
Nodes (1): fmtNum

### Community 142 - "Community 142"
Cohesion: 1.0
Nodes (1): fmtMoney

### Community 143 - "Community 143"
Cohesion: 1.0
Nodes (1): README (Next.js bootstrap)

### Community 144 - "Community 144"
Cohesion: 1.0
Nodes (1): MiniSpark — SVG sparkline

### Community 145 - "Community 145"
Cohesion: 1.0
Nodes (1): SignupTimeline — admin signup bar chart

### Community 146 - "Community 146"
Cohesion: 1.0
Nodes (1): UserGeoMap — admin world map of sessions

### Community 147 - "Community 147"
Cohesion: 1.0
Nodes (1): SymbolHeatmap — admin top-traded symbol grid

### Community 148 - "Community 148"
Cohesion: 1.0
Nodes (1): CommandPalette — admin cmd-K action palette

### Community 149 - "Community 149"
Cohesion: 1.0
Nodes (1): ErrorTopList — admin top errors list

### Community 150 - "Community 150"
Cohesion: 1.0
Nodes (1): admin-data — shared admin row types (SignupBucket, GeoDot, SymbolRow, ErrorRow)

### Community 151 - "Community 151"
Cohesion: 1.0
Nodes (1): IntroSequence — one-shot boot-screen overlay gated by sessionStorage

### Community 152 - "Community 152"
Cohesion: 1.0
Nodes (1): BootSequence (CRT boot intro)

### Community 153 - "Community 153"
Cohesion: 1.0
Nodes (1): LiveBadge

### Community 154 - "Community 154"
Cohesion: 1.0
Nodes (1): AnimatedDivider

### Community 155 - "Community 155"
Cohesion: 1.0
Nodes (1): BigStat (count-up editorial stat)

## Ambiguous Edges - Review These
- `AdminPage cockpit (auth gate commented out, seeded mock data)` → `auth() — NextAuth session accessor`  [AMBIGUOUS]
  app/admin/page.tsx · relation: references
- `AdminPage cockpit (auth gate commented out, seeded mock data)` → `isAdmin() — ADMIN_EMAILS allow-list check`  [AMBIGUOUS]
  app/admin/page.tsx · relation: references
- `CockpitTopBar — sticky admin status bar (UTC clock, uptime, live FPS meter, sign-out)` → `/api/auth/signout — auth sign-out endpoint (target of CockpitTopBar link; file not verified, possibly framework-provided)`  [AMBIGUOUS]
  components/admin/CockpitTopBar.tsx · relation: references
- `LearnProbabilityComparison` → `probAll() (Wedge tools, location unknown)`  [AMBIGUOUS]
  components/learn/LearnProbabilityComparison.tsx · relation: references
- `BotCell (bot backtest cell UI)` → `Fully synthetic admin conversion funnel`  [AMBIGUOUS]
  components/quant/BotCell.tsx · relation: conceptually_related_to
- `ProbabilityCone (draggable log-normal 50/68/95% forecast cone with band/expiry handles and event pins)` → `OddsRing (SVG probability donut with tone thresholds)`  [AMBIGUOUS]
  components/wedge/BetSlip.tsx · relation: semantically_similar_to
- `cinemaClock (shared one-clock singleton: progress, px/py pointer, click, vel, hover)` → `scene.html (2D cinema iframe scene exposing initScene/renderAt)`  [AMBIGUOUS]
  components/scrollstory/ScrollCinema.tsx · relation: shares_data_with
- `Cinema scene (2D canvas, renderAt API)` → `Clip to scroll-scrub webp frame sequence (ffmpeg + cwebp)`  [AMBIGUOUS]
  scripts/media/scrub-frames.mjs · relation: conceptually_related_to
- `Video verify (/quant machine loop, /learn prism scrub)` → `Clip to scroll-scrub webp frame sequence (ffmpeg + cwebp)`  [AMBIGUOUS]
  scripts/cinema/raw/verify-videos.mjs · relation: conceptually_related_to

## Knowledge Gaps
- **250 isolated node(s):** `@tailwindcss/postcss`, `next.config.ts (empty config)`, `ProCta — modal CTA for /pro workspace`, `ThemeProvider — sets data-theme on <html>`, `Field helper` (+245 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 30`** (7 nodes): `Bull3D.tsx`, `AssemblyParticles()`, `BullInteraction()`, `clamp()`, `lerp()`, `mulberry32()`, `smooth()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (4 nodes): `buildColumns()`, `ParticleCurtain()`, `ParticleCurtain.tsx`, `particle-curtain.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (4 nodes): `Line()`, `splitLayers()`, `MaterialHero.tsx`, `material-hero.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (3 nodes): `adminEmails()`, `isAdmin()`, `admin.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (3 nodes): `cellKey()`, `legId()`, `stores.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (2 nodes): `postcss.config.mjs`, `@tailwindcss/postcss`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (2 nodes): `ToolKind`, `LeftToolbar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (2 nodes): `genBars`, `mulberry32`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (2 nodes): `mk(): Leg factory helper`, `Strategy Detector Test Suite`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (2 nodes): `makeNorm`, `makeRand`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (2 nodes): `next.config.ts (empty config)`, `TODO.md (Next.js dev fix tracker)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (2 nodes): `CockpitTopBar — sticky admin status bar (UTC clock, uptime, live FPS meter, sign-out)`, `/api/auth/signout — auth sign-out endpoint (target of CockpitTopBar link; file not verified, possibly framework-provided)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (2 nodes): `LearnApiStatus (FastAPI health pinger)`, `QuantAI FastAPI /health endpoint (NEXT_PUBLIC_QUANTAI_URL)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (2 nodes): `ScrollProgressBar`, `SectionIndex (right-rail chapter nav)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (2 nodes): `DataStreamRail (fake telemetry rail)`, `TickerStrip (CSS marquee)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (2 nodes): `Dilution math ($10M vs $5.5M vs $4.5M per founder)`, `No priced seed (misaligned with sub-$70M exit)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (2 nodes): `Mongo index init script (idempotent)`, `Mongo connection lib (db, mongo)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (2 nodes): `Learn TAUGHT element style debugger`, `Trade/learn page screenshot verify`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 113`** (1 nodes): `ThemeProvider — sets data-theme on <html>`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 114`** (1 nodes): `Viewport`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 115`** (1 nodes): `ChartGeom`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 116`** (1 nodes): `Drawing`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 117`** (1 nodes): `xOfBar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 118`** (1 nodes): `barOfX`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 119`** (1 nodes): `yOfPrice`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 120`** (1 nodes): `priceOfY`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 121`** (1 nodes): `autoY`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 122`** (1 nodes): `distToSeg`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 123`** (1 nodes): `fmtTime`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 124`** (1 nodes): `rsi`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 125`** (1 nodes): `vwap`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 126`** (1 nodes): `ichimoku`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 127`** (1 nodes): `ReplayBar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 128`** (1 nodes): `GreekKey`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 129`** (1 nodes): `PositionsPanel`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 130`** (1 nodes): `Safety + Kill Switch Test Suite`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 131`** (1 nodes): `useTheme zustand store`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 132`** (1 nodes): `nearestEvent`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 133`** (1 nodes): `CustomBotInput type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 134`** (1 nodes): `returns`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 135`** (1 nodes): `logReturns`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 136`** (1 nodes): `donchian`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 137`** (1 nodes): `kalman`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 138`** (1 nodes): `maxDrawdown`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 139`** (1 nodes): `backtestLongOnly`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 140`** (1 nodes): `fmtPct`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 141`** (1 nodes): `fmtNum`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 142`** (1 nodes): `fmtMoney`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 143`** (1 nodes): `README (Next.js bootstrap)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 144`** (1 nodes): `MiniSpark — SVG sparkline`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 145`** (1 nodes): `SignupTimeline — admin signup bar chart`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 146`** (1 nodes): `UserGeoMap — admin world map of sessions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 147`** (1 nodes): `SymbolHeatmap — admin top-traded symbol grid`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 148`** (1 nodes): `CommandPalette — admin cmd-K action palette`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 149`** (1 nodes): `ErrorTopList — admin top errors list`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 150`** (1 nodes): `admin-data — shared admin row types (SignupBucket, GeoDot, SymbolRow, ErrorRow)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 151`** (1 nodes): `IntroSequence — one-shot boot-screen overlay gated by sessionStorage`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 152`** (1 nodes): `BootSequence (CRT boot intro)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 153`** (1 nodes): `LiveBadge`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 154`** (1 nodes): `AnimatedDivider`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 155`** (1 nodes): `BigStat (count-up editorial stat)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `AdminPage cockpit (auth gate commented out, seeded mock data)` and `auth() — NextAuth session accessor`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `AdminPage cockpit (auth gate commented out, seeded mock data)` and `isAdmin() — ADMIN_EMAILS allow-list check`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `CockpitTopBar — sticky admin status bar (UTC clock, uptime, live FPS meter, sign-out)` and `/api/auth/signout — auth sign-out endpoint (target of CockpitTopBar link; file not verified, possibly framework-provided)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `LearnProbabilityComparison` and `probAll() (Wedge tools, location unknown)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `BotCell (bot backtest cell UI)` and `Fully synthetic admin conversion funnel`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `ProbabilityCone (draggable log-normal 50/68/95% forecast cone with band/expiry handles and event pins)` and `OddsRing (SVG probability donut with tone thresholds)`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **What is the exact relationship between `cinemaClock (shared one-clock singleton: progress, px/py pointer, click, vel, hover)` and `scene.html (2D cinema iframe scene exposing initScene/renderAt)`?**
  _Edge tagged AMBIGUOUS (relation: shares_data_with) - confidence is low._
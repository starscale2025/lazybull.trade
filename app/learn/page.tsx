import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CalmLink, CalmPanel, Chip, PageHeader, PillLink, Stats } from "@/components/calm/kit";
import { BOT_REGISTRY } from "@/lib/quant/bots";
import { ACCURACY_BAND, CATEGORY_META, HYPOTHETICAL_NOTE, type BotCategory } from "@/lib/quant/types";

// Visualizations
import { LearnLiveDemo } from "@/components/learn/LearnLiveDemo";
import { LearnDatasetPlayground } from "@/components/learn/LearnDatasetPlayground";
import { LearnConsensusPlayground } from "@/components/learn/LearnConsensusPlayground";
import { LearnRegimeVisualizer } from "@/components/learn/LearnRegimeVisualizer";
import { GreekSurface3D } from "@/components/learn/GreekSurface3D";
import { LearnBacktestBuilder } from "@/components/learn/LearnBacktestBuilder";
import { LearnVolSmile } from "@/components/learn/LearnVolSmile";
import { LearnProbabilityComparison } from "@/components/learn/LearnProbabilityComparison";

// Ambient motion
import { TickerStrip } from "@/components/learn/ambient/TickerStrip";
import { AnimatedDivider } from "@/components/learn/ambient/AnimatedDivider";
import { BigStat } from "@/components/learn/ambient/BigStat";
import { ChapterNav } from "@/components/learn/ChapterNav";
import { Diploma } from "@/components/learn/Diploma";
import { SplitDesk, type DeskChapter } from "@/components/learn/SplitDesk";
import type { PredictConfig } from "@/components/learn/Predict";

export const metadata = {
  // Per-route canonical. The root layout must not set one: Next inherits
  // root metadata into every route, so a single canonical there told Google
  // that every page on the domain was a duplicate of the homepage.
  alternates: { canonical: "/learn" },
  title: "Learn · Lazybull",
  description:
    "Trading, visualized. 14 chapters, 8 live demos, every chart responds to you. The most ambitious quant primer on the internet.",
};

// The left gutter a centred .shell keeps clear for the fixed chapter rail
// (the geometry contract at the top of ChapterNav.tsx).
const RAIL_GUTTER = "lg:pl-[max(1.25rem,13rem_-_max(0px,(100vw_-_1400px)/2))]";

const CATEGORY_ORDER: BotCategory[] = ["ai", "trend", "stats", "risk", "options", "custom"];
// TEACHING INSTRUMENTS, described as instruments. "Ensemble direction
// forecasters" and "how much to bet" named a forecasting service and a sizing
// service — two things lazybull is not and cannot be while unregistered. The
// counts stay because they are checkable against BOT_REGISTRY below.
const CATEGORY_BLURB: Record<BotCategory, string> = {
  ai: "12 teaching instruments that delegate to a Python ML service — neural option pricers, and direction models you can watch agree and disagree on real Yahoo data.",
  trend: "Follow momentum. Where a breakout was marked, where the reversal ended it. SMA Crossover, MACD, Donchian, Bollinger.",
  stats: "Measure what’s normal. Z-score, Hurst exponent, Kalman filter, LinReg channel.",
  risk: "The maths of risk and ruin. Kelly criterion, Monte Carlo VaR, Sharpe optimiser.",
  options: "Pure math. Black-Scholes solver, IV crush detector, the wheel back-test.",
  custom: "Bots you imported yourself. Bring your own JS function, hot-load it.",
};

const TICKER_JARGON_A = [
  "Regime", "Hurst", "Autocorrelation", "Mean-reversion", "Momentum",
  "Alpha", "Beta", "Sharpe", "Sortino", "Calmar", "Max drawdown",
  "Walk-forward", "Embargo", "Out-of-sample", "Information coefficient",
];
// The counts here are checkable (BOT_REGISTRY, the demo list, the paper
// account). The vendor chatter that sat beside them — a model vendor's
// product name, an internal service port, a data-vendor feed name — was
// neither checkable by a reader nor any of their business, and naming a
// third-party LLM in a ticker on an options-education page implies a
// relationship we do not have.
const TICKER_JARGON_D = [
  "27 bots", "13 models", "8 live demos", "$5k paper", "Paper only",
  "Black-Scholes · 1973", "Heston · 1993", "Mulberry32 · 2014",
  "ATR-based stops", "Ensemble-of-7", "Walk-forward", "No lookahead",
];

export default function LearnPage() {
  const families = CATEGORY_ORDER.map((cat) => ({
    cat,
    meta: CATEGORY_META[cat],
    bots: BOT_REGISTRY.filter((b) => b.category === cat),
    blurb: CATEGORY_BLURB[cat],
  })).filter((f) => f.bots.length > 0);

  // Headline line — the fade-up used across every chapter headline.
  const HL = (text: React.ReactNode, cls: string, delay: string) => (
    <span className={`block hero-headline-line ${cls}`} style={{ animationDelay: delay }}>
      {text}
    </span>
  );

  // "Call your shot" — an intuition guess per demo chapter (phase L1). The
  // pinned terminal is the reveal. Answers are remembered and feed L4's ledger.
  const PREDICTS: Record<string, PredictConfig> = {
    regime: {
      question: "A price wanders with no memory of where it’s been. Its Hurst exponent is closest to…",
      options: [{ label: "0.2" }, { label: "0.5", correct: true }, { label: "0.8" }],
      reveal: "0.5 is a pure random walk — no trend, no reversion. Drag the knob to 0.5 and the structure dissolves.",
    },
    liveDemo: {
      question: "The fast moving average crosses ABOVE the slow one. The textbook signal is…",
      options: [{ label: "Buy", correct: true }, { label: "Sell" }, { label: "Hold" }],
      reveal: "A golden cross — fast over slow — is the classic long entry. Drag the periods and watch the crossings move.",
    },
    backtest: {
      question: "Bot A returns +40%, Bot B returns +18%. Which is the better strategy?",
      options: [{ label: "A, clearly" }, { label: "Can’t tell yet", correct: true }, { label: "B" }],
      reveal: "You can’t tell from return alone — you need Sharpe. A’s +40% might ride a 60% drawdown. Run it and see.",
    },
    consensus: {
      question: "One bot reads this window as UP. How much should you trust it?",
      options: [{ label: "A lot" }, { label: "Barely", correct: true }, { label: "Fully" }],
      reveal: "One bot is a guess. Trust is earned when many independent models line up — toggle more and watch the tier flip.",
    },
    greeks: {
      question: "You’re long a call and the stock rips up fast. Which Greek just paid you most?",
      options: [{ label: "Theta" }, { label: "Delta", correct: true }, { label: "Rho" }],
      reveal: "Delta — your directional exposure. Drag the strike and watch it climb toward 1 as the call goes deep ITM.",
    },
    volsmile: {
      question: "A 15%-OTM put vs a 15%-OTM call — which one costs more?",
      options: [{ label: "The put", correct: true }, { label: "The call" }, { label: "Same" }],
      reveal: "The put. Markets price crash risk above rally risk — that asymmetry is the skew. Drag it to see.",
    },
    probability: {
      question: "Three models price the same option’s odds. They return…",
      options: [{ label: "The same" }, { label: "Different odds", correct: true }, { label: "Nonsense" }],
      reveal: "Different answers — that gap is model risk. Drag the band into the tails and watch them diverge.",
    },
    dataset: {
      question: "You re-run the exact same seed twice. The chart comes back…",
      options: [{ label: "Identical", correct: true }, { label: "Random" }, { label: "Similar-ish" }],
      reveal: "Identical — same seed, same market, every time. That reproducibility is the whole point.",
    },
  };

  // The demo chapters as data, fed to the sticky-terminal Desk in three runs:
  // §01 (solo) · §03–§08 (the sustained six-demo desk) · §10 (solo). Copy is
  // verbatim from the old chapters; the Desk owns the composition now.
  const RUN_1: DeskChapter[] = [
    {
      num: "01", id: "regime", label: "The market has three modes", regime: "random",
      hint: "Drag the knob →",
      predict: PREDICTS.regime,
      headline: (
        <>
          {HL("Trending.", "text-fg", "0.1s")}
          {HL("Random.", "text-fg-dim", "0.32s")}
          {HL("Reverting.", "text-fg", "0.55s")}
        </>
      ),
      thesis: "One slider. Three regimes. Three winning bots.",
      body: (
        <>
          Every market — every stock, every minute, every quarter — sits somewhere on this
          spectrum. The single most important question in quant trading is{" "}
          <span className="text-fg">which regime are you in right now</span>, because the
          answer tells you which bot family will pay off and which will burn you. Drag the knob;
          watch the chart morph. The Hurst exponent — the number controlling the drag — is what
          our regime detector reads off real markets.
        </>
      ),
      aside: (
        <Stats
          items={[
            { value: <BigStat value={0.5} decimals={2} />, label: "random walk threshold" },
            { value: <BigStat value={0.3} decimals={2} />, label: "strongly mean-reverting" },
            { value: <BigStat value={0.7} decimals={2} />, label: "strongly trending" },
          ]}
        />
      ),
      takeaway: (
        <Takeaway>
          “The bot that wins in a trend <span className="text-brand-ink">dies in a chop</span>.
          Detect first, act second.”
        </Takeaway>
      ),
      demo: <LearnRegimeVisualizer />,
    },
  ];

  const RUN_2: DeskChapter[] = [
    {
      num: "03", id: "live-demo", label: "Live demo", regime: "trend",
      hint: "Live · Yahoo feed",
      predict: PREDICTS.liveDemo,
      headline: (
        <>
          {HL("One bot.", "text-fg", "0.1s")}
          {HL("One chart.", "text-fg", "0.3s")}
          {HL("Nothing fake.", "text-fg-dim", "0.5s")}
        </>
      ),
      thesis: "SMA crossover. Real AMZN bars. Drag the periods.",
      body: (
        <>
          Below is the textbook moving-average-crossover bot, running on real AMZN daily bars
          fetched from Yahoo on page load. Drag the period sliders — the math recomputes
          instantly, in your browser, with no round-trip. Every signal you see was just computed
          by your CPU.
        </>
      ),
      demo: <LearnLiveDemo />,
    },
    {
      num: "04", id: "backtest", label: "Backtest in motion", regime: "risk",
      hint: "6 bots × 3 scenarios",
      predict: PREDICTS.backtest,
      headline: (
        <>
          {HL("Same bot.", "text-fg", "0.1s")}
          {HL("Wins one regime,", "text-fg", "0.3s")}
          {HL("loses the next.", "text-fg-dim", "0.5s")}
        </>
      ),
      thesis: "Sharpe matters. Drawdown matters. Pure return doesn’t.",
      body: (
        <>
          Pick a bot. Pick a market scenario. Hit run. The equity curve builds bar by bar in real
          time, with Sharpe, max drawdown, and win rate filling in as the simulation progresses.
          That’s when it clicks: high return ≠ good strategy. You want{" "}
          <span className="text-fg">Sharpe</span> — return per unit of bumpy ride — not
          just upside.
        </>
      ),
      takeaway: (
        <Takeaway>
          “<span className="t-accent">Sharpe &gt; 1</span> is the line where a
          return starts to look paid-for rather than lucky. Most published retail
          strategies never cleared it.”
        </Takeaway>
      ),
      demo: <LearnBacktestBuilder />,
    },
    {
      num: "05", id: "consensus", label: "Why stack bots", regime: "trend",
      hint: "12 bots · 3 scenarios",
      predict: PREDICTS.consensus,
      headline: (
        <>
          {HL("One bot is", "text-fg-dim", "0.1s")}
          {HL("a guess.", "text-fg", "0.3s")}
          {HL("Six disagreeing", "w-fit t-accent", "0.55s")}
          {HL("is the lesson.", "text-fg-dim", "0.78s")}
        </>
      ),
      // The chapter used to end on "Six agreeing is a signal" and then quote a
      // top-tier accuracy range as if agreement bought better odds. Both had to
      // go: the memo asks for consensus framed as watching models disagree, and
      // for one canonical hit-rate band that never climbs with the tier.
      thesis: "Toggle bots. Watch the agreement move. Disagreement is data.",
      body: (
        <>
          Watch the agreement band slide as more models fall into line — and watch it break
          apart when you tweak the dataset’s drift, vol or seed. Six models built on the
          same tape failing to agree is the most honest thing a workbench can show you.
          Whatever the agreement, one band describes them all:{" "}
          <span className="text-fg">{ACCURACY_BAND}</span> on embargoed walk-forward
          CV — {HYPOTHETICAL_NOTE}.
        </>
      ),
      demo: <LearnConsensusPlayground />,
    },
    {
      num: "06", id: "greeks", label: "The Greeks, dancing", regime: "options",
      hint: "Drag strike · hover Greek",
      predict: PREDICTS.greeks,
      headline: (
        <>
          {HL("Five numbers", "text-fg", "0.1s")}
          {HL("tell you everything", "text-fg", "0.32s")}
          {HL("about an option.", "text-fg-dim", "0.55s")}
        </>
      ),
      thesis: "Drag the strike. All five Greeks update at once.",
      body: (
        <>
          Delta, Gamma, Theta, Vega, Rho. Drag the strike below — every Greek updates
          simultaneously. Hover any of them for a one-line plain-English explanation. By the time
          you’ve dragged the strike across the smile, you’ll have the intuitions
          textbooks take chapters to build.
        </>
      ),
      aside: (
        <div className="flex flex-col gap-3">
          <CalmPanel className="grid grid-cols-5 gap-2">
            {[
              { sym: "Δ", label: "Delta" },
              { sym: "Γ", label: "Gamma" },
              { sym: "Θ", label: "Theta" },
              { sym: "ν", label: "Vega" },
              { sym: "ρ", label: "Rho" },
            ].map((g) => (
              <div key={g.sym} className="text-center">
                <div className="font-display text-[clamp(1.5rem,3vw,2.25rem)] leading-none text-fg">{g.sym}</div>
                <div className="mt-1.5 t-label text-fg-faint">{g.label}</div>
              </div>
            ))}
          </CalmPanel>
          <div className="flex justify-end">
            <CalmLink href="/greeks">Open the full surface lab</CalmLink>
          </div>
        </div>
      ),
      demo: <GreekSurface3D />,
    },
    {
      num: "07", id: "volsmile", label: "The vol smile", regime: "options",
      hint: "Skew · kurtosis",
      predict: PREDICTS.volsmile,
      headline: (
        <>
          {HL("A 15%-OTM put", "text-fg", "0.1s")}
          {HL("costs more than", "text-fg-dim", "0.32s")}
          {HL("a 15%-OTM call.", "text-fg", "0.55s")}
        </>
      ),
      thesis: "Crashes happen faster than rallies. The market knows.",
      body: (
        <>
          Black-Scholes assumes one flat volatility. Real markets don’t. Out-of-the-money
          puts trade at higher implied vol than equidistant calls because the market knows crashes
          happen faster than rallies. Drag the skew and kurtosis sliders to see exactly how far
          reality drifts from the textbook.
        </>
      ),
      takeaway: (
        <Takeaway>
          “Black-Scholes is a beautiful model.{" "}
          <span className="t-accent">Heston is a useful one.</span>”
        </Takeaway>
      ),
      demo: <LearnVolSmile />,
    },
    {
      num: "08", id: "probability", label: "Probability · three ways", regime: "risk",
      hint: "Drag the band",
      predict: PREDICTS.probability,
      headline: (
        <>
          {HL("Three models.", "text-fg", "0.1s")}
          {HL("One question.", "text-fg-dim", "0.32s")}
          {HL("Three answers.", "text-fg", "0.55s")}
        </>
      ),
      thesis: "The gap is model risk. Most platforms hide it.",
      body: (
        <>
          “Will the price land in this band by expiry?” Black-Scholes, Monte Carlo, and
          an empirical fat-tailed model give you three different probabilities. Drag the band into
          the wings and watch them disagree. That gap is{" "}
          <span className="text-fg">model risk</span> — a real cost most retail platforms
          hide from you.
        </>
      ),
      demo: <LearnProbabilityComparison />,
    },
  ];

  const RUN_3: DeskChapter[] = [
    {
      num: "10", id: "dataset", label: "Stress-test any market", regime: "random",
      hint: "Click a knob → learn it",
      predict: PREDICTS.dataset,
      headline: (
        <>
          {HL("Five knobs.", "text-fg", "0.1s")}
          {HL("Each in", "text-fg-dim", "0.32s")}
          {HL("plain English.", "text-fg", "0.55s")}
        </>
      ),
      thesis: "Symbol · Bars · Seed · Drift · Vol. Click any.",
      body: (
        <>
          The dataset card on every quant page lets you stress-test bots against any market. Drag
          each slider — the chart redraws deterministically. Same seed, same chart, every time.
          That’s reproducibility nobody else in retail finance offers.
        </>
      ),
      demo: <LearnDatasetPlayground />,
    },
  ];

  return (
    <main className="page-aura tap-floor flex min-h-screen flex-col bg-bg text-fg">
      {/* One navigator: named chapters + jump, the learning curve, and the
          mobile progress bar — folds in what used to be SectionIndex +
          ScrollProgressBar + LiveBadge (DataStreamRail retired). */}
      <ChapterNav />

      <Nav />

      {/* ─────────────────────────────────────────────────────────────────
          §00 HERO
          ───────────────────────────────────────────────────────────────── */}
      <section id="hero">
        <PageHeader
          className={RAIL_GUTTER}
          eyebrow="Learn · 8 min · all interactive"
          title="Trading,"
          accent="visualized."
          lede={
            <>
              Eight live demos. Fourteen chapters. Zero textbooks. Most quant tutorials are walls of
              text with one screenshot. Ours is the opposite: every concept on this page comes with a
              chart you can drag, a slider that morphs the market, or a bot you can run in real time.
              Read it like a book — but every page <span className="text-fg">argues with you</span>.
            </>
          }
          actions={
            <>
              <PillLink href="#regime" kind="primary">
                Begin chapter 01
              </PillLink>
              <CalmLink href="/quant">Skip — open the workbench</CalmLink>
            </>
          }
        >
          <Stats
            className="mt-12"
            items={[
              { value: <BigStat value={27} />, label: "bots" },
              { value: <BigStat value={13} />, label: "ML models" },
              { value: <BigStat value={8} />, label: "live demos" },
            ]}
          />
          {/* No "live feed" here: the primer's demos run on their own data,
              and the only claim worth making is the mode (Gate A4 #1). */}
          <p className="mt-6 text-[0.8125rem] text-fg-faint">Paper mode</p>
        </PageHeader>

        {/* Bottom marquee — set the tone immediately */}
        <TickerStrip items={TICKER_JARGON_D} />
      </section>

      {/* CHAPTER ZERO — the confession. The flagship chapter dissects the
          VWAP bug WE shipped. It goes first because it earns the right for
          everything below it to be believed. */}
      <div className={`shell pt-8 ${RAIL_GUTTER}`}>
        <Link
          href="/learn/broken-vwap"
          className="calm-panel calm-card flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4"
        >
          <i aria-hidden className="lit-aura" />
          <Chip tone="brand">Ch. 0 — the confession</Chip>
          <span className="font-display text-[1.0625rem] tracking-tight text-fg">Anatomy of a Broken VWAP</span>
          <span className="hidden text-[0.8125rem] text-fg-dim md:inline">
            We shipped it wrong · the full autopsy, with the live bug · toggle broken → fixed
          </span>
          <span className="calm-link ml-auto">
            Read the autopsy <span aria-hidden>›</span>
          </span>
        </Link>
      </div>

      <AnimatedDivider label="Enter the workbench" />

      {/* ═════════════════════════════════════════════════════════════════
          §01 REGIME ENGINE
          ═════════════════════════════════════════════════════════════════ */}
      <SplitDesk chapters={RUN_1} />

      <AnimatedDivider label="The primitives" />

      {/* ═════════════════════════════════════════════════════════════════
          §02 THREE PIECES
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="02" id="three-pieces" label="The three pieces">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            Dataset.
          </span>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.3s" }}>
            Bot.
          </span>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.5s" }}>
            Workspace.
          </span>
        </ChapterHeadline>

        <ChapterThesis>Three primitives. Every product surface is a remix.</ChapterThesis>

        <ChapterBody>
          Once you see them, the whole product clicks. The dataset is the chart you’re
          testing on. The bot is a trading rule that eats a chart and spits out a verdict. The
          workspace lets you stack as many bots as you want — they all see the same chart, and
          the output panel tallies who agreed.
        </ChapterBody>

        <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Piece
            num="01"
            title="Dataset"
            tldr="The chart you’re testing on."
            body="Real OHLCV from Yahoo Finance for AAPL, NVDA, BTC, NIFTY — anything Yahoo lists. Synthetic deterministic walks for symbols Yahoo doesn’t have. Same input → same answer, every time."
          />
          <Piece
            num="02"
            title="Bot"
            tldr="A trading rule. Eats a chart, spits out a verdict."
            body="Could be 70-year-old textbook math (Black-Scholes, RSI, SMA crossover) or a 2024 neural net trained on real markets. Either way the output is the same shape: a read of the window (up, down, flat or caution), never odds and never a forecast."
          />
          <Piece
            num="03"
            title="Workspace"
            tldr="Stack as many bots as you want."
            body="They all see the same chart, a window that ended 60 sessions ago. The Output panel tallies who agreed, then shows what the tape did next. When 5 trend bots and 3 AI bots read the same window the same way, that agreement is worth studying, and worth checking against what followed."
          />
        </div>
      </Chapter>

      <AnimatedDivider label="Real data · real math" />

      {/* §03–§08 — the sustained six-demo Desk (one pinned terminal). */}
      <SplitDesk chapters={RUN_2} />

      <AnimatedDivider label="The bot catalog" />

      {/* ═════════════════════════════════════════════════════════════════
          §09 BOT FAMILIES
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="09" id="families" label="The 5 families">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            27 bots,
          </span>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.32s" }}>
            organized so
          </span>
          <span className="block hero-headline-line text-fg-dim" style={{ animationDelay: "0.55s" }}>
            you don’t drown.
          </span>
        </ChapterHeadline>

        <ChapterThesis>AI · Trend · Stats · Risk · Options. Five tribes.</ChapterThesis>

        <ChapterBody>
          Every bot has its own page with the math, when it shines, when it fails, and a live
          demo running on real data. Click any to dive in. The hand-written specialty essays
          are the most honest bot documentation in retail finance — we tell you when each one
          breaks.
        </ChapterBody>

        {/* Big headline number */}
        <Stats
          className="mt-10"
          items={families.map((f) => ({ value: <BigStat value={f.bots.length} />, label: f.meta.label }))}
        />

        <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
          {families.map((f) => (
            <Link
              key={f.cat}
              href={f.bots.length > 0 ? `/learn/bots#${f.cat}` : "/learn/bots"}
              className="calm-panel calm-card group flex flex-col gap-3 p-6"
            >
              <i aria-hidden className="lit-aura" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[1rem] font-semibold tracking-[-0.01em] text-fg">{f.meta.label}</span>
                <span className="shrink-0 text-[0.8125rem] text-fg-faint transition-colors group-hover:text-brand-ink">
                  {f.bots.length} bots ›
                </span>
              </div>
              <p className="text-[0.9375rem] leading-relaxed text-fg-dim">{f.blurb}</p>
              {/* Three representative bots — the full roster lives on the
                  destination page this card already links to. */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {f.bots.slice(0, 3).map((b) => (
                  <Chip key={b.id}>
                    <span aria-hidden className="text-fg-faint">
                      {b.glyph}
                    </span>
                    {b.name}
                  </Chip>
                ))}
                {f.bots.length > 3 && (
                  <span className="text-[0.8125rem] text-fg-faint transition-colors group-hover:text-brand-ink">
                    +{f.bots.length - 3} more ›
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* The one mid-page marquee — the catalog's own tape. It lives INSIDE
            the chapter so it never stacks its horizontal scroll on top of an
            AnimatedDivider's at a seam (the L6 double-animation problem). */}
        <div className="mt-10">
          <TickerStrip items={TICKER_JARGON_A} />
        </div>
      </Chapter>

      <AnimatedDivider label="Stress test" />

      {/* ═════════════════════════════════════════════════════════════════
          §10 DATASET
          ═════════════════════════════════════════════════════════════════ */}
      {/* §10 — the Desk returns for the dataset stress-test. */}
      <SplitDesk chapters={RUN_3} />

      <AnimatedDivider label="ELI12" />

      {/* ═════════════════════════════════════════════════════════════════
          §11 TEACHER
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="11" id="teacher" label="Teacher mode">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            Toggle on.
          </span>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.32s" }}>
            The math
          </span>
          <span className="block hero-headline-line text-fg-dim" style={{ animationDelay: "0.55s" }}>
            reads like a story.
          </span>
        </ChapterHeadline>

        <ChapterThesis>Every bot ships hand-written explainers at age-12 level.</ChapterThesis>

        <ChapterBody>
          Every bot ships with a “Teacher” callout that explains its verdict at
          age-12 level. Hover any Greek on the trade page and you get a one-line explainer.
          The AI Teacher endpoint uses GPT-4o-mini when <Code>OPENAI_API_KEY</Code> is set;
          falls back to a hand-written mock if not.
        </ChapterBody>

        <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
          <CalmPanel>
            <div className="t-eyebrow text-fg-faint">Teacher · off</div>
            <div className="mt-4 space-y-2 font-mono text-[0.75rem] text-fg">
              <div>RSI 14 = 28.4. STATE: OVERSOLD.</div>
              <div className="text-fg-dim">3 reversion triggers in window.</div>
              <div className="text-fg-dim">Backtest return +4.2%.</div>
            </div>
            <Chip className="mt-4">Read up · 1 of 1 bots</Chip>
          </CalmPanel>
          <CalmPanel>
            <div className="t-eyebrow text-brand-ink">Teacher · on</div>
            <p className="mt-4 font-display text-lg leading-relaxed text-fg">
              RSI is a 0-to-100 thermometer. Below 30 meant sellers had pushed hard and fast,
              and three times in this window the price bounced from there. The bot counted
              those bounces —{" "}
              <span className="text-brand-ink">that’s why it reads up</span>. About this
              window, not the next one.
            </p>
          </CalmPanel>
        </div>
      </Chapter>

      <AnimatedDivider label="Hacker friendly" />

      {/* ═════════════════════════════════════════════════════════════════
          §12 BYO BOT
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="12" id="byob" label="Bring your own bot">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            If you can write
          </span>
          <span className="block hero-headline-line text-fg-dim" style={{ animationDelay: "0.32s" }}>
            a JS function,
          </span>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.55s" }}>
            you can write a bot.
          </span>
        </ChapterHeadline>

        <ChapterThesis>Paste a function. Hot-load it. Backtest it.</ChapterThesis>

        <ChapterBody>
          Click <Chip>+ Import your bot</Chip> in the bot library. Paste a function that takes{" "}
          <Code>candles + params</Code> and returns <Code>{`{ verdict, summary, metrics }`}</Code>
          . It hot-loads into the workspace.
        </ChapterBody>

        <div className="calm-panel mt-10 p-6 md:p-7">
          <i aria-hidden className="lit-aura" />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="t-eyebrow text-fg">Sample bot · 10 lines</span>
            <span className="t-label text-fg-faint">Copy · paste · run</span>
          </div>
          <pre className="mt-4 overflow-x-auto font-mono text-[0.75rem] leading-relaxed text-fg">
            {`// Example: a 10-line bot that buys 52-week breakouts.
export default {
  id: "my-breakout",
  name: "52w Breakout",
  category: "trend",
  glyph: "↑",
  tagline: "Buy when price hits a new 252-day high.",
  params: [{ key: "lookback", kind: "number", default: 252 }],
  run: (ctx, p) => {
    const px = ctx.candles.map(c => c.c);
    const high = Math.max(...px.slice(-p.lookback));
    const last = px[px.length - 1];
    const breakout = last >= high;
    return {
      signals: [],
      metrics: [{ key: "h", label: "52w high", value: high.toFixed(2) }],
      summary: \`Last \${last.toFixed(2)} vs \${p.lookback}d high \${high.toFixed(2)}.\`,
      verdict: { side: breakout ? "buy" : "hold", text: breakout ? "Fresh high." : "Below high.", confidence: breakout ? 0.7 : 0.2 },
    };
  },
};`}
          </pre>
        </div>
      </Chapter>

      <AnimatedDivider label="The machine layer" />

      {/* ═════════════════════════════════════════════════════════════════
          §13 AI QUANTS
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="13" id="ai-quants" label="The AI quants · honest">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            Two halves.
          </span>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.32s" }}>
            One workbench.
          </span>
        </ChapterHeadline>

        <ChapterThesis>12 AI bots. Real Python NN. Honest fallback chip.</ChapterThesis>

        <ChapterBody>
          The 12 AI bots delegate to a Python service in <Code>ai quants/serve.py</Code> that runs
          trained neural networks. When the service is up, you see{" "}
          <Chip dot>Source: Python NN</Chip> on every card. When it’s not, the bot falls back to a
          deterministic TS surrogate marked clearly{" "}
          <Chip tone="warn" dot>
            Source: Mock
          </Chip>
          .
        </ChapterBody>

        {/* Stat strip */}
        <Stats
          className="mt-10"
          items={[
            { value: <BigStat value={13} />, label: "trained ML models" },
            { value: <BigStat value={252} />, label: "bar lookback (transformer)" },
            { value: <BigStat value={0.1} decimals={1} />, label: "BS surrogate err %" },
            { value: <BigStat value={5} />, label: "option-pricing surrogates" },
          ]}
        />

        <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
          <ArchCard step="01" title="Browser" sub="React workbench" body="You click ▶ Run All in /quant. The bot’s run() function builds a request body." />
          <ArchCard step="02" title="callApi()" sub="POST /api/<endpoint>" body="aiBot() wrapper hits the FastAPI service (NEXT_PUBLIC_QUANTAI_URL) with an 8s timeout." />
          <ArchCard step="03" title="Python NN" sub="13 trained models" body="serve.py loads the right surrogate, runs predict(), returns JSON. The card flips green." />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="t-label text-fg-faint">Spin it up</span>
          <Code>cd "ai quants" && uvicorn serve:app --reload --port 8000</Code>
        </div>
      </Chapter>

      <AnimatedDivider label="Go" />

      {/* ═════════════════════════════════════════════════════════════════
          §14 NOW GO
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="14" id="now-go" label="Now go">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            That was
          </span>
          <span className="block hero-headline-line text-fg-dim" style={{ animationDelay: "0.3s" }}>
            the whole tour.
          </span>
          <span className="block w-fit hero-headline-line t-accent" style={{ animationDelay: "0.55s" }}>
            Try it.
          </span>
        </ChapterHeadline>

        <ChapterThesis>14 chapters down. The workbench is one click away.</ChapterThesis>

        <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
          <CTACard
            label="Open the workbench"
            sub="Clean slate · 27 bots loaded"
            href="/quant"
            primary
          />
          <CTACard
            label="Open the strategy builder"
            sub="Drag-build options strategies"
            href="/trade"
          />
          <CTACard
            label="Browse all 27 bots"
            sub="Encyclopedia · math + specialty + source"
            href="/learn/bots"
          />
        </div>

        {/* The payoff: your paper diploma, tallying the shots you called. */}
        <Diploma />

        <div className="mt-16 max-w-[60ch]">
          <div className="t-eyebrow text-fg-faint">End · colophon</div>
          <div className="mt-3 text-[1rem] leading-relaxed text-fg-dim">
            Set in <span className="text-fg">Fraunces</span> &{" "}
            <span className="text-fg">JetBrains Mono</span>. Charts hand-rolled in SVG;
            every line you see drew itself in. The Hurst slider, vol smile, Greek surface,
            and probability comparison are all real Black-Scholes math — not a screenshot, not
            a mock. Built on a laptop in 2026.
          </div>
        </div>
      </Chapter>

      <Footer marketing />
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Local components (chapter scaffolding)
// Calm (S1, 2026-11-09): every section sits straight on the page's aura. The
// watermarks, grids, crosshairs, bands and pulsing dots are gone, and the
// chapter headings are the kit's section heading, one size under the H1.
// ═════════════════════════════════════════════════════════════════════

function Chapter({
  num,
  id,
  label,
  children,
}: {
  num: string;
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id}>
      <div className={`shell section-y ${RAIL_GUTTER}`}>
        <div className="t-eyebrow text-brand-ink">
          Chapter {num} · {label}
        </div>
        {children}
      </div>
    </section>
  );
}

function ChapterHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] leading-[1] tracking-[-0.035em] text-fg text-balance">
      {children}
    </h2>
  );
}

function ChapterThesis({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 max-w-[60ch] font-display text-xl tracking-tight text-fg md:text-2xl">{children}</div>;
}

function ChapterBody({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 measure-wide text-[1.0625rem] leading-[1.6] text-fg-dim">{children}</div>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded-md bg-fg/[0.07] px-1.5 py-0.5 font-mono text-[0.8125rem] text-fg">{children}</code>;
}

function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <div className="calm-panel mt-10 p-8 md:p-10">
      <i aria-hidden className="lit-aura" />
      <div className="t-eyebrow text-fg-faint">Takeaway</div>
      <div className="mt-5 font-display text-2xl leading-snug tracking-tightest text-fg md:text-3xl">{children}</div>
    </div>
  );
}

function Piece({ num, title, tldr, body }: { num: string; title: string; tldr: string; body: string }) {
  return (
    <CalmPanel>
      <div className="t-label text-fg-faint">{num}</div>
      <div className="mt-4 font-display text-[clamp(1.75rem,3vw,2.25rem)] leading-[1] tracking-[-0.03em] text-fg">{title}</div>
      <div className="mt-3 text-[0.9375rem] font-medium text-fg">{tldr}</div>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-fg-dim">{body}</p>
    </CalmPanel>
  );
}

function ArchCard({ step, title, sub, body }: { step: string; title: string; sub: string; body: string }) {
  return (
    <CalmPanel>
      <div className="t-label text-fg-faint">{step}</div>
      <div className="mt-4 font-display text-[clamp(1.5rem,2.5vw,2rem)] leading-[1.05] tracking-[-0.03em] text-fg">{title}</div>
      <div className="mt-1 text-[0.8125rem] text-brand-ink">{sub}</div>
      <p className="mt-4 text-[0.9375rem] leading-relaxed text-fg-dim">{body}</p>
    </CalmPanel>
  );
}

function CTACard({ label, sub, href, primary }: { label: string; sub: string; href: string; primary?: boolean }) {
  return (
    <CalmPanel className="flex flex-col justify-between gap-8">
      <div>
        <div className="font-display text-[clamp(1.5rem,2.5vw,2rem)] leading-[1.05] tracking-[-0.03em] text-fg">{label}</div>
        <div className="mt-2 text-[0.875rem] text-fg-dim">{sub}</div>
      </div>
      <PillLink href={href} kind={primary ? "primary" : "secondary"} size="sm" className="self-start">
        Go
      </PillLink>
    </CalmPanel>
  );
}

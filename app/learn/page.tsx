import Link from "next/link";
import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { Footer } from "@/components/Footer";
import { BOT_REGISTRY } from "@/lib/quant/bots";
import { CATEGORY_META, type BotCategory } from "@/lib/quant/types";

// Visualizations (untouched)
import { LearnLiveDemo } from "@/components/learn/LearnLiveDemo";
import { LearnDatasetPlayground } from "@/components/learn/LearnDatasetPlayground";
import { LearnConsensusPlayground } from "@/components/learn/LearnConsensusPlayground";
import { LearnRegimeVisualizer } from "@/components/learn/LearnRegimeVisualizer";
import { LearnGreekSurface } from "@/components/learn/LearnGreekSurface";
import { LearnBacktestBuilder } from "@/components/learn/LearnBacktestBuilder";
import { LearnVolSmile } from "@/components/learn/LearnVolSmile";
import { LearnProbabilityComparison } from "@/components/learn/LearnProbabilityComparison";

// Ambient motion
import { BootSequence } from "@/components/learn/ambient/BootSequence";
import { ScrollProgressBar } from "@/components/learn/ambient/ScrollProgressBar";
import { SectionIndex } from "@/components/learn/ambient/SectionIndex";
import { TickerStrip } from "@/components/learn/ambient/TickerStrip";
import { AnimatedDivider } from "@/components/learn/ambient/AnimatedDivider";
import { BigStat } from "@/components/learn/ambient/BigStat";
import { LiveBadge } from "@/components/learn/ambient/LiveBadge";
import { DataStreamRail } from "@/components/learn/ambient/DataStreamRail";

export const metadata = {
  title: "Learn · Lazybull",
  description:
    "Trading, visualized. 14 chapters, 8 live demos, every chart responds to you. The most ambitious quant primer on the internet.",
};

const CATEGORY_ORDER: BotCategory[] = ["ai", "trend", "stats", "risk", "options", "custom"];
const CATEGORY_BLURB: Record<BotCategory, string> = {
  ai: "12 bots that delegate to a Python ML service — neural option pricers + ensemble direction forecasters trained on real Yahoo data.",
  trend: "Follow momentum. Buy the breakout, exit the reversal. SMA Crossover, MACD, Donchian, Bollinger.",
  stats: "Measure what's normal. Z-score, Hurst exponent, Kalman filter, LinReg channel.",
  risk: "How much to bet. Kelly criterion, Monte Carlo VaR, Sharpe optimiser.",
  options: "Pure math. Black-Scholes solver, IV crush detector, the wheel back-test.",
  custom: "Bots you imported yourself. Bring your own JS function, hot-load it.",
};

const TICKER_JARGON_A = [
  "REGIME", "HURST", "AUTOCORRELATION", "MEAN-REVERSION", "MOMENTUM",
  "ALPHA", "BETA", "SHARPE", "SORTINO", "CALMAR", "MAX DRAWDOWN",
  "WALK-FORWARD", "EMBARGO", "OUT-OF-SAMPLE", "INFORMATION COEFFICIENT",
];
const TICKER_JARGON_B = [
  "DELTA", "GAMMA", "THETA", "VEGA", "RHO", "VOL SMILE", "SKEW",
  "KURTOSIS", "FAT TAILS", "BLACK-SCHOLES", "HESTON", "MERTON JUMP",
  "IMPLIED VOL", "REALIZED VOL", "VEGA EXPOSURE",
];
const TICKER_JARGON_C = [
  "BOOTSTRAP", "QUANTILE", "PINBALL LOSS", "GBM", "MULBERRY32",
  "TRIPLE-BARRIER", "DE PRADO", "META-LABELING", "FRACTIONAL DIFF",
  "CV PURGED", "REGIME-AWARE", "BACKTEST", "PAPER TRADE", "KILL SWITCH",
];
const TICKER_JARGON_D = [
  "27 BOTS", "13 MODELS", "8 LIVE DEMOS", "0.4MS PRICING", "$100K PAPER",
  "GPT-4o-mini", "FASTAPI · :8000", "YAHOO FEED", "BLACK-SCHOLES · 1973",
  "HESTON · 1993", "MULBERRY32 · 2014", "ATR-BASED STOPS", "ENSEMBLE-OF-7",
];

export default function LearnPage() {
  const families = CATEGORY_ORDER.map((cat) => ({
    cat,
    meta: CATEGORY_META[cat],
    bots: BOT_REGISTRY.filter((b) => b.category === cat),
    blurb: CATEGORY_BLURB[cat],
  })).filter((f) => f.bots.length > 0);

  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      {/* Boot intro */}
      <BootSequence />
      {/* Sticky chrome */}
      <ScrollProgressBar />
      <LiveBadge />
      <SectionIndex />
      <DataStreamRail />

      <TickerBar />
      <Nav />

      {/* ─────────────────────────────────────────────────────────────────
          §00 HERO
          ───────────────────────────────────────────────────────────────── */}
      <section id="hero" className="relative overflow-hidden border-b border-border">
        {/* Massive watermark §00 */}
        <div
          className="pointer-events-none absolute -left-8 -top-12 select-none font-display font-light italic leading-[0.78] tracking-tightest watermark-drift"
          style={{ fontSize: "clamp(12rem, 26vw, 28rem)", color: "var(--fg)", opacity: 0.025 }}
          aria-hidden
        >
          §00
        </div>

        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute -left-40 top-20 h-[420px] w-[420px] rounded-full bg-bull/10 blur-[160px] drift" />
        <div
          className="pointer-events-none absolute right-0 top-40 h-[360px] w-[360px] rounded-full bg-cyan/10 blur-[160px] drift"
          style={{ animationDelay: "-6s" }}
        />
        <div className="pointer-events-none absolute inset-0 scanlines opacity-30" />

        {/* Top edge tape */}
        <div className="relative flex items-center justify-between border-b border-border-soft px-5 py-2 font-mono text-[9px] uppercase tracking-[0.3em] text-fg-faint">
          <div className="flex items-center gap-3">
            <span className="size-1 rounded-full bg-bull pulse-dot" />
            <span className="text-bull">LIVE FEED</span>
            <span>·</span>
            <span className="hidden sm:inline">EDITION 2026.05</span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">14 CHAPTERS</span>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">8 INTERACTIVE</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline">PAPER MODE</span>
            <span className="hidden md:inline">·</span>
            <span>NO CARD</span>
          </div>
        </div>

        <div className="relative mx-auto grid max-w-[1280px] grid-cols-12 gap-6 px-5 py-20 lg:py-28">
          {/* LEFT — editorial */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-10">
            {/* Eyebrow row */}
            <div
              className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] hero-fade-up-soft"
              style={{ animationDelay: "0.1s" }}
            >
              <span className="inline-flex items-center gap-2 border border-bull/40 bg-bull/5 px-2 py-1 text-bull">
                <span className="size-1.5 rounded-full bg-bull pulse-dot" /> LEARN · 8 MIN · ALL LIVE
              </span>
              <span className="inline-flex items-center gap-2 border border-border bg-surface px-2 py-1 text-fg-dim">
                EVERY CHART RESPONDS TO YOU
              </span>
              <span className="hidden md:inline-flex items-center gap-2 border border-cyan/30 bg-cyan/5 px-2 py-1 text-cyan">
                ↳ DRAG · TUNE · RUN
              </span>
            </div>

            {/* HEADLINE — editorial scale, word-by-word reveal */}
            <h1 className="font-display tracking-tightest leading-[0.86]" style={{ fontSize: "clamp(4.5rem, 13vw, 11rem)" }}>
              <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.3s" }}>
                Trading,
              </span>
              <span className="block" style={{ animationDelay: "0.65s" }}>
                <span
                  className="italic font-light text-bull pull-quote-glow inline-block"
                  style={{ animationDelay: "0.65s" }}
                >
                  visualized
                </span>
                <span
                  className="text-bull hero-fade-up inline-block"
                  style={{ animationDelay: "1.4s" }}
                >
                  .
                </span>
              </span>
            </h1>

            {/* Cyan italic subtitle — the 7-word recap */}
            <div
              className="max-w-[60ch] font-display italic font-light text-cyan text-2xl md:text-3xl tracking-tight hero-fade-up"
              style={{ animationDelay: "1.2s" }}
            >
              Eight live demos. Fourteen chapters. Zero textbooks.
            </div>

            <p
              className="max-w-[58ch] text-balance font-display text-lg leading-relaxed text-fg-dim md:text-xl hero-fade-up"
              style={{ animationDelay: "1.45s" }}
            >
              Most quant tutorials are walls of text with one screenshot. Ours is the opposite:
              every concept on this page comes with a chart you can drag, a slider that morphs
              the market, or a bot you can run in real time. Read it like a book — but every
              page <span className="text-fg italic">argues with you</span>.
            </p>

            <div
              className="flex flex-wrap items-center gap-3 hero-fade-up"
              style={{ animationDelay: "1.65s" }}
            >
              <a
                href="#regime"
                className="group inline-flex items-center gap-3 bg-bull px-6 py-4 font-mono text-xs font-semibold uppercase tracking-[0.3em] text-bg transition-colors hover:bg-bull-dim"
                style={{ boxShadow: "0 0 40px -8px rgba(0,255,135,0.5)" }}
              >
                ▶ Begin chapter 01
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M1 7l6 6 6-6" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </a>
              <Link
                href="/quant"
                className="inline-flex items-center gap-2 border border-border bg-surface px-4 py-4 font-mono text-[11px] uppercase tracking-[0.3em] text-fg-dim hover:border-bull hover:text-bull"
              >
                Skip — open the workbench →
              </Link>
            </div>
          </div>

          {/* RIGHT — Big Stats column */}
          <div
            className="col-span-12 lg:col-span-4 flex flex-col gap-8 hero-fade-up"
            style={{ animationDelay: "1.0s" }}
          >
            <div className="border border-border bg-surface p-6">
              <div className="mb-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint">
                <span className="flex items-center gap-2">
                  <span className="size-1 rounded-full bg-bull pulse-dot" />
                  IN THIS PAGE
                </span>
                <span>v0.1</span>
              </div>
              <BigStat value={27} label="bots in the registry" tone="bull" size="md" />
            </div>
            <div className="border border-border bg-surface p-6">
              <BigStat value={13} label="trained ML models" tone="cyan" size="md" />
            </div>
            <div className="border border-border bg-surface p-6">
              <BigStat value={8} label="interactive demos" tone="amber" size="md" />
            </div>
          </div>
        </div>

        {/* Bottom marquee — set the tone immediately */}
        <TickerStrip items={TICKER_JARGON_D} />
      </section>

      <AnimatedDivider num="00→01" label="ENTER THE WORKBENCH" />

      {/* ═════════════════════════════════════════════════════════════════
          §01 REGIME ENGINE
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="01" id="regime" label="THE MARKET HAS THREE MODES" bg="soft">
        <ChapterHeadline>
          <span className="block hero-headline-line italic font-light text-bull pull-quote-glow" style={{ animationDelay: "0.1s" }}>
            Trending.
          </span>
          <span className="block hero-headline-line italic font-light text-fg-dim" style={{ animationDelay: "0.32s" }}>
            Random.
          </span>
          <span className="block hero-headline-line italic font-light text-cyan" style={{ animationDelay: "0.55s" }}>
            Reverting.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          One slider. Three regimes. Three winning bots.
        </div>

        <ChapterBody para="01.A">
          Every market — every stock, every minute, every quarter — sits somewhere on this
          spectrum. The single most important question in quant trading is{" "}
          <span className="text-fg italic">which regime are you in right now</span>, because the
          answer tells you which bot family will pay off and which will burn you. Drag the
          knob below; watch the chart morph. The Hurst exponent — the number controlling the
          drag — is what our regime detector reads off real markets.
        </ChapterBody>

        {/* Stat strip */}
        <div className="mt-12 grid grid-cols-3 gap-px bg-border border border-border">
          <div className="bg-bg p-5">
            <BigStat value={0.5} label="random walk threshold" tone="fg-faint" size="sm" decimals={2} />
          </div>
          <div className="bg-bg p-5">
            <BigStat value={0.3} label="strongly mean-reverting" tone="cyan" size="sm" decimals={2} />
          </div>
          <div className="bg-bg p-5">
            <BigStat value={0.7} label="strongly trending" tone="bull" size="sm" decimals={2} />
          </div>
        </div>

        <TerminalFrame label="TERMINAL §01" hint="DRAG THE KNOB →">
          <LearnRegimeVisualizer />
        </TerminalFrame>

        <Takeaway>
          "The bot that wins in a trend{" "}
          <span className="text-bear italic">dies in a chop</span>.
          Detect first, act second."
        </Takeaway>
      </Chapter>

      <TickerStrip items={TICKER_JARGON_A} reverse />
      <AnimatedDivider num="01→02" label="THE PRIMITIVES" />

      {/* ═════════════════════════════════════════════════════════════════
          §02 THREE PIECES
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="02" id="three-pieces" label="THE THREE PIECES">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            Dataset.
          </span>
          <span className="block hero-headline-line italic font-light text-bull" style={{ animationDelay: "0.3s" }}>
            Bot.
          </span>
          <span className="block hero-headline-line italic font-light text-amber" style={{ animationDelay: "0.5s" }}>
            Workspace.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          Three primitives. Every product surface is a remix.
        </div>

        <ChapterBody para="02.A">
          Once you see them, the whole product clicks. The dataset is the chart you&apos;re
          testing on. The bot is a trading rule that eats a chart and spits out a verdict. The
          workspace lets you stack as many bots as you want — they all see the same chart, and
          the output panel tallies who agreed.
        </ChapterBody>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
          <Piece
            num="01"
            tone="bull"
            title="Dataset"
            tldr="The chart you're testing on."
            body="Real OHLCV from Yahoo Finance for AAPL, NVDA, BTC, NIFTY — anything Yahoo lists. Synthetic deterministic walks for symbols Yahoo doesn't have. Same input → same answer, every time."
          />
          <Piece
            num="02"
            tone="cyan"
            title="Bot"
            tldr="A trading rule. Eats a chart, spits out a verdict."
            body="Could be 70-year-old textbook math (Black-Scholes, RSI, SMA crossover) or a 2024 neural net trained on real markets. Either way the output is the same shape: BUY / SELL / HOLD / WARN with a confidence score."
          />
          <Piece
            num="03"
            tone="amber"
            title="Workspace"
            tldr="Stack as many bots as you want."
            body="They all see the same chart. The Output panel tallies who agreed. When 5 trend bots and 3 AI bots all flash BUY at the same time, that's a signal worth noticing."
          />
        </div>
      </Chapter>

      <AnimatedDivider num="02→03" label="REAL DATA · REAL MATH" />

      {/* ═════════════════════════════════════════════════════════════════
          §03 LIVE DEMO
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="03" id="live-demo" label="LIVE DEMO" bg="soft">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            One bot.
          </span>
          <span className="block hero-headline-line italic font-light text-bull" style={{ animationDelay: "0.3s" }}>
            One chart.
          </span>
          <span className="block hero-headline-line italic font-light text-fg-dim" style={{ animationDelay: "0.5s" }}>
            Nothing fake.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          SMA crossover. Real AMZN bars. Drag the periods.
        </div>

        <ChapterBody para="03.A">
          Below is the textbook moving-average-crossover bot, running on real AMZN daily bars
          fetched from Yahoo on page load. Drag the period sliders — the math recomputes
          instantly, in your browser, with no round-trip. Every signal you see was just
          computed by your CPU.
        </ChapterBody>

        <TerminalFrame label="TERMINAL §03" hint="LIVE · YAHOO FEED">
          <LearnLiveDemo />
        </TerminalFrame>
      </Chapter>

      <TickerStrip items={TICKER_JARGON_C} />
      <AnimatedDivider num="03→04" label="EQUITY CURVES" />

      {/* ═════════════════════════════════════════════════════════════════
          §04 BACKTEST
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="04" id="backtest" label="BACKTEST IN MOTION">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            Same bot.
          </span>
          <span className="block hero-headline-line italic font-light text-bull" style={{ animationDelay: "0.3s" }}>
            Wins one regime,
          </span>
          <span className="block hero-headline-line italic font-light text-bear pull-quote-glow" style={{ animationDelay: "0.5s" }}>
            loses the next.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          Sharpe matters. Drawdown matters. Pure return doesn&apos;t.
        </div>

        <ChapterBody para="04.A">
          Pick a bot. Pick a market scenario. Hit run. The equity curve builds bar by bar in
          real time, with Sharpe, max drawdown, and win rate filling in as the simulation
          progresses. That&apos;s when it clicks: high return ≠ good strategy. You want
          <span className="text-fg italic"> Sharpe</span> — return per unit of bumpy ride —
          not just upside.
        </ChapterBody>

        <TerminalFrame label="TERMINAL §04" hint="6 BOTS × 3 SCENARIOS">
          <LearnBacktestBuilder />
        </TerminalFrame>

        <Takeaway>
          "<span className="text-bull italic">Sharpe &gt; 1</span> separates real edge from
          lucky upside. Most retail strategies don&apos;t clear it."
        </Takeaway>
      </Chapter>

      <AnimatedDivider num="04→05" label="STACK & VOTE" />

      {/* ═════════════════════════════════════════════════════════════════
          §05 CONSENSUS
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="05" id="consensus" label="WHY STACK BOTS" bg="soft">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg-dim" style={{ animationDelay: "0.1s" }}>
            One bot is
          </span>
          <span className="block hero-headline-line italic font-light text-fg" style={{ animationDelay: "0.3s" }}>
            a guess.
          </span>
          <span className="block hero-headline-line italic font-light text-bull pull-quote-glow" style={{ animationDelay: "0.55s" }}>
            Six agreeing
          </span>
          <span className="block hero-headline-line text-fg-dim" style={{ animationDelay: "0.78s" }}>
            is a signal.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          Toggle bots. Watch tier flip. Agreement is the alpha.
        </div>

        <ChapterBody para="05.A">
          Watch the conviction band slide as more models fall into line. Tweak the dataset —
          drift, vol, seed — and see how robust the agreement is. That&apos;s how a workbench
          separates real edges from chart-pattern wishful thinking. The historical accuracy
          band of <span className="text-bull italic">ULTRA tier</span> consensus is 65–77% on
          embargoed walk-forward CV.
        </ChapterBody>

        <TerminalFrame label="TERMINAL §05" hint="12 BOTS · 3 SCENARIOS">
          <LearnConsensusPlayground />
        </TerminalFrame>
      </Chapter>

      <TickerStrip items={TICKER_JARGON_B} reverse speed="slow" />
      <AnimatedDivider num="05→06" label="THE GREEK PANTHEON" />

      {/* ═════════════════════════════════════════════════════════════════
          §06 GREEKS
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="06" id="greeks" label="THE GREEKS, DANCING">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            Five numbers
          </span>
          <span className="block hero-headline-line italic font-light text-cyan pull-quote-glow" style={{ animationDelay: "0.32s" }}>
            tell you everything
          </span>
          <span className="block hero-headline-line italic font-light text-fg-dim" style={{ animationDelay: "0.55s" }}>
            about an option.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          Drag the strike. All five Greeks update at once.
        </div>

        <ChapterBody para="06.A">
          Delta, Gamma, Theta, Vega, Rho. Drag the strike below — every Greek updates
          simultaneously. Hover any of them for a one-line plain-English explanation. By the
          time you&apos;ve dragged the strike across the smile, you&apos;ll have the intuitions
          textbooks take chapters to build.
        </ChapterBody>

        {/* Greek-letter watermarks */}
        <div className="mt-12 grid grid-cols-5 gap-2 border border-border bg-surface p-6">
          {[
            { sym: "Δ", label: "Delta", tone: "var(--bull)" },
            { sym: "Γ", label: "Gamma", tone: "var(--cyan)" },
            { sym: "Θ", label: "Theta", tone: "var(--amber)" },
            { sym: "ν", label: "Vega", tone: "var(--plasma)" },
            { sym: "ρ", label: "Rho", tone: "var(--bear)" },
          ].map((g) => (
            <div key={g.sym} className="text-center">
              <div className="font-display italic font-light leading-none" style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", color: g.tone }}>
                {g.sym}
              </div>
              <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.3em] text-fg-faint">{g.label}</div>
            </div>
          ))}
        </div>

        <TerminalFrame label="TERMINAL §06" hint="DRAG STRIKE · HOVER GREEK">
          <LearnGreekSurface />
        </TerminalFrame>
      </Chapter>

      <AnimatedDivider num="06→07" label="THE SMILE" />

      {/* ═════════════════════════════════════════════════════════════════
          §07 VOL SMILE
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="07" id="volsmile" label="THE VOL SMILE" bg="soft">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            A 15%-OTM put
          </span>
          <span className="block hero-headline-line italic font-light text-fg-dim" style={{ animationDelay: "0.32s" }}>
            costs more than
          </span>
          <span className="block hero-headline-line italic font-light text-plasma pull-quote-glow" style={{ animationDelay: "0.55s" }}>
            a 15%-OTM call.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          Crashes happen faster than rallies. The market knows.
        </div>

        <ChapterBody para="07.A">
          Black-Scholes assumes one flat volatility. Real markets don&apos;t. Out-of-the-money
          puts trade at higher implied vol than equidistant calls because the market knows
          crashes happen faster than rallies. Drag the skew and kurtosis sliders to see
          exactly how far reality drifts from the textbook.
        </ChapterBody>

        <TerminalFrame label="TERMINAL §07" hint="SKEW · KURTOSIS">
          <LearnVolSmile />
        </TerminalFrame>

        <Takeaway>
          "Black-Scholes is a beautiful model.{" "}
          <span className="text-plasma italic">Heston is a useful one.</span>"
        </Takeaway>
      </Chapter>

      <TickerStrip items={TICKER_JARGON_B} />
      <AnimatedDivider num="07→08" label="MODEL RISK" />

      {/* ═════════════════════════════════════════════════════════════════
          §08 PROBABILITY
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="08" id="probability" label="PROBABILITY · THREE WAYS">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            Three models.
          </span>
          <span className="block hero-headline-line italic font-light text-fg-dim" style={{ animationDelay: "0.32s" }}>
            One question.
          </span>
          <span className="block hero-headline-line italic font-light text-amber pull-quote-glow" style={{ animationDelay: "0.55s" }}>
            Three answers.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          The gap is model risk. Most platforms hide it.
        </div>

        <ChapterBody para="08.A">
          &quot;Will the price land in this band by expiry?&quot; Black-Scholes, Monte Carlo,
          and an empirical fat-tailed model give you three different probabilities. Drag the
          band into the wings and watch them disagree. That gap is{" "}
          <span className="text-fg italic">model risk</span> — a real cost most retail
          platforms hide from you.
        </ChapterBody>

        <TerminalFrame label="TERMINAL §08" hint="DRAG THE BAND">
          <LearnProbabilityComparison />
        </TerminalFrame>
      </Chapter>

      <AnimatedDivider num="08→09" label="THE BOT CATALOG" />

      {/* ═════════════════════════════════════════════════════════════════
          §09 BOT FAMILIES
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="09" id="families" label="THE 5 FAMILIES" bg="soft">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            27 bots,
          </span>
          <span className="block hero-headline-line italic font-light text-bull" style={{ animationDelay: "0.32s" }}>
            organized so
          </span>
          <span className="block hero-headline-line italic font-light text-fg-dim" style={{ animationDelay: "0.55s" }}>
            you don&apos;t drown.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          AI · Trend · Stats · Risk · Options. Five tribes.
        </div>

        <ChapterBody para="09.A">
          Every bot has its own page with the math, when it shines, when it fails, and a live
          demo running on real data. Click any to dive in. The hand-written specialty essays
          are the most honest bot documentation in retail finance — we tell you when each one
          breaks.
        </ChapterBody>

        {/* Big headline number */}
        <div className="mt-12 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-5">
          {families.map((f) => (
            <div key={f.cat} className="bg-bg p-5">
              <BigStat
                value={f.bots.length}
                label={`${f.meta.label.toLowerCase()}`}
                tone={(f.cat === "ai" ? "bear" : f.cat === "trend" ? "bull" : f.cat === "stats" ? "cyan" : f.cat === "risk" ? "amber" : "plasma") as "bear" | "bull" | "cyan" | "amber" | "plasma"}
                size="sm"
              />
            </div>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-2">
          {families.map((f) => (
            <Link
              key={f.cat}
              href={f.bots.length > 0 ? `/learn/bots#${f.cat}` : "/learn/bots"}
              className="group flex flex-col gap-3 border border-border bg-surface p-6 transition-all hover:border-bull/60 hover:bg-bull/[0.03]"
            >
              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.4em]"
                  style={{ color: f.meta.color }}
                >
                  {f.meta.label}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint group-hover:text-bull">
                  {f.bots.length} bots →
                </span>
              </div>
              <p className="font-display text-base leading-relaxed text-fg-dim">{f.blurb}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {f.bots.slice(0, 6).map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1.5 border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-fg-dim"
                  >
                    <span style={{ color: f.meta.color }}>{b.glyph}</span>
                    {b.name}
                  </span>
                ))}
                {f.bots.length > 6 && (
                  <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint">
                    +{f.bots.length - 6} more
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </Chapter>

      <TickerStrip items={TICKER_JARGON_A} />
      <AnimatedDivider num="09→10" label="STRESS TEST" />

      {/* ═════════════════════════════════════════════════════════════════
          §10 DATASET
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="10" id="dataset" label="STRESS-TEST ANY MARKET">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            Five knobs.
          </span>
          <span className="block hero-headline-line italic font-light text-fg-dim" style={{ animationDelay: "0.32s" }}>
            Each in
          </span>
          <span className="block hero-headline-line italic font-light text-amber" style={{ animationDelay: "0.55s" }}>
            plain English.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          Symbol · Bars · Seed · Drift · Vol. Click any.
        </div>

        <ChapterBody para="10.A">
          The dataset card on every quant page lets you stress-test bots against any market.
          Drag each slider — the chart redraws deterministically. Same seed, same chart, every
          time. That&apos;s reproducibility nobody else in retail finance offers.
        </ChapterBody>

        <TerminalFrame label="TERMINAL §10" hint="CLICK A KNOB → LEARN IT">
          <LearnDatasetPlayground />
        </TerminalFrame>
      </Chapter>

      <AnimatedDivider num="10→11" label="ELI12" />

      {/* ═════════════════════════════════════════════════════════════════
          §11 TEACHER
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="11" id="teacher" label="TEACHER MODE" bg="soft">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            Toggle on.
          </span>
          <span className="block hero-headline-line italic font-light text-bull" style={{ animationDelay: "0.32s" }}>
            The math
          </span>
          <span className="block hero-headline-line italic font-light text-fg-dim" style={{ animationDelay: "0.55s" }}>
            reads like a story.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          Every bot ships hand-written explainers at age-12 level.
        </div>

        <ChapterBody para="11.A">
          Every bot ships with a &quot;Teacher&quot; callout that explains its verdict at
          age-12 level. Hover any Greek on the trade page and you get a one-line explainer.
          The AI Teacher endpoint uses GPT-4o-mini when{" "}
          <code className="mx-1 border border-border bg-surface px-1 text-fg">OPENAI_API_KEY</code>{" "}
          is set; falls back to a hand-written mock if not.
        </ChapterBody>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="relative border border-border bg-surface p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint">
              ◯ TEACHER · OFF
            </div>
            <div className="mt-4 space-y-2 font-mono text-[12px] text-fg">
              <div>RSI 14 = 28.4. STATE: OVERSOLD.</div>
              <div className="text-fg-dim">3 reversion triggers in window.</div>
              <div className="text-fg-dim">Backtest return +4.2%.</div>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 border border-bull/30 bg-bull/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.3em] text-bull">
              BUY · 78% CONF
            </div>
          </div>
          <div className="relative border-l-2 border-bull bg-bull/5 p-6">
            <div className="absolute right-4 top-4 size-2 rounded-full bg-bull pulse-dot" />
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-bull">
              ● TEACHER · ON
            </div>
            <p className="mt-4 font-display text-lg leading-relaxed text-fg">
              RSI is a 0-to-100 thermometer. Below 30 means everyone panicked and the price
              is probably going to bounce. The bot just spotted three of those bounces in
              your window —{" "}
              <span className="italic text-bull">that&apos;s why it leans BUY</span> with high
              confidence.
            </p>
          </div>
        </div>
      </Chapter>

      <TickerStrip items={TICKER_JARGON_C} reverse />
      <AnimatedDivider num="11→12" label="HACKER FRIENDLY" />

      {/* ═════════════════════════════════════════════════════════════════
          §12 BYO BOT
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="12" id="byob" label="BRING YOUR OWN BOT">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            If you can write
          </span>
          <span className="block hero-headline-line italic font-light text-fg-dim" style={{ animationDelay: "0.32s" }}>
            a JS function,
          </span>
          <span className="block hero-headline-line italic font-light text-bull pull-quote-glow" style={{ animationDelay: "0.55s" }}>
            you can write a bot.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          Paste a function. Hot-load it. Backtest it.
        </div>

        <ChapterBody para="12.A">
          Click{" "}
          <span className="border border-dashed border-border bg-bg px-1.5 py-0.5 font-mono text-[11px] text-fg">
            + Import your bot
          </span>{" "}
          in the bot library. Paste a function that takes{" "}
          <code className="border border-border bg-surface px-1 font-mono text-[11px] text-fg">
            candles + params
          </code>{" "}
          and returns{" "}
          <code className="border border-border bg-surface px-1 font-mono text-[11px] text-fg">
            {`{ verdict, summary, metrics }`}
          </code>
          . It hot-loads into the workspace.
        </ChapterBody>

        <div className="mt-12 relative">
          <div className="absolute -top-3 left-0 z-10 flex items-center gap-2 bg-bg px-2 font-mono text-[9px] uppercase tracking-[0.3em]">
            <span className="size-1 rounded-full bg-bull pulse-dot" />
            <span className="text-bull">SAMPLE BOT · 10 LINES</span>
            <span className="text-fg-faint">·</span>
            <span className="text-fg-faint">COPY · PASTE · RUN</span>
          </div>
          <pre className="overflow-x-auto border border-border bg-bg p-7 font-mono text-[12px] leading-relaxed text-fg">
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

      <AnimatedDivider num="12→13" label="THE MACHINE LAYER" />

      {/* ═════════════════════════════════════════════════════════════════
          §13 AI QUANTS
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="13" id="ai-quants" label="THE AI QUANTS · HONEST" bg="soft">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            Two halves.
          </span>
          <span className="block hero-headline-line italic font-light text-bull" style={{ animationDelay: "0.32s" }}>
            One workbench.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          12 AI bots. Real Python NN. Honest fallback chip.
        </div>

        <ChapterBody para="13.A">
          The 12 AI bots delegate to a Python service in{" "}
          <code className="mx-1 border border-border bg-surface px-1 font-mono text-[11px] text-fg">
            ai quants/serve.py
          </code>{" "}
          that runs trained neural networks. When the service is up, you see{" "}
          <span className="ml-1 inline-flex items-center gap-1 border border-bull/30 bg-bull/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.3em] text-bull">
            <span className="size-1 rounded-full bg-bull pulse-dot" />
            Source: Python NN
          </span>
          {" "}on every card. When it&apos;s not, the bot falls back to a deterministic TS
          surrogate marked clearly{" "}
          <span className="ml-1 inline-flex items-center gap-1 border border-amber/30 bg-amber/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.3em] text-amber">
            <span className="size-1 rounded-full bg-amber" />
            Source: Mock
          </span>
          .
        </ChapterBody>

        {/* Stat strip */}
        <div className="mt-12 grid grid-cols-2 gap-px bg-border md:grid-cols-4">
          <div className="bg-bg p-5">
            <BigStat value={13} label="trained ml models" tone="bull" size="sm" />
          </div>
          <div className="bg-bg p-5">
            <BigStat value={252} label="bar lookback (transformer)" tone="cyan" size="sm" />
          </div>
          <div className="bg-bg p-5">
            <BigStat value={0.1} label="bs surrogate err %" tone="amber" decimals={1} size="sm" />
          </div>
          <div className="bg-bg p-5">
            <BigStat value={77} label="ultra-tier accuracy %" tone="plasma" size="sm" />
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-3">
          <ArchCard step="01" title="Browser" sub="React workbench" body="You click ▶ Run All in /quant. The bot's run() function builds a request body." />
          <ArchCard step="02" title="callApi()" sub="POST /api/<endpoint>" body="aiBot() wrapper hits the FastAPI service (NEXT_PUBLIC_QUANTAI_URL) with an 8s timeout." />
          <ArchCard step="03" title="Python NN" sub="13 trained models" body="serve.py loads the right surrogate, runs predict(), returns JSON. The card flips green." />
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3 border border-border bg-surface px-4 py-3 font-mono text-[11px] uppercase tracking-[0.3em] text-fg-dim">
          <span className="text-fg-faint">▮ SPIN IT UP</span>
          <code className="border border-border bg-bg px-3 py-1 text-bull">
            cd "ai quants" && uvicorn serve:app --reload --port 8000
          </code>
        </div>
      </Chapter>

      <TickerStrip items={TICKER_JARGON_D} />
      <AnimatedDivider num="13→14" label="GO" />

      {/* ═════════════════════════════════════════════════════════════════
          §14 NOW GO
          ═════════════════════════════════════════════════════════════════ */}
      <Chapter num="14" id="now-go" label="NOW GO">
        <ChapterHeadline>
          <span className="block hero-headline-line text-fg" style={{ animationDelay: "0.1s" }}>
            That was
          </span>
          <span className="block hero-headline-line italic font-light text-fg-dim" style={{ animationDelay: "0.3s" }}>
            the whole tour.
          </span>
          <span className="block hero-headline-line italic font-light text-bull pull-quote-glow" style={{ animationDelay: "0.55s" }}>
            Try it.
          </span>
        </ChapterHeadline>

        <div className="mt-6 max-w-[60ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
          <span className="text-cyan/60 mr-2">↳</span>
          14 chapters down. The workbench is one click away.
        </div>

        <div className="mt-16 grid grid-cols-1 gap-3 md:grid-cols-3">
          <CTACard
            label="Open the workbench"
            sub="Clean slate · 27 bots loaded"
            href="/quant"
            primary
          />
          <CTACard
            label="See the visual chain"
            sub="Drag-build options strategies"
            href="/trade"
          />
          <CTACard
            label="Browse all 27 bots"
            sub="Encyclopedia · math + specialty + source"
            href="/learn/bots"
          />
        </div>

        <div className="mt-20 border-t border-border pt-12">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.4em] text-fg-faint">
              END · COLOPHON
            </div>
            <div className="col-span-12 md:col-span-9 font-display italic font-light text-fg-dim leading-relaxed text-lg max-w-[60ch]">
              Set in <span className="text-fg">Fraunces</span> &{" "}
              <span className="text-fg">JetBrains Mono</span>. Charts hand-rolled in SVG;
              every line you see drew itself in. The Hurst slider, vol smile, Greek surface,
              and probability comparison are all real Black-Scholes math — not a screenshot, not
              a mock. Built on a laptop in 2026.
            </div>
          </div>
        </div>
      </Chapter>

      <Footer />
    </main>
  );
}

// ═════════════════════════════════════════════════════════════════════
// Local components (chapter scaffolding)
// ═════════════════════════════════════════════════════════════════════

function Chapter({
  num,
  id,
  label,
  bg = "default",
  children,
}: {
  num: string;
  id: string;
  label: string;
  bg?: "default" | "soft";
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`relative overflow-hidden border-b border-border ${bg === "soft" ? "bg-bg-soft" : ""}`}
    >
      {/* Massive watermark §N */}
      <div
        className="pointer-events-none absolute -left-8 top-12 select-none font-display font-light italic leading-[0.78] tracking-tightest watermark-drift"
        style={{ fontSize: "clamp(11rem, 24vw, 24rem)", color: "var(--fg)", opacity: 0.022 }}
        aria-hidden
      >
        §{num}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />

      {/* Top-right corner crosshair */}
      <div
        className="pointer-events-none absolute right-6 top-6 hidden size-8 lg:block"
        aria-hidden
      >
        <div className="absolute inset-0 crosshair-sweep">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-fg-faint/30" />
          <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-fg-faint/30" />
          <div className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bull/60" />
        </div>
      </div>

      <div className="relative mx-auto max-w-[1280px] px-5 py-24 lg:py-32">
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.4em] text-fg-faint chapter-rise">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          <span className="text-fg-dim">CHAPTER {num}</span>
          <span className="h-px w-12 bg-border" />
          <span className="text-bull">{label}</span>
        </div>
        {children}
      </div>
    </section>
  );
}

function ChapterHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mt-12 font-display tracking-tightest leading-[0.86]"
      style={{ fontSize: "clamp(3rem, 8vw, 7rem)" }}
    >
      {children}
    </h2>
  );
}

function ChapterBody({
  para,
  children,
}: {
  para?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-12 grid grid-cols-12 gap-6">
      {para && (
        <div className="col-span-12 md:col-span-1 font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint">
          ¶ {para}
        </div>
      )}
      <div className={para ? "col-span-12 md:col-span-11" : "col-span-12"}>
        <div className="max-w-[64ch] font-display text-xl leading-relaxed text-fg-dim">
          {children}
        </div>
      </div>
    </div>
  );
}

function TerminalFrame({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative mt-20">
      <div className="absolute -top-3 left-0 right-0 z-10 flex items-center justify-between bg-bg px-2">
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.3em]">
          <span className="size-1 rounded-full bg-bull pulse-dot" />
          <span className="text-bull">{label}</span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-faint">INTERACTIVE</span>
        </div>
        {hint && (
          <div className="font-mono text-[9px] uppercase tracking-[0.3em] text-fg-faint">
            {hint}
          </div>
        )}
      </div>
      <div className="relative border border-border bg-bg p-5 sm:p-7 ambient-glow">
        <div className="pointer-events-none absolute -left-px -top-px size-3 border-l border-t border-bull" />
        <div className="pointer-events-none absolute -right-px -top-px size-3 border-r border-t border-bull" />
        <div className="pointer-events-none absolute -left-px -bottom-px size-3 border-l border-b border-bull" />
        <div className="pointer-events-none absolute -right-px -bottom-px size-3 border-r border-b border-bull" />
        {children}
      </div>
    </div>
  );
}

function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-20 border-t border-border pt-14">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-3 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.4em] text-fg-faint">
          <span className="size-1.5 rounded-full bg-bull pulse-dot" />
          <span>TAKEAWAY</span>
        </div>
        <div className="col-span-12 md:col-span-9">
          <div
            className="font-display italic font-light tracking-tightest leading-[1.05] text-fg"
            style={{ fontSize: "clamp(1.8rem, 4vw, 3.6rem)" }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Piece({ num, tone, title, tldr, body }: { num: string; tone: "bull" | "cyan" | "amber"; title: string; tldr: string; body: string }) {
  const color = tone === "bull" ? "var(--bull)" : tone === "cyan" ? "var(--cyan)" : "var(--amber)";
  return (
    <div className="bg-bg p-8 transition-colors hover:bg-bg-soft">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint">{num}</span>
        <span className="size-2" style={{ background: color }} />
      </div>
      <div
        className="mt-6 font-display italic font-light leading-[0.9] tracking-tightest"
        style={{ color, fontSize: "clamp(2.5rem, 5vw, 4rem)" }}
      >
        {title}
      </div>
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-fg-dim">{tldr}</div>
      <p className="mt-5 font-display text-base leading-relaxed text-fg-dim">{body}</p>
    </div>
  );
}

function ArchCard({ step, title, sub, body }: { step: string; title: string; sub: string; body: string }) {
  return (
    <div className="border border-border bg-surface p-6">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.4em] text-fg-faint">
        <span>{step}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-4 font-display italic font-light tracking-tightest text-fg" style={{ fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
        {title}
      </div>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.3em] text-cyan">{sub}</div>
      <p className="mt-4 font-display text-base leading-relaxed text-fg-dim">{body}</p>
    </div>
  );
}

function CTACard({ label, sub, href, primary }: { label: string; sub: string; href: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between gap-8 p-8 transition-all ${
        primary
          ? "bg-bull text-bg hover:bg-bull-dim"
          : "border border-border bg-bg text-fg hover:border-bull hover:text-bull"
      }`}
      style={primary ? { boxShadow: "0 0 50px -12px rgba(0,255,135,0.5)" } : undefined}
    >
      <div>
        <div
          className="font-display italic font-light leading-[0.95] tracking-tightest"
          style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)" }}
        >
          {label}
        </div>
        <div className={`mt-3 font-mono text-[10px] uppercase tracking-[0.3em] ${primary ? "text-bg/70" : "text-fg-faint"}`}>
          {sub}
        </div>
      </div>
      <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em]">
        ▶ GO
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </div>
    </Link>
  );
}

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { Footer } from "@/components/Footer";
import { BOT_REGISTRY } from "@/lib/quant/bots";
import { CATEGORY_META, type BotCategory } from "@/lib/quant/types";
import { LearnLiveDemo } from "@/components/learn/LearnLiveDemo";
import { LearnDatasetPlayground } from "@/components/learn/LearnDatasetPlayground";
import { LearnConsensusPlayground } from "@/components/learn/LearnConsensusPlayground";

export const metadata = {
  title: "Learn · Lazybull",
  description: "How the Lazybull workbench works in 3 minutes — datasets, bots, and stacking signals like Lego blocks.",
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

export default function LearnPage() {
  const families = CATEGORY_ORDER.map((cat) => ({
    cat,
    meta: CATEGORY_META[cat],
    bots: BOT_REGISTRY.filter((b) => b.category === cat),
    blurb: CATEGORY_BLURB[cat],
  })).filter((f) => f.bots.length > 0);

  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />

      {/* Hero — one sentence, one CTA */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
        <div className="pointer-events-none absolute -left-40 top-20 h-[420px] w-[420px] rounded-full bg-bull/10 blur-[160px]" />
        <div className="relative mx-auto flex max-w-[1100px] flex-col items-start gap-8 px-5 py-20 lg:py-28">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
            <span className="inline-flex items-center gap-2 border border-bull/40 bg-bull/5 px-2 py-1 text-bull">
              <span className="size-1.5 rounded-full bg-bull pulse-dot" /> Learn · 3 minutes
            </span>
            <span className="inline-flex items-center gap-2 border border-border bg-surface px-2 py-1 text-fg-dim">
              for the curious, not just quants
            </span>
          </div>
          <h1 className="font-display tracking-tightest text-[clamp(2.8rem,7.6vw,6.6rem)] leading-[0.92] text-fg">
            What is
            <br />
            <span className="italic font-light text-bull">Lazybull</span>?
          </h1>
          <p className="max-w-[60ch] text-balance text-base leading-relaxed text-fg-dim md:text-lg">
            A workbench where you stack trading models like Lego blocks, run them
            on a chart, and see if they agree. Nothing to install, nothing to risk.
            Real data on the chart, real math under the hood, AI explainers in
            plain English.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#three-pieces"
              className="group inline-flex items-center gap-3 bg-fg px-5 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-bull"
            >
              Show me how it works
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v12M1 7l6 6 6-6" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </a>
            <Link
              href="/quant"
              className="inline-flex items-center gap-2 border border-border bg-surface px-4 py-3.5 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-bull hover:text-bull"
            >
              Skip — open the workbench →
            </Link>
          </div>
          <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-wider text-fg-faint">
            <span>· 27 bots</span>
            <span>· real Yahoo data</span>
            <span>· paper money</span>
            <span>· no card</span>
          </div>
        </div>
      </section>

      {/* Section 1 — The three pieces */}
      <section id="three-pieces" className="relative border-b border-border bg-bg-soft">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="relative mx-auto max-w-[1200px] px-5 py-20">
          <SectionEyebrow num="01" label="The three pieces" />
          <h2 className="mt-3 max-w-[28ch] font-display text-[clamp(1.8rem,3.6vw,3.2rem)] tracking-tightest leading-[1.05]">
            Dataset. Bot. Workspace.
            <span className="text-fg-dim italic"> That's it.</span>
          </h2>
          <p className="mt-4 max-w-[60ch] text-base text-fg-dim leading-relaxed">
            Every page on Lazybull is a remix of the same three primitives.
            Once you see them, the whole product clicks.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
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
        </div>
      </section>

      {/* Section 2 — Live demo */}
      <section className="relative border-b border-border">
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <SectionEyebrow num="02" label="Live demo" />
          <h2 className="mt-3 max-w-[28ch] font-display text-[clamp(1.8rem,3.6vw,3.2rem)] tracking-tightest leading-[1.05]">
            One bot, one chart,
            <span className="text-fg-dim italic"> nothing fake.</span>
          </h2>
          <p className="mt-4 max-w-[60ch] text-base text-fg-dim leading-relaxed">
            Below is a real <span className="text-fg">SMA Crossover</span> bot
            running on real AMZN bars. Drag the period sliders — the math
            recomputes instantly, in your browser, with no round-trip.
          </p>

          <div className="mt-10">
            <LearnLiveDemo />
          </div>
        </div>
      </section>

      {/* Section 3 — Why stack bots */}
      <section className="relative border-b border-border bg-bg-soft">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="relative mx-auto max-w-[1200px] px-5 py-20">
          <SectionEyebrow num="03" label="Why stack bots" />
          <h2 className="mt-3 max-w-[36ch] font-display text-[clamp(1.8rem,3.6vw,3.2rem)] tracking-tightest leading-[1.05]">
            One bot is a guess.
            <br />
            <span className="italic font-light text-bull">Six agreeing</span> is a signal.
          </h2>
          <p className="mt-4 max-w-[60ch] text-base text-fg-dim leading-relaxed">
            Watch the conviction band slide as more models fall into line.
            Tweak the dataset — drift, vol, seed — and see how robust the
            agreement is. That's how a workbench separates real edges from
            chart-pattern wishful thinking.
          </p>

          <div className="mt-10">
            <LearnConsensusPlayground />
          </div>
        </div>
      </section>

      {/* Section 4 — Bot families */}
      <section className="relative border-b border-border">
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <SectionEyebrow num="04" label="The 5 bot families" />
          <h2 className="mt-3 max-w-[36ch] font-display text-[clamp(1.8rem,3.6vw,3.2rem)] tracking-tightest leading-[1.05]">
            27 bots, organised so you don't drown.
          </h2>
          <p className="mt-4 max-w-[60ch] text-base text-fg-dim leading-relaxed">
            Every bot has its own page with the math, when it shines, when it
            fails, and a live demo. Click any to dive in.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-2">
            {families.map((f) => (
              <Link
                key={f.cat}
                href={f.bots.length > 0 ? `/learn/bots#${f.cat}` : "/learn/bots"}
                className="group flex flex-col gap-3 border border-border bg-surface p-5 transition-colors hover:border-bull/60 hover:bg-bull/[0.03]"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="font-mono text-[10px] uppercase tracking-wider"
                    style={{ color: f.meta.color }}
                  >
                    {f.meta.label}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint group-hover:text-bull">
                    {f.bots.length} bots →
                  </span>
                </div>
                <p className="text-[14px] leading-relaxed text-fg-dim">
                  {f.blurb}
                </p>
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
                    <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                      +{f.bots.length - 6} more
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5 — Dataset sliders */}
      <section className="relative border-b border-border bg-bg-soft">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="relative mx-auto max-w-[1200px] px-5 py-20">
          <SectionEyebrow num="05" label="The dataset sliders" />
          <h2 className="mt-3 max-w-[36ch] font-display text-[clamp(1.8rem,3.6vw,3.2rem)] tracking-tightest leading-[1.05]">
            5 knobs.
            <span className="text-fg-dim italic"> Each in plain English.</span>
          </h2>
          <p className="mt-4 max-w-[60ch] text-base text-fg-dim leading-relaxed">
            The dataset card on every quant page lets you stress-test bots
            against any market. Drag each slider — the chart redraws
            deterministically.
          </p>

          <div className="mt-10">
            <LearnDatasetPlayground />
          </div>
        </div>
      </section>

      {/* Section 6 — Teacher mode */}
      <section className="relative border-b border-border">
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <SectionEyebrow num="06" label="Teacher mode" />
          <h2 className="mt-3 max-w-[36ch] font-display text-[clamp(1.8rem,3.6vw,3.2rem)] tracking-tightest leading-[1.05]">
            Toggle on. The math
            <span className="text-fg-dim italic"> reads like a story.</span>
          </h2>
          <p className="mt-4 max-w-[60ch] text-base text-fg-dim leading-relaxed">
            Every bot ships with a "Teacher" callout that explains its verdict
            at age-12 level. Hover any Greek on the trade page and you get a
            one-line explainer. The AI Teacher endpoint uses GPT-4o-mini when
            <code className="mx-1 border border-border bg-surface px-1 text-fg">OPENAI_API_KEY</code>
            is set; falls back to a hand-written mock if not.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="border border-border bg-surface p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                Teacher OFF
              </div>
              <div className="mt-3 font-mono text-[12px] text-fg">
                <div>RSI 14 = 28.4. State: OVERSOLD.</div>
                <div className="mt-1 text-fg-dim">3 reversion triggers in window. Backtest return +4.2%.</div>
              </div>
              <div className="mt-3 inline-flex items-center gap-2 border border-bull/30 bg-bull/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-bull">
                BUY · 78% conf
              </div>
            </div>
            <div className="border-l-2 border-bull bg-bull/5 p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-bull">
                Teacher ON
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-fg">
                RSI is a 0-to-100 thermometer. Below 30 means everyone panicked
                and the price is probably going to bounce. The bot just spotted
                three of those bounces in your window — that's why it leans
                <span className="text-bull font-semibold"> BUY</span> with high
                confidence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 7 — Bring your own bot */}
      <section className="relative border-b border-border bg-bg-soft">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="relative mx-auto max-w-[1200px] px-5 py-20">
          <SectionEyebrow num="07" label="Bring your own bot" />
          <h2 className="mt-3 max-w-[36ch] font-display text-[clamp(1.8rem,3.6vw,3.2rem)] tracking-tightest leading-[1.05]">
            If you can write a JS function,
            <br />
            <span className="italic font-light text-bull">you can write a bot.</span>
          </h2>
          <p className="mt-4 max-w-[60ch] text-base text-fg-dim leading-relaxed">
            Click <span className="border border-dashed border-border bg-bg px-1.5 py-0.5 font-mono text-[11px] text-fg">+ Import your bot</span>
            in the bot library. Paste a function that takes <code className="border border-border bg-surface px-1 font-mono text-[11px] text-fg">candles + params</code>
            and returns <code className="border border-border bg-surface px-1 font-mono text-[11px] text-fg">{`{ verdict, summary, metrics }`}</code>.
            It hot-loads into the workspace.
          </p>

          <pre className="mt-8 overflow-x-auto border border-border bg-bg p-5 font-mono text-[12px] leading-relaxed text-fg">
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
      </section>

      {/* Section 8 — AI quants honest disclosure */}
      <section className="relative border-b border-border">
        <div className="mx-auto max-w-[1200px] px-5 py-20">
          <SectionEyebrow num="08" label="The AI quants — honest version" />
          <h2 className="mt-3 max-w-[36ch] font-display text-[clamp(1.8rem,3.6vw,3.2rem)] tracking-tightest leading-[1.05]">
            Two halves of the same workbench.
          </h2>
          <p className="mt-4 max-w-[60ch] text-base text-fg-dim leading-relaxed">
            The 12 AI bots delegate to a Python service in
            <code className="mx-1 border border-border bg-surface px-1 font-mono text-[11px] text-fg">ai quants/serve.py</code>
            that runs trained neural networks. When the service is up, you see
            <span className="ml-1 inline-flex items-center gap-1 border border-bull/30 bg-bull/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-bull">
              <span className="size-1 rounded-full bg-bull pulse-dot" />
              Source: Python NN
            </span>
            on every card. When it's not, the bot falls back to a deterministic
            TS surrogate and shows
            <span className="ml-1 inline-flex items-center gap-1 border border-amber/30 bg-amber/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber">
              <span className="size-1 rounded-full bg-amber" />
              Source: Mock
            </span>
            — same shape, deterministic answer, marked clearly.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            <ArchCard step="01" title="Browser" sub="React workbench" body="You click ▶ Run All in /quant. The bot's run() function builds a request body." />
            <ArchCard step="02" title="callApi()" sub="POST /api/<endpoint>" body="aiBot() wrapper hits the FastAPI service at localhost:8000 with an 8s timeout." />
            <ArchCard step="03" title="Python NN" sub="13 trained models" body="serve.py loads the right surrogate, runs predict(), returns JSON. The card flips green." />
          </div>

          <div className="mt-8 inline-flex items-center gap-3 border border-border bg-surface px-4 py-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
            <span className="text-fg-faint">spin it up</span>
            <code className="border border-border bg-bg px-2 py-0.5 text-fg">cd "ai quants" && uvicorn serve:app --reload --port 8000</code>
          </div>
        </div>
      </section>

      {/* Section 9 — Now go */}
      <section className="relative border-b border-border bg-bg-soft">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        <div className="relative mx-auto max-w-[1200px] px-5 py-20">
          <SectionEyebrow num="09" label="Now go" />
          <h2 className="mt-3 max-w-[36ch] font-display text-[clamp(2rem,4vw,3.6rem)] tracking-tightest leading-[1.05]">
            That was the whole tour.
            <br />
            <span className="italic font-light text-bull">Try it.</span>
          </h2>

          <div className="mt-10 grid grid-cols-1 gap-3 md:grid-cols-3">
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
              sub="Encyclopedia · math + specialty"
              href="/learn/bots"
            />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function SectionEyebrow({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
      <span>⟢ {num}</span>
      <span className="h-px w-12 bg-border" />
      <span className="text-bull">{label}</span>
    </div>
  );
}

function Piece({
  num,
  tone,
  title,
  tldr,
  body,
}: {
  num: string;
  tone: "bull" | "cyan" | "amber";
  title: string;
  tldr: string;
  body: string;
}) {
  const color =
    tone === "bull" ? "var(--bull)" : tone === "cyan" ? "var(--cyan)" : "var(--amber)";
  return (
    <div className="bg-bg p-6 transition-colors hover:bg-bg-soft">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          {num}
        </span>
        <span className="size-2" style={{ background: color }} />
      </div>
      <div className="mt-4 font-display text-3xl tracking-tightest" style={{ color }}>
        {title}
      </div>
      <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
        {tldr}
      </div>
      <p className="mt-4 text-[14px] leading-relaxed text-fg-dim">{body}</p>
    </div>
  );
}

function ArchCard({ step, title, sub, body }: { step: string; title: string; sub: string; body: string }) {
  return (
    <div className="border border-border bg-surface p-5">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        <span>{step}</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="mt-3 font-display text-2xl tracking-tightest text-fg">{title}</div>
      <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-cyan">{sub}</div>
      <p className="mt-3 text-[13px] leading-relaxed text-fg-dim">{body}</p>
    </div>
  );
}

function CTACard({
  label,
  sub,
  href,
  primary,
}: {
  label: string;
  sub: string;
  href: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col justify-between gap-6 p-6 transition-colors ${
        primary
          ? "bg-bull text-bg hover:bg-bull-dim"
          : "border border-border bg-bg text-fg hover:border-bull hover:text-bull"
      }`}
    >
      <div>
        <div className="font-display text-2xl tracking-tightest leading-tight">{label}</div>
        <div className={`mt-1 font-mono text-[11px] uppercase tracking-wider ${primary ? "text-bg/70" : "text-fg-faint"}`}>
          {sub}
        </div>
      </div>
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
        Go
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </div>
    </Link>
  );
}

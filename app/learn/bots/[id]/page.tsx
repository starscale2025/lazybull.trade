import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { TickerBar } from "@/components/TickerBar";
import { Footer } from "@/components/Footer";
import { BOT_REGISTRY, getBot } from "@/lib/quant/bots";
import { CATEGORY_META } from "@/lib/quant/types";
import { BOT_CONTENT, BOT_SIMPLE } from "@/lib/quant/bot-content";
import { getBotSource } from "@/lib/quant/bot-source";
import { LearnBotDemo } from "@/components/learn/LearnBotDemo";
import { LearnApiStatus } from "@/components/learn/LearnApiStatus";

export function generateStaticParams() {
  return BOT_REGISTRY.map((b) => ({ id: b.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bot = getBot(id);
  if (!bot) return { title: "Bot not found · Lazybull" };
  return {
    title: `${bot.name} · Lazybull Learn`,
    description: bot.tagline,
  };
}

export default async function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bot = getBot(id);
  if (!bot) notFound();

  const cat = CATEGORY_META[bot.category];
  const content = BOT_CONTENT[bot.id] ?? {};
  const simple = content.simple ?? BOT_SIMPLE[bot.id] ?? null;
  const source = getBotSource(bot.id);
  const isAi = bot.category === "ai";

  // Related: same-category siblings + curated cross-pairings.
  const sameCat = BOT_REGISTRY.filter((b) => b.category === bot.category && b.id !== bot.id).slice(0, 4);
  const curated = (content.related ?? []).map(getBot).filter((b): b is NonNullable<typeof b> => Boolean(b));
  const related = [...curated, ...sameCat]
    .filter((b, i, arr) => arr.findIndex((x) => x.id === b.id) === i)
    .slice(0, 6);

  return (
    <main className="flex min-h-screen flex-col bg-bg text-fg">
      <TickerBar />
      <Nav />

      {/* Breadcrumb */}
      <section className="border-b border-border bg-bg-soft">
        <div className="mx-auto flex max-w-[1100px] items-center gap-2 px-5 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
          <Link href="/learn" className="hover:text-fg">Learn</Link>
          <span>/</span>
          <Link href="/learn/bots" className="hover:text-fg">Bots</Link>
          <span>/</span>
          <span className="text-fg">{bot.name}</span>
        </div>
      </section>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
        <div
          className="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full blur-[160px]"
          style={{ background: `${cat.color}33` }}
        />
        <div className="relative mx-auto max-w-[1100px] px-5 py-14">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-wider">
              <span
                className="inline-flex items-center gap-2 border px-2 py-1"
                style={{ borderColor: `${cat.color}66`, color: cat.color, background: `${cat.color}10` }}
              >
                <span className="size-1.5" style={{ background: cat.color }} />
                {cat.label}
              </span>
              {isAi && (
                <span className="border border-bear/50 bg-bear/10 px-2 py-1 text-bear">AI</span>
              )}
              <span className="text-fg-faint">id · {bot.id}</span>
            </div>

            <div className="flex items-end gap-5">
              <span
                className="grid size-20 shrink-0 place-items-center border-2 bg-bg font-display text-4xl"
                style={{ borderColor: cat.color, color: cat.color }}
              >
                {bot.glyph}
              </span>
              <div>
                <h1 className="font-display text-[clamp(2.4rem,5.5vw,4.4rem)] tracking-tightest leading-[0.95] text-fg">
                  {bot.name}
                </h1>
                <p className="mt-2 max-w-[58ch] text-base leading-relaxed text-fg-dim">
                  {bot.tagline}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/quant?add=${bot.id}`}
                className="inline-flex items-center gap-2 bg-bull px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim"
              >
                ▶ Try it now
              </Link>
              <Link
                href="/learn/bots"
                className="inline-flex items-center gap-2 border border-border bg-surface px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-bull hover:text-bull"
              >
                ↗ Browse all 27
              </Link>
              {bot.module && (
                <span className="inline-flex items-center gap-2 border border-border bg-bg px-3 py-2.5 font-mono text-[11px] tracking-wider text-fg-dim">
                  <span className="text-fg-faint uppercase mr-1">src</span>
                  <span className="text-fg">{bot.module}</span>
                </span>
              )}
              {bot.endpoint && (
                <span className="inline-flex items-center gap-2 border border-border bg-bg px-3 py-2.5 font-mono text-[11px] tracking-wider text-fg-dim">
                  <span className="text-fg-faint uppercase mr-1">api</span>
                  <span className="text-cyan">{bot.endpoint}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* In plain English — the simple version. Always shown when available. */}
      {simple && (
        <section className="border-b border-border bg-bull/[0.04]">
          <div className="mx-auto max-w-[1100px] px-5 py-12">
            <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-bull">
              <span>⟢</span>
              <span className="h-px w-12 bg-bull/40" />
              <span>In plain English</span>
            </div>
            <p className="mt-4 max-w-[68ch] text-balance text-[1.35rem] leading-relaxed text-fg md:text-2xl">
              {simple}
            </p>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              No jargon. Just what this bot does.
            </div>
          </div>
        </section>
      )}

      {/* TL;DR — slightly more technical pitch */}
      <section className="border-b border-border bg-bg-soft">
        <div className="mx-auto max-w-[1100px] px-5 py-14">
          <SectionLabel>The longer version</SectionLabel>
          <p className="mt-4 max-w-[68ch] text-balance text-lg leading-relaxed text-fg">
            {content.intro ?? defaultIntro(bot.name, bot.tagline)}
          </p>
        </div>
      </section>

      {/* The math */}
      {bot.formula && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1100px] px-5 py-14">
            <SectionLabel>The math</SectionLabel>
            <div className="mt-4 border border-border bg-bg p-6">
              <div className="font-mono text-[11px] uppercase tracking-wider text-fg-faint mb-3">formula</div>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-base leading-relaxed text-fg">{bot.formula}</pre>
            </div>
            {bot.params.length > 0 && (
              <div className="mt-6 border border-border bg-surface">
                <div className="border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  parameters
                </div>
                <div className="divide-y divide-border-soft">
                  {bot.params.map((p) => (
                    <div key={p.key} className="grid grid-cols-12 gap-3 px-3 py-3 text-[12px]">
                      <span className="col-span-3 font-mono text-fg">{p.key}</span>
                      <span className="col-span-3 text-fg-dim">{p.label}</span>
                      <span className="col-span-3 font-mono text-fg-faint">
                        {p.kind === "number" && `range ${p.min ?? "—"} → ${p.max ?? "—"}`}
                        {p.kind === "select" && `choices: ${p.options.map((o) => o.value).join(", ")}`}
                        {p.kind === "boolean" && "on / off"}
                      </span>
                      <span className="col-span-3 font-mono text-fg-dim">
                        default · <span className="text-fg">{String(p.default)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Live demo */}
      <section className="border-b border-border bg-bg-soft">
        <div className="mx-auto max-w-[1100px] px-5 py-14">
          <SectionLabel>Live demo</SectionLabel>
          <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-fg-dim">
            Real {bot.name} bot, running on real Yahoo data when the symbol is
            available. Drag the params — the bot re-runs instantly.
          </p>
          <div className="mt-8">
            <LearnBotDemo botId={bot.id} />
          </div>
        </div>
      </section>

      {/* Source code — the actual code that runs in your browser. Read at
          build time from lib/quant/bots.ts or lib/quant/ai-bots.ts. */}
      {source && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1100px] px-5 py-14">
            <SectionLabel>Source code · public</SectionLabel>
            <p className="mt-3 max-w-[68ch] text-base leading-relaxed text-fg-dim">
              This is the actual code the bot runs — not a re-explanation, not a
              simplified version. Whatever ships here is what executes when you
              press Run All in the workbench. Read it, copy it, fork it, build a
              better one.
            </p>

            <div className="mt-6 border border-border bg-bg">
              <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
                <div className="flex items-center gap-3 text-fg-dim">
                  <span className="text-bull">●</span>
                  <span>{source.filename}</span>
                  <span className="text-fg-faint">·</span>
                  <span className="text-fg-faint">
                    lines {source.startLine}–{source.endLine}
                  </span>
                </div>
                <span className="text-fg-faint">TypeScript · MIT-licensed</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[12px] leading-relaxed text-fg">
                <code>{source.code}</code>
              </pre>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 text-[12px] text-fg-dim md:grid-cols-2">
              <div className="border border-border bg-surface p-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint mb-1">
                  what each piece means
                </div>
                <ul className="space-y-1.5 text-[12px] leading-relaxed">
                  <li><code className="text-cyan">id</code> — unique key the workbench uses to find the bot.</li>
                  <li><code className="text-cyan">params</code> — the sliders + inputs you see on the cell.</li>
                  <li><code className="text-cyan">run(ctx, p)</code> — the function that gets called with candles + your params and returns the verdict.</li>
                  <li><code className="text-cyan">verdict</code> — the BUY / SELL / HOLD pill at the top of the cell.</li>
                  <li><code className="text-cyan">metrics</code> — the small stat boxes shown in the cell body.</li>
                </ul>
              </div>
              <div className="border border-border bg-surface p-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint mb-1">
                  use this code yourself
                </div>
                <ol className="space-y-1.5 text-[12px] leading-relaxed list-decimal pl-4">
                  <li>Copy the whole block above.</li>
                  <li>On <a href="/quant" className="text-bull hover:underline">/quant</a>, click <span className="border border-dashed border-border px-1">+ Import your bot</span> in the bot library.</li>
                  <li>Paste, hit save. It hot-loads into your workspace.</li>
                  <li>Edit any param defaults or logic to your taste — it&apos;s now yours.</li>
                </ol>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Specialty */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1100px] px-5 py-14">
          <SectionLabel>Specialty · when it shines, when it fails</SectionLabel>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="border-l-2 border-bull bg-bull/5 p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-bull mb-3">
                ✓ Shines when
              </div>
              <ul className="space-y-3 text-[14px] leading-relaxed text-fg">
                {(content.shines ?? defaultShines(bot.category)).map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-bull">·</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-l-2 border-bear bg-bear/5 p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-bear mb-3">
                ✗ Fails when
              </div>
              <ul className="space-y-3 text-[14px] leading-relaxed text-fg">
                {(content.fails ?? defaultFails(bot.category)).map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-bear">·</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How to read the verdict */}
      <section className="border-b border-border bg-bg-soft">
        <div className="mx-auto max-w-[1100px] px-5 py-14">
          <SectionLabel>How to read its verdict</SectionLabel>
          <p className="mt-4 max-w-[68ch] text-[15px] leading-relaxed text-fg">
            {content.verdict ?? defaultVerdict(bot.name)}
          </p>
        </div>
      </section>

      {/* AI-only: service status + flow diagram */}
      {isAi && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-[1100px] px-5 py-14">
            <SectionLabel>Python service</SectionLabel>
            <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-fg-dim">
              This bot tries to call the FastAPI service first. When it's up,
              you get real model output. When it's down, the bot transparently
              falls back to a deterministic TS surrogate.
            </p>

            <div className="mt-6">
              <LearnApiStatus endpoint={bot.endpoint ?? "/health"} />
            </div>

            <div className="mt-6 border border-border bg-surface">
              <div className="border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                data flow
              </div>
              <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-5">
                {[
                  { step: "01", title: "BotCell.run()", body: "User clicks Run on this bot in /quant" },
                  { step: "02", title: "callApi()", body: "POST to " + (process.env.NEXT_PUBLIC_QUANTAI_URL || "localhost:8000") + (bot.endpoint ?? "") },
                  { step: "03", title: "load_surrogate()", body: bot.module ?? "Python service loads the trained model" },
                  { step: "04", title: "predict()", body: "Forward pass on the inputs you provided" },
                  { step: "05", title: "BotResult", body: "JSON returned, card flips green Source: Python NN" },
                ].map((s) => (
                  <div key={s.step} className="bg-bg p-4">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">{s.step}</div>
                    <div className="mt-2 font-mono text-[12px] tracking-wide text-fg">{s.title}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-fg-dim">{s.body}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 border border-border bg-bg p-3 font-mono text-[11px] tracking-wider text-fg-dim">
              <span className="text-fg-faint uppercase mr-2">spin it up</span>
              <code className="text-fg">cd "ai quants" && uvicorn serve:app --reload --port 8000</code>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {(content.faq && content.faq.length > 0) && (
        <section className="border-b border-border bg-bg-soft">
          <div className="mx-auto max-w-[1100px] px-5 py-14">
            <SectionLabel>FAQ</SectionLabel>
            <div className="mt-6 divide-y divide-border-soft border border-border bg-surface">
              {content.faq.map((q, i) => (
                <details key={i} className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 hover:bg-bg-soft">
                    <span className="font-display text-base tracking-tightest text-fg">{q.q}</span>
                    <span className="font-mono text-fg-faint group-open:hidden">+</span>
                    <span className="font-mono text-fg-faint hidden group-open:inline">−</span>
                  </summary>
                  <div className="border-t border-border-soft bg-bg px-5 py-4 text-[14px] leading-relaxed text-fg-dim">
                    {q.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Related */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1100px] px-5 py-14">
          <SectionLabel>Related bots</SectionLabel>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            {related.map((r) => {
              const rcat = CATEGORY_META[r.category];
              return (
                <Link
                  key={r.id}
                  href={`/learn/bots/${r.id}`}
                  className="group flex items-start gap-3 border border-border bg-surface p-4 hover:border-bull/50 hover:bg-bull/[0.03]"
                >
                  <span
                    className="grid size-8 shrink-0 place-items-center border border-border bg-bg font-mono text-[12px]"
                    style={{ color: rcat.color }}
                  >
                    {r.glyph}
                  </span>
                  <div>
                    <div className="font-display text-[15px] tracking-tightest text-fg">
                      {r.name}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider" style={{ color: rcat.color }}>
                      {rcat.label}
                    </div>
                    <p className="mt-2 line-clamp-2 text-[12px] text-fg-dim">{r.tagline}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer CTAs */}
      <section className="border-b border-border bg-bg-soft">
        <div className="mx-auto max-w-[1100px] px-5 py-14">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link href="/learn" className="font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-bull">
                ← Back to Learn
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/learn/bots"
                className="inline-flex items-center gap-2 border border-border bg-bg px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-bull hover:text-bull"
              >
                Browse all bots
              </Link>
              <Link
                href={`/quant?add=${bot.id}`}
                className="inline-flex items-center gap-2 bg-bull px-4 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg hover:bg-bull-dim"
              >
                Try {bot.name} →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint">
      <span>⟢</span>
      <span className="h-px w-12 bg-border" />
      <span className="text-bull">{children}</span>
    </div>
  );
}

function defaultIntro(name: string, tagline: string): string {
  return `${name}: ${tagline} The full hand-written explainer for this bot is on the way — for now you have the math, the params, a live demo, and the FAQ below.`;
}
function defaultShines(category: string): string[] {
  if (category === "trend") return [
    "Persistent trends with low whipsaw frequency.",
    "Daily and weekly timeframes — slow indicators need bars to breathe.",
    "Combined with a higher-timeframe filter to dampen noise.",
  ];
  if (category === "stats") return [
    "Range-bound or oscillating regimes where the statistical model has stationary behaviour.",
    "Pair-trading and stat-arb setups against a benchmark.",
    "Tickers with at least 250 bars of history so the estimators converge.",
  ];
  if (category === "risk") return [
    "Position-sizing decisions, not entry signals.",
    "Long-horizon planning — Kelly and Sharpe both assume returns are i.i.d., which only holds out at slower frequencies.",
    "Combined with a directional bot to give it something to size.",
  ];
  if (category === "options") return [
    "European-style equity options inside the model's training distribution.",
    "When you need Greeks alongside price, not just price.",
    "Sanity-checking live chain quotes against fair value.",
  ];
  if (category === "ai") return [
    "Liquid US large caps with rich macro context.",
    "When the FastAPI service is up — the Python NN runs trained models on real Yahoo data.",
    "Multi-week horizons. Day-trading is out of scope.",
  ];
  return [
    "When the dataset matches the assumptions of the underlying math.",
    "When you want a second opinion alongside other bots.",
  ];
}
function defaultFails(category: string): string[] {
  if (category === "trend") return [
    "Choppy / range-bound markets. Every false breakout becomes a fresh signal.",
    "Earnings gaps. Indicators lag by definition.",
    "Mean-reverting assets where the trend bot keeps catching reversals.",
  ];
  if (category === "stats") return [
    "Strong trends. The mean-reversion assumption breaks; the bot keeps fading the move.",
    "Regime shifts. The estimators were fit to a different distribution.",
    "Highly illiquid names where the price series is too sparse to estimate parameters reliably.",
  ];
  if (category === "risk") return [
    "Low edge or negative-EV trades — Kelly will return zero or refuse to bet, which surprises some users.",
    "Non-stationary volatility. VaR estimates are only as good as the historical window.",
    "Short horizons. Sharpe is meaningless on intraday samples.",
  ];
  if (category === "options") return [
    "Exotic options or any contract style outside the training distribution.",
    "Extreme IV regimes (>200%) where the surrogate hasn't seen examples.",
    "Live-chain decisioning when the chain feed itself is stale or partial.",
  ];
  if (category === "ai") return [
    "Regime breaks (COVID, 2022, post-earnings gaps). The training set was smoother.",
    "Source: Mock — when the FastAPI service is offline, the bot is using a TS surrogate, not the real model.",
    "Out-of-distribution tickers (illiquid small caps, FX, crypto).",
  ];
  return [
    "When the dataset violates the bot's underlying assumptions.",
    "When you treat the bot's verdict as a single source of truth without checking the consensus.",
  ];
}
function defaultVerdict(name: string): string {
  return `The verdict pill summarises ${name}'s output as BUY / SELL / HOLD / WARN with a confidence score from 0 to 1. Each bot computes that confidence from its own internal signal — for a trend bot it's typically the gap between the indicator lines, for a probabilistic bot it's the deviation from the noise floor. Use it to weight ensemble votes, not as a hard threshold.`;
}

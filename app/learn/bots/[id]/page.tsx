import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CalmLink, CalmPanel, Chip, PageHeader, PillLink } from "@/components/calm/kit";
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
  if (!bot) return { title: "Bot not found · lazybull" };
  return {
    title: `${bot.name} · lazybull Learn`,
    description: bot.tagline,
    // Without this every one of the 27 bot pages inherited the root
    // canonical and told Google it was a copy of the homepage.
    alternates: { canonical: `/learn/bots/${bot.id}` },
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
    <main className="page-aura flex min-h-screen flex-col bg-bg text-fg">
      <Nav />

      <PageHeader
        eyebrow={
          <>
            <Link href="/learn" className="hover:text-fg">
              Learn
            </Link>
            {" · "}
            <Link href="/learn/bots" className="hover:text-fg">
              Bots
            </Link>
          </>
        }
        title={bot.name}
        lede={bot.tagline}
        actions={
          <>
            <PillLink href={`/quant?add=${bot.id}`} kind="primary">
              Try it now
            </PillLink>
            <CalmLink href="/learn/bots">Browse all 27</CalmLink>
          </>
        }
      >
        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-fg/[0.07] font-display text-xl text-fg-dim">
            {bot.glyph}
          </span>
          <Chip>{cat.label}</Chip>
          {isAi && <Chip>AI</Chip>}
        </div>
      </PageHeader>

      {/* In plain English — simple lead, technical follow-on, one panel. */}
      <section>
        <div className="shell pb-[clamp(2.5rem,6vw,3.5rem)]">
          <div className="calm-panel p-6 md:p-8">
            <i aria-hidden className="lit-aura" />
            <div className="t-eyebrow text-brand-ink">In plain English</div>
            {simple && (
              <p className="mt-4 max-w-[68ch] text-balance text-[1.35rem] leading-relaxed text-fg md:text-2xl">
                {simple}
              </p>
            )}
            <p className="mt-4 max-w-[68ch] t-body-sm leading-relaxed text-fg-dim">
              {content.intro ?? defaultIntro(bot.name, bot.tagline)}
            </p>
          </div>
        </div>
      </section>

      {/* The math */}
      {bot.formula && (
        <section>
          <div className="shell section-y-sm">
            <SectionLabel>The math</SectionLabel>
            <CalmPanel className="mt-4">
              <div className="t-label text-fg-faint mb-3">Formula</div>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-base leading-relaxed text-fg">{bot.formula}</pre>
            </CalmPanel>
            {bot.params.length > 0 && (
              <CalmPanel title="Parameters" className="mt-3">
                <div className="divide-y divide-border-soft">
                  {bot.params.map((p) => (
                    <div key={p.key} className="grid grid-cols-2 gap-x-3 gap-y-1 py-3 text-[0.75rem] first:pt-0 last:pb-0 md:grid-cols-12 md:gap-3">
                      <span className="font-mono text-fg md:col-span-3">{p.key}</span>
                      <span className="text-fg-dim md:col-span-3">{p.label}</span>
                      <span className="font-mono text-fg-faint md:col-span-3">
                        {p.kind === "number" && `range ${p.min ?? "—"} → ${p.max ?? "—"}`}
                        {p.kind === "select" && `choices: ${p.options.map((o) => o.value).join(", ")}`}
                        {p.kind === "boolean" && "on / off"}
                      </span>
                      <span className="font-mono text-fg-dim md:col-span-3">
                        default · <span className="text-fg">{String(p.default)}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </CalmPanel>
            )}
          </div>
        </section>
      )}

      {/* Live demo */}
      <section>
        <div className="shell section-y-sm">
          <SectionLabel>Live demo</SectionLabel>
          <p className="mt-3 max-w-[60ch] t-body text-fg-dim">
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
        <section>
          <div className="shell section-y-sm">
            <SectionLabel>Source code · public</SectionLabel>
            <p className="mt-3 max-w-[68ch] t-body text-fg-dim">
              This is the actual code the bot runs — not a re-explanation, not a
              simplified version. Whatever ships here is what executes when you
              press Run All in the workbench. Read it, copy it, fork it, build a
              better one.
            </p>

            <div className="calm-panel mt-6">
              <i aria-hidden className="lit-aura" />
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 text-[0.8125rem] text-fg-faint">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-mono text-[0.75rem] text-fg-dim">{source.filename}</span>
                  <span>·</span>
                  <span>
                    Lines {source.startLine}–{source.endLine}
                  </span>
                </div>
                <span className="shrink-0">TypeScript · MIT-licensed</span>
              </div>
              <pre className="overflow-x-auto p-5 font-mono text-[0.75rem] leading-relaxed text-fg">
                <code>{source.code}</code>
              </pre>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 text-[0.8125rem] text-fg-dim md:grid-cols-2">
              <CalmPanel title="What each piece means">
                <ul className="space-y-1.5 leading-relaxed">
                  <li><code className="text-fg">id</code> — unique key the workbench uses to find the bot.</li>
                  <li><code className="text-fg">params</code> — the sliders + inputs you see on the cell.</li>
                  <li><code className="text-fg">run(ctx, p)</code> — the function that gets called with candles + your params and returns the verdict.</li>
                  <li><code className="text-fg">verdict</code> — the read pill at the top of the cell (up, down, flat or caution).</li>
                  <li><code className="text-fg">metrics</code> — the small stat boxes shown in the cell body.</li>
                </ul>
              </CalmPanel>
              <CalmPanel title="Use this code yourself">
                <ol className="space-y-1.5 leading-relaxed list-decimal pl-4">
                  <li>Copy the whole block above.</li>
                  <li>On <a href="/quant" className="text-brand-ink hover:underline">/quant</a>, click <Chip>+ Import your bot</Chip> in the bot library.</li>
                  <li>Paste, hit save. It hot-loads into your workspace.</li>
                  <li>Edit any param defaults or logic to your taste — it’s now yours.</li>
                </ol>
              </CalmPanel>
            </div>
          </div>
        </section>
      )}

      {/* Specialty */}
      <section>
        <div className="shell section-y-sm">
          <SectionLabel>Specialty · when it shines, when it fails</SectionLabel>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <CalmPanel>
              <div className="t-eyebrow text-brand-ink mb-3">✓ Shines when</div>
              <ul className="space-y-3 t-body-sm text-fg">
                {(content.shines ?? defaultShines(bot.category)).map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-fg-faint">·</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CalmPanel>
            <CalmPanel>
              <div className="t-eyebrow text-fg-dim mb-3">✗ Fails when</div>
              <ul className="space-y-3 t-body-sm text-fg">
                {(content.fails ?? defaultFails(bot.category)).map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-fg-faint">·</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CalmPanel>
          </div>
        </div>
      </section>

      {/* How to read the verdict */}
      <section>
        <div className="shell section-y-sm">
          <SectionLabel>How to read its verdict</SectionLabel>
          <p className="mt-4 max-w-[68ch] text-[0.9375rem] leading-relaxed text-fg">
            {content.verdict ?? defaultVerdict(bot.name)}
          </p>
        </div>
      </section>

      {/* AI-only: service status + flow diagram */}
      {isAi && (
        <section>
          <div className="shell section-y-sm">
            <SectionLabel>Python service</SectionLabel>
            <p className="mt-3 max-w-[60ch] t-body text-fg-dim">
              This bot tries to call the FastAPI service first. When it’s up,
              you get real model output. When it’s down, the bot transparently
              falls back to a deterministic TS surrogate.
            </p>

            {/* Dev-metadata chips, demoted here from the hero */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {bot.module && (
                <Chip className="max-w-full">
                  <span className="text-fg-faint">Src</span>
                  <span className="min-w-0 truncate font-mono text-[0.6875rem] text-fg">{bot.module}</span>
                </Chip>
              )}
              {bot.endpoint && (
                <Chip className="max-w-full">
                  <span className="text-fg-faint">API</span>
                  <span className="min-w-0 truncate font-mono text-[0.6875rem] text-fg">{bot.endpoint}</span>
                </Chip>
              )}
            </div>

            <div className="mt-6">
              <LearnApiStatus endpoint={bot.endpoint ?? "/health"} />
            </div>

            {/* The panel wraps the <details>: a closed <details> hides every
                child but its summary, and the aura has to stay painted. */}
            <div className="calm-panel mt-3">
              <i aria-hidden className="lit-aura" />
              <details className="group">
                <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-fg transition-colors hover:text-brand-ink">
                  <span className="font-display text-base tracking-tightest">How the request flows</span>
                  <span className="font-mono text-fg-faint group-open:hidden">+</span>
                  <span className="font-mono text-fg-faint hidden group-open:inline">−</span>
                </summary>
                <div className="grid grid-cols-1 gap-4 px-5 pb-4 md:grid-cols-5">
                  {[
                    { step: "01", title: "BotCell.run()", body: "User clicks Run on this bot in /quant" },
                    { step: "02", title: "callApi()", body: "POST to " + (process.env.NEXT_PUBLIC_QUANTAI_URL || "localhost:8000") + (bot.endpoint ?? "") },
                    { step: "03", title: "load_surrogate()", body: bot.module ?? "Python service loads the trained model" },
                    { step: "04", title: "predict()", body: "Forward pass on the inputs you provided" },
                    { step: "05", title: "BotResult", body: "JSON returned, card flips green Source: Python NN" },
                  ].map((s) => (
                    <div key={s.step}>
                      <div className="t-label text-fg-faint">{s.step}</div>
                      <div className="mt-2 font-mono text-[0.75rem] tracking-wide text-fg">{s.title}</div>
                      <div className="mt-1 text-[0.75rem] leading-relaxed text-fg-dim">{s.body}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pb-5">
                  <span className="t-label text-fg-faint">Spin it up</span>
                  <code className="font-mono text-[0.6875rem] text-fg">cd "ai quants" && uvicorn serve:app --reload --port 8000</code>
                </div>
              </details>
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      {(content.faq && content.faq.length > 0) && (
        <section>
          <div className="shell section-y-sm">
            <SectionLabel>FAQ</SectionLabel>
            <div className="calm-panel mt-4">
              <i aria-hidden className="lit-aura" />
              <div className="divide-y divide-border-soft">
                {content.faq.map((q, i) => (
                  <details key={i} className="group">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-fg transition-colors hover:text-brand-ink">
                      <span className="font-display text-base tracking-tightest">{q.q}</span>
                      <span className="font-mono text-fg-faint group-open:hidden">+</span>
                      <span className="font-mono text-fg-faint hidden group-open:inline">−</span>
                    </summary>
                    <div className="px-5 pb-4 t-body-sm text-fg-dim">
                      {q.a}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Related */}
      <section>
        <div className="shell section-y-sm">
          <SectionLabel>Related bots</SectionLabel>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
            {related.map((r) => {
              const rcat = CATEGORY_META[r.category];
              return (
                <Link
                  key={r.id}
                  href={`/learn/bots/${r.id}`}
                  className="calm-panel calm-card flex items-start gap-3 p-4"
                >
                  <i aria-hidden className="lit-aura" />
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fg/[0.07] font-mono text-[0.75rem] text-fg-dim">
                    {r.glyph}
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-[0.9375rem] tracking-tightest text-fg">
                      {r.name}
                    </div>
                    <div className="mt-0.5 t-label text-fg-faint">{rcat.label}</div>
                    <p className="mt-2 line-clamp-2 text-[0.75rem] text-fg-dim">{r.tagline}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer CTAs */}
      <section>
        <div className="shell section-y-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CalmLink href="/learn">Back to Learn</CalmLink>
            <div className="flex flex-wrap items-center gap-2">
              <PillLink href="/learn/bots">Browse all bots</PillLink>
              <PillLink href={`/quant?add=${bot.id}`} kind="primary">
                Try {bot.name}
              </PillLink>
            </div>
          </div>
        </div>
      </section>

      <Footer marketing />
    </main>
  );
}

// Calm (S1, 2026-11-09): one plain eyebrow. It carried a ⟢, a rule and mint.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="t-eyebrow text-brand-ink">{children}</div>;
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
    "European-style equity options inside the model’s training distribution.",
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
    "Extreme IV regimes (>200%) where the surrogate hasn’t seen examples.",
    "Live-chain decisioning when the chain feed itself is stale or partial.",
  ];
  if (category === "ai") return [
    "Regime breaks (COVID, 2022, post-earnings gaps). The training set was smoother.",
    "Source: Mock — when the FastAPI service is offline, the bot is using a TS surrogate, not the real model.",
    "Out-of-distribution tickers (illiquid small caps, FX, crypto).",
  ];
  return [
    "When the dataset violates the bot’s underlying assumptions.",
    "When you treat the bot’s verdict as a single source of truth without checking the consensus.",
  ];
}
function defaultVerdict(name: string): string {
  return `The read pill summarises ${name}’s output as UP, DOWN, FLAT or CAUTION: a read of the window it was shown, not a forecast and not odds. /quant prints no confidence beside it, because a bot's internal signal strength is not a probability anyone has checked. What carries information is whether independent models line up on the same window, and even a full vote sits inside the same historical band as a split one.`;
}

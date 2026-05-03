import { CandleChart, MiniSpark } from "./CandleChart";
import { generateCandles, lastChange } from "@/lib/candles";

const ASSETS = [
  { sym: "AMZN", name: "Amazon", venue: "NASDAQ", seed: 22, base: 226.45, drift: 0.12, vol: 2.4, type: "equity" },
  { sym: "NVDA", name: "Nvidia", venue: "NASDAQ", seed: 31, base: 138.9, drift: 0.08, vol: 1.6, type: "equity" },
  { sym: "TSLA", name: "Tesla", venue: "NASDAQ", seed: 48, base: 287.15, drift: -0.06, vol: 3.4, type: "equity" },
  { sym: "AAPL", name: "Apple", venue: "NASDAQ", seed: 13, base: 229.83, drift: 0.05, vol: 1.8, type: "equity" },
  { sym: "SPY", name: "S&P 500", venue: "ARCA", seed: 67, base: 612.40, drift: 0.04, vol: 2.1, type: "etf" },
  { sym: "QQQ", name: "Nasdaq-100", venue: "ARCA", seed: 91, base: 540.10, drift: 0.06, vol: 2.6, type: "etf" },
];

const STEPS = [
  {
    n: "01",
    title: "Drag across strikes",
    body: "The chain is colour-coded by IV — green is cheap, red is expensive. Click a cell to add a long leg. Right-click for a short. Drag across a row of cells to compose multiple legs at once.",
    glyph: "↔",
  },
  {
    n: "02",
    title: "We name what you built",
    body: "Long call. Bull put spread. Iron condor. Ratio. Fourteen-plus strategies are detected the moment you finish dragging — including the ones with unbounded loss tails, which we flag in red.",
    glyph: "✦",
  },
  {
    n: "03",
    title: "Teacher explains it",
    body: "Hover any Greek for an animated explainer (Delta walks, Gamma accelerates, Theta melts). Click 'Explain this strategy' and the AI teacher writes a plain-English breakdown of the trade.",
    glyph: "◐",
  },
  {
    n: "04",
    title: "Paper-trade with seatbelts",
    body: "Every paper trade pre-screens for unbounded loss with a 3-second cooldown. A daily-loss kill switch auto-closes everything if you hit your limit. $100k starting balance — never your real money.",
    glyph: "◉",
  },
];

const MAIN = { sym: "AMZN", name: "Amazon", venue: "NASDAQ · 30D", seed: 22, base: 226.45, drift: 0.18, vol: 2.4 };

const NEWS = [
  { tag: "FEATURE", color: "var(--bull)", t: "Iron condor walkthrough now live in the AI teacher.", time: "2d" },
  { tag: "PRICING", color: "var(--cyan)", t: "Black-Scholes engine ships in 0.4ms — the whole chain.", time: "5d" },
  { tag: "SAFETY", color: "var(--amber)", t: "Kill switch + daily loss limit shipped as default-on.", time: "9d" },
  { tag: "BETA", color: "var(--bear)", t: "Multi-leg detection adds Iron Butterfly + Calendar.", time: "11d" },
];

export function TradeOverview() {
  const main = generateCandles(72, MAIN.seed, MAIN.base, MAIN.drift, MAIN.vol);
  const change = lastChange(main);
  const last = main[main.length - 1].c;

  return (
    <section className="relative border-b border-border bg-bg-soft">
      <div className="pointer-events-none absolute inset-0 bg-grid-fine opacity-25" />

      {/* Header */}
      <div className="relative mx-auto max-w-[1400px] px-5 pt-24 pb-10">
        <div className="grid grid-cols-12 items-end gap-x-5 gap-y-6">
          <div className="col-span-12 lg:col-span-7">
            <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-faint mb-3">
              ⟢ Section 03 / How it works
            </div>
            <h2 className="font-display text-[clamp(2.4rem,5.6vw,5.2rem)] leading-[0.92] tracking-tightest text-fg">
              From chain to trade
              <br />
              in <span className="italic font-light">four drags</span>
              <span className="text-bull">.</span>
            </h2>
          </div>
          <div className="col-span-12 lg:col-span-5">
            <p className="max-w-[42ch] text-base leading-relaxed text-fg-dim">
              Most trading apps let you place orders. LAZYBULL lets you{" "}
              <span className="text-fg">understand</span> them first. Here's the loop:
              drag, recognise, learn, paper-trade — repeat until the geometry feels obvious.
            </p>
          </div>
        </div>
      </div>

      {/* Steps grid */}
      <div className="relative mx-auto max-w-[1400px] px-5 pb-12">
        <div className="grid grid-cols-1 gap-px overflow-hidden border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <article
              key={s.n}
              className="relative flex flex-col gap-3 bg-bg p-6 transition-colors hover:bg-surface"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">
                  STEP {s.n} / 04
                </span>
                <span className="font-display text-2xl text-bull">{s.glyph}</span>
              </div>
              <h3 className="font-display text-2xl tracking-tightest text-fg leading-[1.05]">
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed text-fg-dim">{s.body}</p>
              <div className="mt-auto pt-4 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                {i === 0 && "⌘ click · drag · right-click"}
                {i === 1 && "14+ strategies recognised"}
                {i === 2 && "6 Greeks · animated"}
                {i === 3 && "kill switch · always on"}
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Live preview slab */}
      <div className="relative mx-auto max-w-[1400px] px-5 pb-20">
        <div className="overflow-hidden border border-border bg-bg">
          {/* Top status bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-soft px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            <div className="flex items-center gap-3">
              <span className="size-1.5 rounded-full bg-bull pulse-dot" />
              <span className="text-bull">live preview</span>
              <span className="text-fg-faint">·</span>
              <span>visual chain · v1.4</span>
              <span className="text-fg-faint hidden md:inline">·</span>
              <span className="hidden md:inline">workspace · "learner"</span>
            </div>
            <div className="flex items-center gap-3">
              <span>chain priced 0.4ms</span>
              <span className="text-fg-faint">·</span>
              <span>teacher · ON</span>
              <span className="text-fg-faint">·</span>
              <span>training wheels · ON</span>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-12 gap-px bg-border">
            {/* LEFT: detected strategy panel */}
            <aside className="col-span-12 lg:col-span-3 bg-bg p-4 flex flex-col gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                  detected strategy
                </div>
                <div className="mt-1 font-display text-2xl tracking-tightest text-fg">
                  Bull Call Spread
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 font-mono text-[10px] uppercase tracking-wider">
                <span className="border border-bull/40 bg-bull/10 text-bull px-2 py-0.5">bullish</span>
                <span className="border border-border bg-bg text-fg-dim px-2 py-0.5">net debit</span>
                <span className="border border-bull/40 bg-bull/10 text-bull px-2 py-0.5">defined risk</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border-soft">
                {[
                  { k: "Max profit", v: "+$420", c: "text-bull" },
                  { k: "Max loss", v: "−$80", c: "text-bear" },
                  { k: "Breakeven", v: "$232.40", c: "text-fg" },
                  { k: "Net cost", v: "$80", c: "text-fg-dim" },
                ].map((s) => (
                  <div key={s.k} className="bg-bg p-2.5">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                      {s.k}
                    </div>
                    <div className={`mt-0.5 font-mono text-sm tabular-nums ${s.c}`}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="border border-bull/30 bg-bull/5 p-3">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-bull">
                  <span className="size-1.5 rounded-full bg-bull pulse-dot" />
                  teacher
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-fg">
                  You bet AMZN climbs to <span className="text-bull">$240</span>.
                  If it does, you make <span className="text-bull">$420</span>.
                  If it doesn't, you lose what you paid.
                </p>
              </div>
            </aside>

            {/* MIDDLE: chart */}
            <div className="col-span-12 lg:col-span-6 bg-bg flex flex-col">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-soft p-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-11 items-center justify-center border border-border bg-surface font-display text-xl text-bull">
                    A
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                      <span>{MAIN.sym}/USD</span>
                      <span className="text-fg-faint">·</span>
                      <span>{MAIN.venue}</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-3">
                      <span className="font-display text-4xl tracking-tightest text-fg tabular-nums">
                        {last.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className={`font-mono text-sm ${change.pct >= 0 ? "text-bull" : "text-bear"}`}>
                        {change.pct >= 0 ? "▲" : "▼"} {change.pct.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-fg-dim">
                  {["7d", "14d", "30d", "45d", "90d"].map((t, i) => (
                    <span
                      key={t}
                      className={`border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
                        i === 2
                          ? "border-bull bg-bull/10 text-bull"
                          : "border-border bg-bg text-fg-dim"
                      }`}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative h-[360px] flex-1 p-2">
                <CandleChart candles={main} height={360} width={780} showAxis showVolume glow />
              </div>

              <div className="grid grid-cols-2 gap-px border-t border-border-soft bg-border-soft sm:grid-cols-4">
                {[
                  { k: "Δ Delta", v: "0.412", c: "var(--bull)" },
                  { k: "Γ Gamma", v: "0.018", c: "var(--cyan)" },
                  { k: "Θ Theta", v: "−0.084", c: "var(--amber)" },
                  { k: "ν Vega", v: "0.214", c: "var(--plasma)" },
                ].map((i) => (
                  <div key={i.k} className="bg-bg px-3 py-2">
                    <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                      {i.k}
                    </div>
                    <div className="mt-1 font-mono text-sm tabular-nums" style={{ color: i.c }}>
                      {i.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: legs + paper account */}
            <aside className="col-span-12 lg:col-span-3 bg-bg flex flex-col">
              <div className="flex items-center justify-between border-b border-border-soft p-3 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                <span>your 2 legs</span>
                <span className="text-bull">drag-built</span>
              </div>
              <div className="flex flex-col">
                {[
                  { side: "long", type: "call", strike: "230", premium: "5.20", net: "−520" },
                  { side: "short", type: "call", strike: "240", premium: "4.40", net: "+440" },
                ].map((l, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-2 border-b border-border-soft px-3 py-2 font-mono text-[11px] tabular-nums">
                    <span className={`col-span-3 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-center ${
                      l.side === "long" ? "border-bull text-bull" : "border-bear text-bear"
                    }`}>
                      {l.side}
                    </span>
                    <span className="col-span-2 text-bull">{l.type}</span>
                    <span className="col-span-3 text-fg">{l.strike}</span>
                    <span className="col-span-2 text-right text-fg-dim">${l.premium}</span>
                    <span className={`col-span-2 text-right ${l.side === "long" ? "text-bear" : "text-bull"}`}>
                      {l.net}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border-soft p-3">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  <span>paper account</span>
                  <span className="text-bull">$100,000</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-px bg-border-soft">
                  {[
                    { k: "Cost", v: "$80", c: "text-bear" },
                    { k: "Today P&L", v: "+$214", c: "text-bull" },
                  ].map((s) => (
                    <div key={s.k} className="bg-bg p-2">
                      <div className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                        {s.k}
                      </div>
                      <div className={`mt-0.5 font-mono text-sm tabular-nums ${s.c}`}>{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto border-t border-border-soft p-3 space-y-2">
                <button className="w-full bg-bull py-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-bg">
                  paper trade →
                </button>
                <button className="w-full border border-border bg-bg py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
                  explain this trade
                </button>
              </div>
            </aside>
          </div>

          {/* Bottom news strip */}
          <div className="grid grid-cols-1 gap-px border-t border-border bg-border md:grid-cols-4">
            {NEWS.map((n) => (
              <div key={n.t} className="group flex items-start gap-3 bg-bg p-3 transition-colors hover:bg-surface cursor-pointer">
                <span
                  className="mt-1 inline-flex shrink-0 items-center justify-center px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider"
                  style={{ background: n.color, color: "var(--bg)" }}
                >
                  {n.tag}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-fg">{n.t}</p>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    {n.time} ago
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Asset cards row */}
        <div className="mt-px grid grid-cols-2 gap-px bg-border md:grid-cols-3 lg:grid-cols-6">
          {ASSETS.map((a) => {
            const c = generateCandles(28, a.seed + 100, a.base, a.drift, a.vol);
            const ch = lastChange(c);
            const last = c[c.length - 1].c;
            const up = ch.pct >= 0;
            return (
              <article
                key={a.sym}
                className="group relative flex flex-col gap-3 border border-border bg-bg p-4 transition-all hover:bg-surface hover:-translate-y-0.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-medium text-fg">{a.sym}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                      {a.type}
                    </span>
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-wider ${up ? "text-bull" : "text-bear"}`}
                  >
                    {up ? "▲" : "▼"} {Math.abs(ch.pct).toFixed(2)}%
                  </span>
                </div>
                <div className="font-display text-2xl tracking-tightest text-fg tabular-nums">
                  {last.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="h-12">
                  <MiniSpark candles={c} color={up ? "var(--bull)" : "var(--bear)"} />
                </div>
                <div className="flex items-center justify-between border-t border-border-soft pt-2 font-mono text-[9px] uppercase tracking-wider text-fg-faint">
                  <span>{a.venue}</span>
                  <span className="text-fg-dim group-hover:text-fg transition-colors">trade options →</span>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

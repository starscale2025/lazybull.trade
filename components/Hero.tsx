import { CandleChart } from "./CandleChart";
import { generateCandles, lastChange, type Candle } from "@/lib/candles";
import { ProCta } from "./ProCta";

async function fetchRealCandles(symbol: string, count: number): Promise<{ candles: Candle[]; lastClose: number | null }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (lazybullpro/1.0)" },
      next: { revalidate: 300 },
    });
    if (!r.ok) throw new Error(`yahoo ${r.status}`);
    const j = await r.json();
    const result = j?.chart?.result?.[0];
    const q = result?.indicators?.quote?.[0];
    if (!q) throw new Error("no quote data");
    const o: (number | null)[] = q.open || [];
    const h: (number | null)[] = q.high || [];
    const l: (number | null)[] = q.low || [];
    const c: (number | null)[] = q.close || [];
    const out: Candle[] = [];
    for (let i = 0; i < o.length; i++) {
      if (o[i] == null || c[i] == null) continue;
      out.push({ o: o[i] as number, h: (h[i] ?? o[i]) as number, l: (l[i] ?? o[i]) as number, c: c[i] as number });
    }
    const tail = out.slice(-count);
    const lastClose = tail.length ? tail[tail.length - 1].c : null;
    return { candles: tail, lastClose };
  } catch {
    return { candles: [], lastClose: null };
  }
}

export async function Hero() {
  const { candles: realCandles, lastClose } = await fetchRealCandles("AMZN", 72);
  const candles = realCandles.length >= 30 ? realCandles : generateCandles(72, 11, 226, 0.18, 1.6);
  const change = lastChange(candles);
  const spotLabel = lastClose ? `$${lastClose.toFixed(2)}` : "live";

  return (
    <section className="relative overflow-hidden border-b border-border bg-bg">
      {/* Background layers */}
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
      <div className="pointer-events-none absolute -left-40 top-20 h-[420px] w-[420px] rounded-full bg-bull/15 blur-[140px] drift" />
      <div className="pointer-events-none absolute right-0 top-40 h-[360px] w-[360px] rounded-full bg-bear/10 blur-[140px] drift" style={{ animationDelay: "-6s" }} />
      <div className="pointer-events-none absolute inset-0 scanlines opacity-40" />

      {/* Top edge tape */}
      <div className="relative flex items-center justify-between border-b border-border-soft px-5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
        <div className="flex items-center gap-3">
          <span>VISUAL OPTIONS · v1.4</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">DRAG TO BUILD</span>
          <span className="hidden md:inline">·</span>
          <span className="hidden md:inline">AI TEACHER ON</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline">PAPER $100K</span>
          <span className="hidden md:inline">·</span>
          <span>TRAINING WHEELS</span>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-[1400px] grid-cols-12 gap-x-5 gap-y-10 px-5 py-14 lg:py-24">
        {/* LEFT — editorial */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-10">
          {/* Eyebrow */}
          <div
            className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider hero-fade-up-soft"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="inline-flex items-center gap-2 border border-bull/40 bg-bull/5 px-2 py-1 text-bull">
              <span className="size-1.5 rounded-full bg-bull pulse-dot" /> options · for humans
            </span>
            <span className="inline-flex items-center gap-2 border border-border bg-surface px-2 py-1 text-fg-dim">
              drag · build · paper-trade
            </span>
            <span className="hidden sm:inline-flex items-center gap-2 border border-border bg-surface px-2 py-1 text-fg-dim">
              0.4ms full-chain pricing
            </span>
          </div>

          {/* Headline — massive editorial, animated line-by-line */}
          <h1 className="font-display tracking-tightest text-[clamp(3.4rem,9vw,8.4rem)] leading-[0.86] text-fg">
            <span className="block hero-headline-line" style={{ animationDelay: "0.3s" }}>
              Options
            </span>
            <span className="block hero-headline-line" style={{ animationDelay: "0.55s" }}>
              you can
            </span>
            <span className="block" style={{ animationDelay: "0.85s" }}>
              <span
                className="italic font-light text-bull phosphor hero-glow-in inline-block"
                style={{ animationDelay: "0.85s" }}
              >
                see
              </span>
              <span
                className="text-bull hero-fade-up inline-block"
                style={{ animationDelay: "1.5s" }}
              >
                .
              </span>
            </span>
          </h1>

          <p
            className="max-w-[54ch] text-balance text-base leading-relaxed text-fg-dim md:text-lg hero-fade-up"
            style={{ animationDelay: "1.2s" }}
          >
            LAZYBULL turns the options chain into a heatmap you{" "}
            <span className="text-fg">drag across</span> to build spreads, condors and straddles.
            An AI teacher hovers over every Greek and explains the trade like you're twelve.
            Safety wheels, kill switch, $100k paper account — so you can learn without losing the rent.
          </p>

          {/* CTAs */}
          <div
            className="flex flex-wrap items-center gap-3 hero-fade-up"
            style={{ animationDelay: "1.5s" }}
          >
            <a
              href="/trade"
              className="group relative inline-flex items-center gap-3 bg-fg px-5 py-3.5 font-mono text-xs font-semibold uppercase tracking-wider text-bg transition-colors hover:bg-bull"
            >
              Open the visual chain
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </a>
            <ProCta />
            <span className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">
              Free · No card · Paper $100k
            </span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border sm:grid-cols-4">
            {[
              { k: "Strategies detected", v: "14+", sub: "spreads, condors, ratios" },
              { k: "Greek explainers", v: "6", sub: "delta, gamma, theta, vega…" },
              { k: "Chain pricing", v: "0.4ms", sub: "full Black-Scholes" },
              { k: "Paper balance", v: "$100k", sub: "kill switch built-in" },
            ].map((s) => (
              <div key={s.k} className="bg-bg p-4">
                <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                  {s.k}
                </div>
                <div className="mt-2 font-display text-3xl tracking-tightest text-fg">
                  {s.v}
                </div>
                <div className="mt-1 font-mono text-[10px] text-fg-dim">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — terminal preview */}
        <div
          className="col-span-12 lg:col-span-5 flex flex-col gap-3 hero-card-in"
          style={{ animationDelay: "0.6s" }}
        >
          <div className="relative border border-border bg-surface">
            {/* Terminal header */}
            <div className="flex items-center justify-between border-b border-border bg-bg px-3 py-2 font-mono text-[10px] uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-bear" />
                <span className="size-2 rounded-full bg-amber" />
                <span className="size-2 rounded-full bg-bull" />
                <span className="ml-2 text-fg-dim">visual chain · AMZN · {spotLabel}</span>
              </div>
              <span className="text-fg-faint">teacher on</span>
            </div>

            {/* Detected strategy block */}
            <div className="flex items-baseline justify-between gap-4 px-4 pt-4">
              <div className="hero-fade-up-soft" style={{ animationDelay: "1.1s" }}>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  <span className="rounded-sm bg-bull/15 px-1 text-bull">DETECTED</span>
                  <span>2 legs · drag built</span>
                </div>
                <div className="mt-1 font-display text-4xl tracking-tightest text-fg">
                  Bull Call Spread
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                  bullish · net debit · defined risk
                </div>
              </div>
              <div
                className="text-right font-mono text-xs text-bull hero-fade-up-soft"
                style={{ animationDelay: "1.4s" }}
              >
                <div className="text-lg font-semibold">+$420</div>
                <div className="text-fg-dim">max profit</div>
              </div>
            </div>

            {/* Chart */}
            <div
              className="relative h-[260px] px-1 hero-fade-up-soft"
              style={{ animationDelay: "1.6s" }}
            >
              <CandleChart candles={candles} height={260} width={520} glow showVolume={false} />
            </div>

            {/* Time row */}
            <div
              className="flex items-center justify-between border-t border-border-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint hero-fade-up-soft"
              style={{ animationDelay: "1.9s" }}
            >
              <div className="flex gap-3">
                {["7d", "14d", "30d", "45d", "90d"].map((t, i) => (
                  <span key={t} className={i === 2 ? "text-bull" : "hover:text-fg-dim cursor-pointer"}>{t}</span>
                ))}
              </div>
              <div className="flex gap-3">
                <span>IV 32%</span>
                <span className="text-bull">BE 232.40 ›</span>
              </div>
            </div>
          </div>

          {/* Greeks legend + Teacher card */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="border border-border bg-surface p-3 hero-fade-up-soft"
              style={{ animationDelay: "2.1s" }}
            >
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                <span>greeks</span>
                <span className="text-fg-faint">hover · learn</span>
              </div>
              <div className="space-y-1.5 font-mono text-[11px] tabular-nums">
                {[
                  { g: "Δ Delta", v: "0.412", c: "var(--bull)" },
                  { g: "Γ Gamma", v: "0.018", c: "var(--cyan)" },
                  { g: "Θ Theta", v: "−0.084", c: "var(--amber)" },
                  { g: "ν Vega", v: "0.214", c: "var(--plasma)" },
                  { g: "ρ Rho", v: "+0.041", c: "var(--bear)" },
                  { g: "IV", v: "32.4%", c: "var(--bull)" },
                ].map((row, idx) => (
                  <div
                    key={row.g}
                    className="grid grid-cols-2 gap-2 hero-fade-up-soft"
                    style={{ animationDelay: `${2.4 + idx * 0.08}s` }}
                  >
                    <span className="text-fg-dim">{row.g}</span>
                    <span className="text-right" style={{ color: row.c }}>{row.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="relative overflow-hidden border border-bull/30 bg-surface p-3 hero-fade-up-soft"
              style={{ animationDelay: "2.3s" }}
            >
              <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                <span className="text-bull">teacher</span>
                <span className="size-1.5 rounded-full bg-bull pulse-dot" />
              </div>
              <div className="font-display text-base leading-snug text-fg">
                "Bull call spread"
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-fg-dim">
                You're betting AMZN climbs to <span className="text-bull">$240</span>.
                Worst case you lose what you paid <span className="text-bear">($80)</span>;
                best case you make <span className="text-bull">$420</span>.
                Break-even sits at <span className="text-fg">$232.40</span>.
              </p>
              <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                <span className="size-3 border border-bull bg-bull/30" />
                explained at age-12
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom marquee */}
      <div className="relative border-y border-border bg-bg-soft py-3 font-mono text-[11px] uppercase tracking-wider">
        <div className="flex marquee-slow gap-10 whitespace-nowrap text-fg-faint">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex shrink-0 gap-10">
              {[
                "drag · build · trade",
                "AI teacher built-in",
                "14+ strategies detected",
                "iron condors made easy",
                "training wheels on by default",
                "kill switch + daily loss limit",
                "$100k paper account",
                "no card to start",
              ].map((t, i) => (
                <span key={i} className="flex items-center gap-10">
                  <span className="text-bull">⌖</span>
                  <span>{t}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

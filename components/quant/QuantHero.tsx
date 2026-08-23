"use client";

import { useEffect, useState } from "react";
import { useRetryCountdown } from "./RetryCountdown";

const SYMBOLS = ["AMZN", "AAPL", "NVDA", "TSLA", "SPY", "QQQ", "BTC", "META", "MSFT", "GOOG"];

/** Live countdown to the next feed retry, shown when the live feed is throttled
    so the user knows the tape isn't stuck — it recovers on its own. */
function RetryCountdown({ retryAt }: { retryAt?: number | null }) {
  const secs = useRetryCountdown(retryAt);
  if (secs == null) return null;
  return <span className="text-amber/80">· live in {secs}s</span>;
}

/** "updated Ns ago" — freshness of the live tape, on its own 1s clock (isolated
    so the big hero doesn't re-render every second). */
function UpdatedAgo({ since }: { since?: number | null }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  if (!since) return <>updating…</>;
  const secs = Math.max(0, Math.round((Date.now() - since) / 1000));
  return <>updated {secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m`} ago</>;
}

/** Feed-provider id → display label for the provenance line. */
const SOURCE_LABEL: Record<string, string> = {
  alpaca: "Alpaca",
  twelvedata: "Twelve Data",
  finnhub: "Finnhub",
  yahoo: "Yahoo Finance",
};
const sourceLabel = (s?: string | null) => (s && SOURCE_LABEL[s]) || "the live feed";

/** A "?" that explains a knob on hover/focus — beginners shouldn't have to
    guess what a seed or a drift is before they dare to touch one. */
function InfoTip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex">
      <span
        tabIndex={0}
        aria-label={text}
        className="inline-flex size-3.5 cursor-help items-center justify-center border border-border font-mono text-[10px] text-fg-faint transition-colors hover:border-fg-dim hover:text-fg focus:border-fg-dim focus:text-fg"
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 w-60 -translate-x-1/2 surface-instrument border border-border bg-surface p-2 text-left font-mono text-[10px] normal-case leading-relaxed tracking-normal text-fg-dim opacity-0 shadow-2xl transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function QuantHero({
  symbol,
  setSymbol,
  bars,
  setBars,
  seed,
  setSeed,
  drift,
  setDrift,
  vol,
  setVol,
  beginner,
  setBeginner,
  onRunAll,
  onClearAll,
  activeCount,
  totalBots,
  spot,
  mode,
  setMode,
  dataSource,
  retryAt,
  liveSource,
  updatedAt,
  syntheticKnobsActive,
  runLocked = false,
}: {
  symbol: string;
  setSymbol: (s: string) => void;
  bars: number;
  setBars: (n: number) => void;
  seed: number;
  setSeed: (n: number) => void;
  drift: number;
  setDrift: (n: number) => void;
  vol: number;
  setVol: (n: number) => void;
  beginner: boolean;
  setBeginner: (v: boolean) => void;
  onRunAll: () => void;
  onClearAll: () => void;
  activeCount: number;
  totalBots: number;
  spot: number;
  /** The user's chosen data mode. */
  mode: "live" | "seed";
  setMode: (m: "live" | "seed") => void;
  /** What the bots are ACTUALLY running on — live mode degrades to "fallback"
      when the feed is down. */
  dataSource: "live" | "seed" | "fallback";
  /** When the next live-feed retry fires (ms epoch), for the OFFLINE countdown. */
  retryAt?: number | null;
  /** Which upstream served the live bars ("twelvedata" | "yahoo"), for provenance. */
  liveSource?: string | null;
  /** When the live tape last refreshed (ms epoch), for "updated Ns ago". */
  updatedAt?: number | null;
  /** seed/drift/vol shape the tape only in seed mode. */
  syntheticKnobsActive: boolean;
  /** The run ritual holds a workspace lock while the machine runs. Every
      control that would change the dataset mid-run is frozen for its
      duration — a slider moved at bot 14 of 27 silently splits a run across
      two different tapes and the verdict then describes neither. */
  runLocked?: boolean;
}) {
  const knobTitle = runLocked
    ? "Frozen while the run holds the workspace lock."
    : syntheticKnobsActive
      ? "Shapes the deterministic seed tape."
      : "Seed-mode only — switch the dataset to SEED to shape the tape.";
  const knobsLive = syntheticKnobsActive && !runLocked;
  return (
    <section className="relative overflow-hidden border-b border-border bg-bg">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="pointer-events-none absolute -left-32 top-10 h-[320px] w-[320px] rounded-full bg-cyan/10 blur-[120px] drift" />
      <div className="pointer-events-none absolute right-0 top-20 h-[280px] w-[280px] rounded-full bg-plasma/10 blur-[120px] drift" style={{ animationDelay: "-5s" }} />
      <div className="pointer-events-none absolute inset-0 scanlines opacity-30" />
      {/* The engine room: a brass difference-engine RUNNING — gears turn, the
          laser sweeps. muted is (re)set via ref (React omits the attribute in
          SSR markup, so autoplay would be vetoed pre-hydration). */}
      <video
        ref={(el) => {
          if (!el) return;
          el.muted = true;
          if (el.paused && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            el.play().catch(() => {});
          }
        }}
        src="/media/loops/machine-loop.webm"
        poster="/media/quant/machine-hero@1600.webp"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[30%_65%] opacity-[0.3]"
        style={{ maskImage: "radial-gradient(95% 130% at 30% 70%, black 28%, transparent 74%)" }}
      />

      {/* tape */}
      <div className="relative mx-auto flex w-full max-w-[1500px] items-center justify-between px-5 py-2 t-eyebrow text-fg-faint">
        <div className="flex items-center gap-3">
          <span>QUANT WORKBENCH · v0.1</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{totalBots} BOTS LOADED</span>
          <span className="hidden md:inline">·</span>
          <span className="hidden md:inline">DETERMINISTIC SEED</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:inline">CLIENT-SIDE MATH</span>
          <span className="hidden md:inline">·</span>
          <span>{activeCount} CELLS ACTIVE</span>
        </div>
      </div>

      <div className="relative mx-auto max-w-[1500px] px-5 pb-6 pt-8 lg:pt-12">
        <div className="grid grid-cols-12 items-end gap-5">
          {/* Title block — on mobile it drops BELOW the workbench panel so a
              phone user lands on the actual tool, not a full screen of copy. */}
          <div className="order-2 col-span-12 flex flex-col gap-5 lg:order-1 lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2 t-chrome">
              <span className="inline-flex items-center gap-2 border border-cyan/40 bg-cyan/5 px-2 py-1 text-cyan">
                <span className="size-1.5 rounded-full bg-cyan pulse-dot" /> quant · for everyone
              </span>
              <span className="inline-flex items-center gap-2 surface-instrument border border-border bg-surface px-2 py-1 text-fg-dim">
                stack bots · tune · run
              </span>
              <span className="hidden sm:inline-flex items-center gap-2 surface-instrument border border-border bg-surface px-2 py-1 text-fg-dim">
                bring your own bot
              </span>
            </div>

            <h1 className="wonk-type font-display tracking-tightest text-[clamp(2.6rem,7.5vw,6.4rem)] leading-[0.88] text-fg">
              run math
              <br />
              <span className="t-accent text-cyan phosphor" style={{ textShadow: "0 0 20px rgba(0,229,255,0.4), 0 0 4px rgba(0,229,255,0.7)" }}>at the market</span>
              <span className="text-cyan">.</span>
            </h1>

            <p className="max-w-[60ch] text-balance text-[15px] leading-relaxed text-fg-dim md:text-base">
              A workbench for quant traders and a class-12 math kid alike. Stack bots like
              Jupyter cells. Tune the math. See where they agree, where they fight, and what
              the combined edge says — in plain English if you want, or in formulas if
              you'd rather. Drop in your own bot in under a minute.
            </p>
          </div>

          {/* Symbol & seed controls — first on mobile (the tool), right column on desktop */}
          <div className="order-1 col-span-12 lg:order-2 lg:col-span-5">
            <div className="surface-instrument border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 t-chrome text-fg-dim">
                <span className="flex items-center gap-2">
                  dataset
                  {/* the mode is a choice; the badge is the truth of what's running */}
                  <span className="inline-flex border border-border" role="group" aria-label="Data mode">
                    <button
                      onClick={() => setMode("live")}
                      aria-pressed={mode === "live"}
                      disabled={runLocked}
                      title="Real market OHLCV, ticking every ~15s (delayed feed)"
                      className={`px-1.5 py-px text-[10px] font-semibold transition-colors ${
                        mode === "live" ? "bg-bull text-bg" : "bg-bg text-fg-faint hover:text-fg"
                      }`}
                    >
                      LIVE
                    </button>
                    <button
                      onClick={() => setMode("seed")}
                      aria-pressed={mode === "seed"}
                      disabled={runLocked}
                      title="Deterministic synthetic tape — same seed, same bars, every time"
                      className={`px-1.5 py-px text-[10px] font-semibold transition-colors ${
                        mode === "seed" ? "bg-cyan text-bg" : "bg-bg text-fg-faint hover:text-fg"
                      }`}
                    >
                      SEED
                    </button>
                  </span>
                  {dataSource === "fallback" ? (
                    <span
                      className="inline-flex items-center gap-1 border border-amber/50 bg-amber/10 px-1.5 py-px text-[10px] text-amber"
                      title="The free data feed got rate-limited by the provider, so the bots are on a deterministic stand-in tape. It retries automatically — the live tape returns on its own."
                    >
                      <span className="size-1 rounded-full bg-amber" />
                      OFFLINE
                      <RetryCountdown retryAt={retryAt} />
                      <a
                        href="/pricing"
                        className="ml-1 border-l border-amber/30 pl-1.5 normal-case text-amber/90 underline-offset-2 hover:text-amber hover:underline"
                        title="Real-time, un-throttled market data — coming to Power. See the plans."
                      >
                        real-time →
                      </a>
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 border px-1 py-px text-[10px] ${
                        dataSource === "live" ? "border-bull/50 bg-bull/10 text-bull" : "border-cyan/50 bg-cyan/10 text-cyan"
                      }`}
                      title={dataSource === "live" ? "Real market OHLCV from the live feed · delayed ~15s" : "deterministic seed tape"}
                    >
                      <span className={`size-1 rounded-full ${dataSource === "live" ? "bg-bull pulse-dot" : "bg-cyan"}`} />
                      {dataSource === "live" ? "LIVE" : "DETERMINISTIC"}
                    </span>
                  )}
                </span>
                <span>spot ${spot.toFixed(2)}</span>
              </div>
              {/* Dataset provenance — one honest line. LIVE names its real feed
                  and freshness; PRACTICE reads as an intentional, reproducible
                  choice rather than "fake data". */}
              <div className="border-b border-border-soft bg-bg px-3 py-1.5 font-mono text-[10px] leading-relaxed text-fg-faint">
                {mode === "seed" ? (
                  <>
                    <span className="uppercase tracking-wider text-cyan/80">Practice mode</span>
                    <span> — a deterministic tape (same inputs → same candles every run), so every decision is reproducible.</span>
                  </>
                ) : dataSource === "fallback" ? (
                  <>
                    <span className="uppercase tracking-wider text-fg-dim">Source</span>
                    <span> · practice tape while we reconnect to the live feed.</span>
                  </>
                ) : (
                  <>
                    <span className="uppercase tracking-wider text-fg-dim">Source</span>
                    <span>
                      {" · live • "}
                      {sourceLabel(liveSource)} · <UpdatedAgo since={updatedAt} />
                    </span>
                  </>
                )}
              </div>
              <div className="grid grid-cols-2 gap-px bg-border">
                {/* symbol */}
                <div className="bg-bg p-3">
                  <div className="flex items-center gap-1.5 t-chrome text-fg-faint">
                    symbol
                    <InfoTip text="The instrument every bot studies. LIVE mode fetches its real daily candles from Yahoo; SEED mode deals a synthetic tape instead." />
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      disabled={runLocked}
                      className="flex-1 border border-border bg-bg px-2 py-1 font-display text-xl tracking-tightest text-fg focus:border-bull focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {SYMBOLS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* bars */}
                <div className="bg-bg p-3">
                  <div className="flex items-center justify-between t-chrome text-fg-faint">
                    <span className="flex items-center gap-1.5">
                      bars
                      <InfoTip text="How many daily candles the bots see — the lookback window. 180 ≈ 9 months of trading days. More bars: steadier statistics, slower signals. Fewer: twitchier, reacts faster." />
                    </span>
                    <span className="text-fg">{bars}</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={500}
                    value={bars}
                    onChange={(e) => setBars(Number(e.target.value))}
                    disabled={runLocked}
                    className="mt-2 w-full accent-bull disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
                {/* seed — synthetic only */}
                <div className={`bg-bg p-3 ${knobsLive ? "" : "opacity-40"}`} title={knobTitle}>
                  <div className="flex items-center justify-between t-chrome text-fg-faint">
                    <span className="flex items-center gap-1.5">
                      seed
                      <InfoTip text="The random seed of the synthetic tape. Same seed = exactly the same candles, every run — that's what makes seed-mode experiments repeatable. Change it to deal a different market. (Seed mode only.)" />
                    </span>
                    <span className="text-fg">{syntheticKnobsActive ? seed : "—"}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={500}
                    value={seed}
                    disabled={!knobsLive}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    className="mt-2 w-full accent-bull disabled:cursor-not-allowed"
                  />
                </div>
                {/* drift — synthetic only */}
                <div className={`bg-bg p-3 ${knobsLive ? "" : "opacity-40"}`} title={knobTitle}>
                  <div className="flex items-center justify-between t-chrome text-fg-faint">
                    <span className="flex items-center gap-1.5">
                      drift μ
                      <InfoTip text="The synthetic tape's average daily push. Positive grinds the market up, negative bleeds it down, zero drifts sideways. Test a strategy in a bull tape, then flip the sign and see if it survives. (Seed mode only.)" />
                    </span>
                    <span className="text-fg">{syntheticKnobsActive ? drift.toFixed(2) : "—"}</span>
                  </div>
                  <input
                    type="range"
                    min={-0.5}
                    max={0.5}
                    step={0.01}
                    value={drift}
                    disabled={!knobsLive}
                    onChange={(e) => setDrift(Number(e.target.value))}
                    className="mt-2 w-full accent-bull disabled:cursor-not-allowed"
                  />
                </div>
                {/* vol — synthetic only */}
                <div className={`bg-bg p-3 ${knobsLive ? "" : "opacity-40"}`} title={knobTitle}>
                  <div className="flex items-center justify-between t-chrome text-fg-faint">
                    <span className="flex items-center gap-1.5">
                      vol σ
                      <InfoTip text="How violently the synthetic tape swings bar to bar. Low = calm index-like candles; high = crypto-like whipsaw with fat tails. Reversion bots love low σ, breakout bots need high. (Seed mode only.)" />
                    </span>
                    <span className="text-fg">{syntheticKnobsActive ? vol.toFixed(2) : "—"}</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={5}
                    step={0.05}
                    value={vol}
                    disabled={!knobsLive}
                    onChange={(e) => setVol(Number(e.target.value))}
                    className="mt-2 w-full accent-bull disabled:cursor-not-allowed"
                  />
                </div>
                {/* beginner */}
                <div className="bg-bg p-3">
                  <div className="flex items-center gap-1.5 t-chrome text-fg-faint">
                    teacher
                    <InfoTip text="Plain-English mode: every bot adds a sentence explaining its verdict like a human would, instead of only formulas and numbers." />
                  </div>
                  <button
                    onClick={() => setBeginner(!beginner)}
                    className={`mt-2 flex h-7 w-full items-center justify-between border px-2 font-mono text-[11px] uppercase tracking-wider ${
                      beginner ? "border-bull bg-bull/10 text-bull" : "border-border bg-bg text-fg-dim"
                    }`}
                  >
                    <span>plain english</span>
                    <span>{beginner ? "ON" : "OFF"}</span>
                  </button>
                </div>
              </div>

              {/* run all */}
              <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
                <button
                  onClick={onRunAll}
                  disabled={activeCount === 0 || runLocked}
                  className="flex items-center justify-center gap-2 bg-bg px-3 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-bull hover:bg-bull hover:text-bg disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:bg-bg"
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {runLocked ? "running…" : `▶ run all (${activeCount})`}
                </button>
                <button
                  onClick={onClearAll}
                  disabled={activeCount === 0 || runLocked}
                  className="bg-bg px-3 py-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg disabled:cursor-not-allowed disabled:text-fg-faint"
                >
                  clear workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Chip, PillButton, TogglePill } from "@/components/calm/kit";
import { useRetryCountdown } from "./RetryCountdown";

const SYMBOLS = ["AMZN", "AAPL", "NVDA", "TSLA", "SPY", "QQQ", "BTC", "META", "MSFT", "GOOG"];

/** Live, Seed: by hand, not TogglePill, because these two also take disabled and a title. */
const MODE_BTN = "calm-toggle disabled:cursor-not-allowed disabled:opacity-45";

/** One field's range input; the seed-only ones add their own disabled state. */
const RANGE = "mt-3 w-full accent-brand-ink disabled:cursor-not-allowed";

/** Live countdown to the next feed retry, shown when the live feed is throttled
    so the user knows the tape isn't stuck — it recovers on its own. */
function RetryCountdown({ retryAt }: { retryAt?: number | null }) {
  const secs = useRetryCountdown(retryAt);
  if (secs == null) return null;
  return <span className="opacity-80">· live in {secs}s</span>;
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
    guess what a seed or a drift is before they dare to touch one.
    `up` opens the tooltip above the trigger — the hero section clips overflow,
    so bottom-row knobs would otherwise lose the tail of their tip. */
function InfoTip({ text, up = false }: { text: string; up?: boolean }) {
  return (
    <span className="group/tip relative inline-flex">
      <span
        tabIndex={0}
        aria-label={text}
        className="inline-flex size-3.5 cursor-help items-center justify-center rounded-full bg-fg/10 text-[0.625rem] text-fg-faint transition-colors hover:text-fg focus:text-fg"
      >
        ?
      </span>
      <span
        role="tooltip"
        className={`t-label pointer-events-none absolute left-1/2 z-50 w-60 -translate-x-1/2 surface-instrument border border-border bg-surface p-2.5 text-left text-fg-dim opacity-0 shadow-2xl transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${
          up ? "bottom-full mb-1.5" : "top-full mt-1.5"
        }`}
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
  spot,
  mode,
  setMode,
  dataSource,
  retryAt,
  liveSource,
  updatedAt,
  syntheticKnobsActive,
  runLocked = false,
  notice = null,
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
  /** The one page notice (degraded data, or the first-visit tip), shown in
      the slot at the top of this section in place of the tape row. */
  notice?: ReactNode;
}) {
  const knobTitle = runLocked
    ? "Frozen while the run holds the workspace lock."
    : syntheticKnobsActive
      ? "Shapes the deterministic seed tape."
      : "Seed-mode only — switch the dataset to Seed to shape the tape.";
  const knobsLive = syntheticKnobsActive && !runLocked;
  // In LIVE mode the three synthetic knobs are dead weight — collapsed behind
  // a single "tune the seed tape →" cell until asked for (Q3).
  const [seedKnobsOpen, setSeedKnobsOpen] = useState(false);
  const showSeedKnobs = syntheticKnobsActive || seedKnobsOpen;
  return (
    <section className="relative overflow-hidden">
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

      {/* THE NOTICE SLOT (2026-11-06). The degraded-data notice and the
          first-visit tip used to mount ABOVE this section once the page had
          hydrated (the data status is only known when /api/quote answers, the
          tip only once localStorage is read), and pushed the whole page down:
          51px on a 1440 desktop, CLS 0.083 against a 0.05 budget, and 148px
          on a phone, where the notice wrapped. They now swap in place inside a
          box the server already drew, so a notice arriving, changing or
          leaving moves nothing. With no notice the box is simply the header's
          top space. Each notice is one fixed-height row (QuantPage) that fits
          with room to spare; overflow-hidden is only the backstop. */}
      <div className="relative h-[3.9625rem] overflow-hidden lg:h-[4.9625rem]">{notice}</div>

      <div className="shell shell-wide relative pb-6">
        <div className="grid grid-cols-12 items-end gap-5">
          {/* Title block — on mobile it drops BELOW the workbench panel so a
              phone user lands on the actual tool, not a full screen of copy.
              PageHeader's type, by hand: the kit's header is one column and
              this one shares its row with the dataset panel. */}
          <div className="order-2 col-span-12 flex flex-col gap-5 lg:order-1 lg:col-span-7">
            <div>
              <div className="t-eyebrow text-brand-ink">Quant · for everyone</div>
              <h1 className="mt-3 font-display text-[clamp(2.5rem,5.6vw,4.75rem)] leading-[0.98] tracking-[-0.04em] text-fg text-balance">
                Run math
                <br />
                <span className="t-accent">at the market.</span>
              </h1>
            </div>

            <p className="measure-wide text-[1.0625rem] leading-[1.6] text-fg-dim">
              A workbench for quant traders and a class-12 math kid alike. Stack bots like
              Jupyter cells. Tune the math. See where they agree, where they fight, and read
              back what each one did — in plain English if you want, or in formulas if
              you’d rather. Drop in your own bot in under a minute.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Chip>Stack bots · tune · run</Chip>
              {/* The wrapper hides it: .calm-chip's own display outranks a utility. */}
              <span className="hidden sm:inline-flex">
                <Chip>Bring your own bot</Chip>
              </span>
            </div>
          </div>

          {/* Symbol & seed controls — first on mobile (the tool), right column on desktop */}
          <div className="order-1 col-span-12 lg:order-2 lg:col-span-5">
            <div className="calm-panel">
              <i aria-hidden className="lit-aura" />
              <div className="flex items-center justify-between gap-3 px-5 pt-4">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="t-label text-fg-dim">Dataset</span>
                  {/* the mode is a choice; the chip under it is the truth of what's running */}
                  <span className="inline-flex gap-1" role="group" aria-label="Data mode">
                    <button
                      onClick={() => setMode("live")}
                      aria-pressed={mode === "live"}
                      disabled={runLocked}
                      title="Real market OHLCV, ticking every ~15s (delayed feed)"
                      className={MODE_BTN}
                    >
                      Live
                    </button>
                    <button
                      onClick={() => setMode("seed")}
                      aria-pressed={mode === "seed"}
                      disabled={runLocked}
                      title="Deterministic synthetic tape — same seed, same bars, every time"
                      className={MODE_BTN}
                    >
                      Seed
                    </button>
                  </span>
                </span>
                <span className="t-label shrink-0 tabular-nums text-fg-dim">Spot ${spot.toFixed(2)}</span>
              </div>
              {/* Dataset provenance — one honest line beside its status chip.
                  LIVE names its real feed and freshness; PRACTICE reads as an
                  intentional, reproducible choice rather than "fake data". The
                  min-height holds a wrapped line, so the live tape landing
                  after the fallback line doesn't move the panel. */}
              <div className="flex min-h-[3.25rem] flex-wrap items-center gap-x-2 gap-y-1 px-5 pt-3">
                {dataSource === "fallback" ? (
                  <span className="inline-flex" title="The free data feed got rate-limited by the provider, so the bots are on a deterministic stand-in tape. It retries automatically — the live tape returns on its own.">
                    <Chip tone="warn" dot>
                      Offline
                      <RetryCountdown retryAt={retryAt} />
                    </Chip>
                  </span>
                ) : (
                  <span className="inline-flex" title={dataSource === "live" ? "Real market OHLCV from the live feed · delayed ~15s" : "deterministic seed tape"}>
                    <Chip tone={dataSource === "live" ? "brand" : "warn"}>
                      <span aria-hidden className={`size-1.5 shrink-0 rounded-full bg-current ${dataSource === "live" ? "pulse-dot" : ""}`} />
                      {dataSource === "live" ? "Live" : "Deterministic"}
                    </Chip>
                  </span>
                )}
                <div className="t-label min-w-0 flex-1 basis-56 text-fg-faint">
                  {mode === "seed" ? (
                    <>
                      <span className="text-amber">Practice mode</span>
                      <span> — a deterministic tape (same inputs → same candles every run), so every decision is reproducible.</span>
                    </>
                  ) : dataSource === "fallback" ? (
                    <>
                      <span className="text-fg-dim">Source</span>
                      <span> · practice tape while we reconnect to the live feed. </span>
                      <a
                        href="/pricing"
                        className="calm-link !text-[0.75rem]"
                        title="Real-time, un-throttled market data — coming to Power. See the plans."
                      >
                        Real-time <span aria-hidden>›</span>
                      </a>
                    </>
                  ) : (
                    <>
                      <span className="text-fg-dim">Source</span>
                      <span>
                        {" · live • "}
                        {sourceLabel(liveSource)} · <UpdatedAgo since={updatedAt} />
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 pb-4 pt-3">
                {/* symbol */}
                <div>
                  <div className="flex items-center gap-1.5 t-label text-fg-faint">
                    Symbol
                    <InfoTip text="The instrument every bot studies. Live mode fetches its real daily candles from Yahoo; Seed mode deals a synthetic tape instead." />
                  </div>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    disabled={runLocked}
                    className="calm-input mt-1.5 w-full disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {SYMBOLS.map((s) => (
                      <option key={s} value={s} className="bg-bg text-fg">{s}</option>
                    ))}
                  </select>
                </div>
                {/* bars */}
                <div>
                  <div className="flex items-center justify-between t-label text-fg-faint">
                    <span className="flex items-center gap-1.5">
                      Bars
                      <InfoTip text="How many daily candles the bots see — the lookback window. 180 ≈ 9 months of trading days. More bars: steadier statistics, slower signals. Fewer: twitchier, reacts faster." />
                    </span>
                    <span className="tabular-nums text-fg">{bars}</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={500}
                    value={bars}
                    onChange={(e) => setBars(Number(e.target.value))}
                    disabled={runLocked}
                    className={`${RANGE} disabled:opacity-40`}
                  />
                </div>
                {/* seed/drift/vol — synthetic only. In LIVE mode they'd all be
                    greyed "—" cells, so they fold behind one disclosure cell. */}
                {!showSeedKnobs && (
                  <button
                    onClick={() => setSeedKnobsOpen(true)}
                    title={knobTitle}
                    className="group text-left"
                  >
                    <div className="t-label text-fg-faint">Seed tape</div>
                    <div className="mt-1.5 text-[0.8125rem] font-medium text-brand-ink transition-colors group-hover:text-fg">
                      Tune the seed tape <span aria-hidden>›</span>
                    </div>
                  </button>
                )}
                {showSeedKnobs && (
                <div className={knobsLive ? "" : "opacity-40"} title={knobTitle}>
                  <div className="flex items-center justify-between t-label text-fg-faint">
                    <span className="flex items-center gap-1.5">
                      Seed
                      <InfoTip text="The random seed of the synthetic tape. Same seed = exactly the same candles, every run — that's what makes seed-mode experiments repeatable. Change it to deal a different market. (Seed mode only.)" />
                    </span>
                    <span className="tabular-nums text-fg">{syntheticKnobsActive ? seed : "—"}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={500}
                    value={seed}
                    disabled={!knobsLive}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    className={RANGE}
                  />
                </div>
                )}
                {/* drift — synthetic only */}
                {showSeedKnobs && (
                <div className={knobsLive ? "" : "opacity-40"} title={knobTitle}>
                  <div className="flex items-center justify-between t-label text-fg-faint">
                    <span className="flex items-center gap-1.5">
                      Drift μ
                      <InfoTip text="The synthetic tape's average daily push. Positive grinds the market up, negative bleeds it down, zero drifts sideways. Test a strategy in a bull tape, then flip the sign and see if it survives. (Seed mode only.)" />
                    </span>
                    <span className="tabular-nums text-fg">{syntheticKnobsActive ? drift.toFixed(2) : "—"}</span>
                  </div>
                  <input
                    type="range"
                    min={-0.5}
                    max={0.5}
                    step={0.01}
                    value={drift}
                    disabled={!knobsLive}
                    onChange={(e) => setDrift(Number(e.target.value))}
                    className={RANGE}
                  />
                </div>
                )}
                {/* vol — synthetic only */}
                {showSeedKnobs && (
                <div className={knobsLive ? "" : "opacity-40"} title={knobTitle}>
                  <div className="flex items-center justify-between t-label text-fg-faint">
                    <span className="flex items-center gap-1.5">
                      Vol σ
                      <InfoTip up text="How violently the synthetic tape swings bar to bar. Low = calm index-like candles; high = crypto-like whipsaw with fat tails. Reversion bots love low σ, breakout bots need high. (Seed mode only.)" />
                    </span>
                    <span className="tabular-nums text-fg">{syntheticKnobsActive ? vol.toFixed(2) : "—"}</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={5}
                    step={0.05}
                    value={vol}
                    disabled={!knobsLive}
                    onChange={(e) => setVol(Number(e.target.value))}
                    className={RANGE}
                  />
                </div>
                )}
                {/* beginner */}
                <div>
                  <div className="flex items-center gap-1.5 t-label text-fg-faint">
                    Teacher
                    <InfoTip up text="Plain-English mode: every bot adds a sentence explaining its verdict like a human would, instead of only formulas and numbers." />
                  </div>
                  <TogglePill on={beginner} onClick={() => setBeginner(!beginner)} className="mt-1.5 w-full justify-between">
                    <span>Plain English</span>
                    <span>{beginner ? "On" : "Off"}</span>
                  </TogglePill>
                </div>
              </div>

              {/* run all: the page's one primary */}
              <div className="grid grid-cols-2 gap-3 px-5 pb-5">
                <PillButton kind="primary" onClick={onRunAll} disabled={activeCount === 0 || runLocked} className="w-full">
                  {runLocked ? "Running…" : `▶ Run all (${activeCount})`}
                </PillButton>
                <PillButton onClick={onClearAll} disabled={activeCount === 0 || runLocked} className="w-full">
                  Clear workspace
                </PillButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

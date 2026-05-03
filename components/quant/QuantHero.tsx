"use client";

const SYMBOLS = ["AMZN", "AAPL", "NVDA", "TSLA", "SPY", "QQQ", "BTC", "META", "MSFT", "GOOG"];

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
}) {
  return (
    <section className="relative overflow-hidden border-b border-border bg-bg">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="pointer-events-none absolute -left-32 top-10 h-[320px] w-[320px] rounded-full bg-cyan/10 blur-[120px] drift" />
      <div className="pointer-events-none absolute right-0 top-20 h-[280px] w-[280px] rounded-full bg-plasma/10 blur-[120px] drift" style={{ animationDelay: "-5s" }} />
      <div className="pointer-events-none absolute inset-0 scanlines opacity-30" />

      {/* tape */}
      <div className="relative flex items-center justify-between border-b border-border-soft px-5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
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

      <div className="relative mx-auto max-w-[1500px] px-5 pb-6 pt-10 lg:pt-14">
        <div className="grid grid-cols-12 items-end gap-5">
          {/* Title block */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-wider">
              <span className="inline-flex items-center gap-2 border border-cyan/40 bg-cyan/5 px-2 py-1 text-cyan">
                <span className="size-1.5 rounded-full bg-cyan pulse-dot" /> quant · for everyone
              </span>
              <span className="inline-flex items-center gap-2 border border-border bg-surface px-2 py-1 text-fg-dim">
                stack bots · tune · run
              </span>
              <span className="hidden sm:inline-flex items-center gap-2 border border-border bg-surface px-2 py-1 text-fg-dim">
                bring your own bot
              </span>
            </div>

            <h1 className="font-display tracking-tightest text-[clamp(2.6rem,7.5vw,6.4rem)] leading-[0.88] text-fg">
              run math
              <br />
              <span className="italic font-light text-cyan phosphor" style={{ textShadow: "0 0 20px rgba(0,229,255,0.4), 0 0 4px rgba(0,229,255,0.7)" }}>at the market</span>
              <span className="text-cyan">.</span>
            </h1>

            <p className="max-w-[60ch] text-balance text-[15px] leading-relaxed text-fg-dim md:text-base">
              A workbench for quant traders and a class-12 math kid alike. Stack bots like
              Jupyter cells. Tune the math. See where they agree, where they fight, and what
              the combined edge says — in plain English if you want, or in formulas if
              you'd rather. Drop in your own bot in under a minute.
            </p>
          </div>

          {/* Symbol & seed controls */}
          <div className="col-span-12 lg:col-span-5">
            <div className="border border-border bg-surface">
              <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
                <span>dataset</span>
                <span>spot ${spot.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border">
                {/* symbol */}
                <div className="bg-bg p-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">symbol</div>
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      className="flex-1 border border-border bg-bg px-2 py-1 font-display text-xl tracking-tightest text-fg focus:border-bull focus:outline-none"
                    >
                      {SYMBOLS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* bars */}
                <div className="bg-bg p-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    <span>bars</span>
                    <span className="text-fg">{bars}</span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={500}
                    value={bars}
                    onChange={(e) => setBars(Number(e.target.value))}
                    className="mt-2 w-full accent-bull"
                  />
                </div>
                {/* seed */}
                <div className="bg-bg p-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    <span>seed</span>
                    <span className="text-fg">{seed}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={500}
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value))}
                    className="mt-2 w-full accent-bull"
                  />
                </div>
                {/* drift */}
                <div className="bg-bg p-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    <span>drift μ</span>
                    <span className="text-fg">{drift.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={-0.5}
                    max={0.5}
                    step={0.01}
                    value={drift}
                    onChange={(e) => setDrift(Number(e.target.value))}
                    className="mt-2 w-full accent-bull"
                  />
                </div>
                {/* vol */}
                <div className="bg-bg p-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    <span>vol σ</span>
                    <span className="text-fg">{vol.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={5}
                    step={0.05}
                    value={vol}
                    onChange={(e) => setVol(Number(e.target.value))}
                    className="mt-2 w-full accent-bull"
                  />
                </div>
                {/* beginner */}
                <div className="bg-bg p-3">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">teacher</div>
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
                  disabled={activeCount === 0}
                  className="flex items-center justify-center gap-2 bg-bg px-3 py-3 font-mono text-[11px] font-semibold uppercase tracking-wider text-bull hover:bg-bull hover:text-bg disabled:cursor-not-allowed disabled:text-fg-faint disabled:hover:bg-bg"
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  ▶ run all ({activeCount})
                </button>
                <button
                  onClick={onClearAll}
                  disabled={activeCount === 0}
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

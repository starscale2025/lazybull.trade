"use client";

import { useMemo, useState } from "react";
import { ACCURACY_BAND, HYPOTHETICAL_NOTE } from "@/lib/quant/types";
import { Chip, TogglePill } from "@/components/calm/kit";

const ALL_BOTS = [
  { id: "sma", name: "SMA Crossover", family: "trend", color: "var(--fg)" },
  { id: "macd", name: "MACD Histogram", family: "trend", color: "var(--fg)" },
  { id: "rsi", name: "RSI Reversion", family: "trend", color: "var(--fg)" },
  { id: "boll", name: "Bollinger Bands", family: "trend", color: "var(--fg)" },
  { id: "donchian", name: "Donchian Breakout", family: "trend", color: "var(--fg)" },
  { id: "z", name: "Z-Score Reversion", family: "stats", color: "var(--fg-faint)" },
  { id: "kalman", name: "Kalman Filter", family: "stats", color: "var(--fg-faint)" },
  { id: "linreg", name: "LinReg Channel", family: "stats", color: "var(--fg-faint)" },
  { id: "dir", name: "Direction Ensemble", family: "ai", color: "var(--brand-ink)" },
  { id: "mag", name: "Magnitude Regression", family: "ai", color: "var(--brand-ink)" },
  { id: "cnn", name: "1D CNN", family: "ai", color: "var(--brand-ink)" },
  { id: "txr", name: "Transformer", family: "ai", color: "var(--brand-ink)" },
];

// Pre-baked verdicts per "scenario". Honest: this is a teaching toy, not real
// model output — it shows how the consensus tally responds as more models agree.
const SCENARIOS = {
  bull: {
    label: "Strong uptrend",
    desc: "AMZN +14% in 30 days, low realized vol, broad market in risk-on. Every trend rule leans long; the mean-reversion rules quietly disagree.",
    votes: { sma: "buy", macd: "buy", rsi: "hold", boll: "buy", donchian: "buy", z: "sell", kalman: "buy", linreg: "buy", dir: "buy", mag: "buy", cnn: "buy", txr: "buy" } as Record<string, "buy" | "sell" | "hold">,
  },
  chop: {
    label: "Chop / range-bound",
    desc: "SPY oscillating ±2% inside a 30-day range. The trend rules whipsaw; the reversion rules read it far better.",
    votes: { sma: "hold", macd: "sell", rsi: "buy", boll: "buy", donchian: "hold", z: "buy", kalman: "hold", linreg: "buy", dir: "hold", mag: "hold", cnn: "hold", txr: "hold" } as Record<string, "buy" | "sell" | "hold">,
  },
  bear: {
    label: "Sharp drawdown",
    desc: "TSLA -22% over 4 weeks after an earnings miss. The volatility regime flipped. Most rules lean short; two contrarians do not.",
    votes: { sma: "sell", macd: "sell", rsi: "buy", boll: "sell", donchian: "sell", z: "buy", kalman: "sell", linreg: "sell", dir: "sell", mag: "sell", cnn: "sell", txr: "sell" } as Record<string, "buy" | "sell" | "hold">,
  },
};

export function LearnConsensusPlayground() {
  const [scenario, setScenario] = useState<keyof typeof SCENARIOS>("bull");
  const [active, setActive] = useState<string[]>(ALL_BOTS.map((b) => b.id));

  const scn = SCENARIOS[scenario];

  const tally = useMemo(() => {
    let buy = 0, sell = 0, hold = 0;
    for (const id of active) {
      const v = scn.votes[id];
      if (v === "buy") buy++;
      else if (v === "sell") sell++;
      else hold++;
    }
    const total = active.length;
    const lean = buy > sell && buy > hold ? "buy" : sell > buy && sell > hold ? "sell" : "hold";
    const agreeCount = lean === "buy" ? buy : lean === "sell" ? sell : hold;
    const agreePct = total > 0 ? agreeCount / total : 0;
    // The thresholds are unchanged; only the WORDS are. The old upper-case
    // grade ladder read as trade grades on a page teaching beginners what
    // a model output is. These say what the quantity actually measures —
    // the same vocabulary lib/quant/ai-bots.ts BAND_LABEL uses on the cards.
    const tier = agreePct >= 0.85 ? "very strong agreement" : agreePct >= 0.7 ? "moderate agreement" : agreePct >= 0.55 ? "lean" : "split";
    return { buy, sell, hold, total, lean, agreeCount, agreePct, tier };
  }, [active, scn]);

  const toggle = (id: string) => setActive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  return (
    <div className="grid grid-cols-1 gap-5 @md:grid-cols-12">
      {/* Scenario picker + bot toggles */}
      <div className="@md:col-span-7 flex flex-col gap-4">
        <div>
          <div className="t-label text-fg-dim">Scenario</div>
          {/* Labels only on the buttons — the selected scenario's description
              lives once, in the line below, instead of three abridged copies
              of it. Pills wrap, so a half that narrows to ~290px just takes a
              second row. */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>).map((k) => (
              <TogglePill key={k} on={k === scenario} onClick={() => setScenario(k)}>
                {SCENARIOS[k].label}
              </TogglePill>
            ))}
          </div>
          <div className="mt-2 text-[0.8125rem] leading-relaxed text-fg-dim">{scn.desc}</div>
        </div>

        <div>
          <div className="flex items-center justify-between t-label text-fg-dim">
            <span>Active bots</span>
            <span className="text-fg-faint">Click to toggle · {active.length}/{ALL_BOTS.length} on</span>
          </div>
          {/* Compact pill grid — ticker-style code + vote, full name on the
              tooltip. The 12-row labelled list was the tallest block in the
              sticky frame; the pills carry the same interaction at a third of
              the height. */}
          <div className="mt-2 grid grid-cols-3 gap-1.5 @lg:grid-cols-4">
            {ALL_BOTS.map((b) => {
              const isActive = active.includes(b.id);
              const v = scn.votes[b.id];
              const verdictTone = v === "buy" ? "text-bull" : v === "sell" ? "text-bear" : "text-fg-dim";
              return (
                <button
                  key={b.id}
                  onClick={() => toggle(b.id)}
                  title={`${b.name} — ${v === "buy" ? "lean long" : v === "sell" ? "lean short" : "no lean"}`}
                  className={`flex items-center justify-between gap-1.5 rounded-lg bg-fg/[0.05] px-2 py-1.5 text-left transition-opacity ${
                    isActive ? "opacity-100" : "opacity-30 hover:opacity-50"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="text-[0.5rem]" style={{ color: b.color }}>●</span>
                    <span className="truncate font-mono text-[0.625rem] uppercase tracking-wide text-fg">{b.id}</span>
                  </span>
                  <span className={`font-mono text-[0.625rem] ${verdictTone}`}>
                    {v}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="@md:col-span-5">
        <div className="rounded-xl bg-fg/[0.05]">
          <div className="px-4 pt-3.5 t-label text-fg-dim">Consensus tally</div>
          <div className="p-4">
            <Chip dot>
              {tally.tier.charAt(0).toUpperCase() + tally.tier.slice(1)} · {tally.lean === "buy" ? "lean long" : tally.lean === "sell" ? "lean short" : "no lean"}
            </Chip>
            <div className="mt-4 font-display text-5xl tracking-tightest tabular-nums text-fg">
              {tally.agreeCount} / {tally.total}
            </div>
            <div className="mt-1 t-label text-fg-dim">
              Models agree ({(tally.agreePct * 100).toFixed(0)}%)
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-3">
              {/* The three buckets counted models under BUY / HOLD / SELL —
                  which reads as a desk handing down orders when it is really
                  a histogram of six opinions. Same numbers, named as leans:
                  what a model TILTED towards, not what anyone should do. */}
              <Bucket label="Lean long" value={tally.buy} tone="bull" />
              <Bucket label="No lean" value={tally.hold} tone="neutral" />
              <Bucket label="Lean short" value={tally.sell} tone="bear" />
            </div>
          </div>

          <div className="px-4 pb-4">
            <div className="t-label text-fg-faint mb-2">
              What this means
            </div>
            <p className="text-[0.8125rem] leading-relaxed text-fg-dim">
              {tally.tier === "very strong agreement" &&
                <>Almost every model landed on the same side. That is a fact about the models — built on the same tape, they found the same thing — and not a better set of odds: the measured band below covers this state and every other one.</>}
              {tally.tier === "moderate agreement" &&
                <>Most models landed on the same side, with real dissent. Worth reading the dissenters: they are usually a different family seeing a different thing.</>}
              {tally.tier === "lean" &&
                <>A lean, and a thin one. Just over half of the models tilted the same way, which is nearly what you would get from noise.</>}
              {tally.tier === "split" &&
                <>The models disagree. Historically the next move was close to a coin flip — and a split is the most useful reading on this panel, because it is the models admitting the tape is ambiguous.</>}
            </p>
            {/* ONE band, printed at every agreement level, with the hedge
                attached to it rather than floating a paragraph away. */}
            <p className="mt-2 t-label text-fg-faint">
              Measured hit rate {ACCURACY_BAND} at every agreement level · {HYPOTHETICAL_NOTE} · education only, not advice
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bucket({ label, value, tone }: { label: string; value: number; tone: "bull" | "bear" | "neutral" }) {
  const cls = tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : "text-fg-dim";
  return (
    <div className="text-center">
      <div className={`font-display text-2xl tabular-nums ${cls}`}>{value}</div>
      <div className="mt-0.5 t-label text-fg-faint">{label}</div>
    </div>
  );
}

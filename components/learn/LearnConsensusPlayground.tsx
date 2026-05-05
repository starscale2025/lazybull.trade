"use client";

import { useMemo, useState } from "react";

const ALL_BOTS = [
  { id: "sma", name: "SMA Crossover", family: "trend", color: "var(--bull)" },
  { id: "macd", name: "MACD Histogram", family: "trend", color: "var(--bull)" },
  { id: "rsi", name: "RSI Reversion", family: "trend", color: "var(--bull)" },
  { id: "boll", name: "Bollinger Bands", family: "trend", color: "var(--bull)" },
  { id: "donchian", name: "Donchian Breakout", family: "trend", color: "var(--bull)" },
  { id: "z", name: "Z-Score Reversion", family: "stats", color: "var(--cyan)" },
  { id: "kalman", name: "Kalman Filter", family: "stats", color: "var(--cyan)" },
  { id: "linreg", name: "LinReg Channel", family: "stats", color: "var(--cyan)" },
  { id: "dir", name: "Direction Ensemble", family: "ai", color: "var(--bear)" },
  { id: "mag", name: "Magnitude Regression", family: "ai", color: "var(--bear)" },
  { id: "cnn", name: "1D CNN", family: "ai", color: "var(--bear)" },
  { id: "txr", name: "Transformer", family: "ai", color: "var(--bear)" },
];

// Pre-baked verdicts per "scenario". Honest: this is a teaching toy, not real
// model output — it shows how the consensus tally responds as more models agree.
const SCENARIOS = {
  bull: {
    label: "Strong uptrend",
    desc: "AMZN +14% in 30 days, low realized vol, broad market in risk-on. All trend bots fire long; mean-reversion bots quietly disagree.",
    votes: { sma: "buy", macd: "buy", rsi: "hold", boll: "buy", donchian: "buy", z: "sell", kalman: "buy", linreg: "buy", dir: "buy", mag: "buy", cnn: "buy", txr: "buy" } as Record<string, "buy" | "sell" | "hold">,
  },
  chop: {
    label: "Chop / range-bound",
    desc: "SPY oscillating ±2% inside a 30-day range. Trend bots whipsaw and lose. Reversion bots feast.",
    votes: { sma: "hold", macd: "sell", rsi: "buy", boll: "buy", donchian: "hold", z: "buy", kalman: "hold", linreg: "buy", dir: "hold", mag: "hold", cnn: "hold", txr: "hold" } as Record<string, "buy" | "sell" | "hold">,
  },
  bear: {
    label: "Sharp drawdown",
    desc: "TSLA -22% over 4 weeks after an earnings miss. Volatility regime flipped. Most bots lean bearish; a contrarian Kelly stays neutral.",
    votes: { sma: "sell", macd: "sell", rsi: "buy", boll: "sell", donchian: "sell", z: "buy", kalman: "sell", linreg: "sell", dir: "sell", mag: "sell", cnn: "sell", txr: "sell" } as Record<string, "buy" | "sell" | "hold">,
  },
};

export function LearnConsensusPlayground() {
  const [scenario, setScenario] = useState<keyof typeof SCENARIOS>("bull");
  const [active, setActive] = useState<string[]>(ALL_BOTS.map((b) => b.id));

  const bot = (id: string) => ALL_BOTS.find((b) => b.id === id)!;
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
    const tier = agreePct >= 0.85 ? "ULTRA" : agreePct >= 0.7 ? "HIGH" : agreePct >= 0.55 ? "MEDIUM" : "SPLIT";
    return { buy, sell, hold, total, lean, agreeCount, agreePct, tier };
  }, [active, scn]);

  const tierTone = tally.tier === "ULTRA" ? "bull" : tally.tier === "HIGH" ? "info" : tally.tier === "MEDIUM" ? "warn" : "neutral";
  const TIER_BG: Record<string, string> = {
    bull: "border-bull/50 bg-bull/10 text-bull",
    info: "border-cyan/50 bg-cyan/10 text-cyan",
    warn: "border-amber/50 bg-amber/10 text-amber",
    neutral: "border-border bg-bg text-fg-dim",
  };

  const toggle = (id: string) => setActive((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Scenario picker + bot toggles */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        <div className="border border-border bg-surface">
          <div className="border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            scenario
          </div>
          <div className="grid grid-cols-3 gap-px bg-border">
            {(Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>).map((k) => (
              <button
                key={k}
                onClick={() => setScenario(k)}
                className={`bg-bg px-3 py-3 text-left transition-colors ${
                  k === scenario ? "bg-bull/[0.06]" : "hover:bg-bg-soft"
                }`}
              >
                <div className={`font-mono text-[10px] uppercase tracking-wider ${k === scenario ? "text-bull" : "text-fg-dim"}`}>
                  {SCENARIOS[k].label}
                </div>
                <div className="mt-1 text-[11px] leading-snug text-fg-dim">
                  {SCENARIOS[k].desc.split(".")[0]}.
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-border-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            <span className="normal-case tracking-normal text-fg-dim">{scn.desc}</span>
          </div>
        </div>

        <div className="border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            <span>active bots</span>
            <span className="text-fg-faint">click to toggle · {active.length}/{ALL_BOTS.length} on</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-3">
            {ALL_BOTS.map((b) => {
              const isActive = active.includes(b.id);
              const v = scn.votes[b.id];
              const verdictTone = v === "buy" ? "text-bull" : v === "sell" ? "text-bear" : "text-fg-dim";
              return (
                <button
                  key={b.id}
                  onClick={() => toggle(b.id)}
                  className={`flex items-center justify-between bg-bg px-3 py-2 text-left transition-opacity ${
                    isActive ? "opacity-100" : "opacity-30 hover:opacity-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ color: b.color }}>●</span>
                    <span className="font-mono text-[11px] tracking-wide text-fg">{b.name}</span>
                  </div>
                  <span className={`font-mono text-[10px] uppercase tracking-wider ${verdictTone}`}>
                    {v}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="lg:col-span-5">
        <div className="border border-border bg-surface">
          <div className="border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            consensus tally
          </div>
          <div className="p-5">
            <div className={`inline-flex items-center gap-2 border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${TIER_BG[tierTone]}`}>
              <span className="size-1.5 rounded-full bg-current" />
              {tally.tier} · {tally.lean.toUpperCase()}
            </div>
            <div className="mt-4 font-display text-5xl tracking-tightest tabular-nums text-fg">
              {tally.agreeCount} / {tally.total}
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-wider text-fg-dim">
              models agree ({(tally.agreePct * 100).toFixed(0)}%)
            </div>
          </div>

          <div className="border-t border-border-soft p-5">
            <div className="grid grid-cols-3 gap-px overflow-hidden border border-border bg-border">
              <Bucket label="BUY" value={tally.buy} tone="bull" />
              <Bucket label="HOLD" value={tally.hold} tone="neutral" />
              <Bucket label="SELL" value={tally.sell} tone="bear" />
            </div>
          </div>

          <div className="border-t border-border-soft p-5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint mb-2">
              what this means
            </div>
            <p className="text-[13px] leading-relaxed text-fg-dim">
              {tally.tier === "ULTRA" &&
                <>Real edge. Historically, when ≥85% of independent models agree, accuracy lands in the 65–77% band. Size up.</>}
              {tally.tier === "HIGH" &&
                <>Tradeable signal. 70–85% agreement → ~60–66% historical accuracy. Half-Kelly is sensible.</>}
              {tally.tier === "MEDIUM" &&
                <>Lean, not conviction. 55–70% agreement → ~55–60% accuracy. Small size, define your stop in advance.</>}
              {tally.tier === "SPLIT" &&
                <>Models disagree. The market is genuinely confused — that's the most valuable signal of all. Sit it out.</>}
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
    <div className="bg-bg p-3 text-center">
      <div className={`font-display text-2xl tabular-nums ${cls}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-faint">{label}</div>
    </div>
  );
}

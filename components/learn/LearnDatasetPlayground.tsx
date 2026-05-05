"use client";

import { useMemo, useState } from "react";
import { generateCandles } from "@/lib/candles";
import { CandleChart } from "@/components/CandleChart";

const KNOBS = [
  { key: "symbol" as const, label: "Symbol", body: "Picks the baseline price the synthetic chart starts from. AMZN ≈ $226, NVDA ≈ $138, BTC ≈ $95k. Real symbols get real Yahoo bars on the workbench; synthetic is just for stress-testing." },
  { key: "bars" as const, label: "Bars", body: "How many candles the chart shows. 60 = 3 months of daily, 252 = a year, 1300 = five years. More bars give bots more history to fit." },
  { key: "seed" as const, label: "Seed", body: "Which 'what-if' universe. Same seed → same chart, every page load. This is what makes Lazybull's results reproducible." },
  { key: "drift" as const, label: "Drift μ", body: "The trend. Positive = bullish drift up; negative = bearish drift down; zero = pure noise. Trend bots love high drift; reversion bots love drift near zero." },
  { key: "vol" as const, label: "Vol σ", body: "How jumpy the noise is. Low vol → smooth ride. High vol → wild swings. Real markets sit around σ ≈ 1.5; crypto and earnings days push past 3." },
];

export function LearnDatasetPlayground() {
  const [symbol, setSymbol] = useState("AMZN");
  const [bars, setBars] = useState(120);
  const [seed, setSeed] = useState(11);
  const [drift, setDrift] = useState(0.18);
  const [vol, setVol] = useState(1.6);
  const [focus, setFocus] = useState<typeof KNOBS[number]["key"] | null>(null);

  const candles = useMemo(
    () => generateCandles(bars, seed + symbol.charCodeAt(0), spotForSymbol(symbol), drift, vol),
    [bars, seed, symbol, drift, vol]
  );
  const last = candles[candles.length - 1];
  const first = candles[0];
  const change = last && first ? ((last.c - first.o) / first.o) * 100 : 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Knobs */}
      <div className="lg:col-span-5 flex flex-col gap-3">
        <div className="border border-border bg-surface">
          <div className="border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            dataset · synthetic mode
          </div>
          <div className="grid grid-cols-2 gap-px bg-border">
            <Knob label="Symbol" focused={focus === "symbol"} onFocus={() => setFocus("symbol")}>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="h-8 w-full border border-border bg-bg px-2 font-mono text-[12px] text-fg outline-none"
              >
                {Object.keys(SPOT_MAP).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Knob>
            <Knob label="Bars" focused={focus === "bars"} onFocus={() => setFocus("bars")}>
              <Slider value={bars} setValue={setBars} min={30} max={400} step={1} suffix="" />
            </Knob>
            <Knob label="Seed" focused={focus === "seed"} onFocus={() => setFocus("seed")}>
              <Slider value={seed} setValue={setSeed} min={1} max={99} step={1} suffix="" />
            </Knob>
            <Knob label="Drift μ" focused={focus === "drift"} onFocus={() => setFocus("drift")}>
              <Slider value={drift} setValue={setDrift} min={-0.5} max={0.5} step={0.01} suffix="" />
            </Knob>
            <Knob label="Vol σ" focused={focus === "vol"} onFocus={() => setFocus("vol")} span>
              <Slider value={vol} setValue={setVol} min={0.4} max={4} step={0.05} suffix="" />
            </Knob>
          </div>
        </div>

        <div className="border border-border bg-bg p-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim min-h-[110px]">
          {focus ? (
            <>
              <div className="text-bull">⟢ {KNOBS.find((k) => k.key === focus)?.label}</div>
              <div className="mt-2 normal-case tracking-normal text-[12px] leading-relaxed text-fg">
                {KNOBS.find((k) => k.key === focus)?.body}
              </div>
            </>
          ) : (
            <div className="text-fg-faint">click any knob to learn what it does →</div>
          )}
        </div>
      </div>

      {/* Chart preview */}
      <div className="lg:col-span-7">
        <div className="border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            <span>{symbol} · {bars} bars · seed {seed}</span>
            <span className={change >= 0 ? "text-bull" : "text-bear"}>
              {change >= 0 ? "+" : ""}{change.toFixed(2)}%
            </span>
          </div>
          <div className="p-2">
            <CandleChart candles={candles} height={320} width={720} />
          </div>
          <div className="border-t border-border-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim flex items-center justify-between">
            <span>spot ${last?.c.toFixed(2)}</span>
            <span className="text-fg-faint">deterministic — same seed gives same chart, every time</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Knob({ label, children, focused, onFocus, span }: { label: string; children: React.ReactNode; focused: boolean; onFocus: () => void; span?: boolean }) {
  return (
    <div
      onClick={onFocus}
      className={`bg-bg p-3 cursor-pointer transition-colors ${focused ? "bg-bull/[0.04]" : "hover:bg-bg-soft"} ${span ? "col-span-2" : ""}`}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">{label}</div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Slider({ value, setValue, min, max, step, suffix }: { value: number; setValue: (n: number) => void; min: number; max: number; step: number; suffix: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between font-mono text-[11px] tabular-nums text-fg">
        <span>{value.toFixed(step < 1 ? 2 : 0)}{suffix}</span>
        <span className="text-fg-faint text-[9px]">{min} → {max}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        className="h-1 w-full accent-bull"
      />
    </label>
  );
}

const SPOT_MAP: Record<string, number> = {
  AMZN: 226, AAPL: 232, NVDA: 178, TSLA: 312, SPY: 612,
  QQQ: 558, BTC: 95400, META: 745, MSFT: 458, GOOG: 195,
};
function spotForSymbol(s: string) {
  return SPOT_MAP[s] ?? 100;
}

"use client";

// Pick a bot, watch its backtest play out bar-by-bar. Equity curve grows
// in real time, stats fill in as the simulation progresses. The single
// most viscerally-useful thing you can show a beginner: "this is what a
// strategy looks like in motion."

import { useEffect, useMemo, useRef, useState } from "react";
import { generateCandles, type Candle } from "@/lib/candles";
import { getBot } from "@/lib/quant/bots";
import type { BotResult, Signal } from "@/lib/quant/types";

const PRESET_BOTS = [
  { id: "sma-cross",    label: "SMA Crossover",  blurb: "Trend follower. Buys golden crosses." },
  { id: "rsi-rev",      label: "RSI Reversion",  blurb: "Catches oversold bounces." },
  { id: "macd",         label: "MACD Histogram", blurb: "Momentum flips." },
  { id: "donchian",     label: "Donchian Breakout", blurb: "Buys 20-day highs." },
  { id: "boll",         label: "Bollinger Bands",blurb: "Fades band touches." },
  { id: "zscore",       label: "Z-Score Reversion", blurb: "Stat-arb mean reversion." },
];

const SCENARIOS = [
  { key: "bull", label: "Strong uptrend", drift: 0.30, vol: 1.6, seed: 11 },
  { key: "chop", label: "Sideways chop", drift: 0.0, vol: 1.4, seed: 17 },
  { key: "bear", label: "Drawdown", drift: -0.25, vol: 2.4, seed: 29 },
];

export function LearnBacktestBuilder() {
  const [botId, setBotId] = useState("sma-cross");
  const [scenarioKey, setScenarioKey] = useState("bull");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [token, setToken] = useState(0);
  const tickRef = useRef<NodeJS.Timeout | null>(null);

  const def = useMemo(() => getBot(botId), [botId]);
  const scenario = SCENARIOS.find((s) => s.key === scenarioKey)!;
  const candles: Candle[] = useMemo(
    () => generateCandles(160, scenario.seed, 100, scenario.drift, scenario.vol),
    [scenario.seed, scenario.drift, scenario.vol]
  );

  // Compute the full backtest once, slice to progress for animation.
  const fullResult = useMemo<BotResult | null>(() => {
    if (!def) return null;
    try {
      return Promise.resolve(def.run({ candles, symbol: "DEMO" }, Object.fromEntries(def.params.map((p) => [p.key, p.default])))) as never;
    } catch {
      return null;
    }
  }, [def, candles]);

  // Resolve the (sync) result once.
  const [result, setResult] = useState<BotResult | null>(null);
  useEffect(() => {
    if (!def) return;
    let cancel = false;
    (async () => {
      const params = Object.fromEntries(def.params.map((p) => [p.key, p.default]));
      try {
        const r = await Promise.resolve(def.run({ candles, symbol: "DEMO" }, params));
        if (!cancel) setResult(r);
      } catch {
        if (!cancel) setResult(null);
      }
    })();
    return () => { cancel = true; };
  }, [def, candles]);

  // Reset when bot or scenario changes.
  useEffect(() => {
    setProgress(0);
    setRunning(false);
    setToken((n) => n + 1);
    if (tickRef.current) clearInterval(tickRef.current);
  }, [botId, scenarioKey]);

  // Animation loop.
  const start = () => {
    if (!result) return;
    if (tickRef.current) clearInterval(tickRef.current);
    setRunning(true);
    setProgress(0);
    setToken((n) => n + 1);
    const total = candles.length;
    let i = 0;
    tickRef.current = setInterval(() => {
      i += 1;
      if (i >= total) {
        clearInterval(tickRef.current!);
        tickRef.current = null;
        setRunning(false);
      }
      setProgress(i / total);
    }, 25);
  };
  const reset = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setRunning(false);
    setProgress(0);
    setToken((n) => n + 1);
  };

  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  // Slice the equity / signals up to current progress for animation.
  const cutoff = Math.max(2, Math.floor(progress * candles.length));
  const visiblePrices = candles.slice(0, cutoff).map((c) => c.c);
  const visibleEquity = (result?.equity ?? []).slice(0, cutoff);
  const visibleSignals = (result?.signals ?? []).filter((s: Signal) => s.i < cutoff);

  // Live stats up to cutoff.
  const stats = useMemo(() => {
    if (!visibleEquity.length) return { ret: 0, sharpe: 0, maxDD: 0, trades: 0, wr: 0 };
    const eq = visibleEquity;
    const last = eq[eq.length - 1];
    const ret = last - 1;
    // Daily returns from equity.
    const rs: number[] = [];
    for (let i = 1; i < eq.length; i++) rs.push(eq[i] / eq[i - 1] - 1);
    const mean = rs.reduce((a, b) => a + b, 0) / Math.max(1, rs.length);
    const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rs.length - 1));
    const sharpe = sd > 0 ? (mean / sd) * Math.sqrt(252) : 0;
    let peak = -Infinity, dd = 0;
    for (const v of eq) { peak = Math.max(peak, v); dd = Math.min(dd, (v - peak) / peak); }
    const trades = visibleSignals.filter((s) => s.kind === "buy" || s.kind === "sell").length;
    // crude win-rate: pair consecutive buy/sell, sign of price diff.
    let wins = 0, total = 0;
    let lastBuy: number | null = null;
    for (const s of visibleSignals) {
      if (s.kind === "buy") lastBuy = candles[s.i].c;
      else if (s.kind === "sell" && lastBuy != null) {
        total++;
        if (candles[s.i].c > lastBuy) wins++;
        lastBuy = null;
      }
    }
    const wr = total > 0 ? wins / total : 0;
    return { ret, sharpe, maxDD: dd, trades, wr };
  }, [visibleEquity, visibleSignals, candles]);

  if (!def) {
    return <div className="grid h-32 place-items-center border border-border bg-surface text-fg-faint font-mono text-[11px]">bot not found</div>;
  }

  return (
    <div className="space-y-4">
      {/* Top: bot picker + scenario picker */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-7 border border-border bg-surface">
          <div className="border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            pick a bot
          </div>
          <div className="grid grid-cols-2 gap-px bg-border md:grid-cols-3">
            {PRESET_BOTS.map((b) => (
              <button
                key={b.id}
                onClick={() => setBotId(b.id)}
                className={`bg-bg p-3 text-left transition-colors ${b.id === botId ? "bg-bull/[0.06]" : "hover:bg-bg-soft"}`}
              >
                <div className={`font-mono text-[11px] tracking-wide ${b.id === botId ? "text-bull" : "text-fg"}`}>
                  {b.label}
                </div>
                <div className="mt-1 text-[10px] leading-snug text-fg-dim normal-case tracking-normal">{b.blurb}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 border border-border bg-surface">
          <div className="border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
            market scenario
          </div>
          <div className="grid grid-cols-3 gap-px bg-border">
            {SCENARIOS.map((s) => (
              <button
                key={s.key}
                onClick={() => setScenarioKey(s.key)}
                className={`bg-bg p-3 text-center transition-colors ${s.key === scenarioKey ? "bg-bull/[0.06]" : "hover:bg-bg-soft"}`}
              >
                <div className={`font-mono text-[11px] uppercase tracking-wider ${s.key === scenarioKey ? "text-bull" : "text-fg-dim"}`}>
                  {s.label}
                </div>
                <div className="mt-1 font-mono text-[9px] text-fg-faint">
                  μ={s.drift.toFixed(2)} · σ={s.vol.toFixed(1)}
                </div>
              </button>
            ))}
          </div>
          <div className="border-t border-border-soft p-2 flex gap-2">
            <button
              onClick={start}
              disabled={running || !result}
              className="flex-1 h-8 border border-bull bg-bull text-bg font-mono text-[11px] uppercase tracking-wider hover:bg-bull-dim disabled:opacity-50 disabled:bg-bg disabled:text-fg-faint disabled:border-border"
            >
              {running ? "▶ running…" : progress >= 1 ? "↻ replay" : "▶ run backtest"}
            </button>
            {progress > 0 && (
              <button
                onClick={reset}
                className="h-8 border border-border bg-bg px-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:text-fg"
              >
                reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chart with price + equity overlaid + signals */}
      <div className="border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border bg-bg-soft px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-dim">
          <span>{def.name} on {scenario.label}</span>
          <span>bar {cutoff} / {candles.length}</span>
        </div>
        <BacktestChart
          key={`${botId}-${scenarioKey}-${token}`}
          prices={visiblePrices}
          fullPrices={candles.map((c) => c.c)}
          equity={visibleEquity}
          signals={visibleSignals}
        />
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 gap-px overflow-hidden border border-border bg-border md:grid-cols-5">
        <Stat label="Total return" value={`${stats.ret >= 0 ? "+" : ""}${(stats.ret * 100).toFixed(1)}%`} tone={stats.ret >= 0 ? "var(--bull)" : "var(--bear)"} />
        <Stat label="Sharpe" value={stats.sharpe.toFixed(2)} tone={stats.sharpe > 1 ? "var(--bull)" : stats.sharpe > 0 ? "var(--cyan)" : "var(--bear)"} />
        <Stat label="Max DD" value={`${(stats.maxDD * 100).toFixed(1)}%`} tone="var(--bear)" />
        <Stat label="Trades" value={String(stats.trades)} tone="var(--fg)" />
        <Stat label="Win rate" value={`${(stats.wr * 100).toFixed(0)}%`} tone={stats.wr > 0.5 ? "var(--bull)" : "var(--amber)"} />
      </div>

      <div className="border border-dashed border-border bg-bg p-3 font-mono text-[11px] tracking-wide text-fg-dim leading-relaxed">
        <span className="text-fg-faint">read this →</span> a high return doesn&apos;t mean a good bot.
        Look at <span className="text-fg">Sharpe</span> (return per unit of bumpy ride — &gt;1 is good)
        and <span className="text-fg">Max DD</span> (the worst peak-to-trough drop the bot put you
        through). The same bot wins big in one regime and loses in another. That&apos;s why stacking
        multiple bots matters.
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="bg-bg p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">{label}</div>
      <div className="mt-1 font-mono text-[14px] tabular-nums" style={{ color: tone }}>{value}</div>
    </div>
  );
}

function BacktestChart({
  prices, fullPrices, equity, signals,
}: {
  prices: number[]; fullPrices: number[]; equity: number[]; signals: Signal[];
}) {
  const W = 800, H = 280, padL = 8, padR = 60, padT = 16, padB = 24;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const N = fullPrices.length;
  const priceMin = Math.min(...fullPrices), priceMax = Math.max(...fullPrices);
  const priceRange = priceMax - priceMin || 1;
  const eqMin = Math.min(0.85, ...(equity.length ? equity : [1]));
  const eqMax = Math.max(1.15, ...(equity.length ? equity : [1]));
  const eqRange = eqMax - eqMin || 1;
  const xOf = (i: number) => padL + (i / Math.max(1, N - 1)) * innerW;
  const yOfPrice = (p: number) => padT + (1 - (p - priceMin) / priceRange) * innerH;
  const yOfEq = (e: number) => padT + (1 - (e - eqMin) / eqRange) * innerH;

  const pricePath = prices.length
    ? prices.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOfPrice(p).toFixed(1)}`).join(" ")
    : "";
  const equityPath = equity.length
    ? equity.map((e, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOfEq(e).toFixed(1)}`).join(" ")
    : "";
  const lastEq = equity[equity.length - 1] ?? 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
      {/* gridlines */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1={padL} x2={W - padR} y1={padT + t * innerH} y2={padT + t * innerH} stroke="rgba(245,245,240,0.04)" />
      ))}

      {/* equity curve gradient fill */}
      {equity.length > 1 && (
        <>
          <defs>
            <linearGradient id="bt-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={lastEq >= 1 ? "var(--bull)" : "var(--bear)"} stopOpacity="0.18" />
              <stop offset="100%" stopColor={lastEq >= 1 ? "var(--bull)" : "var(--bear)"} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${equityPath} L${xOf(equity.length - 1)},${padT + innerH} L${xOf(0)},${padT + innerH} Z`}
            fill="url(#bt-fill)"
          />
        </>
      )}

      {/* price (background) */}
      <path d={pricePath} fill="none" stroke="rgba(245,245,240,0.5)" strokeWidth="1" />

      {/* equity (foreground) */}
      <path d={equityPath} fill="none" stroke={lastEq >= 1 ? "var(--bull)" : "var(--bear)"} strokeWidth="1.6" />

      {/* signals */}
      {signals.map((s, k) => {
        const x = xOf(s.i);
        const y = yOfPrice(prices[s.i] ?? fullPrices[s.i]);
        const c = s.kind === "buy" ? "var(--bull)" : s.kind === "sell" ? "var(--bear)" : "var(--amber)";
        return (
          <g key={k}>
            <line x1={x} x2={x} y1={padT} y2={H - padB} stroke={c} strokeOpacity="0.15" />
            <circle cx={x} cy={y} r={4} fill={c} stroke="var(--bg)" strokeWidth="1.5" />
          </g>
        );
      })}

      {/* equity axis label on right */}
      <g>
        <text x={W - padR + 6} y={padT + 8} fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-faint)">equity</text>
        <text x={W - padR + 6} y={padT + 22} fontFamily="var(--font-jetbrains)" fontSize="10" fill={lastEq >= 1 ? "var(--bull)" : "var(--bear)"}>{lastEq.toFixed(2)}×</text>
      </g>

      {/* now line */}
      {prices.length > 0 && prices.length < fullPrices.length && (
        <line x1={xOf(prices.length - 1)} x2={xOf(prices.length - 1)} y1={padT} y2={H - padB} stroke="var(--cyan)" strokeOpacity="0.6" strokeDasharray="2 3" />
      )}

      {/* legend */}
      <g transform={`translate(${padL + 8}, ${padT + 6})`}>
        <rect width="200" height="36" fill="rgba(0,0,0,0.4)" />
        <line x1={6} x2={20} y1={12} y2={12} stroke="rgba(245,245,240,0.5)" strokeWidth="1" />
        <text x={26} y={15} fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-dim)">price</text>
        <line x1={6} x2={20} y1={26} y2={26} stroke={lastEq >= 1 ? "var(--bull)" : "var(--bear)"} strokeWidth="1.6" />
        <text x={26} y={29} fontFamily="var(--font-jetbrains)" fontSize="10" fill="var(--fg-dim)">equity ({lastEq >= 1 ? "+" : ""}{((lastEq - 1) * 100).toFixed(1)}%)</text>
      </g>
    </svg>
  );
}

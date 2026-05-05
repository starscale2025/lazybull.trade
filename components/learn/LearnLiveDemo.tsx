"use client";

import { useEffect, useMemo, useState } from "react";
import { generateCandles, type Candle } from "@/lib/candles";
import { getBot } from "@/lib/quant/bots";
import { BotCell } from "@/components/quant/BotCell";
import type { ActiveBot, BotResult } from "@/lib/quant/types";

const SYMBOL = "AMZN";

export function LearnLiveDemo() {
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "synthetic">("synthetic");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/quote?symbol=${SYMBOL}&tf=D`);
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.bars) && j.bars.length > 30) {
          const tail = j.bars.slice(-160).map((b: { o: number; h: number; l: number; c: number }) => ({
            o: b.o, h: b.h, l: b.l, c: b.c,
          }));
          setCandles(tail);
          setSource("live");
        } else {
          setCandles(generateCandles(160, 11, 226, 0.18, 1.6));
          setSource("synthetic");
        }
      } catch {
        if (!cancelled) {
          setCandles(generateCandles(160, 11, 226, 0.18, 1.6));
          setSource("synthetic");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const def = useMemo(() => getBot("sma-cross")!, []);
  const [active, setActive] = useState<ActiveBot>(() => ({
    uid: "demo-sma",
    defId: "sma-cross",
    params: Object.fromEntries(def.params.map((p) => [p.key, p.default])),
  }));
  const [result, setResult] = useState<BotResult | null>(null);

  useEffect(() => {
    if (!candles) return;
    let cancelled = false;
    (async () => {
      try {
        const out = await Promise.resolve(def.run({ candles, symbol: SYMBOL }, active.params));
        if (!cancelled) setResult(out);
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [candles, active.params, def]);

  if (loading || !candles) {
    return (
      <div className="grid h-64 place-items-center border border-border bg-surface font-mono text-[11px] uppercase tracking-wider text-fg-faint">
        loading {SYMBOL} bars from Yahoo Finance…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
        <span className="border border-border bg-surface px-2 py-1 text-fg-dim">
          dataset · {SYMBOL}
        </span>
        <span
          className={`inline-flex items-center gap-1 border px-2 py-1 ${
            source === "live"
              ? "border-bull/50 bg-bull/10 text-bull"
              : "border-amber/50 bg-amber/10 text-amber"
          }`}
        >
          <span className={`size-1 rounded-full ${source === "live" ? "bg-bull pulse-dot" : "bg-amber"}`} />
          {source === "live" ? "LIVE Yahoo OHLCV" : "SYNTHETIC fallback"}
        </span>
        <span className="border border-border bg-surface px-2 py-1 text-fg-dim">
          bot · SMA Crossover
        </span>
      </div>
      <BotCell
        index={0}
        active={active}
        def={def}
        result={result}
        candles={candles}
        beginner={true}
        onUpdateParams={(params) => setActive((a) => ({ ...a, params }))}
        onRemove={() => {}}
        onToggleCollapse={() => {}}
        onRerun={() => {}}
      />
      <div className="border border-dashed border-border bg-bg p-3 font-mono text-[11px] tracking-wide text-fg-dim">
        <span className="text-fg-faint">try it →</span> open the cell's <span className="text-fg">PARAMS</span>{" "}
        panel and drag the fast / slow period sliders. Every change re-runs the
        backtest in your browser. The verdict pill, signals on the chart, and
        equity sparkline all update.
      </div>
    </div>
  );
}

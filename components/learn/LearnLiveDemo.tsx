"use client";

import { useEffect, useMemo, useState } from "react";
import { generateCandles, type Candle } from "@/lib/candles";
import { getBot } from "@/lib/quant/bots";
import { BotCell } from "@/components/quant/BotCell";
import { Chip } from "@/components/calm/kit";
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
      <div className="grid h-64 place-items-center rounded-xl bg-fg/[0.05] t-label text-fg-faint">
        Loading {SYMBOL} bars from Yahoo Finance…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip>Dataset · {SYMBOL}</Chip>
        {/* What the bars are. A real status, so a live feed still pulses;
            synthetic data is the warning colour. */}
        <Chip tone={source === "live" ? "brand" : "warn"}>
          <span aria-hidden className={`size-1.5 shrink-0 rounded-full bg-current ${source === "live" ? "pulse-dot" : ""}`} />
          {source === "live" ? "Live Yahoo OHLCV" : "Synthetic fallback"}
        </Chip>
        <Chip>Bot · SMA Crossover</Chip>
      </div>
      <BotCell
        index={0}
        active={active}
        def={def}
        result={result}
        candles={candles}
        symbol={SYMBOL}
        beginner={true}
        onUpdateParams={(params) => setActive((a) => ({ ...a, params }))}
        onRemove={() => {}}
        onToggleCollapse={() => {}}
        onRerun={() => {}}
      />
      <div className="text-[0.8125rem] leading-relaxed text-fg-dim">
        <span className="text-fg-faint">Try it →</span> open the cell’s <span className="text-fg">Params</span>{" "}
        panel and drag the fast / slow period sliders. Every change re-runs the
        backtest in your browser. The verdict pill, signals on the chart, and
        equity sparkline all update.
      </div>
    </div>
  );
}

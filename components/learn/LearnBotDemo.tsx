"use client";

import { useEffect, useMemo, useState } from "react";
import { generateCandles, type Candle } from "@/lib/candles";
import { getBot } from "@/lib/quant/bots";
import { BotCell } from "@/components/quant/BotCell";
import type { ActiveBot, BotResult } from "@/lib/quant/types";

const SYMBOLS = ["AMZN", "AAPL", "NVDA", "TSLA", "SPY"];

export function LearnBotDemo({ botId }: { botId: string }) {
  const def = useMemo(() => getBot(botId), [botId]);
  const [symbol, setSymbol] = useState("AMZN");
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"live" | "synthetic">("synthetic");

  useEffect(() => {
    if (!def) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${symbol}&tf=D`);
        const j = await r.json();
        if (cancelled) return;
        if (j?.ok && Array.isArray(j.bars) && j.bars.length > 30) {
          const tail = j.bars.slice(-180).map((b: { o: number; h: number; l: number; c: number }) => ({
            o: b.o, h: b.h, l: b.l, c: b.c,
          }));
          setCandles(tail);
          setSource("live");
        } else {
          setCandles(generateCandles(180, 11 + symbol.charCodeAt(0), 226, 0.18, 1.6));
          setSource("synthetic");
        }
      } catch {
        if (!cancelled) {
          setCandles(generateCandles(180, 11 + symbol.charCodeAt(0), 226, 0.18, 1.6));
          setSource("synthetic");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [symbol, def]);

  const [active, setActive] = useState<ActiveBot | null>(null);
  useEffect(() => {
    if (!def) return;
    setActive({
      uid: `demo-${def.id}`,
      defId: def.id,
      params: Object.fromEntries(def.params.map((p) => [p.key, p.default])),
    });
  }, [def]);

  const [result, setResult] = useState<BotResult | null>(null);
  useEffect(() => {
    if (!def || !candles || !active) return;
    let cancelled = false;
    (async () => {
      try {
        const out = await Promise.resolve(def.run({ candles, symbol }, active.params));
        if (!cancelled) setResult(out);
      } catch (err) {
        if (!cancelled) console.error("demo bot crashed", err);
      }
    })();
    return () => { cancelled = true; };
  }, [def, candles, active, symbol]);

  if (!def) {
    return (
      <div className="grid h-32 place-items-center border border-border bg-surface font-mono text-[11px] uppercase tracking-wider text-fg-faint">
        bot not found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
        <span className="border border-border bg-surface px-2 py-1 text-fg-faint">symbol</span>
        {SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={`border px-2 py-1 transition-colors ${
              s === symbol
                ? "border-bull bg-bull/10 text-bull"
                : "border-border bg-bg text-fg-dim hover:border-fg-dim hover:text-fg"
            }`}
          >
            {s}
          </button>
        ))}
        <span
          className={`ml-2 inline-flex items-center gap-1 border px-2 py-1 ${
            loading
              ? "border-border bg-bg text-fg-faint"
              : source === "live"
              ? "border-bull/50 bg-bull/10 text-bull"
              : "border-amber/50 bg-amber/10 text-amber"
          }`}
        >
          <span
            className={`size-1 rounded-full ${
              loading ? "bg-fg-faint" : source === "live" ? "bg-bull pulse-dot" : "bg-amber"
            }`}
          />
          {loading ? "loading…" : source === "live" ? "LIVE" : "SYNTHETIC"}
        </span>
      </div>

      {loading || !candles || !active ? (
        <div className="grid h-64 place-items-center border border-border bg-surface font-mono text-[11px] uppercase tracking-wider text-fg-faint">
          loading {symbol} bars…
        </div>
      ) : (
        <BotCell
          index={0}
          active={active}
          def={def}
          result={result}
          candles={candles}
          symbol={symbol}
          beginner={true}
          onUpdateParams={(params) => setActive((a) => (a ? { ...a, params } : a))}
          onRemove={() => {}}
          onToggleCollapse={() => {}}
          onRerun={() => {}}
        />
      )}
    </div>
  );
}

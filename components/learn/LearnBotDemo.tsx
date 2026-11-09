"use client";

import { useEffect, useMemo, useState } from "react";
import { generateCandles, type Candle } from "@/lib/candles";
import { getBot } from "@/lib/quant/bots";
import { BotCell } from "@/components/quant/BotCell";
import { Chip, TogglePill } from "@/components/calm/kit";
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
      <div className="grid h-32 place-items-center rounded-xl bg-fg/[0.05] t-label text-fg-faint">
        Bot not found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-label text-fg-faint">Symbol</span>
        {SYMBOLS.map((s) => (
          <TogglePill key={s} on={s === symbol} onClick={() => setSymbol(s)}>
            {s}
          </TogglePill>
        ))}
        {/* What the bars are. A real status, so a live feed still pulses;
            synthetic data is the warning colour. */}
        <Chip tone={loading ? "neutral" : source === "live" ? "brand" : "warn"} className="ml-2">
          <span
            aria-hidden
            className={`size-1.5 shrink-0 rounded-full bg-current ${!loading && source === "live" ? "pulse-dot" : ""}`}
          />
          {loading ? "Loading…" : source === "live" ? "Live" : "Synthetic"}
        </Chip>
      </div>

      {loading || !candles || !active ? (
        <div className="grid h-64 place-items-center rounded-xl bg-fg/[0.05] t-label text-fg-faint">
          Loading {symbol} bars…
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

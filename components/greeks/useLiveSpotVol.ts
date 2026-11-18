"use client";

// The Greeks lab's market data, shared by /greeks and the /learn primer: the
// symbol's live spot and 60-day realised volatility through the quote proxy,
// re-polled every 30 s while the tab is visible, and the one synthetic tape
// (lib/viz/tape.ts) when the feed has nothing for it.

import { useEffect, useState } from "react";
import { tapeIv, tapeSpot } from "@/lib/viz/tape";

// Annualised realised volatility from daily closes: 60 log returns, stdev x sqrt(252).
export function realizedVol(closes: number[]): number | null {
  const tail = closes.filter((c) => typeof c === "number" && Number.isFinite(c) && c > 0).slice(-61);
  if (tail.length < 21) return null;
  const rets: number[] = [];
  for (let i = 1; i < tail.length; i++) rets.push(Math.log(tail[i] / tail[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (rets.length - 1);
  return Math.min(1.2, Math.max(0.1, Math.sqrt(variance) * Math.sqrt(252)));
}

export type LiveSpotVol = {
  spot: number;
  vol: number;
  source: "loading" | "live" | "synthetic";
  /** true when vol is the realised 60-day figure, not the tape's stand-in */
  realized: boolean;
};

export function useLiveSpotVol(symbol: string): LiveSpotVol {
  const [state, setState] = useState<LiveSpotVol>(() => ({ spot: tapeSpot(symbol), vol: tapeIv(symbol), source: "loading", realized: false }));

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, source: "loading" }));
    const fallback = () => setState({ spot: tapeSpot(symbol), vol: tapeIv(symbol), source: "synthetic", realized: false });
    const load = async () => {
      try {
        const r = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}&tf=D`);
        const j = await r.json();
        if (cancelled) return;
        const bars: { c: number }[] = Array.isArray(j?.bars) ? j.bars : [];
        const px: unknown = j?.ok ? (j?.meta?.regularMarketPrice ?? bars[bars.length - 1]?.c) : null;
        if (typeof px !== "number" || !Number.isFinite(px) || px <= 0) return fallback();
        const rv = realizedVol(bars.map((b) => b.c));
        setState({ spot: px, vol: rv ?? tapeIv(symbol), source: "live", realized: rv !== null });
      } catch {
        if (!cancelled) fallback();
      }
    };
    load();
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  return state;
}

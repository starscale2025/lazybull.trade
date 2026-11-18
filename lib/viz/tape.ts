// ONE TAPE (plan A5, Stage 3). The single synthetic market every page falls
// back to when it is not on live data, so a symbol has one price everywhere.
// Before it, AMZN was $226.45 in the builder and the chain, $100 on /greeks
// and drifted to about $277 in the bot demos.
//
// Each symbol's bars are a seeded walk at its own volatility that ENDS on
// its spot, so the last close always agrees with the price quoted beside it.
// Undated on purpose: a synthetic walk describes no real day.

import type { Candle } from "@/lib/candles";

export type TapeSymbol = { sym: string; name: string; spot: number; iv: number };

export const TAPE: readonly TapeSymbol[] = [
  { sym: "AMZN", name: "Amazon", spot: 226.45, iv: 0.32 },
  { sym: "NVDA", name: "Nvidia", spot: 138.9, iv: 0.46 },
  { sym: "TSLA", name: "Tesla", spot: 287.15, iv: 0.55 },
  { sym: "AAPL", name: "Apple", spot: 229.83, iv: 0.28 },
  { sym: "SPY", name: "S&P 500", spot: 612.4, iv: 0.16 },
  { sym: "MSFT", name: "Microsoft", spot: 425.6, iv: 0.27 },
];

const FALLBACK: TapeSymbol = { sym: "SIM", name: "Synthetic", spot: 100, iv: 0.3 };

export function tapeSymbol(sym: string): TapeSymbol {
  return TAPE.find((s) => s.sym === sym.toUpperCase()) ?? FALLBACK;
}
export const tapeSpot = (sym: string) => tapeSymbol(sym).spot;
export const tapeIv = (sym: string) => tapeSymbol(sym).iv;

function seeded(sym: string) {
  let h = 2166136261;
  for (const ch of sym) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` daily bars for a symbol, the last close on its spot. The same every call. */
export function tapeBars(sym: string, n = 180): Candle[] {
  const { spot, iv } = tapeSymbol(sym);
  const rnd = seeded(sym);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, rnd()))) * Math.cos(2 * Math.PI * rnd());
  const daily = iv / Math.sqrt(252);
  const raw: Candle[] = [];
  let c = 1;
  for (let i = 0; i < n; i++) {
    const o = c;
    c = o * Math.exp(daily * gauss() - 0.5 * daily * daily);
    const wick = daily * 0.6;
    raw.push({ o, c, h: Math.max(o, c) * (1 + Math.abs(gauss()) * wick), l: Math.min(o, c) * (1 - Math.abs(gauss()) * wick) });
  }
  const k = spot / raw[raw.length - 1].c;
  return raw.map((b) => ({ o: b.o * k, h: b.h * k, l: b.l * k, c: b.c * k }));
}

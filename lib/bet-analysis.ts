// The two-sided read shown in the QuickBet slip: what the QUANT bots say and
// what the pricing MODELS say, computed from the same daily bars.
//
// Pure functions over candles — no fetching, no store access — so the numbers
// are unit-testable and identical wherever the slip mounts (/quant, /trade/chain).

import { getBot } from "./quant/bots";
import { hurst } from "./quant/series";
import { probBS } from "./models";
import type { Candle } from "./candles";
import type { BotResult } from "./quant/types";

/** The fixed jury: fast, synchronous TS bots with a real directional verdict. */
const JURY = ["sma-cross", "rsi-rev", "macd", "boll", "zscore", "donchian"] as const;

export type QuantRead = {
  up: number;
  down: number;
  hold: number;
  jurySize: number;
  lean: "UP" | "DOWN" | "NEUTRAL";
  /** Mean confidence of the verdicts agreeing with the lean (0-1). */
  confidence: number;
  regime: "TREND" | "REVERT" | "RANDOM";
  h: number;
};

export type ModelRead = {
  /** Risk-neutral P(price finishes ABOVE spot) at the horizon. */
  pUp: number;
  /** Annualized realized vol driving the estimate. */
  vol: number;
  days: number;
  /** ±1σ price range at the horizon. */
  lo: number;
  hi: number;
};

/** Annualized realized vol from daily closes (same recipe as the greeks lab). */
export function realizedVolFromCloses(closes: number[]): number {
  const tail = closes.filter((c) => Number.isFinite(c) && c > 0).slice(-61);
  if (tail.length < 21) return 0.32; // house fallback when history is thin
  const rets: number[] = [];
  for (let i = 1; i < tail.length; i++) rets.push(Math.log(tail[i] / tail[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const v = Math.sqrt(variance) * Math.sqrt(252);
  return Math.min(1.2, Math.max(0.1, Number.isFinite(v) ? v : 0.32));
}

export function quantRead(candles: Candle[], symbol: string): QuantRead {
  let up = 0;
  let down = 0;
  let hold = 0;
  const agreeing: { side: "buy" | "sell"; conf: number }[] = [];

  for (const id of JURY) {
    const def = getBot(id);
    if (!def) continue;
    let res: BotResult;
    try {
      const params = Object.fromEntries(def.params.map((p) => [p.key, p.default]));
      const out = def.run({ candles, symbol }, params);
      // The jury is all-sync by construction; a Promise here means a wrong bot
      // id landed in JURY — count it as a hold rather than block the slip.
      if (out instanceof Promise) {
        hold++;
        continue;
      }
      res = out;
    } catch {
      hold++;
      continue;
    }
    const side = res.verdict?.side;
    if (side === "buy") {
      up++;
      agreeing.push({ side, conf: clamp01(res.verdict.confidence ?? 0.5) });
    } else if (side === "sell") {
      down++;
      agreeing.push({ side, conf: clamp01(res.verdict.confidence ?? 0.5) });
    } else {
      hold++;
    }
  }

  const lean: QuantRead["lean"] = up > down ? "UP" : down > up ? "DOWN" : "NEUTRAL";
  const winners = agreeing.filter((a) => (lean === "UP" ? a.side === "buy" : a.side === "sell"));
  const confidence =
    lean === "NEUTRAL" || winners.length === 0
      ? 0
      : winners.reduce((a, b) => a + b.conf, 0) / winners.length;

  const closes = candles.map((c) => c.c);
  const h = hurst(closes);
  const regime: QuantRead["regime"] = h > 0.55 ? "TREND" : h < 0.45 ? "REVERT" : "RANDOM";

  return { up, down, hold, jurySize: JURY.length, lean, confidence, regime, h };
}

export function modelRead(candles: Candle[], spot: number, days = 30): ModelRead {
  const closes = candles.map((c) => c.c);
  const vol = realizedVolFromCloses(closes);
  const safeSpot = Number.isFinite(spot) && spot > 0 ? spot : closes[closes.length - 1] || 100;

  // P(finish above spot): the band [spot, +∞) under the same Black-Scholes
  // measure the /trade cone uses. 1e9 stands in for +∞ — at these vols the
  // mass above 1e9 is zero to double precision.
  const pUp = probBS({ spot: safeSpot, low: safeSpot, high: 1e9, daysToExpiry: days, iv: vol });

  const sigT = vol * Math.sqrt(days / 365);
  return {
    pUp: clamp01(pUp),
    vol,
    days,
    lo: safeSpot * Math.exp(-sigT),
    hi: safeSpot * Math.exp(sigT),
  };
}

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

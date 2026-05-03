// Multi-leg strategy detector. Takes a list of selected legs and returns the
// canonical name + a friendly "this is what it means" sentence + risk profile.

import type { Leg } from "./pricing";

export type StrategyKind =
  | "Long Call"
  | "Long Put"
  | "Short Call"
  | "Short Put"
  | "Covered Call"
  | "Bull Call Spread"
  | "Bear Call Spread"
  | "Bull Put Spread"
  | "Bear Put Spread"
  | "Long Straddle"
  | "Short Straddle"
  | "Long Strangle"
  | "Short Strangle"
  | "Iron Condor"
  | "Iron Butterfly"
  | "Call Calendar"
  | "Put Calendar"
  | "Call Ratio"
  | "Custom";

export type Detection = {
  kind: StrategyKind;
  bias: "bullish" | "bearish" | "neutral" | "volatile";
  defined: boolean; // defined risk (true) vs unbounded (false)
  net: "debit" | "credit";
  blurb: string; // short, plain-English description
};

const sortByStrike = (legs: Leg[]) => legs.slice().sort((a, b) => a.strike - b.strike);

export function detect(legsRaw: Leg[]): Detection {
  const legs = sortByStrike(legsRaw);
  const calls = legs.filter((l) => l.type === "C");
  const puts = legs.filter((l) => l.type === "P");
  const longs = legs.filter((l) => l.side === "long");
  const shorts = legs.filter((l) => l.side === "short");
  const net =
    longs.reduce((s, l) => s + l.premium * l.qty, 0) -
    shorts.reduce((s, l) => s + l.premium * l.qty, 0);

  const same = (xs: Leg[]) => xs.every((x) => x.strike === xs[0].strike);

  // 1-leg
  if (legs.length === 1) {
    const l = legs[0];
    if (l.type === "C" && l.side === "long")
      return {
        kind: "Long Call",
        bias: "bullish",
        defined: true,
        net: "debit",
        blurb: "You pay a premium for the right to buy. Win if the stock goes up enough.",
      };
    if (l.type === "C" && l.side === "short")
      return {
        kind: "Short Call",
        bias: "bearish",
        defined: false,
        net: "credit",
        blurb: "You collect premium today, but lose unlimited money if the stock rips up.",
      };
    if (l.type === "P" && l.side === "long")
      return {
        kind: "Long Put",
        bias: "bearish",
        defined: true,
        net: "debit",
        blurb: "You pay a premium for the right to sell. Win if the stock falls.",
      };
    return {
      kind: "Short Put",
      bias: "bullish",
      defined: false,
      net: "credit",
      blurb: "You collect premium and agree to buy the stock at the strike if assigned.",
    };
  }

  // 2-leg same expiry, both calls
  if (legs.length === 2 && calls.length === 2) {
    if (same(calls)) {
      return {
        kind: "Custom",
        bias: "neutral",
        defined: true,
        net: net > 0 ? "debit" : "credit",
        blurb: "Two calls at the same strike — usually not a real strategy.",
      };
    }
    const [low, high] = calls;
    if (low.side === "long" && high.side === "short") {
      return {
        kind: "Bull Call Spread",
        bias: "bullish",
        defined: true,
        net: "debit",
        blurb: "You bet the stock goes up to the higher strike. Risk and reward both capped.",
      };
    }
    if (low.side === "short" && high.side === "long") {
      return {
        kind: "Bear Call Spread",
        bias: "bearish",
        defined: true,
        net: "credit",
        blurb: "You collect premium betting the stock stays below the lower strike. Risk capped.",
      };
    }
  }

  // 2-leg both puts
  if (legs.length === 2 && puts.length === 2) {
    const [low, high] = puts;
    // Bull Put Spread: sell the higher-strike put, buy the lower-strike put → credit, bullish
    if (low.side === "long" && high.side === "short") {
      return {
        kind: "Bull Put Spread",
        bias: "bullish",
        defined: true,
        net: "credit",
        blurb: "You sell a higher put and buy a lower one. Win if the stock stays above the higher strike.",
      };
    }
    // Bear Put Spread: buy the higher-strike put, sell the lower-strike put → debit, bearish
    if (low.side === "short" && high.side === "long") {
      return {
        kind: "Bear Put Spread",
        bias: "bearish",
        defined: true,
        net: "debit",
        blurb: "You bet the stock falls to the lower strike. Cheaper than a long put alone.",
      };
    }
  }

  // 2-leg straddle / strangle
  if (legs.length === 2 && calls.length === 1 && puts.length === 1) {
    const c = calls[0];
    const p = puts[0];
    const allLong = c.side === "long" && p.side === "long";
    const allShort = c.side === "short" && p.side === "short";
    if (c.strike === p.strike) {
      if (allLong)
        return { kind: "Long Straddle", bias: "volatile", defined: true, net: "debit", blurb: "You profit on a big move in either direction. Volatility is your friend." };
      if (allShort)
        return { kind: "Short Straddle", bias: "neutral", defined: false, net: "credit", blurb: "You collect double premium. Big losses if the stock moves a lot." };
    } else {
      if (allLong)
        return { kind: "Long Strangle", bias: "volatile", defined: true, net: "debit", blurb: "Cheaper than a straddle but needs a bigger move to pay off." };
      if (allShort)
        return { kind: "Short Strangle", bias: "neutral", defined: false, net: "credit", blurb: "You collect premium betting the stock stays inside a range." };
    }
  }

  // 4-leg condors / butterflies
  if (legs.length === 4 && calls.length === 2 && puts.length === 2) {
    const cs = sortByStrike(calls);
    const ps = sortByStrike(puts);
    const condorShape =
      ps[0].side === "long" &&
      ps[1].side === "short" &&
      cs[0].side === "short" &&
      cs[1].side === "long";
    if (condorShape) {
      const isButterfly = ps[1].strike === cs[0].strike;
      return isButterfly
        ? {
            kind: "Iron Butterfly",
            bias: "neutral",
            defined: true,
            net: "credit",
            blurb: "You bet the stock pins a single strike. Tight range, fat premium.",
          }
        : {
            kind: "Iron Condor",
            bias: "neutral",
            defined: true,
            net: "credit",
            blurb: "Four legs that pay you for the stock staying inside a range. Defined risk on both sides.",
          };
    }
  }

  // Calendar (same strike, different expiries) — not really detectable here since
  // we only model one expiry per drag, but include for completeness.
  if (legs.length === 2 && calls.length === 2 && same(calls)) {
    return {
      kind: "Call Calendar",
      bias: "neutral",
      defined: true,
      net: "debit",
      blurb: "You sell a near-term call and buy a longer-dated one at the same strike.",
    };
  }

  // 3-leg ratio
  if (legs.length === 3 && calls.length === 3) {
    return {
      kind: "Call Ratio",
      bias: "bullish",
      defined: false,
      net: net > 0 ? "debit" : "credit",
      blurb: "Asymmetric position — usually one long, two short. Powerful but careful.",
    };
  }

  return {
    kind: "Custom",
    bias: "neutral",
    defined: shorts.length === 0,
    net: net > 0 ? "debit" : "credit",
    blurb: "Custom multi-leg position. Read the P&L diagram carefully.",
  };
}

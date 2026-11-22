// The market map behind /start: about a hundred of the largest US stocks,
// grouped by sector, sized by an APPROXIMATE market cap (billions of dollars,
// set by hand in late 2026; the map says so) and coloured by today's move.
// Every ticker here is one the quote chain prices in production (Alpaca).

import { contrast, mixOklab } from "@/lib/viz/color";

export type MapStock = { sym: string; cap: number };
export type MapSector = { name: string; stocks: MapStock[] };

export const MAP_SECTORS: MapSector[] = [
  {
    name: "Technology",
    stocks: [
      { sym: "NVDA", cap: 4400 }, { sym: "MSFT", cap: 3700 }, { sym: "AAPL", cap: 3500 }, { sym: "AVGO", cap: 1500 },
      { sym: "ORCL", cap: 650 }, { sym: "PLTR", cap: 380 }, { sym: "AMD", cap: 330 }, { sym: "CSCO", cap: 260 },
      { sym: "IBM", cap: 260 }, { sym: "CRM", cap: 250 }, { sym: "NOW", cap: 190 }, { sym: "INTU", cap: 180 },
      { sym: "QCOM", cap: 180 }, { sym: "APP", cap: 180 }, { sym: "TXN", cap: 170 }, { sym: "ANET", cap: 160 },
      { sym: "AMAT", cap: 160 }, { sym: "MU", cap: 160 }, { sym: "ADBE", cap: 160 }, { sym: "INTC", cap: 150 },
      { sym: "LRCX", cap: 130 }, { sym: "PANW", cap: 130 }, { sym: "KLAC", cap: 110 }, { sym: "CRWD", cap: 110 },
      { sym: "DELL", cap: 90 }, { sym: "MRVL", cap: 70 },
    ],
  },
  {
    name: "Communication",
    stocks: [
      { sym: "META", cap: 1800 }, { sym: "GOOGL", cap: 1500 }, { sym: "GOOG", cap: 1400 }, { sym: "NFLX", cap: 480 },
      { sym: "TMUS", cap: 260 }, { sym: "DIS", cap: 200 }, { sym: "T", cap: 190 }, { sym: "VZ", cap: 175 },
      { sym: "CMCSA", cap: 130 },
    ],
  },
  {
    name: "Consumer Discretionary",
    stocks: [
      { sym: "AMZN", cap: 2400 }, { sym: "TSLA", cap: 1200 }, { sym: "HD", cap: 380 }, { sym: "MCD", cap: 220 },
      { sym: "BKNG", cap: 170 }, { sym: "LOW", cap: 140 }, { sym: "SBUX", cap: 100 }, { sym: "DASH", cap: 100 },
      { sym: "NKE", cap: 95 }, { sym: "ABNB", cap: 80 }, { sym: "GM", cap: 60 }, { sym: "F", cap: 45 }, { sym: "TGT", cap: 45 },
    ],
  },
  {
    name: "Consumer Staples",
    stocks: [
      { sym: "WMT", cap: 800 }, { sym: "COST", cap: 420 }, { sym: "PG", cap: 360 }, { sym: "KO", cap: 300 },
      { sym: "PM", cap: 260 }, { sym: "PEP", cap: 200 }, { sym: "MDLZ", cap: 80 },
    ],
  },
  {
    name: "Health Care",
    stocks: [
      { sym: "LLY", cap: 800 }, { sym: "JNJ", cap: 400 }, { sym: "ABBV", cap: 370 }, { sym: "UNH", cap: 300 },
      { sym: "MRK", cap: 240 }, { sym: "ABT", cap: 230 }, { sym: "TMO", cap: 190 }, { sym: "ISRG", cap: 190 },
      { sym: "AMGN", cap: 160 }, { sym: "DHR", cap: 150 }, { sym: "PFE", cap: 140 }, { sym: "GILD", cap: 140 },
      { sym: "VRTX", cap: 120 }, { sym: "REGN", cap: 70 },
    ],
  },
  {
    name: "Financials",
    stocks: [
      { sym: "JPM", cap: 750 }, { sym: "V", cap: 650 }, { sym: "MA", cap: 520 }, { sym: "BAC", cap: 340 },
      { sym: "WFC", cap: 260 }, { sym: "GS", cap: 230 }, { sym: "MS", cap: 220 }, { sym: "AXP", cap: 220 },
      { sym: "C", cap: 190 }, { sym: "SCHW", cap: 170 }, { sym: "BLK", cap: 160 }, { sym: "HOOD", cap: 90 },
      { sym: "COIN", cap: 80 },
    ],
  },
  {
    name: "Industrials",
    stocks: [
      { sym: "GE", cap: 300 }, { sym: "RTX", cap: 230 }, { sym: "CAT", cap: 220 }, { sym: "UBER", cap: 190 },
      { sym: "BA", cap: 160 }, { sym: "HON", cap: 140 }, { sym: "UNP", cap: 140 }, { sym: "DE", cap: 130 },
      { sym: "ADP", cap: 120 }, { sym: "LMT", cap: 110 }, { sym: "UPS", cap: 85 },
    ],
  },
  { name: "Energy", stocks: [{ sym: "XOM", cap: 480 }, { sym: "CVX", cap: 300 }, { sym: "COP", cap: 120 }, { sym: "OXY", cap: 45 }] },
  { name: "Materials", stocks: [{ sym: "LIN", cap: 220 }, { sym: "SHW", cap: 90 }, { sym: "APD", cap: 65 }] },
  { name: "Utilities", stocks: [{ sym: "NEE", cap: 170 }, { sym: "SO", cap: 100 }, { sym: "DUK", cap: 95 }] },
  { name: "Real Estate", stocks: [{ sym: "PLD", cap: 110 }, { sym: "AMT", cap: 90 }, { sym: "EQIX", cap: 80 }] },
];

export const MAP_SYMBOLS: string[] = MAP_SECTORS.flatMap((s) => s.stocks.map((x) => x.sym));

/** The colour of a day's move: a diverging scale, grey at zero, loss red
 *  below and the brand's green above, full at ±3%. Square-rooted so a 0.3%
 *  day already reads as a direction.
 *
 *  The two ends are deep and equal in weight (OKLCH L 0.40, C 0.095 each), so
 *  a red day and a green day are equally loud, and both stay well below the
 *  wordmark's darkest green (L 0.64): on /start the map is the ground the
 *  wordmark stands on, not a second headline. */
const FLAT = "#1d201e";
const UP = "#045631";
const DOWN = "#722f38";
export function moveColor(chgPct: number | null | undefined): string {
  if (chgPct == null || !Number.isFinite(chgPct)) return "#1c1e1d";
  const t = Math.min(1, Math.abs(chgPct) / 3);
  return mixOklab(FLAT, chgPct >= 0 ? UP : DOWN, Math.pow(t, 0.6));
}

/** White or near-black type, whichever reads better on a tile. */
export function inkOn(bg: string): string {
  return contrast("#f5f5f0", bg) >= contrast("#050505", bg) ? "#f5f5f0" : "#050505";
}

/** The day in a few numbers, for everything on /start that reads the map:
 *  the caption, the floating movers, the horizon's mood, the wordmark's type. */
export type Reading = {
  up: number;
  down: number;
  /** Top gainers and losers, biggest first, at most three each. */
  best: [string, number][];
  worst: [string, number][];
  /** -1 when every stock is down, +1 when every stock is up. */
  breadth: number;
  /** 0 on a still day, 1 when the average stock moves 2.5% or more. */
  heat: number;
};

export function reading(moves: Record<string, number>): Reading | null {
  const rows = Object.entries(moves).filter(([, p]) => Number.isFinite(p));
  if (!rows.length) return null;
  const up = rows.filter(([, p]) => p > 0).length;
  const down = rows.filter(([, p]) => p < 0).length;
  const sorted = [...rows].sort((a, b) => b[1] - a[1]);
  const mean = rows.reduce((a, [, p]) => a + Math.abs(p), 0) / rows.length;
  return {
    up,
    down,
    best: sorted.slice(0, 3).filter(([, p]) => p > 0),
    worst: sorted.slice(-3).reverse().filter(([, p]) => p < 0),
    breadth: up + down ? (up - down) / (up + down) : 0,
    heat: Math.min(1, Math.max(0, (mean - 0.4) / 2.1)),
  };
}

/** A labelled simulated day for when no feed answers (local runs, outages):
 *  deterministic per symbol and calendar day, one shared market drift. */
export function simulatedMoves(day: string): Record<string, number> {
  const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
  };
  const drift = (hash(`mkt${day}`) - 0.5) * 1.6;
  const out: Record<string, number> = {};
  for (const sym of MAP_SYMBOLS) {
    const u = hash(sym + day) + hash(day + sym) + hash(`${sym}:${day}:x`);
    out[sym] = Math.round((drift + (u - 1.5) * 2.2) * 100) / 100;
  }
  return out;
}

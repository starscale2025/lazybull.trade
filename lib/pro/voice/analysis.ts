// Turns raw OHLCV bars + Yahoo meta into a compact, spoken-ready market read.
// Pure — no React, no DOM. Reuses the same indicator math the chart draws with
// so the voice quotes the *same* numbers the user sees, never invented ones.

import type { Bar } from "@/components/pro/chartCore";
import { ema, rsi as rsiSeries, macd as macdSeries, atr as atrSeries } from "@/components/pro/indicators";

export type QuoteMeta = {
  currency?: string;
  exchangeName?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketState?: string;
} | null;

export type MarketAnalysis = {
  symbol: string;
  name: string;
  timeframe: string;
  price: number | null;
  changeAbs: number | null;
  changePct: number | null;
  // What changePct is measured against: a true prior daily close ("day"), or
  // just the previous bar on the current timeframe ("bar").
  changeBasis: "day" | "bar";
  trend: "up" | "down" | "sideways";
  trendStrength: "strong" | "moderate" | "weak";
  ema20: number | null;
  ema50: number | null;
  priceVsEma20: "above" | "below" | null;
  rsi: number | null;
  rsiLabel: "overbought" | "oversold" | "neutral" | null;
  macdHist: number | null;
  momentum: "rising" | "falling" | "flat";
  atrPct: number | null;
  volatility: "high" | "normal" | "low" | null;
  support: number | null;
  resistance: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  nearHigh: boolean;
  nearLow: boolean;
  volume: number | null;
  volumeVsAvg: "above" | "below" | "normal" | null;
  bars: number;
  marketState: string;
  headline: string;
  brief: string;
};

// Read the FINAL value of an indicator series — but only if it's a real
// computed value at the last index. Some series (e.g. EMA/ATR) seed index 0 with
// the first close, so scanning backward for the last non-null would surface that
// seed as a fabricated reading when there aren't enough bars. Reading the tail
// directly returns null until the indicator actually has enough history.
function tail(arr: (number | null)[]): number | null {
  const v = arr[arr.length - 1];
  return v == null ? null : v;
}

export function computeAnalysis(
  bars: Bar[],
  meta: QuoteMeta,
  symbol: string,
  name: string,
  timeframe: string,
): MarketAnalysis {
  const base: MarketAnalysis = {
    symbol, name, timeframe,
    price: meta?.regularMarketPrice ?? null,
    changeAbs: null, changePct: null, changeBasis: "bar",
    trend: "sideways", trendStrength: "weak",
    ema20: null, ema50: null, priceVsEma20: null,
    rsi: null, rsiLabel: null,
    macdHist: null, momentum: "flat",
    atrPct: null, volatility: null,
    support: null, resistance: null,
    fiftyTwoWeekHigh: meta?.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: meta?.fiftyTwoWeekLow ?? null,
    nearHigh: false, nearLow: false,
    volume: null, volumeVsAvg: null,
    bars: bars.length,
    marketState: meta?.marketState || "UNKNOWN",
    headline: "", brief: "",
  };

  if (bars.length < 3) {
    base.headline = `${symbol}: not enough data loaded yet.`;
    base.brief = `I don't have enough bars for ${symbol} to read the trend yet — give the chart a second to load.`;
    return base;
  }

  const closes = bars.map((b) => b.c);
  const price = bars[bars.length - 1].c;
  base.price = price;

  // Change baseline. NOTE: never use meta.chartPreviousClose — it's the close
  // BEFORE the chart's whole range (e.g. 5 years ago on a 5y daily chart), which
  // produces absurd "+128% today" readings. Use the true prior daily close when
  // Yahoo gives one, else the previous bar on this timeframe.
  let prevClose: number;
  if (typeof meta?.previousClose === "number" && meta.previousClose > 0) {
    prevClose = meta.previousClose;
    base.changeBasis = "day";
  } else {
    prevClose = bars[bars.length - 2].c;
    base.changeBasis = "bar";
  }
  base.changeAbs = price - prevClose;
  base.changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : null;
  // Sanity guard: a single-period move that large means a bad baseline — don't
  // let the voice quote a nonsense number.
  if (base.changePct != null && Math.abs(base.changePct) > 60) {
    base.changePct = null;
    base.changeAbs = null;
  }

  // moving averages (null until there are >= period bars — never a seed value)
  const e20 = tail(ema(closes, 20));
  const e50 = tail(ema(closes, 50));
  base.ema20 = e20;
  base.ema50 = e50;
  if (e20 != null) base.priceVsEma20 = price >= e20 ? "above" : "below";

  // ema20 slope over the last ~5 bars → trend direction/strength
  const e20Series = ema(closes, 20);
  const e20Now = e20Series[e20Series.length - 1];
  const e20Then = e20Series[Math.max(0, e20Series.length - 6)];
  let slopePct = 0;
  if (e20Now != null && e20Then != null && e20Then !== 0) {
    slopePct = ((e20Now - e20Then) / e20Then) * 100;
  }
  const stacked = e20 != null && e50 != null ? e20 - e50 : 0;
  if (slopePct > 0.15 && stacked >= 0) base.trend = "up";
  else if (slopePct < -0.15 && stacked <= 0) base.trend = "down";
  else base.trend = "sideways";
  const mag = Math.abs(slopePct);
  base.trendStrength = mag > 0.9 ? "strong" : mag > 0.3 ? "moderate" : "weak";

  // RSI
  const r = tail(rsiSeries(closes, 14));
  if (r != null) {
    base.rsi = Math.round(r * 10) / 10;
    base.rsiLabel = r >= 70 ? "overbought" : r <= 30 ? "oversold" : "neutral";
  }

  // MACD histogram → momentum
  const { hist } = macdSeries(closes);
  const hNow = tail(hist);
  if (hNow != null) {
    base.macdHist = Math.round(hNow * 1000) / 1000;
    // compare last two defined hist values
    let prevH: number | null = null;
    for (let i = hist.length - 2; i >= 0; i--) { if (hist[i] != null) { prevH = hist[i] as number; break; } }
    if (prevH != null) base.momentum = hNow > prevH + 1e-9 ? "rising" : hNow < prevH - 1e-9 ? "falling" : "flat";
    else base.momentum = hNow > 0 ? "rising" : "falling";
  }

  // volatility via ATR as % of price (null until >= 14 bars)
  const a = tail(atrSeries(bars, 14));
  if (a != null && price) {
    base.atrPct = Math.round((a / price) * 1000) / 10;
    base.volatility = base.atrPct > 4 ? "high" : base.atrPct < 1.2 ? "low" : "normal";
  }

  // recent support / resistance over the last ~30 bars
  const lookback = bars.slice(-30);
  base.resistance = Math.max(...lookback.map((b) => b.h));
  base.support = Math.min(...lookback.map((b) => b.l));

  // 52-week proximity
  if (base.fiftyTwoWeekHigh) base.nearHigh = price >= base.fiftyTwoWeekHigh * 0.97;
  if (base.fiftyTwoWeekLow) base.nearLow = price <= base.fiftyTwoWeekLow * 1.03;

  // volume vs 20-bar average
  const vol = bars[bars.length - 1].v;
  base.volume = vol;
  const volWindow = bars.slice(-21, -1).map((b) => b.v);
  const avgVol = volWindow.length ? volWindow.reduce((s, x) => s + x, 0) / volWindow.length : 0;
  if (avgVol > 0) base.volumeVsAvg = vol > avgVol * 1.3 ? "above" : vol < avgVol * 0.7 ? "below" : "normal";

  base.headline = headlineFor(base);
  base.brief = briefFor(base);
  return base;
}

const money = (n: number | null) => (n == null ? "n/a" : `$${n.toFixed(2)}`);
const pct = (n: number | null) => (n == null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);

function headlineFor(a: MarketAnalysis): string {
  const dir = a.changePct == null ? "flat" : a.changePct >= 0 ? "up" : "down";
  return `${a.symbol} ${money(a.price)}, ${dir} ${pct(a.changePct)} · trend ${a.trend} (${a.trendStrength}) · RSI ${a.rsi ?? "n/a"}`;
}

// A tight, natural-language brief the voice can read verbatim or riff on.
function briefFor(a: MarketAnalysis): string {
  const parts: string[] = [];
  // Only state a change when we actually have a trustworthy baseline, and label
  // it by what it's measured against (prior daily close vs previous bar).
  if (a.changePct != null) {
    const when = a.changeBasis === "day" ? "on the day" : `on the last ${a.timeframe} bar`;
    parts.push(`${a.name || a.symbol} is at ${money(a.price)}, ${a.changePct >= 0 ? "up" : "down"} ${pct(a.changePct)} ${when}.`);
  } else {
    parts.push(`${a.name || a.symbol} is at ${money(a.price)}.`);
  }
  const trendLine =
    a.trend === "up"
      ? `Trend is up and ${a.trendStrength}; price is ${a.priceVsEma20 ?? "near"} the 20 EMA.`
      : a.trend === "down"
      ? `Trend is down and ${a.trendStrength}; price is ${a.priceVsEma20 ?? "near"} the 20 EMA.`
      : `It's chopping sideways — no clean trend right now.`;
  parts.push(trendLine);
  if (a.rsi != null) {
    parts.push(
      a.rsiLabel === "overbought"
        ? `RSI is ${a.rsi} — overbought, stretched to the upside.`
        : a.rsiLabel === "oversold"
        ? `RSI is ${a.rsi} — oversold, stretched to the downside.`
        : `RSI is ${a.rsi} — neutral, room either way.`,
    );
  }
  if (a.momentum !== "flat") parts.push(`MACD momentum is ${a.momentum}.`);
  if (a.support != null && a.resistance != null) {
    parts.push(`Watch ${money(a.support)} as support and ${money(a.resistance)} as resistance.`);
  }
  if (a.nearHigh) parts.push(`Heads up — it's within 3% of its 52-week high.`);
  if (a.nearLow) parts.push(`Heads up — it's within 3% of its 52-week low.`);
  if (a.volatility === "high") parts.push(`Volatility is high (ATR ${a.atrPct}% of price), so size accordingly.`);
  return parts.join(" ");
}

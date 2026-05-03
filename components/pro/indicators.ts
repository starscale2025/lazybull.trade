import type { Bar } from "./chartCore";

export type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (!values.length) return out;
  const k = 2 / (period + 1);
  let prev = values[0];
  out[0] = prev;
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = i >= period - 1 ? prev : null;
  }
  return out;
}

export function rsi(closes: number[], period = 14): Series {
  const out: Series = new Array(closes.length).fill(null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period && i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (ch >= 0) gain += ch;
    else loss -= ch;
  }
  let avgG = gain / period;
  let avgL = loss / period;
  if (closes.length > period) {
    const rs0 = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
    out[period] = rs0;
    for (let i = period + 1; i < closes.length; i++) {
      const ch = closes[i] - closes[i - 1];
      const g = Math.max(ch, 0);
      const l = Math.max(-ch, 0);
      avgG = (avgG * (period - 1) + g) / period;
      avgL = (avgL * (period - 1) + l) / period;
      out[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
    }
  }
  return out;
}

export function macd(closes: number[], fast = 12, slow = 26, signal = 9) {
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line: Series = closes.map((_, i) => (f[i] != null && s[i] != null ? (f[i] as number) - (s[i] as number) : null));
  // signal: ema of MACD line where defined
  const lineFiltered = line.map((v) => (v == null ? 0 : v));
  const sig = ema(lineFiltered, signal);
  // mask leading NaN region to null
  for (let i = 0; i < sig.length; i++) if (line[i] == null) sig[i] = null;
  const hist: Series = line.map((v, i) => (v != null && sig[i] != null ? (v as number) - (sig[i] as number) : null));
  return { line, signal: sig, hist };
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper: Series = new Array(closes.length).fill(null);
  const lower: Series = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const m = mid[i] as number;
    const variance = slice.reduce((a, x) => a + (x - m) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { mid, upper, lower };
}

export function vwap(bars: Bar[]): Series {
  const out: Series = new Array(bars.length).fill(null);
  let cumPv = 0;
  let cumV = 0;
  let lastDay = -1;
  for (let i = 0; i < bars.length; i++) {
    const day = new Date(bars[i].t).toDateString().length; // simple, recomputed below
    const dayKey = new Date(bars[i].t).toDateString();
    // reset on session change (UTC day) — close-enough for demo
    if (dayKey !== `${lastDay}`) {
      cumPv = 0;
      cumV = 0;
      lastDay = day;
    }
    const tp = (bars[i].h + bars[i].l + bars[i].c) / 3;
    cumPv += tp * bars[i].v;
    cumV += bars[i].v;
    out[i] = cumV ? cumPv / cumV : null;
  }
  return out;
}

export function atr(bars: Bar[], period = 14): Series {
  const trs: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      trs.push(bars[i].h - bars[i].l);
    } else {
      const tr = Math.max(
        bars[i].h - bars[i].l,
        Math.abs(bars[i].h - bars[i - 1].c),
        Math.abs(bars[i].l - bars[i - 1].c)
      );
      trs.push(tr);
    }
  }
  return ema(trs, period);
}

export function ichimoku(bars: Bar[]) {
  const conv: Series = new Array(bars.length).fill(null); // 9
  const base: Series = new Array(bars.length).fill(null); // 26
  const spanA: Series = new Array(bars.length).fill(null);
  const spanB: Series = new Array(bars.length).fill(null); // 52
  const lookback = (start: number, end: number) => {
    let hi = -Infinity;
    let lo = Infinity;
    for (let i = start; i <= end; i++) {
      if (bars[i].h > hi) hi = bars[i].h;
      if (bars[i].l < lo) lo = bars[i].l;
    }
    return (hi + lo) / 2;
  };
  for (let i = 0; i < bars.length; i++) {
    if (i >= 8) conv[i] = lookback(i - 8, i);
    if (i >= 25) base[i] = lookback(i - 25, i);
    if (i >= 25 && conv[i] != null && base[i] != null) spanA[i] = ((conv[i] as number) + (base[i] as number)) / 2;
    if (i >= 51) spanB[i] = lookback(i - 51, i);
  }
  return { conv, base, spanA, spanB };
}

export function supertrend(bars: Bar[], period = 10, mult = 3) {
  const a = atr(bars, period);
  const upper: Series = new Array(bars.length).fill(null);
  const lower: Series = new Array(bars.length).fill(null);
  const trend: Series = new Array(bars.length).fill(null);
  let dir = 1; // 1 up, -1 down
  for (let i = 0; i < bars.length; i++) {
    if (a[i] == null) continue;
    const hl2 = (bars[i].h + bars[i].l) / 2;
    const u = hl2 + mult * (a[i] as number);
    const l = hl2 - mult * (a[i] as number);
    upper[i] = u;
    lower[i] = l;
    if (i > 0) {
      const prevTrend = trend[i - 1] as number | null;
      if (prevTrend != null) {
        if (bars[i].c > (prevTrend as number)) dir = 1;
        else if (bars[i].c < (prevTrend as number)) dir = -1;
      }
    }
    trend[i] = dir === 1 ? l : u;
  }
  return { trend };
}

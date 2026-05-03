// Time-series helpers used across quant bots. All functions are pure and
// preserve length by padding the warmup region with `null` (so chart x-axes
// align with the candle index without surprises).

export function closes(candles: { c: number }[]): number[] {
  return candles.map((c) => c.c);
}

export function returns(values: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < values.length; i++) {
    r.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  return r;
}

export function logReturns(values: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < values.length; i++) {
    r.push(Math.log(values[i] / values[i - 1]));
  }
  return r;
}

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev == null) {
      let s = 0;
      for (let j = i - period + 1; j <= i; j++) s += values[j];
      prev = s / period;
    } else {
      prev = values[i] * k + prev * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

export function std(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(v);
}

export function rollingStd(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    out.push(std(values.slice(i - period + 1, i + 1)));
  }
  return out;
}

export function zscore(values: number[], period: number): (number | null)[] {
  const m = sma(values, period);
  const s = rollingStd(values, period);
  return values.map((v, i) => {
    const mu = m[i];
    const sd = s[i];
    if (mu == null || sd == null || sd === 0) return null;
    return (v - mu) / sd;
  });
}

export function rsi(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      out.push(null);
      continue;
    }
    const change = values[i] - values[i - 1];
    gains.push(Math.max(0, change));
    losses.push(Math.max(0, -change));
    if (i < period) {
      out.push(null);
      continue;
    }
    const avgG = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgL = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    if (avgL === 0) {
      out.push(100);
    } else {
      const rs = avgG / avgL;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9) {
  const fastE = ema(values, fast);
  const slowE = ema(values, slow);
  const line = values.map((_, i) => {
    if (fastE[i] == null || slowE[i] == null) return null;
    return (fastE[i] as number) - (slowE[i] as number);
  });
  const valid = line.map((v) => (v == null ? 0 : v));
  const sig = ema(valid, signal).map((v, i) => (line[i] == null ? null : v));
  const hist = line.map((v, i) => (v == null || sig[i] == null ? null : v - (sig[i] as number)));
  return { line, signal: sig, histogram: hist };
}

export function bollinger(values: number[], period = 20, stdMult = 2) {
  const mid = sma(values, period);
  const sd = rollingStd(values, period);
  const upper = mid.map((m, i) => (m == null || sd[i] == null ? null : m + stdMult * (sd[i] as number)));
  const lower = mid.map((m, i) => (m == null || sd[i] == null ? null : m - stdMult * (sd[i] as number)));
  return { mid, upper, lower };
}

export function donchian(candles: { h: number; l: number }[], period = 20) {
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      lower.push(null);
      continue;
    }
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (candles[j].h > hi) hi = candles[j].h;
      if (candles[j].l < lo) lo = candles[j].l;
    }
    upper.push(hi);
    lower.push(lo);
  }
  return { upper, lower };
}

// Hurst exponent via R/S analysis. >0.5 trending, <0.5 mean reverting.
export function hurst(values: number[]): number {
  if (values.length < 32) return 0.5;
  const lags = [4, 8, 16, 32, 64].filter((l) => l < values.length);
  const tau: number[] = [];
  for (const lag of lags) {
    const diffs: number[] = [];
    for (let i = 0; i < values.length - lag; i++) diffs.push(values[i + lag] - values[i]);
    tau.push(std(diffs));
  }
  const xs = lags.map((l) => Math.log(l));
  const ys = tau.map((t) => Math.log(Math.max(1e-9, t)));
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0.5 : num / den;
}

// Simple 1D Kalman filter on a price series.
export function kalman(values: number[], processNoise = 0.05, obsNoise = 1.5): (number | null)[] {
  if (values.length === 0) return [];
  const out: (number | null)[] = [];
  let x = values[0];
  let p = 1;
  for (let i = 0; i < values.length; i++) {
    p = p + processNoise;
    const k = p / (p + obsNoise);
    x = x + k * (values[i] - x);
    p = (1 - k) * p;
    out.push(x);
  }
  return out;
}

// Simple linear regression line + std-based bands across a window.
export function linregChannel(values: number[], period = 50, stdMult = 2) {
  const mid: (number | null)[] = [];
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      mid.push(null);
      upper.push(null);
      lower.push(null);
      continue;
    }
    const win = values.slice(i - period + 1, i + 1);
    const n = win.length;
    let sx = 0, sy = 0, sxy = 0, sxx = 0;
    for (let k = 0; k < n; k++) {
      sx += k;
      sy += win[k];
      sxy += k * win[k];
      sxx += k * k;
    }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    const intercept = (sy - slope * sx) / n;
    const fit = win.map((_, k) => intercept + slope * k);
    const residuals = win.map((v, k) => v - fit[k]);
    const sd = std(residuals);
    const cur = fit[n - 1];
    mid.push(cur);
    upper.push(cur + stdMult * sd);
    lower.push(cur - stdMult * sd);
  }
  return { mid, upper, lower };
}

// Annualised Sharpe (assumes daily candles). 252 trading days.
export function sharpe(rets: number[], rf = 0): number {
  if (rets.length === 0) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = std(rets);
  if (sd === 0) return 0;
  return ((mean - rf) / sd) * Math.sqrt(252);
}

export function sortino(rets: number[], rf = 0): number {
  if (rets.length === 0) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const downside = rets.filter((r) => r < 0);
  const sd = std(downside);
  if (sd === 0) return 0;
  return ((mean - rf) / sd) * Math.sqrt(252);
}

export function maxDrawdown(equity: number[]): { dd: number; peakIdx: number; trIdx: number } {
  let peak = equity[0] ?? 1;
  let peakIdx = 0;
  let dd = 0;
  let trIdx = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] > peak) {
      peak = equity[i];
      peakIdx = i;
    }
    const cur = (equity[i] - peak) / peak;
    if (cur < dd) {
      dd = cur;
      trIdx = i;
    }
  }
  return { dd, peakIdx, trIdx };
}

// Box-Muller standard normal using a seeded RNG so results are deterministic.
export function makeRand(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNorm(seed = 1) {
  const rand = makeRand(seed);
  return () => {
    const u = Math.max(1e-12, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

// Simple long-only backtest: buy on +1, exit on -1, flat on 0. Returns
// equity curve normalised to 1.0.
export function backtestLongOnly(
  prices: number[],
  signals: (1 | -1 | 0)[]
): { equity: number[]; trades: number; winRate: number } {
  const eq: number[] = [1];
  let inPos = false;
  let entry = 0;
  let trades = 0;
  let wins = 0;
  for (let i = 1; i < prices.length; i++) {
    const sig = signals[i] ?? 0;
    if (!inPos && sig === 1) {
      inPos = true;
      entry = prices[i];
      trades++;
      eq.push(eq[eq.length - 1]);
      continue;
    }
    if (inPos && sig === -1) {
      const ret = (prices[i] - entry) / entry;
      if (ret > 0) wins++;
      eq.push(eq[eq.length - 1] * (1 + ret));
      inPos = false;
      continue;
    }
    if (inPos) {
      eq.push(eq[eq.length - 1] * (prices[i] / prices[i - 1]));
    } else {
      eq.push(eq[eq.length - 1]);
    }
  }
  return { equity: eq, trades, winRate: trades === 0 ? 0 : wins / trades };
}

export function fmtPct(x: number, d = 1) {
  const sign = x > 0 ? "+" : "";
  return `${sign}${(x * 100).toFixed(d)}%`;
}

export function fmtNum(x: number, d = 2) {
  if (!isFinite(x)) return "—";
  return x.toFixed(d);
}

export function fmtMoney(x: number) {
  const sign = x < 0 ? "-" : "";
  return `${sign}$${Math.abs(x).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

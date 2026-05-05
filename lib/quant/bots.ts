import type { BotDef, BotResult, BotContext, Signal } from "./types";
import { AI_BOTS } from "./ai-bots";
import {
  closes,
  returns,
  sma,
  ema,
  rsi,
  macd,
  bollinger,
  donchian,
  zscore,
  hurst,
  kalman,
  linregChannel,
  sharpe,
  sortino,
  maxDrawdown,
  makeNorm,
  backtestLongOnly,
  fmtPct,
  fmtNum,
  fmtMoney,
} from "./series";
import { priceOption } from "../pricing";

const num = (p: Record<string, unknown>, k: string, d: number) => {
  const v = p[k];
  return typeof v === "number" && isFinite(v) ? v : d;
};

// ─────────────── 1. SMA Crossover ───────────────
const smaCrossover: BotDef = {
  id: "sma-cross",
  name: "SMA Crossover",
  category: "trend",
  glyph: "↗",
  tagline: "Buy when fast moving average crosses above slow.",
  formula: "buy if SMA(fast) > SMA(slow) and was below yesterday",
  params: [
    { key: "fast", label: "Fast period", kind: "number", default: 12, min: 3, max: 50, step: 1 },
    { key: "slow", label: "Slow period", kind: "number", default: 26, min: 10, max: 200, step: 1 },
  ],
  run: (ctx, p): BotResult => {
    const fast = Math.round(num(p, "fast", 12));
    const slow = Math.round(num(p, "slow", 26));
    const px = closes(ctx.candles);
    const f = sma(px, fast);
    const s = sma(px, slow);
    const signals: Signal[] = [];
    const sigArr: (1 | -1 | 0)[] = px.map(() => 0);
    for (let i = 1; i < px.length; i++) {
      const fp = f[i - 1], fc = f[i], sp = s[i - 1], sc = s[i];
      if (fp == null || fc == null || sp == null || sc == null) continue;
      if (fp <= sp && fc > sc) {
        signals.push({ i, kind: "buy", price: px[i], label: "golden cross" });
        sigArr[i] = 1;
      } else if (fp >= sp && fc < sc) {
        signals.push({ i, kind: "sell", price: px[i], label: "death cross" });
        sigArr[i] = -1;
      }
    }
    const bt = backtestLongOnly(px, sigArr);
    const lastF = f[f.length - 1];
    const lastS = s[s.length - 1];
    const trending = lastF != null && lastS != null && lastF > lastS;
    const eqRet = bt.equity[bt.equity.length - 1] - 1;
    return {
      signals,
      metrics: [
        { key: "trend", label: "Trend", value: trending ? "BULL" : "BEAR", tone: trending ? "bull" : "bear" },
        { key: "trades", label: "Trades", value: String(bt.trades), tone: "neutral" },
        { key: "win", label: "Win rate", value: `${(bt.winRate * 100).toFixed(0)}%`, tone: bt.winRate > 0.5 ? "bull" : "warn" },
        { key: "ret", label: "Return", value: fmtPct(eqRet), tone: eqRet > 0 ? "bull" : "bear" },
      ],
      overlay: [
        { values: f, color: "var(--bull)", label: `SMA${fast}` },
        { values: s, color: "var(--cyan)", label: `SMA${slow}` },
      ],
      summary: `${signals.length} crosses · ${bt.trades} trades · ${(bt.winRate * 100).toFixed(0)}% win rate · backtest return ${fmtPct(eqRet)}.`,
      beginner:
        "Two moving averages chase each other. When the faster one cuts up through the slow one, money flows in. When it falls below, it cuts losses. Old, simple, surprisingly hard to beat.",
      verdict: {
        side: trending ? "buy" : "sell",
        text: trending
          ? "Fast SMA is above slow SMA. Trend is up — bias long."
          : "Fast SMA is below slow SMA. Trend is down — bias short or stand aside.",
        confidence: Math.min(1, Math.abs((lastF ?? 0) - (lastS ?? 0)) / (px[px.length - 1] || 1) * 20),
      },
      equity: bt.equity,
    };
  },
};

// ─────────────── 2. RSI Reversion ───────────────
const rsiBot: BotDef = {
  id: "rsi-rev",
  name: "RSI Reversion",
  category: "trend",
  glyph: "≈",
  tagline: "Catch oversold bounces, fade overbought spikes.",
  formula: "RSI = 100 − 100 / (1 + avgGain/avgLoss)",
  params: [
    { key: "period", label: "Period", kind: "number", default: 14, min: 5, max: 30, step: 1 },
    { key: "buyBelow", label: "Buy below", kind: "number", default: 30, min: 10, max: 45, step: 1 },
    { key: "sellAbove", label: "Sell above", kind: "number", default: 70, min: 55, max: 90, step: 1 },
  ],
  run: (ctx, p): BotResult => {
    const period = Math.round(num(p, "period", 14));
    const lo = num(p, "buyBelow", 30);
    const hi = num(p, "sellAbove", 70);
    const px = closes(ctx.candles);
    const r = rsi(px, period);
    const signals: Signal[] = [];
    const sigArr: (1 | -1 | 0)[] = px.map(() => 0);
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], b = r[i];
      if (a == null || b == null) continue;
      if (a < lo && b >= lo) {
        signals.push({ i, kind: "buy", price: px[i], label: "exit oversold" });
        sigArr[i] = 1;
      } else if (a > hi && b <= hi) {
        signals.push({ i, kind: "sell", price: px[i], label: "exit overbought" });
        sigArr[i] = -1;
      }
    }
    const bt = backtestLongOnly(px, sigArr);
    const last = r[r.length - 1] ?? 50;
    const state = last < lo ? "oversold" : last > hi ? "overbought" : "neutral";
    return {
      signals,
      metrics: [
        { key: "rsi", label: "RSI", value: fmtNum(last, 1), tone: last < lo ? "bull" : last > hi ? "bear" : "neutral" },
        { key: "state", label: "State", value: state.toUpperCase(), tone: state === "oversold" ? "bull" : state === "overbought" ? "bear" : "neutral" },
        { key: "trades", label: "Trades", value: String(bt.trades), tone: "neutral" },
        { key: "ret", label: "Return", value: fmtPct(bt.equity[bt.equity.length - 1] - 1), tone: "info" },
      ],
      pane: {
        kind: "line",
        series: [{ values: r, color: "var(--cyan)", label: "RSI" }],
        refLines: [
          { value: hi, color: "var(--bear)", label: `${hi} OB` },
          { value: lo, color: "var(--bull)", label: `${lo} OS` },
          { value: 50, color: "var(--fg-faint)" },
        ],
        height: 80,
      },
      summary: `RSI ${last.toFixed(1)} (${state}). ${signals.length} reversion triggers in window.`,
      beginner:
        "RSI is a 0-to-100 thermometer. Below 30 means everyone panicked and the price is probably going to bounce. Above 70 means everyone's cheering and a pullback is overdue.",
      verdict: {
        side: state === "oversold" ? "buy" : state === "overbought" ? "sell" : "hold",
        text:
          state === "oversold"
            ? "RSI is in the 'panic' zone — bounces happen here often."
            : state === "overbought"
            ? "RSI is in the 'cheering' zone — fade or take profit."
            : "RSI in the middle — no edge, sit tight.",
        confidence: Math.abs(last - 50) / 50,
      },
      equity: bt.equity,
    };
  },
};

// ─────────────── 3. MACD Histogram ───────────────
const macdBot: BotDef = {
  id: "macd",
  name: "MACD Histogram",
  category: "trend",
  glyph: "▥",
  tagline: "Momentum from EMA difference & its signal line.",
  formula: "MACD = EMA(fast) − EMA(slow); signal = EMA(MACD)",
  params: [
    { key: "fast", label: "Fast EMA", kind: "number", default: 12, min: 5, max: 26, step: 1 },
    { key: "slow", label: "Slow EMA", kind: "number", default: 26, min: 17, max: 52, step: 1 },
    { key: "signal", label: "Signal EMA", kind: "number", default: 9, min: 3, max: 18, step: 1 },
  ],
  run: (ctx, p): BotResult => {
    const fast = Math.round(num(p, "fast", 12));
    const slow = Math.round(num(p, "slow", 26));
    const sig = Math.round(num(p, "signal", 9));
    const px = closes(ctx.candles);
    const m = macd(px, fast, slow, sig);
    const signals: Signal[] = [];
    const sigArr: (1 | -1 | 0)[] = px.map(() => 0);
    for (let i = 1; i < m.histogram.length; i++) {
      const a = m.histogram[i - 1], b = m.histogram[i];
      if (a == null || b == null) continue;
      if (a <= 0 && b > 0) {
        signals.push({ i, kind: "buy", price: px[i], label: "hist > 0" });
        sigArr[i] = 1;
      } else if (a >= 0 && b < 0) {
        signals.push({ i, kind: "sell", price: px[i], label: "hist < 0" });
        sigArr[i] = -1;
      }
    }
    const bt = backtestLongOnly(px, sigArr);
    const lastH = m.histogram[m.histogram.length - 1] ?? 0;
    return {
      signals,
      metrics: [
        { key: "hist", label: "Hist", value: fmtNum(lastH, 3), tone: lastH > 0 ? "bull" : "bear" },
        { key: "line", label: "MACD", value: fmtNum(m.line[m.line.length - 1] ?? 0, 3), tone: "neutral" },
        { key: "trades", label: "Trades", value: String(bt.trades), tone: "neutral" },
        { key: "win", label: "Win rate", value: `${(bt.winRate * 100).toFixed(0)}%`, tone: bt.winRate > 0.5 ? "bull" : "warn" },
      ],
      pane: {
        kind: "histogram",
        series: [
          { values: m.histogram, color: "var(--plasma)", label: "Hist" },
          { values: m.line, color: "var(--bull)", label: "MACD" },
          { values: m.signal, color: "var(--cyan)", label: "Signal" },
        ],
        refLines: [{ value: 0, color: "var(--fg-faint)" }],
        height: 90,
      },
      summary: `MACD histogram ${lastH.toFixed(3)}. ${signals.length} crosses, ${bt.trades} trades, win ${(bt.winRate * 100).toFixed(0)}%.`,
      beginner:
        "MACD looks at the difference between two trend-followers. When that difference flips from negative to positive, momentum just woke up. When it flips negative, it's running out of steam.",
      verdict: {
        side: lastH > 0 ? "buy" : "sell",
        text: lastH > 0 ? "Histogram above zero — momentum tilts long." : "Histogram below zero — momentum tilts short.",
        confidence: Math.min(1, Math.abs(lastH) * 5),
      },
      equity: bt.equity,
    };
  },
};

// ─────────────── 4. Donchian Breakout ───────────────
const donchianBot: BotDef = {
  id: "donchian",
  name: "Donchian Breakout",
  category: "trend",
  glyph: "⊕",
  tagline: "The Turtle trade — buy n-day highs, sell n-day lows.",
  formula: "buy if close > max(high, n); sell if close < min(low, n)",
  params: [
    { key: "period", label: "Period", kind: "number", default: 20, min: 10, max: 100, step: 1 },
  ],
  run: (ctx, p): BotResult => {
    const period = Math.round(num(p, "period", 20));
    const px = closes(ctx.candles);
    const ch = donchian(ctx.candles, period);
    const signals: Signal[] = [];
    const sigArr: (1 | -1 | 0)[] = px.map(() => 0);
    for (let i = period; i < px.length; i++) {
      // Use prior bar's channel to avoid look-ahead
      const u = ch.upper[i - 1];
      const l = ch.lower[i - 1];
      if (u == null || l == null) continue;
      if (px[i] > u) {
        signals.push({ i, kind: "buy", price: px[i], label: `${period}d high` });
        sigArr[i] = 1;
      } else if (px[i] < l) {
        signals.push({ i, kind: "sell", price: px[i], label: `${period}d low` });
        sigArr[i] = -1;
      }
    }
    const bt = backtestLongOnly(px, sigArr);
    const last = px[px.length - 1];
    const u = ch.upper[ch.upper.length - 1] ?? last;
    const l = ch.lower[ch.lower.length - 1] ?? last;
    const range = u - l;
    const pos = range === 0 ? 0.5 : (last - l) / range;
    return {
      signals,
      metrics: [
        { key: "upper", label: "Upper", value: fmtNum(u), tone: "bull" },
        { key: "lower", label: "Lower", value: fmtNum(l), tone: "bear" },
        { key: "pos", label: "Position", value: `${(pos * 100).toFixed(0)}%`, tone: pos > 0.7 ? "bull" : pos < 0.3 ? "bear" : "neutral" },
        { key: "ret", label: "Return", value: fmtPct(bt.equity[bt.equity.length - 1] - 1), tone: "info" },
      ],
      overlay: [
        { values: ch.upper, color: "var(--bull)", label: "Upper", dashed: true },
        { values: ch.lower, color: "var(--bear)", label: "Lower", dashed: true },
      ],
      summary: `${period}-bar channel ${l.toFixed(2)}–${u.toFixed(2)}. ${signals.length} breakouts.`,
      beginner:
        "Drew lines through the highest high and lowest low of the last N days. Price punching above the top line = the herd just turned bullish. The Turtle Traders made fortunes on this exact rule.",
      verdict: {
        side: pos > 0.85 ? "buy" : pos < 0.15 ? "sell" : "hold",
        text:
          pos > 0.85
            ? "Price near the top of the channel — breakout territory."
            : pos < 0.15
            ? "Price near the bottom — breakdown territory."
            : "Price mid-channel — wait for a break.",
        confidence: Math.abs(pos - 0.5) * 2,
      },
      equity: bt.equity,
    };
  },
};

// ─────────────── 5. Bollinger Bands ───────────────
const bollBot: BotDef = {
  id: "boll",
  name: "Bollinger Bands",
  category: "trend",
  glyph: "⌇",
  tagline: "Volatility envelopes around a moving average.",
  formula: "upper = SMA(n) + k·σ; lower = SMA(n) − k·σ",
  params: [
    { key: "period", label: "Period", kind: "number", default: 20, min: 10, max: 50, step: 1 },
    { key: "stdMult", label: "Std multiplier", kind: "number", default: 2, min: 1, max: 3, step: 0.1 },
  ],
  run: (ctx, p): BotResult => {
    const period = Math.round(num(p, "period", 20));
    const k = num(p, "stdMult", 2);
    const px = closes(ctx.candles);
    const b = bollinger(px, period, k);
    const signals: Signal[] = [];
    const sigArr: (1 | -1 | 0)[] = px.map(() => 0);
    for (let i = 1; i < px.length; i++) {
      const upPrev = b.upper[i - 1], loPrev = b.lower[i - 1];
      const u = b.upper[i], l = b.lower[i];
      if (u == null || l == null || upPrev == null || loPrev == null) continue;
      if (px[i - 1] < loPrev && px[i] >= l) {
        signals.push({ i, kind: "buy", price: px[i], label: "lower band reclaim" });
        sigArr[i] = 1;
      } else if (px[i - 1] > upPrev && px[i] <= u) {
        signals.push({ i, kind: "sell", price: px[i], label: "upper band reject" });
        sigArr[i] = -1;
      }
    }
    const bt = backtestLongOnly(px, sigArr);
    const last = px[px.length - 1];
    const lu = b.upper[b.upper.length - 1] ?? last;
    const ll = b.lower[b.lower.length - 1] ?? last;
    const lm = b.mid[b.mid.length - 1] ?? last;
    const width = (lu - ll) / lm;
    return {
      signals,
      metrics: [
        { key: "width", label: "Width", value: `${(width * 100).toFixed(1)}%`, tone: width > 0.1 ? "warn" : "neutral", hint: "vol envelope" },
        { key: "upper", label: "Upper", value: fmtNum(lu) },
        { key: "lower", label: "Lower", value: fmtNum(ll) },
        { key: "trades", label: "Trades", value: String(bt.trades) },
      ],
      overlay: [
        { values: b.mid, color: "var(--fg-dim)", label: "SMA" },
        { values: b.upper, color: "var(--bear-dim)", label: "Upper", dashed: true },
        { values: b.lower, color: "var(--bull-dim)", label: "Lower", dashed: true },
      ],
      summary: `Bands width ${(width * 100).toFixed(1)}%. ${signals.length} band-touch reversals.`,
      beginner:
        "Two rubber bands stretched k standard deviations away from the average. When price stretches one and snaps back, that's the trade. Wider bands mean the market is jittery.",
      verdict: {
        side: last < ll ? "buy" : last > lu ? "sell" : "hold",
        text: last < ll ? "Below lower band — coiled spring." : last > lu ? "Above upper band — overextended." : "Inside the bands — no edge.",
        confidence: Math.min(1, Math.abs(last - lm) / (lu - lm || 1)),
      },
      equity: bt.equity,
    };
  },
};

// ─────────────── 6. Z-Score Mean Reversion ───────────────
const zscoreBot: BotDef = {
  id: "zscore",
  name: "Z-Score Reversion",
  category: "stats",
  glyph: "ζ",
  tagline: "Bet on snap-back when the price wanders too far.",
  formula: "z = (price − μ) / σ over n bars",
  params: [
    { key: "period", label: "Window", kind: "number", default: 30, min: 10, max: 120, step: 1 },
    { key: "threshold", label: "|z| threshold", kind: "number", default: 2, min: 1, max: 3, step: 0.1 },
  ],
  run: (ctx, p): BotResult => {
    const period = Math.round(num(p, "period", 30));
    const th = num(p, "threshold", 2);
    const px = closes(ctx.candles);
    const z = zscore(px, period);
    const signals: Signal[] = [];
    const sigArr: (1 | -1 | 0)[] = px.map(() => 0);
    for (let i = 1; i < z.length; i++) {
      const a = z[i - 1], b = z[i];
      if (a == null || b == null) continue;
      if (a < -th && b >= -th) {
        signals.push({ i, kind: "buy", price: px[i], label: "reverting up" });
        sigArr[i] = 1;
      } else if (a > th && b <= th) {
        signals.push({ i, kind: "sell", price: px[i], label: "reverting down" });
        sigArr[i] = -1;
      }
    }
    const bt = backtestLongOnly(px, sigArr);
    const last = z[z.length - 1] ?? 0;
    return {
      signals,
      metrics: [
        { key: "z", label: "Z", value: fmtNum(last, 2), tone: last > th ? "bear" : last < -th ? "bull" : "neutral" },
        { key: "thr", label: "Threshold", value: `±${th}`, tone: "neutral" },
        { key: "trades", label: "Trades", value: String(bt.trades) },
        { key: "win", label: "Win rate", value: `${(bt.winRate * 100).toFixed(0)}%`, tone: bt.winRate > 0.5 ? "bull" : "warn" },
      ],
      pane: {
        kind: "line",
        series: [{ values: z, color: "var(--plasma)", label: "z" }],
        refLines: [
          { value: th, color: "var(--bear)", label: "+" + th },
          { value: -th, color: "var(--bull)", label: "−" + th },
          { value: 0, color: "var(--fg-faint)" },
        ],
        height: 80,
      },
      summary: `Z = ${last.toFixed(2)} (threshold ±${th}). ${signals.length} reversion entries.`,
      beginner:
        "Z-score asks: how unusual is today's price compared to recent days? A z of -2 means 'cheaper than 97% of recent prices'. Most things drift back to average — that's the trade.",
      verdict: {
        side: last < -th ? "buy" : last > th ? "sell" : "hold",
        text: last < -th
          ? `${last.toFixed(2)}σ below mean — historical bounce zone.`
          : last > th
          ? `${last.toFixed(2)}σ above mean — historical fade zone.`
          : "Within the noise band — no signal.",
        confidence: Math.min(1, Math.abs(last) / 3),
      },
      equity: bt.equity,
    };
  },
};

// ─────────────── 7. Hurst Exponent ───────────────
const hurstBot: BotDef = {
  id: "hurst",
  name: "Hurst Exponent",
  category: "stats",
  glyph: "H",
  tagline: "Is this market trending, mean-reverting, or random?",
  formula: "H from R/S analysis. >0.5 trends, <0.5 reverts, =0.5 random",
  params: [
    { key: "window", label: "Window", kind: "number", default: 128, min: 64, max: 256, step: 8 },
  ],
  run: (ctx): BotResult => {
    const px = closes(ctx.candles);
    const h = hurst(px);
    let regime: "trend" | "revert" | "random" = "random";
    if (h > 0.55) regime = "trend";
    else if (h < 0.45) regime = "revert";
    return {
      signals: [],
      metrics: [
        { key: "h", label: "H", value: fmtNum(h, 3), tone: regime === "trend" ? "bull" : regime === "revert" ? "warn" : "neutral" },
        { key: "regime", label: "Regime", value: regime.toUpperCase(), tone: regime === "trend" ? "bull" : regime === "revert" ? "warn" : "neutral" },
        { key: "edge", label: "Edge", value: regime === "random" ? "NONE" : "YES", tone: regime === "random" ? "warn" : "bull" },
      ],
      summary: `H = ${h.toFixed(3)} → ${regime} regime.`,
      beginner:
        "Hurst is one number that tells you what kind of market you're in. >0.5 = the trend keeps going (use trend bots). <0.5 = price keeps snapping back (use reversion bots). =0.5 = random, no edge.",
      verdict: {
        side: "hold",
        text:
          regime === "trend"
            ? "Trend regime — momentum bots have edge here."
            : regime === "revert"
            ? "Reversion regime — mean-reversion bots have edge here."
            : "Random walk — no statistical edge today.",
        confidence: Math.abs(h - 0.5) * 2,
      },
    };
  },
};

// ─────────────── 8. Kalman Filter ───────────────
const kalmanBot: BotDef = {
  id: "kalman",
  name: "Kalman Filter",
  category: "stats",
  glyph: "K",
  tagline: "Adaptive fair-value tracker. Smooth and self-correcting.",
  formula: "x = x + K · (price − x); K = P/(P+R)",
  params: [
    { key: "process", label: "Process noise (Q)", kind: "number", default: 0.05, min: 0.001, max: 1, step: 0.005 },
    { key: "obs", label: "Observation noise (R)", kind: "number", default: 1.5, min: 0.1, max: 10, step: 0.1 },
  ],
  run: (ctx, p): BotResult => {
    const q = num(p, "process", 0.05);
    const r = num(p, "obs", 1.5);
    const px = closes(ctx.candles);
    const fair = kalman(px, q, r);
    const last = px[px.length - 1];
    const fairLast = fair[fair.length - 1] ?? last;
    const dev = (last - fairLast) / fairLast;
    const sigArr: (1 | -1 | 0)[] = px.map(() => 0);
    const signals: Signal[] = [];
    for (let i = 1; i < px.length; i++) {
      const f = fair[i] as number;
      const fp = fair[i - 1] as number;
      const d = (px[i] - f) / f;
      const dp = (px[i - 1] - fp) / fp;
      if (dp < -0.02 && d >= -0.02) {
        signals.push({ i, kind: "buy", price: px[i], label: "back to fair" });
        sigArr[i] = 1;
      } else if (dp > 0.02 && d <= 0.02) {
        signals.push({ i, kind: "sell", price: px[i], label: "back to fair" });
        sigArr[i] = -1;
      }
    }
    const bt = backtestLongOnly(px, sigArr);
    return {
      signals,
      metrics: [
        { key: "fair", label: "Fair", value: fmtNum(fairLast), tone: "info" },
        { key: "dev", label: "Deviation", value: fmtPct(dev), tone: dev > 0.03 ? "bear" : dev < -0.03 ? "bull" : "neutral" },
        { key: "trades", label: "Trades", value: String(bt.trades) },
        { key: "ret", label: "Return", value: fmtPct(bt.equity[bt.equity.length - 1] - 1), tone: "info" },
      ],
      overlay: [{ values: fair, color: "var(--cyan)", label: "Kalman" }],
      summary: `Kalman fair value ${fairLast.toFixed(2)}, deviation ${(dev * 100).toFixed(1)}%.`,
      beginner:
        "A Kalman filter is what guides your phone's GPS — it blends what it expects with what it sees. Here it tracks the 'true' price hiding under the noise. Big deviations are the trade.",
      verdict: {
        side: dev < -0.03 ? "buy" : dev > 0.03 ? "sell" : "hold",
        text:
          dev < -0.03
            ? `Price ${(Math.abs(dev) * 100).toFixed(1)}% below filtered fair value.`
            : dev > 0.03
            ? `Price ${(dev * 100).toFixed(1)}% above filtered fair value.`
            : "Price hugging fair value — no edge.",
        confidence: Math.min(1, Math.abs(dev) * 20),
      },
      equity: bt.equity,
    };
  },
};

// ─────────────── 9. LinReg Channel ───────────────
const linregBot: BotDef = {
  id: "linreg",
  name: "LinReg Channel",
  category: "stats",
  glyph: "λ",
  tagline: "Linear regression line + std-deviation envelopes.",
  formula: "y = β·x + α; bands = y ± k·σ(residuals)",
  params: [
    { key: "period", label: "Period", kind: "number", default: 60, min: 20, max: 200, step: 1 },
    { key: "bands", label: "Std bands", kind: "number", default: 2, min: 1, max: 3, step: 0.1 },
  ],
  run: (ctx, p): BotResult => {
    const period = Math.round(num(p, "period", 60));
    const k = num(p, "bands", 2);
    const px = closes(ctx.candles);
    const r = linregChannel(px, period, k);
    const signals: Signal[] = [];
    const sigArr: (1 | -1 | 0)[] = px.map(() => 0);
    for (let i = 1; i < px.length; i++) {
      const u = r.upper[i], l = r.lower[i];
      if (u == null || l == null) continue;
      if (px[i - 1] < (r.lower[i - 1] ?? -Infinity) && px[i] >= l) {
        signals.push({ i, kind: "buy", price: px[i] });
        sigArr[i] = 1;
      } else if (px[i - 1] > (r.upper[i - 1] ?? Infinity) && px[i] <= u) {
        signals.push({ i, kind: "sell", price: px[i] });
        sigArr[i] = -1;
      }
    }
    const bt = backtestLongOnly(px, sigArr);
    const last = px[px.length - 1];
    const lm = r.mid[r.mid.length - 1] ?? last;
    const lu = r.upper[r.upper.length - 1] ?? last;
    const ll = r.lower[r.lower.length - 1] ?? last;
    return {
      signals,
      metrics: [
        { key: "fair", label: "Trend line", value: fmtNum(lm), tone: "info" },
        { key: "upper", label: "Upper", value: fmtNum(lu), tone: "bear" },
        { key: "lower", label: "Lower", value: fmtNum(ll), tone: "bull" },
        { key: "trades", label: "Trades", value: String(bt.trades) },
      ],
      overlay: [
        { values: r.mid, color: "var(--fg-dim)", label: "LinReg" },
        { values: r.upper, color: "var(--bear-dim)", label: "Upper", dashed: true },
        { values: r.lower, color: "var(--bull-dim)", label: "Lower", dashed: true },
      ],
      summary: `Trend ${lm.toFixed(2)}, channel ${ll.toFixed(2)}–${lu.toFixed(2)}.`,
      beginner:
        "Draws the best-fit line through recent prices, then puts dotted lines a few standard deviations above and below. Touching the top is overextended; the bottom is washed out.",
      verdict: {
        side: last < ll ? "buy" : last > lu ? "sell" : "hold",
        text: last < ll ? "Below lower channel." : last > lu ? "Above upper channel." : "Inside the channel.",
        confidence: Math.min(1, Math.abs(last - lm) / (lu - lm || 1)),
      },
      equity: bt.equity,
    };
  },
};

// ─────────────── 10. Kelly Criterion ───────────────
const kellyBot: BotDef = {
  id: "kelly",
  name: "Kelly Criterion",
  category: "risk",
  glyph: "$",
  tagline: "Optimal bet size given win odds and payoff.",
  formula: "f* = (p·b − q) / b   where q = 1−p, b = win$/loss$",
  params: [
    { key: "winProb", label: "Win probability %", kind: "number", default: 55, min: 10, max: 90, step: 1 },
    { key: "winAmt", label: "Avg win $", kind: "number", default: 200, min: 10, max: 5000, step: 10 },
    { key: "lossAmt", label: "Avg loss $", kind: "number", default: 150, min: 10, max: 5000, step: 10 },
    { key: "bankroll", label: "Bankroll $", kind: "number", default: 100000, min: 100, max: 10000000, step: 100 },
    { key: "fraction", label: "Kelly fraction", kind: "number", default: 0.5, min: 0.1, max: 1, step: 0.05, hint: "use 0.25–0.5 in real life" },
  ],
  run: (_ctx, p): BotResult => {
    const pw = num(p, "winProb", 55) / 100;
    const w = num(p, "winAmt", 200);
    const l = num(p, "lossAmt", 150);
    const bk = num(p, "bankroll", 100000);
    const frac = num(p, "fraction", 0.5);
    const b = w / l;
    const fStar = Math.max(0, (pw * b - (1 - pw)) / b);
    const fUse = fStar * frac;
    const sizeRaw = bk * fStar;
    const sizeUsed = bk * fUse;
    const ev = pw * w - (1 - pw) * l;
    return {
      signals: [],
      metrics: [
        { key: "f", label: "f* full", value: `${(fStar * 100).toFixed(1)}%`, tone: fStar > 0 ? "bull" : "bear" },
        { key: "f-use", label: `f used (${frac}×)`, value: `${(fUse * 100).toFixed(1)}%`, tone: "neutral" },
        { key: "size", label: "Bet size", value: fmtMoney(sizeUsed), tone: "info" },
        { key: "ev", label: "EV / trade", value: fmtMoney(ev), tone: ev > 0 ? "bull" : "bear" },
      ],
      summary: `Full Kelly = ${(fStar * 100).toFixed(1)}%. Using ${(fUse * 100).toFixed(1)}% → bet ${fmtMoney(sizeUsed)} on a ${fmtMoney(bk)} stack.`,
      beginner:
        "Kelly tells you how much of your bankroll to risk per trade so it grows fastest without ever hitting zero. Half-Kelly (0.5×) gives 75% of the growth with way less stomach-turn — that's what most pros actually use.",
      verdict: {
        side: fStar > 0 ? "buy" : "warn",
        text: fStar > 0 ? `Edge exists. Bet up to ${(fUse * 100).toFixed(1)}% per shot.` : "No edge — don't bet.",
        confidence: Math.min(1, fStar * 4),
      },
    };
  },
};

// ─────────────── 11. Monte Carlo VaR ───────────────
const varBot: BotDef = {
  id: "mc-var",
  name: "Monte Carlo VaR",
  category: "risk",
  glyph: "Σ",
  tagline: "Worst loss you'd expect 95% of the time.",
  formula: "VaR = quantile of simulated horizon returns",
  params: [
    { key: "sims", label: "Simulations", kind: "number", default: 4000, min: 1000, max: 20000, step: 500 },
    { key: "horizon", label: "Horizon (days)", kind: "number", default: 10, min: 1, max: 90, step: 1 },
    { key: "confidence", label: "Confidence %", kind: "number", default: 95, min: 90, max: 99, step: 0.5 },
    { key: "notional", label: "Notional $", kind: "number", default: 100000, min: 1000, max: 10000000, step: 1000 },
  ],
  run: (ctx, p): BotResult => {
    const sims = Math.round(num(p, "sims", 4000));
    const horizon = Math.round(num(p, "horizon", 10));
    const conf = num(p, "confidence", 95) / 100;
    const notional = num(p, "notional", 100000);
    const px = closes(ctx.candles);
    const rets = returns(px);
    const mean = rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
    const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1));
    const norm = makeNorm(31);
    const finals: number[] = [];
    for (let i = 0; i < sims; i++) {
      let r = 1;
      for (let d = 0; d < horizon; d++) r *= 1 + (mean + sd * norm());
      finals.push(r - 1);
    }
    finals.sort((a, b) => a - b);
    const idx = Math.floor((1 - conf) * sims);
    const varRet = finals[idx];
    const cvar = finals.slice(0, Math.max(1, idx)).reduce((a, b) => a + b, 0) / Math.max(1, idx);
    const expRet = finals.reduce((a, b) => a + b, 0) / sims;
    return {
      signals: [],
      metrics: [
        { key: "var", label: `VaR ${(conf * 100).toFixed(0)}%`, value: fmtMoney(varRet * notional), tone: "bear" },
        { key: "cvar", label: "CVaR (tail avg)", value: fmtMoney(cvar * notional), tone: "bear" },
        { key: "exp", label: `${horizon}d expected`, value: fmtMoney(expRet * notional), tone: expRet > 0 ? "bull" : "bear" },
        { key: "vol", label: "Daily vol", value: `${(sd * 100).toFixed(2)}%`, tone: "info" },
      ],
      summary: `${(conf * 100).toFixed(0)}% confident the ${horizon}-day loss won't exceed ${fmtMoney(varRet * notional)} on ${fmtMoney(notional)} notional.`,
      beginner:
        "Run thousands of simulated 'next 10 days'. The 5th-worst outcome out of 100 is your Value-at-Risk — the bad day you should plan to survive. CVaR is the average of the days worse than that.",
      verdict: {
        side: "warn",
        text: `Plan for losses up to ${fmtMoney(Math.abs(varRet * notional))} this ${horizon}-day window.`,
        confidence: 0.85,
      },
    };
  },
};

// ─────────────── 12. Sharpe / Sortino Optimizer ───────────────
const sharpeBot: BotDef = {
  id: "sharpe",
  name: "Sharpe Optimizer",
  category: "risk",
  glyph: "★",
  tagline: "Risk-adjusted return. Higher = better per unit of pain.",
  formula: "Sharpe = √252 · mean / σ ; Sortino uses downside σ",
  params: [
    { key: "lookback", label: "Lookback bars", kind: "number", default: 252, min: 30, max: 504, step: 1 },
    { key: "rf", label: "Risk-free / day", kind: "number", default: 0.0001, min: 0, max: 0.001, step: 0.0001 },
  ],
  run: (ctx, p): BotResult => {
    const lb = Math.round(num(p, "lookback", 252));
    const rf = num(p, "rf", 0.0001);
    const px = closes(ctx.candles).slice(-lb);
    const r = returns(px);
    const sh = sharpe(r, rf);
    const so = sortino(r, rf);
    const eq: number[] = [1];
    for (let i = 0; i < r.length; i++) eq.push(eq[eq.length - 1] * (1 + r[i]));
    const dd = maxDrawdown(eq).dd;
    const totalRet = eq[eq.length - 1] - 1;
    return {
      signals: [],
      metrics: [
        { key: "sharpe", label: "Sharpe", value: fmtNum(sh, 2), tone: sh > 1 ? "bull" : sh > 0 ? "neutral" : "bear" },
        { key: "sortino", label: "Sortino", value: fmtNum(so, 2), tone: so > 1 ? "bull" : "neutral" },
        { key: "ret", label: `${px.length}d return`, value: fmtPct(totalRet), tone: totalRet > 0 ? "bull" : "bear" },
        { key: "dd", label: "Max DD", value: fmtPct(dd), tone: dd < -0.2 ? "bear" : dd < -0.1 ? "warn" : "neutral" },
      ],
      summary: `Sharpe ${sh.toFixed(2)} · Sortino ${so.toFixed(2)} · Max DD ${(dd * 100).toFixed(1)}% over ${px.length} bars.`,
      beginner:
        "Sharpe is return divided by how bumpy the ride was. >1 is good. >2 is rare. >3 is suspicious. Sortino is the same idea but only counts the bumps that hurt (downside).",
      verdict: {
        side: sh > 1 ? "buy" : sh < 0 ? "warn" : "hold",
        text: sh > 1
          ? "Quality risk-adjusted return — buy-and-hold is paying."
          : sh > 0
          ? "Positive but mediocre. Look for better setups."
          : "Negative Sharpe — paying for pain. Cash > this asset right now.",
        confidence: Math.min(1, Math.abs(sh) / 3),
      },
      equity: eq,
    };
  },
};

// ─────────────── 13. Black-Scholes Solver ───────────────
const bsBot: BotDef = {
  id: "bs-solver",
  name: "Black-Scholes Solver",
  category: "options",
  glyph: "B",
  tagline: "Pure math option pricer with all the Greeks.",
  formula: "C = S·N(d₁) − K·e^(−rT)·N(d₂)",
  params: [
    { key: "type", label: "Type", kind: "select", default: "C", options: [{ value: "C", label: "Call" }, { value: "P", label: "Put" }] },
    { key: "spot", label: "Spot $", kind: "number", default: 100, min: 1, max: 10000, step: 0.5 },
    { key: "strike", label: "Strike $", kind: "number", default: 100, min: 1, max: 10000, step: 0.5 },
    { key: "days", label: "Days to expiry", kind: "number", default: 30, min: 1, max: 730, step: 1 },
    { key: "iv", label: "IV %", kind: "number", default: 32, min: 1, max: 200, step: 0.5 },
    { key: "rate", label: "Rate %", kind: "number", default: 4.5, min: 0, max: 20, step: 0.1 },
  ],
  run: (ctx, p): BotResult => {
    const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
    const type = (p["type"] as string) === "P" ? "P" : "C";
    const spot = num(p, "spot", lastPx);
    const strike = num(p, "strike", Math.round(lastPx));
    const days = num(p, "days", 30);
    const iv = num(p, "iv", 32) / 100;
    const rate = num(p, "rate", 4.5) / 100;
    const t = Math.max(0.0005, days / 365);
    const r = priceOption(spot, strike, t, rate, iv, type as "C" | "P");
    const moneyness = type === "C" ? spot / strike : strike / spot;
    return {
      signals: [],
      metrics: [
        { key: "px", label: "Price", value: `$${r.price.toFixed(2)}`, tone: "info" },
        { key: "delta", label: "Δ Delta", value: fmtNum(r.greeks.delta, 3), tone: "neutral" },
        { key: "gamma", label: "Γ Gamma", value: fmtNum(r.greeks.gamma, 4), tone: "neutral" },
        { key: "theta", label: "Θ Theta /day", value: fmtNum(r.greeks.theta, 3), tone: "bear" },
        { key: "vega", label: "ν Vega /1%", value: fmtNum(r.greeks.vega, 3), tone: "neutral" },
        { key: "rho", label: "ρ Rho /1%", value: fmtNum(r.greeks.rho, 3), tone: "neutral" },
        { key: "money", label: "Moneyness", value: fmtNum(moneyness, 3), tone: moneyness > 1.05 ? "bull" : moneyness < 0.95 ? "bear" : "neutral" },
        { key: "premium", label: "Premium / spot", value: `${((r.price / spot) * 100).toFixed(2)}%`, tone: "info" },
      ],
      summary: `${type === "C" ? "Call" : "Put"} ${strike} @ ${days}d, IV ${(iv * 100).toFixed(1)}% → $${r.price.toFixed(2)}. Δ${r.greeks.delta.toFixed(2)} · Θ${r.greeks.theta.toFixed(3)}/day.`,
      beginner:
        "Plug in 5 numbers, get the textbook fair price of an option plus all 5 Greeks. The Greeks are the option's vital signs: how sensitive the price is to spot moves, time, and volatility.",
      verdict: {
        side: "hold",
        text: `Fair price $${r.price.toFixed(2)} (${((r.price / spot) * 100).toFixed(2)}% of spot). Compare against the chain.`,
        confidence: 1,
      },
    };
  },
};

// ─────────────── 14. IV Crush Detector ───────────────
const ivCrushBot: BotDef = {
  id: "iv-crush",
  name: "IV Crush Detector",
  category: "options",
  glyph: "💥",
  tagline: "Quantify the post-event vol drop on long options.",
  formula: "Δprice ≈ vega · ΔIV (per 1% IV change)",
  params: [
    { key: "spot", label: "Spot $", kind: "number", default: 100, min: 1, max: 10000, step: 0.5 },
    { key: "strike", label: "Strike $", kind: "number", default: 100, min: 1, max: 10000, step: 0.5 },
    { key: "days", label: "Days to expiry", kind: "number", default: 14, min: 1, max: 90, step: 1 },
    { key: "preIv", label: "Pre-event IV %", kind: "number", default: 80, min: 10, max: 300, step: 1 },
    { key: "postIv", label: "Post-event IV %", kind: "number", default: 35, min: 5, max: 200, step: 1 },
    { key: "type", label: "Type", kind: "select", default: "C", options: [{ value: "C", label: "Call" }, { value: "P", label: "Put" }] },
  ],
  run: (ctx, p): BotResult => {
    const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
    const spot = num(p, "spot", lastPx);
    const strike = num(p, "strike", Math.round(lastPx));
    const days = num(p, "days", 14);
    const pre = num(p, "preIv", 80) / 100;
    const post = num(p, "postIv", 35) / 100;
    const type = (p["type"] as string) === "P" ? "P" : "C";
    const t = days / 365;
    const before = priceOption(spot, strike, t, 0.045, pre, type as "C" | "P");
    const after = priceOption(spot, strike, t, 0.045, post, type as "C" | "P");
    const drop = before.price - after.price;
    const dropPct = drop / before.price;
    return {
      signals: [],
      metrics: [
        { key: "before", label: "Pre-event $", value: `$${before.price.toFixed(2)}`, tone: "info" },
        { key: "after", label: "Post-event $", value: `$${after.price.toFixed(2)}`, tone: "info" },
        { key: "drop", label: "Crush $", value: `−$${drop.toFixed(2)}`, tone: "bear" },
        { key: "dropPct", label: "Crush %", value: `${(dropPct * 100).toFixed(1)}%`, tone: "bear" },
        { key: "vega", label: "Vega /1%", value: fmtNum(before.greeks.vega, 3), tone: "neutral" },
      ],
      summary: `IV ${(pre * 100).toFixed(0)}% → ${(post * 100).toFixed(0)}%. Long ${type === "C" ? "call" : "put"} loses ${(dropPct * 100).toFixed(1)}% on vol alone.`,
      beginner:
        "Before earnings, options get expensive because nobody knows what'll happen. The instant the news drops, that uncertainty (volatility) collapses — and options lose value even if the stock moves your way. This bot tells you exactly how much.",
      verdict: {
        side: "warn",
        text: `Buying long premium into the event risks a ${(dropPct * 100).toFixed(0)}% IV-only loss.`,
        confidence: Math.min(1, dropPct * 2),
      },
    };
  },
};

// ─────────────── 15. Wheel Backtest ───────────────
const wheelBot: BotDef = {
  id: "wheel",
  name: "Wheel Backtest",
  category: "options",
  glyph: "○",
  tagline: "Sell cash-secured puts → assigned → sell covered calls.",
  formula: "Cycle premium = put credit + (assigned ? call credit + ΔS : 0)",
  params: [
    { key: "putDelta", label: "Put delta", kind: "number", default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
    { key: "callDelta", label: "Call delta", kind: "number", default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
    { key: "dte", label: "Days to expiry", kind: "number", default: 30, min: 7, max: 60, step: 1 },
    { key: "iv", label: "IV %", kind: "number", default: 32, min: 5, max: 200, step: 0.5 },
    { key: "cycles", label: "Cycles", kind: "number", default: 12, min: 1, max: 24, step: 1 },
  ],
  run: (ctx, p): BotResult => {
    const spot = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
    const putDel = num(p, "putDelta", 0.3);
    const callDel = num(p, "callDelta", 0.3);
    const dte = num(p, "dte", 30);
    const iv = num(p, "iv", 32) / 100;
    const cycles = Math.round(num(p, "cycles", 12));
    // Approximate strikes from delta using a coarse heuristic.
    const t = dte / 365;
    const sigT = iv * Math.sqrt(t);
    const putStrike = spot * Math.exp(-sigT * 1 - sigT * (0.5 - putDel));
    const callStrike = spot * Math.exp(sigT * 1 + sigT * (callDel - 0.5));
    const putPx = priceOption(spot, putStrike, t, 0.045, iv, "P").price;
    const callPx = priceOption(spot, callStrike, t, 0.045, iv, "C").price;

    let cash = spot * 100; // cash to secure 1 contract
    let shares = 0;
    let premiums = 0;
    const norm = makeNorm(7);
    const equity: number[] = [cash];
    for (let c = 0; c < cycles; c++) {
      // simulate end-of-cycle spot
      const nextSpot = spot * Math.exp((-0.5 * iv * iv) * t + iv * Math.sqrt(t) * norm());
      if (shares === 0) {
        // sold a put
        premiums += putPx * 100;
        cash += putPx * 100;
        if (nextSpot < putStrike) {
          // assigned 100 shares at putStrike
          cash -= putStrike * 100;
          shares = 100;
        }
      } else {
        // covered call
        premiums += callPx * 100;
        cash += callPx * 100;
        if (nextSpot > callStrike) {
          cash += callStrike * 100;
          shares = 0;
        }
      }
      equity.push(cash + shares * nextSpot);
    }
    const finalEq = equity[equity.length - 1];
    const ret = (finalEq - spot * 100) / (spot * 100);
    const annual = (1 + ret) ** (12 / cycles) - 1;
    return {
      signals: [],
      metrics: [
        { key: "putK", label: "Put strike", value: `$${putStrike.toFixed(2)}`, tone: "neutral" },
        { key: "callK", label: "Call strike", value: `$${callStrike.toFixed(2)}`, tone: "neutral" },
        { key: "premiums", label: "Premiums", value: fmtMoney(premiums), tone: "bull" },
        { key: "ret", label: `${cycles}c return`, value: fmtPct(ret), tone: ret > 0 ? "bull" : "bear" },
        { key: "annual", label: "Annualised", value: fmtPct(annual), tone: annual > 0 ? "bull" : "bear" },
      ],
      summary: `${cycles} cycles · puts @ $${putStrike.toFixed(2)} / calls @ $${callStrike.toFixed(2)} · ${fmtPct(ret)} (${fmtPct(annual)} annualised).`,
      beginner:
        "The Wheel is the patient income trade. You sell puts on a stock you wouldn't mind owning. If you get assigned, you flip and sell calls against the shares. Premium income drips in either way.",
      verdict: {
        side: ret > 0 ? "buy" : "warn",
        text: ret > 0 ? `Wheel pays ${fmtPct(annual)} annualised on this seed.` : "Wheel underperforms in this scenario — try wider deltas.",
        confidence: Math.min(1, Math.abs(annual) * 2),
      },
      equity,
    };
  },
};

export const BOT_REGISTRY: BotDef[] = [
  // ── AI bots (python ai-quants stack — surfaced first because they're the moat)
  ...AI_BOTS,
  // ── Classic technical / statistical / risk / options
  smaCrossover,
  rsiBot,
  macdBot,
  donchianBot,
  bollBot,
  zscoreBot,
  hurstBot,
  kalmanBot,
  linregBot,
  kellyBot,
  varBot,
  sharpeBot,
  bsBot,
  ivCrushBot,
  wheelBot,
];

export function getBot(id: string): BotDef | undefined {
  return BOT_REGISTRY.find((b) => b.id === id);
}

export function botsByCategory() {
  const map = new Map<string, BotDef[]>();
  for (const b of BOT_REGISTRY) {
    if (!map.has(b.category)) map.set(b.category, []);
    map.get(b.category)!.push(b);
  }
  return map;
}

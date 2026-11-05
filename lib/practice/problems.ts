// The problem registry — the LIGHT half. Titles, tracks, difficulty, tags.
// Statements, stubs and testcases live in ./content/* and are merged by
// content/index.ts on the server only (see the note in ./types.ts).
//
// HONESTY. The problems are real finance / quant / ML material — the same
// math the workbench runs (lib/quant/series.ts, lib/pricing.ts, the `ai quants`
// models) — and everything printed beside a row is real too. The acceptance
// column is accepted ÷ submitted over real submissions (/api/practice/stats,
// lib/db/practice.ts statsFor) and reads "—" until a problem has enough of
// them; nothing in this file invents a number. The judge runs the solver's
// own Python (public/practice/pyodide-worker.js) and the server grades it
// (app/api/practice/[slug]/submit).
//
// Slugs are the URL. Three segments under /practice are static routes and
// therefore reserved — a test asserts no slug collides with them.

import type { Difficulty, ProblemMeta, TrackId } from "./types";
import { TRACK_ORDER } from "./tracks";

export const RESERVED_SLUGS = ["profile", "contest", "tracks"] as const;

type Row = Omit<ProblemMeta, "num">;

const FINANCE: Row[] = [
  {
    id: "black-scholes-call",
    title: "Black-Scholes call price",
    blurb: "Price a European call from S, K, T, r and σ. Remember who pays the strike, and when.",
    track: "finance",
    difficulty: "easy",
    tags: ["options", "pricing", "closed-form"],
    minutes: 15,
    featured: true,
    related: { bot: "bs-solver", learn: "/learn/bots/bs-solver" },
  },
  {
    id: "put-call-parity",
    title: "Put-call parity check",
    blurb: "Given a call, a put, spot and strike, find the arbitrage-free gap.",
    track: "finance",
    difficulty: "easy",
    tags: ["options", "arbitrage"],
    minutes: 10,
    related: { bot: "bs-solver" },
  },
  {
    id: "implied-vol-bisection",
    title: "Implied volatility by bisection",
    blurb: "Invert the pricer: find the σ that reproduces a market price.",
    track: "finance",
    difficulty: "medium",
    tags: ["options", "volatility", "root-finding"],
    minutes: 25,
    related: { bot: "ai-iv-solver", learn: "/learn/bots/ai-iv-solver" },
  },
  {
    id: "bond-price-duration",
    title: "Bond price & duration",
    blurb: "Discount the coupons, then measure how far the price moves per 1% of yield.",
    track: "finance",
    difficulty: "easy",
    tags: ["fixed-income", "discounting"],
    minutes: 15,
  },
  {
    id: "cagr-equity-curve",
    title: "CAGR from an equity curve",
    blurb: "Turn a series of account values into one annualised growth rate.",
    track: "finance",
    difficulty: "easy",
    tags: ["returns", "performance"],
    minutes: 10,
    related: { learn: "/learn#backtest" },
  },
  {
    id: "pv-cash-flow-ladder",
    title: "PV of a cash-flow ladder",
    blurb: "Discount an uneven ladder of cash flows at a flat rate.",
    track: "finance",
    difficulty: "easy",
    tags: ["discounting", "time-value"],
    minutes: 10,
  },
  {
    id: "greeks-finite-difference",
    title: "Greeks by finite difference",
    blurb: "Bump the inputs, re-price, and read delta, gamma and vega off the differences.",
    track: "finance",
    difficulty: "medium",
    tags: ["options", "greeks", "numerics"],
    minutes: 25,
    related: { bot: "bs-solver", learn: "/greeks" },
  },
  {
    id: "binomial-american-put",
    title: "Binomial-tree American put",
    blurb: "Build a CRR tree and exercise early wherever it pays.",
    track: "finance",
    difficulty: "hard",
    tags: ["options", "trees", "early-exercise"],
    minutes: 40,
    related: { bot: "ai-american", learn: "/learn/bots/ai-american" },
  },
  {
    id: "covered-call-payoff",
    title: "Covered-call payoff table",
    blurb: "Long stock plus a short call — tabulate the outcome across expiry prices.",
    track: "finance",
    difficulty: "easy",
    tags: ["options", "payoff", "wheel"],
    minutes: 15,
    related: { bot: "wheel", learn: "/learn/bots/wheel" },
  },
  {
    id: "max-drawdown",
    title: "Max drawdown",
    blurb: "The deepest peak-to-trough fall in an equity curve, as a fraction.",
    track: "finance",
    difficulty: "easy",
    tags: ["risk", "drawdown"],
    minutes: 10,
    related: { learn: "/learn#backtest" },
  },
];

const QUANT: Row[] = [
  {
    id: "sharpe-ratio",
    title: "Sharpe ratio, annualised",
    blurb: "Mean excess return over its volatility, scaled to a year of trading days.",
    track: "quant",
    difficulty: "easy",
    tags: ["performance", "risk-adjusted"],
    minutes: 15,
    featured: true,
    related: { bot: "sharpe", learn: "/learn/bots/sharpe" },
  },
  {
    id: "rolling-zscore",
    title: "Rolling z-score",
    blurb: "How many standard deviations is today from its trailing window?",
    track: "quant",
    difficulty: "easy",
    tags: ["statistics", "mean-reversion"],
    minutes: 15,
    related: { bot: "zscore", learn: "/learn/bots/zscore" },
  },
  {
    id: "hurst-exponent",
    title: "Hurst exponent by R/S",
    blurb: "Trend, noise or reversion — estimate H from rescaled ranges.",
    track: "quant",
    difficulty: "hard",
    tags: ["statistics", "regime"],
    minutes: 40,
    related: { bot: "hurst", learn: "/learn/bots/hurst" },
  },
  {
    id: "kalman-price-level",
    title: "Kalman filter for a price level",
    blurb: "Predict, observe, correct — track a noisy price with a single state.",
    track: "quant",
    difficulty: "hard",
    tags: ["filters", "state-space"],
    minutes: 40,
    related: { bot: "kalman", learn: "/learn/bots/kalman" },
  },
  {
    id: "monte-carlo-var",
    title: "Monte Carlo VaR",
    blurb: "Simulate tomorrow ten thousand times and read off the 5th percentile.",
    track: "quant",
    difficulty: "medium",
    tags: ["risk", "simulation"],
    minutes: 25,
    related: { bot: "mc-var", learn: "/learn/bots/mc-var" },
  },
  {
    id: "bollinger-bands",
    title: "Bollinger bands",
    blurb: "A moving average with ±k standard-deviation envelopes around it.",
    track: "quant",
    difficulty: "easy",
    tags: ["indicators", "volatility"],
    minutes: 10,
    related: { bot: "boll", learn: "/learn/bots/boll" },
  },
  {
    id: "mean-reversion-half-life",
    title: "Half-life of mean reversion",
    blurb: "Fit an AR(1) to the spread and convert φ into days-to-halve.",
    track: "quant",
    difficulty: "medium",
    tags: ["statistics", "mean-reversion"],
    minutes: 25,
    related: { bot: "zscore" },
  },
  {
    id: "pairs-cointegration",
    title: "Pairs spread & cointegration",
    blurb: "Hedge ratio by regression, then test the residual for stationarity.",
    track: "quant",
    difficulty: "hard",
    tags: ["statistics", "pairs"],
    minutes: 45,
    lock: "pro",
    related: { bot: "linreg" },
  },
  {
    id: "heston-monte-carlo",
    title: "Heston Monte Carlo pricer",
    blurb: "Stochastic volatility with five parameters — price it by simulation.",
    track: "quant",
    difficulty: "hard",
    tags: ["options", "stochastic-vol", "simulation"],
    minutes: 45,
    lock: "pro",
    related: { bot: "ai-heston", learn: "/learn/bots/ai-heston" },
  },
  {
    id: "linreg-channel",
    title: "Linear-regression channel",
    blurb: "Fit a line through the closes and draw ±σ rails around it.",
    track: "quant",
    difficulty: "medium",
    tags: ["indicators", "regression"],
    minutes: 20,
    related: { bot: "linreg", learn: "/learn/bots/linreg" },
  },
];

const ML: Row[] = [
  {
    id: "triple-barrier-labels",
    title: "Triple-barrier labels",
    blurb: "Label every bar by which barrier is hit first — profit, stop, or time.",
    track: "ml",
    difficulty: "medium",
    tags: ["labelling", "de-prado"],
    minutes: 30,
    featured: true,
    related: { bot: "ai-triple-barrier", learn: "/learn/bots/ai-triple-barrier" },
  },
  {
    id: "purged-embargo-kfold",
    title: "Purged & embargoed K-fold",
    blurb: "Split a time series without letting the future leak into training.",
    track: "ml",
    difficulty: "medium",
    tags: ["cross-validation", "leakage"],
    minutes: 30,
    related: { bot: "ai-direction", learn: "/learn/bots/ai-direction" },
  },
  {
    id: "walk-forward-folds",
    title: "Walk-forward folds",
    blurb: "Expanding-window splits that report a distribution, not a single number.",
    track: "ml",
    difficulty: "medium",
    tags: ["cross-validation", "backtesting"],
    minutes: 25,
    related: { bot: "ai-consensus", learn: "/learn#ai-quants" },
  },
  {
    id: "feature-matrix",
    title: "Feature matrix: RSI, MACD, returns",
    blurb: "Turn raw OHLCV into a clean, aligned feature table.",
    track: "ml",
    difficulty: "easy",
    tags: ["features", "indicators"],
    minutes: 20,
    related: { bot: "rsi-rev", learn: "/learn/bots/rsi-rev" },
  },
  {
    id: "cross-sectional-rank",
    title: "Cross-sectional rank of 34 tickers",
    blurb: "Rank forward returns across names to strip out the market's beta.",
    track: "ml",
    difficulty: "medium",
    tags: ["ranking", "cross-sectional"],
    minutes: 25,
    related: { bot: "ai-magnitude" },
  },
  {
    id: "quantile-signal",
    title: "Quantile outputs → signal",
    blurb: "Long when p10 > 0, short when p90 < 0, flat in between.",
    track: "ml",
    difficulty: "medium",
    tags: ["quantile-regression", "signals"],
    minutes: 20,
    related: { bot: "ai-quantile", learn: "/learn/bots/ai-quantile" },
  },
  {
    id: "regime-split-vix",
    title: "Regime split by VIX median",
    blurb: "Route each day to a high-vol or low-vol model by the 60-day median.",
    track: "ml",
    difficulty: "easy",
    tags: ["regime", "routing"],
    minutes: 15,
    related: { bot: "ai-direction", learn: "/learn#regime" },
  },
  {
    id: "stacking-oof-features",
    title: "Out-of-fold stacking features",
    blurb: "Level-1 predictions become level-2 inputs — without leaking the answer.",
    track: "ml",
    difficulty: "hard",
    tags: ["ensembles", "stacking"],
    minutes: 40,
    lock: "power",
    related: { bot: "ai-consensus", learn: "/learn/bots/ai-consensus" },
  },
  {
    id: "calibrate-probabilities",
    title: "Calibrate classifier probabilities",
    blurb: "Bin the predicted probabilities and measure how honest they are.",
    track: "ml",
    difficulty: "hard",
    tags: ["calibration", "evaluation"],
    minutes: 35,
    lock: "power",
    related: { bot: "ai-direction" },
  },
];

const MATHS: Row[] = [
  {
    id: "normal-cdf",
    title: "Normal CDF, Abramowitz–Stegun",
    blurb: "Φ(x) to six decimals with one polynomial — no libraries.",
    track: "maths",
    difficulty: "easy",
    tags: ["distributions", "approximation"],
    minutes: 15,
    related: { bot: "bs-solver" },
  },
  {
    id: "log-vs-simple-returns",
    title: "Log vs simple returns",
    blurb: "Convert a price path into both, and show where they diverge.",
    track: "maths",
    difficulty: "easy",
    tags: ["returns", "basics"],
    minutes: 10,
  },
  {
    id: "gbm-path",
    title: "GBM path",
    blurb: "Simulate geometric Brownian motion from a drift, a vol and a seed.",
    track: "maths",
    difficulty: "easy",
    tags: ["simulation", "stochastic"],
    minutes: 15,
    related: { bot: "mc-var" },
  },
  {
    id: "cholesky-correlated-shocks",
    title: "Cholesky for correlated shocks",
    blurb: "Decompose a covariance matrix and generate correlated normals.",
    track: "maths",
    difficulty: "hard",
    tags: ["linear-algebra", "simulation"],
    minutes: 40,
    related: { bot: "ai-heston" },
  },
  {
    id: "newton-method-root",
    title: "Newton's method root",
    blurb: "Iterate x − f(x)/f′(x) to tolerance and report the iteration count.",
    track: "maths",
    difficulty: "medium",
    tags: ["numerics", "root-finding"],
    minutes: 20,
    related: { bot: "ai-iv-solver" },
  },
  {
    id: "portfolio-variance",
    title: "Portfolio variance",
    blurb: "wᵀΣw for a weight vector and a covariance matrix.",
    track: "maths",
    difficulty: "easy",
    tags: ["linear-algebra", "risk"],
    minutes: 10,
  },
  {
    id: "barrier-touch-probability",
    title: "Barrier-touch probability",
    blurb: "The chance a GBM path touches a level before expiry.",
    track: "maths",
    difficulty: "hard",
    tags: ["probability", "barriers"],
    minutes: 35,
    lock: "pro",
    related: { learn: "/learn#probability" },
  },
  {
    id: "expected-value-bet",
    title: "Expected value of a bet",
    blurb: "Probabilities times payoffs — and why a positive EV can still ruin you.",
    track: "maths",
    difficulty: "easy",
    tags: ["probability", "basics"],
    minutes: 10,
    related: { bot: "kelly" },
  },
  {
    id: "autocorrelation-lag-k",
    title: "Autocorrelation at lag k",
    blurb: "Does today's return remember yesterday's? Measure it.",
    track: "maths",
    difficulty: "medium",
    tags: ["statistics", "time-series"],
    minutes: 20,
    related: { bot: "hurst" },
  },
];

const TRADING: Row[] = [
  {
    id: "vwap-session",
    title: "VWAP",
    blurb: "Volume-weighted average price, anchored to the session open.",
    track: "trading",
    difficulty: "easy",
    tags: ["execution", "indicators"],
    minutes: 15,
    featured: true,
    related: { learn: "/learn/broken-vwap" },
  },
  {
    id: "kelly-fraction",
    title: "Kelly fraction",
    blurb: "The bet size that maximises long-run growth — and why you halve it.",
    track: "trading",
    difficulty: "easy",
    tags: ["sizing", "kelly"],
    minutes: 15,
    featured: true,
    related: { bot: "kelly", learn: "/learn/bots/kelly" },
  },
  {
    id: "sma-crossover",
    title: "SMA crossover signals",
    blurb: "Fast over slow is long — flag every cross.",
    track: "trading",
    difficulty: "easy",
    tags: ["signals", "trend"],
    minutes: 15,
    related: { bot: "sma-cross", learn: "/learn/bots/sma-cross" },
  },
  {
    id: "donchian-breakout",
    title: "Donchian breakout",
    blurb: "Buy the 20-day high, sell the 20-day low.",
    track: "trading",
    difficulty: "easy",
    tags: ["signals", "breakout"],
    minutes: 15,
    related: { bot: "donchian", learn: "/learn/bots/donchian" },
  },
  {
    id: "position-size-by-stop",
    title: "Position size from stop distance",
    blurb: "Risk a fixed fraction per trade and let the stop set the size.",
    track: "trading",
    difficulty: "easy",
    tags: ["sizing", "risk"],
    minutes: 10,
    related: { bot: "kelly" },
  },
  {
    id: "long-only-backtest-costs",
    title: "Long-only backtest with costs",
    blurb: "Turn signals into equity, then charge commissions and slippage.",
    track: "trading",
    difficulty: "medium",
    tags: ["backtesting", "costs"],
    minutes: 30,
    related: { learn: "/learn#backtest" },
  },
  {
    id: "order-book-micro-price",
    title: "Order-book mid & micro-price",
    blurb: "Mid is the average; micro-price weights it by the other side's size.",
    track: "trading",
    difficulty: "medium",
    tags: ["microstructure", "execution"],
    minutes: 20,
  },
  {
    id: "drawdown-kill-switch",
    title: "Drawdown-aware kill switch",
    blurb: "Halt trading when the day's loss breaches the limit — and stay halted.",
    track: "trading",
    difficulty: "medium",
    tags: ["risk", "safety"],
    minutes: 20,
    related: { learn: "/safety" },
  },
  {
    id: "wheel-cash-flow-ledger",
    title: "Wheel cash-flow ledger",
    blurb: "Sell puts, get assigned, sell calls — book every premium.",
    track: "trading",
    difficulty: "medium",
    tags: ["options", "wheel"],
    minutes: 30,
    related: { bot: "wheel", learn: "/learn/bots/wheel" },
  },
  {
    id: "theta-bleed-to-expiry",
    title: "Theta bleed to expiry",
    blurb: "How an option's value decays day by day, everything else held still.",
    track: "trading",
    difficulty: "medium",
    tags: ["options", "greeks"],
    minutes: 20,
    related: { bot: "bs-solver", learn: "/greeks" },
  },
];

const BY_TRACK: Record<TrackId, Row[]> = {
  finance: FINANCE,
  quant: QUANT,
  ml: ML,
  maths: MATHS,
  trading: TRADING,
};

/** All 48, numbered 1..N in track order. */
export const PROBLEMS: ProblemMeta[] = TRACK_ORDER.flatMap((t) => BY_TRACK[t]).map((row, i) => ({
  ...row,
  num: i + 1,
}));

export const FEATURED: string[] = PROBLEMS.filter((p) => p.featured).map((p) => p.id);

/** A constant, not Date-derived: the list page is prerendered, so a daily
    pick computed at render would mismatch on hydration the day after the
    build. Rotation belongs in a useEffect if it is ever wanted. */
export const DAILY_SLUG = "kelly-fraction";

export function getMeta(slug: string): ProblemMeta | null {
  return PROBLEMS.find((p) => p.id === slug) ?? null;
}

export function problemsByTrack(track: TrackId): ProblemMeta[] {
  return PROBLEMS.filter((p) => p.track === track);
}

/** Previous / next by display number; null at either end. */
export function neighbours(slug: string): { prev: ProblemMeta | null; next: ProblemMeta | null } {
  const i = PROBLEMS.findIndex((p) => p.id === slug);
  if (i < 0) return { prev: null, next: null };
  return { prev: PROBLEMS[i - 1] ?? null, next: PROBLEMS[i + 1] ?? null };
}

export function trackStats(track: TrackId): {
  total: number;
  minutes: number;
  hours: number;
  byDifficulty: Record<Difficulty, number>;
} {
  const rows = problemsByTrack(track);
  const byDifficulty: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  let minutes = 0;
  for (const r of rows) {
    byDifficulty[r.difficulty]++;
    minutes += r.minutes;
  }
  return { total: rows.length, minutes, hours: Math.round((minutes / 60) * 2) / 2, byDifficulty };
}

/** A slug's display title, for callers that only have the slug. */
export function titleFor(slug: string): string {
  return getMeta(slug)?.title ?? slug;
}

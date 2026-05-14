// Deterministic seeded mock data for the admin cockpit. Every shape mirrors
// what the real (eventual) collectors will produce — request rate, latency
// histograms, error counts, paper-trade rows, signup timeline, etc. — so
// when we wire in real Mongo aggregation later, the dashboard stays unchanged.
//
// All randomness goes through `mulberry32` so a given (seed, day) returns the
// same dataset and the dashboard never flickers across renders.

// Local copy of the mulberry32 PRNG so this module is self-contained.
// (lib/candles.ts has its own private copy.)
function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR_MS = 3600_000;
const DAY_MS = 86400_000;

// ─── KPI strip ────────────────────────────────────────────────────────────
export type KpiCell = {
  k: string;
  v: number | string;
  unit?: string;
  delta?: number; // pct change vs previous bucket
  tone?: "bull" | "bear" | "amber" | "fg";
  spark?: number[];
};

export function kpis(seed = Math.floor(Date.now() / HOUR_MS)): KpiCell[] {
  const r = mulberry32(seed);
  const spark = (n = 24, base = 100, vol = 10) =>
    Array.from({ length: n }, (_, i) => base + Math.sin(i / 3 + r() * 6) * vol + r() * vol);
  return [
    { k: "active sessions", v: 1280 + Math.floor(r() * 220), unit: "", delta: +6.4, tone: "bull", spark: spark(24, 1280, 60) },
    { k: "paper trades · 24h", v: 8412 + Math.floor(r() * 600), unit: "", delta: +12.1, tone: "bull", spark: spark(24, 8000, 280) },
    { k: "ai teacher tokens", v: 2.1 + r() * 0.4, unit: "M / 24h", delta: +18.6, tone: "bull", spark: spark(24, 2100000, 80000) },
    { k: "errors · 1h", v: 12 + Math.floor(r() * 6), unit: "", delta: -34.2, tone: "amber", spark: spark(24, 18, 6) },
    { k: "api p99", v: 38 + Math.floor(r() * 8), unit: "ms", delta: -2.3, tone: "fg", spark: spark(24, 40, 8) },
    { k: "kill triggers · 7d", v: 3 + Math.floor(r() * 3), unit: "", delta: 0, tone: "amber", spark: spark(24, 4, 1.5) },
  ];
}

// ─── System health (line chart) ──────────────────────────────────────────
export type HealthSeries = { t: number; rps: number; p99: number; err: number };

export function healthSeries(points = 90, seed = Math.floor(Date.now() / HOUR_MS)): HealthSeries[] {
  const r = mulberry32(seed);
  const now = Math.floor(Date.now() / 60_000) * 60_000;
  const out: HealthSeries[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const t = now - i * 60_000;
    const noise = (r() - 0.5);
    const wave = Math.sin(i / 7) * 0.4 + Math.sin(i / 13) * 0.25;
    const rps = 220 + 40 * wave + 30 * noise;
    const p99 = 36 + 6 * wave + 4 * noise + (r() < 0.04 ? 18 : 0);
    const err = Math.max(0, 0.4 + 0.3 * noise + (r() < 0.06 ? 1.4 : 0));
    out.push({ t, rps: Math.round(rps), p99: Math.round(p99 * 10) / 10, err: Math.round(err * 10) / 10 });
  }
  return out;
}

// ─── Live event stream ───────────────────────────────────────────────────
export type EventRow = {
  id: string;
  t: number;
  level: "info" | "warn" | "err" | "trade" | "auth" | "kill" | "ai";
  who: string; // user-id slug or "system"
  msg: string;
  meta?: string;
};

const EVENT_TEMPLATES: Array<{ level: EventRow["level"]; msg: (sym: string) => string; metaFn?: (r: () => number) => string }> = [
  { level: "trade", msg: (s) => `paper · bull call spread on ${s}`, metaFn: (r) => `+$${(80 + r() * 600).toFixed(0)}` },
  { level: "trade", msg: (s) => `paper · iron condor on ${s}`, metaFn: (r) => `+$${(40 + r() * 240).toFixed(0)}` },
  { level: "trade", msg: (s) => `paper · long call ${s}`, metaFn: (r) => `−$${(20 + r() * 180).toFixed(0)}` },
  { level: "ai", msg: (s) => `teacher explained Δ on ${s}`, metaFn: (r) => `${(80 + r() * 240).toFixed(0)} tokens` },
  { level: "ai", msg: (s) => `teacher explained Θ decay on ${s}`, metaFn: (r) => `${(120 + r() * 280).toFixed(0)} tokens` },
  { level: "info", msg: () => `quant bot · 6-Model Consensus run`, metaFn: (r) => `${(2.4 + r() * 1.2).toFixed(1)}s` },
  { level: "info", msg: (s) => `chain priced for ${s}`, metaFn: () => `0.4ms` },
  { level: "warn", msg: () => `daily loss limit hit · soft warn`, metaFn: (r) => `−$${(220 + r() * 80).toFixed(0)}` },
  { level: "kill", msg: () => `kill switch armed`, metaFn: () => `auto · daily limit` },
  { level: "auth", msg: () => `signup · google oauth` },
  { level: "auth", msg: () => `signin · returning learner` },
  { level: "err", msg: () => `yahoo finance 502 · retry succeeded`, metaFn: (r) => `${(120 + r() * 80).toFixed(0)}ms` },
];

const NAMES = ["maya", "kenji", "ana", "diego", "yuki", "cole", "priya", "joe", "lin", "rohan", "anya", "tess", "ravi", "jude", "noor"];
const SYMBOLS = ["AMZN", "NVDA", "TSLA", "AAPL", "SPY", "QQQ", "MSFT", "META", "GOOGL", "AMD", "PLTR", "COIN"];

export function recentEvents(n = 80, seed = Math.floor(Date.now() / 60_000)): EventRow[] {
  const r = mulberry32(seed);
  const now = Date.now();
  const out: EventRow[] = [];
  for (let i = 0; i < n; i++) {
    const tmpl = EVENT_TEMPLATES[Math.floor(r() * EVENT_TEMPLATES.length)];
    const sym = SYMBOLS[Math.floor(r() * SYMBOLS.length)];
    const who = tmpl.level === "info" || tmpl.level === "kill" ? "system" : NAMES[Math.floor(r() * NAMES.length)] + Math.floor(r() * 99);
    out.push({
      id: `evt_${i}_${seed}`,
      t: now - i * (8_000 + Math.floor(r() * 22_000)),
      level: tmpl.level,
      who,
      msg: tmpl.msg(sym),
      meta: tmpl.metaFn?.(r),
    });
  }
  return out.sort((a, b) => b.t - a.t);
}

// ─── Symbol heatmap (top traded today) ───────────────────────────────────
export type SymbolRow = { sym: string; trades: number; volume: number; iv: number; pnl: number };

export function topSymbols(seed = Math.floor(Date.now() / HOUR_MS)): SymbolRow[] {
  const r = mulberry32(seed);
  return SYMBOLS.map((sym, i) => ({
    sym,
    trades: Math.floor(120 + r() * 1400 - i * 30),
    volume: Math.floor(420_000 + r() * 1_800_000),
    iv: 18 + r() * 32,
    pnl: (r() - 0.5) * 8400,
  })).sort((a, b) => b.trades - a.trades);
}

// ─── Quant bot distribution ──────────────────────────────────────────────
export type BotRunRow = { id: string; label: string; runs: number; pct: number };
const BOTS = [
  "6-Model Consensus", "Black-Scholes Solver", "Hurst Exponent", "Kalman Filter",
  "Monte Carlo VaR", "Z-Score Reversion", "Donchian Breakout", "Bollinger Bands",
  "American Pricer (NN)", "BS Surrogate (NN)", "Wheel Backtest", "Long-Only Backtest",
];

export function topBots(seed = Math.floor(Date.now() / HOUR_MS)): BotRunRow[] {
  const r = mulberry32(seed);
  const rows = BOTS.map((b, i) => ({
    id: b.toLowerCase().replace(/\W+/g, "_"),
    label: b,
    runs: Math.floor(40 + r() * 600 - i * 18),
  }));
  const total = rows.reduce((a, b) => a + b.runs, 0);
  return rows.map((r) => ({ ...r, pct: r.runs / total })).sort((a, b) => b.runs - a.runs);
}

// ─── Recent paper trades (table) ─────────────────────────────────────────
export type TradeRow = {
  id: string;
  t: number;
  user: string;
  sym: string;
  strategy: string;
  legs: number;
  cost: number;
  pnl: number;
  status: "open" | "closed-profit" | "closed-loss" | "killed";
};

const STRATEGIES = ["Bull Call Spread", "Iron Condor", "Long Call", "Bull Put Spread", "Bear Call Spread", "Long Straddle", "Calendar Spread", "Long Put"];

export function recentTrades(n = 18, seed = Math.floor(Date.now() / 60_000)): TradeRow[] {
  const r = mulberry32(seed);
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const status: TradeRow["status"] = r() < 0.55
      ? "open"
      : r() < 0.7 ? "killed" : r() < 0.6 ? "closed-loss" : "closed-profit";
    const cost = (r() < 0.5 ? 1 : -1) * (40 + r() * 480);
    const pnl = (r() - 0.45) * 600;
    return {
      id: `trd_${seed}_${i}`,
      t: now - i * (60_000 + Math.floor(r() * 240_000)),
      user: NAMES[Math.floor(r() * NAMES.length)] + Math.floor(r() * 99),
      sym: SYMBOLS[Math.floor(r() * SYMBOLS.length)],
      strategy: STRATEGIES[Math.floor(r() * STRATEGIES.length)],
      legs: 1 + Math.floor(r() * 4),
      cost: Math.round(cost),
      pnl: Math.round(pnl),
      status,
    };
  });
}

// ─── Signup timeline ─────────────────────────────────────────────────────
export type SignupBucket = { day: number; signups: number; pro: number };

export function signupTimeline(days = 14, seed = Math.floor(Date.now() / DAY_MS)): SignupBucket[] {
  const r = mulberry32(seed);
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  return Array.from({ length: days }, (_, i) => {
    const day = today - (days - 1 - i) * DAY_MS;
    const base = 80 + i * 14 + Math.floor(r() * 60);
    return { day, signups: base, pro: Math.floor(base * (0.04 + r() * 0.06)) };
  });
}

// ─── Geo dots (active sessions by region) ────────────────────────────────
export type GeoDot = { x: number; y: number; intensity: number; city: string; n: number };
const CITIES: Array<[string, number, number]> = [
  ["NYC", 0.28, 0.36],
  ["SF", 0.13, 0.40],
  ["LA", 0.14, 0.45],
  ["LON", 0.50, 0.32],
  ["BER", 0.54, 0.34],
  ["DXB", 0.62, 0.46],
  ["MUM", 0.70, 0.50],
  ["BLR", 0.71, 0.55],
  ["DEL", 0.69, 0.45],
  ["SGP", 0.78, 0.58],
  ["TOK", 0.86, 0.40],
  ["SYD", 0.90, 0.78],
  ["SAO", 0.34, 0.74],
  ["MEX", 0.20, 0.52],
  ["TOR", 0.25, 0.30],
  ["JNB", 0.55, 0.72],
];

export function geoDots(seed = Math.floor(Date.now() / HOUR_MS)): GeoDot[] {
  const r = mulberry32(seed);
  return CITIES.map(([city, x, y]) => {
    const n = Math.floor(20 + r() * 380);
    return { x, y, intensity: Math.min(1, 0.2 + n / 380), city, n };
  });
}

// ─── Top errors (last 24h) ───────────────────────────────────────────────
export type ErrorRow = { name: string; count: number; lastSeen: number; route: string };

export function topErrors(seed = Math.floor(Date.now() / HOUR_MS)): ErrorRow[] {
  const r = mulberry32(seed);
  const rows = [
    { name: "yahoo_chart_502", route: "/api/quote-batch" },
    { name: "openai_rate_limit", route: "/api/explain" },
    { name: "ws_disconnect_burst", route: "ws://chain" },
    { name: "stale_session", route: "/api/auth/session" },
    { name: "fastapi_timeout", route: "/api/quant/run" },
    { name: "mongo_serverSelectionTimeout", route: "lib/mongo" },
  ];
  return rows.map((row, i) => ({
    ...row,
    count: Math.floor(2 + r() * 22 - i * 1.4),
    lastSeen: Date.now() - Math.floor(r() * 5400_000),
  })).sort((a, b) => b.count - a.count);
}

// ─── Pro funnel ──────────────────────────────────────────────────────────
export type FunnelStep = { label: string; count: number };

export function proFunnel(seed = Math.floor(Date.now() / HOUR_MS)): FunnelStep[] {
  const r = mulberry32(seed);
  const start = 14000 + Math.floor(r() * 1200);
  const decay = (n: number, k: number) => Math.floor(n * (k + r() * 0.05));
  const a = start;
  const b = decay(a, 0.46);
  const c = decay(b, 0.55);
  const d = decay(c, 0.34);
  const e = decay(d, 0.42);
  return [
    { label: "Visited /trade", count: a },
    { label: "Built a strategy", count: b },
    { label: "Opened paper trade", count: c },
    { label: "Hit pro paywall", count: d },
    { label: "Upgraded to Pro", count: e },
  ];
}

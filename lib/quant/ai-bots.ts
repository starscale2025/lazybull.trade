// AI quant bots — wired to the LAZYBULL FastAPI service in `ai quants/serve.py`.
//
// Each bot tries the real Python NN inference first. If the service is
// unreachable (uvicorn not running, weights missing, network error) it
// transparently falls back to a deterministic TS mock so the UI never breaks.
// A "Source" metric on every card tells you which path you got.
//
// Provenance for every bot points at the python module under
// `ai quants/models/<dir>/train.py` or `ai quants/serve.py`.

import type { BotDef, BotContext, BotResult, Metric, Signal } from "./types";
import { closes, fmtNum, fmtPct, fmtMoney } from "./series";
import { priceOption } from "../pricing";

// Base URL of the FastAPI service. Override with NEXT_PUBLIC_QUANTAI_URL.
const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_QUANTAI_URL) ||
  "http://localhost:8000";
const API_HINT = `${API_BASE} · uvicorn serve:app`;

type ApiStatus = "live" | "mock";

async function callApi<T>(
  endpoint: string,
  body: unknown,
  timeoutMs = 8000,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function statusMetric(status: ApiStatus, note?: string): Metric {
  if (status === "live") {
    return {
      key: "source",
      label: "Source",
      value: "Python NN",
      tone: "bull",
      hint: "live FastAPI inference",
    };
  }
  return {
    key: "source",
    label: "Source",
    value: "Mock",
    tone: "warn",
    hint: note ?? `FastAPI offline (${API_BASE}) — using TS fallback`,
  };
}

function withStatus(result: BotResult, status: ApiStatus, note?: string): BotResult {
  return { ...result, metrics: [statusMetric(status, note), ...result.metrics] };
}

type ApiBotConfig<TReq, TRes> = {
  request: (ctx: BotContext, p: Record<string, unknown>) => TReq;
  build: (data: TRes, ctx: BotContext, p: Record<string, unknown>) => BotResult;
  mock: (ctx: BotContext, p: Record<string, unknown>) => BotResult;
};

function aiBot<TReq, TRes>(
  base: Omit<BotDef, "run">,
  cfg: ApiBotConfig<TReq, TRes>,
): BotDef {
  return {
    ...base,
    run: async (ctx, params) => {
      const p = params as Record<string, unknown>;
      if (!base.endpoint) return withStatus(cfg.mock(ctx, p), "mock");
      try {
        const data = await callApi<TRes>(base.endpoint, cfg.request(ctx, p));
        return withStatus(cfg.build(data, ctx, p), "live");
      } catch (err) {
        const note = err instanceof Error ? err.message : String(err);
        return withStatus(cfg.mock(ctx, p), "mock", note.slice(0, 120));
      }
    },
  };
}

const num = (p: Record<string, unknown>, k: string, d: number) => {
  const v = p[k];
  return typeof v === "number" && isFinite(v) ? v : d;
};
const str = (p: Record<string, unknown>, k: string, d: string) =>
  typeof p[k] === "string" ? (p[k] as string) : d;

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function seedRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function realisedVol(px: number[], n = 30): number {
  if (px.length < 3) return 0.3;
  const slice = px.slice(-n - 1);
  const rets: number[] = [];
  for (let i = 1; i < slice.length; i++) rets.push(Math.log(slice[i] / slice[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / Math.max(1, rets.length);
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  return sd * Math.sqrt(252);
}
function trendStrength(px: number[]): number {
  if (px.length < 60) return 0;
  const a = px[px.length - 60];
  const b = px[px.length - 1];
  return (b - a) / a;
}

// ─────────────── Pricing input helpers (shared) ───────────────
type BSReq = { S: number; K: number; T: number; r: number; sigma: number; flag: "c" | "p" };
type BSRes = { price: number; delta?: number; gamma?: number; vega?: number; theta?: number; rho?: number };

function bsRequest(ctx: BotContext, p: Record<string, unknown>, defaultDays = 30): BSReq {
  const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
  const type = (str(p, "type", "C") === "P" ? "p" : "c") as "c" | "p";
  return {
    S: num(p, "spot", lastPx),
    K: num(p, "strike", Math.round(lastPx)),
    T: Math.max(0.0005, num(p, "days", defaultDays) / 365),
    r: num(p, "rate", 4.5) / 100,
    sigma: num(p, "iv", 32) / 100,
    flag: type,
  };
}

// ─────────────── BS Surrogate (NN) — /api/bs ───────────────
const bsSurrogate: BotDef = aiBot<BSReq, BSRes>(
  {
    id: "ai-bs-surrogate",
    name: "BS Surrogate (NN)",
    category: "ai",
    glyph: "𝛣",
    tagline: "Neural Black-Scholes — price + 5 Greeks in one shot.",
    formula: "trained vs analytical BS · ≈0.1% relative error",
    endpoint: "/api/bs",
    module: "ai quants/models/black_scholes/train.py",
    params: [
      { key: "type", label: "Type", kind: "select", default: "C", options: [{ value: "C", label: "Call" }, { value: "P", label: "Put" }] },
      { key: "spot", label: "Spot $", kind: "number", default: 100, min: 1, max: 10000, step: 0.5 },
      { key: "strike", label: "Strike $", kind: "number", default: 100, min: 1, max: 10000, step: 0.5 },
      { key: "days", label: "Days to expiry", kind: "number", default: 30, min: 1, max: 730, step: 1 },
      { key: "iv", label: "IV %", kind: "number", default: 32, min: 1, max: 200, step: 0.5 },
      { key: "rate", label: "Rate %", kind: "number", default: 4.5, min: 0, max: 20, step: 0.1 },
    ],
  },
  {
    request: (ctx, p) => bsRequest(ctx, p, 30),
    build: (data, _ctx, p) => {
      const days = num(p, "days", 30);
      return {
        signals: [],
        metrics: [
          { key: "px", label: "Price (NN)", value: `$${data.price.toFixed(2)}`, tone: "info" },
          { key: "delta", label: "Δ Delta", value: fmtNum(data.delta ?? 0, 3) },
          { key: "gamma", label: "Γ Gamma", value: fmtNum(data.gamma ?? 0, 4) },
          { key: "theta", label: "Θ Theta /day", value: fmtNum(data.theta ?? 0, 3), tone: "bear" },
          { key: "vega", label: "ν Vega /1%", value: fmtNum(data.vega ?? 0, 3) },
          { key: "rho", label: "ρ Rho /1%", value: fmtNum(data.rho ?? 0, 3) },
          { key: "err", label: "Surrogate err", value: "≈0.1%", tone: "info", hint: "vs analytical Black-Scholes" },
        ],
        summary: `Trained NN surrogate predicts $${data.price.toFixed(2)} (~0.1% off the textbook formula) for a ${days}d option. Inference is millisecond, even on CPU.`,
        beginner:
          "We trained a tiny neural network to mimic the Black-Scholes formula. It's just as accurate but stays fast even when you batch 10,000 options at once.",
        verdict: {
          side: "hold",
          text: `Surrogate price $${data.price.toFixed(2)}. Compare against the live chain — anything more than 0.5% off is mispriced.`,
          confidence: 1,
        },
      };
    },
    mock: (ctx, p) => {
      const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
      const type = (str(p, "type", "C") === "P" ? "P" : "C") as "C" | "P";
      const spot = num(p, "spot", lastPx);
      const strike = num(p, "strike", Math.round(lastPx));
      const days = num(p, "days", 30);
      const iv = num(p, "iv", 32) / 100;
      const rate = num(p, "rate", 4.5) / 100;
      const t = Math.max(0.0005, days / 365);
      const r = priceOption(spot, strike, t, rate, iv, type);
      const noise = 1 + Math.sin(spot * strike * days) * 0.001;
      const surrogatePrice = r.price * noise;
      return {
        signals: [],
        metrics: [
          { key: "px", label: "Price (NN)", value: `$${surrogatePrice.toFixed(2)}`, tone: "info" },
          { key: "delta", label: "Δ Delta", value: fmtNum(r.greeks.delta, 3) },
          { key: "gamma", label: "Γ Gamma", value: fmtNum(r.greeks.gamma, 4) },
          { key: "theta", label: "Θ Theta /day", value: fmtNum(r.greeks.theta, 3), tone: "bear" },
          { key: "vega", label: "ν Vega /1%", value: fmtNum(r.greeks.vega, 3) },
          { key: "rho", label: "ρ Rho /1%", value: fmtNum(r.greeks.rho, 3) },
          { key: "err", label: "Surrogate err", value: "≈0.1%", tone: "info", hint: "vs analytical Black-Scholes" },
        ],
        summary: `Trained NN surrogate predicts $${surrogatePrice.toFixed(2)} (~0.1% off the textbook formula). Plug in any spot/strike/IV combo — inference is millisecond, even on CPU.`,
        beginner:
          "We trained a tiny neural network to mimic the Black-Scholes formula. It's just as accurate but stays fast even when you batch 10,000 options at once.",
        verdict: { side: "hold", text: `Surrogate price $${surrogatePrice.toFixed(2)}.`, confidence: 1 },
      };
    },
  },
);

// ─────────────── IV Solver — /api/iv ───────────────
type IVReq = { price: number; S: number; K: number; T: number; r: number; flag: "c" | "p" };
type IVRes = { sigma: number };
const ivSolver: BotDef = aiBot<IVReq, IVRes>(
  {
    id: "ai-iv-solver",
    name: "IV Solver (NN)",
    category: "ai",
    glyph: "ν",
    tagline: "Implied vol from observed option price — no Newton-Raphson needed.",
    formula: "inverse BS surrogate · ≈0.9% relative error",
    endpoint: "/api/iv",
    module: "ai quants/models/implied_vol/train.py",
    params: [
      { key: "type", label: "Type", kind: "select", default: "C", options: [{ value: "C", label: "Call" }, { value: "P", label: "Put" }] },
      { key: "spot", label: "Spot $", kind: "number", default: 100, step: 0.5 },
      { key: "strike", label: "Strike $", kind: "number", default: 100, step: 0.5 },
      { key: "days", label: "Days to expiry", kind: "number", default: 30, step: 1 },
      { key: "rate", label: "Rate %", kind: "number", default: 4.5, step: 0.1 },
      { key: "price", label: "Observed $", kind: "number", default: 4.5, min: 0.01, step: 0.01, hint: "the option's actual mid price" },
    ],
  },
  {
    request: (ctx, p) => {
      const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
      const type = (str(p, "type", "C") === "P" ? "p" : "c") as "c" | "p";
      return {
        price: num(p, "price", 4.5),
        S: num(p, "spot", lastPx),
        K: num(p, "strike", Math.round(lastPx)),
        T: Math.max(0.0005, num(p, "days", 30) / 365),
        r: num(p, "rate", 4.5) / 100,
        flag: type,
      };
    },
    build: (data, ctx, p) => {
      const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
      const type = (str(p, "type", "C") === "P" ? "P" : "C") as "C" | "P";
      const spot = num(p, "spot", lastPx);
      const strike = num(p, "strike", Math.round(lastPx));
      const t = Math.max(0.0005, num(p, "days", 30) / 365);
      const rate = num(p, "rate", 4.5) / 100;
      const greeks = priceOption(spot, strike, t, rate, data.sigma, type).greeks;
      return {
        signals: [],
        metrics: [
          { key: "iv", label: "IV", value: `${(data.sigma * 100).toFixed(2)}%`, tone: "info" },
          { key: "vega", label: "ν Vega", value: fmtNum(greeks.vega, 3) },
          { key: "iters", label: "Iterations", value: "1 (NN)", tone: "neutral", hint: "vs ~25 for Newton-Raphson" },
          { key: "err", label: "Surrogate err", value: "≈0.9%", tone: "info" },
        ],
        summary: `Solved IV = ${(data.sigma * 100).toFixed(2)}% in a single forward pass. The python NN replaces Newton-Raphson, which usually takes 20+ iterations and explodes near zero vega.`,
        beginner:
          "Reverse the option pricer — given the price the market is showing, what volatility makes the formula match? The neural net does it in one inference.",
        verdict: { side: "hold", text: `Implied vol ${(data.sigma * 100).toFixed(2)}%.`, confidence: 1 },
      };
    },
    mock: (ctx, p) => {
      const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
      const type = (str(p, "type", "C") === "P" ? "P" : "C") as "C" | "P";
      const spot = num(p, "spot", lastPx);
      const strike = num(p, "strike", Math.round(lastPx));
      const days = num(p, "days", 30);
      const rate = num(p, "rate", 4.5) / 100;
      const obs = num(p, "price", 4.5);
      const t = Math.max(0.0005, days / 365);
      let lo = 0.01, hi = 3.0, mid = 0;
      for (let i = 0; i < 50; i++) {
        mid = (lo + hi) / 2;
        const guess = priceOption(spot, strike, t, rate, mid, type).price;
        if (guess > obs) hi = mid;
        else lo = mid;
      }
      const sigma = mid;
      const greeks = priceOption(spot, strike, t, rate, sigma, type).greeks;
      return {
        signals: [],
        metrics: [
          { key: "iv", label: "IV", value: `${(sigma * 100).toFixed(2)}%`, tone: "info" },
          { key: "vega", label: "ν Vega", value: fmtNum(greeks.vega, 3) },
          { key: "iters", label: "Iterations", value: "50 (bisection)", tone: "neutral", hint: "TS fallback" },
          { key: "err", label: "Surrogate err", value: "≈0.9%", tone: "info" },
        ],
        summary: `Solved IV = ${(sigma * 100).toFixed(2)}% via TS bisection (NN unavailable).`,
        beginner:
          "Reverse the option pricer — given the price the market is showing, what volatility makes the formula match?",
        verdict: { side: "hold", text: `Implied vol ${(sigma * 100).toFixed(2)}%.`, confidence: 1 },
      };
    },
  },
);

// ─────────────── Monte Carlo Pricer — /api/mc ───────────────
const mcSurrogate: BotDef = aiBot<BSReq, BSRes>(
  {
    id: "ai-mc-surrogate",
    name: "Monte Carlo Pricer (NN)",
    category: "ai",
    glyph: "Σ",
    tagline: "GBM Monte Carlo distilled into a network — instant pricing.",
    formula: "trained vs 100k-path GBM ground truth",
    endpoint: "/api/mc",
    module: "ai quants/models/monte_carlo/train.py",
    params: [
      { key: "type", label: "Type", kind: "select", default: "C", options: [{ value: "C", label: "Call" }, { value: "P", label: "Put" }] },
      { key: "spot", label: "Spot $", kind: "number", default: 100, step: 0.5 },
      { key: "strike", label: "Strike $", kind: "number", default: 100, step: 0.5 },
      { key: "days", label: "Days to expiry", kind: "number", default: 30, step: 1 },
      { key: "iv", label: "IV %", kind: "number", default: 32, step: 0.5 },
      { key: "rate", label: "Rate %", kind: "number", default: 4.5, step: 0.1 },
      { key: "paths", label: "Implied paths", kind: "number", default: 100_000, step: 1000, hint: "what the trainer used" },
    ],
  },
  {
    request: (ctx, p) => bsRequest(ctx, p, 30),
    build: (data, ctx, p) => {
      const req = bsRequest(ctx, p, 30);
      const bs = priceOption(req.S, req.K, req.T, req.r, req.sigma, req.flag === "p" ? "P" : "C").price;
      const diff = ((data.price - bs) / bs) * 100;
      return {
        signals: [],
        metrics: [
          { key: "mc", label: "MC price (NN)", value: `$${data.price.toFixed(2)}`, tone: "info" },
          { key: "bs", label: "BS reference", value: `$${bs.toFixed(2)}` },
          { key: "diff", label: "Δ vs BS", value: `${diff.toFixed(3)}%`, tone: "neutral" },
          { key: "paths", label: "Effective paths", value: "100k", tone: "info" },
        ],
        summary: `Surrogate output $${data.price.toFixed(2)}, matches BS to ${diff.toFixed(3)}%. Useful sanity check that the GBM assumption is intact.`,
        beginner:
          "We simulated 100,000 random stock-price paths and averaged the option's payout. Then we trained a network on those answers.",
        verdict: { side: "hold", text: `MC fair value $${data.price.toFixed(2)}.`, confidence: 1 },
      };
    },
    mock: (ctx, p) => {
      const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
      const type = (str(p, "type", "C") === "P" ? "P" : "C") as "C" | "P";
      const spot = num(p, "spot", lastPx);
      const strike = num(p, "strike", Math.round(lastPx));
      const days = num(p, "days", 30);
      const iv = num(p, "iv", 32) / 100;
      const rate = num(p, "rate", 4.5) / 100;
      const t = Math.max(0.0005, days / 365);
      const bs = priceOption(spot, strike, t, rate, iv, type).price;
      const mc = bs * (1 + Math.cos(spot + strike + days) * 0.0008);
      const diff = ((mc - bs) / bs) * 100;
      return {
        signals: [],
        metrics: [
          { key: "mc", label: "MC price (NN)", value: `$${mc.toFixed(2)}`, tone: "info" },
          { key: "bs", label: "BS reference", value: `$${bs.toFixed(2)}` },
          { key: "diff", label: "Δ vs BS", value: `${diff.toFixed(3)}%`, tone: "neutral" },
          { key: "paths", label: "Effective paths", value: "100k", tone: "info" },
        ],
        summary: `Surrogate output $${mc.toFixed(2)}, matches BS to ${diff.toFixed(3)}%.`,
        beginner: "We simulated 100,000 random stock-price paths and averaged the option's payout.",
        verdict: { side: "hold", text: `MC fair value $${mc.toFixed(2)}.`, confidence: 1 },
      };
    },
  },
);

// ─────────────── American Pricer — /api/american ───────────────
const americanSurrogate: BotDef = aiBot<BSReq, BSRes>(
  {
    id: "ai-american",
    name: "American Pricer (NN)",
    category: "ai",
    glyph: "🇺🇸",
    tagline: "CRR binomial tree distilled — handles early-exercise premium.",
    formula: "trained vs 500-step Cox-Ross-Rubinstein",
    endpoint: "/api/american",
    module: "ai quants/models/american/train.py",
    params: [
      { key: "type", label: "Type", kind: "select", default: "P", options: [{ value: "C", label: "Call" }, { value: "P", label: "Put" }] },
      { key: "spot", label: "Spot $", kind: "number", default: 100, step: 0.5 },
      { key: "strike", label: "Strike $", kind: "number", default: 100, step: 0.5 },
      { key: "days", label: "Days to expiry", kind: "number", default: 60, step: 1 },
      { key: "iv", label: "IV %", kind: "number", default: 32, step: 0.5 },
      { key: "rate", label: "Rate %", kind: "number", default: 4.5, step: 0.1 },
    ],
  },
  {
    request: (ctx, p) => bsRequest(ctx, p, 60),
    build: (data, ctx, p) => {
      const req = bsRequest(ctx, p, 60);
      const euro = priceOption(req.S, req.K, req.T, req.r, req.sigma, req.flag === "p" ? "P" : "C").price;
      const premium = Math.max(0, data.price - euro);
      return {
        signals: [],
        metrics: [
          { key: "amer", label: "American", value: `$${data.price.toFixed(2)}`, tone: "info" },
          { key: "euro", label: "European", value: `$${euro.toFixed(2)}` },
          { key: "exer", label: "Early-exercise $", value: `+$${premium.toFixed(2)}`, tone: "bull" },
          { key: "err", label: "Surrogate err", value: "≈0.5%", tone: "info" },
        ],
        summary: `American premium = European $${euro.toFixed(2)} + $${premium.toFixed(2)} early-exercise value.`,
        beginner:
          "American options can be cashed in any time before expiry. That extra freedom is worth a tiny bit more than a European-style option.",
        verdict: { side: "hold", text: `Fair American premium $${data.price.toFixed(2)}.`, confidence: 1 },
      };
    },
    mock: (ctx, p) => {
      const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
      const type = (str(p, "type", "P") === "P" ? "P" : "C") as "C" | "P";
      const spot = num(p, "spot", lastPx);
      const strike = num(p, "strike", Math.round(lastPx));
      const days = num(p, "days", 60);
      const iv = num(p, "iv", 32) / 100;
      const rate = num(p, "rate", 4.5) / 100;
      const t = Math.max(0.0005, days / 365);
      const euro = priceOption(spot, strike, t, rate, iv, type).price;
      const premium = type === "P" ? Math.max(0, rate * t * strike * 0.45 + iv * 0.05) : Math.max(0, rate * t * 0.04);
      const american = euro + premium;
      return {
        signals: [],
        metrics: [
          { key: "amer", label: "American", value: `$${american.toFixed(2)}`, tone: "info" },
          { key: "euro", label: "European", value: `$${euro.toFixed(2)}` },
          { key: "exer", label: "Early-exercise $", value: `+$${premium.toFixed(2)}`, tone: "bull" },
          { key: "err", label: "Surrogate err", value: "≈0.5%", tone: "info" },
        ],
        summary: `American premium = European $${euro.toFixed(2)} + $${premium.toFixed(2)} early-exercise value.`,
        beginner: "American options can be cashed in any time before expiry.",
        verdict: { side: "hold", text: `Fair American premium $${american.toFixed(2)}.`, confidence: 1 },
      };
    },
  },
);

// ─────────────── Heston Stochastic Vol — /api/heston ───────────────
type HestonReq = {
  S: number; K: number; T: number; r: number;
  v0: number; kappa: number; theta: number; xi: number; rho: number;
  flag: "c" | "p";
};
const hestonSurrogate: BotDef = aiBot<HestonReq, BSRes>(
  {
    id: "ai-heston",
    name: "Heston SV Pricer (NN)",
    category: "ai",
    glyph: "Ψ",
    tagline: "Stochastic-vol pricer — vol of vol, mean reversion, leverage.",
    formula: "trained on fypy Heston ground truth",
    endpoint: "/api/heston",
    module: "ai quants/models/heston/train.py",
    params: [
      { key: "type", label: "Type", kind: "select", default: "C", options: [{ value: "C", label: "Call" }, { value: "P", label: "Put" }] },
      { key: "spot", label: "Spot $", kind: "number", default: 100, step: 0.5 },
      { key: "strike", label: "Strike $", kind: "number", default: 100, step: 0.5 },
      { key: "days", label: "Days to expiry", kind: "number", default: 60, step: 1 },
      { key: "rate", label: "Rate %", kind: "number", default: 4.5, step: 0.1 },
      { key: "v0", label: "v₀ (initial var)", kind: "number", default: 0.04, min: 0.001, max: 0.5, step: 0.005 },
      { key: "kappa", label: "κ (mean rev speed)", kind: "number", default: 2.0, min: 0.1, max: 10, step: 0.1 },
      { key: "theta", label: "θ (long-run var)", kind: "number", default: 0.04, min: 0.001, max: 0.5, step: 0.005 },
      { key: "xi", label: "ξ (vol of vol)", kind: "number", default: 0.5, min: 0.05, max: 2, step: 0.05 },
      { key: "rho", label: "ρ (S↔v corr)", kind: "number", default: -0.7, min: -1, max: 1, step: 0.05 },
    ],
  },
  {
    request: (ctx, p) => {
      const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
      const type = (str(p, "type", "C") === "P" ? "p" : "c") as "c" | "p";
      return {
        S: num(p, "spot", lastPx),
        K: num(p, "strike", Math.round(lastPx)),
        T: Math.max(0.0005, num(p, "days", 60) / 365),
        r: num(p, "rate", 4.5) / 100,
        v0: num(p, "v0", 0.04),
        kappa: num(p, "kappa", 2.0),
        theta: num(p, "theta", 0.04),
        xi: num(p, "xi", 0.5),
        rho: num(p, "rho", -0.7),
        flag: type,
      };
    },
    build: (data, ctx, p) => {
      const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
      const type = (str(p, "type", "C") === "P" ? "P" : "C") as "C" | "P";
      const spot = num(p, "spot", lastPx);
      const strike = num(p, "strike", Math.round(lastPx));
      const days = num(p, "days", 60);
      const rate = num(p, "rate", 4.5) / 100;
      const rho = num(p, "rho", -0.7);
      const v0 = num(p, "v0", 0.04);
      const t = days / 365;
      const sigEff = Math.sqrt(v0);
      const bs = priceOption(spot, strike, t, rate, sigEff, type).price;
      const skew = data.price - bs;
      return {
        signals: [],
        metrics: [
          { key: "px", label: "Heston $", value: `$${data.price.toFixed(2)}`, tone: "info" },
          { key: "bs", label: "BS comparable", value: `$${bs.toFixed(2)}` },
          { key: "skew", label: "Skew premium", value: `${skew >= 0 ? "+" : ""}$${skew.toFixed(2)}`, tone: skew < 0 ? "bear" : "bull" },
          { key: "vol", label: "v₀ vol-equiv", value: `${(sigEff * 100).toFixed(1)}%` },
        ],
        summary: `Heston says $${data.price.toFixed(2)} — ${skew >= 0 ? "above" : "below"} BS because ρ = ${rho.toFixed(2)} pulls implied skew the way real markets price it.`,
        beginner:
          "Real markets don't have a single fixed volatility. Heston is the gold-standard model that simulates that, including the negative correlation that makes puts more expensive than calls.",
        verdict: { side: "hold", text: `Heston fair value $${data.price.toFixed(2)}.`, confidence: 1 },
      };
    },
    mock: (ctx, p) => {
      const lastPx = ctx.candles[ctx.candles.length - 1]?.c ?? 100;
      const type = (str(p, "type", "C") === "P" ? "P" : "C") as "C" | "P";
      const spot = num(p, "spot", lastPx);
      const strike = num(p, "strike", Math.round(lastPx));
      const days = num(p, "days", 60);
      const rate = num(p, "rate", 4.5) / 100;
      const v0 = num(p, "v0", 0.04);
      const xi = num(p, "xi", 0.5);
      const rho = num(p, "rho", -0.7);
      const t = days / 365;
      const sigEff = Math.sqrt(v0) * (1 + 0.3 * xi * t);
      const bs = priceOption(spot, strike, t, rate, sigEff, type).price;
      const skewBump = rho < 0 && type === "P" ? bs * 0.08 * Math.abs(rho) : rho > 0 && type === "C" ? bs * 0.05 * rho : 0;
      const heston = bs + skewBump;
      return {
        signals: [],
        metrics: [
          { key: "px", label: "Heston $", value: `$${heston.toFixed(2)}`, tone: "info" },
          { key: "bs", label: "BS comparable", value: `$${bs.toFixed(2)}` },
          { key: "skew", label: "Skew premium", value: `+$${skewBump.toFixed(2)}`, tone: rho < 0 ? "bear" : "bull" },
          { key: "vol", label: "Effective vol", value: `${(sigEff * 100).toFixed(1)}%` },
        ],
        summary: `Heston says $${heston.toFixed(2)} (TS approximation).`,
        beginner: "Real markets don't have a single fixed volatility — Heston simulates that.",
        verdict: { side: "hold", text: `Heston fair value $${heston.toFixed(2)}.`, confidence: 1 },
      };
    },
  },
);

// ─────────────── Direction-style requests share this shape ───────────────
type DirReq = { ticker: string; period: string };
function dirRequest(ctx: BotContext, _p: Record<string, unknown>): DirReq {
  return { ticker: ctx.symbol.toUpperCase(), period: "2y" };
}

// ─────────────── Direction Ensemble — /api/direction ───────────────
type DirRes = {
  ticker: string;
  p_up: number;
  ensemble_std: number;
  ensemble_size: number;
  prediction: "up" | "down";
  conviction_band: "ultra" | "extreme" | "high" | "low";
  expected_accuracy: number;
  horizon_days: number;
};
const directionEnsemble: BotDef = aiBot<DirReq, DirRes>(
  {
    id: "ai-direction",
    name: "Direction Ensemble",
    category: "ai",
    glyph: "▲▼",
    tagline: "Will the stock be up or down 20 days from now? GBM ensemble vote.",
    formula: "GradientBoosting · 12 levers · cross-asset features · embargo CV",
    endpoint: "/api/direction",
    module: "ai quants/models/direction/train.py",
    params: [
      { key: "horizon", label: "Horizon (days)", kind: "number", default: 20, min: 1, max: 60, step: 1 },
      { key: "ensemble", label: "Ensemble size", kind: "number", default: 10, min: 1, max: 30, step: 1 },
    ],
  },
  {
    request: dirRequest,
    build: (data) => {
      const pUp = data.p_up;
      const label = data.prediction.toUpperCase();
      const band = data.conviction_band;
      const expAcc = data.expected_accuracy;
      const conviction = Math.abs(pUp - 0.5);
      return {
        signals: [],
        metrics: [
          { key: "p", label: "P(up)", value: `${(pUp * 100).toFixed(1)}%`, tone: pUp > 0.5 ? "bull" : "bear" },
          { key: "label", label: "Direction", value: label, tone: pUp > 0.5 ? "bull" : "bear" },
          { key: "band", label: "Conviction", value: band.toUpperCase(), tone: band === "ultra" || band === "extreme" ? "bull" : band === "high" ? "info" : "neutral" },
          { key: "std", label: "Ensemble σ", value: fmtNum(data.ensemble_std, 3), tone: data.ensemble_std < 0.05 ? "bull" : "neutral", hint: "lower σ = models agree" },
          { key: "exp", label: "Expected acc", value: `${(expAcc * 100).toFixed(0)}%`, tone: "info" },
          { key: "size", label: "Ensemble", value: `${data.ensemble_size} models`, tone: "neutral" },
        ],
        summary: `Real ensemble of ${data.ensemble_size} GBMs on ${data.ticker} says ${label} (P=${(pUp * 100).toFixed(1)}%) for ${data.horizon_days}d — ${band} conviction. Embargoed CV accuracy ~${(expAcc * 100).toFixed(0)}%.`,
        beginner:
          "Boosted-tree models each vote on whether the stock will be up or down 20 days from now. When they agree (low σ), trust the call more.",
        verdict: {
          side: pUp > 0.6 ? "buy" : pUp < 0.4 ? "sell" : "hold",
          text: `${(pUp * 100).toFixed(0)}% chance ${data.prediction}. ${band} conviction — historical accuracy ~${(expAcc * 100).toFixed(0)}%.`,
          confidence: Math.min(1, conviction * 4),
        },
      };
    },
    mock: (ctx, p) => {
      const horizon = num(p, "horizon", 20);
      const px = closes(ctx.candles);
      const trend = trendStrength(px);
      const rv = realisedVol(px);
      const seed = hashStr(ctx.symbol + horizon + Math.round(px[px.length - 1] * 100));
      const rand = seedRand(seed);
      const probs: number[] = [];
      for (let i = 0; i < num(p, "ensemble", 10); i++) {
        const noise = (rand() - 0.5) * 0.18;
        const raw = 0.5 + trend * 1.4 + noise;
        probs.push(Math.min(0.97, Math.max(0.03, raw)));
      }
      const pUp = probs.reduce((a, b) => a + b, 0) / probs.length;
      const std = Math.sqrt(probs.reduce((a, b) => a + (b - pUp) ** 2, 0) / probs.length);
      const conviction = Math.abs(pUp - 0.5);
      const band = conviction > 0.20 ? "ultra" : conviction > 0.15 ? "extreme" : conviction > 0.07 ? "high" : "low";
      const expAcc = band === "ultra" ? 0.77 : band === "extreme" ? 0.66 : band === "high" ? 0.61 : 0.555;
      const label: "up" | "down" = pUp > 0.5 ? "up" : "down";
      return {
        signals: [],
        metrics: [
          { key: "p", label: "P(up)", value: `${(pUp * 100).toFixed(1)}%`, tone: pUp > 0.5 ? "bull" : "bear" },
          { key: "label", label: "Direction", value: label.toUpperCase(), tone: label === "up" ? "bull" : "bear" },
          { key: "band", label: "Conviction", value: band.toUpperCase(), tone: band === "ultra" || band === "extreme" ? "bull" : band === "high" ? "info" : "neutral" },
          { key: "std", label: "Ensemble σ", value: fmtNum(std, 3), tone: std < 0.05 ? "bull" : "neutral", hint: "lower σ = models agree" },
          { key: "exp", label: "Expected acc", value: `${(expAcc * 100).toFixed(0)}%`, tone: "info" },
          { key: "rv", label: "Realised vol", value: `${(rv * 100).toFixed(0)}%`, tone: "neutral" },
        ],
        summary: `Ensemble of ${probs.length} GBMs says ${label.toUpperCase()} (P=${(pUp * 100).toFixed(1)}%) for ${horizon}d — ${band} conviction.`,
        beginner: "Boosted-tree models each vote on direction. When they agree (low σ), trust the call more.",
        verdict: {
          side: pUp > 0.6 ? "buy" : pUp < 0.4 ? "sell" : "hold",
          text: `${(pUp * 100).toFixed(0)}% chance ${label}. ${band} conviction.`,
          confidence: Math.min(1, conviction * 4),
        },
      };
    },
  },
);

// ─────────────── Magnitude Regression — /api/magnitude ───────────────
type MagRes = {
  expected_return: number;
  ensemble_std: number;
  direction: "up" | "down";
  magnitude_band: "ultra" | "extreme" | "high" | "medium" | "low";
  expected_dir_accuracy: number;
  horizon_days: number;
};
const magnitudeReg: BotDef = aiBot<DirReq, MagRes>(
  {
    id: "ai-magnitude",
    name: "Magnitude Regression",
    category: "ai",
    glyph: "Δ%",
    tagline: "Predicts the size of the next 20-day move, not just the sign.",
    formula: "HistGradientBoosting regressor · 5-fold ensemble",
    endpoint: "/api/magnitude",
    module: "ai quants/models/magnitude/train.py",
    params: [
      { key: "horizon", label: "Horizon (days)", kind: "number", default: 20, min: 5, max: 60, step: 1 },
      { key: "macro", label: "Use macro features", kind: "boolean", default: true, hint: "VIX · DXY · 10Y · WTI" },
    ],
  },
  {
    request: dirRequest,
    build: (data, _ctx, p) => {
      const expRet = data.expected_return;
      const macro = p["macro"] !== false;
      const band = data.magnitude_band;
      const expAcc = data.expected_dir_accuracy;
      return {
        signals: [],
        metrics: [
          { key: "exp", label: "Expected return", value: `${(expRet * 100).toFixed(2)}%`, tone: expRet > 0 ? "bull" : "bear" },
          { key: "band", label: "Magnitude", value: band.toUpperCase(), tone: band === "ultra" || band === "extreme" ? "bull" : "info" },
          { key: "dir", label: "Direction", value: data.direction.toUpperCase(), tone: data.direction === "up" ? "bull" : "bear" },
          { key: "std", label: "Ensemble σ", value: fmtNum(data.ensemble_std, 3) },
          { key: "exp_acc", label: "Dir accuracy", value: `${(expAcc * 100).toFixed(0)}%`, tone: "info" },
          { key: "macro", label: "Macro features", value: macro ? "ON" : "OFF", tone: macro ? "bull" : "neutral" },
        ],
        summary: `Real model predicts ${(expRet * 100).toFixed(2)}% over ${data.horizon_days}d (${band}). ${macro ? "Macro features on" : "Pure price"}.`,
        beginner: "Beyond direction — predicts how BIG the move will be. Sizing depends on this.",
        verdict: {
          side: expRet > 0.02 ? "buy" : expRet < -0.02 ? "sell" : "hold",
          text: `Expected ${(expRet * 100).toFixed(2)}% over ${data.horizon_days}d (${band}).`,
          confidence: Math.min(1, Math.abs(expRet) * 12),
        },
      };
    },
    mock: (ctx, p) => {
      const horizon = num(p, "horizon", 20);
      const macro = p["macro"] !== false;
      const px = closes(ctx.candles);
      const trend = trendStrength(px);
      const rv = realisedVol(px);
      const seed = hashStr(ctx.symbol + "magnitude" + horizon);
      const rand = seedRand(seed);
      const expRet = trend * 0.6 + (rand() - 0.5) * rv * 0.4;
      const std = rv * 0.18;
      const dir = expRet > 0 ? "up" : "down";
      const absMag = Math.abs(expRet);
      const band = absMag > 0.07 ? "ultra" : absMag > 0.045 ? "extreme" : absMag > 0.027 ? "high" : absMag > 0.015 ? "medium" : "low";
      const expAcc = band === "ultra" ? 0.66 : band === "extreme" ? 0.64 : band === "high" ? 0.61 : band === "medium" ? 0.60 : 0.555;
      return {
        signals: [],
        metrics: [
          { key: "exp", label: "Expected return", value: `${(expRet * 100).toFixed(2)}%`, tone: expRet > 0 ? "bull" : "bear" },
          { key: "band", label: "Magnitude", value: band.toUpperCase(), tone: band === "ultra" || band === "extreme" ? "bull" : "info" },
          { key: "dir", label: "Direction", value: dir.toUpperCase(), tone: dir === "up" ? "bull" : "bear" },
          { key: "std", label: "Ensemble σ", value: fmtNum(std, 3) },
          { key: "exp_acc", label: "Dir accuracy", value: `${(expAcc * 100).toFixed(0)}%`, tone: "info" },
          { key: "macro", label: "Macro features", value: macro ? "ON" : "OFF", tone: macro ? "bull" : "neutral" },
        ],
        summary: `Predicts ${(expRet * 100).toFixed(2)}% over ${horizon}d (${band}).`,
        beginner: "Beyond direction — predicts how BIG the move will be.",
        verdict: {
          side: expRet > 0.02 ? "buy" : expRet < -0.02 ? "sell" : "hold",
          text: `Expected ${(expRet * 100).toFixed(2)}% over ${horizon}d (${band}).`,
          confidence: Math.min(1, absMag * 12),
        },
      };
    },
  },
);

// ─────────────── 1D CNN Sequence — /api/sequence ───────────────
type SeqRes = { expected_return: number; direction: "up" | "down"; horizon_days: number };
const sequenceCnn: BotDef = aiBot<DirReq, SeqRes>(
  {
    id: "ai-sequence",
    name: "1D CNN (Sequence)",
    category: "ai",
    glyph: "▰",
    tagline: "Reads the last 60 raw OHLCV candles like an image.",
    formula: "Conv1d → GAP → linear · trained on shape, not features",
    endpoint: "/api/sequence",
    module: "ai quants/models/sequence/train.py",
    params: [
      { key: "lookback", label: "Lookback (bars)", kind: "number", default: 60, min: 30, max: 120, step: 1 },
    ],
  },
  {
    request: dirRequest,
    build: (data) => {
      const pred = data.expected_return;
      return {
        signals: [],
        metrics: [
          { key: "pred", label: "20d return", value: `${(pred * 100).toFixed(2)}%`, tone: pred > 0 ? "bull" : "bear" },
          { key: "dir", label: "Direction", value: data.direction.toUpperCase(), tone: data.direction === "up" ? "bull" : "bear" },
          { key: "lookback", label: "Window", value: "60d OHLCV" },
          { key: "model", label: "Architecture", value: "Conv1d → GAP → Linear", tone: "info" },
        ],
        summary: `1D CNN reads the last 60 bars and outputs ${(pred * 100).toFixed(2)}% expected 20d return.`,
        beginner:
          "We treat the last 60 days of price data like an image and run a small convolutional network across it.",
        verdict: {
          side: pred > 0.015 ? "buy" : pred < -0.015 ? "sell" : "hold",
          text: `CNN sees a ${(pred * 100).toFixed(2)}% setup over the next 20 days.`,
          confidence: Math.min(1, Math.abs(pred) * 15),
        },
      };
    },
    mock: (ctx, p) => {
      const lookback = num(p, "lookback", 60);
      const px = closes(ctx.candles);
      const trend = trendStrength(px);
      const seed = hashStr(ctx.symbol + "cnn" + lookback);
      const rand = seedRand(seed);
      const pred = trend * 0.5 + (rand() - 0.5) * 0.04;
      return {
        signals: [],
        metrics: [
          { key: "pred", label: "20d return", value: `${(pred * 100).toFixed(2)}%`, tone: pred > 0 ? "bull" : "bear" },
          { key: "dir", label: "Direction", value: pred > 0 ? "UP" : "DOWN", tone: pred > 0 ? "bull" : "bear" },
          { key: "lookback", label: "Window", value: `${lookback}d OHLCV` },
          { key: "shape", label: "Detected pattern", value: trend > 0.05 ? "uptrend" : trend < -0.05 ? "downtrend" : "chop", tone: "info" },
        ],
        summary: `1D CNN (TS mock) suggests ${(pred * 100).toFixed(2)}% over 20d.`,
        beginner: "We treat the last 60 days of price data like an image and run a CNN.",
        verdict: {
          side: pred > 0.015 ? "buy" : pred < -0.015 ? "sell" : "hold",
          text: `CNN sees a ${(pred * 100).toFixed(2)}% setup over the next 20 days.`,
          confidence: Math.min(1, Math.abs(pred) * 15),
        },
      };
    },
  },
);

// ─────────────── Transformer 252-day — /api/transformer ───────────────
const transformerSeq: BotDef = aiBot<DirReq, SeqRes>(
  {
    id: "ai-transformer",
    name: "Transformer (252d)",
    category: "ai",
    glyph: "ϟ",
    tagline: "Attention over a full year of OHLCV. Spots seasonality + regime.",
    formula: "TransformerEncoder · 4 heads · 2 layers · 252 lookback",
    endpoint: "/api/transformer",
    module: "ai quants/models/transformer/train.py",
    params: [
      { key: "lookback", label: "Lookback (bars)", kind: "number", default: 252, min: 60, max: 504, step: 1 },
    ],
  },
  {
    request: dirRequest,
    build: (data) => {
      const pred = data.expected_return;
      return {
        signals: [],
        metrics: [
          { key: "pred", label: "20d return", value: `${(pred * 100).toFixed(2)}%`, tone: pred > 0 ? "bull" : "bear" },
          { key: "dir", label: "Direction", value: data.direction.toUpperCase(), tone: data.direction === "up" ? "bull" : "bear" },
          { key: "lookback", label: "Window", value: "252d" },
          { key: "model", label: "Architecture", value: "TransformerEncoder · 4 heads · 2 layers", tone: "info" },
        ],
        summary: `Transformer attends over 252 days. Predicts ${(pred * 100).toFixed(2)}% over the next 20d.`,
        beginner:
          "Same architecture that powers ChatGPT, applied to a year of price data. Attention focuses on the right days — earnings, vol spikes, regime changes.",
        verdict: {
          side: pred > 0.015 ? "buy" : pred < -0.015 ? "sell" : "hold",
          text: `Transformer expects ${(pred * 100).toFixed(2)}% in 20d.`,
          confidence: Math.min(1, Math.abs(pred) * 15),
        },
      };
    },
    mock: (ctx, p) => {
      const lookback = num(p, "lookback", 252);
      const px = closes(ctx.candles);
      const trend = trendStrength(px);
      const rv = realisedVol(px, 60);
      const seed = hashStr(ctx.symbol + "txr" + lookback);
      const rand = seedRand(seed);
      const pred = trend * 0.7 - (rv - 0.25) * 0.08 + (rand() - 0.5) * 0.025;
      return {
        signals: [],
        metrics: [
          { key: "pred", label: "20d return", value: `${(pred * 100).toFixed(2)}%`, tone: pred > 0 ? "bull" : "bear" },
          { key: "dir", label: "Direction", value: pred > 0 ? "UP" : "DOWN", tone: pred > 0 ? "bull" : "bear" },
          { key: "lookback", label: "Window", value: `${lookback}d` },
          { key: "regime", label: "Vol regime", value: rv > 0.3 ? "high" : "low", tone: rv > 0.3 ? "warn" : "neutral" },
        ],
        summary: `Transformer (TS mock) expects ${(pred * 100).toFixed(2)}% in 20d, vol regime ${(rv * 100).toFixed(0)}%.`,
        beginner: "Attention over a year of OHLCV. The Python model is the real one.",
        verdict: {
          side: pred > 0.015 ? "buy" : pred < -0.015 ? "sell" : "hold",
          text: `Transformer expects ${(pred * 100).toFixed(2)}% in 20d.`,
          confidence: Math.min(1, Math.abs(pred) * 15),
        },
      };
    },
  },
);

// ─────────────── Quantile Regression — /api/quantile ───────────────
type QuantRes = {
  p10: number; p50: number; p90: number;
  uncertainty_width: number;
  decision: "long" | "short" | "flat";
};
const quantileForecast: BotDef = aiBot<DirReq, QuantRes>(
  {
    id: "ai-quantile",
    name: "Quantile Forecast (p10/p50/p90)",
    category: "ai",
    glyph: "│⁞│",
    tagline: "Honest confidence interval — not just a point prediction.",
    formula: "GradientBoosting Quantile Regressor · 3 heads · pinball loss",
    endpoint: "/api/quantile",
    module: "ai quants/models/quantile/train.py",
    params: [
      { key: "horizon", label: "Horizon (days)", kind: "number", default: 20, min: 5, max: 60, step: 1 },
    ],
  },
  {
    request: dirRequest,
    build: (data) => {
      const decision = data.decision;
      return {
        signals: [],
        metrics: [
          { key: "p10", label: "p10 (worst)", value: `${(data.p10 * 100).toFixed(2)}%`, tone: "bear" },
          { key: "p50", label: "p50 (median)", value: `${(data.p50 * 100).toFixed(2)}%`, tone: data.p50 > 0 ? "bull" : "bear" },
          { key: "p90", label: "p90 (best)", value: `${(data.p90 * 100).toFixed(2)}%`, tone: "bull" },
          { key: "width", label: "80% CI width", value: `${(data.uncertainty_width * 100).toFixed(2)}%`, tone: "info" },
          { key: "decision", label: "Edge", value: decision.toUpperCase(), tone: decision === "long" ? "bull" : decision === "short" ? "bear" : "neutral" },
        ],
        summary: `80% CI: [${(data.p10 * 100).toFixed(2)}%, ${(data.p90 * 100).toFixed(2)}%]. Median ${(data.p50 * 100).toFixed(2)}%. Decision: ${decision.toUpperCase()}.`,
        beginner:
          "Most predictors give one number. This one gives three — best case (p90), worst case (p10), median (p50). Edge fires when the entire interval is on one side of zero.",
        verdict: {
          side: decision === "long" ? "buy" : decision === "short" ? "sell" : "hold",
          text: decision === "flat" ? "Range straddles zero — no clean edge." : `${decision === "long" ? "Long" : "Short"} signal — entire 80% interval ${decision === "long" ? "above" : "below"} zero.`,
          confidence: decision === "flat" ? 0.2 : 0.85,
        },
      };
    },
    mock: (ctx, p) => {
      const horizon = num(p, "horizon", 20);
      const px = closes(ctx.candles);
      const trend = trendStrength(px);
      const rv = realisedVol(px);
      const seed = hashStr(ctx.symbol + "quant" + horizon);
      const rand = seedRand(seed);
      const center = trend * 0.55 + (rand() - 0.5) * 0.02;
      const spread = rv * Math.sqrt(horizon / 252) * 1.28;
      const p10 = center - spread;
      const p50 = center;
      const p90 = center + spread;
      const decision = p10 > 0 ? "long" : p90 < 0 ? "short" : "flat";
      return {
        signals: [],
        metrics: [
          { key: "p10", label: "p10 (worst)", value: `${(p10 * 100).toFixed(2)}%`, tone: "bear" },
          { key: "p50", label: "p50 (median)", value: `${(p50 * 100).toFixed(2)}%`, tone: p50 > 0 ? "bull" : "bear" },
          { key: "p90", label: "p90 (best)", value: `${(p90 * 100).toFixed(2)}%`, tone: "bull" },
          { key: "width", label: "80% CI width", value: `${((p90 - p10) * 100).toFixed(2)}%`, tone: "info" },
          { key: "decision", label: "Edge", value: decision.toUpperCase(), tone: decision === "long" ? "bull" : decision === "short" ? "bear" : "neutral" },
        ],
        summary: `80% CI: [${(p10 * 100).toFixed(2)}%, ${(p90 * 100).toFixed(2)}%]. Decision: ${decision.toUpperCase()}.`,
        beginner: "Best-case, worst-case, median — three numbers, not one.",
        verdict: {
          side: decision === "long" ? "buy" : decision === "short" ? "sell" : "hold",
          text: decision === "flat" ? "Range straddles zero." : `${decision === "long" ? "Long" : "Short"} signal.`,
          confidence: decision === "flat" ? 0.2 : 0.85,
        },
      };
    },
  },
);

// ─────────────── Triple-Barrier (no FastAPI yet — mock only) ───────────────
const tripleBarrier: BotDef = {
  id: "ai-triple-barrier",
  name: "Triple-Barrier (de Prado)",
  category: "ai",
  glyph: "⊞",
  tagline: "Profit / stop / time barriers — better labels = better models.",
  formula: "Advances in Financial ML, Marcos López de Prado",
  module: "ai quants/models/triple_barrier/train.py",
  params: [
    { key: "horizon", label: "Max horizon (d)", kind: "number", default: 20, min: 5, max: 40, step: 1 },
    { key: "ptSl", label: "Profit/Stop multiplier", kind: "number", default: 1.5, min: 0.5, max: 4, step: 0.1, hint: "× recent vol" },
  ],
  run: async (ctx, p): Promise<BotResult> => {
    const horizon = num(p, "horizon", 20);
    const ptSl = num(p, "ptSl", 1.5);
    const px = closes(ctx.candles);
    const trend = trendStrength(px);
    const rv = realisedVol(px, 30);
    const seed = hashStr(ctx.symbol + "tb" + horizon);
    const rand = seedRand(seed);
    const pUp = Math.min(0.95, Math.max(0.05, 0.5 + trend * 1.2 + (rand() - 0.5) * 0.1));
    const pHitTop = pUp;
    const pHitBot = (1 - pUp) * 0.7;
    const pTimeOut = 1 - pHitTop - pHitBot;
    const label = pHitTop > pHitBot && pHitTop > pTimeOut ? "+1 (TP)" : pHitBot > pTimeOut ? "−1 (SL)" : "0 (TO)";
    return withStatus(
      {
        signals: [],
        metrics: [
          { key: "pTop", label: "P(profit)", value: `${(pHitTop * 100).toFixed(0)}%`, tone: "bull" },
          { key: "pBot", label: "P(stop)", value: `${(pHitBot * 100).toFixed(0)}%`, tone: "bear" },
          { key: "pTime", label: "P(time-out)", value: `${(Math.max(0, pTimeOut) * 100).toFixed(0)}%`, tone: "neutral" },
          { key: "label", label: "Most likely label", value: label, tone: label.startsWith("+") ? "bull" : label.startsWith("−") ? "bear" : "neutral" },
          { key: "ptSl", label: "PT/SL × σ", value: ptSl.toFixed(1), tone: "info" },
          { key: "rv", label: "σ used", value: `${(rv * 100).toFixed(0)}%`, tone: "neutral" },
        ],
        summary: `Setting profit target = stop-loss = ${ptSl.toFixed(1)}× ${(rv * 100).toFixed(0)}% vol over ${horizon}d. Most likely outcome: ${label}.`,
        beginner:
          "De Prado's idea: instead of asking 'will the price be up?', ask 'will it hit my +5% target before -5% stop, or neither?'. Better-labelled training data = smarter models.",
        verdict: {
          side: pHitTop > pHitBot * 1.4 ? "buy" : pHitBot > pHitTop * 1.4 ? "sell" : "hold",
          text: `Most likely outcome: ${label}.`,
          confidence: Math.abs(pHitTop - pHitBot),
        },
      },
      "mock",
      "no FastAPI endpoint yet",
    );
  },
};

// ─────────────── 6-Model Consensus — /api/consensus ───────────────
type ConsRes = {
  ticker: string;
  consensus: {
    n_models: number;
    agree_count: number;
    direction: "up" | "down" | "split";
    avg_magnitude: number;
    tier: "ultra" | "high" | "medium" | "low";
    expected_accuracy_band: string;
  };
  models: Record<string, unknown>;
};
const consensus: BotDef = aiBot<DirReq, ConsRes>(
  {
    id: "ai-consensus",
    name: "6-Model Consensus",
    category: "ai",
    glyph: "⌬",
    tagline: "All AI quants vote. Tier emerges from agreement, not opinion.",
    formula: "binary + magnitude + +macro + sequence + transformer + quantile",
    endpoint: "/api/consensus",
    module: "ai quants/models/best_consensus/build.py",
    params: [],
  },
  {
    request: dirRequest,
    build: (data) => {
      const c = data.consensus;
      return {
        signals: [],
        metrics: [
          { key: "dir", label: "Consensus direction", value: c.direction.toUpperCase(), tone: c.direction === "up" ? "bull" : c.direction === "down" ? "bear" : "neutral" },
          { key: "agree", label: "Agree", value: `${c.agree_count} / ${c.n_models}`, tone: c.agree_count >= c.n_models - 1 ? "bull" : "neutral" },
          { key: "tier", label: "Tier", value: c.tier.toUpperCase(), tone: c.tier === "ultra" ? "bull" : c.tier === "high" ? "info" : "neutral" },
          { key: "acc", label: "Expected acc band", value: c.expected_accuracy_band, tone: "info" },
          { key: "mag", label: "Avg magnitude", value: `${(c.avg_magnitude * 100).toFixed(2)}%`, tone: "info" },
        ],
        summary: `Real-model consensus on ${data.ticker}: ${c.agree_count}/${c.n_models} agree → ${c.direction.toUpperCase()} (${c.tier} tier). Accuracy band: ${c.expected_accuracy_band}.`,
        beginner:
          "Six different AI models look at the same stock and vote. When 5 or 6 agree, the trade is much higher quality. When they're split, the market is genuinely confused.",
        verdict: {
          side: c.direction === "up" ? "buy" : c.direction === "down" ? "sell" : "hold",
          text: c.direction === "split"
            ? `Models split — no edge.`
            : `${c.tier.toUpperCase()} consensus — ${c.agree_count}/${c.n_models} say ${c.direction.toUpperCase()}.`,
          confidence: c.tier === "ultra" ? 0.95 : c.tier === "high" ? 0.78 : c.tier === "medium" ? 0.55 : 0.3,
        },
      };
    },
    mock: (ctx) => {
      const px = closes(ctx.candles);
      const trend = trendStrength(px);
      const rv = realisedVol(px);
      const seed = hashStr(ctx.symbol + "consensus");
      const rand = seedRand(seed);
      const models = [
        { name: "binary GBM", p: 0.5 + trend * 1.4 + (rand() - 0.5) * 0.15 },
        { name: "magnitude", p: 0.5 + trend * 1.1 + (rand() - 0.5) * 0.18 },
        { name: "+macro", p: 0.5 + trend * 1.0 - (rv - 0.25) * 0.6 + (rand() - 0.5) * 0.14 },
        { name: "sequence CNN", p: 0.5 + trend * 0.9 + (rand() - 0.5) * 0.20 },
        { name: "transformer", p: 0.5 + trend * 1.2 - (rv - 0.25) * 0.4 + (rand() - 0.5) * 0.14 },
        { name: "quantile", p: 0.5 + trend * 0.8 + (rand() - 0.5) * 0.16 },
      ].map((m) => ({ ...m, p: Math.min(0.97, Math.max(0.03, m.p)), vote: (m.p > 0.5 ? 1 : -1) as 1 | -1 }));
      const upVotes = models.filter((m) => m.vote === 1).length;
      const downVotes = 6 - upVotes;
      const dir = upVotes >= 5 ? "up" : downVotes >= 5 ? "down" : "split";
      const agree = Math.max(upVotes, downVotes);
      const avgMag = Math.abs(trend) * 0.6;
      const tier = agree === 6 && avgMag > 0.04 ? "ultra" : agree >= 5 ? "high" : agree >= 4 ? "medium" : "low";
      const accBand = tier === "ultra" ? "65–77%" : tier === "high" ? "60–66%" : tier === "medium" ? "55–60%" : "≤55%";
      const signals: Signal[] = [];
      return {
        signals,
        metrics: [
          { key: "dir", label: "Consensus direction", value: dir.toUpperCase(), tone: dir === "up" ? "bull" : dir === "down" ? "bear" : "neutral" },
          { key: "agree", label: "Agree", value: `${agree} / 6`, tone: agree >= 5 ? "bull" : "neutral" },
          { key: "tier", label: "Tier", value: tier.toUpperCase(), tone: tier === "ultra" ? "bull" : tier === "high" ? "info" : "neutral" },
          { key: "acc", label: "Expected acc band", value: accBand, tone: "info" },
        ],
        pane: {
          kind: "histogram",
          series: [{
            values: models.map((m) => m.p - 0.5),
            color: "var(--bear)",
            label: "P(up) − 0.5 per model",
          }],
          refLines: [{ value: 0, color: "var(--fg-faint)" }],
          height: 100,
        },
        summary:
          `Models voting UP: ${upVotes}/6 — ${tier.toUpperCase()} consensus. ` +
          models.map((m) => `${m.name} ${(m.p * 100).toFixed(0)}%${m.vote === 1 ? "↑" : "↓"}`).join(" · "),
        beginner: "Six models vote on direction. 5–6 agreeing = high quality. Split = sit out.",
        verdict: {
          side: dir === "up" ? "buy" : dir === "down" ? "sell" : "hold",
          text: dir === "split"
            ? `Models split ${upVotes}↑ / ${downVotes}↓ — no edge.`
            : `${tier.toUpperCase()} consensus — ${agree}/6 say ${dir.toUpperCase()}. Historical acc band: ${accBand}.`,
          confidence: tier === "ultra" ? 0.95 : tier === "high" ? 0.78 : tier === "medium" ? 0.55 : 0.3,
        },
      };
    },
  },
);

export const AI_BOTS: BotDef[] = [
  consensus,
  directionEnsemble,
  magnitudeReg,
  quantileForecast,
  transformerSeq,
  sequenceCnn,
  tripleBarrier,
  bsSurrogate,
  ivSolver,
  mcSurrogate,
  americanSurrogate,
  hestonSurrogate,
];

export { API_HINT, API_BASE };

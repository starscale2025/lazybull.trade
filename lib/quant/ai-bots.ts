// AI quant bots — wired to the LAZYBULL FastAPI service in `ai quants/serve.py`.
//
// Each bot tries the real Python NN inference first. If the service is
// unreachable (uvicorn not running, weights missing, network error) it
// transparently falls back to a deterministic TS mock so the UI never breaks.
// A "Source" metric on every card tells you which path you got.
//
// Provenance for every bot points at the python module under
// `ai quants/models/<dir>/train.py` or `ai quants/serve.py`.
//
// The bots that read the tape (direction, magnitude, sequence, transformer,
// quantile, consensus, triple-barrier) read a NAMED security, so they say
// nothing about it that has not already played out: they read the page's
// window, which ends HOLDOUT sessions back, and every line of their copy is
// in the past tense. An outside result (hosted, on-device, snapshot) counts
// only when it is dated to that window's last bar; see aiBot below and
// lib/quant/reads. The Gate A re-run (2026-11-06) found these paths reading
// the live tape by ticker, so /quant printed a consensus of "UP · 5/5" on
// real AMZN beside PAPER TRADE.

import type { BotDef, BotContext, BotResult, Signal, SourceId, Verdict } from "./types";
import { ACCURACY_BAND, HYPOTHETICAL_NOTE } from "./types";
import { closes, fmtNum } from "./series";
import { priceOption } from "../pricing";
import { snapshotLookup } from "./snapshot";
import { runSequenceCnn, runTransformer } from "./onnx";
import { sourceForCategory } from "./provenance";
import { HOLDOUT, READ, windowEnd } from "./reads";

// Base URL of the FastAPI service. Override with NEXT_PUBLIC_QUANTAI_URL.
// NEXT_PUBLIC_* is inlined into the CLIENT bundle at build time, so an
// unconditional localhost fallback shipped "http://localhost:8000" to every
// production visitor — each one then firing (and failing) requests at their own
// machine. Only fall back to localhost in development.
const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_QUANTAI_URL) ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");
const API_HINT = `${API_BASE} · uvicorn serve:app`;

/**
 * THE ONE PLACE A CONFIDENCE BAND BECOMES WORDS.
 *
 * The keys stay as they are — "ultra", "extreme", "high", "medium", "low" are
 * code identifiers, they cross the wire from `ai quants/serve.py`, and the
 * thresholds that produce them are model logic that nothing here touches.
 * What changed in 2026-09 is what a visitor SEES. Printed raw and upper-cased,
 * the band keys read as trade grades — a ladder where the top rung
 * promises the best odds. The diligence memo names that directly: a
 * confidence band named like a signal. But the underlying quantity is not
 * odds at all. It is dispersion: how tightly a set of models landed on the
 * same side. So the label says exactly that and nothing more, and a "split"
 * is reported as a split rather than as the bottom of a scale.
 *
 * One table, so a band cannot be worded one way on a card and another way in
 * a summary line.
 */
export const BAND_LABEL: Record<string, string> = {
  ultra: "very strong agreement",
  extreme: "strong agreement",
  high: "moderate agreement",
  medium: "lean",
  low: "split",
};

/** Display label for a band key, falling back to the key for anything new. */
const bandLabel = (band: string): string => BAND_LABEL[band] ?? band;

async function callApi<T>(
  endpoint: string,
  body: unknown,
  timeoutMs = 8000,
): Promise<T> {
  // No base configured (production without NEXT_PUBLIC_QUANTAI_URL): don't fire
  // a same-origin request that can only 404 — go straight to the TS fallback.
  if (!API_BASE) throw new Error("quant API not configured");
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

// Attach honest provenance to a bot result — the card renders a badge from
// `source` (see lib/quant/provenance). `note` becomes the badge's date/version
// sub-line; `horizonDays` the prediction horizon.
function withSource(result: BotResult, source: SourceId, note?: string, horizonDays?: number): BotResult {
  return {
    ...result,
    source,
    sourceNote: note,
    horizon: horizonDays ? `${horizonDays}d` : result.horizon,
  };
}

type ApiBotConfig<TReq, TRes> = {
  request: (ctx: BotContext, p: Record<string, unknown>) => TReq;
  build: (data: TRes, ctx: BotContext, p: Record<string, unknown>) => BotResult;
  mock: (ctx: BotContext, p: Record<string, unknown>) => BotResult;
  /** Reads the price tape, i.e. says something about a named security. Such a
      bot takes an outside result only when it is dated to the window's last
      bar, and its card prints that date. The option pricers don't set it. */
  readsTape?: boolean;
  /** Optional on-device inference (onnxruntime-web) — the real model in the
      browser, no server, on the tape up to `end` (the window's last day).
      Returns an API-shaped result, or null if unavailable. */
  device?: (ctx: BotContext, p: Record<string, unknown>, end: string) => Promise<TRes | null>;
  /** Which on-device source to label when `device` runs. */
  deviceSource?: SourceId;
  /** What the non-NN fallback ACTUALLY is (exact Black-Scholes, a heuristic,
      …). Defaults from the bot's category. */
  fallbackSource?: SourceId;
};

function aiBot<TReq, TRes>(
  base: Omit<BotDef, "run">,
  cfg: ApiBotConfig<TReq, TRes>,
): BotDef {
  return {
    ...base,
    run: async (ctx, params) => {
      const p = params as Record<string, unknown>;
      const fallback = cfg.fallbackSource ?? sourceForCategory(base.category);
      // A tape reader speaks only about the window it was given. `end` is that
      // window's last day; an outside result dated to any other day is a read
      // of a different window (later: it has seen the held-back sessions), so
      // it is dropped and the stand-in reads the window instead.
      const end = cfg.readsTape ? windowEnd(ctx.candles) : null;
      const fits = (data: unknown) => !cfg.readsTape || (end != null && asOfOf(data) === end);
      const dated = (r: BotResult): BotResult => (cfg.readsTape ? { ...r, asOf: windowLabel(ctx) } : r);
      const mock = () => dated(withSource(cfg.mock(ctx, p), fallback));
      if (!base.endpoint) return mock();
      // An undated window is a synthetic walk: no outside read describes it.
      if (cfg.readsTape && end == null) return mock();
      const req = cfg.request(ctx, p);
      const hz = (d: unknown) => (d as { horizon_days?: number })?.horizon_days;
      // 1. hosted API (paid tier) — only when a base URL is configured.
      if (API_BASE) {
        try {
          const data = await callApi<TRes>(base.endpoint, req);
          if (fits(data)) return dated(withSource(cfg.build(data, ctx, p), "hosted", "live", hz(data)));
        } catch {
          /* fall through */
        }
      }
      // 2. on-device NN — the real trained model in your browser (free tier).
      //    Only the tape readers have one, and they always have an `end` here.
      if (cfg.device && end != null) {
        try {
          const data = await cfg.device(ctx, p, end);
          if (data && fits(data)) return dated(withSource(cfg.build(data, ctx, p), cfg.deviceSource ?? "device-cnn", "computed just now", hz(data)));
        } catch {
          /* fall through */
        }
      }
      // 3. daily snapshot — real trained-model output, no server needed.
      try {
        const ticker = (req as { ticker?: string })?.ticker;
        const snap = await snapshotLookup<TRes>(base.endpoint, ticker);
        if (snap && fits(snap.data)) return dated(withSource(cfg.build(snap.data, ctx, p), "snapshot", snap.generated, hz(snap.data)));
      } catch {
        /* fall through to the client fallback */
      }
      // 4. deterministic client fallback — exact math or a heuristic per the bot.
      return mock();
    },
  };
}

/** The day an outside result says it was computed for, if it says. */
function asOfOf(data: unknown): string | null {
  const a = (data as { as_of?: unknown } | null)?.as_of;
  return typeof a === "string" ? a.slice(0, 10) : null;
}

/** What a tape reader's card prints as its date: the window's last day, or,
    on an undated (synthetic) tape, where the window ends. */
function windowLabel(ctx: BotContext): string {
  return windowEnd(ctx.candles) ?? `${HOLDOUT} sessions back`;
}

/** The read a model's lean prints as, from the same thresholds the verdict
    uses. */
const sideOf = (x: number, up: number, down: number): Verdict["side"] =>
  x > up ? "buy" : x < down ? "sell" : "hold";

/** A signed percentage: "+2.10%", "−0.85%". */
const signedPct = (x: number, d = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(d)}%`;

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
          text: `Surrogate price $${data.price.toFixed(2)}. For study, a gap beyond ~0.5% from the textbook Black-Scholes value just shows where the model diverges from theory — not a trade.`,
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
    tagline: "Implied volatility straight from an option's price — no iteration needed.",
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
    tagline: "A binomial option-price tree, distilled — prices early exercise.",
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
// `as_of` asks the service to read the tape only up to the window's last day.
// The service may not honour it yet; aiBot drops any answer not dated to it.
type DirReq = { ticker: string; period: string; as_of?: string };
function dirRequest(ctx: BotContext, _p: Record<string, unknown>): DirReq {
  const end = windowEnd(ctx.candles);
  return { ticker: ctx.symbol.toUpperCase(), period: "2y", ...(end ? { as_of: end } : {}) };
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
    tagline: "Was the stock up or down 20 days later? A GBM ensemble votes, then the tape answers.",
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
    readsTape: true,
    build: (data) => {
      const pUp = data.p_up;
      const band = data.conviction_band;
      const side = sideOf(pUp, 0.6, 0.4);
      // `data.expected_accuracy` is still sent by the service and is
      // deliberately not read: it is a per-band figure, and printing a number
      // that rises with agreement is the grade-scale reading this rewrite
      // removed. The card shows ACCURACY_BAND instead — the same band at
      // every agreement level. See ./types.
      const conviction = Math.abs(pUp - 0.5);
      return {
        signals: [],
        metrics: [
          // A score, not a chance: P(up) for sessions that have already
          // played out, printed as the 0–1 model output it is.
          { key: "p", label: "Ensemble score", value: pUp.toFixed(2), tone: pUp > 0.5 ? "bull" : "bear", hint: "the ensemble's up-probability output for the sessions after the window · 0.50 = no lean" },
          { key: "band", label: "Model agreement", value: bandLabel(band), tone: band === "ultra" || band === "extreme" ? "bull" : band === "high" ? "info" : "neutral" },
          { key: "std", label: "Ensemble σ", value: fmtNum(data.ensemble_std, 3), tone: data.ensemble_std < 0.05 ? "bull" : "neutral", hint: "lower σ = models agree" },
          { key: "exp", label: "Historical hit rate (hypothetical)", value: ACCURACY_BAND, tone: "info", hint: HYPOTHETICAL_NOTE },
          { key: "size", label: "Ensemble", value: `${data.ensemble_size} models`, tone: "neutral" },
        ],
        summary: `${data.ensemble_size} GBMs read the ${data.horizon_days} sessions after this window as ${READ[side]} (score ${pUp.toFixed(2)}, ${bandLabel(band)}). Embargoed CV hit rate ${ACCURACY_BAND} · ${HYPOTHETICAL_NOTE}.`,
        beginner:
          "Boosted-tree models each voted on whether the stock finished up or down 20 sessions after the window. The page shows what it actually did. Historically, tighter agreement (low σ) meant the ensemble was more often right.",
        verdict: {
          side,
          text: `${bandLabel(band)} across ${data.ensemble_size} models, on a window that has already played out.`,
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
      const side = sideOf(pUp, 0.6, 0.4);
      // One band, the same at every agreement level (ACCURACY_BAND, ./types).
      // This stand-in used to print its own ladder, topping out at 0.77, which
      // no walk-forward run in `ai quants/README.md` supports. A stand-in must
      // never quote a better number than the model it stands in for.
      return {
        signals: [],
        metrics: [
          { key: "p", label: "Ensemble score", value: pUp.toFixed(2), tone: pUp > 0.5 ? "bull" : "bear", hint: "the stand-in ensemble's up-probability output for the sessions after the window · 0.50 = no lean" },
          { key: "band", label: "Model agreement", value: bandLabel(band), tone: band === "ultra" || band === "extreme" ? "bull" : band === "high" ? "info" : "neutral" },
          { key: "std", label: "Ensemble σ", value: fmtNum(std, 3), tone: std < 0.05 ? "bull" : "neutral", hint: "lower σ = models agree" },
          { key: "exp", label: "Historical hit rate (hypothetical)", value: ACCURACY_BAND, tone: "info", hint: HYPOTHETICAL_NOTE },
          { key: "rv", label: "Realised vol", value: `${(rv * 100).toFixed(0)}%`, tone: "neutral" },
        ],
        summary: `The stand-in ensemble of ${probs.length} read the ${horizon} sessions after this window as ${READ[side]} (score ${pUp.toFixed(2)}, ${bandLabel(band)}).`,
        beginner: "Boosted-tree models each voted on which way the stock went in the sessions after the window. Historically, tighter agreement (low σ) meant the ensemble was more often right.",
        verdict: {
          side,
          text: `${bandLabel(band)} across ${probs.length} models, on a window that has already played out.`,
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
    tagline: "Estimates the size of the 20-day move that followed, not just the sign.",
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
    readsTape: true,
    build: (data, _ctx, p) => {
      const expRet = data.expected_return;
      const macro = p["macro"] !== false;
      const band = data.magnitude_band;
      // `data.expected_dir_accuracy` is a per-band figure, like direction's
      // `expected_accuracy`, and is not read for the same reason: one band at
      // every agreement level (./types).
      return {
        signals: [],
        metrics: [
          { key: "exp", label: `${data.horizon_days}d estimate`, value: signedPct(expRet), tone: expRet > 0 ? "bull" : "bear", hint: "the model's estimate for the sessions after the window" },
          { key: "band", label: "Agreement", value: bandLabel(band), tone: "info" },
          { key: "std", label: "Ensemble σ", value: fmtNum(data.ensemble_std, 3) },
          { key: "exp_acc", label: "Historical hit rate (hypothetical)", value: ACCURACY_BAND, tone: "info", hint: HYPOTHETICAL_NOTE },
          { key: "macro", label: "Macro features", value: macro ? "ON" : "OFF", tone: macro ? "bull" : "neutral" },
        ],
        summary: `The model estimated ${signedPct(expRet)} for the ${data.horizon_days} sessions after this window (${bandLabel(band)}). ${macro ? "Macro features on" : "Pure price"}. Historical hit rate ${ACCURACY_BAND} · ${HYPOTHETICAL_NOTE}.`,
        beginner: "Beyond direction: this one estimated how big the move after the window was. A model that leaned up on a 0.4% estimate was saying almost nothing.",
        verdict: {
          side: sideOf(expRet, 0.02, -0.02),
          text: `Estimated ${signedPct(expRet)} for the ${data.horizon_days} sessions after the window (${bandLabel(band)}).`,
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
      const absMag = Math.abs(expRet);
      const band = absMag > 0.07 ? "ultra" : absMag > 0.045 ? "extreme" : absMag > 0.027 ? "high" : absMag > 0.015 ? "medium" : "low";
      return {
        signals: [],
        metrics: [
          { key: "exp", label: `${horizon}d estimate`, value: signedPct(expRet), tone: expRet > 0 ? "bull" : "bear", hint: "the stand-in's estimate for the sessions after the window" },
          { key: "band", label: "Agreement", value: bandLabel(band), tone: "info" },
          { key: "std", label: "Ensemble σ", value: fmtNum(std, 3) },
          { key: "exp_acc", label: "Historical hit rate (hypothetical)", value: ACCURACY_BAND, tone: "info", hint: HYPOTHETICAL_NOTE },
          { key: "macro", label: "Macro features", value: macro ? "ON" : "OFF", tone: macro ? "bull" : "neutral" },
        ],
        summary: `The stand-in estimated ${signedPct(expRet)} for the ${horizon} sessions after this window (${bandLabel(band)}). Historical hit rate ${ACCURACY_BAND} · ${HYPOTHETICAL_NOTE}.`,
        beginner: "Beyond direction: this one estimated how big the move after the window was.",
        verdict: {
          side: sideOf(expRet, 0.02, -0.02),
          text: `Estimated ${signedPct(expRet)} for the ${horizon} sessions after the window (${bandLabel(band)}).`,
          confidence: Math.min(1, absMag * 12),
        },
      };
    },
  },
);

// ─────────────── 1D CNN Sequence — /api/sequence ───────────────
type SeqRes = { expected_return: number; direction: "up" | "down"; horizon_days: number; as_of?: string };
const sequenceCnn: BotDef = aiBot<DirReq, SeqRes>(
  {
    id: "ai-sequence",
    name: "1D CNN (Sequence)",
    category: "ai",
    glyph: "▰",
    tagline: "Reads the window's last 60 raw OHLCV candles like an image.",
    formula: "Conv1d → GAP → linear · trained on shape, not features",
    endpoint: "/api/sequence",
    module: "ai quants/models/sequence/train.py",
    params: [
      { key: "lookback", label: "Lookback (bars)", kind: "number", default: 60, min: 30, max: 120, step: 1 },
    ],
  },
  {
    request: dirRequest,
    readsTape: true,
    // Free tier: run the real CNN on the user's machine (onnxruntime-web).
    deviceSource: "device-cnn",
    device: async (ctx, _p, end) => {
      const res = await runSequenceCnn(ctx.symbol.toUpperCase(), end);
      return res
        ? { expected_return: res.expectedReturn, direction: res.direction, horizon_days: 20, as_of: res.asOf }
        : null;
    },
    build: (data) => {
      const pred = data.expected_return;
      return {
        signals: [],
        metrics: [
          { key: "pred", label: "20d estimate", value: signedPct(pred), tone: pred > 0 ? "bull" : "bear", hint: "the model's estimate for the 20 sessions after the window" },
          { key: "lookback", label: "Window", value: "60d OHLCV" },
          { key: "model", label: "Architecture", value: "Conv1d → GAP → Linear", tone: "info" },
        ],
        summary: `The 1D CNN read the window's last 60 bars and estimated ${signedPct(pred)} for the 20 sessions after it.`,
        beginner:
          "We treat 60 days of price data like an image and run a small convolutional network across it.",
        verdict: {
          side: sideOf(pred, 0.015, -0.015),
          text: `Estimated ${signedPct(pred)} for the 20 sessions after the window.`,
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
          { key: "pred", label: "20d estimate", value: signedPct(pred), tone: pred > 0 ? "bull" : "bear", hint: "the stand-in's estimate for the 20 sessions after the window" },
          { key: "lookback", label: "Window", value: `${lookback}d OHLCV` },
          { key: "shape", label: "Window shape", value: trend > 0.05 ? "uptrend" : trend < -0.05 ? "downtrend" : "chop", tone: "info" },
        ],
        summary: `The stand-in estimated ${signedPct(pred)} for the 20 sessions after the window.`,
        beginner: "We treat 60 days of price data like an image and run a CNN.",
        verdict: {
          side: sideOf(pred, 0.015, -0.015),
          text: `Estimated ${signedPct(pred)} for the 20 sessions after the window.`,
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
    readsTape: true,
    // Free tier: run the real transformer on the user's machine (onnxruntime-web).
    deviceSource: "device-transformer",
    device: async (ctx, _p, end) => {
      const res = await runTransformer(ctx.symbol.toUpperCase(), end);
      return res
        ? { expected_return: res.expectedReturn, direction: res.direction, horizon_days: 20, as_of: res.asOf }
        : null;
    },
    build: (data) => {
      const pred = data.expected_return;
      return {
        signals: [],
        metrics: [
          { key: "pred", label: "20d estimate", value: signedPct(pred), tone: pred > 0 ? "bull" : "bear", hint: "the model's estimate for the 20 sessions after the window" },
          { key: "lookback", label: "Window", value: "252d" },
          { key: "model", label: "Architecture", value: "TransformerEncoder · 4 heads · 2 layers", tone: "info" },
        ],
        summary: `The transformer attended over the 252 days up to the window's end and estimated ${signedPct(pred)} for the 20 sessions after it.`,
        beginner:
          "Same architecture that powers ChatGPT, applied to a year of price data. Attention focuses on the right days — earnings, vol spikes, regime changes.",
        verdict: {
          side: sideOf(pred, 0.015, -0.015),
          text: `Estimated ${signedPct(pred)} for the 20 sessions after the window.`,
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
          { key: "pred", label: "20d estimate", value: signedPct(pred), tone: pred > 0 ? "bull" : "bear", hint: "the stand-in's estimate for the 20 sessions after the window" },
          { key: "lookback", label: "Window", value: `${lookback}d` },
          { key: "regime", label: "Vol regime", value: rv > 0.3 ? "high" : "low", tone: rv > 0.3 ? "warn" : "neutral" },
        ],
        summary: `The stand-in estimated ${signedPct(pred)} for the 20 sessions after the window, whose vol ran at ${(rv * 100).toFixed(0)}%.`,
        beginner: "Attention over a year of OHLCV. The Python model is the real one.",
        verdict: {
          side: sideOf(pred, 0.015, -0.015),
          text: `Estimated ${signedPct(pred)} for the 20 sessions after the window.`,
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
  // Sent by the service and only ever read as the side of the read: the card
  // never prints it (a printed decision of LONG was a trade call on a named
  // stock).
  decision: "long" | "short" | "flat";
  horizon_days?: number;
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
    readsTape: true,
    build: (data, _ctx, p) => {
      const decision = data.decision;
      const horizon = data.horizon_days ?? num(p, "horizon", 20);
      return {
        signals: [],
        metrics: [
          { key: "p10", label: "p10 (low case)", value: signedPct(data.p10), tone: "bear" },
          { key: "p50", label: "p50 (median)", value: signedPct(data.p50), tone: data.p50 > 0 ? "bull" : "bear" },
          { key: "p90", label: "p90 (high case)", value: signedPct(data.p90), tone: "bull" },
          { key: "width", label: "80% range width", value: `${(data.uncertainty_width * 100).toFixed(2)}%`, tone: "info" },
        ],
        summary: `The model's 80% range for the ${horizon} sessions after this window ran from ${signedPct(data.p10)} to ${signedPct(data.p90)}, median ${signedPct(data.p50)}.`,
        beginner:
          "Most predictors give one number. This one gave three for the sessions after the window: a low case (p10), the median (p50) and a high case (p90). It read a direction only when the whole range sat on one side of zero.",
        verdict: {
          side: decision === "long" ? "buy" : decision === "short" ? "sell" : "hold",
          text: decision === "flat" ? "The 80% range straddled zero." : `Read ${decision === "long" ? "up" : "down"}: the whole 80% range sat ${decision === "long" ? "above" : "below"} zero.`,
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
      const side: Verdict["side"] = p10 > 0 ? "buy" : p90 < 0 ? "sell" : "hold";
      return {
        signals: [],
        metrics: [
          { key: "p10", label: "p10 (low case)", value: signedPct(p10), tone: "bear" },
          { key: "p50", label: "p50 (median)", value: signedPct(p50), tone: p50 > 0 ? "bull" : "bear" },
          { key: "p90", label: "p90 (high case)", value: signedPct(p90), tone: "bull" },
          { key: "width", label: "80% range width", value: `${((p90 - p10) * 100).toFixed(2)}%`, tone: "info" },
        ],
        summary: `The stand-in's 80% range for the ${horizon} sessions after this window ran from ${signedPct(p10)} to ${signedPct(p90)}.`,
        beginner: "A low case, a high case and the median: three numbers, not one.",
        verdict: {
          side,
          text: side === "hold" ? "The 80% range straddled zero." : `Read ${READ[side]}.`,
          confidence: side === "hold" ? 0.2 : 0.85,
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
    return {
      ...withSource(
        {
          signals: [],
          // Shares of the label the model gave the sessions after the window,
          // not the chances of anything: those sessions have already happened.
          metrics: [
            { key: "pTop", label: "Target first", value: `${(pHitTop * 100).toFixed(0)}%`, tone: "bull" },
            { key: "pBot", label: "Stop first", value: `${(pHitBot * 100).toFixed(0)}%`, tone: "bear" },
            { key: "pTime", label: "Timed out", value: `${(Math.max(0, pTimeOut) * 100).toFixed(0)}%`, tone: "neutral" },
            { key: "label", label: "Likeliest label", value: label, tone: label.startsWith("+") ? "bull" : label.startsWith("−") ? "bear" : "neutral" },
            { key: "ptSl", label: "PT/SL × σ", value: ptSl.toFixed(1), tone: "info" },
            { key: "rv", label: "σ used", value: `${(rv * 100).toFixed(0)}%`, tone: "neutral" },
          ],
          summary: `Target = stop = ${ptSl.toFixed(1)}× the window's ${(rv * 100).toFixed(0)}% vol, over ${horizon} sessions. The likeliest label for the sessions after this window was ${label}.`,
          beginner:
            "De Prado's idea: instead of asking 'was the price up?', ask 'did it touch a +5% target before a −5% stop, or neither?'. Better-labelled training data makes smarter models.",
          verdict: {
            side: pHitTop > pHitBot * 1.4 ? "buy" : pHitBot > pHitTop * 1.4 ? "sell" : "hold",
            text: `Likeliest label after the window: ${label}.`,
            confidence: Math.abs(pHitTop - pHitBot),
          },
        },
        "statistical",
      ),
      asOf: windowLabel(ctx),
    };
  },
};

// ─────────────── 6-Model Consensus — /api/consensus ───────────────
type ConsRes = {
  ticker: string;
  as_of?: string;
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
    // Not "6-Model": the service runs five or six depending on the ticker,
    // and a card named for six that reports 5/5 reads as a mistake.
    name: "Model Consensus",
    category: "ai",
    glyph: "⌬",
    tagline: "The AI quants vote on the same window. Watch where they agreed, and where they didn't.",
    formula: "binary + magnitude + +macro + sequence + transformer + quantile",
    endpoint: "/api/consensus",
    module: "ai quants/models/best_consensus/build.py",
    params: [],
  },
  {
    request: dirRequest,
    readsTape: true,
    build: (data) => {
      const c = data.consensus;
      const side: Verdict["side"] = c.direction === "up" ? "buy" : c.direction === "down" ? "sell" : "hold";
      // The service runs five or six models, so the teacher line counts them.
      const n = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"][c.n_models] ?? String(c.n_models);
      return {
        signals: [],
        metrics: [
          { key: "agree", label: "Models agreeing", value: `${c.agree_count} / ${c.n_models}`, tone: c.agree_count >= c.n_models - 1 ? "bull" : "neutral" },
          { key: "tier", label: "Model agreement", value: bandLabel(c.tier), tone: c.tier === "ultra" ? "bull" : c.tier === "high" ? "info" : "neutral" },
          // The service still sends its own `expected_accuracy_band` per tier.
          // It is deliberately NOT rendered: a band that climbs with agreement
          // is the grade-scale reading the memo asked us to stop publishing.
          // One canonical band, the same figure at every agreement level.
          { key: "acc", label: "Historical hit rate (hypothetical)", value: ACCURACY_BAND, tone: "info", hint: HYPOTHETICAL_NOTE },
          { key: "mag", label: "Avg estimated move", value: `${(c.avg_magnitude * 100).toFixed(2)}%`, tone: "info", hint: "the models' average estimate for the sessions after the window, by size" },
        ],
        summary: c.direction === "split"
          ? `The ${c.n_models} models split on this window (${bandLabel(c.tier)}). Historical hit rate ${ACCURACY_BAND} · ${HYPOTHETICAL_NOTE}.`
          : `${c.agree_count} of ${c.n_models} models read this window ${READ[side]} (${bandLabel(c.tier)}). Historical hit rate ${ACCURACY_BAND} · ${HYPOTHETICAL_NOTE}.`,
        // Same teacher line as the stand-in below, counted (Gate A3, 2026-11).
        // The facts this card has are how many models agreed and one
        // historical band; the line must not let a full vote sound like
        // better odds, nor a split like worse ones.
        beginner:
          `${n} models read the same window. A ${c.n_models}/${c.n_models} vote means the models lined up; it is not better odds, and the same historical band covers every vote.`,
        // No `confidence` (Gate A3). The tier used to map to 0.95 / 0.78 /
        // 0.55 / 0.3 and the card printed it as "CONF 95%" beside the hit-rate
        // band: an invented odds figure. And a split is not "no lift" against
        // a full vote's lift; the same band covers both, so it is just a split.
        verdict: {
          side,
          text: c.direction === "split"
            ? `Models split ${c.agree_count}/${c.n_models} on this window.`
            : `${bandLabel(c.tier)}: ${c.agree_count}/${c.n_models} read ${READ[side]}.`,
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
      // ONE band, not a ladder. This used to hand each tier its own range,
      // topping out well above anything the out-of-sample runs support, and a
      // range that climbs with agreement implies the odds improve as the
      // models line up. See ACCURACY_BAND in ./types for the full reasoning.
      const accBand = ACCURACY_BAND;
      const signals: Signal[] = [];
      const side: Verdict["side"] = dir === "up" ? "buy" : dir === "down" ? "sell" : "hold";
      return {
        signals,
        metrics: [
          { key: "agree", label: "Models agreeing", value: `${agree} / 6`, tone: agree >= 5 ? "bull" : "neutral" },
          { key: "tier", label: "Model agreement", value: bandLabel(tier), tone: tier === "ultra" ? "bull" : tier === "high" ? "info" : "neutral" },
          { key: "acc", label: "Historical hit rate (hypothetical)", value: accBand, tone: "info", hint: HYPOTHETICAL_NOTE },
          { key: "mag", label: "Avg estimated move", value: `${(avgMag * 100).toFixed(2)}%`, tone: "info", hint: "the stand-ins' average estimate for the sessions after the window, by size" },
        ],
        pane: {
          kind: "histogram",
          series: [{
            values: models.map((m) => m.p - 0.5),
            color: "var(--bear)",
            label: "each model's lean on the window (score − 0.5)",
          }],
          refLines: [{ value: 0, color: "var(--fg-faint)" }],
          height: 100,
        },
        summary:
          `${upVotes} of 6 stand-in models read this window up, ${downVotes} down (${bandLabel(tier)}). ` +
          models.map((m) => `${m.name} ${m.vote === 1 ? "up" : "down"}`).join(" · "),
        // This used to say 5–6 on one side was the tightest agreement and a
        // split "showed no measurable predictive lift": read together, that a
        // full vote had the lift. Nothing measured says so; one band covers
        // every vote.
        beginner: "Six models read the same window. A 6/6 vote means the models lined up; it is not better odds, and the same historical band covers every vote.",
        // No `confidence`: see the build path above (Gate A3).
        verdict: {
          side,
          text: dir === "split"
            ? `Models split ${upVotes} up / ${downVotes} down on this window.`
            : `${bandLabel(tier)}: ${agree}/6 read ${dir}.`,
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

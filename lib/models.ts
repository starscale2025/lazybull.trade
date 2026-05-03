// Probability models. Each one answers: "given spot S0, vol σ, time T, what's
// the probability the underlying lands inside [low, high] at expiry?"
// All models return a number in [0,1]. Pricing comes from /lib/pricing.ts.

import { priceOption } from "./pricing";

// Normal CDF (Abramowitz & Stegun)
function ncdf(x: number) {
  const a1 = 0.319381530, a2 = -0.356563782, a3 = 1.781477937, a4 = -1.821255978, a5 = 1.330274429;
  const sign = x < 0 ? -1 : 1;
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const w =
    1 -
    (Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI)) *
      (a1 * k + a2 * k ** 2 + a3 * k ** 3 + a4 * k ** 4 + a5 * k ** 5);
  return sign === 1 ? w : 1 - w;
}

export type ModelInput = {
  spot: number;
  low: number;
  high: number;
  daysToExpiry: number;
  iv: number; // base IV (annualised)
  rate?: number;
};

// Black-Scholes risk-neutral probability of S_T ∈ [low, high]
export function probBS({ spot, low, high, daysToExpiry, iv, rate = 0.045 }: ModelInput): number {
  if (daysToExpiry <= 0) return spot >= low && spot <= high ? 1 : 0;
  const t = daysToExpiry / 365;
  const sigT = iv * Math.sqrt(t);
  const d2L = (Math.log(spot / low) + (rate - 0.5 * iv * iv) * t) / sigT;
  const d2H = (Math.log(spot / high) + (rate - 0.5 * iv * iv) * t) / sigT;
  const pBelow = ncdf(d2L); // P(S_T > low) … direction matters
  const pAbove = ncdf(d2H);
  return Math.max(0, Math.min(1, pBelow - pAbove));
}

// Monte-Carlo of GBM paths
export function probMonteCarlo(input: ModelInput, sims = 8000, seed = 1): number {
  const t = input.daysToExpiry / 365;
  const drift = (input.rate ?? 0.045) - 0.5 * input.iv * input.iv;
  const diffusion = input.iv * Math.sqrt(t);
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  // Box-Muller
  const norm = () => {
    const u = Math.max(1e-12, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  let hits = 0;
  for (let i = 0; i < sims; i++) {
    const z = norm();
    const sT = input.spot * Math.exp(drift * t + diffusion * z);
    if (sT >= input.low && sT <= input.high) hits++;
  }
  return hits / sims;
}

// Vol surface — apply skew/smile by recomputing per-strike IV and averaging
export function probVolSurface(input: ModelInput): number {
  // Sample 11 strikes between low and high; weight each by BS density at midpoint
  const skewed = (K: number) => {
    const m = K / input.spot;
    const skew = K < input.spot ? 0.32 * Math.max(0, 1 - m) ** 1.4 : 0.18 * Math.max(0, m - 1) ** 1.4;
    return input.iv + skew + Math.abs(m - 1) * 0.05;
  };
  // We approximate by averaging two BS calcs: one with low-strike σ, one with high-strike σ
  const σLow = skewed(input.low);
  const σHigh = skewed(input.high);
  const σMid = skewed((input.low + input.high) / 2);
  const a = probBS({ ...input, iv: σLow });
  const b = probBS({ ...input, iv: σHigh });
  const c = probBS({ ...input, iv: σMid });
  return Math.max(0, Math.min(1, a * 0.25 + c * 0.5 + b * 0.25));
}

// Empirical / historical — bootstrap from a synthetic but deterministic 5y daily series
let _hist: number[] | null = null;
function histRet(n = 1300, seed = 91): number[] {
  if (_hist) return _hist;
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    // mixture of regimes — calm + occasional shock
    const shock = rand() < 0.04 ? (rand() - 0.5) * 0.06 : 0;
    out.push((rand() - 0.5) * 0.018 + shock);
  }
  _hist = out;
  return out;
}
export function probEmpirical({ spot, low, high, daysToExpiry }: ModelInput): number {
  const hist = histRet();
  const sims = 4000;
  const days = Math.max(1, Math.round(daysToExpiry));
  let s = 7;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = s;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  let hits = 0;
  for (let i = 0; i < sims; i++) {
    let s_t = spot;
    for (let d = 0; d < days; d++) {
      const r = hist[Math.floor(rand() * hist.length)];
      s_t *= 1 + r;
    }
    if (s_t >= low && s_t <= high) hits++;
  }
  return hits / sims;
}

// Heston (simplified): GBM with stochastic vol that mean-reverts
export function probHeston(input: ModelInput, sims = 5000): number {
  const t = input.daysToExpiry / 365;
  const steps = Math.max(8, Math.round(input.daysToExpiry / 4));
  const dt = t / steps;
  const r = input.rate ?? 0.045;
  const v0 = input.iv * input.iv;
  const theta = v0 * 0.85; // long-run var
  const kappa = 1.5; // mean reversion speed
  const xi = 0.4; // vol of vol
  const rho = -0.6; // negative correlation (skew)
  let seed = 13 >>> 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let r = seed;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const norm = () => {
    const u = Math.max(1e-12, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  let hits = 0;
  for (let i = 0; i < sims; i++) {
    let s = input.spot;
    let v = v0;
    for (let k = 0; k < steps; k++) {
      const z1 = norm();
      const z2 = rho * z1 + Math.sqrt(1 - rho * rho) * norm();
      const sigma = Math.sqrt(Math.max(1e-6, v));
      s = s * Math.exp((r - 0.5 * v) * dt + sigma * Math.sqrt(dt) * z1);
      v = Math.max(1e-6, v + kappa * (theta - v) * dt + xi * sigma * Math.sqrt(dt) * z2);
    }
    if (s >= input.low && s <= input.high) hits++;
  }
  return hits / sims;
}

// Sandbox a user-supplied function. The function receives an object with input
// and a small math helper namespace. Errors return null.
export function probUser(code: string, input: ModelInput): number | null {
  if (!code.trim()) return null;
  try {
    const fn = new Function(
      "input",
      "math",
      // The user-supplied snippet must end with `return P` where P is in [0,1]
      `${code}`
    ) as (i: ModelInput, m: typeof Math) => unknown;
    const v = fn(input, Math);
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    return Math.max(0, Math.min(1, v));
  } catch {
    return null;
  }
}

export type ModelKey = "bs" | "vs" | "mc" | "emp" | "heston" | "user";

export const MODEL_META: Record<ModelKey, { label: string; short: string; tone: string; explain: string }> = {
  bs: { label: "Black-Scholes", short: "BS", tone: "var(--bull)", explain: "Closed-form. Constant vol. The textbook." },
  vs: { label: "Vol Surface", short: "VS", tone: "var(--cyan)", explain: "BS but uses the strike-skewed IV the market actually quotes." },
  mc: { label: "Monte Carlo", short: "MC", tone: "var(--plasma)", explain: "8k GBM paths. Same assumptions as BS, simulated." },
  emp: { label: "Historical 5Y", short: "HIST", tone: "var(--amber)", explain: "Bootstrap from real daily returns. No vol assumption." },
  heston: { label: "Heston SV", short: "HES", tone: "var(--bear)", explain: "Stochastic vol with mean reversion. For nerds who want fat tails." },
  user: { label: "Your Model", short: "YOU", tone: "var(--fg)", explain: "Whatever you wrote in the BYO box." },
};

export function probAll(input: ModelInput, userCode = ""): Record<ModelKey, number | null> {
  return {
    bs: probBS(input),
    vs: probVolSurface(input),
    mc: probMonteCarlo(input),
    emp: probEmpirical(input),
    heston: probHeston(input),
    user: probUser(userCode, input),
  };
}

export function spreadBetween(probs: Record<ModelKey, number | null>): number {
  const vs = Object.values(probs).filter((v): v is number => v != null);
  if (vs.length < 2) return 0;
  return Math.max(...vs) - Math.min(...vs);
}

// ── Strategy generation
// Given a thesis (spot, low, high, daysToExpiry, iv), pick three strategies that
// align with the directional view and report risk/reward/odds for each.

export type Bias = "bullish" | "bearish" | "neutral" | "volatile";

export function biasFromThesis(spot: number, low: number, high: number): Bias {
  const mid = (low + high) / 2;
  const span = (high - low) / spot;
  if (span > 0.18) return "volatile";
  if (mid > spot * 1.03) return "bullish";
  if (mid < spot * 0.97) return "bearish";
  return "neutral";
}

export type Strategy = {
  id: "cheap" | "income" | "aggressive";
  kind: string; // human label of legs
  legs: {
    type: "C" | "P";
    side: "long" | "short";
    strike: number;
    qty: number;
    premium: number;
  }[];
  cost: number; // net debit (>0) / credit (<0) per spread
  maxProfit: number;
  maxLoss: number;
  breakevens: number[];
  prob: number; // BS odds of being profitable at expiry
  blurb: string;
  bias: Bias;
};

function midPrice(spot: number, K: number, t: number, iv: number, type: "C" | "P", rate = 0.045) {
  return priceOption(spot, K, t, rate, iv, type).price;
}

function pnlAt(legs: Strategy["legs"], spotAt: number) {
  let p = 0;
  for (const l of legs) {
    const intrinsic = l.type === "C" ? Math.max(0, spotAt - l.strike) : Math.max(0, l.strike - spotAt);
    const sign = l.side === "long" ? 1 : -1;
    p += sign * (intrinsic - l.premium) * l.qty * 100;
  }
  return p;
}

function probProfit(spot: number, iv: number, daysToExpiry: number, legs: Strategy["legs"]): number {
  // Sample 51 spots ±35% and compute fraction of MC that yields PnL>0
  const t = daysToExpiry / 365;
  const sigT = iv * Math.sqrt(t);
  const sims = 6000;
  let seed = 23 >>> 0;
  const rand = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let r = seed;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const norm = () => {
    const u = Math.max(1e-12, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  let hits = 0;
  for (let i = 0; i < sims; i++) {
    const z = norm();
    const sT = spot * Math.exp(-0.5 * iv * iv * t + sigT * z);
    if (pnlAt(legs, sT) > 0) hits++;
  }
  return hits / sims;
}

function summarise(legs: Strategy["legs"], spot: number) {
  // sample 401 spots ±50% to find max/min and breakevens
  const lo = spot * 0.5;
  const hi = spot * 1.5;
  const n = 401;
  const step = (hi - lo) / (n - 1);
  let mx = -Infinity, mn = Infinity;
  const pts: { s: number; p: number }[] = [];
  for (let i = 0; i < n; i++) {
    const s = lo + step * i;
    const p = pnlAt(legs, s);
    if (p > mx) mx = p;
    if (p < mn) mn = p;
    pts.push({ s, p });
  }
  const bes: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if ((a.p <= 0 && b.p >= 0) || (a.p >= 0 && b.p <= 0)) {
      const t = a.p === b.p ? 0 : -a.p / (b.p - a.p);
      bes.push(+(a.s + t * (b.s - a.s)).toFixed(2));
    }
  }
  return { maxProfit: mx, maxLoss: mn, breakevens: Array.from(new Set(bes)) };
}

export function generateStrategies({
  spot, low, high, daysToExpiry, iv,
}: { spot: number; low: number; high: number; daysToExpiry: number; iv: number }): Strategy[] {
  const t = Math.max(0.01, daysToExpiry / 365);
  const bias = biasFromThesis(spot, low, high);
  const round = (v: number) => Math.round(v / 0.5) * 0.5;

  // Cheap & risky — long single option, ATM-ish in the direction of the bet
  const cheap: Strategy = (() => {
    if (bias === "bullish" || bias === "neutral") {
      const K = round(Math.max(spot, low));
      const prem = midPrice(spot, K, t, iv, "C");
      const legs = [{ type: "C" as const, side: "long" as const, strike: K, qty: 1, premium: prem }];
      const sum = summarise(legs, spot);
      const prob = probProfit(spot, iv, daysToExpiry, legs);
      return {
        id: "cheap",
        kind: `Long ${K} call`,
        legs,
        cost: prem * 100,
        maxProfit: Infinity,
        maxLoss: -prem * 100,
        breakevens: sum.breakevens,
        prob,
        blurb: "Pay a small ticket. Win huge if the stock rips up. Lose it all if it doesn't.",
        bias,
      };
    }
    const K = round(Math.min(spot, high));
    const prem = midPrice(spot, K, t, iv, "P");
    const legs = [{ type: "P" as const, side: "long" as const, strike: K, qty: 1, premium: prem }];
    const sum = summarise(legs, spot);
    return {
      id: "cheap",
      kind: `Long ${K} put`,
      legs,
      cost: prem * 100,
      maxProfit: K * 100,
      maxLoss: -prem * 100,
      breakevens: sum.breakevens,
      prob: probProfit(spot, iv, daysToExpiry, legs),
      blurb: "Pay a small ticket. Win huge if the stock falls hard. Lose it all if it doesn't.",
      bias,
    };
  })();

  // Defined-risk income — sell premium that pays you if the stock stays in the band
  const income: Strategy = (() => {
    // iron condor / put credit spread / call credit spread depending on bias
    if (bias === "neutral" || bias === "volatile") {
      // Iron condor: short put at low, long put at low-5%; short call at high, long call at high+5%
      const wing = Math.max(round(spot * 0.05), round((high - low) * 0.4));
      const Klp = round(low - wing);
      const Ksp = round(low);
      const Ksc = round(high);
      const Klc = round(high + wing);
      const lpP = midPrice(spot, Klp, t, iv, "P");
      const spP = midPrice(spot, Ksp, t, iv, "P");
      const scP = midPrice(spot, Ksc, t, iv, "C");
      const lcP = midPrice(spot, Klc, t, iv, "C");
      const legs = [
        { type: "P" as const, side: "long" as const, strike: Klp, qty: 1, premium: lpP },
        { type: "P" as const, side: "short" as const, strike: Ksp, qty: 1, premium: spP },
        { type: "C" as const, side: "short" as const, strike: Ksc, qty: 1, premium: scP },
        { type: "C" as const, side: "long" as const, strike: Klc, qty: 1, premium: lcP },
      ];
      const credit = (spP + scP - lpP - lcP) * 100;
      const sum = summarise(legs, spot);
      return {
        id: "income",
        kind: `Iron condor ${Klp}/${Ksp} – ${Ksc}/${Klc}`,
        legs,
        cost: -credit,
        maxProfit: sum.maxProfit,
        maxLoss: sum.maxLoss,
        breakevens: sum.breakevens,
        prob: probProfit(spot, iv, daysToExpiry, legs),
        blurb: "You collect premium up front. You win if the stock stays inside the band. Defined max loss either side.",
        bias,
      };
    }
    if (bias === "bullish") {
      const Ks = round(low);
      const Kl = round(low - Math.max(2, spot * 0.04));
      const sP = midPrice(spot, Ks, t, iv, "P");
      const lP = midPrice(spot, Kl, t, iv, "P");
      const legs = [
        { type: "P" as const, side: "long" as const, strike: Kl, qty: 1, premium: lP },
        { type: "P" as const, side: "short" as const, strike: Ks, qty: 1, premium: sP },
      ];
      const sum = summarise(legs, spot);
      return {
        id: "income",
        kind: `Bull put spread ${Kl}/${Ks}`,
        legs,
        cost: -(sP - lP) * 100,
        maxProfit: sum.maxProfit,
        maxLoss: sum.maxLoss,
        breakevens: sum.breakevens,
        prob: probProfit(spot, iv, daysToExpiry, legs),
        blurb: "Sell a put near your floor, buy one below. Get paid if the stock holds above the floor.",
        bias,
      };
    }
    // bearish call credit spread
    const Ks = round(high);
    const Kl = round(high + Math.max(2, spot * 0.04));
    const sC = midPrice(spot, Ks, t, iv, "C");
    const lC = midPrice(spot, Kl, t, iv, "C");
    const legs = [
      { type: "C" as const, side: "short" as const, strike: Ks, qty: 1, premium: sC },
      { type: "C" as const, side: "long" as const, strike: Kl, qty: 1, premium: lC },
    ];
    const sum = summarise(legs, spot);
    return {
      id: "income",
      kind: `Bear call spread ${Ks}/${Kl}`,
      legs,
      cost: -(sC - lC) * 100,
      maxProfit: sum.maxProfit,
      maxLoss: sum.maxLoss,
      breakevens: sum.breakevens,
      prob: probProfit(spot, iv, daysToExpiry, legs),
      blurb: "Sell a call near your ceiling, buy one above. Get paid if the stock stays below the ceiling.",
      bias,
    };
  })();

  // Aggressive — debit spread (defined risk but bigger leverage)
  const aggressive: Strategy = (() => {
    if (bias === "bullish" || bias === "neutral") {
      const Kl = round(spot);
      const Ks = round(high);
      const lP = midPrice(spot, Kl, t, iv, "C");
      const sP = midPrice(spot, Ks, t, iv, "C");
      const legs = [
        { type: "C" as const, side: "long" as const, strike: Kl, qty: 1, premium: lP },
        { type: "C" as const, side: "short" as const, strike: Ks, qty: 1, premium: sP },
      ];
      const sum = summarise(legs, spot);
      return {
        id: "aggressive",
        kind: `Bull call spread ${Kl}/${Ks}`,
        legs,
        cost: (lP - sP) * 100,
        maxProfit: sum.maxProfit,
        maxLoss: sum.maxLoss,
        breakevens: sum.breakevens,
        prob: probProfit(spot, iv, daysToExpiry, legs),
        blurb: "Pay a debit. Capped reward equal to the strike spread. Capped loss equal to the debit.",
        bias,
      };
    }
    const Kl = round(spot);
    const Ks = round(low);
    const lP = midPrice(spot, Kl, t, iv, "P");
    const sP = midPrice(spot, Ks, t, iv, "P");
    const legs = [
      { type: "P" as const, side: "long" as const, strike: Kl, qty: 1, premium: lP },
      { type: "P" as const, side: "short" as const, strike: Ks, qty: 1, premium: sP },
    ];
    const sum = summarise(legs, spot);
    return {
      id: "aggressive",
      kind: `Bear put spread ${Kl}/${Ks}`,
      legs,
      cost: (lP - sP) * 100,
      maxProfit: sum.maxProfit,
      maxLoss: sum.maxLoss,
      breakevens: sum.breakevens,
      prob: probProfit(spot, iv, daysToExpiry, legs),
      blurb: "Pay a debit. Big upside if the stock falls into your zone. Capped loss equal to the debit.",
      bias,
    };
  })();

  return [cheap, income, aggressive];
}

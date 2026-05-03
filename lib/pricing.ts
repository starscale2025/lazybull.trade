// Closed-form Black-Scholes pricer + greeks. <100ms for the entire chain because
// it's just a polynomial CDF — no heavy work, no external WASM bundle.
//
// We expose `priceChain()` which returns the full options chain in one call so the
// hot path stays in a single tight loop. Everything is deterministic given the same
// inputs (no randomness) so SSR and CSR agree.

const SQRT_2PI = Math.sqrt(2 * Math.PI);

// Abramowitz & Stegun 26.2.17 — max error ~7.5e-8. Plenty good for an options chain.
function ndf(x: number) {
  return Math.exp(-(x * x) / 2) / SQRT_2PI;
}

function ncdf(x: number) {
  const a1 = 0.319381530;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const k = 1 / (1 + 0.2316419 * Math.abs(x));
  const w =
    1 -
    ndf(x) *
      (a1 * k + a2 * k ** 2 + a3 * k ** 3 + a4 * k ** 4 + a5 * k ** 5);
  return x >= 0 ? w : 1 - w;
}

export type OptionType = "C" | "P";

export type Greeks = {
  delta: number;
  gamma: number;
  theta: number; // per day
  vega: number; // per 1 vol point (e.g., 0.01)
  rho: number; // per 1 rate point
};

export type Quote = {
  bid: number;
  ask: number;
  mid: number;
  iv: number;
  greeks: Greeks;
  oi: number; // simulated open interest
  vol: number; // simulated daily volume
};

export type ChainCell = {
  strike: number;
  type: OptionType;
  expiry: string; // ISO date
  daysToExpiry: number;
  spot: number;
  itm: boolean;
} & Quote;

export function priceOption(
  spot: number,
  strike: number,
  t: number, // years
  r: number, // risk free rate
  sigma: number, // implied vol
  type: OptionType
): { price: number; greeks: Greeks } {
  if (t <= 0) {
    const intrinsic = type === "C" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
    return { price: intrinsic, greeks: { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 } };
  }
  const sqrtT = Math.sqrt(t);
  const d1 = (Math.log(spot / strike) + (r + 0.5 * sigma * sigma) * t) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const Nd1 = ncdf(d1);
  const Nd2 = ncdf(d2);
  const nd1 = ndf(d1);

  let price: number;
  let delta: number;
  let theta: number;
  let rho: number;
  if (type === "C") {
    price = spot * Nd1 - strike * Math.exp(-r * t) * Nd2;
    delta = Nd1;
    theta =
      (-(spot * nd1 * sigma) / (2 * sqrtT) - r * strike * Math.exp(-r * t) * Nd2) / 365;
    rho = (strike * t * Math.exp(-r * t) * Nd2) / 100;
  } else {
    const Nmd1 = ncdf(-d1);
    const Nmd2 = ncdf(-d2);
    price = strike * Math.exp(-r * t) * Nmd2 - spot * Nmd1;
    delta = Nd1 - 1;
    theta =
      (-(spot * nd1 * sigma) / (2 * sqrtT) + r * strike * Math.exp(-r * t) * Nmd2) / 365;
    rho = (-strike * t * Math.exp(-r * t) * Nmd2) / 100;
  }

  const gamma = nd1 / (spot * sigma * sqrtT);
  const vega = (spot * nd1 * sqrtT) / 100;

  return { price, greeks: { delta, gamma, theta, vega, rho } };
}

// Skew / smile for the simulated chain. Steeper for puts than calls.
function skewedIv(baseIv: number, moneyness: number, type: OptionType) {
  // moneyness = K / S  (K above 1 => OTM call)
  const m = moneyness - 1;
  const skew = type === "C" ? 0.18 * Math.max(0, m) ** 1.4 : 0.32 * Math.max(0, -m) ** 1.4;
  return baseIv + skew + Math.abs(m) * 0.04;
}

// Cheap deterministic hash so the chain matches strike/expiry across renders
function hash(seed: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

export function priceChain({
  spot,
  expiries,
  strikes,
  baseIv = 0.32,
  rate = 0.045,
  spread = 0.02,
}: {
  spot: number;
  expiries: { iso: string; daysToExpiry: number }[];
  strikes: number[];
  baseIv?: number;
  rate?: number;
  spread?: number;
}): ChainCell[][] {
  return expiries.map((e) =>
    strikes.flatMap<ChainCell>((K) => {
      const t = Math.max(0.0005, e.daysToExpiry / 365);
      const moneyness = K / spot;
      return (["C", "P"] as OptionType[]).map((type) => {
        const sigma = skewedIv(baseIv, moneyness, type);
        const { price, greeks } = priceOption(spot, K, t, rate, sigma, type);
        const half = (price * spread) / 2 + 0.02;
        const seed = hash(`${e.iso}|${K}|${type}`);
        return {
          strike: K,
          type,
          expiry: e.iso,
          daysToExpiry: e.daysToExpiry,
          spot,
          itm: type === "C" ? spot > K : spot < K,
          bid: Math.max(0.01, price - half),
          ask: price + half,
          mid: price,
          iv: sigma,
          greeks,
          oi: Math.round(800 + seed * 9000),
          vol: Math.round(40 + seed * 1800),
        };
      });
    })
  );
}

// Build a P&L curve for an arbitrary leg basket at expiry.
export type Leg = {
  id: string;
  type: OptionType;
  side: "long" | "short";
  strike: number;
  qty: number;
  premium: number; // mid at trade
};

export function payoff(legs: Leg[], spotAt: number) {
  let pnl = 0;
  for (const l of legs) {
    const intrinsic = l.type === "C" ? Math.max(0, spotAt - l.strike) : Math.max(0, l.strike - spotAt);
    const sign = l.side === "long" ? 1 : -1;
    pnl += sign * (intrinsic - l.premium) * l.qty * 100;
  }
  return pnl;
}

export function pnlCurve(legs: Leg[], spot: number, range = 0.4, points = 81) {
  const lo = spot * (1 - range);
  const hi = spot * (1 + range);
  const step = (hi - lo) / (points - 1);
  const pts: { s: number; pnl: number }[] = [];
  for (let i = 0; i < points; i++) {
    const s = lo + i * step;
    pts.push({ s, pnl: payoff(legs, s) });
  }
  return pts;
}

// Find max profit, max loss, breakevens (numerical, robust enough for demo).
export function pnlSummary(legs: Leg[], spot: number) {
  const curve = pnlCurve(legs, spot, 0.6, 401);
  let maxP = -Infinity;
  let maxL = Infinity;
  for (const p of curve) {
    if (p.pnl > maxP) maxP = p.pnl;
    if (p.pnl < maxL) maxL = p.pnl;
  }
  const breakevens: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if ((a.pnl <= 0 && b.pnl >= 0) || (a.pnl >= 0 && b.pnl <= 0)) {
      const t = a.pnl === b.pnl ? 0 : -a.pnl / (b.pnl - a.pnl);
      breakevens.push(a.s + t * (b.s - a.s));
    }
  }
  // Detect unbounded loss tails (naked shorts past visible range).
  const tailLeft = curve[0].pnl;
  const tailRight = curve[curve.length - 1].pnl;
  const lastSlopeLeft = curve[1].pnl - curve[0].pnl;
  const lastSlopeRight = curve[curve.length - 1].pnl - curve[curve.length - 2].pnl;
  const unboundedDown = lastSlopeLeft > 0 && tailLeft < 0; // loss grows as spot falls
  const unboundedUp = lastSlopeRight < 0 && tailRight < 0; // loss grows as spot rises
  return {
    maxProfit: maxP,
    maxLoss: maxL,
    breakevens: Array.from(new Set(breakevens.map((b) => +b.toFixed(2)))),
    unboundedRisk: unboundedDown || unboundedUp,
  };
}

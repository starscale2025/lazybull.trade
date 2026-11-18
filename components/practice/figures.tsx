// A FIGURE FOR EVERY PRACTICE QUESTION (plan A5, Stage 5). Server-only: the
// problem page builds the figure here and hands the finished SVG to the
// Description tab, so a still figure costs the browser no JavaScript.
//
// Each figure is drawn from the problem's own first example, so the picture
// is the exact case the statement describes: its arguments are parsed from
// the example's `S=100.0, K=100.0, ...` line and its answer from the output.
// Hidden cases are never read here. A test (__tests__/practice-figures.test.ts)
// fails if a problem is added without a figure.

import type { ReactNode } from "react";
import type { Problem } from "@/lib/practice/types";
import { priceOption } from "@/lib/pricing";
import { hestonPrice } from "@/lib/quant/heston";
import {
  CashLadderFigure,
  CurveFigure,
  DepthLadderFigure,
  FoldStripsFigure,
  HistogramFigure,
  IterationFigure,
  LatticeFigure,
  MatrixFigure,
  SeriesFigure,
  type FoldKind,
} from "@/components/viz";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Args = Record<string, any>;

/** `S=100.0, kind="call", x=[1, 2]` -> { S: 100, kind: "call", x: [1, 2] } (literals only, as the judge takes them). */
export function parseArgs(input: string): Args {
  const json = input
    .replace(/(^|,\s*)([A-Za-z_]\w*)=/g, '$1"$2":')
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null")
    .replace(/'/g, '"');
  return JSON.parse(`{${json}}`);
}
const parseOut = (s: string): any => JSON.parse(s.replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false"));

// ── small maths ─────────────────────────────────────────────────────────────
const range = <T,>(n: number, f: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => f(i));
const lin = (a: number, b: number, n: number) => range(n, (i) => a + ((b - a) * i) / (n - 1));
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const sd = (v: number[]) => {
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
};
const rolling = (v: number[], w: number, f: (x: number[]) => number) => v.map((_, i) => (i + 1 < w ? null : f(v.slice(i + 1 - w, i + 1))));
const call = (S: number, K: number, T: number, r: number, s: number) => priceOption(S, K, Math.max(T, 1e-6), r, s, "C");
const put = (S: number, K: number, T: number, r: number, s: number) => priceOption(S, K, Math.max(T, 1e-6), r, s, "P");
function ncdf(x: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp((-x * x) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (u: () => number) => Math.sqrt(-2 * Math.log(Math.max(1e-12, u()))) * Math.cos(2 * Math.PI * u());
const fmt = (v: number, d = 2) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
const usd = (v: number) => `$${v.toFixed(2)}`;
function impliedVol(price: number, S: number, K: number, T: number, r: number) {
  let lo = 0.001;
  let hi = 3;
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2;
    if (call(S, K, T, r, m).price > price) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}
const hist = (xs: number[], n: number) => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const w = (hi - lo) / n || 1;
  const bins = range(n, (i) => ({ x0: lo + i * w, x1: lo + (i + 1) * w, count: 0 }));
  for (const x of xs) bins[Math.min(n - 1, Math.floor((x - lo) / w))].count++;
  return bins;
};

type Builder = (a: Args, out: any) => ReactNode;

const B: Record<string, Builder> = {
  // ── curves ────────────────────────────────────────────────────────────────
  "black-scholes-call": (a, out) => {
    const xs = lin(a.K * 0.6, a.K * 1.4, 61);
    return (
      <CurveFigure
        title={`A ${a.K} call, ${a.T} year to expiry`}
        desc={`Black-Scholes price across the stock price, above its payoff at expiry. At S = ${a.S} the price is ${out}.`}
        x={{ domain: [xs[0], xs[60]], label: "Stock price" }}
        lines={[
          // the two lines meet at the right edge, so each is named where it stands alone
          { points: xs.map((S) => [S, Math.max(0, S - a.K)]), role: "ref", label: "payoff at expiry", labelAt: { x: a.K * 1.05, y: 0, anchor: "start", dy: -6 } },
          { points: xs.map((S) => [S, call(S, a.K, a.T, a.r, a.sigma).price]), role: "model", label: "price today", labelAt: { x: a.K * 1.25, y: call(a.K * 1.25, a.K, a.T, a.r, a.sigma).price } },
        ]}
        verticals={[{ x: a.K, label: "strike" }]}
        markers={[{ x: a.S, y: +out, text: usd(+out) }]}
      />
    );
  },
  "put-call-parity": (a, out) => {
    const xs = lin(a.K * 0.7, a.K * 1.3, 41);
    const fwd = (S: number) => S - a.K * Math.exp(-a.r * a.T);
    return (
      <CurveFigure
        title="Call minus put is the forward"
        desc={`C − P must equal S − K·e^(−rT) at every stock price. Here call − put = ${fmt(a.call - a.put, 4)} at S = ${a.S}; the gap from the line is ${out}.`}
        x={{ domain: [xs[0], xs[40]], label: "Stock price" }}
        lines={[{ points: xs.map((S) => [S, fwd(S)]), role: "model", label: "S − K·e^(−rT)" }]}
        verticals={[{ x: a.K, label: "strike" }]}
        markers={[{ x: a.S, y: a.call - a.put, text: `C − P ${fmt(a.call - a.put, 2)}` }]}
      />
    );
  },
  "greeks-finite-difference": (a, out) => {
    const xs = lin(a.K * 0.6, a.K * 1.4, 61);
    const pick = (S: number) => (a.kind === "put" ? put : call)(S, a.K, a.T, a.r, a.sigma).greeks.delta;
    return (
      <CurveFigure
        title={`Delta of the ${a.kind}, from finite differences`}
        desc={`Delta across the stock price. At S = ${a.S} the bumps give delta ${out[0]}, gamma ${out[1]} and vega ${out[2]}.`}
        x={{ domain: [xs[0], xs[60]], label: "Stock price" }}
        lines={[{ points: xs.map((S) => [S, pick(S)]), role: "model", label: "delta" }]}
        verticals={[{ x: a.K, label: "strike" }]}
        markers={[{ x: a.S, y: +out[0], text: `Δ ${(+out[0]).toFixed(4)}` }]}
      />
    );
  },
  "covered-call-payoff": (a, out) => {
    const xs = lin(a.entry * 0.8, a.strike * 1.2, 41);
    const pnl = (P: number) => P - a.entry + a.premium - Math.max(0, P - a.strike);
    return (
      <CurveFigure
        title="A covered call at expiry"
        desc={`Own the stock at ${a.entry}, sell the ${a.strike} call for ${a.premium}: the gain is capped at the strike. The example's prices give ${JSON.stringify(out)}.`}
        x={{ domain: [xs[0], xs[40]], label: "Price at expiry" }}
        y={{ label: "P&L per share" }}
        lines={[{ points: xs.map((P) => [P, pnl(P)]), role: "pnl", label: "P&L" }]}
        verticals={[{ x: a.strike, label: "strike" }]}
        markers={(a.expiry_prices as number[]).map((P, i) => ({ x: P, y: +out[i] }))}
      />
    );
  },
  "normal-cdf": (a, out) => (
    <CurveFigure
      title="The standard normal CDF"
      desc={`The probability that a standard normal draw is below x. At x = ${a.x} it is ${out}.`}
      x={{ domain: [-4, 4], label: "x" }}
      y={{ domain: [0, 1] }}
      lines={[{ points: lin(-4, 4, 81).map((x) => [x, ncdf(x)]), role: "model", label: "Φ(x)" }]}
      markers={[{ x: a.x, y: +out, text: (+out).toFixed(4) }]}
    />
  ),
  "calibrate-probabilities": (a, out) => {
    const n = a.bins as number;
    const pts: [number, number][] = [];
    for (let b = 0; b < n; b++) {
      const idx = (a.probs as number[]).map((p, i) => [p, i] as const).filter(([p]) => (b === n - 1 ? p >= b / n && p <= 1 : p >= b / n && p < (b + 1) / n));
      if (idx.length) pts.push([mean(idx.map(([p]) => p)), mean(idx.map(([, i]) => a.labels[i]))]);
    }
    return (
      <CurveFigure
        title="Said against happened"
        desc={`Mean forecast against the observed frequency in each of ${n} bins; a calibrated model sits on the diagonal. The expected calibration error is ${out}.`}
        x={{ domain: [0, 1], label: "Forecast probability" }}
        y={{ domain: [0, 1] }}
        lines={[
          { points: [[0, 0], [1, 1]], role: "ref", label: "calibrated" },
          { points: pts, role: "model", label: "this model" },
        ]}
        markers={pts.map(([x, y]) => ({ x, y }))}
      />
    );
  },
  "kelly-fraction": (a, out) => {
    const q = 1 - a.p;
    const fmax = Math.min(0.99, Math.max(0.05, 2.4 * +out));
    const g = (f: number) => a.p * Math.log(1 + a.b * f) + q * Math.log(1 - f);
    return (
      <CurveFigure
        title="Growth against the fraction staked"
        desc={`Long-run growth per bet with p = ${a.p} and odds ${a.b}. It peaks at the Kelly fraction ${out} and turns negative near twice it.`}
        x={{ domain: [0, fmax], label: "Fraction of bankroll" }}
        lines={[{ points: lin(0, fmax, 61).map((f) => [f, g(f)]), role: "pnl", label: "growth" }]}
        markers={[{ x: +out, y: g(+out), text: `f* ${(+out).toFixed(2)}` }]}
      />
    );
  },
  "theta-bleed-to-expiry": (a, out) => {
    const ds = lin(a.days, 0, 61);
    return (
      <CurveFigure
        title={`An at-the-money call over its last ${a.days} days`}
        desc={`Its price as time passes with nothing else changing: ${out[0]} with ${a.days} days left, ${out[1]} a day later, the decay speeding up toward expiry.`}
        x={{ domain: [a.days, 0], label: "Days left" }}
        lines={[{ points: ds.map((d) => [d, call(a.S, a.K, d / a.day_count, a.r, a.sigma).price]), role: "model", label: "price" }]}
        markers={[{ x: a.days, y: +out[0], text: usd(+out[0]) }]}
      />
    );
  },
  "hurst-exponent": (a, out) => {
    // one window, as the problem asks: the mean-adjusted walk, its range R, and H = log(R/S) / log(n)
    const r = a.returns as number[];
    const m = mean(r);
    let acc = 0;
    const walk = r.map((x) => (acc += x - m));
    const hi = Math.max(...walk);
    const lo = Math.min(...walk);
    const S = Math.sqrt(mean(r.map((x) => (x - m) ** 2)));
    const top = walk.indexOf(hi);
    return (
      <SeriesFigure
        title="The range of the mean-adjusted walk"
        desc={`Cumulative deviations from the mean over ${r.length} returns. Their range R is ${fmt(hi - lo, 4)} and the standard deviation S is ${fmt(S, 4)}, so H = log(R/S) / log(${r.length}) = ${out}.`}
        values={walk}
        role="single"
        digits={3}
        brackets={[{ i: top, from: hi, to: lo, label: `R = ${fmt(hi - lo, 4)}` }]}
        xLabel="Return"
        yLabel="Cumulative deviation"
      />
    );
  },
  "heston-monte-carlo": (a, out) => {
    const Ks = lin(a.S * 0.8, a.S * 1.2, 13);
    const smile = Ks.map((K) => {
      const p = hestonPrice({ S: a.S, K, T: a.T, r: a.r, v0: a.v0, kappa: a.kappa, theta: a.theta, xi: a.xi, rho: a.rho }, "C");
      return [K, impliedVol(p, a.S, K, a.T, a.r) * 100] as [number, number];
    });
    const flat = Math.sqrt(a.v0) * 100;
    return (
      <CurveFigure
        title="Heston's smile against one flat volatility"
        desc={`Implied volatility across strikes for the example's Heston parameters, against Black-Scholes at √v₀ = ${flat.toFixed(1)}%. The at-the-money call simulates to ${out}.`}
        x={{ domain: [Ks[0], Ks[12]], label: "Strike" }}
        y={{ label: "Implied vol %" }}
        lines={[
          { points: [[Ks[0], flat], [Ks[12], flat]], role: "ref", label: "flat Black-Scholes" },
          { points: smile, role: "model", label: "Heston" },
        ]}
        verticals={[{ x: a.K, label: "strike" }]}
      />
    );
  },

  // ── series with overlay ───────────────────────────────────────────────────
  "cagr-equity-curve": (a, out) => {
    const e = a.equity as number[];
    const g = (e[e.length - 1] / e[0]) ** (1 / (e.length - 1));
    return (
      <SeriesFigure
        title="An equity curve and its steady-growth twin"
        desc={`The same start and end reached at one constant rate per period. Annualised over ${a.periods_per_year} periods a year that is ${out}%.`}
        values={e}
        overlays={[{ values: e.map((_, i) => e[0] * g ** i), role: "model", label: "constant growth" }]}
        xLabel="Period"
        yLabel="Equity"
      />
    );
  },
  "max-drawdown": (a, out) => {
    const e = a.equity as number[];
    let peak = -Infinity;
    const peaks = e.map((v) => (peak = Math.max(peak, v)));
    // the deepest trough, measured down from the peak it fell from
    const dds = e.map((v, i) => (peaks[i] - v) / peaks[i]);
    const worst = dds.indexOf(Math.max(...dds));
    return (
      <SeriesFigure
        title="Equity under its running peak"
        desc={`The deepest fall from a peak to a later trough, as a fraction of the peak: ${out}.`}
        values={e}
        role="single"
        overlays={[{ values: peaks, role: "ref", label: "running peak" }]}
        brackets={dds[worst] > 0 ? [{ i: worst, from: peaks[worst], to: e[worst], label: `−${(dds[worst] * 100).toFixed(1)}%`, role: "loss" }] : []}
        xLabel="Period"
        yLabel="Equity"
      />
    );
  },
  "rolling-zscore": (a, out) => {
    const v = a.values as number[];
    const w = v.slice(-a.window);
    const M = mean(w);
    const D = sd(w);
    const inWin = (x: number) => v.map((_, i) => (i >= v.length - a.window ? x : null));
    const m = inWin(M);
    const s = inWin(D);
    return (
      <SeriesFigure
        title="The last value against its window"
        desc={`The rolling mean with a one-standard-deviation band. The last value sits ${out} standard deviations from the mean.`}
        values={v}
        overlays={[{ values: m, role: "model", label: "mean" }]}
        band={{ lo: m.map((x, i) => (x === null ? null : x - (s[i] as number))), hi: m.map((x, i) => (x === null ? null : x + (s[i] as number))), label: "±1 sd" }}
        xLabel="Period"
      />
    );
  },
  "kalman-price-level": (a, out) => (
    <SeriesFigure
      title="Noisy prices and the filtered level"
      desc={`A one-dimensional Kalman filter with q = ${a.q} and r = ${a.r}. Its level moves toward each new price by less as its confidence grows.`}
      values={a.values}
      overlays={[{ values: out, role: "model", label: "filtered level" }]}
      xLabel="Period"
    />
  ),
  "bollinger-bands": (a, out) => {
    const v = a.values as number[];
    const w = v.slice(-a.window);
    const inWin = (x: number) => v.map((_, i) => (i >= v.length - a.window ? x : null));
    const m = inWin(mean(w));
    const s = inWin(sd(w));
    return (
      <SeriesFigure
        title={`Bands ${a.k} standard deviations wide`}
        desc={`The ${a.window}-period mean and its band. On the last value the band is [${out[0]}, ${out[2]}] around ${out[1]}.`}
        values={v}
        overlays={[{ values: m, role: "model", label: "mean" }]}
        band={{ lo: m.map((x, i) => (x === null ? null : x - a.k * (s[i] as number))), hi: m.map((x, i) => (x === null ? null : x + a.k * (s[i] as number))), label: "band" }}
        xLabel="Period"
      />
    );
  },
  "mean-reversion-half-life": (a, out) => {
    const s = a.spread as number[];
    const hl = +out;
    return (
      <SeriesFigure
        title="A spread decaying toward zero"
        desc={`The spread and an exponential decay with the fitted half-life of ${out} periods.`}
        values={s}
        overlays={[{ values: s.map((_, i) => s[0] * 0.5 ** (i / hl)), role: "model", label: `half-life ${hl}` }]}
        xLabel="Period"
        yLabel="Spread"
      />
    );
  },
  "linreg-channel": (a, out) => {
    const v = a.values as number[];
    const n = v.length;
    const xm = (n - 1) / 2;
    const ym = mean(v);
    const beta = v.reduce((s, y, i) => s + (i - xm) * (y - ym), 0) / v.reduce((s, _, i) => s + (i - xm) ** 2, 0);
    const fit = v.map((_, i) => ym + beta * (i - xm));
    const res = sd(v.map((y, i) => y - fit[i]));
    return (
      <SeriesFigure
        title="A least-squares line and its channel"
        desc={`The fitted line with a band ${a.k} residual standard deviations wide. At the last point: slope ${out[0]}, channel [${out[1]}, ${out[2]}].`}
        values={v}
        overlays={[{ values: fit, role: "model", label: "fit" }]}
        band={{ lo: fit.map((f) => f - a.k * res), hi: fit.map((f) => f + a.k * res), label: "channel" }}
        xLabel="Period"
      />
    );
  },
  "log-vs-simple-returns": (a) => {
    const p = a.prices as number[];
    const simple = p.slice(1).map((x, i) => x / p[i] - 1);
    return (
      <SeriesFigure
        title="Simple returns and log returns"
        desc="Each period's simple return and its log return. They agree for small moves and part as moves grow; log returns add across periods."
        values={simple}
        overlays={[{ values: p.slice(1).map((x, i) => Math.log(x / p[i])), role: "model", label: "log" }]}
        xLabel="Period"
        yLabel="Return"
      />
    );
  },
  "gbm-path": (a, out) => {
    const path = [a.S0, ...(out as number[])];
    return (
      <SeriesFigure
        title="One simulated path and its drift"
        desc={`A geometric Brownian motion from ${a.S0} with μ = ${a.mu} and σ = ${a.sigma}, against the expected path S₀·e^(μt).`}
        values={path}
        overlays={[{ values: path.map((_, i) => a.S0 * Math.exp(a.mu * a.dt * i)), role: "model", label: "expected" }]}
        xLabel="Step"
      />
    );
  },
  "barrier-touch-probability": (a, out) => {
    const u = rng(7);
    const n = 120;
    const dt = a.T / n;
    let S = a.S;
    const path = [S, ...range(n, () => (S *= Math.exp((a.r - 0.5 * a.sigma ** 2) * dt + a.sigma * Math.sqrt(dt) * gauss(u))))];
    return (
      <SeriesFigure
        title={`Will it touch ${a.B} within ${a.T} year?`}
        desc={`One sample path from ${a.S} against the barrier at ${a.B}. Across all paths the chance of touching it is ${out}.`}
        values={path}
        overlays={[{ values: path.map(() => a.B), role: "model", label: `barrier ${a.B}` }]}
        xLabel="Step"
      />
    );
  },
  "triple-barrier-labels": (a, out) => {
    const c = a.closes as number[];
    const p0 = c[a.i];
    return (
      <SeriesFigure
        title="Three barriers: profit, stop and time"
        desc={`From ${p0}: take profit at +${a.up * 100}%, stop at −${a.down * 100}%, or wait ${a.horizon} bars. Whichever comes first sets the label, here ${out}.`}
        values={c}
        overlays={[
          { values: c.map(() => p0 * (1 + a.up)), role: "model", label: "profit" },
          { values: c.map(() => p0 * (1 - a.down)), role: "ref", label: "stop" },
        ]}
        xLabel="Bar"
      />
    );
  },
  "quantile-signal": (a, out) => (
    <SeriesFigure
      title="A forecast's range, period by period"
      desc={`The 10th to 90th percentile band around the median forecast. The signal is ${JSON.stringify(out)}: long where the whole band clears zero, flat otherwise.`}
      values={a.p50}
      band={{ lo: a.p10, hi: a.p90, label: "p10–p90" }}
      overlays={[{ values: (a.p50 as number[]).map(() => 0), role: "ref", label: "zero" }]}
      xLabel="Period"
      yLabel="Return"
    />
  ),
  "regime-split-vix": (a, out) => (
    <SeriesFigure
      title="Volatility against its own recent average"
      desc={`VIX and its ${a.window}-day mean; above it is the high-volatility regime. The labels from day ${a.window} are ${JSON.stringify(out)}.`}
      values={a.vix}
      overlays={[{ values: rolling(a.vix, a.window, mean), role: "model", label: `${a.window}-day mean` }]}
      xLabel="Day"
      yLabel="VIX"
    />
  ),
  "vwap-session": (a, out) => {
    const bars = a.bars as number[][];
    let pv = 0;
    let vol = 0;
    const vwap = bars.map(([h, l, c, v]) => ((pv += ((h + l + c) / 3) * v), (vol += v), pv / vol));
    return (
      <SeriesFigure
        title="Price and the session's volume-weighted average"
        desc={`Each bar's close and the running VWAP of the typical price. At the session's end it is ${out}.`}
        values={bars.map((b) => b[2])}
        overlays={[{ values: vwap, role: "model", label: "VWAP" }]}
        xLabel="Bar"
      />
    );
  },
  "sma-crossover": (a, out) => {
    const c = a.closes as number[];
    return (
      <SeriesFigure
        title="A fast average crossing a slow one"
        desc={`The ${a.fast}- and ${a.slow}-period averages. The signal is +1 while the fast is above the slow: ${JSON.stringify(out)}.`}
        values={c}
        overlays={[
          { values: rolling(c, a.fast, mean), role: "model", label: `fast ${a.fast}` },
          { values: rolling(c, a.slow, mean), role: "single", label: `slow ${a.slow}` },
        ]}
        xLabel="Bar"
      />
    );
  },
  "donchian-breakout": (a, out) => {
    const hi = rolling(a.highs, a.window, (x) => Math.max(...x));
    const lo = rolling(a.lows, a.window, (x) => Math.min(...x));
    return (
      <SeriesFigure
        title="Closes inside the recent high-low channel"
        desc={`The ${a.window}-bar channel of highs and lows. A close above the previous channel top is a breakout: ${JSON.stringify(out)}.`}
        values={a.closes}
        band={{ lo, hi, label: "channel" }}
        overlays={[{ values: hi, role: "model", label: "channel top" }]}
        xLabel="Bar"
      />
    );
  },
  "long-only-backtest-costs": (a, out) => {
    const c = a.closes as number[];
    let eq = 1;
    const curve = [1, ...c.slice(1).map((x, i) => (eq *= a.signals[i] ? x / c[i] : 1))];
    return (
      <SeriesFigure
        title="Equity of a long-or-flat strategy"
        desc={`Long when the signal is 1, in cash when it is 0, at ${a.cost_bps} basis points a trade. It ends at ${out}.`}
        values={curve}
        xLabel="Bar"
        yLabel="Equity"
      />
    );
  },
  "drawdown-kill-switch": (a, out) => {
    let s = 0;
    const cum = (a.pnl as number[]).map((x) => (s += x));
    return (
      <SeriesFigure
        title="Cumulative P&L against the loss limit"
        desc={`Running P&L against −${a.limit}. Trading stops at the first breach and stays off: ${JSON.stringify(out)}.`}
        values={cum}
        overlays={[{ values: cum.map(() => -a.limit), role: "model", label: `limit −${a.limit}` }]}
        xLabel="Day"
        yLabel="P&L"
      />
    );
  },
  "pairs-cointegration": (a, out) => {
    const x = a.x as number[];
    const y = a.y as number[];
    const beta = +out[0];
    const alpha = mean(y) - beta * mean(x);
    return (
      <SeriesFigure
        title="One series and its hedge from the other"
        desc={`y against α + β·x with the fitted β = ${out[0]}. What is left over is the spread, with standard deviation ${out[1]}.`}
        values={y}
        overlays={[{ values: x.map((v) => alpha + beta * v), role: "model", label: "α + βx" }]}
        xLabel="Period"
      />
    );
  },

  // ── bars and histograms ───────────────────────────────────────────────────
  "sharpe-ratio": (a, out) => (
    <CashLadderFigure
      title="Returns period by period"
      desc={`Each period's return; their mean over their standard deviation, annualised over ${a.periods} periods, is a Sharpe ratio of ${out}.`}
      flows={(a.returns as number[]).map((r, i) => ({ t: i + 1, amount: r * 100 }))}
      xLabel="Period"
      yLabel="Return %"
    />
  ),
  "monte-carlo-var": (a, out) => {
    const u = rng(a.seed);
    const T = a.days / 252;
    const rets = range(a.n, () => (Math.exp((a.mu - 0.5 * a.sigma ** 2) * T + a.sigma * Math.sqrt(T) * gauss(u)) - 1) * 100);
    const v = -100 * +out;
    return (
      <HistogramFigure
        title={`${a.n} simulated ${a.days}-day returns`}
        desc={`The worst ${a.alpha * 100}% of outcomes are shaded. Value at risk is the loss at that line: ${out} of the position.`}
        bins={hist(rets, 24)}
        tail={{ below: v, role: "loss", label: `worst ${a.alpha * 100}%` }}
        marker={{ x: v, label: `VaR ${(+out * 100).toFixed(2)}%` }}
        xLabel="Return %"
      />
    );
  },
  "expected-value-bet": (a, out) => (
    <HistogramFigure
      title="What the bet can pay, and how likely"
      desc={`Each outcome's payoff and probability; the probability-weighted average less the stake is ${out}.`}
      bins={(a.outcomes as number[][]).map(([p, x]) => ({ x0: x - 0.15, x1: x + 0.15, count: p })).sort((u, v) => u.x0 - v.x0)}
      marker={{ x: +out + a.stake, label: `EV ${out}` }}
      xLabel="Payoff"
      yLabel="Probability"
    />
  ),
  "autocorrelation-lag-k": (a, out) => {
    const x = a.x as number[];
    const m = mean(x);
    const v = x.reduce((s, y) => s + (y - m) ** 2, 0);
    const ac = (k: number) => x.slice(k).reduce((s, y, i) => s + (y - m) * (x[i] - m), 0) / v;
    return (
      <CashLadderFigure
        title="A correlogram"
        desc={`The series' correlation with itself shifted by each lag. At lag ${a.k} it is ${out}.`}
        flows={range(Math.max(1, x.length - 2), (i) => ({ t: i + 1, amount: ac(i + 1) }))}
        xLabel="Lag"
        yLabel="Autocorrelation"
        tone="neutral"
      />
    );
  },

  // ── lattice ───────────────────────────────────────────────────────────────
  "binomial-american-put": (a, out) => {
    const n = 6;
    const dt = a.T / n;
    const up = Math.exp(a.sigma * Math.sqrt(dt));
    const q = (Math.exp(a.r * dt) - 1 / up) / (up - 1 / up);
    const disc = Math.exp(-a.r * dt);
    const lit: [number, number][] = [];
    let v = range(n + 1, (j) => Math.max(0, a.K - a.S * up ** (2 * j - n)));
    for (let i = n - 1; i >= 0; i--) {
      v = range(i + 1, (j) => {
        const cont = disc * (q * v[j + 1] + (1 - q) * v[j]);
        const ex = a.K - a.S * up ** (2 * j - i);
        if (ex > cont && ex > 0) lit.push([i, j]);
        return Math.max(cont, ex);
      });
    }
    return (
      <LatticeFigure
        title="Where exercising early beats waiting"
        desc={`A ${n}-step tree for the example's put (the judge uses ${a.steps} steps and prices it at ${out}). Lit nodes are where the put is worth more exercised now than held.`}
        steps={n}
        lit={lit}
        litLabel="exercise early"
        height={240}
      />
    );
  },

  // ── fold strips ───────────────────────────────────────────────────────────
  "purged-embargo-kfold": (a) => {
    const size = a.n / a.k;
    return (
      <FoldStripsFigure
        title={`${a.k} folds, purged and embargoed`}
        desc={`Each fold tests one block of ${size} samples; ${a.purge} samples on each side of it are purged from training and ${a.embargo} after it embargoed, so nothing leaks across the boundary.`}
        length={a.n}
        folds={range(a.k, (j) => {
          const t0 = j * size;
          const t1 = t0 + size;
          const segs: { from: number; to: number; kind: FoldKind }[] = [];
          const p0 = Math.max(0, t0 - a.purge);
          const p1 = Math.min(a.n, t1 + a.purge);
          const e1 = Math.min(a.n, p1 + a.embargo);
          if (p0 > 0) segs.push({ from: 0, to: p0, kind: "train" });
          if (t0 > p0) segs.push({ from: p0, to: t0, kind: "purge" });
          segs.push({ from: t0, to: t1, kind: "test" });
          if (p1 > t1) segs.push({ from: t1, to: p1, kind: "purge" });
          if (e1 > p1) segs.push({ from: p1, to: e1, kind: "embargo" });
          if (e1 < a.n) segs.push({ from: e1, to: a.n, kind: "train" });
          return { label: `fold ${j + 1}`, segments: segs };
        })}
      />
    );
  },
  "walk-forward-folds": (a, out) => (
    <FoldStripsFigure
      title="Walk-forward: train on the past, test on what follows"
      desc={`${a.folds} folds over ${a.n} samples; each trains on everything before its test block and never on anything after.`}
      length={a.n}
      folds={(out as number[][]).map(([s0, s1, t0, t1], j) => ({
        label: `fold ${j + 1}`,
        segments: [
          { from: s0, to: s1 + 1, kind: "train" as const },
          { from: t0, to: t1 + 1, kind: "test" as const },
        ],
      }))}
    />
  ),
  "stacking-oof-features": (a) => {
    const n = (a.y as number[]).length;
    const size = n / a.k;
    return (
      <FoldStripsFigure
        title="Out-of-fold predictions"
        desc={`${a.k} folds over ${n} rows. Each row's prediction comes from a model that never saw it: trained on the other folds, used on this one.`}
        length={n}
        folds={range(a.k, (j) => ({
          label: `fold ${j + 1}`,
          segments: [
            ...(j > 0 ? [{ from: 0, to: j * size, kind: "train" as const }] : []),
            { from: j * size, to: (j + 1) * size, kind: "test" as const },
            ...(j < a.k - 1 ? [{ from: (j + 1) * size, to: n, kind: "train" as const }] : []),
          ],
        }))}
      />
    );
  },

  // ── cash-flow ladders ─────────────────────────────────────────────────────
  "bond-price-duration": (a, out) => {
    const c = (a.face * a.coupon_rate) / a.freq;
    const n = a.years * a.freq;
    return (
      <CashLadderFigure
        title="A bond's cash flows"
        desc={`Pay ${out[0]} today; receive a coupon of ${c} each period and the ${a.face} face value at the end. Its duration is ${out[1]} years.`}
        flows={[{ t: 0, amount: -out[0] }, ...range(n, (i) => ({ t: (i + 1) / a.freq, amount: c + (i === n - 1 ? a.face : 0) }))]}
        xLabel="Year"
      />
    );
  },
  "pv-cash-flow-ladder": (a, out) => {
    const cf = a.cashflows as number[];
    return (
      <CashLadderFigure
        title="Cash flows to discount"
        desc={`${cf.length} cash flows (plus ${a.terminal} at the end) discounted at ${a.rate * 100}% a period are worth ${out} today.`}
        flows={cf.map((x, i) => ({ t: i + 1, amount: x + (i === cf.length - 1 ? a.terminal : 0) }))}
        xLabel="Period"
      />
    );
  },
  "wheel-cash-flow-ledger": (a, out) => (
    <CashLadderFigure
      title="The wheel's premiums, event by event"
      desc={`Each option sold brings in its premium. Across these events the ledger nets ${out}.`}
      flows={(a.events as [string, number][]).map(([, x], i) => ({ t: i + 1, amount: x }))}
      xLabel="Event"
      yLabel="Premium"
    />
  ),

  // ── iteration ─────────────────────────────────────────────────────────────
  "implied-vol-bisection": (a, out) => {
    let lo = 0.01;
    let hi = 1;
    const steps = range(7, () => {
      const m = (lo + hi) / 2;
      const s = { lo, hi, x: m };
      if (call(a.S, a.K, a.T, a.r, m).price > a.price) hi = m;
      else lo = m;
      return s;
    });
    return <IterationFigure title="Bisection closing on the volatility" desc={`Each step halves the bracket around the volatility that prices the call at ${a.price}. It closes on ${out}.`} steps={steps} answer={+out} xLabel="Volatility" />;
  },
  "newton-method-root": (a, out) => {
    const c = a.coeffs as number[];
    const f = (x: number) => c.reduce((s, k) => s * x + k, 0);
    const df = (x: number) => c.slice(0, -1).reduce((s, k, i) => s * x + k * (c.length - 1 - i), 0);
    let x = a.x0;
    const steps = [{ x }];
    for (let i = 0; i < 5; i++) {
      x = x - f(x) / df(x);
      steps.push({ x });
    }
    return <IterationFigure title="Newton's method closing on a root" desc={`Each step follows the tangent from the last guess to where it crosses zero, starting from ${a.x0}. It reaches ${out[0]} in ${out[1]} steps.`} steps={steps} answer={+out[0]} xLabel="x" />;
  },

  // ── matrices ──────────────────────────────────────────────────────────────
  "cholesky-correlated-shocks": (a, out) => {
    const L = out as number[][];
    const names = L.map((_, i) => `z${i + 1}`);
    return <MatrixFigure title="The Cholesky factor" desc={`The lower-triangular L with L·Lᵀ equal to the covariance ${JSON.stringify(a.a)}. Multiplying independent shocks by L gives them that covariance.`} rows={names} cols={names} values={L} showValues format={(v) => v.toFixed(2)} />;
  },
  "portfolio-variance": (a, out) => {
    const w = a.w as number[];
    const names = w.map((_, i) => `a${i + 1}`);
    return <MatrixFigure title={`The covariance the weights (${w.join(", ")}) sit on`} desc={`Portfolio variance is wᵀΣw: each cell weighted by both weights and summed. Here it is ${out}.`} rows={names.map((n, i) => `${n} · w ${w[i]}`)} cols={names} values={a.cov} showValues format={(v) => v.toFixed(3)} />;
  },
  "feature-matrix": (a, out) => (
    <MatrixFigure title="Features from the last window" desc={`The features computed from the last ${a.window} closes: ${JSON.stringify(out)}.`} rows={["value"]} cols={(out as number[]).map((_, i) => `f${i + 1}`)} values={[out]} showValues format={(v) => v.toFixed(3)} />
  ),
  "cross-sectional-rank": (a, out) => (
    <MatrixFigure
      title="Ranked across the cross-section"
      desc={`Each value's rank among the others, scaled to 0–1: ${JSON.stringify(out)}.`}
      rows={["rank"]}
      cols={(a.values as number[]).map((v) => fmt(v, 2))}
      values={[out]}
      domain={[0, 1]}
      showValues
      format={(v) => v.toFixed(2)}
    />
  ),

  // ── depth ladders ─────────────────────────────────────────────────────────
  "position-size-by-stop": (a, out) => {
    // what a stop-out costs grows with the size; the size is where it meets the budget
    const d = Math.abs(a.entry - a.stop);
    const budget = a.equity * a.risk_frac;
    const n = +out;
    return (
      <CurveFigure
        title="The size where a stop-out costs the budget"
        desc={`Each share loses ${fmt(d, 2)} if the stop at ${a.stop} is hit after buying at ${a.entry}. Risking ${a.risk_frac * 100}% of ${a.equity} (${usd(budget)}) allows ${out} shares.`}
        x={{ domain: [0, n * 2], label: "Shares" }}
        y={{ label: "Lost at the stop" }}
        lines={[
          { points: [[0, budget], [n * 2, budget]], role: "ref", label: "risk budget" },
          { points: [[0, 0], [n * 2, n * 2 * d]], role: "loss", label: "loss at the stop" },
        ]}
        verticals={[{ x: n, label: `${out} shares` }]}
        markers={[{ x: n, y: n * d, role: "loss" }]}
      />
    );
  },
  "order-book-micro-price": (a, out) => (
    <DepthLadderFigure
      title="The top of the book and its micro-price"
      desc={`Best bid ${a.bid} for ${a.bid_size}, best ask ${a.ask} for ${a.ask_size}. Weighting each side by the other's size gives the micro-price ${out}.`}
      levels={[
        { price: a.ask, ask: a.ask_size },
        { price: a.bid, bid: a.bid_size },
      ]}
      micro={+out}
    />
  ),
};

/** Slugs that have a figure. The test checks it covers every problem. */
export const FIGURE_SLUGS = Object.keys(B);

/** The figure for a problem, built from its first example; null if it has none. */
export function problemFigure(p: Problem): ReactNode {
  const build = B[p.id];
  const ex = p.examples[0];
  if (!build || !ex) return null;
  try {
    return build(parseArgs(ex.input), parseOut(ex.output));
  } catch {
    return null; // a figure must never take the problem page down
  }
}

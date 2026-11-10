// The Heston (1993) stochastic-volatility price, semi-analytic: the two
// probabilities in its closed form are integrals of the model's characteristic
// function, taken numerically here. Written in the "little Heston trap" form
// (Albrecher et al. 2007), which stays continuous for long maturities.
//
// This is the model itself, not the network in "Heston SV Pricer (NN)" that
// learned it; the bot shows this when the network cannot be reached.

type C = [number, number]; // re, im

const add = (a: C, b: C): C => [a[0] + b[0], a[1] + b[1]];
const sub = (a: C, b: C): C => [a[0] - b[0], a[1] - b[1]];
const mul = (a: C, b: C): C => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a: C, b: C): C => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const cexp = (a: C): C => {
  const e = Math.exp(a[0]);
  return [e * Math.cos(a[1]), e * Math.sin(a[1])];
};
const clog = (a: C): C => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])];
// The principal root, in the stable form: computing the small part as
// √((|a| − re)/2) cancels to zero when a is nearly real, which flattened the
// integrand near φ = 0 and biased every price by about a cent.
const csqrt = (a: C): C => {
  const m = Math.hypot(a[0], a[1]);
  if (a[0] >= 0) {
    const r = Math.sqrt((m + a[0]) / 2);
    return r === 0 ? [0, 0] : [r, a[1] / (2 * r)];
  }
  const i = Math.sqrt((m - a[0]) / 2);
  return [Math.abs(a[1]) / (2 * i), a[1] < 0 ? -i : i];
};
const re = (x: number): C => [x, 0];

export type HestonParams = {
  S: number;
  K: number;
  T: number; // years
  r: number;
  v0: number; // initial variance
  kappa: number;
  theta: number; // long-run variance
  xi: number; // vol of vol
  rho: number;
};

/** P_j of the closed form, j = 1 or 2. */
function prob(j: 1 | 2, p: HestonParams) {
  const { S, K, T, r, v0, kappa, theta, xi, rho } = p;
  const u = j === 1 ? 0.5 : -0.5;
  const b = j === 1 ? kappa - rho * xi : kappa;
  const a = kappa * theta;
  const x = Math.log(S);
  const lnK = Math.log(K);
  const integrand = (phi: number) => {
    const iphi: C = [0, phi];
    const bm = sub(re(b), mul(re(rho * xi), iphi)); // b − ρξiφ
    const d = csqrt(sub(mul(bm, bm), mul(re(xi * xi), sub(mul(re(2 * u), iphi), re(phi * phi)))));
    const g = div(sub(bm, d), add(bm, d));
    const edT = cexp(mul(re(-T), d));
    const oneMinusGedT = sub(re(1), mul(g, edT));
    const Cj = add(
      mul(re(r * T), iphi),
      mul(re(a / (xi * xi)), sub(mul(sub(bm, d), re(T)), mul(re(2), clog(div(oneMinusGedT, sub(re(1), g)))))),
    );
    const Dj = mul(div(sub(bm, d), re(xi * xi)), div(sub(re(1), edT), oneMinusGedT));
    const f = cexp(add(add(Cj, mul(Dj, re(v0))), mul(iphi, re(x))));
    const val = div(mul(cexp(mul(iphi, re(-lnK))), f), iphi);
    return val[0];
  };
  // Simpson's rule on (0, 200]: the integrand is smooth and decays fast.
  const N = 2000;
  const hi = 200;
  const h = hi / N;
  let s = integrand(1e-8) + integrand(hi);
  for (let k = 1; k < N; k++) s += (k % 2 ? 4 : 2) * integrand(k * h);
  return 0.5 + (s * h) / 3 / Math.PI;
}

export function hestonPrice(p: HestonParams, type: "C" | "P") {
  const disc = Math.exp(-p.r * p.T);
  const call = p.S * prob(1, p) - p.K * disc * prob(2, p);
  return Math.max(0, type === "C" ? call : call - p.S + p.K * disc);
}

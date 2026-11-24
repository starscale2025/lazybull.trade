import { describe, it, expect } from "vitest";
import { hestonPrice, type HestonParams } from "@/lib/quant/heston";
import { priceOption } from "@/lib/pricing";

// The Heston bot's fallback is the model itself, so it has to be right: it
// collapses to Black-Scholes when volatility stops being random, agrees with
// a Monte Carlo of the same dynamics, and puts the skew where ρ < 0 puts it
// (an out-of-the-money put dearer than flat-vol Black-Scholes, a call cheaper).

const base: HestonParams = { S: 100, K: 100, T: 60 / 365, r: 0.045, v0: 0.04, kappa: 2, theta: 0.04, xi: 0.5, rho: -0.7 };

// A seeded Monte Carlo of the same model (full-truncation Euler).
function mcHeston(p: HestonParams, type: "C" | "P", paths = 40_000, steps = 120) {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
  const dt = p.T / steps;
  let sum = 0;
  for (let n = 0; n < paths; n++) {
    let x = Math.log(p.S);
    let v = p.v0;
    for (let k = 0; k < steps; k++) {
      const z1 = gauss();
      const z2 = p.rho * z1 + Math.sqrt(1 - p.rho * p.rho) * gauss();
      const vp = Math.max(v, 0);
      x += (p.r - 0.5 * vp) * dt + Math.sqrt(vp * dt) * z1;
      v += p.kappa * (p.theta - vp) * dt + p.xi * Math.sqrt(vp * dt) * z2;
    }
    const s = Math.exp(x);
    sum += type === "C" ? Math.max(s - p.K, 0) : Math.max(p.K - s, 0);
  }
  return (sum / paths) * Math.exp(-p.r * p.T);
}

describe("hestonPrice", () => {
  // Not ξ → 0 itself: κθ/ξ² then cancels catastrophically in floating point.
  // The UI's smallest ξ is 0.05.
  it("is Black-Scholes when vol of vol is small, uncorrelated, and v0 = theta", () => {
    for (const K of [90, 100, 110]) {
      const p = { ...base, K, xi: 0.02, rho: 0 };
      const bs = priceOption(p.S, K, p.T, p.r, Math.sqrt(p.v0), "C").price;
      expect(hestonPrice(p, "C")).toBeCloseTo(bs, 2);
    }
  });

  it("satisfies put-call parity", () => {
    const p = { ...base, K: 95 };
    const parity = hestonPrice(p, "C") - hestonPrice(p, "P");
    expect(parity).toBeCloseTo(p.S - p.K * Math.exp(-p.r * p.T), 6);
  });

  // Three Monte Carlo runs take about four seconds by themselves and six when
  // the rest of the suite is running beside them: over vitest's 5 s default,
  // so the case failed on time, never on its numbers. It gets room.
  it("agrees with a Monte Carlo of the same dynamics", () => {
    for (const [K, type] of [[90, "P"], [100, "C"], [110, "C"]] as const) {
      const p = { ...base, K };
      const exact = hestonPrice(p, type);
      const mc = mcHeston(p, type);
      expect(Math.abs(exact - mc)).toBeLessThan(Math.max(0.06, 0.04 * exact));
    }
  }, 30_000);

  it("puts the skew where a negative rho puts it", () => {
    const flat = Math.sqrt(base.v0);
    const put = { ...base, K: 90 };
    const call = { ...base, K: 110 };
    expect(hestonPrice(put, "P")).toBeGreaterThan(priceOption(put.S, 90, put.T, put.r, flat, "P").price);
    expect(hestonPrice(call, "C")).toBeLessThan(priceOption(call.S, 110, call.T, call.r, flat, "C").price);
  });
});

/**
 * Additions to lib/pricing.ts — keep the existing analytical priceOption()
 * for offline/SSR fallback, ADD these AI-backed variants.
 */
import { priceBS, priceAmerican, solveIV, priceHeston } from "./quant-ai";

/**
 * Drop-in replacement for valueLive() / valueStrategy() that uses the
 * neural BS surrogate. Returns price + ALL 5 Greeks in one round-trip
 * (vs the existing code which computes each separately).
 *
 * Use this on user-facing chart updates, strategy cards, options chain rows.
 */
export async function priceOptionAI(p: {
  S: number; K: number; T: number; r: number; sigma: number; flag: "c" | "p";
}) {
  return priceBS(p);
}

/**
 * Solve IV from an observed market price. Replace any Newton-Raphson IV
 * solver in the codebase with this (the NN beats Newton on edge cases
 * near expiry / deep ITM).
 */
export async function impliedVolAI(p: {
  price: number; S: number; K: number; T: number; r: number; flag: "c" | "p";
}) {
  const { sigma } = await solveIV(p);
  return sigma;
}

/**
 * For American-style options (the wedge UI when "early exercise" is on).
 * Uses Bjerksund-Stensland-equivalent neural model.
 */
export async function priceAmericanAI(p: {
  S: number; K: number; T: number; r: number; sigma: number; flag: "c" | "p";
}) {
  const { price } = await priceAmerican(p);
  return price;
}

/**
 * Heston pricer for vol-skew sensitive payoffs. Heavy params — only call
 * when the user opens the "advanced model" tab in the strategy card.
 */
export async function priceHestonAI(p: {
  S: number; K: number; T: number; r: number;
  v0: number; kappa: number; theta: number; xi: number; rho: number; flag: "c" | "p";
}) {
  const { price } = await priceHeston(p);
  return price;
}

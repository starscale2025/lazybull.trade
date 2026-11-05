// Price arithmetic for both rails, derived from PLAN_PRICES and nothing else.
//
// The pricing page, the checkout, the webhook writers (amountMinor on every
// subscription row, which the admin dashboard sums into MRR) and the account
// page all go through here, so a "$180 billed annually" on one surface and
// 18000 cents on another can never disagree. Pure; safe for client bundles.

import { PLAN_PRICES } from "./types";
import type { Currency, Interval, PaidPlan } from "./config";

export const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", INR: "₹" };

/** List price per month: the monthly price, or the effective monthly when billed annually. */
export function monthlyPrice(plan: PaidPlan, interval: Interval, currency: Currency): number {
  const p = PLAN_PRICES[plan];
  if (currency === "INR") return interval === "year" ? p.inrAnnualMonthly : p.inrMonthly;
  return interval === "year" ? p.usdAnnualMonthly : p.usdMonthly;
}

/** What one annual invoice comes to. */
export function annualTotal(plan: PaidPlan, currency: Currency): number {
  return monthlyPrice(plan, "year", currency) * 12;
}

/** The recurring charge per `interval` in minor units (cents / paise). */
export function amountMinor(plan: PaidPlan, interval: Interval, currency: Currency): number {
  const major = interval === "year" ? annualTotal(plan, currency) : monthlyPrice(plan, "month", currency);
  return Math.round(major * 100);
}

/** Whole months of the monthly price an annual plan saves, floored (so the badge never overstates). */
export function monthsSaved(plan: PaidPlan, currency: Currency): number {
  const monthly = monthlyPrice(plan, "month", currency);
  if (monthly <= 0) return 0;
  return Math.floor((monthly * 12 - annualTotal(plan, currency)) / monthly);
}

/** "$39" / "₹3,588" — thousands-grouped, no decimals (every list price is whole). */
export function fmtMoney(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOL[currency]}${Math.round(amount).toLocaleString("en-US")}`;
}

/** Minor units back to a display string: 18000 → "$180". */
export function fmtMinor(minor: number, currency: Currency): string {
  return fmtMoney(minor / 100, currency);
}

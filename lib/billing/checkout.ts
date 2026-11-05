// Checkout orchestration — picks the rail by currency and hands back a URL
// the browser navigates to, or an honest reason it cannot.
//
// There is no client-side payment code anywhere in this app: both rails are
// hosted pages on the provider's own domain, reached by a plain navigation.
// Card and UPI details never touch lazybull, and neither provider needs a
// script or frame origin added to the CSP in proxy.ts.

import { z } from "zod";
import { checkoutConfigured, providerFor, type CheckoutProvider, type Currency, type Interval, type PaidPlan } from "./config";
import { lsCheckoutUrl } from "./lemonsqueezy";
import { createRazorpaySubscription } from "./razorpay";

export const CheckoutBody = z.object({
  plan: z.enum(["plus", "pro", "power"]),
  interval: z.enum(["month", "year"]),
  currency: z.enum(["USD", "INR"]),
});
export type CheckoutBody = z.infer<typeof CheckoutBody>;

/** Largest checkout request body (chars) — three short enums. */
export const MAX_CHECKOUT_BODY_BYTES = 500;

export type CheckoutResult =
  | { ok: true; url: string; provider: CheckoutProvider }
  | { ok: false; error: "billing_not_configured" | "checkout_failed"; provider: CheckoutProvider };

export async function createCheckout(args: {
  plan: PaidPlan;
  interval: Interval;
  currency: Currency;
  userId: string;
  email?: string | null;
}): Promise<CheckoutResult> {
  const provider = providerFor(args.currency);
  if (!checkoutConfigured(args.plan, args.interval, args.currency)) {
    return { ok: false, error: "billing_not_configured", provider };
  }
  if (provider === "lemonsqueezy") {
    const url = lsCheckoutUrl(args);
    return url ? { ok: true, url, provider } : { ok: false, error: "billing_not_configured", provider };
  }
  try {
    const { url } = await createRazorpaySubscription(args);
    return { ok: true, url, provider };
  } catch (e) {
    console.error("razorpay checkout failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "checkout_failed", provider };
  }
}

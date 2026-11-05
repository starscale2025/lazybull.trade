"use client";

// The buy button — or the honest alternative.
//
//   signed out               → sign in first. The user id is the webhook's
//                              join key (app/api/billing/checkout); an
//                              anonymous checkout could never be entitled.
//   signed in, rail live     → POST /api/billing/checkout and navigate to the
//                              provider's hosted page. No payment form of
//                              ours, ever — the card or UPI mandate is
//                              collected on lemonsqueezy.com / razorpay.com.
//   rail not configured      → the inline waitlist (WaitlistForm), which is
//                              what the 2026-09 diligence memo asked for in
//                              place of CTAs that "route to sign-in".
//
// "Live" comes from /api/billing/config per currency. A plan whose id is
// missing on a live rail (Power, until it ships) answers 503 at click time and
// this falls back to the waitlist, so the page never shows a button that goes
// nowhere.

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { Currency, Interval, PaidPlan } from "@/lib/billing/config";
import { ctaClass } from "./tiers";
import { WaitlistForm } from "./WaitlistForm";

export function PlanCta({
  plan,
  interval,
  currency,
  configured,
  soon,
  primary,
  waitlistCount,
  priceLabel,
}: {
  plan: PaidPlan;
  interval: Interval;
  currency: Currency;
  /** The rail for `currency` is live (from /api/billing/config). */
  configured: boolean;
  soon?: boolean;
  primary?: boolean;
  waitlistCount: number;
  /** "$19/mo" — what the button promises, from lib/billing/prices.ts. */
  priceLabel: string;
}) {
  const { status } = useSession();
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (soon || !configured || fallback) {
    return (
      <WaitlistForm
        tier={plan}
        currency={currency}
        count={waitlistCount}
        primary={primary}
        soon={soon}
        reason={
          soon
            ? "coming soon · ships with a licensed IV feed"
            : `${currency === "INR" ? "₹" : "$"} checkout is not open yet · nothing charged`
        }
      />
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mt-6">
        <Link href="/auth/signin?callbackUrl=/pricing" className={ctaClass({ primary })} aria-disabled={status === "loading"}>
          {status === "loading" ? "…" : "Sign in to subscribe"}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </Link>
        <div className="mt-2 t-chrome text-fg-faint">free account first · {priceLabel} after</div>
      </div>
    );
  }

  const buy = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval, currency }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (r.ok && j?.ok && typeof j.url === "string" && j.url.startsWith("https://")) {
        window.location.assign(j.url);
        return; // the page is leaving; keep the button in its busy state
      }
      if (r.status === 503) {
        setFallback(true); // this plan × interval has no id on the rail yet
        return;
      }
      setError(
        r.status === 401
          ? "session expired — sign in again"
          : r.status === 429
            ? "too many attempts — wait a minute"
            : "checkout could not start — try again",
      );
    } catch {
      setError("offline — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <button type="button" onClick={buy} disabled={busy} className={ctaClass({ primary })}>
        {busy ? "opening checkout…" : `Subscribe · ${priceLabel}`}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <div className="mt-2 t-chrome text-fg-faint">
        {currency === "INR" ? "UPI autopay or card · via Razorpay" : "card · via Lemon Squeezy"} · cancel any time
      </div>
      {error && (
        <div className="mt-1 t-chrome text-bear" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

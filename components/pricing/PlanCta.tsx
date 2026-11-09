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
import { PillButton } from "@/components/calm/kit";
import { WaitlistForm } from "./WaitlistForm";

// The kit's PillLink, spelled out: this one link needs aria-disabled while the
// session loads, and PillLink takes no extra attributes.
const SIGN_IN_PILL =
  "inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[0.9375rem] tracking-[-0.01em] transition-[transform,box-shadow,background-color,color] duration-300 [transition-timing-function:var(--ease-settle)] hover:-translate-y-px";

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
            ? "Coming soon · ships with a licensed IV feed"
            : "Checkout is not open yet · nothing is charged"
        }
      />
    );
  }

  if (status !== "authenticated") {
    return (
      <div className="mt-6">
        <Link
          href="/auth/signin?callbackUrl=/pricing"
          className={`${SIGN_IN_PILL} ${primary ? "btn-grad font-semibold" : "calm-pill-secondary font-medium text-fg"}`}
          aria-disabled={status === "loading"}
        >
          {status === "loading" ? "…" : "Sign in to subscribe"}
        </Link>
        <div className="mt-2 t-label text-fg-faint">Free account first · {priceLabel} after</div>
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
          ? "Session expired — sign in again"
          : r.status === 429
            ? "Too many attempts — wait a minute"
            : "Checkout could not start — try again",
      );
    } catch {
      setError("Offline — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <PillButton kind={primary ? "primary" : "secondary"} onClick={buy} disabled={busy} className="w-full">
        {busy ? "Opening checkout…" : `Subscribe · ${priceLabel}`}
      </PillButton>
      <div className="mt-2 t-label text-fg-faint">
        {currency === "INR" ? "UPI autopay or card · via Razorpay" : "Card · via Lemon Squeezy"} · cancel any time
      </div>
      {error && (
        <div className="mt-1 t-label text-fg" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

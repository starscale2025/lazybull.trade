"use client";

// Pricing — the plan ladder (docs/strategy §4) in the house style, wired to
// the money rail. Every feature line comes from PLAN_LIMITS through
// components/pricing/tiers.ts and every price from PLAN_PRICES through
// lib/billing/prices.ts, so nothing on this page can drift from what the
// gates enforce or the checkout charges. The CTA (components/pricing/PlanCta)
// is a real checkout when the rail for the chosen currency is configured and
// a real waitlist when it is not — never a fake checkout, and never the
// "CTAs route to sign-in" the 2026-09 diligence memo found. Design ref:
// docs/design-refs/08-pricing.png.
import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import type { Currency, PaidPlan } from "@/lib/billing/config";
import { annualTotal, fmtMoney, monthlyPrice, monthsSaved } from "@/lib/billing/prices";
import { buildTiers, ctaClass } from "@/components/pricing/tiers";
import { PlanCta } from "@/components/pricing/PlanCta";
import { useBillingConfig } from "@/components/pricing/useBillingConfig";

const TIERS = buildTiers();
const PAID = TIERS.map((t) => t.id).filter((id): id is PaidPlan => id !== "free");

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const { config, counts } = useBillingConfig();

  // ₹ by default for a visitor the edge places in India; a touched toggle
  // wins, so a late config answer can never flip a currency already chosen.
  const [currency, setCurrency] = useState<Currency>("USD");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  useEffect(() => {
    if (!currencyTouched && config.loaded && config.region === "IN") setCurrency("INR");
  }, [config.loaded, config.region, currencyTouched]);
  const pickCurrency = (c: Currency) => {
    setCurrencyTouched(true);
    setCurrency(c);
  };

  const interval = annual ? "year" : "month";
  const configured = currency === "INR" ? config.providers.inr : config.providers.usd;
  // Derived, so the badge can never claim a saving the prices below don't show.
  const maxMonthsSaved = Math.max(...PAID.map((p) => monthsSaved(p, currency)));

  // The strip under the cards says exactly what the config says — which rail
  // is live, or that none is and the lists are what they are.
  const liveRails = [
    config.providers.usd && "Lemon Squeezy (USD cards · merchant of record)",
    config.providers.inr && "Razorpay (INR · UPI autopay & cards)",
  ].filter(Boolean);
  const railNote = !config.loaded
    ? "checking which billing rails are live…"
    : liveRails.length === 0
      ? "Checkout is not open yet. Joining a list records demand for that tier in your currency — nothing is charged and there is no card to enter."
      : `Billing by ${liveRails.join(" and ")} · cancel any time · access runs to the end of the paid period.`;

  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="tap-floor shell section-y">
        {/* header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="t-eyebrow text-fg-faint">
            Pricing
          </div>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02] tracking-tightest text-fg [text-wrap:balance]">
            Start free.{" "}
            <span className="t-accent">Upgrade when it clicks.</span>
          </h1>
          <p className="mt-5 font-mono text-[0.75rem] uppercase tracking-[0.25em] text-fg-dim">
            practice with purpose · upgrade for power
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {/* billing toggle */}
            <div className="inline-flex flex-wrap items-center justify-center gap-3 surface-card border border-border bg-surface px-4 py-2.5">
              <button
                onClick={() => setAnnual(false)}
                aria-pressed={!annual}
                className={`whitespace-nowrap font-mono text-[0.6875rem] uppercase tracking-wider transition-colors ${!annual ? "text-fg" : "text-fg-faint hover:text-fg-dim"}`}
              >
                Billed monthly
              </button>
              <button
                onClick={() => setAnnual(!annual)}
                // The toggle's state was conveyed by colour alone — a screen
                // reader (or anyone who can't see the green) got no signal at all
                // about which billing period was active.
                role="switch"
                aria-checked={annual}
                aria-label="Bill annually"
                className={`relative h-5 w-10 rounded-full border transition-colors ${annual ? "border-white/20 bg-[image:var(--grad-fill)]" : "border-border bg-bg"}`}
              >
                <span
                  className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full transition-all ${annual ? "left-[1.375rem] bg-[var(--grad-on)]" : "left-1 bg-fg-dim"}`}
                />
              </button>
              <button
                onClick={() => setAnnual(true)}
                aria-pressed={annual}
                className={`whitespace-nowrap font-mono text-[0.6875rem] uppercase tracking-wider transition-colors ${annual ? "text-grad" : "text-fg-faint hover:text-fg-dim"}`}
              >
                Billed annually
              </button>
              {annual && maxMonthsSaved > 0 && (
                <span className="border-grad whitespace-nowrap bg-[rgba(123,92,255,0.1)] px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider max-sm:basis-full max-sm:text-center">
                  <span className="text-grad">save up to {maxMonthsSaved} months</span>
                </span>
              )}
            </div>

            {/* currency toggle — $ via Lemon Squeezy, ₹ via Razorpay */}
            <div
              role="group"
              aria-label="Currency"
              className="inline-flex items-center gap-1 surface-card border border-border bg-surface p-1"
            >
              {(["USD", "INR"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => pickCurrency(c)}
                  aria-pressed={currency === c}
                  className={`px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors ${
                    currency === c ? "bg-[rgba(123,92,255,0.16)]" : "text-fg-faint hover:text-fg-dim"
                  }`}
                >
                  {/* On a span, not the button: background-clip:text would clip the
                      button's own tint away with the gradient. */}
                  <span className={currency === c ? "text-grad" : undefined}>{c === "USD" ? "$ USD" : "₹ INR"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* tier cards */}
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((t) => {
            const price = t.id === "free" ? 0 : monthlyPrice(t.id, interval, currency);
            return (
              <div
                key={t.id}
                id={t.id}
                className={`relative flex scroll-mt-28 flex-col border bg-surface p-6 ${
                  t.primary ? "border-grad border-transparent shadow-[var(--grad-glow)]" : "border-border"
                } ${t.soon ? "opacity-80" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-mono text-[0.6875rem] uppercase tracking-[0.25em] text-fg-dim">
                    {t.name}
                  </div>
                  {t.soon && (
                    <span className="shrink-0 border border-border bg-bg px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-fg-faint">
                      Coming soon
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-5xl tracking-tightest text-fg">
                    {fmtMoney(price, currency)}
                  </span>
                  <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-fg-faint">
                    {t.id === "free" ? "/forever" : "/mo"}
                  </span>
                </div>
                {t.id !== "free" && (
                  <div className="mt-1 font-mono text-[0.625rem] uppercase tracking-wider text-fg-faint">
                    {annual
                      ? `${fmtMoney(annualTotal(t.id, currency), currency)} billed annually`
                      : `or ${fmtMoney(monthlyPrice(t.id, "year", currency), currency)}/mo billed annually`}
                  </div>
                )}
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-fg-dim">{t.blurb}</p>

                <ul className="mt-5 flex-1 space-y-2.5 border-t border-border-soft pt-5">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        className={`mt-0.5 shrink-0 ${t.soon ? "text-fg-faint" : "text-bull"}`}
                      >
                        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeOpacity="0.4" />
                        <path d="M4.5 7l1.8 1.8L9.8 5.3" stroke="currentColor" strokeWidth="1.3" />
                      </svg>
                      <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-fg">
                        {f}
                      </span>
                    </li>
                  ))}
                  {t.extras.map((f) => (
                    // pl matches the 14px icon + 10px gap above so the rows align
                    <li
                      key={f}
                      className="pl-6 font-mono text-[0.6875rem] tracking-wide text-fg-dim"
                    >
                      {f}
                    </li>
                  ))}
                </ul>

                {t.id === "free" ? (
                  <Link href="/learn" className={`mt-6 ${ctaClass(t)}`}>
                    Start for free
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                      <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                  </Link>
                ) : (
                  <PlanCta
                    plan={t.id}
                    interval={interval}
                    currency={currency}
                    configured={configured}
                    soon={t.soon}
                    primary={t.primary}
                    waitlistCount={counts[t.id]}
                    priceLabel={`${fmtMoney(price, currency)}/mo`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* honesty + compliance strip */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="inline-flex items-center gap-3 surface-card border border-border bg-surface px-5 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.25em] text-fg-dim">
            <span className="size-1.5 rounded-full bg-bull" />
            Paper only · Educational · Not advice
          </div>
          {/* The full disclaimer lives in the Footer, which renders on this very
              page — repeating it here stacked the same sentence twice within a
              few hundred pixels. The pill above carries the short version. */}
          <div className="max-w-2xl text-center font-mono text-[0.6875rem] leading-relaxed text-fg-dim">
            {railNote}
          </div>
          <div className="max-w-2xl text-center font-mono text-[0.625rem] leading-relaxed text-fg-faint">
            Roadmap lines are not enforced yet — today every tier sees the full bot library. Power stays a
            waitlist until the IV feed is licensed.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

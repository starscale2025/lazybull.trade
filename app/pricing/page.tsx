"use client";

// Pricing — the plan ladder (docs/strategy §4) in the house style, wired to
// the money rail. Every feature line comes from PLAN_LIMITS through
// components/pricing/tiers.ts and every price from PLAN_PRICES through
// lib/billing/prices.ts, so nothing on this page can drift from what the
// gates enforce or the checkout charges. The CTA (components/pricing/PlanCta)
// is a real checkout when the rail for the chosen currency is configured and
// a real waitlist when it is not — never a fake checkout, and never the
// "CTAs route to sign-in" the 2026-09 diligence memo found.
//
// Calm (S1, 2026-11-09): one ladder. Four panels of the same weight, Free to
// Power left to right, none of them lit up over the others to steer the eye;
// the only emphasis is the page's one primary pill, and it is on Free.
import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import type { Currency, PaidPlan } from "@/lib/billing/config";
import { annualTotal, fmtMoney, monthlyPrice, monthsSaved } from "@/lib/billing/prices";
import { Chip, PageHeader, PillLink, TogglePill } from "@/components/calm/kit";
import { buildTiers } from "@/components/pricing/tiers";
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
    ? "Checking which billing rails are live…"
    : liveRails.length === 0
      ? "Checkout is not open yet. Joining a list records demand for that tier in your currency — nothing is charged and there is no card to enter."
      : `Billing by ${liveRails.join(" and ")} · cancel any time · access runs to the end of the paid period.`;

  return (
    <div className="page-aura min-h-screen bg-bg">
      <Nav />
      <main className="tap-floor">
        <PageHeader
          eyebrow="Pricing"
          title="Start free."
          accent="Upgrade when it clicks."
          lede="Practice with purpose. Upgrade for power."
          actions={
            <>
              {/* billing toggle */}
              <div className="inline-flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setAnnual(false)}
                  aria-pressed={!annual}
                  className={`whitespace-nowrap text-[0.875rem] transition-colors ${!annual ? "text-fg" : "text-fg-faint hover:text-fg-dim"}`}
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
                  className={`relative h-5 w-10 rounded-full border transition-colors ${annual ? "border-transparent bg-[image:var(--grad-fill)]" : "border-border bg-fg/10"}`}
                >
                  <span
                    className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full transition-all ${annual ? "left-[1.375rem] bg-[var(--grad-on)]" : "left-1 bg-fg-dim"}`}
                  />
                </button>
                <button
                  onClick={() => setAnnual(true)}
                  aria-pressed={annual}
                  className={`whitespace-nowrap text-[0.875rem] transition-colors ${annual ? "text-fg" : "text-fg-faint hover:text-fg-dim"}`}
                >
                  Billed annually
                </button>
                {annual && maxMonthsSaved > 0 && (
                  <Chip tone="brand" className="max-sm:basis-full max-sm:justify-center">
                    Save up to {maxMonthsSaved} months
                  </Chip>
                )}
              </div>

              {/* currency toggle — $ via Lemon Squeezy, ₹ via Razorpay */}
              <div role="group" aria-label="Currency" className="inline-flex items-center gap-1.5">
                {(["USD", "INR"] as const).map((c) => (
                  <TogglePill key={c} on={currency === c} onClick={() => pickCurrency(c)}>
                    {c === "USD" ? "$ USD" : "₹ INR"}
                  </TogglePill>
                ))}
              </div>
            </>
          }
        />

        <div className="shell pb-[clamp(4rem,9vw,6rem)]">
          {/* tier cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {TIERS.map((t) => {
              const price = t.id === "free" ? 0 : monthlyPrice(t.id, interval, currency);
              return (
                <div key={t.id} id={t.id} className="calm-panel flex scroll-mt-28 flex-col p-6">
                  <i aria-hidden className="lit-aura" />
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">{t.name}</div>
                    {t.soon && <Chip className="shrink-0">Coming soon</Chip>}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    <span className="font-display text-5xl tracking-tightest text-fg">
                      {fmtMoney(price, currency)}
                    </span>
                    <span className="text-[0.875rem] text-fg-faint">
                      {t.id === "free" ? "/forever" : "/mo"}
                    </span>
                  </div>
                  {t.id !== "free" && (
                    <div className="mt-1 text-[0.75rem] text-fg-faint">
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
                          className={`mt-0.5 shrink-0 ${t.soon ? "text-fg-faint" : "text-brand-ink"}`}
                        >
                          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeOpacity="0.4" />
                          <path d="M4.5 7l1.8 1.8L9.8 5.3" stroke="currentColor" strokeWidth="1.3" />
                        </svg>
                        <span className="text-[0.875rem] text-fg">{f}</span>
                      </li>
                    ))}
                    {t.extras.map((f) => (
                      // pl matches the 14px icon + 10px gap above so the rows align
                      <li key={f} className="pl-6 text-[0.8125rem] text-fg-dim">
                        {f}
                      </li>
                    ))}
                  </ul>

                  {t.id === "free" ? (
                    <PillLink href="/learn" kind={t.primary ? "primary" : "secondary"} className="mt-6 w-full">
                      Start for free
                    </PillLink>
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
          <div className="mt-10 flex flex-col gap-3">
            <p className="text-[0.875rem] text-fg-dim">Paper only · Educational · Not advice</p>
            {/* The full disclaimer lives in the Footer, which renders on this very
                page — repeating it here stacked the same sentence twice within a
                few hundred pixels. The line above carries the short version. */}
            <p className="t-label max-w-2xl text-fg-dim">{railNote}</p>
            <p className="t-label max-w-2xl text-fg-faint">
              Roadmap lines are not enforced yet — today every tier sees the full bot library. Power stays a
              waitlist until the IV feed is licensed.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

"use client";

// Pricing — the strategy's tier ladder (docs/strategy §4) rendered in the house
// style. Free + Pro are the launch tiers; Plus anchors, Power ships after a real
// IV feed. Billing isn't wired yet, so every CTA routes to sign-in / learn — no
// fake checkout. Design ref: docs/design-refs/08-pricing.png.
import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

type Tier = {
  name: string;
  monthly: number;
  annualMo: number; // effective per-month when billed annually
  blurb: string;
  features: string[];
  cta: { label: string; href: string };
  popular?: boolean;
  soon?: boolean;
};

const TIERS: Tier[] = [
  {
    name: "Free",
    monthly: 0,
    annualMo: 0,
    blurb: "The whole primer. Real practice. Forever.",
    features: [
      "Full 14-chapter interactive primer",
      "Unlimited paper trades · $100k account",
      "AI teacher · 5 explains per day",
      "3 bots in the quant workbench",
      "1 saved workspace",
    ],
    cta: { label: "Start for free", href: "/learn" },
  },
  {
    name: "Plus",
    monthly: 19,
    annualMo: 15,
    blurb: "For the learner who finished the primer.",
    features: [
      "Unlimited AI-teacher explains",
      "15+ bots · trend, stats & risk tribes",
      "Advanced charting · alerts · replay",
      "Unlimited saved workspaces",
      "Priority support",
    ],
    cta: { label: "Get started", href: "/auth/signin" },
  },
  {
    name: "Pro",
    monthly: 39,
    annualMo: 29,
    blurb: "The full workbench, nothing held back.",
    features: [
      "Everything in Plus",
      "All 27 bots + consensus engine",
      "Bring-your-own-bot · hot-load & backtest",
      "Pro charting suite · shareable workspaces",
      "Early access to new features",
    ],
    cta: { label: "Get started", href: "/auth/signin" },
    popular: true,
  },
  {
    name: "Power",
    monthly: 59,
    annualMo: 45,
    blurb: "For graduating quants. Ships with real IV.",
    features: [
      "Everything in Pro",
      "13 trained ML models exposed",
      "Real IV & Greeks data feed",
      "API access",
      "Dedicated support",
    ],
    cta: { label: "Join the waitlist", href: "/auth/signin" },
    soon: true,
  },
];

// The badge used to hard-code "save 3.4 months", which no tier reaches — best
// case is Pro at 3.08. Derive it so the claim can never contradict the dollar
// figures this same page renders.
const MAX_MONTHS_SAVED = Math.floor(
  Math.max(
    ...TIERS.filter((t) => t.monthly > 0).map((t) => ((t.monthly - t.annualMo) * 12) / t.monthly)
  )
);

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  return (
    <div className="min-h-screen bg-bg">
      <Nav />
      <main className="mx-auto max-w-[1400px] px-5 py-16 lg:py-24">
        {/* header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-fg-faint">
            Pricing
          </div>
          <h1 className="mt-4 font-display text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02] tracking-tightest text-fg">
            Start free.{" "}
            <span className="italic font-light text-bull">Upgrade when it clicks.</span>
          </h1>
          <p className="mt-5 font-mono text-[12px] uppercase tracking-[0.25em] text-fg-dim">
            practice with purpose · upgrade for power
          </p>

          {/* billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 border border-border bg-surface px-4 py-2.5">
            <button
              onClick={() => setAnnual(false)}
              aria-pressed={!annual}
              className={`font-mono text-[11px] uppercase tracking-wider transition-colors ${!annual ? "text-fg" : "text-fg-faint hover:text-fg-dim"}`}
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
              className={`relative h-5 w-10 rounded-full border transition-colors ${annual ? "border-bull/60 bg-bull/20" : "border-border bg-bg"}`}
            >
              <span
                className={`absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full transition-all ${annual ? "left-[22px] bg-bull" : "left-1 bg-fg-dim"}`}
              />
            </button>
            <button
              onClick={() => setAnnual(true)}
              aria-pressed={annual}
              className={`font-mono text-[11px] uppercase tracking-wider transition-colors ${annual ? "text-bull" : "text-fg-faint hover:text-fg-dim"}`}
            >
              Billed annually
            </button>
            <span className="border border-bull/40 bg-bull/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-bull">
              save up to {MAX_MONTHS_SAVED} months
            </span>
          </div>
        </div>

        {/* tier cards */}
        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {TIERS.map((t) => {
            const price = annual ? t.annualMo : t.monthly;
            return (
              <div
                key={t.name}
                className={`relative flex flex-col border bg-surface p-6 ${
                  t.popular ? "border-bull/60 shadow-[0_0_40px_-12px_var(--bull)]" : "border-border"
                } ${t.soon ? "opacity-80" : ""}`}
              >
                {t.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 border border-bull/60 bg-bg px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-bull">
                    Most popular
                  </span>
                )}
                {t.soon && (
                  <span className="absolute right-4 top-4 border border-border bg-bg px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    Coming soon
                  </span>
                )}

                <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-fg-dim">
                  {t.name}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-display text-5xl tracking-tightest text-fg">
                    ${price}
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">
                    {t.monthly === 0 ? "/forever" : "/mo"}
                  </span>
                </div>
                {t.monthly > 0 && (
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
                    {annual ? `$${t.annualMo * 12} billed annually` : `or $${t.annualMo}/mo billed annually`}
                  </div>
                )}
                <p className="mt-3 text-[13px] leading-relaxed text-fg-dim">{t.blurb}</p>

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
                      <span className="font-mono text-[11px] uppercase tracking-wide text-fg">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={t.cta.href}
                  className={`mt-6 inline-flex h-10 items-center justify-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    t.popular
                      ? "bg-bull text-bg hover:bg-bull-dim"
                      : t.soon
                      ? "border border-border text-fg-faint hover:border-fg-dim hover:text-fg-dim"
                      : "border border-border text-fg-dim hover:border-fg-dim hover:text-fg"
                  }`}
                >
                  {t.cta.label}
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                </Link>
              </div>
            );
          })}
        </div>

        {/* honesty + compliance strip */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <div className="font-mono text-[11px] uppercase tracking-wider text-fg-faint">
            Billing launches soon — early users lock founding pricing.
          </div>
          <div className="inline-flex items-center gap-3 border border-border bg-surface px-5 py-3 font-mono text-[11px] uppercase tracking-[0.25em] text-fg-dim">
            <span className="size-1.5 rounded-full bg-bull" />
            Paper only · Educational · Not advice
          </div>
          <p className="max-w-xl text-center font-mono text-[10px] leading-relaxed text-fg-faint">
            lazybull is an educational simulation. No real money moves, no orders are routed,
            and nothing here is a recommendation to buy or sell any security.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

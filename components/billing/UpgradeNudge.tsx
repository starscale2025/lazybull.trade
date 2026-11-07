"use client";

// The one upgrade prompt every 402 renders.
//
// A gated route answers with the paywall body from lib/billing/gate.ts and
// nothing else; the copy lives here, once, so /trade, /pro, /quant and the
// practice editorials cannot each describe the same cap differently from the
// pricing page. Numbers come from the body (the cap that was hit) and from
// PLAN_LIMITS (what the tier gives), never from prose.
//
// Anonymous visitors on the explain cap are offered sign-in before an
// upgrade: their allowance is counted per network address (app/api/explain),
// so a shared office or campus address exhausts it for everyone behind it,
// and a free account — its own counter — is the fix for that, not a paid plan.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import type { PaywallBody } from "@/lib/billing/gate";
import { PLAN_LIMITS, type Plan } from "@/lib/billing/types";

const TIER_NAME: Record<Plan, string> = { free: "Free", plus: "Plus", pro: "Pro", power: "Power" };

function targetOf(p: PaywallBody): "plus" | "pro" {
  return p.upgrade === "/pricing#plus" ? "plus" : "pro";
}

/**
 * Headline, body and button label for a paywall body. Pure — exported for
 * tests and for surfaces that render their own frame around the words.
 */
export function paywallCopy(p: PaywallBody): { title: string; body: string; cta: string } {
  const tier = TIER_NAME[p.plan];
  const next = TIER_NAME[targetOf(p)];
  switch (p.error) {
    case "explain_cap": {
      const n = p.limit ?? PLAN_LIMITS[p.plan].explainsPerDay ?? 0;
      return {
        title: "Today's explains are used up",
        body: `${tier} includes ${n} AI-teacher explain${n === 1 ? "" : "s"} per day; the count resets at midnight UTC. ${next} has no daily cap.`,
        cta: `See ${next}`,
      };
    }
    case "workspace_limit": {
      const n = p.limit ?? PLAN_LIMITS[p.plan].workspaces ?? 0;
      return {
        title: "Saved-workspace limit reached",
        body: `${tier} keeps ${n} saved workspace${n === 1 ? "" : "s"}. Delete one to save another; ${next} keeps an unlimited number.`,
        cta: `See ${next}`,
      };
    }
    default:
      return {
        title: `A ${next} problem`,
        body: `Pro problems and their editorials are part of ${next}. The free set stays free.`,
        cta: `See ${next}`,
      };
  }
}

export function UpgradeNudge({
  paywall,
  onClose,
  className = "",
}: {
  paywall: PaywallBody;
  onClose?: () => void;
  className?: string;
}) {
  const { status } = useSession();
  const pathname = usePathname();
  const copy = paywallCopy(paywall);
  const anonymous = status !== "authenticated" && paywall.error === "explain_cap";
  const signInHref = `/auth/signin?callbackUrl=${encodeURIComponent(pathname || "/")}`;

  return (
    <div role="status" className={`surface-instrument border border-bull/40 bg-surface ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-bg-soft px-3 py-1.5">
        <span className="t-eyebrow text-bull">{copy.title}</span>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Dismiss" className="text-fg-faint transition-colors hover:text-fg">
            ✕
          </button>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="t-body-sm text-fg-dim">{copy.body}</p>
        {anonymous && (
          <p className="mt-1.5 t-body-sm text-fg-dim">
            Anonymous explains are counted per network address. A free account gets its own allowance.
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {anonymous && (
            <Link
              href={signInHref}
              className="inline-flex h-8 items-center border border-border px-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider text-fg-dim transition-colors hover:border-fg-dim hover:text-fg"
            >
              Sign in · free
            </Link>
          )}
          <Link
            href={paywall.upgrade}
            className="inline-flex h-8 items-center gap-2 btn-grad px-3 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider transition-colors"
          >
            {copy.cta}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Link>
        </div>
        <div className="mt-2 t-chrome text-fg-faint">paper only · educational · not advice</div>
      </div>
    </div>
  );
}

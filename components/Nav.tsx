import Link from "next/link";
import { AuthButtons } from "./AuthButtons";
import { MobileMenu } from "./MobileMenu";
import { TruthBadge } from "./pro/TruthBadge";
import { NAV_DIRECTORY } from "@/lib/directory";

/**
 * The site navbar, in glass.
 *
 * It floats: a sticky, inset, frosted bar rather than a full-bleed border-
 * bottom strip. Same information, same destinations, same breakpoint budget —
 * the rail is still lg+, the Truth badge xl+, Portfolio md+, and the hamburger
 * covers everything below. Nothing was dropped to make it fit.
 *
 * TWO FIXES THAT CAME FREE WITH THE REWRITE:
 *
 * 1. `whitespace-nowrap` on the rail links. The old bar let "Visual chain" and
 *    "Pro charts" wrap to two lines at exactly the widths where the rail was
 *    already visible, so the nav silently grew to ~56px of stacked text on
 *    most desktops. Labels are two words; they were never meant to break.
 *
 * 2. `--nav-h` is published as a custom property. Pages that need to clear the
 *    bar were each hard-coding their own guess at its height; now there is one
 *    number and it lives with the component that owns it.
 *
 * The landing does NOT mount this (see app/page.tsx): the cinema is that
 * page's navigation, and a fixed bar over the film is exactly what the
 * no-navbar rule exists to prevent. It picks the nav up inside the marketing
 * region instead, once the film has handed off.
 */
export function Nav() {
  return (
    <div
      className="pointer-events-none sticky top-0 z-50 px-3 pt-3"
      style={{ ["--nav-h" as string]: "68px" }}
    >
      {/* Concentric geometry, the rule that keeps a pill-in-pill nav from
          looking broken: inner radius = outer radius − gap. The bar is a full
          pill (28px on h-14) with a 10px inset on every side of a control
          (py-2.5 / pr-2.5), so every h-9 control inside renders rounded-full
          at 18px = 28 − 10. Change the bar height or the padding and these
          must move together. */}
      <nav className="glass-strong specular pointer-events-auto mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-2 rounded-full py-2.5 pl-4 pr-2.5 sm:pl-5">
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="relative flex size-7 items-center justify-center rounded-[9px] bg-bull shadow-[0_0_16px_rgba(0,255,135,0.45),inset_0_1px_0_rgba(255,255,255,0.55)]"
          >
            <span className="font-mono text-[10px] font-bold text-[#04140b]">LB</span>
          </span>
          <span className="font-display text-lg font-medium tracking-tightest text-fg">
            lazybull
            <span className="text-bull">.</span>
          </span>
        </Link>

        {/* lg (not md): at 768–1023 the full rail + badge + CTA is ~970px wide
            and forces horizontal scroll — the hamburger covers that band. */}
        {/* px-2.5 is held until 2xl. The roomier xl:px-3 added ~2px a side across
            seven links — ~28px — which at 1280 was the exact margin between the
            bar fitting and the primary CTA being clipped off the right edge.
            Every child here is shrink-0, so there is no give anywhere else. */}
        <div className="hidden items-center gap-0.5 lg:flex">
          {NAV_DIRECTORY.map((item) => (
            <Link
              key={item.l}
              href={item.href}
              className="group relative flex h-9 items-center whitespace-nowrap rounded-[var(--r-pill)] px-2.5 font-mono text-[11px] uppercase tracking-wider text-fg-dim transition-[color,background-color] duration-300 [transition-timing-function:var(--ease-settle)] hover:bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] hover:text-fg 2xl:px-3"
            >
              <span>{item.l}</span>
            </Link>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The Synthetic-Truth badge, promoted off /pro so the glitch→checkmark
              is site-wide furniture. xl+ only, to spare the tight lg rail band. */}
          <div className="hidden items-center xl:flex">
            <TruthBadge />
          </div>
          {/* Account pages sit with the account cluster, not the destination rail —
              the rail is already near its width budget at lg (see comment above). */}
          <Link
            href="/portfolio"
            className="hidden h-9 items-center whitespace-nowrap rounded-full border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] px-3.5 font-mono text-[11px] uppercase tracking-wider text-fg-dim hover:border-fg-dim hover:text-fg md:inline-flex"
          >
            Portfolio
          </Link>
          <AuthButtons />
          <Link
            href="/trade"
            className="btn-primary-glass group relative inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 font-mono text-[11px] font-semibold uppercase tracking-wider sm:px-4"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-[#04140b] pulse-dot" />
            <span className="sm:hidden">Chain</span>
            <span className="hidden sm:inline">Open the chain</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Link>
          <MobileMenu />
        </div>
      </nav>
    </div>
  );
}

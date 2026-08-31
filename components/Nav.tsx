import Link from "next/link";
import { AuthButtons } from "./AuthButtons";
import { MobileMenu } from "./MobileMenu";
import { TruthBadge } from "./pro/TruthBadge";
import { NAV_DIRECTORY } from "@/lib/directory";

// Rail links folded into the MORE menu until 2xl frees enough width for the
// full seven-link rail. Learn / Visual chain / Pro charts / Pricing stay
// top-level — they are the funnel; these three are reference pages.
const FOLDED = new Set<string>(["/quant", "/greeks", "/about"]);

const railLink =
  "group relative h-9 items-center whitespace-nowrap rounded-[var(--r-pill)] px-2.5 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim transition-[color,background-color] duration-300 [transition-timing-function:var(--ease-settle)] hover:bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] hover:text-fg 2xl:px-3";

/**
 * The site navbar, in glass.
 *
 * It floats: a sticky, inset, frosted bar rather than a full-bleed border-
 * bottom strip. Same information, same destinations. Breakpoint budget: the
 * rail is xl+ (with Quant/Greeks/About folded into a MORE menu until 2xl),
 * the Truth badge min-[1360px]+, Portfolio xl+, and the hamburger covers
 * everything below xl. Nothing was dropped to make it fit — below xl every
 * destination lives in the sheet.
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
// `wide` matches the bar to a .shell-wide page (1600px). Routes whose content
// rail is wider than the nav's leave the bar floating 100px inside their own
// columns, which reads as a misalignment rather than a choice.
export function Nav({ wide = false }: { wide?: boolean }) {
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
      <nav
        className={`glass-strong specular pointer-events-auto mx-auto flex h-14 ${
          wide ? "max-w-[100rem]" : "max-w-[87.5rem]"
        } items-center justify-between gap-2 rounded-full py-2.5 pl-4 pr-2.5 sm:pl-5`}
      >
        <Link href="/" className="group flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="relative flex size-7 items-center justify-center rounded-[9px] bg-bull shadow-[0_0_16px_rgba(0,255,135,0.45),inset_0_1px_0_rgba(255,255,255,0.55)]"
          >
            <span className="font-mono text-[0.625rem] font-bold text-[#04140b]">LB</span>
          </span>
          <span className="font-display text-lg font-medium tracking-tightest text-fg">
            lazybull
            <span className="text-bull">.</span>
          </span>
        </Link>

        {/* xl (not lg): at 1024–1279 even the slimmed rail + account cluster
            overflowed the pill and clipped the CTA — the hamburger covers that
            band. At xl the rail runs four links + MORE; the full seven return
            at 2xl. Every child here is shrink-0, so there is no give elsewhere. */}
        <div className="hidden items-center gap-1.5 xl:flex">
          {NAV_DIRECTORY.map((item) => (
            <Link
              key={item.l}
              href={item.href}
              className={`${FOLDED.has(item.href) ? "hidden 2xl:flex" : "flex"} ${railLink}`}
            >
              <span>{item.l}</span>
            </Link>
          ))}
          {/* MORE ▾ — CSS-only disclosure (details/summary: no client JS in this
              server component). Panel matches the mobile sheet's idiom. */}
          <details className="relative 2xl:hidden">
            <summary
              className={`flex cursor-pointer select-none list-none gap-1.5 [&::-webkit-details-marker]:hidden ${railLink}`}
            >
              <span>More</span>
              <span aria-hidden className="text-[0.5625rem] text-fg-faint">
                ▾
              </span>
            </summary>
            <div className="absolute right-0 top-full z-50 mt-3 flex min-w-36 flex-col overflow-hidden rounded-[var(--r-panel)] border border-[var(--glass-border)] bg-bg py-1.5 shadow-2xl">
              {NAV_DIRECTORY.filter((item) => FOLDED.has(item.href)).map((item) => (
                <Link
                  key={item.l}
                  href={item.href}
                  className="flex h-9 items-center px-4 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim transition-colors hover:bg-surface hover:text-fg"
                >
                  {item.l}
                </Link>
              ))}
            </div>
          </details>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The Synthetic-Truth badge, promoted off /pro so the glitch→checkmark
              is site-wide furniture. min-[1360px]: at exactly 1280 the badge's
              145px was the difference between the CTA fitting and it poking
              past the pill's rounded border. */}
          <div className="hidden items-center min-[1360px]:flex">
            <TruthBadge />
          </div>
          {/* Account pages sit with the account cluster, not the destination
              rail. xl+ only — below xl it duplicated the sheet's entry while
              the bar was already over budget. */}
          <Link
            href="/portfolio"
            className="hidden h-9 items-center whitespace-nowrap rounded-full border border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--fg)_4%,transparent)] px-3.5 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim hover:border-fg-dim hover:text-fg xl:inline-flex"
          >
            Portfolio
          </Link>
          <AuthButtons />
          <Link
            href="/trade"
            className="btn-primary-glass group relative inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-wider sm:px-4"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-[#04140b] pulse-dot" />
            {/* Short label below sm AND in the 1024–1279 hamburger band, where
                the audit measured the full CTA clipping off the pill's edge. */}
            <span className="sm:hidden lg:inline xl:hidden">Chain</span>
            <span className="hidden sm:inline lg:hidden xl:inline">Open the chain</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path d="M1 5h8M5 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </Link>
          {/* MobileMenu gates itself lg:hidden, but the rail now starts at xl —
              re-show the hamburger through 1024–1279 from here (it's shared
              chrome owned by the below-lg band), or that band would have no
              route to the folded destinations. */}
          <div className="contents lg:max-xl:[&>div]:block!">
            <MobileMenu />
          </div>
        </div>
      </nav>
    </div>
  );
}

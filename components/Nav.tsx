import Link from "next/link";
import { AuthButtons } from "./AuthButtons";
import { MobileMenu } from "./MobileMenu";
import { NavAutoHide } from "./NavAutoHide";
import { BullMark } from "./BullMark";
import { NavCta } from "./NavCta";
import { NAV_DIRECTORY } from "@/lib/directory";

// Rail links behind the MORE menu. Learn / Practice / Strategy builder / Pro
// charts stay top-level at xl — they are the funnel (learn it, prove it, build
// it, trade it on paper) and each has to be visible on a 1280–1535 laptop — so
// the xl rail keeps its hard-won four-links-plus-MORE width budget. Quant returns to the
// rail at 2xl. The three reference pages stay in MORE at EVERY width: the
// pill's max-width is fixed (87.5rem), so an eight-link rail overflowed it by
// 66–104px at 1536 and 1920 alike — measured, not guessed. Pricing is still
// one click away in MORE, the footer and every CTA.
const FOLDED = new Set<string>(["/quant"]);
const ALWAYS_FOLDED = new Set<string>(["/greeks", "/pricing", "/about"]);
const inMenu = (href: string) => FOLDED.has(href) || ALWAYS_FOLDED.has(href);

const railLink =
  "group relative h-9 items-center whitespace-nowrap rounded-[var(--r-pill)] px-3 text-[0.875rem] tracking-[-0.005em] text-fg-dim transition-[color,background-color] duration-300 [transition-timing-function:var(--ease-settle)] hover:bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] hover:text-fg 2xl:px-3";

/**
 * The site navbar, in glass.
 *
 * It floats: a sticky, inset, frosted bar rather than a full-bleed border-
 * bottom strip. Same information, same destinations. Breakpoint budget: the
 * rail is xl+ (Quant folded into a MORE menu until 2xl; Greeks/Pricing/About
 * always in it), the Truth badge min-[1360px]+, Portfolio xl+, and the hamburger covers
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
      className="nav-bar pointer-events-none sticky top-0 z-50 px-3 pt-3"
      style={{ ["--nav-h" as string]: "68px" }}
    >
      <NavAutoHide />
      {/* Concentric geometry, the rule that keeps a pill-in-pill nav from
          looking broken: inner radius = outer radius − gap. The bar is a full
          pill (28px on h-14) with a 10px inset on every side of a control
          (py-2.5 / pr-2.5), so every h-9 control inside renders rounded-full
          at 18px = 28 − 10. Change the bar height or the padding and these
          must move together. */}
      <nav
        className={`glass-strong nav-pill specular pointer-events-auto mx-auto flex h-14 ${
          wide ? "max-w-[100rem]" : "max-w-[87.5rem]"
        } items-center justify-between gap-2 rounded-full py-2.5 pl-4 pr-2.5 sm:pl-5`}
      >
        <Link href="/" className="group flex shrink-0 items-center gap-2.5 [view-transition-name:nav-mark]">
          {/* The bull mark, the shape the film ends on (M25). It replaced the
              "LB" gradient tile. */}
          <BullMark className="h-5 w-7" />
          <span className="font-display text-lg font-medium tracking-tightest text-fg">
            lazybull
            <span className="text-bull">.</span>
          </span>
        </Link>

        {/* xl (not lg): at 1024–1279 even the slimmed rail + account cluster
            overflowed the pill and clipped the CTA — the hamburger covers that
            band. At xl the rail runs four links + MORE; Quant joins at 2xl and
            MORE stays. Every child here is shrink-0, so there is no give elsewhere. */}
        <div className="hidden items-center gap-1.5 xl:flex">
          {NAV_DIRECTORY.map((item) => (
            <Link
              key={item.l}
              href={item.href}
              className={`${
                ALWAYS_FOLDED.has(item.href) ? "hidden" : FOLDED.has(item.href) ? "hidden 2xl:flex" : "flex"
              } ${railLink}`}
            >
              <span>{item.l}</span>
            </Link>
          ))}
          {/* MORE ▾ — CSS-only disclosure (details/summary: no client JS in this
              server component). Panel matches the mobile sheet's idiom. Always
              present on the rail: the reference pages never leave it. */}
          <details className="relative">
            <summary
              className={`flex cursor-pointer select-none list-none gap-1.5 [&::-webkit-details-marker]:hidden ${railLink}`}
            >
              <span>More</span>
              <span aria-hidden className="text-[0.5625rem] text-fg-faint">
                ▾
              </span>
            </summary>
            <div className="absolute right-0 top-full z-50 mt-3 flex min-w-36 flex-col overflow-hidden rounded-[var(--r-panel)] border border-[var(--glass-border)] bg-bg py-1.5 shadow-2xl">
              {NAV_DIRECTORY.filter((item) => inMenu(item.href)).map((item) => (
                <Link
                  key={item.l}
                  href={item.href}
                  className={`${
                    FOLDED.has(item.href) ? "flex 2xl:hidden" : "flex"
                  } h-9 items-center px-4 text-[0.875rem] text-fg-dim transition-colors hover:bg-surface hover:text-fg`}
                >
                  {item.l}
                </Link>
              ))}
            </div>
          </details>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* The Synthetic-Truth badge used to sit here, site-wide. Calm
              (M33, 2026-11-09): data provenance belongs where the data is, so
              it lives on /pro (and on every quote it qualifies), not on the
              bar of every page. */}
          {/* Account pages sit with the account cluster, not the destination
              rail. xl+ only — below xl it duplicated the sheet's entry while
              the bar was already over budget. */}
          <Link
            href="/portfolio"
            className="hidden h-9 items-center whitespace-nowrap rounded-full px-3 text-[0.875rem] tracking-[-0.005em] text-fg-dim transition-colors hover:text-fg xl:inline-flex"
          >
            Portfolio
          </Link>
          <AuthButtons />
          <NavCta className="btn-primary-glass tracking-[-0.01em] group relative inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-[0.8125rem] font-semibold sm:px-4" />
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

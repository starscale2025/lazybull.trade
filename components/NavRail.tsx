"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { NAV_DIRECTORY, NEW_TAB, newTabProps } from "@/lib/directory";

// Rail links behind the More menu. Learn / Practice / Strategy builder / Pro
// charts stay top-level from xl: they are the deck's loop (learn it, practice
// it, trade it on paper) and each has to be visible on a 1280-1535 laptop.
// Quant joins the rail at 2xl. The three reference pages stay in More at
// every width.
const FOLDED = new Set<string>(["/quant"]);
const ALWAYS_FOLDED = new Set<string>(["/greeks", "/pricing", "/about"]);
const inMenu = (href: string) => FOLDED.has(href) || ALWAYS_FOLDED.has(href);

/** The ↗ and the screen-reader note a new-tab link carries (NEW_TAB lives in
    lib/directory.ts). */
export function NewTabMark({ href }: { href: string }) {
  if (!NEW_TAB.has(href)) return null;
  return (
    <>
      <span aria-hidden className="text-[0.8em] text-fg-faint">
        ↗
      </span>
      <span className="sr-only"> (opens in a new tab)</span>
    </>
  );
}

/** The current destination: the route itself or anything under it, so
    /trade/chain lights "Strategy builder" and /learn/bots lights "Learn". */
export function isCurrent(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The xl+ destination rail: mono capitals, the current page on a raised fill
 * (the mockups' "PLAYGROUND"), and a More disclosure. More is a native
 * <details>, so it works before hydration; once hydrated it also closes on a
 * click outside, on Escape and on navigation. NavAutoHide keeps the bar on
 * screen while it is open.
 */
export function NavRail() {
  const pathname = usePathname();
  const moreRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (moreRef.current) moreRef.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const close = () => {
      if (moreRef.current) moreRef.current.open = false;
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      const d = moreRef.current;
      if (d?.open && !d.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      const d = moreRef.current;
      if (e.key === "Escape" && d?.open) {
        close();
        d.querySelector("summary")?.focus();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const folded = NAV_DIRECTORY.filter((item) => inMenu(item.href));
  // Lit only for the pages that live in More at every width: Quant is on the
  // rail itself from 2xl, so lighting More for it would be wrong there.
  const moreHoldsCurrent = folded.some((item) => ALWAYS_FOLDED.has(item.href) && isCurrent(pathname, item.href));

  return (
    <div className="hidden items-center gap-1 xl:flex">
      {NAV_DIRECTORY.filter((item) => !ALWAYS_FOLDED.has(item.href)).map((item) => {
        const current = isCurrent(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            {...newTabProps(item.href)}
            aria-current={current ? "page" : undefined}
            className={`deck-navlink ${FOLDED.has(item.href) ? "hidden 2xl:inline-flex" : ""}`}
          >
            {item.l}
            <NewTabMark href={item.href} />
          </Link>
        );
      })}

      <details
        ref={moreRef}
        className="relative"
        // Tabbing out of the open menu folds it, like a click outside does.
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && !e.currentTarget.contains(next)) e.currentTarget.open = false;
        }}
      >
        <summary
          data-holds-current={moreHoldsCurrent ? "" : undefined}
          className="deck-navlink cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden"
        >
          More
          <ChevronDown aria-hidden size={12} strokeWidth={1.75} className="-mr-0.5 text-fg-faint" />
        </summary>
        <div className="deck-menu absolute left-0 top-full z-50 mt-2 flex min-w-48 flex-col p-1.5">
          {folded.map((item) => {
            const current = isCurrent(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`${
                  FOLDED.has(item.href) ? "flex 2xl:hidden" : "flex"
                } h-10 items-center justify-between gap-6 rounded-[8px] px-3 text-[0.875rem] text-fg-dim transition-colors hover:bg-[var(--deck-raised)] hover:text-fg aria-[current=page]:text-fg`}
              >
                {item.l}
                {current && <span aria-hidden className="size-1.5 rounded-full bg-bull" />}
              </Link>
            );
          })}
        </div>
      </details>
    </div>
  );
}

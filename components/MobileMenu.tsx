"use client";

// The menu below xl: a square menu button that opens a sheet under the bar
// with every destination, grouped the way the deck tells the product — learn
// it, practice it, trade it on paper — then the reference pages, then sign
// in or out. Closes on a link, Escape, a tap outside, or a route change.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { NEW_TAB, newTabProps } from "@/lib/directory";
import { isCurrent } from "./NavRail";

const GROUPS = [
  {
    label: "Learn",
    links: [
      { l: "Learn", href: "/learn" },
      { l: "Greeks", href: "/greeks" },
    ],
  },
  {
    label: "Practice",
    links: [{ l: "Practice", href: "/practice" }],
  },
  {
    label: "Trade",
    links: [
      { l: "Strategy builder", href: "/trade" },
      { l: "Pro charts", href: "/pro" },
      { l: "Quant", href: "/quant" },
      { l: "Portfolio", href: "/portfolio" },
    ],
  },
  {
    label: "Lazybull",
    links: [
      { l: "Pricing", href: "/pricing" },
      { l: "About", href: "/about" },
      { l: "Account & plan", href: "/account" },
    ],
  },
] as const;

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { status } = useSession();
  const pathname = usePathname();

  // Route changed under us (e.g. back button) → fold the sheet.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("touchstart", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="xl:hidden"
      // Focus leaving the sheet (Tab past its last link) folds it, so keyboard
      // focus never lands on controls hidden underneath an open sheet.
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (next && !e.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          // Safari does not focus a button on tap; focusing it keeps the bar
          // pinned (NavAutoHide) while the sheet is open.
          buttonRef.current?.focus();
        }}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-controls="mobile-nav"
        className="flex size-8 items-center justify-center rounded-[9px] text-fg-dim shadow-[inset_0_0_0_1px_var(--deck-rule)] transition-colors hover:bg-[var(--deck-raised)] hover:text-fg"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          {open ? (
            <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          ) : (
            <path d="M1.5 4h11M1.5 10h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-nav"
          className="deck-rise absolute inset-x-0 top-full z-50 max-h-[calc(100dvh_-_var(--nav-h))] overflow-y-auto overscroll-contain border-b border-[var(--deck-rule)] bg-bg [--i:0]"
        >
          <div className="shell grid gap-x-10 gap-y-7 py-6 sm:grid-cols-2">
            {GROUPS.map((g) => (
              <div key={g.label}>
                <div className="deck-eyebrow">{g.label}</div>
                <ul className="mt-2">
                  {g.links.map((item) => {
                    const current = isCurrent(pathname, item.href);
                    return (
                      <li key={item.href} className="border-b border-border last:border-b-0">
                        <Link
                          href={item.href}
                          {...newTabProps(item.href)}
                          onClick={() => setOpen(false)}
                          aria-current={current ? "page" : undefined}
                          className="group flex h-12 items-center justify-between gap-4 deck-display text-[1.3125rem] tracking-[-0.02em] text-fg-dim transition-colors hover:text-fg aria-[current=page]:text-fg"
                        >
                          <span className="flex items-center gap-3">
                            {item.l}
                            {current && <span aria-hidden className="size-1.5 rounded-full bg-bull" />}
                            {NEW_TAB.has(item.href) && <span className="sr-only"> (opens in a new tab)</span>}
                          </span>
                          <span aria-hidden className="deck-arrow font-sans text-[0.875rem] text-fg-faint group-hover:text-fg">
                            {NEW_TAB.has(item.href) ? "↗" : "→"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          <div className="shell border-t border-border py-4">
            {status === "authenticated" ? (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="deck-btn w-full text-bear"
              >
                Sign out
              </button>
            ) : (
              <button
                type="button"
                onClick={() => signIn("google", { callbackUrl: "/quant" })}
                className="deck-btn w-full"
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

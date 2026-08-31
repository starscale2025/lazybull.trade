"use client";

// Mobile nav: below md the desktop link rail is hidden, so this renders a
// bordered mono hamburger that opens a full-width sheet under the bar with
// the same numbered links (01 LEARN … 07 ABOUT) + sign in / sign out.
// Closes on link tap, Escape, or a tap outside.

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import Link from "next/link";

const LINKS = [
  { l: "Learn", href: "/learn" },
  { l: "Visual chain", href: "/trade" },
  { l: "Pro charts", href: "/pro" },
  { l: "Quant", href: "/quant" },
  { l: "Portfolio", href: "/portfolio" },
  { l: "Greeks", href: "/greeks" },
  { l: "Pricing", href: "/pricing" },
  { l: "About", href: "/about" },
];

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { status } = useSession();
  const pathname = usePathname();

  // Route changed under us (e.g. back button) → fold the sheet.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
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
    <div ref={wrapRef} className="lg:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-controls="mobile-nav"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--glass-border)] font-mono text-fg-dim transition-colors hover:border-fg-dim hover:text-fg"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          {open ? (
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" />
          ) : (
            <path d="M1 3.5h12M1 7h12M1 10.5h12" stroke="currentColor" strokeWidth="1.5" />
          )}
        </svg>
      </button>

      {open && (
        <div
          id="mobile-nav"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-[var(--r-panel)] border border-[var(--glass-border)] bg-bg shadow-2xl"
        >
          <div className="flex flex-col py-2">
            {LINKS.map((item) => (
              <Link
                key={item.l}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex h-11 items-center px-5 font-mono text-[0.75rem] uppercase tracking-wider text-fg-dim transition-colors hover:bg-surface hover:text-fg"
              >
                {item.l}
              </Link>
            ))}
          </div>
          <div className="border-t border-border px-5 py-3">
            {status === "authenticated" ? (
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex h-10 w-full items-center justify-center rounded-[12px] border border-border font-mono text-[0.6875rem] uppercase tracking-wider text-bear transition-colors hover:bg-bear/10"
              >
                Sign out
              </button>
            ) : (
              <button
                onClick={() => signIn("google", { callbackUrl: "/quant" })}
                className="flex h-10 w-full items-center justify-center rounded-[12px] border border-border font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim transition-colors hover:border-fg-dim hover:text-fg"
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

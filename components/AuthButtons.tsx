"use client";

// Auth UI dropped into the Nav. Three states:
//   - loading: an invisible "Sign in"-sized stub (holds the space, flashes nothing)
//   - unauthenticated: "Sign in" → /auth/signin
//   - authenticated: avatar + name → click → menu with sign out

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";

export function AuthButtons() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  // The stub holds "Sign in"'s exact box, invisibly. It used to be a 30px
  // pulsing dot, so the nav's right cluster grew ~49px the moment the session
  // answered, a layout shift on every page (2026-11, Gate A2 CLS). Most
  // visitors are signed out, so for them nothing moves at all.
  if (status === "loading") {
    return (
      <span
        aria-hidden
        className="invisible hidden h-9 items-center gap-2 rounded-full px-3 text-[0.875rem] tracking-[-0.005em] sm:inline-flex"
      >
        Sign in
      </span>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return (
      <button
        onClick={() => signIn("google", { callbackUrl: window.location.pathname + window.location.search })}
        className="hidden h-9 items-center gap-2 rounded-full px-3 text-[0.875rem] tracking-[-0.005em] text-fg-dim transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] hover:text-fg sm:inline-flex"
      >
        Sign in
      </button>
    );
  }

  const u = session.user;
  const initials = (u.name || u.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] px-2 text-[0.875rem] text-fg-dim transition-colors hover:border-bull/60 hover:text-fg"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {u.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.image} alt="" className="size-6 rounded-full" />
        ) : (
          <span className="grid size-6 place-items-center rounded-full border border-border bg-bg font-mono text-[0.625rem] font-bold text-bull">
            {initials || "··"}
          </span>
        )}
        <span className="hidden lg:inline normal-case tracking-normal text-fg">
          {u.name?.split(" ")[0] || u.email}
        </span>
        <span className="text-fg-faint">▾</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-[var(--r-cell)] border border-border bg-bg shadow-2xl"
        >
          <div className="border-b border-border px-3 py-3">
            <div className="t-chrome text-fg-faint">
              signed in as
            </div>
            <div className="mt-1 truncate text-[0.8125rem] text-fg">{u.name || u.email}</div>
            {u.email && u.name && (
              <div className="mt-0.5 truncate font-mono text-[0.625rem] text-fg-faint">{u.email}</div>
            )}
          </div>
          <div className="py-1 text-[0.875rem]">
            <Link
              href="/quant"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-fg-dim hover:bg-surface hover:text-fg"
            >
              ↗ Workbench
            </Link>
            <Link
              href="/pro"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-fg-dim hover:bg-surface hover:text-fg"
            >
              ↗ Pro charts
            </Link>
            <Link
              href="/learn"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-fg-dim hover:bg-surface hover:text-fg"
            >
              ↗ Learn
            </Link>
            {/* The plan, usage and subscription live on /account (app/account).
                A paid tier a user cannot find or cancel is a support ticket and
                a chargeback; the link sits in the one menu every signed-in
                visitor already opens. */}
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-fg-dim hover:bg-surface hover:text-fg"
            >
              ↗ Account &amp; plan
            </Link>
          </div>
          <div className="border-t border-border">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full px-3 py-2 text-left text-[0.875rem] text-bear hover:bg-bear/10"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

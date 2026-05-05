"use client";

// Auth UI dropped into the Nav. Three states:
//   - loading: spinner stub (don't flash "Sign in" then jump to a face)
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

  if (status === "loading") {
    return (
      <span className="hidden h-9 items-center px-3 font-mono text-[11px] uppercase tracking-wider text-fg-faint sm:inline-flex">
        <span className="size-1.5 rounded-full bg-fg-faint animate-pulse" />
      </span>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return (
      <button
        onClick={() => signIn("google", { callbackUrl: "/quant" })}
        className="hidden h-9 items-center gap-2 px-3 font-mono text-[11px] uppercase tracking-wider text-fg-dim transition-colors hover:text-fg sm:inline-flex"
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
        className="flex h-9 items-center gap-2 border border-border bg-surface px-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim transition-colors hover:border-bull/60 hover:text-fg"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {u.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.image} alt="" className="size-6 rounded-full" />
        ) : (
          <span className="grid size-6 place-items-center border border-border bg-bg font-mono text-[9px] font-bold text-bull">
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
          className="absolute right-0 top-11 z-40 w-64 border border-border bg-bg shadow-2xl"
        >
          <div className="border-b border-border px-3 py-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
              signed in as
            </div>
            <div className="mt-1 truncate text-[13px] text-fg">{u.name || u.email}</div>
            {u.email && u.name && (
              <div className="mt-0.5 truncate font-mono text-[10px] text-fg-faint">{u.email}</div>
            )}
          </div>
          <div className="py-1 font-mono text-[11px] uppercase tracking-wider">
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
          </div>
          <div className="border-t border-border">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="block w-full px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-bear hover:bg-bear/10"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

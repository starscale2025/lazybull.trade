"use client";

// Auth UI dropped into the Nav. Three states:
//   - loading: an invisible "Sign in"-sized stub (holds the space, flashes nothing)
//   - unauthenticated: "Sign in" → Google
//   - authenticated: the mockups' avatar (initials on a warm grey disc) →
//     click → a menu with the account pages and sign out

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { NEW_TAB, newTabProps } from "@/lib/directory";

const MENU = [
  { l: "Workbench", href: "/quant" },
  { l: "Pro charts", href: "/pro" },
  { l: "Learn", href: "/learn" },
  // The plan, usage and subscription live on /account (app/account). A paid
  // tier a user cannot find or cancel is a support ticket and a chargeback;
  // the link sits in the one menu every signed-in visitor already opens.
  { l: "Account & plan", href: "/account" },
] as const;

/**
 * @param always show at every width. The site navbar hides this below sm,
 *   where its menu button's sheet carries sign in and the account; a bar with
 *   no such sheet (the practice workspace's) passes `always`.
 */
export function AuthButtons({ always = false }: { always?: boolean }) {
  const show = always ? "inline-flex" : "hidden sm:inline-flex";
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The stub holds "Sign in"'s exact box, invisibly, so the bar's right
  // cluster does not move when the session answers (Gate A2 CLS). Most
  // visitors are signed out, so for them nothing moves at all.
  if (status === "loading") {
    return (
      <span aria-hidden className={`deck-navlink invisible ${show}`}>
        Sign in
      </span>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return (
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: window.location.pathname + window.location.search })}
        className={`deck-navlink ${show}`}
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

  // Below sm the menu button's sheet carries the account page and sign out, so
  // the avatar steps aside there and the bar keeps its right gutter on a phone.
  // A disclosure, not an ARIA menu: Tab moves through the links, Escape and a
  // focus leaving the panel close it.
  return (
    <div
      ref={wrapRef}
      className={`relative ${always ? "block" : "hidden sm:block"}`}
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
          // Safari does not focus a button on click; focusing it keeps the
          // bar pinned (NavAutoHide) while the panel is open.
          buttonRef.current?.focus();
        }}
        className="flex h-8 items-center gap-2 rounded-full pl-0.5 pr-2 text-[0.8125rem] text-fg-dim transition-colors hover:bg-[var(--deck-raised)] hover:text-fg"
        aria-expanded={open}
        aria-controls="account-panel"
        aria-label={`Account: ${u.name || u.email}`}
      >
        {u.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.image} alt="" className="size-7 rounded-full" />
        ) : (
          <span className="grid size-7 place-items-center rounded-full bg-[#34342f] text-[0.6875rem] font-semibold text-fg">
            {initials || "··"}
          </span>
        )}
        <span className="hidden max-w-[6rem] truncate text-fg 2xl:inline">{u.name?.split(" ")[0] || u.email}</span>
        <ChevronDown aria-hidden size={13} strokeWidth={1.75} className="text-fg-faint" />
      </button>

      {open && (
        <div id="account-panel" className="deck-menu absolute right-0 top-10 z-40 w-64 overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="deck-label">Signed in as</div>
            <div className="mt-1.5 truncate text-[0.875rem] text-fg">{u.name || u.email}</div>
            {u.email && u.name && <div className="mt-0.5 truncate font-mono text-[0.6875rem] text-fg-faint">{u.email}</div>}
          </div>
          <div className="p-1.5">
            {MENU.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                {...newTabProps(item.href)}
                onClick={() => setOpen(false)}
                className="flex h-10 items-center justify-between rounded-[8px] px-3 text-[0.875rem] text-fg-dim transition-colors hover:bg-[var(--deck-raised)] hover:text-fg"
              >
                {item.l}
                {NEW_TAB.has(item.href) && <span className="sr-only"> (opens in a new tab)</span>}
                <span aria-hidden className="text-fg-faint">
                  ↗
                </span>
              </Link>
            ))}
          </div>
          <div className="border-t border-border p-1.5">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex h-10 w-full items-center rounded-[8px] px-3 text-left text-[0.875rem] text-bear transition-colors hover:bg-[var(--deck-red-tint)]"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

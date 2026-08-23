"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The pending half of a navigation.
 *
 * app/template.tsx already fades a veil in when a route COMMITS. The gap it
 * cannot cover is the one before that: the App Router deliberately leaves the
 * previous page on screen, fully interactive, while the next one resolves.
 * Measured on this site, that window runs ~126ms between light pages and just
 * over a second into /pro — long enough that a click reads as a dead click.
 *
 * WHY A DOCUMENT-LEVEL CLICK LISTENER, not `useLinkStatus`. That hook is the
 * documented way to do this, but it only reports for the <Link> it is rendered
 * inside — so a global indicator would mean wrapping every link in Nav,
 * MobileMenu, Footer, Dock, GetStarted and the directory, and would still miss
 * any link added later. One capture-phase listener covers every internal link
 * on the site, including ones this component has never heard of.
 *
 * THE DEBOUNCE IS THE WHOLE DESIGN. Showing a loader on every click would make
 * the fast hops feel slower, not faster — a flash of chrome where there used to
 * be an instant page. Nothing renders until a navigation has already been
 * pending for DELAY_MS, so quick navigations complete having drawn nothing.
 *
 * NEVER STUCK. An overlay that fails to clear is far worse than the dead click
 * it replaced, so there are three independent ways out: the pathname changing
 * (the normal one), a hard MAX_MS ceiling, and pagehide/popstate. Any one of
 * them alone is enough to take it down.
 */

// Below this a navigation reads as instant and drawing anything would make it
// feel slower, not faster. Next's own guidance suggests ~100ms; 120 keeps the
// loader off genuinely instant hops while still showing on most real ones.
// Set it to 0 to make the loader unconditional on every navigation.
const DELAY_MS = 120;
const MAX_MS = 8000; // hard ceiling: the overlay may never outlive this

export function RouteLoader() {
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One place to stand down, so every exit route is identical.
  const clear = useRef(() => {});
  clear.current = () => {
    if (delayTimer.current) clearTimeout(delayTimer.current);
    if (maxTimer.current) clearTimeout(maxTimer.current);
    delayTimer.current = null;
    maxTimer.current = null;
    setVisible(false);
  };

  // The route committed — whatever we were waiting for has arrived.
  useEffect(() => {
    clear.current();
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Let anything already handled, or any non-plain click, behave normally:
      // modified clicks open tabs/windows and never navigate this document.
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // Off-site, or a scheme that hands off to another app.
      if (url.origin !== window.location.origin) return;
      // Same document: an in-page anchor or a bare "#" toggle is not a
      // navigation, and putting a loading overlay over one would be a lie.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      if (delayTimer.current) clearTimeout(delayTimer.current);
      if (maxTimer.current) clearTimeout(maxTimer.current);
      delayTimer.current = setTimeout(() => setVisible(true), DELAY_MS);
      maxTimer.current = setTimeout(() => clear.current(), MAX_MS);
    };

    // Capture phase: this must observe the click even if a handler downstream
    // stops propagation on its way to the router.
    document.addEventListener("click", onClick, true);
    // A full page unload (or a back/forward that skips the pathname effect)
    // must not leave the overlay painted over whatever renders next.
    const onLeave = () => clear.current();
    window.addEventListener("pagehide", onLeave);
    window.addEventListener("popstate", onLeave);

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", onLeave);
      window.removeEventListener("popstate", onLeave);
      if (delayTimer.current) clearTimeout(delayTimer.current);
      if (maxTimer.current) clearTimeout(maxTimer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading-rail" aria-hidden />
      <span className="t-eyebrow text-fg-faint">loading</span>
    </div>
  );
}

"use client";

import { ViewTransition } from "react";

// Route changes (M3, 2026-11-09). Template remounts per route, so its
// <ViewTransition> enters and exits on every navigation: the old page leaves
// fast and the new one settles in, a short fade with an 8px rise (globals.css,
// ROUTE TRANSITIONS). The nav mark is named on its own (Nav.tsx) so it holds
// still while the page changes under it.
//
// The route veil, a 240ms settle drawn over the new page's first paint, is
// the fallback for browsers without view transitions; where they exist, CSS
// hides it so the two never stack. Reduced motion and the site's pause turn
// both off.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ViewTransition enter="route-in" exit="route-out" default="none">
        {children}
      </ViewTransition>
      <div className="route-veil" aria-hidden />
    </>
  );
}

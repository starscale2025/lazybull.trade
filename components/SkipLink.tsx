"use client";

import { jumpToElement } from "@/lib/motion/scroll";

/**
 * "Skip to content", made to do something. It used to be a plain #main link,
 * and #main is a `display: contents` wrapper (app/layout.tsx), which cannot take
 * focus, so the link was a no-op on every route (2026-11 verification). It now
 * moves focus to the page's own target: an explicit [data-skip-target], else
 * the first h1 (frame zero's headline on "/"), else the page's <main>.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="skip-link"
      onClick={(e) => {
        const t =
          document.querySelector<HTMLElement>("[data-skip-target]") ??
          document.querySelector<HTMLElement>("main h1, h1") ??
          document.querySelector<HTMLElement>("main");
        if (!t) return;
        e.preventDefault();
        if (!t.hasAttribute("tabindex")) t.tabIndex = -1;
        t.focus({ preventScroll: true });
        jumpToElement(t);
      }}
    >
      skip to content
    </a>
  );
}

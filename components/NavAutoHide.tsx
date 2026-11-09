"use client";

import { useEffect, useRef } from "react";

/**
 * The nav steps out of the way on the way down and comes back the moment the
 * visitor scrolls up (M10, from the panel: headings were reading through the
 * bar). Rendered inside Nav's sticky wrapper, it flags that wrapper with
 * data-nav-hidden and CSS does the rest (globals.css, NAV AUTO-HIDE).
 *
 * It stays put near the top of the page, while anything in the bar holds
 * focus (keyboard users must never lose the control they are on), and while
 * the More menu is open.
 */
export function NavAutoHide() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const bar = ref.current?.parentElement;
    if (!bar) return;
    let last = window.scrollY;
    let raf = 0;
    const set = (hidden: boolean) => {
      if (hidden) bar.dataset.navHidden = "";
      else delete bar.dataset.navHidden;
    };
    const check = () => {
      raf = 0;
      const y = window.scrollY;
      const dy = y - last;
      const pinned = y < 140 || bar.contains(document.activeElement) || !!bar.querySelector("details[open]");
      if (pinned) set(false);
      else if (dy > 6) set(true);
      else if (dy < -4) set(false);
      if (Math.abs(dy) > 4 || pinned) last = y;
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    const show = () => set(false);
    window.addEventListener("scroll", queue, { passive: true });
    bar.addEventListener("focusin", show);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      bar.removeEventListener("focusin", show);
      set(false);
    };
  }, []);

  return <span ref={ref} hidden />;
}

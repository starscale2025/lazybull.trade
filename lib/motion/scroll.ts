import type Lenis from "lenis";

/**
 * THE PAGE'S ONE SCROLLER (2026-11). components/motion/LenisRoot.tsx registers
 * its Lenis here, and anything that moves the page from code goes through
 * these helpers instead of window.scrollTo. While Lenis is gliding it ignores
 * native scroll events and writes its own position on the next frame, so a
 * bare window.scrollTo mid-glide is silently undone.
 *
 * With no Lenis (before mount, in tests) each helper falls back to the native
 * call it replaces.
 */
let current: Lenis | null = null;

export function registerLenis(lenis: Lenis | null) {
  current = lenis;
}

export function getLenis(): Lenis | null {
  return current;
}

/** True while Lenis is smoothing the wheel on this page. */
export function isSmoothing(): boolean {
  return !!current && current.options.smoothWheel && !current.isStopped && !current.prefersReducedMotion;
}

/** Put the page at `y` now, cancelling any glide in flight. */
export function jumpTo(y: number) {
  if (!current) {
    window.scrollTo(0, y);
    return;
  }
  // Re-measure first: callers jump right after the layout changed under them.
  current.resize();
  current.scrollTo(y, { immediate: true, force: true });
}

/** Move the page by `dy` now, from where it actually is rather than where a glide was heading. */
export function jumpBy(dy: number) {
  if (!current) {
    window.scrollBy(0, dy);
    return;
  }
  current.resize();
  current.scrollTo(current.actualScroll + dy, { immediate: true, force: true });
}

/** Bring `el` to the top of the page now, below the nav (Lenis reads scroll-padding-top). */
export function jumpToElement(el: HTMLElement) {
  if (!current) {
    el.scrollIntoView({ block: "start" });
    return;
  }
  current.scrollTo(el, { immediate: true, force: true });
}

/** Glide to a y position or an element. Under reduced motion Lenis makes it a jump. */
export function glideTo(target: number | HTMLElement, { duration = 1.2 }: { duration?: number } = {}) {
  if (!current) {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    if (typeof target === "number") window.scrollTo({ top: target, behavior });
    else target.scrollIntoView({ behavior, block: "start" });
    return;
  }
  current.scrollTo(target, { duration });
}

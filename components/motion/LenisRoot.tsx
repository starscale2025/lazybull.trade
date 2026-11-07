"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { getLenis, registerLenis } from "@/lib/motion/scroll";
import { initMotionPause, isMotionPaused, motion, onMotionPausedChange } from "@/lib/motion/bus";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * LENIS, ON THE ONE CLOCK (2026-11, THE MATTER plan §4).
 *
 * Inertial wheel scrolling for the whole site, stepped by GSAP's ticker, so
 * the page, ScrollTrigger and every GSAP tween move on the same frame instead
 * of separate requestAnimationFrame loops racing each other.
 *
 * - Touch stays native (syncTouch off): phones keep their own physics.
 * - An inner pane that can scroll (the chain, panels, dialogs, the code
 *   editor) scrolls itself first and hands back to the page at its end, as
 *   native scrolling does (allowNestedScroll).
 * - A wheel another handler already consumed, like the /pro chart's zoom, is
 *   left alone: Lenis never checks defaultPrevented on its own.
 * - Tools stay calm: on /pro, /trade, /portfolio, /admin and a practice
 *   problem the wheel is native and 1:1. So it is while motion is paused
 *   (lib/motion/bus.ts).
 * - While a modal holds the page (html.lb-modal-open, from ConsentGate and
 *   useModalFocus) Lenis stops, or it would scroll what overflow:hidden froze.
 * - Reduced motion: Lenis itself forces lerp 1 and instant programmatic
 *   scrolls (respectReducedMotion, on by default).
 * - Hash links stay native. Lenis's anchor handler ignores defaultPrevented
 *   and would undo the skip link's focus jump.
 *
 * lenis/dist/lenis.css is deliberately not imported: its height:auto on html
 * and body would undo the layout's h-full / min-h-full. The rules worth having
 * are in globals.css, under LENIS.
 *
 * Code that moves the page goes through lib/motion/scroll.ts, never
 * window.scrollTo: Lenis rewrites the position on its next frame. Each tick
 * also writes the page's scroll state onto the motion bus.
 */
const TOOLS = /^\/(?:pro|trade|portfolio|admin)(?:\/|$)|^\/practice\/(?!tracks\/|certificate\/|contest$|profile$)[^/]+$/;

/** Wheel smoothing, per frame at 60fps. Tuned against the film's settle time (see ScrollCinema). */
export const LENIS_LERP = 0.12;

export function LenisRoot() {
  const pathname = usePathname();
  const path = useRef(pathname);

  // Read by the pause listener too, which outlives any one route.
  const smooth = (lenis: Lenis) => {
    lenis.options.smoothWheel = !TOOLS.test(path.current) && !isMotionPaused();
  };

  useEffect(() => {
    initMotionPause();
    const lenis = new Lenis({
      autoRaf: false,
      lerp: LENIS_LERP,
      smoothWheel: true,
      syncTouch: false,
      allowNestedScroll: true,
      stopInertiaOnNavigate: true,
      virtualScroll: ({ event }) => !event.defaultPrevented,
    });
    registerLenis(lenis);

    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);
    const tick = (time: number) => {
      lenis.raf(time * 1000);
      motion.scroll = lenis.scroll;
      motion.progress = lenis.progress;
      motion.velocity = lenis.velocity;
      motion.direction = lenis.direction;
    };
    gsap.ticker.add(tick);
    // Lag smoothing would hold the page back after a long frame and let the
    // scroll and the triggers drift apart; the page must land where the
    // wheel put it.
    gsap.ticker.lagSmoothing(0);

    const root = document.documentElement;
    const syncLock = () => {
      const held = root.classList.contains("lb-modal-open");
      if (held && !lenis.isStopped) lenis.stop();
      else if (!held && lenis.isStopped) lenis.start();
    };
    syncLock();
    const lock = new MutationObserver(syncLock);
    lock.observe(root, { attributes: true, attributeFilter: ["class"] });

    const onPointer = (e: PointerEvent) => {
      motion.pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      motion.pointerY = 1 - (e.clientY / window.innerHeight) * 2;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const offPause = onMotionPausedChange(() => smooth(lenis));

    return () => {
      offPause();
      window.removeEventListener("pointermove", onPointer);
      lock.disconnect();
      gsap.ticker.remove(tick);
      lenis.off("scroll", onScroll);
      registerLenis(null);
      lenis.destroy();
    };
    // `smooth` reads refs and the bus only; it never goes stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    path.current = pathname;
    const lenis = getLenis();
    if (!lenis) return;
    smooth(lenis);
    // New page, new dimensions. Next has already put the scroll where it
    // belongs (the top, a hash, or a restored position on Back); resize()
    // takes that as the starting point.
    lenis.resize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { getMatterSlots, onMatterSlots } from "@/lib/matter";
import { isToolRoute } from "@/lib/motion/routes";

const slotCount = () => getMatterSlots().length;

/**
 * Starts THE MATTER (components/matter/engine.ts, and three.js with it) the
 * first time a slot comes near the screen, after the page has finished
 * loading and the main thread is idle, so it never competes with the headline
 * or the first input. A page whose only slot is the footer's never loads it
 * unless the visitor scrolls down to it. Never on a tool route: the tools keep
 * the matter dormant (no ambient motion, no GPU). Mounted once, in the root
 * layout.
 */
export function MatterRoot() {
  const pathname = usePathname();
  const slots = useSyncExternalStore(onMatterSlots, slotCount, () => 0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || slots === 0 || isToolRoute(pathname)) return;
    let idle = 0;
    let timer = 0;
    let loaded = document.readyState === "complete";
    let near = false;
    const start = () => {
      if (started.current) return;
      started.current = true;
      io.disconnect();
      void import("./engine").then((m) => m.startMatter());
    };
    const go = () => {
      if (!loaded || !near || started.current || idle || timer) return;
      const ric = window.requestIdleCallback;
      if (typeof ric === "function") idle = ric(start, { timeout: 1500 });
      else timer = window.setTimeout(start, 200);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          near = true;
          go();
        }
      },
      { rootMargin: "800px 0px" }
    );
    for (const s of getMatterSlots()) io.observe(s.el);
    const onLoad = () => {
      loaded = true;
      go();
    };
    if (!loaded) window.addEventListener("load", onLoad, { once: true });
    return () => {
      io.disconnect();
      window.removeEventListener("load", onLoad);
      if (idle) window.cancelIdleCallback?.(idle);
      window.clearTimeout(timer);
    };
  }, [slots, pathname]);

  return null;
}

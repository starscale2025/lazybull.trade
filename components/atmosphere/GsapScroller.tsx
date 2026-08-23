"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Global GSAP + ScrollTrigger driver. Mount once in the root layout — it
 * scans for elements with `data-gsap="<pattern>"` attributes on every page
 * (and re-scans on route changes via MutationObserver) and wires up the
 * matching animation. Keeps consumers declarative: tag an element, get
 * scroll motion. No imperative useGSAP hooks scattered through pages.
 *
 * Patterns (set via `data-gsap`):
 *   fade-up        — opacity + 32px Y on enter viewport
 *   fade-up-soft   — opacity + 12px Y on enter (subtler, for body copy)
 *   stagger        — children fade-up with 80ms cascade
 *   stagger-fast   — children fade-up with 40ms cascade
 *   scale-in       — opacity + scale(0.96) on enter
 *   blur-in        — opacity + blur(10px) on enter
 *   slide-left     — opacity + 48px X on enter
 *   slide-right    — opacity + −48px X on enter
 *   parallax       — Y translate proportional to scroll progress (use
 *                    `data-gsap-amount="120"` to tune travel in px)
 *   reveal-clip    — clip-path inset reveal left → right
 *   draw           — SVG stroke draws itself (element needs `pathLength={1}`)
 *
 * All patterns collapse to an instant snap under `prefers-reduced-motion`;
 * `parallax` is not bound at all.
 *
 * Modifiers:
 *   data-gsap-delay="0.2"     seconds
 *   data-gsap-duration="1.2"  seconds
 *   data-gsap-start="top 85%" custom ScrollTrigger start
 *   data-gsap-amount="120"    px for parallax
 *   data-gsap-once="false"    re-trigger on each enter
 */
export function GsapScroller() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Respect reduced-motion — drop animations to instant snaps.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.defaults({ ease: "power3.out", duration: reduced ? 0 : 1.0 });

    // Expose for debugging.
    (window as unknown as { gsap: unknown; ScrollTrigger: unknown }).gsap = gsap;
    (window as unknown as { gsap: unknown; ScrollTrigger: unknown }).ScrollTrigger = ScrollTrigger;

    const wired = new WeakSet<Element>();

    // GsapScroller lives in the ROOT layout, so it is never unmounted on a
    // client-side route change and the cleanup below only runs on a full page
    // teardown. The MutationObserver used to watch addedNodes only, so every
    // soft navigation permanently added ScrollTriggers for elements the router
    // had already removed — each holding a window resize listener and a strong
    // reference to a detached DOM subtree. Measured: triggers grew 2 -> 4 -> 6
    // -> 8 across /about <-> /learn navs and never decreased.
    //
    // Sweep triggers whose element has left the document before each new pass.
    const sweepDetached = () => {
      for (const st of ScrollTrigger.getAll()) {
        const t = st.trigger as Element | undefined;
        if (t && !document.contains(t)) {
          st.kill();
          // gsap keeps the tween alive independently of its trigger.
          gsap.killTweensOf(t);
        }
      }
    };

    const num = (el: HTMLElement, attr: string, fallback: number) => {
      const v = el.dataset[attr];
      return v != null && v !== "" ? Number(v) : fallback;
    };

    // `gsap.defaults({duration: 0})` above cannot survive an explicit `duration`
    // on the tween, and every pattern below passes one — so reduced-motion was
    // being honoured in name only: each animation still ran its full 1s travel.
    // Collapse the duration here instead, at the one place all patterns read it.
    const dur = (el: HTMLElement) => (reduced ? 0 : num(el, "gsapDuration", 1.0));

    const wire = (root: ParentNode = document) => {
      const els = root.querySelectorAll<HTMLElement>("[data-gsap]");
      let wiredAny = false;
      els.forEach((el) => {
        if (wired.has(el)) return;
        wired.add(el);
        wiredAny = true;

        const pattern = el.dataset.gsap;
        if (!pattern) return;
        const delay = reduced ? 0 : num(el, "gsapDelay", 0);
        const duration = dur(el);
        const start = el.dataset.gsapStart ?? "top 88%";
        const once = (el.dataset.gsapOnce ?? "true") !== "false";

        const baseTrigger = {
          trigger: el,
          start,
          toggleActions: once ? "play none none none" : "play none none reverse",
        } as const;

        switch (pattern) {
          case "fade-up": {
            gsap.fromTo(
              el,
              { autoAlpha: 0, y: 32, force3D: true },
              { autoAlpha: 1, y: 0, duration, delay, scrollTrigger: baseTrigger }
            );
            break;
          }
          case "fade-up-soft": {
            gsap.fromTo(
              el,
              { autoAlpha: 0, y: 12 },
              { autoAlpha: 1, y: 0, duration: duration * 0.8, delay, scrollTrigger: baseTrigger }
            );
            break;
          }
          case "stagger":
          case "stagger-fast": {
            const kids = Array.from(el.children) as HTMLElement[];
            const cascade = pattern === "stagger-fast" ? 0.04 : 0.08;
            gsap.fromTo(
              kids,
              { autoAlpha: 0, y: 24 },
              {
                autoAlpha: 1,
                y: 0,
                duration,
                delay,
                stagger: cascade,
                scrollTrigger: baseTrigger,
              }
            );
            break;
          }
          case "scale-in": {
            gsap.fromTo(
              el,
              { autoAlpha: 0, scale: 0.96, transformOrigin: "50% 50%" },
              { autoAlpha: 1, scale: 1, duration, delay, scrollTrigger: baseTrigger }
            );
            break;
          }
          case "blur-in": {
            gsap.fromTo(
              el,
              { autoAlpha: 0, filter: "blur(10px)" },
              { autoAlpha: 1, filter: "blur(0px)", duration, delay, scrollTrigger: baseTrigger }
            );
            break;
          }
          case "slide-left": {
            gsap.fromTo(
              el,
              { autoAlpha: 0, x: 48 },
              { autoAlpha: 1, x: 0, duration, delay, scrollTrigger: baseTrigger }
            );
            break;
          }
          case "slide-right": {
            gsap.fromTo(
              el,
              { autoAlpha: 0, x: -48 },
              { autoAlpha: 1, x: 0, duration, delay, scrollTrigger: baseTrigger }
            );
            break;
          }
          case "reveal-clip": {
            gsap.fromTo(
              el,
              { clipPath: "inset(0 100% 0 0)" },
              {
                clipPath: "inset(0 0% 0 0)",
                duration: duration * 1.2,
                delay,
                ease: "power4.out",
                scrollTrigger: baseTrigger,
              }
            );
            break;
          }
          case "draw": {
            // Stroke-draw for SVG geometry. The element must carry
            // `pathLength={1}` so one unit of dash covers the whole path
            // regardless of its real length — same contract as `.svg-draw-in`
            // in globals.css, but fired on scroll rather than on mount.
            gsap.fromTo(
              el,
              { strokeDasharray: 1, strokeDashoffset: 1 },
              {
                strokeDashoffset: 0,
                duration: duration * 1.4,
                delay,
                ease: "power2.inOut",
                scrollTrigger: baseTrigger,
              }
            );
            break;
          }
          case "parallax": {
            // Scrub-driven, so `duration` never applies — honour reduced-motion
            // by simply not binding the scrub at all.
            if (reduced) break;
            const amount = num(el, "gsapAmount", 80);
            gsap.fromTo(
              el,
              { y: -amount / 2 },
              {
                y: amount / 2,
                ease: "none",
                scrollTrigger: {
                  trigger: el,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 0.6,
                },
              }
            );
            break;
          }
        }
      });
      // Only re-measure every trigger when this pass actually wired something.
      // The MutationObserver fires on unrelated DOM churn (toasts, live regions,
      // the ticker) — a full ScrollTrigger.refresh() on each was pure waste.
      if (wiredAny) ScrollTrigger.refresh();
    };

    // Initial pass.
    wire();

    // Pick up nodes added by client-side navigation or late hydration.
    const mo = new MutationObserver((records) => {
      let removed = false;
      for (const r of records) {
        if (r.removedNodes.length) removed = true;
        for (const node of Array.from(r.addedNodes)) {
          if (node.nodeType !== 1) continue;
          const el = node as Element;
          if (el.matches?.("[data-gsap]") || el.querySelector?.("[data-gsap]")) {
            sweepDetached();
            wire(el.parentNode ?? document);
            removed = false;
            break;
          }
        }
      }
      // A navigation that only tears down (no [data-gsap] in the new tree) still
      // has to release the old page's triggers.
      if (removed) sweepDetached();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Refresh on resize / font load — layout shifts invalidate triggers.
    // DEBOUNCED: a raw resize handler ran a full re-measure of every trigger
    // on every one of the dozens of events a drag-resize fires.
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 180);
    };
    window.addEventListener("resize", onResize);
    document.fonts?.ready?.then(() => ScrollTrigger.refresh());

    // Late media (the hero video, images) and the mobile address-bar show/hide
    // shift every "top X%" start AFTER the first measure. If a reveal was
    // measured against a stale position it can sit stuck at its hidden `from`
    // state — which is exactly how the big footer wordmark's reveal-clip stayed
    // half/fully clipped on phones. Re-measure once all media is in, plus a
    // short safety beat after mount so no trigger is left on a stale position.
    const onLoad = () => ScrollTrigger.refresh();
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    const safetyTimer = setTimeout(() => ScrollTrigger.refresh(), 400);

    // Hard guarantee for reveal-clip (the big footer wordmark, etc.): a
    // scroll-reveal must NEVER leave an element stuck at its hidden `from` clip.
    // If one is FULLY on screen yet still clipped, snap it open. Two gates keep
    // this from ever interrupting a live reveal: during active scrolling only
    // the >90%-clipped (never-fired) case is snapped, and a settled element is
    // fully opened 2.5s after scrolling stops — longer than any reveal runs.
    let scrollThrottled = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const unstick = (minClippedPct: number) => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      document.querySelectorAll<HTMLElement>('[data-gsap="reveal-clip"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!(r.height > 0 && r.top >= 0 && r.bottom <= vh)) return;
        const clip = el.style.clipPath || getComputedStyle(el).clipPath;
        const m = /inset\(\s*\S+\s+(\d+(?:\.\d+)?)%/.exec(clip || "");
        if (m && parseFloat(m[1]) > minClippedPct) el.style.clipPath = "inset(0px 0px 0px 0px)";
      });
    };
    const onScroll = () => {
      if (!scrollThrottled) {
        scrollThrottled = true;
        setTimeout(() => {
          scrollThrottled = false;
          unstick(90);
        }, 200);
      }
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => unstick(1), 2500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const unstickInitial = setTimeout(() => unstick(1), 2500); // on-screen-at-load case

    return () => {
      mo.disconnect();
      if (resizeTimer) clearTimeout(resizeTimer);
      clearTimeout(safetyTimer);
      clearTimeout(unstickInitial);
      if (settleTimer) clearTimeout(settleTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onLoad);
      window.removeEventListener("scroll", onScroll);
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return null;
}

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

    const num = (el: HTMLElement, attr: string, fallback: number) => {
      const v = el.dataset[attr];
      return v != null && v !== "" ? Number(v) : fallback;
    };

    const wire = (root: ParentNode = document) => {
      const els = root.querySelectorAll<HTMLElement>("[data-gsap]");
      els.forEach((el) => {
        if (wired.has(el)) return;
        wired.add(el);

        const pattern = el.dataset.gsap;
        if (!pattern) return;
        const delay = num(el, "gsapDelay", 0);
        const duration = num(el, "gsapDuration", 1.0);
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
          case "parallax": {
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
      ScrollTrigger.refresh();
    };

    // Initial pass.
    wire();

    // Pick up nodes added by client-side navigation or late hydration.
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of Array.from(r.addedNodes)) {
          if (node.nodeType !== 1) continue;
          const el = node as Element;
          if (el.matches?.("[data-gsap]") || el.querySelector?.("[data-gsap]")) {
            wire(el.parentNode ?? document);
            break;
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Refresh on resize / font load — layout shifts invalidate triggers.
    const onResize = () => ScrollTrigger.refresh();
    window.addEventListener("resize", onResize);
    document.fonts?.ready?.then(() => ScrollTrigger.refresh());

    return () => {
      mo.disconnect();
      window.removeEventListener("resize", onResize);
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return null;
}

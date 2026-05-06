"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Speed = "fast" | "normal" | "slow";

type Props = {
  children: ReactNode;
  className?: string;
  /** Stagger nested children instead of revealing the whole block at once. */
  stagger?: boolean;
  /** Animation speed. */
  speed?: Speed;
  /** How much of the element must be in view before triggering. 0–1. */
  threshold?: number;
  /** Optional one-shot delay (ms) after intersection before the class is applied. */
  delay?: number;
  /** Element to render. Defaults to <div>. */
  as?: "div" | "section" | "article" | "header" | "footer";
};

export function ScrollReveal({
  children,
  className = "",
  stagger = false,
  speed = "normal",
  threshold = 0.05,
  delay = 0,
  as: As = "div",
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-in");
      return;
    }

    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      if (delay > 0) setTimeout(() => el.classList.add("is-in"), delay);
      else el.classList.add("is-in");
    };

    // If the element is in or above the viewport on mount, reveal it
    // immediately — never trap content behind a missed IO event.
    // (Above-viewport happens after fast/programmatic scrolls.)
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight) {
      fire();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            fire();
            io.unobserve(entry.target);
          }
        }
      },
      { threshold, rootMargin: "0px 0px -5% 0px" }
    );
    io.observe(el);

    // Belt-and-braces: a passive scroll listener as a fallback, so even if
    // an IO event is missed (instant programmatic scroll, JS jank) the
    // section reveals once it crosses the viewport. Self-removes after firing.
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      // Fire if the element is anywhere from "below viewport just touched"
      // to "above viewport already scrolled past" — anything we should have
      // already revealed by now.
      if (rect.top < window.innerHeight) {
        fire();
        window.removeEventListener("scroll", onScroll);
        io.disconnect();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [threshold, delay]);

  const base = stagger ? "reveal-stagger" : "reveal";
  const speedClass = speed === "fast" ? "reveal-fast" : speed === "slow" ? "reveal-slow" : "";
  const finalClass = [base, speedClass, className].filter(Boolean).join(" ");

  return (
    // @ts-expect-error - dynamic element type
    <As ref={ref} className={finalClass}>
      {children}
    </As>
  );
}

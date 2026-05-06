"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: boolean;
  className?: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts up from `from` to `to` once the element scrolls into view.
 * SSR / no-JS: renders the final `to` value so the page never looks empty.
 * Browser: resets to `from` on mount, then animates on first intersection.
 */
export function CountUp({
  to,
  from = 0,
  duration = 1800,
  decimals = 0,
  prefix = "",
  suffix = "",
  separator = true,
  className = "",
}: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);
  // Initial render shows the final value — no blank state ever.
  const [value, setValue] = useState<number>(to);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") return;

    // Reset to the start value on mount (browser only) so we can animate up.
    setValue(from);

    const animate = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / duration);
        const v = from + (to - from) * easeOutCubic(t);
        setValue(v);
        if (t < 1) requestAnimationFrame(tick);
        else setValue(to);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            animate();
            io.unobserve(el);
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);

    // If element is already in the viewport at mount, fire immediately.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      animate();
    }

    return () => io.disconnect();
  }, [from, to, duration]);

  const formatted = (() => {
    const fixed = value.toFixed(decimals);
    if (!separator) return fixed;
    const [intPart, decPart] = fixed.split(".");
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decPart !== undefined ? `${grouped}.${decPart}` : grouped;
  })();

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** How strong the pull is. 0 = none, 1 = full distance. Default 0.25. */
  strength?: number;
  /** Whether to enable the trailing radial glow on hover. Default true. */
  glow?: boolean;
};

/**
 * Wraps children in a span that magnetically pulls toward the cursor
 * when hovered. The wrapper is `inline-flex` so it doesn't disrupt layout.
 *
 * Use around <a> or <button> elements to add tactile interactivity.
 */
export function MagneticCTA({ children, className = "", strength = 0.25, glow = true }: Props) {
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mql = window.matchMedia("(pointer: fine)");
    if (!mql.matches) return;

    let raf = 0;
    let dx = 0;
    let dy = 0;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      dx = (e.clientX - cx) * strength;
      dy = (e.clientY - cy) * strength;
      // Local hover coords for radial glow
      const lx = ((e.clientX - r.left) / r.width) * 100;
      const ly = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          el.style.setProperty("--magx", `${dx.toFixed(1)}px`);
          el.style.setProperty("--magy", `${dy.toFixed(1)}px`);
          el.style.setProperty("--lx", `${lx.toFixed(1)}%`);
          el.style.setProperty("--ly", `${ly.toFixed(1)}%`);
          raf = 0;
        });
      }
    };
    const reset = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      el.style.setProperty("--magx", `0px`);
      el.style.setProperty("--magy", `0px`);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", reset);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", reset);
      cancelAnimationFrame(raf);
    };
  }, [strength]);

  const cls = ["magnetic", glow ? "magnetic-glow" : "", "relative inline-flex", className]
    .filter(Boolean)
    .join(" ");

  return (
    <span ref={ref} className={cls}>
      {children}
    </span>
  );
}

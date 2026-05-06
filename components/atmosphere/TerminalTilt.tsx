"use client";

import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Max rotation in degrees on each axis. Default 6. */
  max?: number;
};

/**
 * Wraps children in a perspective container that gently tilts the inner
 * element toward the cursor on hover. Adds a subtle radial highlight that
 * tracks the cursor (via CSS vars). Used for the hero terminal preview.
 */
export function TerminalTilt({ children, className = "", max = 6 }: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tiltRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const tilt = tiltRef.current;
    if (!wrap || !tilt) return;
    const mql = window.matchMedia("(pointer: fine)");
    if (!mql.matches) return;

    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const r = wrap.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const ry = (px - 0.5) * 2 * max;
      const rx = (0.5 - py) * 2 * max;
      const mx = px * 100;
      const my = py * 100;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          tilt.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
          tilt.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
          tilt.style.setProperty("--mx", `${mx.toFixed(1)}%`);
          tilt.style.setProperty("--my", `${my.toFixed(1)}%`);
          raf = 0;
        });
      }
    };
    const reset = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      tilt.style.setProperty("--rx", `0deg`);
      tilt.style.setProperty("--ry", `0deg`);
    };
    wrap.addEventListener("mousemove", onMove);
    wrap.addEventListener("mouseleave", reset);
    return () => {
      wrap.removeEventListener("mousemove", onMove);
      wrap.removeEventListener("mouseleave", reset);
      cancelAnimationFrame(raf);
    };
  }, [max]);

  return (
    <div ref={wrapRef} className={`tilt-wrap ${className}`}>
      <div ref={tiltRef} className="tilt relative">
        {children}
        <span className="tilt-shine" aria-hidden />
      </div>
    </div>
  );
}

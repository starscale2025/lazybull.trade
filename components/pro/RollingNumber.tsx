"use client";

// Beat 3 of the fill ritual: money doesn't teleport, it ROLLS. A ~450ms
// odometer tween between values with the house fast-attack/long-settle, so an
// account number changing reads as movement instead of a silent mutation.
// Reduced-motion snaps. Renders one span — the tween re-renders only itself.

import { useEffect, useRef, useState } from "react";

export function RollingNumber({
  value,
  format,
}: {
  value: number;
  /** Formats the in-flight value each frame (e.g. money). */
  format: (n: number) => string;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = value;
      setShown(value);
      return;
    }
    const from = fromRef.current;
    if (from === value) return;
    const start = performance.now();
    const DURATION = 450;
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 5);
      const v = from + (value - from) * eased;
      setShown(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <span className="tabular-nums">{format(shown)}</span>;
}

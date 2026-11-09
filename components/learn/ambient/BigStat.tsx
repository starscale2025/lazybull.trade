"use client";

import { useEffect, useRef, useState } from "react";

// A figure that counts up when scrolled into view: the value in a kit Stats
// row (calm, S1, 2026-11-09). It used to draw a whole tile, a colour per tone,
// an animated underline with a glow and a mono caps caption. Stats owns the
// tile, the type and the label now; this owns the count.

export function BigStat({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1400,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Starts AT the value, not 0: SSR markup, screenshots, and any paint before
  // the observer fires must show the truth — a hero stat caught reading
  // "0 BOTS IN THE REGISTRY" looks broken, not animated. The count-up snaps
  // to 0 only at the moment it actually starts playing.
  const [shown, setShown] = useState(value);
  const startedRef = useRef(false); // one-shot; NOT in the effect deps

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value); // the number never scrambles
      return;
    }
    // The count-up start is gated by a REF, and nothing it sets is in the deps
    // below: a dep that changes mid-animation re-runs this effect, and the
    // cleanup's cancelAnimationFrame then kills the count-up after one frame,
    // freezing the number at ~0. The running rAF is only cancelled on real
    // unmount.
    let raf = 0;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || startedRef.current) continue;
          startedRef.current = true;
          setShown(0); // snap to 0 the instant it starts playing
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            setShown(t >= 1 ? value : eased * value);
            if (t < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }
      },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  const safe = Math.max(0, shown); // a stat block can never read negative
  const display = decimals === 0 ? Math.floor(safe).toString() : safe.toFixed(decimals);

  return (
    <span ref={ref} className="inline-block tabular-nums">
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

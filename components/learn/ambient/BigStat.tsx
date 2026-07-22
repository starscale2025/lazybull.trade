"use client";

import { useEffect, useRef, useState } from "react";

// 8rem editorial stat block. Counts up when scrolled into view, draws an
// animated underline below, mono caption underneath. Use these as visual
// anchors in section headers.

const TONE_COLOR: Record<string, string> = {
  bull: "var(--bull)",
  bear: "var(--bear)",
  cyan: "var(--cyan)",
  amber: "var(--amber)",
  plasma: "var(--plasma)",
  fg: "var(--fg)",
};

export function BigStat({
  value,
  label,
  prefix = "",
  suffix = "",
  tone = "fg",
  decimals = 0,
  duration = 1400,
  size = "lg",
}: {
  value: number;
  label: string;
  prefix?: string;
  suffix?: string;
  tone?: keyof typeof TONE_COLOR;
  decimals?: number;
  duration?: number;
  /** lg = 9rem, md = 6rem, sm = 4rem */
  size?: "lg" | "md" | "sm";
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Starts AT the value, not 0: SSR markup, screenshots, and any paint before
  // the observer fires must show the truth — a hero stat caught reading
  // "0 BOTS IN THE REGISTRY" looks broken, not animated. The count-up snaps
  // to 0 only at the moment it actually starts playing.
  const [shown, setShown] = useState(value);
  const [seen, setSeen] = useState(false);
  const startedRef = useRef(false); // one-shot; NOT in the effect deps
  const color = TONE_COLOR[tone];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setSeen(true); // underline still lands; the number never scrambles
      setShown(value);
      return;
    }
    // The count-up start is gated by a REF, not the `seen` state, and `seen`
    // is deliberately absent from the deps below. Earlier this effect listed
    // `seen`, so setSeen(true) re-ran it mid-animation and the cleanup's
    // cancelAnimationFrame killed the count-up after one frame — freezing the
    // number at ~0. Now the running rAF is only cancelled on real unmount.
    let raf = 0;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting || startedRef.current) continue;
          startedRef.current = true;
          setSeen(true);
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
  const fontSize =
    size === "lg" ? "clamp(4.5rem, 11vw, 9rem)" : size === "md" ? "clamp(3rem, 6vw, 6rem)" : "clamp(2rem, 4vw, 4rem)";

  return (
    <div ref={ref} className="relative">
      <div
        className="font-display font-light italic leading-[0.85] tracking-tightest tabular-nums"
        style={{ fontSize, color }}
      >
        {prefix}
        {display}
        {suffix}
      </div>
      <div
        className="mt-3 origin-left h-[2px] w-full"
        style={{
          background: color,
          transform: seen ? "scaleX(1)" : "scaleX(0)",
          transition: `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) 200ms`,
          boxShadow: seen ? `0 0 12px ${color}66` : "none",
        }}
      />
      <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-fg-faint">{label}</div>
    </div>
  );
}

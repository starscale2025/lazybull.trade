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
  const [shown, setShown] = useState(0);
  const [seen, setSeen] = useState(false);
  const color = TONE_COLOR[tone];

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !seen) {
            setSeen(true);
            const start = performance.now();
            const tick = (now: number) => {
              const t = Math.min(1, (now - start) / duration);
              const eased = 1 - Math.pow(1 - t, 3);
              setShown(eased * value);
              if (t < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.4 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value, seen, duration]);

  const display = decimals === 0 ? Math.floor(shown).toString() : shown.toFixed(decimals);
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

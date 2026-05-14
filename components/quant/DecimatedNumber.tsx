"use client";

/**
 * Reversed-decimation reveal for numeric / alphanumeric values.
 *
 * The metric starts as a scramble of glyphs at every position, then locks
 * left-to-right into the real value. Punctuation (dot, minus, percent,
 * comma, slash, plus) passes through unchanged so the silhouette of the
 * number stays recognisable while the digits resolve.
 *
 * Drives an rAF loop, not a `setInterval`, so the scramble animates at
 * monitor refresh rate and pauses when the tab is backgrounded.
 *
 * `active` lets the parent (BotCell) gate when the animation plays — the
 * scramble runs only during the `decimating` phase. Outside that window,
 * the component renders the final value as plain text so screen-readers,
 * snapshot tests, and copy-paste all see the real number.
 */

import { useEffect, useRef, useState } from "react";

const GLYPHS = "0123456789ΔΣΩαβγλμπφ▓▒░╱╲┃┣┫";

function randomGlyph(seedChar: string): string {
  // Match the visual class of the target so the scramble doesn't suddenly
  // grow taller than the resolved value (digits → digits, letters → letters,
  // exotic glyphs only when the target is alphanumeric).
  if (/\d/.test(seedChar)) {
    return String(Math.floor(Math.random() * 10));
  }
  if (/[A-Za-z]/.test(seedChar)) {
    const i = Math.floor(Math.random() * 26);
    return String.fromCharCode(65 + i);
  }
  // For mixed positions just pick from the wider pool.
  return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

export function DecimatedNumber({
  value,
  duration = 650,
  active = true,
  className,
}: {
  value: string;
  duration?: number;
  active?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(active ? scrambleAll(value) : value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      setDisplay(value);
      return;
    }

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);

      // Resolve characters left-to-right with a small lead-in so the very
      // last digit doesn't sit alone scrambling.
      const resolveCount = Math.floor(progress * (value.length + 1));

      let out = "";
      for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        if (i < resolveCount) {
          out += ch;
        } else if (/[A-Za-z0-9]/.test(ch)) {
          out += randomGlyph(ch);
        } else {
          // Punctuation passes through so the shape of the number is stable.
          out += ch;
        }
      }
      setDisplay(out);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, active]);

  return (
    <span className={className} aria-label={value}>
      {display}
    </span>
  );
}

function scrambleAll(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    out += /[A-Za-z0-9]/.test(ch) ? randomGlyph(ch) : ch;
  }
  return out;
}

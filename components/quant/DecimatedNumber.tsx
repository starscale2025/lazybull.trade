"use client";

/**
 * Reversed-decimation reveal for numeric / alphanumeric values.
 *
 * The metric starts as a scramble of glyphs at every position, then locks
 * left-to-right into the real value. Punctuation (dot, minus, percent,
 * comma, slash, plus) passes through unchanged so the silhouette of the
 * number stays recognisable while the digits resolve.
 *
 * Rides the shared ambient clock (lib/ambient-clock) and writes each frame's
 * scramble straight to the span's textContent via a ref — NOT setState. The
 * quant run-all cascade fires dozens of these at once; the old per-frame
 * setState stacked dozens of React commits per frame. Now zero re-renders
 * happen during the scramble; React only renders the final value once.
 *
 * `active` lets the parent (BotCell) gate when the animation plays — the
 * scramble runs only during the `decimating` phase. Outside that window,
 * the component renders the final value as plain text so screen-readers,
 * snapshot tests, and copy-paste all see the real number.
 */

import { useEffect, useRef } from "react";
import { subscribeFrame } from "@/lib/ambient-clock";

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
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = spanRef.current;
    if (!node) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!active || reduce) {
      node.textContent = value;
      return;
    }

    node.textContent = scrambleAll(value);
    let start = 0;

    const unsub = subscribeFrame((now) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / duration);

      // Resolve characters left-to-right with a small lead-in so the very
      // last digit doesn't sit alone scrambling.
      const resolveCount = Math.floor(progress * (value.length + 1));

      let out = "";
      for (let i = 0; i < value.length; i++) {
        const ch = value[i];
        if (i < resolveCount) out += ch;
        else if (/[A-Za-z0-9]/.test(ch)) out += randomGlyph(ch);
        // Punctuation passes through so the shape of the number is stable.
        else out += ch;
      }
      node.textContent = out;

      if (progress >= 1) {
        node.textContent = value;
        unsub();
      }
    });
    return unsub;
  }, [value, duration, active]);

  // Initial paint: the resolved value (or a scramble that the effect
  // immediately takes over). aria-label always carries the true value.
  return (
    <span ref={spanRef} className={className} aria-label={value}>
      {value}
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

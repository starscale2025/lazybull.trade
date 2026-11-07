"use client";

import { setMotionPaused, useMotionPaused } from "@/lib/motion/bus";

/**
 * The site's pause for motion that runs by itself (WCAG 2.2.2); see
 * lib/motion/bus.ts for what it stops. Sits beside ContrastToggle. The label
 * stays fixed and aria-pressed carries the state, so a screen reader hears
 * "pause motion, pressed" rather than a label that changes under it.
 */
export function MotionToggle() {
  const paused = useMotionPaused();
  return (
    <button
      type="button"
      onClick={() => setMotionPaused(!paused)}
      aria-pressed={paused}
      title={
        paused
          ? "Motion is paused: loops and drifts stop and scrolling is 1:1. Click to let the page move again."
          : "Pause the motion that runs by itself: loops, drifts and smooth scrolling."
      }
      className={`inline-flex items-center gap-1.5 border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider transition-colors hover:border-fg-dim hover:text-fg ${
        paused ? "border-amber/60 text-fg" : "border-border text-fg-dim"
      }`}
    >
      <span className={`size-1 rounded-full ${paused ? "bg-amber" : "bg-bull"}`} />
      pause motion
    </button>
  );
}

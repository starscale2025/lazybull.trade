"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

/** The most pixels per CSS pixel a film layer draws (Gate A4 #2). */
export const FILM_DPR_MAX = 1.5;

/**
 * Holds a film layer's pixel ratio between 1 and FILM_DPR_MAX by the frame
 * rate it actually gets: it starts at the top, drops to 1 when frames run
 * long, and goes back up when they have room, at most twice, then stays. At
 * 2x a 1440 frame was 4x the fill of 1x, under a grade, bloom and glass; past
 * 1.5 the difference does not survive the grade and the motion.
 *
 * Two levels, not fine steps: every change resizes the canvas and reallocates
 * the composer's targets, a 30–40 ms frame of its own, so it should happen
 * once, not ten times on the way down. Place it inside the layer's <Canvas>.
 */
export function FilmDpr({ max = FILM_DPR_MAX }: { max?: number }) {
  const setDpr = useThree((s) => s.setDpr);
  const top = () => Math.min(window.devicePixelRatio || 1, max);
  return (
    <PerformanceMonitor
      flipflops={2}
      onDecline={() => setDpr(1)}
      onIncline={() => setDpr(top())}
      onFallback={() => setDpr(1)}
    />
  );
}

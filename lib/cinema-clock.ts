// One shared clock for the cinema. ScrollCinema writes `progress`, the pointer,
// scroll velocity and click events every frame; the R3F 3D layers read them in
// useFrame — and write back interaction state (hover) for the DOM to render.
// This is the "one clock" rule — no per-frame React state crossing into WebGL.
//
// Backed by a globalThis singleton so every importer shares ONE object even if
// the bundler splits this module across client chunks.
export type CinemaHover = {
  /** screen-space anchor (CSS px, within the cinema viewport) */
  sx: number;
  sy: number;
  label: string;
  pct: string;
  up: boolean;
};

type CinemaClock = {
  progress: number;
  /** The film's own time, in seconds: advances only while the film is
   *  playing (not parked) and the site is not paused. Ambient motion reads it. */
  time: number;
  /** Real seconds since the film's last frame, for dt-correct followers. */
  dt: number;
  px: number; // pointer, -1..1 (x: right positive)
  py: number; // pointer, -1..1 (y: down positive)
  vel: number; // damped |scroll velocity|, 0..1
  hover: CinemaHover | null; // written by the candle scene, read by the DOM
  click: { x: number; y: number; t: number } | null; // last pointerdown (NDC-ish)
  /** The 2D scene's geometry in the stage's clip space, for the matter to land on:
   *  the vote's ring [cx, cy, rx, ry] and the mark's box [left, top, w, h]. And
   *  the floor line where the candle camera sees it, in stage pixels [x0, y0, x1, y1],
   *  and the candle being printed, in clip space [x, y]. */
  stage: {
    ring: [number, number, number, number] | null;
    mark: [number, number, number, number] | null;
    floor: [number, number, number, number] | null;
    head: [number, number] | null;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var __cinemaClock: CinemaClock | undefined;
  // eslint-disable-next-line no-var
  var __cinemaFrames: Set<(time: number) => void> | undefined;
}

const clock = (globalThis.__cinemaClock ??= {
  progress: 0,
  time: 0,
  dt: 1 / 60,
  px: 0,
  py: 0,
  vel: 0,
  hover: null,
  click: null,
  stage: { ring: null, mark: null, floor: null, head: null },
});
// Older HMR instances may predate newer fields.
clock.time ??= 0;
clock.dt ??= 1 / 60;
clock.px ??= 0;
clock.py ??= 0;
clock.vel ??= 0;
clock.hover ??= null;
clock.click ??= null;
clock.stage ??= { ring: null, mark: null, floor: null, head: null };

export const cinemaClock: CinemaClock = clock;

// ── ONE CLOCK (Phase 4, M31) ────────────────────────────────────────────────
// The film's 3D layers no longer run render loops of their own. Each one, while
// it is live, registers its root's `advance` here, and the film's single tick
// (ScrollCinema) advances every layer in the same frame as the 2D scene, the
// overlays and the sound, with the film's own time.
// On globalThis for the same reason as the clock: one registry, however the
// bundler splits this module.
const frames: Set<(time: number) => void> = (globalThis.__cinemaFrames ??= new Set());

/** Register a layer's frame; returns the unregister. */
export function registerFilmFrame(fn: (time: number) => void): () => void {
  frames.add(fn);
  return () => {
    frames.delete(fn);
  };
}

/** Draw every live layer at film time `time` (seconds). */
export function advanceFilm(time: number) {
  for (const fn of frames) fn(time);
}

/**
 * A per-frame follower factor made frame-rate independent: `k60` is what the
 * old code used per frame at 60fps; at 120fps the same glide now takes the
 * same time instead of half of it.
 */
export function damp(k60: number, dt: number): number {
  return 1 - Math.pow(1 - k60, dt * 60);
}

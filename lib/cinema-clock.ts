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
  px: number; // pointer, -1..1 (x: right positive)
  py: number; // pointer, -1..1 (y: down positive)
  vel: number; // damped |scroll velocity|, 0..1
  hover: CinemaHover | null; // written by the candle scene, read by the DOM
  click: { x: number; y: number; t: number } | null; // last pointerdown (NDC-ish)
};

declare global {
  // eslint-disable-next-line no-var
  var __cinemaClock: CinemaClock | undefined;
}

const clock = (globalThis.__cinemaClock ??= {
  progress: 0,
  px: 0,
  py: 0,
  vel: 0,
  hover: null,
  click: null,
});
// Older HMR instances may predate newer fields.
clock.px ??= 0;
clock.py ??= 0;
clock.vel ??= 0;
clock.hover ??= null;
clock.click ??= null;

export const cinemaClock: CinemaClock = clock;

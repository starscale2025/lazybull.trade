// One shared clock for the cinema. ScrollCinema writes `progress` (the smoothed
// scroll value) and the normalized pointer every frame; the R3F 3D layers read
// them in useFrame. This is the "one clock" rule — no per-frame React state
// crossing into the WebGL scene.
//
// Backed by a globalThis singleton so every importer shares ONE object even if
// the bundler splits this module across client chunks (otherwise a writer and a
// reader can end up with separate instances and the clock never moves).
type CinemaClock = { progress: number; px: number; py: number };

declare global {
  // eslint-disable-next-line no-var
  var __cinemaClock: CinemaClock | undefined;
}

const clock = (globalThis.__cinemaClock ??= { progress: 0, px: 0, py: 0 });
// Older HMR instances may predate the pointer fields.
clock.px ??= 0;
clock.py ??= 0;

export const cinemaClock: CinemaClock = clock;

// One shared clock for the cinema. ScrollCinema writes `progress` (the smoothed
// scroll value) every frame; the R3F 3D layers read it in useFrame. This is the
// "one clock" rule — no per-frame React state crossing into the WebGL scene.
//
// Backed by a globalThis singleton so every importer shares ONE object even if
// the bundler splits this module across client chunks (otherwise a writer and a
// reader can end up with separate instances and the clock never moves).
declare global {
  // eslint-disable-next-line no-var
  var __cinemaClock: { progress: number } | undefined;
}

export const cinemaClock: { progress: number } =
  globalThis.__cinemaClock ?? (globalThis.__cinemaClock = { progress: 0 });

// The ONE lazy boundary for everything that touches three.js.
//
// The cinema used to lazy-import Bull3D, CandleField3D and Tunnel3D as THREE
// separate chunks — and since the preload gate awaits all of them together
// anyway, the split bought nothing except a duplicated module graph: the
// build shipped two 852KB chunks that BOTH contained WebGLRenderer (34% of
// the static payload). One barrel = one chunk = one three.
// Guarded by scripts/check-three-dupes.mjs after every build.

export { default as Bull3D } from "./Bull3D";
export { default as CandleField3D } from "./CandleField3D";
export { default as Tunnel3D } from "./Tunnel3D";

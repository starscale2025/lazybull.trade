// Scroll-cinema timeline math. Pure functions, no DOM.
// ACTS is the SINGLE SOURCE OF TRUTH for phase boundaries: the component passes
// it to the live scene (public/cinema/scene.html) via initScene, so the scene
// never hardcodes timings — no drift. COPY_BEATS windows live inside these acts.

export type Act =
  | "boot"
  | "assembly"
  | "dive"
  | "regime"
  | "candle"
  | "safety"
  | "consensus"
  | "bull"
  | "matrix";

// Contiguous, covers [0,1]. The candle act (climb → crash → AI prediction) is
// the long signature beat. `matrix` folds the old flash+handoff+reveal.
export const ACTS: Record<Act, { from: number; to: number }> = {
  boot: { from: 0.0, to: 0.05 },
  assembly: { from: 0.05, to: 0.15 },
  dive: { from: 0.15, to: 0.24 },
  regime: { from: 0.24, to: 0.32 },
  candle: { from: 0.32, to: 0.56 },
  safety: { from: 0.56, to: 0.65 },
  consensus: { from: 0.65, to: 0.73 },
  bull: { from: 0.73, to: 0.84 },
  matrix: { from: 0.84, to: 1.0 },
};

export const ACT_ORDER: Act[] = [
  "boot", "assembly", "dive", "regime", "candle", "safety", "consensus", "bull", "matrix",
];

export type CopyBeat = {
  id: string;
  /** Scroll-progress window in which this beat is visible. */
  from: number;
  to: number;
  heading: string;
  sub?: string;
  /** "top" lifts the beat into the upper third so it clears the feature-act
   *  charts; default (undefined) centers it over the laptop/bull visuals. */
  pos?: "top";
};

// DOM overlays synced to scroll progress (crisp text, not baked into the scene).
export const COPY_BEATS: CopyBeat[] = [
  { id: "boot", from: 0.006, to: 0.045, heading: "lazybull.trade", sub: "options — without the fog" },
  { id: "assembly", from: 0.075, to: 0.145, heading: "One terminal. Every tool.", sub: "27 bots · 13 models · 8 live demos" },
  { id: "dive", from: 0.165, to: 0.235, heading: "0.4ms pricing engine", sub: "$100K paper — $0 real dollars at risk, ever" },
  { id: "regime", from: 0.255, to: 0.315, pos: "top", heading: "It reads the regime first.", sub: "Hurst says trend, reversion or noise — before a single trade." },
  { id: "candle-foresight", from: 0.385, to: 0.435, pos: "top", heading: "It saw the crash coming.", sub: "AI Direction Ensemble · ULTRA conviction" },
  { id: "candle-vindication", from: 0.485, to: 0.545, pos: "top", heading: "Flagged DOWN — 12 bars early.", sub: "Reality fell into the cone it drew." },
  { id: "safety", from: 0.575, to: 0.64, pos: "top", heading: "Your worst case is a number you chose.", sub: "Defined-risk · daily kill switch · paper-only, always." },
  { id: "consensus", from: 0.665, to: 0.72, pos: "top", heading: "12 bots. One verdict.", sub: "ULTRA when they agree — historically 65–77% right." },
  { id: "bull", from: 0.75, to: 0.82, heading: "Learn it. Backtest it.", sub: "Only then trade it." },
  { id: "welcome", from: 0.9, to: 0.965, heading: "Welcome in." },
];

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Opacity for a copy beat: 0 at/outside [from,to], linear ramp over `fade`
 * inside each edge, plateau of 1 between the ramps.
 */
export function beatOpacity(
  progress: number,
  beat: Pick<CopyBeat, "from" | "to">,
  fade = 0.02
): number {
  const p = clamp01(progress);
  if (p <= beat.from || p >= beat.to) return 0;
  const f = Math.min(fade, (beat.to - beat.from) / 2);
  if (f <= 0) return 1;
  return Math.min(1, (p - beat.from) / f, (beat.to - p) / f);
}

/**
 * Faint green-bloom overlay: a subtle triangle over the first third of the
 * matrix act (the bull → code transition). The scene's Matrix rain is the real
 * green; this just warms the DOM layer. The component scales it down further.
 */
export function flashOpacity(progress: number): number {
  const from = ACTS.matrix.from; // 0.84
  const to = ACTS.matrix.from + (ACTS.matrix.to - ACTS.matrix.from) * 0.4; // ~0.904
  const p = clamp01(progress);
  if (p <= from || p >= to) return 0;
  const mid = (from + to) / 2;
  return p < mid ? (p - from) / (mid - from) : (to - p) / (to - mid);
}

// The canvas holds opaque almost to the very end: the scene's final frames show
// the homepage (resolved from the Matrix rain), so the gap above the rising real
// <Hero> stays hidden until the pin releases with the Hero at top:0. Only a 2%
// crossfade at the very end blends the scene's homepage → the live page.
const HANDOFF_FADE = { from: 0.98, to: 1.0 };

/** Whole-cinema opacity: ~1 throughout, a short crossfade to 0 at the very end. */
export function canvasOpacity(progress: number): number {
  const { from, to } = HANDOFF_FADE;
  const p = clamp01(progress);
  if (p <= from) return 1;
  if (p >= to) return 0;
  return 1 - (p - from) / (to - from);
}

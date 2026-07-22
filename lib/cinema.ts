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
  // candle's tail was widened (0.56 → 0.59) to give the ICE-LAB finale ~1.8×
  // longer felt duration (see CANDLE_LAB). safety + consensus are shifted LATER
  // to absorb it while bull/matrix (and the fragile end handoff near 1.0) stay
  // EXACTLY fixed; the mild progress-compression on safety/consensus is offset
  // by the longer scroll section (SCROLL_LENGTH_VH), so their felt pace barely
  // changes. Contiguous, still covers [0,1].
  candle: { from: 0.32, to: 0.59 },
  safety: { from: 0.59, to: 0.665 },
  consensus: { from: 0.665, to: 0.73 },
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
  { id: "dive", from: 0.165, to: 0.235, heading: "0.4ms pricing engine", sub: "$5K paper — $0 real dollars at risk, ever" },
  { id: "regime", from: 0.255, to: 0.315, pos: "top", heading: "It reads the regime first.", sub: "Hurst says trend, reversion or noise — before a single trade." },
  { id: "candle-foresight", from: 0.385, to: 0.435, pos: "top", heading: "It saw the crash coming.", sub: "AI Direction Ensemble · ULTRA conviction" },
  // sits over the crash landing + pull-back, which end at CANDLE_BUILD_END —
  // it must be gone before the lab beat (CANDLE_LAB) takes the stage.
  { id: "candle-vindication", from: 0.455, to: 0.5, pos: "top", heading: "Flagged DOWN — 12 bars early.", sub: "Reality fell into the cone it drew." },
  // safety/consensus shifted later with their acts (the lab tail widened). safety
  // opens after the ice-candle layer's fade tail (CANDLE3D.out1 = 0.605) so the
  // quant-lab panel is gone before this copy takes the stage.
  { id: "safety", from: 0.61, to: 0.66, pos: "top", heading: "Your worst case is a number you chose.", sub: "Defined-risk · daily kill switch · paper-only, always." },
  { id: "consensus", from: 0.675, to: 0.725, pos: "top", heading: "12 bots. One verdict.", sub: "ULTRA when they agree — historically 65–77% right." },
  { id: "bull", from: 0.75, to: 0.82, heading: "Learn it. Backtest it.", sub: "Only then trade it." },
  { id: "welcome", from: 0.9, to: 0.965, heading: "Welcome in." },
];

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}


/** Smoothstep 0→1: the copy beats breathe with the same non-linear taste the
    ice-lab finale uses, instead of popping at constant velocity. */
const ss01 = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/**
 * Opacity for a copy beat: 0 at/outside [from,to], smoothstep ramp over `fade`
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
  return ss01(Math.min(1, (p - beat.from) / f, (beat.to - p) / f));
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
// Fade only in the last sliver: the real Get Started rises into place via the
// -100vh overlap and is only aligned with the baked reveal at progress 1. A
// wider window crossfades while it's still offset → a visible double image.
const HANDOFF_FADE = { from: 0.998, to: 1.0 };

/** Whole-cinema opacity: ~1 throughout, a short crossfade to 0 at the very end. */
export function canvasOpacity(progress: number): number {
  const { from, to } = HANDOFF_FADE;
  const p = clamp01(progress);
  if (p <= from) return 1;
  if (p >= to) return 0;
  return 1 - (p - from) / (to - from);
}

// Real-3D (R3F) layers crossfade OVER the 2D scene across their act, holding
// opaque in the middle and dissolving at the edges. While a layer is live the
// matching 2D draw is suppressed (no double image). A 4-point fade: 0 → 1 (in0..in1)
// → 1 → 0 (out0..out1).
export type Fade4 = { in0: number; in1: number; out0: number; out1: number };

function windowOpacity(progress: number, w: Fade4): number {
  const p = clamp01(progress);
  if (p <= w.in0 || p >= w.out1) return 0;
  if (p < w.in1) return ss01((p - w.in0) / (w.in1 - w.in0));
  if (p <= w.out0) return 1;
  return ss01(1 - (p - w.out0) / (w.out1 - w.out0));
}

// The dive act as a REAL 3D tunnel flythrough — a corridor of app screens.
export const DIVE3D: Fade4 = { in0: 0.148, in1: 0.165, out0: 0.222, out1: 0.242 };
// The candle act (climb → crash → AI foresight → the lab finale) as a 3D
// candlestick canyon. out0/out1 hold the layer opaque through the whole widened
// ICE-LAB window (ends at CANDLE_LAB.to = 0.585) then fade over a sliver into the
// 2D safety act — clear of the "safety" copy beat, which now opens at 0.61.
export const CANDLE3D: Fade4 = { in0: 0.32, in1: 0.355, out0: 0.585, out1: 0.605 };

// THE LAB FINALE inside the candle act: the chart timeline (print → crash →
// pull-back) intentionally completes at CANDLE_BUILD_END, freeing the window's
// tail for "the AI takes one candle into the lab" — a single candle lifts out
// of the field spinning and runs a three-phase colour analysis: freezes to ICE
// (scan), warms to GREEN (bullish candidate), then to RED (downside stress-test)
// before settling green (confirmed paper candidate), stretching under analysis
// while the quant-bot panel (DOM overlay in ScrollCinema) types line-by-line on
// the left. Both layers read candleLabT so the 3D colour/pose and the panel's
// type-on + math stay locked to the same clock. The window was widened 0.05 →
// 0.085 (≈1.8× felt with the longer scroll section) for the colour story to
// breathe. Pure f(progress) — scrub-reversible by construction.
export const CANDLE_BUILD_END = 0.5;
export const CANDLE_LAB = { from: 0.5, to: 0.585 };
/** 0→1 through the lab beat (liftoff → ice → green → red → settle → verdict). */
export const candleLabT = (progress: number) =>
  clamp01((clamp01(progress) - CANDLE_LAB.from) / (CANDLE_LAB.to - CANDLE_LAB.from));
// The bull crescendo: fades in over the consensus tail, holds, then fully clears
// by ~0.80 so the classic particle-bull LOGO can play in full after it (assemble →
// scatter → Matrix). `out0` is also where the 2D logo un-hides (scene LOGO0=0.775).
export const BULL3D: Fade4 = { in0: 0.71, in1: 0.735, out0: 0.78, out1: 0.8 };

/** Opacity for the 3D dive-tunnel DOM layer. */
export const dive3dOpacity = (progress: number) => windowOpacity(progress, DIVE3D);
/** Opacity for the 3D candle-canyon DOM layer. */
export const candle3dOpacity = (progress: number) => windowOpacity(progress, CANDLE3D);
/** Opacity for the 3D bull DOM layer. */
export const bull3dOpacity = (progress: number) => windowOpacity(progress, BULL3D);

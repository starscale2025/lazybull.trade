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
  // safety widened 0.075 -> 0.10 at consensus's expense. The single line that
  // speaks to the viewer ("your worst case is a number you chose") had less
  // scroll than the film's exit transition. The width comes ONLY from its
  // adjacent neighbour: bull/matrix and the fragile end handoff near 1.0 stay
  // exactly fixed, and safety still opens after the ice-candle fade tail
  // (CANDLE3D.out1 = 0.605), so no scene overlaps another.
  safety: { from: 0.59, to: 0.69 },
  consensus: { from: 0.69, to: 0.73 },
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
  // THE COPY IS THE VIEWER'S STORY, NOT THE PRODUCT'S SPEC SHEET.
  //
  // Eight of these ten beats used to be the product talking about itself —
  // "27 bots · 13 models · 8 live demos", "0.4ms pricing engine", "It saw the
  // crash coming", "historically 65–77% right". Exactly one line spoke to the
  // person reading it, and it was the best line in the film. A design review
  // put it plainly: the rail already names a real story (boot, the desk, the
  // dive, regime, the crash, your worst case, the vote, conviction, welcome
  // in) and the copy refused to tell it.
  //
  // Three rules now hold here:
  //   1. No specs. Counts and latencies belong on the pages that prove them,
  //      not in a film — and the counts contradicted each other anyway
  //      (27 bots / 13 models / a 12-bot vote, all on one scroll).
  //   2. No oracle. "It saw the crash coming" claims foresight about a crash
  //      this very scene generates, on a paper-only teaching product, three
  //      hundred pixels above a footer disclaiming exactly that. The crash is
  //      a lesson you get to watch, not a prophecy we sell.
  //   3. No unverifiable win rate. "65–77% right" is a number nobody reading
  //      it can check, on a financial-education site. It is gone.
  { id: "boot", from: 0.006, to: 0.045, heading: "lazybull.trade", sub: "options — without the fog" },
  { id: "assembly", from: 0.075, to: 0.145, heading: "A desk that shows its work.", sub: "Every number here can be opened." },
  { id: "dive", from: 0.165, to: 0.235, heading: "Nothing here costs you money.", sub: "Paper only — so you can afford to be wrong on purpose." },
  { id: "regime", from: 0.255, to: 0.315, pos: "top", heading: "Markets have moods.", sub: "Trending, reverting, or noise — named before you commit to anything." },
  { id: "candle-foresight", from: 0.385, to: 0.435, pos: "top", heading: "Then the floor goes.", sub: "This is the part nobody rehearses." },
  // sits over the crash landing + pull-back, which end at CANDLE_BUILD_END —
  // it must be gone before the lab beat (CANDLE_LAB) takes the stage.
  { id: "candle-vindication", from: 0.455, to: 0.5, pos: "top", heading: "You get to watch it here first.", sub: "Better here than with your money inside it." },
  // safety/consensus shifted later with their acts (the lab tail widened). safety
  // opens after the ice-candle layer's fade tail (CANDLE3D.out1 = 0.605) so the
  // quant-lab panel is gone before this copy takes the stage.
  // The one line in the film that always spoke to the reader. It used to get
  // less scroll than the exit transition; the safety act is wider now and the
  // sub-line no longer reverts to a feature triad under it.
  { id: "safety", from: 0.61, to: 0.685, pos: "top", heading: "Your worst case is a number you chose.", sub: "Not a number you find out afterwards." },
  { id: "consensus", from: 0.697, to: 0.727, pos: "top", heading: "They vote. They disagree.", sub: "You see the split, not just the answer." },
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
 * How far a beat's headline has RESOLVED, 0→1, as a pure function of scroll.
 *
 * The per-character reveal used to be a CSS `transition` fired by toggling a
 * class — i.e. wall-clock, in a film where everything else is f(progress). Two
 * things followed from that, and both are visible:
 *
 *   · A fast scroll outran it. The safety headline needed ~1.32s of transition
 *     inside a window only ~570px tall, so a trackpad flick carried you past
 *     the beat before its own words had arrived.
 *   · Scrubbing BACKWARDS replayed the stagger forwards, because a class flip
 *     has no direction. The one layer that could contradict the scrub did.
 *
 * Resolving 30% into the window keeps the entrance quick and leaves the
 * headline settled for the remaining 70%, which is where it is meant to be read.
 * The same shape the lab-line type-on already uses — see `.lab-line`.
 */
export function beatCharT(
  progress: number,
  beat: Pick<CopyBeat, "from" | "to">,
  resolveAt = 0.3
): number {
  const span = beat.to - beat.from;
  if (span <= 0) return 1;
  return ss01(clamp01((clamp01(progress) - beat.from) / (span * resolveAt)));
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
// The bull crescendo: fades in over the consensus tail, holds, CHARGES, and only
// then clears so the classic particle-bull LOGO can play (assemble → scatter →
// Matrix). `out0` is also where the 2D logo un-hides (scene LOGO0).
//
// out0/out1 moved 0.78/0.80 → 0.805/0.825. The charge used to ramp up over
// exactly the progress the wrapper was fading out over, so the two multiplied:
// measured peak ON-SCREEN charge was 0.289 opacity and the impact flash peaked
// at 0.105 — the film's crescendo played at a quarter strength and its impact
// at a tenth, while a code comment justified the resulting near-black frame by
// claiming the flash "is blowing the frame out". It never was.
//
// Now the charge COMPLETES at bt 0.826 — which is exactly p=0.805, where the
// fade begins. The lunge and the burst happen at full opacity; the wrapper
// clears afterwards, out of the white.
export const BULL3D: Fade4 = { in0: 0.71, in1: 0.735, out0: 0.805, out1: 0.825 };

/**
 * THE COLOUR SCRIPT — three rooms inside the candle act.
 *
 * One Bloom at threshold 0.35 used to run the entire act, which is exactly why
 * a frame at its midpoint reads as a single undifferentiated green wash: every
 * emissive in the scene crossed the same threshold at the same strength for
 * ~27% of the film's runtime. A film with nine acts and one grade is nine acts
 * of the same room.
 *
 * The three rooms, and why each is where it is:
 *
 *   COLD      the chart prints. Threshold is HIGH so only the wick tips and the
 *             print head bloom — the glass candles stay glass instead of neon.
 *   HOT       the crash. Threshold drops and the aberration widens, so the red
 *             detonates. Red is deliberately WITHHELD until this moment: it is
 *             the first red in ~14,000px of scroll, which is what makes it land.
 *   CLINICAL  the lab. Bloom near-off, aberration near-zero — the scene stops
 *             being weather and becomes an instrument being read.
 *
 * Returned values are lerped per frame onto the live Bloom / ChromaticAberration
 * / fog, so the transitions between rooms ARE the act's gear changes.
 */
export type Grade = {
  bloomIntensity: number;
  bloomThreshold: number;
  caOffset: number;
  fogNear: number;
  fogFar: number;
};

const GRADE_ROOMS: { at: number; g: Grade }[] = [
  // before the act: whatever the neighbours were doing, held steady
  { at: 0.24, g: { bloomIntensity: 0.95, bloomThreshold: 0.5, caOffset: 0.0005, fogNear: 22, fogFar: 60 } },
  // COLD — glass, not neon
  { at: 0.34, g: { bloomIntensity: 0.8, bloomThreshold: 0.55, caOffset: 0.0004, fogNear: 20, fogFar: 58 } },
  { at: 0.42, g: { bloomIntensity: 0.85, bloomThreshold: 0.52, caOffset: 0.0005, fogNear: 19, fogFar: 56 } },
  // HOT — the crash detonates
  { at: 0.47, g: { bloomIntensity: 1.25, bloomThreshold: 0.28, caOffset: 0.0016, fogNear: 15, fogFar: 48 } },
  { at: 0.5, g: { bloomIntensity: 1.15, bloomThreshold: 0.3, caOffset: 0.0012, fogNear: 16, fogFar: 50 } },
  // CLINICAL — the lab reads the instrument
  { at: 0.55, g: { bloomIntensity: 0.42, bloomThreshold: 0.72, caOffset: 0.0002, fogNear: 26, fogFar: 70 } },
  { at: 0.6, g: { bloomIntensity: 0.5, bloomThreshold: 0.68, caOffset: 0.0003, fogNear: 24, fogFar: 66 } },
];

/** The grade at a given scroll position — linear between the keyed rooms. */
export function grade(progress: number): Grade {
  const p = clamp01(progress);
  const rooms = GRADE_ROOMS;
  if (p <= rooms[0].at) return rooms[0].g;
  if (p >= rooms[rooms.length - 1].at) return rooms[rooms.length - 1].g;
  let i = 0;
  while (i < rooms.length - 2 && p > rooms[i + 1].at) i++;
  const a = rooms[i], b = rooms[i + 1];
  const t = ss01((p - a.at) / (b.at - a.at));
  const mix = (x: number, y: number) => x + (y - x) * t;
  return {
    bloomIntensity: mix(a.g.bloomIntensity, b.g.bloomIntensity),
    bloomThreshold: mix(a.g.bloomThreshold, b.g.bloomThreshold),
    caOffset: mix(a.g.caOffset, b.g.caOffset),
    fogNear: mix(a.g.fogNear, b.g.fogNear),
    fogFar: mix(a.g.fogFar, b.g.fogFar),
  };
}

/** Opacity for the 3D dive-tunnel DOM layer. */
export const dive3dOpacity = (progress: number) => windowOpacity(progress, DIVE3D);
/** Opacity for the 3D candle-canyon DOM layer. */
export const candle3dOpacity = (progress: number) => windowOpacity(progress, CANDLE3D);
/** Opacity for the 3D bull DOM layer. */
export const bull3dOpacity = (progress: number) => windowOpacity(progress, BULL3D);

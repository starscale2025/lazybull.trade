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
  | "mark";

// Contiguous, covers [0,1]. The candle act (climb → crash → AI prediction) is
// the long signature beat. `mark` is the ending: the bull's particles settle
// onto the bull mark (lib/bull-mark.ts). It was `matrix`, the code rain, which
// Phase 4 retired (M25).
export const ACTS: Record<Act, { from: number; to: number }> = {
  boot: { from: 0.0, to: 0.05 },
  assembly: { from: 0.05, to: 0.15 },
  dive: { from: 0.15, to: 0.24 },
  regime: { from: 0.24, to: 0.32 },
  // candle's tail was widened (0.56 → 0.59) to give the ICE-LAB finale ~1.8×
  // longer felt duration (see CANDLE_LAB). safety + consensus are shifted LATER
  // to absorb it while bull/mark (and the fragile end handoff near 1.0) stay
  // EXACTLY fixed; the mild progress-compression on safety/consensus is offset
  // by the longer scroll section (SCROLL_LENGTH_VH), so their felt pace barely
  // changes. Contiguous, still covers [0,1].
  candle: { from: 0.32, to: 0.59 },
  // safety widened 0.075 -> 0.10 at consensus's expense. The single line that
  // speaks to the viewer ("your worst case is a number you chose") had less
  // scroll than the film's exit transition. The width comes ONLY from its
  // adjacent neighbour: bull/mark and the fragile end handoff near 1.0 stay
  // exactly fixed, and safety still opens after the ice-candle fade tail
  // (CANDLE3D.out1 = 0.605), so no scene overlaps another.
  safety: { from: 0.59, to: 0.69 },
  consensus: { from: 0.69, to: 0.73 },
  bull: { from: 0.73, to: 0.84 },
  mark: { from: 0.84, to: 1.0 },
};

export const ACT_ORDER: Act[] = [
  "boot", "assembly", "dive", "regime", "candle", "safety", "consensus", "bull", "mark",
];

/**
 * THE LINE. One sentence, in one place, and it always says paper: the film,
 * the phone film, the still and the landing all read it. There used to be
 * three ("Then paper-trade it.", "Learn it. Then trade it.", "Prove it — then
 * trade it."), and two of them dropped "paper" on a paper-only product
 * (re-tribunal #10).
 */
export const TAGLINE = "Then paper-trade it.";
/**
 * And the words before it, fixed the same way (Gate A2): the film said "Learn
 * it. Backtest it.", the landing "Learn it. Prove it —" and the phone film
 * nothing at all. "Prove it" covers the practice track, the certificates and
 * the quant lab, and asks no jargon of a beginner.
 */
export const TAGLINE_LEAD = "Learn it. Prove it.";

export type CopyBeat = {
  id: string;
  /** Scroll-progress window in which this beat is visible. */
  from: number;
  to: number;
  heading: string;
  sub?: string;
  /** "top" lifts the beat into the upper third so it clears the feature-act
   *  charts; "left" sets it in the left third, beside a subject framed on the
   *  right (the bull); default (undefined) centers it. */
  pos?: "top" | "left";
  /** Fade width in progress (default 0.02). A short beat needs a short fade
   *  or it never holds at full strength (Gate A3 #7). */
  fade?: number;
};

// DOM overlays synced to scroll progress (crisp text, not baked into the scene).
/**
 * The safety act's line speaks to the reader's own position, so it has two
 * versions. "A number you chose" is only true once they have set one
 * (lib/hero-position.ts `chosen`); until then it says the floor CAN be chosen,
 * which is what the example spread on screen shows. Gate A3 #2a.
 */
export const SAFETY_LINES = {
  example: {
    heading: "Your worst case can be a number you choose.",
    sub: "Set before the trade, not found out afterwards.",
  },
  chosen: {
    heading: "Your worst case is a number you chose.",
    sub: "Not a number you find out afterwards.",
  },
} as const;

export const COPY_BEATS: CopyBeat[] = [
  // THE COPY IS THE VIEWER'S STORY, NOT THE PRODUCT'S SPEC SHEET.
  //
  // Eight of these ten beats used to be the product talking about itself —
  // a bot count, a models count, a latency figure, a line claiming the film
  // had foreseen its own crash, and an unverifiable win rate. Exactly one line spoke to the
  // person reading it, and it was the best line in the film. A design review
  // put it plainly: the rail already names a real story (boot, the desk, the
  // dive, regime, the crash, your worst case, the vote, conviction, welcome
  // in) and the copy refused to tell it.
  //
  // Three rules now hold here:
  //   1. No specs. Counts and latencies belong on the pages that prove them,
  //      not in a film — and the counts contradicted each other anyway
  //      (27 bots / 13 models / a 12-bot vote, all on one scroll).
  //   2. No oracle. A line claiming foresight about a crash
  //      this very scene generates, on a paper-only teaching product, three
  //      hundred pixels above a footer disclaiming exactly that. The crash is
  //      a lesson you get to watch, not a prophecy we sell.
  //   3. No unverifiable win rate. A hit-rate range nobody reading it can
  //      check has no business in a film on a financial-education site.
  //      It is gone.
  //   4. The right name. The first beat used to boot into a hostname that
  //      does not resolve. The brand is lazybull; the site is lazybull.us.
  { id: "boot", from: 0.006, to: 0.045, heading: "lazybull", sub: "options — without the fog" },
  { id: "assembly", from: 0.075, to: 0.145, heading: "A desk that shows its work.", sub: "Every number here can be opened." },
  { id: "dive", from: 0.165, to: 0.235, heading: "No trade here uses real money.", sub: "Paper only — so you can afford to be wrong on purpose." },
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
  // Until the visitor has set a spread (the instrument sits below the film),
  // the line cannot claim they chose one: SAFETY_LINES below, Gate A3 #2a.
  { id: "safety", from: 0.61, to: 0.685, pos: "top", ...SAFETY_LINES.example },
  // A real plateau (Gate A3 #7): with the default 0.02 fades a 0.03 beat was
  // all fade and never held. Short fades, and the act's whole width.
  { id: "consensus", from: 0.694, to: 0.729, pos: "top", fade: 0.006, heading: "They vote. They disagree.", sub: "You see the split, not just the answer." },
  // Beside the bull, not across it (Gate A2, d12: the headline sat on the
  // bull), and over before the charge, which runs ~0.782 → 0.805: the bull
  // lunges through the left third the copy would otherwise still be in.
  // Held at full strength for ~320px and gone before the charge (Gate A3 #7).
  { id: "bull", from: 0.736, to: 0.78, pos: "left", fade: 0.008, heading: TAGLINE_LEAD, sub: TAGLINE },
  // Beside the mark the film ends on (M25), and held through the end: it is
  // still up when the hold begins, and dissolves with the stage.
  // In as the mark completes (Gate A4 #5): at 0.9 it arrived after a long
  // stretch of nothing but the mark, and the act read as an empty screen.
  { id: "welcome", from: 0.85, to: 1.04, pos: "left", heading: "Welcome in." },
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


// THE HOLD IS THE HAND-OFF (Gate A3 #3). The stage used to dissolve over the
// last 2.5% of the FILM, which was over before the hold began, and the film
// collapsed the moment the hold started, with the landing still 80vh below
// the fold: the collapse kept that offset, so the page showed frame zero
// again, the film appearing to rewind. Now the film plays to its last frame
// at the start of the hold (rain still falling), and the stage dissolves over
// the hold itself, in scroll, while the landing's first section rises under
// it through the section's -100vh overlap. ScrollCinema collapses only once
// the hold is scrolled through and the scroll has come to rest, with the
// landing already at the top of the screen.
const HANDOFF_FADE = { from: 0.08, to: 0.92 };

/** The stage's opacity across the hold, `hold` 0 → 1 (holdOf in
 *  cinema-metrics.ts): a breath at full strength, a smoothstep dissolve, and
 *  a moment of nothing but the landing before the collapse. */
export function handoffOpacity(hold: number): number {
  const { from, to } = HANDOFF_FADE;
  const h = clamp01(hold);
  if (h <= from) return 1;
  if (h >= to) return 0;
  return 1 - ss01((h - from) / (to - from));
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
/**
 * Where "Then the floor goes." comes up and the colour script leaves the
 * climb's room: a beat BEFORE the crash, a deliberate pre-lap. It is not the
 * first red print. That is CANDLE_CRASH_AT (≈0.404, lib/candle-series.ts),
 * taken from the candle series, and the rail's crash row, the sound's hit
 * and the camera's trauma all key to it (Gate A4 #3).
 */
export const CANDLE_CRASH_FROM = 0.385;

/**
 * How far the frame is IN the safety act, 0..1, on the scene's own envelope
 * (scene.html: actEnv(t, safety, 0.02, 0.008)). The stage's lens vignette lifts
 * by this much so the act's loss figure, low in the corner, keeps its full
 * token red; the scene lifts its own vignette on the same curve.
 */
export function safetyLight(progress: number): number {
  const { from, to } = ACTS.safety;
  const p = clamp01(progress);
  const fadeIn = clamp01((p - (from - 0.02)) / 0.04);
  const fadeOut = clamp01((p - (to - 0.008)) / 0.016);
  return fadeIn * (1 - fadeOut);
}
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
// The bull's VISIBILITY, apart from its clock. BULL3D above is the timeline
// the bull's camera, dolly and charge run on, and it still starts at 0.71 so
// the charge completes at out0 at full opacity. Showing it from 0.71 put it
// over the vote, which then never had the screen to itself (Gate A2, d11: the
// vote is 0.04 wide and had 0.044 of crossfades). It now appears once the vote
// has cleared; the layer still mounts and warms from in0 - 0.04, out of sight.
export const BULL3D_SHOW: Fade4 = { in0: 0.733, in1: 0.75, out0: BULL3D.out0, out1: BULL3D.out1 };

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
  // The fog moves out with the pull-back, which now ends ~32 units off the
  // chart (Gate A4 #3): at 15/48 it greyed the whole revealed crash by half.
  { at: 0.47, g: { bloomIntensity: 1.25, bloomThreshold: 0.28, caOffset: 0.0016, fogNear: 22, fogFar: 58 } },
  { at: 0.5, g: { bloomIntensity: 1.15, bloomThreshold: 0.3, caOffset: 0.0012, fogNear: 30, fogFar: 68 } },
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

/**
 * ONE WORLD, ONE GRADE (Phase 4, M27). The colour grade a 3D layer's frame
 * gets, after tone mapping (components/scrollstory/Grade.tsx reads it off the
 * cinema clock). Rooms, keyed like GRADE_ROOMS above and eased between, as
 * they are SET (the split tones are set too weakly to see; Grade.tsx says by
 * how much):
 *
 *   COLD GLASS  the dive: saturation down, the darks lifted (the toe) so the
 *               corridor never crushes under the headline (the panel's d04)
 *   NEUTRAL     regime and the climb: nothing to say yet
 *   HOT         the crash: saturation and exposure up
 *   CLINICAL    the lab: saturation down
 *   CLEAN       the worst case and the vote: ungraded
 *   WARM        the bull: exposure and saturation up a little
 *   COOL        after the bull; no 3D layer is on screen there, so unseen
 *
 * Only the 3D layers are graded: the 2D scene's acts (regime, the worst
 * case, the vote, the mark) are drawn as they are. The semantic colours (loss
 * red, gain mint) are exempt: the shader keeps pixels near either token out
 * of the grade, so the 3D's red and mint stay the UI's red and mint whatever
 * room the act is in. The exposure dip at a seam shows only where a 3D layer
 * is on screen.
 */
export type ColorGrade = {
  exposure: number;
  saturation: number;
  /** Split tone, as sRGB tints (0.5 is no shift) and its strength. */
  shadow: [number, number, number];
  high: [number, number, number];
  split: number;
  /** The darks' gamma lift, 0..~0.3. */
  toe: number;
  /** Animated grain amplitude in the midtones (0.02 = 2%). */
  grain: number;
};

const NEUTRAL: ColorGrade = { exposure: 1, saturation: 1, shadow: [0.5, 0.5, 0.55], high: [0.5, 0.5, 0.5], split: 0.06, toe: 0.12, grain: 0.02 };
const COLD: ColorGrade = { exposure: 1, saturation: 0.9, shadow: [0.38, 0.5, 0.68], high: [0.46, 0.52, 0.6], split: 0.5, toe: 0.3, grain: 0.022 };
const HOT: ColorGrade = { exposure: 1.06, saturation: 1.15, shadow: [0.62, 0.42, 0.52], high: [0.62, 0.52, 0.42], split: 0.45, toe: 0.08, grain: 0.03 };
const CLINICAL: ColorGrade = { exposure: 0.98, saturation: 0.72, shadow: [0.44, 0.5, 0.58], high: [0.48, 0.5, 0.54], split: 0.35, toe: 0.1, grain: 0.015 };
const CLEAN: ColorGrade = { exposure: 1, saturation: 1, shadow: [0.5, 0.5, 0.5], high: [0.5, 0.5, 0.5], split: 0, toe: 0.08, grain: 0.015 };
const WARM: ColorGrade = { exposure: 1.04, saturation: 1.05, shadow: [0.52, 0.44, 0.64], high: [0.62, 0.54, 0.44], split: 0.42, toe: 0.06, grain: 0.024 };
const COOL: ColorGrade = { exposure: 1, saturation: 0.95, shadow: [0.46, 0.48, 0.62], high: [0.5, 0.52, 0.56], split: 0.3, toe: 0.1, grain: 0.02 };

const COLOR_ROOMS: { at: number; g: ColorGrade }[] = [
  { at: 0.17, g: COLD },
  { at: 0.245, g: COLD },
  { at: 0.27, g: NEUTRAL },
  { at: CANDLE_CRASH_FROM, g: NEUTRAL },
  { at: 0.42, g: HOT },
  { at: 0.49, g: HOT },
  { at: 0.53, g: CLINICAL },
  { at: 0.585, g: CLINICAL },
  { at: 0.61, g: CLEAN },
  { at: 0.725, g: CLEAN },
  { at: 0.75, g: WARM },
  { at: 0.82, g: WARM },
  { at: 0.86, g: COOL },
];

/** Where one act gives way to the next: the grade dips exposure here, which
 *  shows only where a 3D layer is on screen (most seams fall on the 2D scene). */
const ACT_SEAMS = [ACTS.dive.to, ACTS.regime.to, ACTS.candle.to, ACTS.safety.to, ACTS.consensus.to, ACTS.bull.to];
const DIP_DEPTH = 0.35;
const DIP_WIDTH = 0.006;

/** How far exposure dips at `progress` (0 = none), from the nearest act seam. */
export function seamDip(progress: number): number {
  const p = clamp01(progress);
  let d = 0;
  for (const s of ACT_SEAMS) d = Math.max(d, Math.exp(-(((p - s) / DIP_WIDTH) ** 2)));
  return DIP_DEPTH * d;
}

/** The colour grade at a scroll position: eased between the rooms, with the seam dips. */
export function colorGrade(progress: number): ColorGrade {
  const p = clamp01(progress);
  const rooms = COLOR_ROOMS;
  let a = rooms[0], b = rooms[0], t = 0;
  if (p >= rooms[rooms.length - 1].at) a = b = rooms[rooms.length - 1];
  else if (p > rooms[0].at) {
    let i = 0;
    while (i < rooms.length - 2 && p > rooms[i + 1].at) i++;
    a = rooms[i];
    b = rooms[i + 1];
    t = ss01((p - a.at) / Math.max(1e-6, b.at - a.at));
  }
  const m = (x: number, y: number) => x + (y - x) * t;
  const m3 = (x: [number, number, number], y: [number, number, number]): [number, number, number] => [m(x[0], y[0]), m(x[1], y[1]), m(x[2], y[2])];
  return {
    exposure: m(a.g.exposure, b.g.exposure) * (1 - seamDip(p)),
    saturation: m(a.g.saturation, b.g.saturation),
    shadow: m3(a.g.shadow, b.g.shadow),
    high: m3(a.g.high, b.g.high),
    split: m(a.g.split, b.g.split),
    toe: m(a.g.toe, b.g.toe),
    grain: m(a.g.grain, b.g.grain),
  };
}

/**
 * Opacity for the 3D dive-tunnel DOM layer.
 *
 * Fully opaque BEFORE the film starts. DIVE3D's in-ramp (0.148 → 0.165) was
 * written for a dive that opened on the laptop and faded the corridor over
 * it; since frame zero, 0.15 is the frame the hero curtain lifts off, so that
 * ramp revealed a double exposure of the retired laptop under the tunnel
 * (re-tribunal regression 5, d03). The flight itself still runs on DIVE3D.
 */
export const dive3dOpacity = (progress: number) =>
  windowOpacity(progress, { ...DIVE3D, in0: ACTS.dive.from - 0.02, in1: ACTS.dive.from });
/** Opacity for the 3D candle-canyon DOM layer. */
export const candle3dOpacity = (progress: number) => windowOpacity(progress, CANDLE3D);
/** Opacity for the 3D bull DOM layer. */
export const bull3dOpacity = (progress: number) => windowOpacity(progress, BULL3D_SHOW);

// THE SCORE — the arithmetic of the film's sound, apart from its wiring.
//
// lib/cinema-audio.ts builds the WebAudio graph and drives it every frame.
// This file holds the parts of the score that are only numbers: where the two
// hits land, how the bed breathes in before them, which note the visitor's
// floor is, and the two pieces of signal that are generated rather than
// fetched (the room's impulse response and the saturation curve). No DOM and
// no AudioContext in here, so everything below runs, and can be checked, in
// plain Node.
//
// Gate A3 #10 scored the sound 3.5/10. Its notes, in order, were: the voices
// sat in no space at all, the low end did not exist on a laptop, the hits
// landed into a full bed so nothing hit, the crash was one click, and the act
// that names the reader's own risk had no sound of its own. Each answer is
// marked below where it lives.

import { ACTS, CHARGE_AT as CHARGE_LANDS } from "./cinema";
import { CANDLE_CRASH_AT } from "./candle-series";
import { START_STRIKES } from "./hero-spread";

/** The same smoothstep the picture uses, so envelopes have the film's shape. */
export const smooth = (a: number, b: number, x: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// ─── THE HITS ────────────────────────────────────────────────────────────────
//
// Both are taken from the numbers the picture already uses rather than typed
// in again, so a retimed act retimes its own sound.
//
//   THE CRASH. CANDLE_CRASH_AT, the first red print, taken from the candle
//   series itself (lib/candle-series.ts): the frame the rail turns from "the
//   climb" to "the crash" and the camera takes its first hit. It was keyed
//   to the copy's 0.385, so the sound led the picture (Gate A4 #3). "Then
//   the floor goes." still comes up at 0.385, a deliberate pre-lap.
//   THE CHARGE. Bull3D's charge completes and ImpactFlash peaks at bt 0.826.
export const CRASH_AT = CANDLE_CRASH_AT; // ≈0.404
export const CHARGE_AT = CHARGE_LANDS;

export type HitKind = "crash" | "charge";

/**
 * THE PRE-LAP (A3 #10.3). A hit that lands into a full bed is only louder; a
 * hit that lands into a breath is an event. So the bed starts to go a beat
 * BEFORE each hit and is at its lowest as the hit arrives.
 *
 *   lead   how far ahead the breath starts, in progress. A beat at an ordinary
 *          scroll: 0.02 of a ~13,500px film is ~270px, about a third of a
 *          second of trackpad. The charge's is shorter because the charge
 *          itself is short (~0.782 → 0.805): a long breath would empty the
 *          approach the sub is building.
 *   depth  how far it goes. Never to zero: silence before the crash would read
 *          as the sound breaking, not holding its breath.
 *
 * The recovery after the hit is NOT here. It runs on the hit's own clock (the
 * sidechain in cinema-audio.ts), because a reader who stops scrolling the
 * instant the crash lands should still hear the room come back; a progress
 * curve would leave them parked in the dip forever.
 */
export const HITS: { kind: HitKind; at: number; lead: number; depth: number }[] = [
  { kind: "crash", at: CRASH_AT, lead: 0.022, depth: 0.72 },
  { kind: "charge", at: CHARGE_AT, lead: 0.016, depth: 0.6 },
];

/**
 * The bed's level from the pre-lap alone, 0..1, as a pure function of
 * progress: so scrubbing backwards through a hit gives a short dip and no hit,
 * and parking anywhere gives the same level every time. Back to 1 within a
 * sliver past the hit, where the sidechain takes the bed over.
 */
export function preLap(p: number): number {
  let g = 1;
  for (const h of HITS) {
    const breath = smooth(h.at - h.lead, h.at - 0.003, p) * (1 - smooth(h.at, h.at + 0.002, p));
    g *= 1 - h.depth * breath;
  }
  return g;
}

// ─── THE FLOOR ───────────────────────────────────────────────────────────────
//
// THE MAX LOSS AS A NOTE (A3 #10.5). The safety act says "your worst case is a
// number you chose" over the visitor's own spread (lib/hero-position.ts). The
// note under it is pitched from that spread's long strike, K1, because K1 is
// where the floor IS: anywhere at or below it, the spread is worth nothing and
// the loss is the most it can be. Lower floor, lower note.
//
// One semitone per strike, with the example's K1 (100) on A1, the note the
// pad has been rooted on since the dive: the default visitor hears the film's
// home note return as their floor. Strikes are whole numbers (placeStrike
// rounds them), so every floor is a real pitch, never between two.
//
// The handles reach K1 = 80, twenty semitones down, which is 17Hz: felt on
// headphones at best, nothing on a laptop, and no use to a speaker cone.
// Below D1 the note folds up an octave and keeps its pitch class, the way a
// bass line drops back into its register rather than leaving the instrument.
// The fold sits at K1 = 92, so 93 → 112, every spread a reader is likely to
// set, is one unbroken rising line.
//
// The pitch class is never "wrong" against the rest of the act, because the
// safety chord is built ON this note (cinema-audio.ts, ACT 6-7).

/** A1. The pad's root, and the example's floor. */
export const FLOOR_HOME_HZ = 55;
/** D1. Below this the floor folds up an octave. */
export const FLOOR_LOW_HZ = 36.708;

export function floorHz(k1: number | null | undefined): number {
  const k = typeof k1 === "number" && Number.isFinite(k1) ? Math.round(k1) : START_STRIKES.k1;
  let hz = FLOOR_HOME_HZ * 2 ** ((k - START_STRIKES.k1) / 12);
  // A small tolerance so D1 itself (93) is not pushed up by rounding error.
  while (hz < FLOOR_LOW_HZ - 0.01) hz *= 2;
  while (hz >= FLOOR_LOW_HZ * 4) hz /= 2;
  return hz;
}

/**
 * The floor's envelope: in with the safety act, gone by its end. It opens a
 * hair before ACTS.safety.from so the note is already sounding when the line
 * resolves, and closes on the act boundary, not after it: the vote has a sound
 * of its own and should not inherit this one.
 */
export function floorLevel(p: number): number {
  const { from, to } = ACTS.safety;
  return smooth(from - 0.005, from + 0.025, p) * (1 - smooth(to - 0.024, to, p));
}

// ─── THE ROOM ────────────────────────────────────────────────────────────────
//
// ONE SPACE (A3 #10.1). Every voice used to go straight to the output, so the
// score was eight sounds in eight vacuums. A ConvolverNode with this impulse
// response is one shared room the whole score sends into. It is generated
// here, once, at SOUND ON, from seeded noise: the same room on every visit,
// and still no file.
//
// The shape is what a real hall does, simplified:
//   · ~11ms of pre-delay, so the dry sound arrives first and stays legible;
//   · a handful of early reflections, placed differently for each ear, which
//     is most of what makes a room sound wide;
//   · a diffuse tail that builds over the first ~45ms instead of starting as
//     a wall, decays 60dB over ROOM_RT60, and darkens as it goes (a one-pole
//     lowpass swept from ROOM_BRIGHT to ROOM_DARK), because air and walls eat
//     high frequencies first;
//   · a short fade at the end, so the truncation is not a click.

export const ROOM_SECONDS = 2.6;
export const ROOM_RT60 = 2.3;
const ROOM_BRIGHT = 6500;
const ROOM_DARK = 520;

/** mulberry32: a tiny seeded PRNG, the same one CandleField3D uses. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Two channels (left, right) of impulse response at `sampleRate`. */
export function roomImpulse(sampleRate: number, seconds = ROOM_SECONDS, seed = 0x1b0b) {
  const len = Math.max(2, Math.round(sampleRate * seconds));
  const pre = Math.round(sampleRate * 0.011);
  const fadeLen = Math.round(sampleRate * 0.12);
  // Amplitude falls by e every `tau` seconds; 60dB is a factor of 1000.
  const decayStep = Math.exp(-1 / ((ROOM_RT60 / Math.log(1000)) * sampleRate));
  const sweep = Math.pow(ROOM_DARK / ROOM_BRIGHT, 1 / Math.max(1, len - pre));
  const channels = [new Float32Array(len), new Float32Array(len)];
  channels.forEach((d, ch) => {
    const rnd = mulberry32(seed + ch * 7919);
    let lp = 0;
    let env = 1;
    let fc = ROOM_BRIGHT;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sampleRate;
      const a = 1 - Math.exp((-2 * Math.PI * fc) / sampleRate);
      lp += a * (rnd() * 2 - 1 - lp);
      const build = t < 0.045 ? t / 0.045 : 1;
      const tail = i > len - fadeLen ? (len - i) / fadeLen : 1;
      d[i] = lp * env * build * tail;
      env *= decayStep;
      fc *= sweep;
    }
    for (let r = 0; r < 7; r++) {
      const at = pre + Math.round(sampleRate * (0.004 + rnd() * 0.07));
      if (at < len) d[at] += (rnd() < 0.5 ? -1 : 1) * (0.32 - r * 0.035);
    }
  });
  return channels;
}

// ─── THE SATURATION ──────────────────────────────────────────────────────────
//
// THE LOW END ON A LAPTOP (A3 #10.2). The pad's root, the bull's sub and the
// floor all sit between 34 and 110Hz, and a laptop speaker reproduces almost
// nothing below ~150Hz: on the machine most readers have, the bottom half of
// the score was silent. A gentle tanh curve on the low voices adds their
// harmonics (110, 165, 220Hz for an A1), which a laptop DOES play, and the ear
// rebuilds the missing fundamental from them. Headphones still get the real
// thing underneath.
//
// Scaled so small signals pass at unity: the curve only bends what is loud,
// and turning a voice down makes it cleaner, not quieter-and-dirtier. The
// small bias makes it slightly asymmetric, which adds the even harmonics
// (the octave) that a symmetric tanh lacks; the octave is the harmonic that
// most clearly says "this note, lower". The DC that asymmetry leaves is taken
// out by a 20Hz highpass on the master. Simulated on a sine at the levels the
// low voices peak at (0.2-0.45, before cinema-audio.ts's drive of 1.5), the
// 2nd harmonic sits 17-19dB under the fundamental and the 3rd 19-31dB:
// present, not fuzz.

export function softClipCurve(knee = 2.5, bias = 0.15, n = 2049) {
  const c = new Float32Array(n);
  const off = Math.tanh(knee * bias);
  const slope = knee * (1 - off * off); // the curve's gradient at 0
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = (Math.tanh(knee * (x + bias)) - off) / slope;
  }
  return c;
}

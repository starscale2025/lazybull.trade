// THE FILM'S SOUND — procedural, opt-in, and zero asset bytes.
//
// The audit's sound designer scored this site 2/10, for the most damning reason
// available: a nine-act cue sheet, a per-frame velocity bus, a sidechain
// envelope and a ▶ control all existed in the codebase, across ~963 lines, and
// not one of them touched `audio`. The film was silent. A live cinematic with no
// sound has a hard ceiling no amount of shader work can lift.
//
// The first answer to that voiced TWO acts — `fog` under the boot, `roar` in the
// dive — and left the other seven silent, including the crash the whole picture
// is built around. A reader who turned sound ON heard something for the first
// quarter and then nothing for the remaining three, which is worse than silence:
// it reads as broken. Everything from `pad` down exists so that a nine-act film
// has nine acts of sound.
//
// FOUR RULES THIS OBEYS
//
// 1. NOTHING IS FETCHED. Every voice is an OscillatorNode or a buffer generated
//    in code when the graph is first built: brown noise for the beds, white
//    noise for the transients, and the room's impulse response. No mp3, no
//    webm, no CDN, no CSP change, and nothing to add to the 4.6MB budget.
// 2. IT IS OFF UNTIL ASKED. The AudioContext is not even constructed until a
//    real click. Browsers require a gesture anyway, but the point is stronger
//    than compliance: an unrequested noise on a finance site is hostile.
// 3. IT RIDES THE FILM'S CLOCK. Gains are scheduled from the same progress the
//    scene draws from, so sound cannot desync from picture — which is the
//    single most common tell of a bolted-on audio layer.
// 4. IT DUCKS TO SILENCE. Past the last beat, under `prefers-reduced-motion`,
//    and whenever the tab is hidden. All three are enforced HERE, because a
//    header that asserts a safety property the file does not implement is worse
//    than no header:
//      · past the last beat — the master envelope in cinemaAudioFrame.
//      · reduced motion — enableCinemaAudio() refuses to build the graph, and a
//        live media-query listener tears it down if the preference is turned on
//        mid-film. This used to be true only by accident: ScrollCinema swaps
//        itself for the static still under reduce, so the ▶ control simply never
//        rendered. Nothing in this file knew about it.
//      · hidden tab — a `visibilitychange` listener. The duck used to live
//        inside cinemaAudioFrame, which runs in requestAnimationFrame, which
//        browsers FREEZE in background tabs. So the one case it existed for was
//        the one case it could never reach: the last gains stayed scheduled and
//        the film kept playing out of a tab the reader had left.
//    The abrupt absence at the very end is deliberate: it is what makes the
//    hand-off to the page feel like waking up.
//
// THE SECOND PASS (Gate A3 #10, which scored the sound 3.5/10). The first pass
// gave every act a voice; this one gives them a mix. Five things changed, and
// the arithmetic for each lives in lib/cinema-score.ts, this file being the
// wiring:
//   1. ONE ROOM. A convolver every voice sends into, so the score shares a space.
//   2. A LOW END A LAPTOP CAN PLAY. Gentle saturation on the low voices.
//   3. A BREATH BEFORE EACH HIT. The bed goes a beat early and comes back after.
//   4. A CRASH THAT IS AN EVENT. Three layers instead of one click, and its
//      sub drop falls onto...
//   5. ...THE FLOOR. The visitor's max loss, as a held note under the safety act.
// And the ending: the code rain is gone from the picture (the last act is
// `mark` now: the bull's particles settle onto the mark and the film says
// "Welcome in."), so its shimmer became the SETTLE.
//
// THE GRAPH
//
//   fog, pad, sub, floor ─► lowIn (drive) ─► tanh 2x ─► makeup ─┐
//   roar, lab, chord, settle ───────────────────────────────────┴► bed ─► preLap ─► sidechain ─┬─► master
//                                                                                              └─► bedSend ─► room
//   hit lows (drop, knocks) ─► hitLow (drive) ─► tanh 2x ─► makeup ─┐
//   hit highs (clicks, bursts) ─────────────────────────────────────┴► hits ─┬─► master
//                                                                            └─► hitSend ─► room
//   room: highpass 150 ─► convolver (generated IR) ─► wet ─► master
//   master (the film's envelope) ─► highpass 20 ─► limiter ─► speakers
//
// Every bed node is built once, at SOUND ON, and only its params move. The
// hits are the exception WebAudio forces: a source node plays once, so each
// hit builds a handful of nodes, and only on a forward crossing.

import { ACTS, COPY_BEATS } from "./cinema";
import {
  HITS,
  floorHz,
  floorLevel,
  preLap,
  roomImpulse,
  smooth,
  softClipCurve,
  FLOOR_HOME_HZ,
  type HitKind,
} from "./cinema-score";
import { getHeroPosition } from "./hero-position";

/** One hit's exits, kept so a re-fire can choke it instead of stacking on it. */
type Shot = { chokes: GainNode[]; srcs: AudioScheduledSourceNode[] };

type Voices = {
  ctx: AudioContext;
  master: GainNode;
  /** The bed's two ducks, in series: progress-driven, then hit-driven. */
  preLap: GainNode;
  sidechain: GainNode;
  /** How much of the bed goes to the room; moves per act. */
  bedSend: GainNode;
  /** Where a hit's low layers go: their own saturation, outside the duck. */
  hitLow: GainNode;
  /** Where a hit's high layers go. */
  hits: GainNode;
  fog: GainNode;
  roar: GainNode;
  roarFilter: BiquadFilterNode;
  /** The held chord under regime + candle. Retuned per frame — see PAD_RATIOS. */
  pad: GainNode;
  padOsc: OscillatorNode[];
  lab: GainNode;
  chord: GainNode;
  /** The chord is built on the visitor's floor, so both lines are retuned. */
  chordRoot: OscillatorNode;
  /** The fifth whose detune collapses to unison across the consensus act. */
  chordFifth: OscillatorNode;
  floor: GainNode;
  floorOsc: OscillatorNode[];
  floorFilter: BiquadFilterNode;
  sub: GainNode;
  subOsc: OscillatorNode;
  settle: GainNode;
  settleOsc: OscillatorNode[];
  settleFilter: BiquadFilterNode;
  brown: AudioBuffer;
  white: AudioBuffer;
  /** The last target each per-frame param was sent. See glide(). */
  sent: Map<AudioParam, number>;
  live: Partial<Record<HitKind, Shot>>;
  firedAt: Partial<Record<HitKind, number>>;
};

let V: Voices | null = null;
let enabled = false;
/** Last master level the film asked for, so the visibility listener can put it
    back without waiting for a frame that may never come. */
let masterOut = 0;
/** Previous frame's progress — the hits below are edge-triggered off it. */
let lastP = -1;
let reduceMql: MediaQueryList | null = null;
let suspendTimer = 0;

// The pad is one chord: root, fifth, octave. Ratios are fixed; only the root
// moves (and it only moves once — see the crash, below).
const PAD_ROOT = FLOOR_HOME_HZ; // A1
const PAD_RATIOS = [1, 1.5, 2];

// THE SETTLE — the ending's chord, on A2. Every chord before it in the score is
// an open fifth (the pad is root-fifth-octave, the safety chord root-fifth):
// the score has withheld the THIRD the way the picture withholds red. It
// arrives here, under "Welcome in.", and it is major. Tuned just (5/4, 3/2)
// rather than tempered, so that once it has settled there is no beating left
// in it at all.
//
// Each partial starts SCATTERED, detuned by its own amount, and is pulled into
// tune across the mark act: the bull's particles settling onto the mark, heard
// as a chord settling onto itself. The consensus act did this with two lines;
// the ending does it slower and with all six. It is exactly in tune by the
// time the welcome line holds at full strength.
const SETTLE = [
  { ratio: 1, level: 0.3, scatter: 34 }, //   A2
  { ratio: 1.5, level: 0.22, scatter: -41 }, // E3
  { ratio: 2, level: 0.16, scatter: 23 }, //   A3
  { ratio: 2.5, level: 0.15, scatter: -29 }, // C#4, the third
  { ratio: 3, level: 0.09, scatter: 47 }, //   E4
  { ratio: 8, level: 0.035, scatter: -56 }, // A5, a glint where the rain was
];
const SETTLE_ROOT = FLOOR_HOME_HZ * 2; // A2: home, whatever the visitor's floor was
const WELCOME = COPY_BEATS.find((b) => b.id === "welcome");
const SETTLED_AT = (WELCOME?.from ?? 0.9) + (WELCOME?.fade ?? 0.02);

// THE HIT RULES. A frame that moves further than MAX_STEP is a cut (a rail
// seek), not a crossing: the picture jumps, and a hit fired at a cut
// lands on a frame that never showed its moment, or fires two at once. And a
// hit re-crossed within REFIRE_S, jiggling the wheel across the line, does not
// fire again on top of itself.
const MAX_STEP = 0.06;
const REFIRE_S = 0.5;

// THE CRASH'S DROP: from two octaves above the floor down onto it, in LAND_S,
// then held for HOLD_S before it lets go.
const LAND_S = 0.8;
const HOLD_S = 1.3;
// Where the bull's sub has climbed to at the charge (34 + 14, see ACT 8): the
// charge's thump lands on it.
const CHARGE_HZ = 48;

// THE MIX'S FIXED POINTS.
const LOW_DRIVE = 1.5; // into the bed's tanh; the low voices peak ~0.2-0.45 before it
const LOW_MAKEUP = 0.85;
const HIT_DRIVE = 1.8; // hits are allowed to lean on the curve harder
const HIT_MAKEUP = 0.8;
const ROOM_WET = 0.5;
const HIT_SEND = 0.55;

/** Two seconds of brown-ish noise, generated once. The bed for fog and roar. */
function makeBrown(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02; // brown-ish: integrated white
    d[i] = last * 3.5;
  }
  return buf;
}

/** One second of white noise: the transients need the top end brown lacks. */
function makeWhite(ctx: AudioContext): AudioBuffer {
  const len = ctx.sampleRate;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function loop(ctx: AudioContext, buf: AudioBuffer, dest: AudioNode) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(dest);
  src.start();
  return src;
}

/** One running oscillator at a fixed level. `level` folds in its own gain node
    so a voice can be a chord without a gain node per line at the call site. */
function osc(
  ctx: AudioContext,
  type: OscillatorType,
  hz: number,
  dest: AudioNode,
  level = 1
): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  if (level === 1) {
    o.connect(dest);
  } else {
    const g = ctx.createGain();
    g.gain.value = level;
    o.connect(g).connect(dest);
  }
  o.start();
  return o;
}

function gain(ctx: AudioContext, value: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

function filter(ctx: AudioContext, type: BiquadFilterType, hz: number, q?: number) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  if (q !== undefined) f.Q.value = q;
  return f;
}

function shaper(ctx: AudioContext, curve: ReturnType<typeof softClipCurve>) {
  const s = ctx.createWaveShaper();
  s.curve = curve;
  // The curve makes harmonics; at 2x they are made above the audible band's
  // ceiling and filtered, instead of folding back down as aliasing hash.
  s.oversample = "2x";
  return s;
}

/**
 * setTargetAtTime, but only when the target has moved. The frame pass touches
 * ~30 params; re-sending each one's unchanged target sixty times a second
 * schedules nothing audible and only grows the audio thread's automation
 * timelines. A parked reader now costs the audio thread nothing at all.
 * The master is deliberately NOT routed through here: the visibility and
 * SOUND OFF paths write it too, and a cache would hide their writes.
 */
function glide(v: Voices, param: AudioParam, value: number, t: number, tc: number) {
  const prev = v.sent.get(param);
  if (prev !== undefined && Math.abs(prev - value) <= 1e-4 * Math.max(1, Math.abs(value))) return;
  v.sent.set(param, value);
  param.setTargetAtTime(value, t, tc);
}

/** Duck to 0 and stop the clock when the tab goes away. See rule 4. */
function onVisibility() {
  const v = V;
  if (!v) return;
  window.clearTimeout(suspendTimer);
  if (document.hidden) {
    // Fade first, suspend after: cutting a running graph to zero in one sample
    // is an audible click on the way out of the tab.
    v.master.gain.setTargetAtTime(0, v.ctx.currentTime, 0.05);
    suspendTimer = window.setTimeout(() => {
      if (V === v) void v.ctx.suspend().catch(() => {});
    }, 260);
  } else {
    void v.ctx.resume().catch(() => {});
    v.master.gain.setTargetAtTime(enabled ? masterOut : 0, v.ctx.currentTime, 0.12);
  }
}

/** The preference wins the moment it is set, not at the next reload. */
function onReduceMotion() {
  if (reduceMql?.matches) stopCinemaAudio();
}

/** Build the graph. Called once, from a user gesture. */
export function enableCinemaAudio(): boolean {
  try {
    // Rule 4, first clause. Checked before the early return so a graph can
    // never outlive the preference being turned on.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  } catch {
    /* no matchMedia — fall through; the rest of the guard rails still apply */
  }
  if (V) {
    enabled = true;
    lastP = -1;
    void V.ctx.resume().catch(() => {});
    return true;
  }
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    const ctx = new Ctor();
    const master = gain(ctx, 0);
    // Seven voices can now overlap where two used to. A limiter on the way out
    // means adding an act to the score can never clip the ones already there.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    // The saturation below is slightly asymmetric on purpose (it is what adds
    // the octave), which leaves a little DC wherever a low voice is loud. A
    // 20Hz highpass takes it out, and with it any subsonic a drop might push a
    // speaker cone towards. At 34Hz, the score's lowest note, it costs <1dB.
    master.connect(filter(ctx, "highpass", 20, 0.707)).connect(limiter).connect(ctx.destination);

    const brown = makeBrown(ctx);
    const white = makeWhite(ctx);
    const curve = softClipCurve();

    // THE ROOM (A3 #10.1). One convolver, one generated impulse response
    // (cinema-score.ts, roomImpulse), and every voice reaches it through a send
    // rather than an insert, so the dry sound stays as present as it was and the
    // room is something the whole score is IN. The send is highpassed: a room
    // full of 40Hz is mud, and the low voices are better kept tight and dry.
    const roomIn = ctx.createGain();
    const room = ctx.createConvolver();
    room.normalize = true; // before the buffer: it is read when the buffer is set
    const ir = roomImpulse(ctx.sampleRate);
    const irBuf = ctx.createBuffer(2, ir[0].length, ctx.sampleRate);
    irBuf.getChannelData(0).set(ir[0]);
    irBuf.getChannelData(1).set(ir[1]);
    room.buffer = irBuf;
    roomIn.connect(filter(ctx, "highpass", 150, 0.6)).connect(room).connect(gain(ctx, ROOM_WET)).connect(master);

    // THE BED and its two ducks (A3 #10.3). `preLap` follows progress: it
    // takes the bed down over the beat before each hit (cinema-score.ts,
    // preLap). `sidechain` follows the hit: it is pulled down when one fires
    // and recovers on the hit's own clock. The send is taken AFTER both, so
    // the room breathes with the bed while the tail already in it rings on.
    const bed = ctx.createGain();
    const preLapG = gain(ctx, 1);
    const sidechain = gain(ctx, 1);
    const bedSend = gain(ctx, 0.24);
    bed.connect(preLapG).connect(sidechain).connect(master);
    sidechain.connect(bedSend).connect(roomIn);

    // THE LOW VOICES' SATURATION (A3 #10.2). Fog, pad, sub and floor sum here
    // and pass through one gentle tanh (cinema-score.ts, softClipCurve), which
    // gives a laptop speaker the harmonics it can play in place of the
    // 34-110Hz fundamentals it cannot.
    const lowIn = gain(ctx, LOW_DRIVE);
    lowIn.connect(shaper(ctx, curve)).connect(gain(ctx, LOW_MAKEUP)).connect(bed);

    // THE HITS' BUS. Outside the bed, so the ducks never touch a hit, with its
    // own saturation for the drops and knocks and a fixed, generous send: a hit
    // is the one sound that should always tell you the size of the room.
    const hits = ctx.createGain();
    hits.connect(master);
    hits.connect(gain(ctx, HIT_SEND)).connect(roomIn);
    const hitLow = gain(ctx, HIT_DRIVE);
    hitLow.connect(shaper(ctx, curve)).connect(gain(ctx, HIT_MAKEUP)).connect(hits);

    // ACT 1-2 · BOOT + ASSEMBLY — FOG, a low drone under the opening.
    const fog = gain(ctx, 0);
    const fogFilter = filter(ctx, "lowpass", 90);
    loop(ctx, brown, fogFilter);
    fogFilter.connect(fog).connect(lowIn);

    // ACT 3 · DIVE — ROAR, the corridor. Bandpass whose gain reads scroll
    // VELOCITY, so the corridor roars in proportion to how hard you are
    // scrolling. The clock already computes and damps that number; nothing new
    // is measured.
    const roar = gain(ctx, 0);
    const roarFilter = filter(ctx, "bandpass", 320, 0.8);
    loop(ctx, brown, roarFilter);
    roarFilter.connect(roar).connect(bed);

    // ACT 4-5 · REGIME + CANDLE — PAD, one held chord under the whole middle of
    // the film. Lowpassed hard so it is felt as a floor rather than heard as a
    // melody; the acts above it have to stay legible.
    const pad = gain(ctx, 0);
    const padFilter = filter(ctx, "lowpass", 460);
    const padOsc = [
      osc(ctx, "sine", PAD_ROOT * PAD_RATIOS[0], padFilter, 0.6),
      osc(ctx, "sine", PAD_ROOT * PAD_RATIOS[1], padFilter, 0.34),
      osc(ctx, "triangle", PAD_ROOT * PAD_RATIOS[2], padFilter, 0.16),
    ];
    padFilter.connect(pad).connect(lowIn);

    // ACT 5b · THE LAB — high, thin, and nearly still. The picture's note for
    // this beat is "the scene stops being weather and becomes an instrument
    // being read"; a single vibratoed sine is what an instrument sounds like.
    const lab = gain(ctx, 0);
    const labOsc = osc(ctx, "sine", 1174, lab, 1);
    const vib = ctx.createOscillator();
    vib.type = "sine";
    vib.frequency.value = 5.2;
    vib.connect(gain(ctx, 7)).connect(labOsc.frequency); // ±7Hz — a breath, not a siren
    vib.start();
    lab.connect(bed);

    // ACT 6 · SAFETY — THE FLOOR (A3 #10.5). The visitor's max loss, held. A
    // sine for the weight and a lowpassed saw for the grain, so that before
    // the saturation has done anything it already has the 2nd and 3rd
    // harmonics a laptop needs to place it. No vibrato and no tremolo: the
    // point of this note is that it does not move.
    const floor = gain(ctx, 0);
    const floorFilter = filter(ctx, "lowpass", FLOOR_HOME_HZ * 3.5, 0.5);
    const floorOsc = [
      osc(ctx, "sine", FLOOR_HOME_HZ, floorFilter, 0.6),
      osc(ctx, "sawtooth", FLOOR_HOME_HZ, floorFilter, 0.24),
    ];
    floorFilter.connect(floor).connect(lowIn);

    // ACT 6-7 · SAFETY + CONSENSUS — two lines a fifth apart, starting out of
    // tune. The vote is the act where the bots' split resolves into one
    // answer, so the detune collapses to unison exactly across it: the
    // disagreement is audible as beating, and the answer as the beating
    // stopping.
    const chord = gain(ctx, 0);
    const chordRoot = osc(ctx, "sine", FLOOR_HOME_HZ * 2, chord, 0.5);
    const chordFifth = osc(ctx, "sine", FLOOR_HOME_HZ * 3, chord, 0.42);
    chord.connect(bed);

    // ACT 8 · THE BULL — sub-bass that arrives with the animal and rises with
    // the charge. Nothing else in the score is down here, so the approach has
    // the bottom of the room to itself.
    const sub = gain(ctx, 0);
    const subOsc = osc(ctx, "sine", 34, sub, 1);
    sub.connect(lowIn);

    // ACT 9 · MARK — THE SETTLE (see SETTLE above). It replaces the code rain's
    // high C/G shimmer, which was a sound for a picture that no longer exists.
    // Darker while scattered, opening as it lands, and the room is at its
    // wettest under it (THE ROOM'S SIZE, below): the film ends in the room,
    // not on the speaker.
    const settle = gain(ctx, 0);
    const settleFilter = filter(ctx, "lowpass", 800, 0.5);
    const settleOsc = SETTLE.map((s) => osc(ctx, "sine", SETTLE_ROOT * s.ratio, settleFilter, s.level));
    settleFilter.connect(settle).connect(bed);

    V = {
      ctx,
      master,
      preLap: preLapG,
      sidechain,
      bedSend,
      hitLow,
      hits,
      fog,
      roar,
      roarFilter,
      pad,
      padOsc,
      lab,
      chord,
      chordRoot,
      chordFifth,
      floor,
      floorOsc,
      floorFilter,
      sub,
      subOsc,
      settle,
      settleOsc,
      settleFilter,
      brown,
      white,
      sent: new Map(),
      live: {},
      firedAt: {},
    };
    enabled = true;
    lastP = -1;
    masterOut = 0;
    // Safari hands back a suspended context even from a gesture.
    void ctx.resume().catch(() => {});
    document.addEventListener("visibilitychange", onVisibility);
    try {
      reduceMql = window.matchMedia("(prefers-reduced-motion: reduce)");
      reduceMql.addEventListener("change", onReduceMotion);
    } catch {
      reduceMql = null;
    }
    return true;
  } catch {
    return false; // no audio available — the film is simply silent, as before
  }
}

/** SOUND OFF. Ducks and keeps the graph, so SOUND ON is instant again. */
export function disableCinemaAudio() {
  enabled = false;
  if (V) V.master.gain.setTargetAtTime(0, V.ctx.currentTime, 0.08);
}

/**
 * Give the context back. Distinct from disableCinemaAudio because that one is a
 * toggle and this one is a teardown: an AudioContext is a real audio-thread
 * resource, browsers cap how many a document may hold, and nothing was ever
 * closing this one. ScrollCinema calls it when the film collapses and again on
 * unmount; both are safe, and so is calling it twice.
 */
export function stopCinemaAudio() {
  const v = V;
  V = null;
  enabled = false;
  lastP = -1;
  masterOut = 0;
  window.clearTimeout(suspendTimer);
  document.removeEventListener("visibilitychange", onVisibility);
  if (reduceMql) {
    reduceMql.removeEventListener("change", onReduceMotion);
    reduceMql = null;
  }
  if (!v) return;
  try {
    v.master.gain.cancelScheduledValues(v.ctx.currentTime);
    v.master.gain.setTargetAtTime(0, v.ctx.currentTime, 0.06);
  } catch {
    /* already closed */
  }
  // Close AFTER the fade — closing a context mid-note is an audible cut.
  window.setTimeout(() => {
    void v.ctx.close().catch(() => {});
  }, 260);
}

export function cinemaAudioEnabled() {
  return enabled;
}

// ─── THE HITS ────────────────────────────────────────────────────────────────

/**
 * Pull the bed down under a hit and let it back on the hit's own clock: to
 * `to` in 12ms, held for `hold`, then home over about a second. This is the
 * "recovers after" half of the pre-lap, and it is time, not progress, so a
 * reader who stops dead on the hit still hears the room return.
 */
function duckUnder(v: Voices, to: number, hold: number) {
  const g = v.sidechain.gain;
  const t = v.ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(Math.max(0.05, to), t + 0.012);
  g.setTargetAtTime(1, t + hold, 0.32);
}

/** A hit's two exits, each through a gain touched only to choke it, so a
    choke never fights the envelopes of the layers behind it. */
function shotOut(v: Voices) {
  const lo = v.ctx.createGain();
  const hi = v.ctx.createGain();
  lo.connect(v.hitLow);
  hi.connect(v.hits);
  const shot: Shot = { chokes: [lo, hi], srcs: [] };
  return { lo, hi, shot };
}

/** Fade a still-sounding hit out in ~40ms and stop its sources. */
function choke(v: Voices, s: Shot | undefined) {
  if (!s) return;
  const t = v.ctx.currentTime;
  for (const g of s.chokes) g.gain.setTargetAtTime(0, t, 0.012);
  for (const src of s.srcs) {
    try {
      src.stop(t + 0.09);
    } catch {
      /* already stopped */
    }
  }
}

/** Disconnect a hit's exits once its longest source has finished. */
function release(s: Shot, last: AudioScheduledSourceNode) {
  last.onended = () => s.chokes.forEach((g) => g.disconnect());
}

/** Up to `peak` in `attack`, then an exponential fall to silence over `decay`. */
function perc(v: Voices, t: number, peak: number, attack: number, decay: number) {
  const g = v.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

/** A slice of a noise buffer from a random point, so no two hits are the
    same sample-for-sample. */
function noise(v: Voices, buf: AudioBuffer, t: number, dur: number, s: Shot) {
  const src = v.ctx.createBufferSource();
  src.buffer = buf;
  src.start(t, Math.random() * Math.max(0, buf.duration - dur - 0.01));
  src.stop(t + dur);
  s.srcs.push(src);
  return src;
}

/** A sine whose pitch falls exponentially (evenly in semitones) from `from`
    to `to` over `fall` seconds and then holds. */
function fallingSine(v: Voices, t: number, from: number, to: number, fall: number, end: number, s: Shot) {
  const o = v.ctx.createOscillator();
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + fall);
  o.start(t);
  o.stop(end);
  s.srcs.push(o);
  return o;
}

/**
 * THE CRASH (A3 #10.4) — three layers where there was one click.
 *
 *   1. THE TRANSIENT. A 30ms click of highpassed white noise for the edge,
 *      and under it a knock (a sine falling 180 → 48Hz in 70ms) for the
 *      punch. This is the layer the ear times the hit from.
 *   2. THE BURST. Half a second of noise behind a lowpass that falls with it,
 *      5.2kHz → 320Hz: the sound of something large giving way. Most of what
 *      the room is given comes from here.
 *   3. THE DROP. A sine from two octaves above the visitor's floor, falling
 *      evenly onto it in LAND_S, and STOPPING there: it holds the floor's
 *      pitch for HOLD_S, a second, quieter knock marking the moment it lands.
 *      This is the spread's whole idea said in one gesture. The loss falls,
 *      and then it stops, at a level chosen in advance. With the example
 *      spread the pad then keeps going down beneath it (ACT 4-5): the market
 *      falls on, the position does not. A payoff diagram, as two pitches.
 *
 * The same pitch returns, held, when the safety act names it: the reader has
 * already heard their floor once, as the place the crash stopped.
 */
function crashHit(v: Voices, floor: number): Shot {
  const { ctx } = v;
  const t = ctx.currentTime;
  const { lo, hi, shot } = shotOut(v);
  duckUnder(v, 0.28, 0.22);

  // 1 · the transient
  noise(v, v.white, t, 0.06, shot)
    .connect(filter(ctx, "highpass", 2200, 0.7))
    .connect(perc(v, t, 0.6, 0.001, 0.03))
    .connect(hi);
  fallingSine(v, t, 180, 48, 0.07, t + 0.3, shot).connect(perc(v, t, 0.85, 0.002, 0.2)).connect(lo);

  // 2 · the burst
  const burstLp = filter(ctx, "lowpass", 5200, 0.8);
  burstLp.frequency.setValueAtTime(5200, t);
  burstLp.frequency.exponentialRampToValueAtTime(320, t + 0.5);
  noise(v, v.white, t, 0.7, shot).connect(burstLp).connect(perc(v, t, 0.42, 0.006, 0.55)).connect(hi);

  // 3 · the drop, and the floor it stops on
  const end = t + LAND_S + HOLD_S + 2.6;
  const drop = fallingSine(v, t, floor * 4, floor, LAND_S, end, shot);
  const dg = ctx.createGain();
  dg.gain.setValueAtTime(0.0001, t);
  dg.gain.exponentialRampToValueAtTime(0.7, t + 0.04);
  dg.gain.setValueAtTime(0.7, t + LAND_S);
  dg.gain.linearRampToValueAtTime(0.55, t + LAND_S + 0.2);
  dg.gain.setTargetAtTime(0, t + LAND_S + HOLD_S, 0.45);
  drop.connect(dg).connect(lo);
  const land = t + LAND_S;
  fallingSine(v, land, floor * 2, floor, 0.05, land + 0.35, shot)
    .connect(perc(v, land, 0.35, 0.003, 0.25))
    .connect(lo);

  release(shot, drop);
  return shot;
}

/**
 * The generic impact: the bull's charge, and the glass when the reader skips.
 * The old one-click hit, kept as the body, with a white-noise edge on top and
 * a thump under it that lands where the bull's sub has climbed to.
 */
function impact(v: Voices, strength: number): Shot {
  const { ctx } = v;
  const t = ctx.currentTime;
  const s = Math.max(0, Math.min(1.5, strength));
  const { lo, hi, shot } = shotOut(v);
  duckUnder(v, 1 - 0.65 * Math.min(1, s), 0.16);

  noise(v, v.white, t, 0.05, shot)
    .connect(filter(ctx, "highpass", 2600, 0.7))
    .connect(perc(v, t, 0.45 * s, 0.001, 0.022))
    .connect(hi);
  noise(v, v.brown, t, 0.4, shot)
    .connect(filter(ctx, "bandpass", 180 + 120 * s, 1.2))
    .connect(perc(v, t, 0.5 * s, 0.006, 0.03 + 0.12 * s))
    .connect(hi);
  const thump = fallingSine(v, t, CHARGE_HZ * 2, CHARGE_HZ, 0.09, t + 0.6, shot);
  thump.connect(perc(v, t, 0.75 * s, 0.003, 0.34)).connect(lo);

  release(shot, thump);
  return shot;
}

/** Fire a hit unless it just fired; choke the last one of its kind first. */
function fire(v: Voices, kind: HitKind, floor: number) {
  const t = v.ctx.currentTime;
  const last = v.firedAt[kind];
  if (last !== undefined && t - last < REFIRE_S) return;
  v.firedAt[kind] = t;
  choke(v, v.live[kind]);
  v.live[kind] = kind === "crash" ? crashHit(v, floor) : impact(v, 1);
}

/** A hit from outside the film's clock — ScrollCinema's skip, the glass. */
export function cinemaImpact(strength = 1) {
  if (!V || !enabled) return;
  impact(V, strength);
}

/**
 * Called from the film's existing per-frame pass. Pure f(progress) plus the
 * clock's own damped velocity and the visitor's spread. The only state kept is
 * bookkeeping, never music: the previous frame's progress (so the hits can be
 * edge-triggered), when each hit last fired (so they cannot stack), and the
 * last target sent to each param (so a parked reader schedules nothing).
 * Scrubbing backwards sounds like scrubbing backwards.
 */
export function cinemaAudioFrame(progress: number, velocity: number) {
  if (!V || !enabled) return;
  const v = V;
  const t = v.ctx.currentTime;
  const p = progress;
  const set = (param: AudioParam, value: number, tc: number) => glide(v, param, value, t, tc);

  // Master ducks to nothing over the last 2% — the silence IS the ending. The
  // document.hidden term is belt-and-braces for browsers that keep rAF alive in
  // a hidden tab; the listener above is what covers the ones that do not.
  masterOut = 0.5 * (1 - smooth(0.96, 0.995, p));
  v.master.gain.setTargetAtTime(document.hidden ? 0 : masterOut, t, 0.12);

  // ACT 1-2 · fog lives under boot + assembly, then clears.
  set(v.fog.gain, 0.5 * (1 - smooth(0.1, 0.2, p)), 0.2);

  // ACT 3 · the corridor roars with how hard you scroll, only while the dive is up.
  const inDive = smooth(0.14, 0.17, p) * (1 - smooth(0.23, 0.26, p));
  const vel = Math.min(1, Math.abs(velocity) * 26);
  set(v.roar.gain, inDive * vel * 0.42, 0.09);
  set(v.roarFilter.frequency, 240 + vel * 520, 0.12);

  // ACT 3b-5 · the pad. It fades in UNDER the dive rather than at the regime,
  // because roar is velocity-driven: a reader who stops scrolling in the
  // corridor stops the only voice in it, and measured, 0.17→0.22 went silent
  // for anyone who paused to look. The pad is the floor that hole needed.
  //
  // It then holds to the end of the lab and makes the score's one long pitch
  // move: across the crash (0.40→0.50) the root falls a fourth, A1 → E1. It
  // begins just after the crash hit and, with the example spread, sinks on
  // below the A1 the crash's drop stopped on: the market falling on past a
  // loss that has stopped.
  set(v.pad.gain, 0.3 * smooth(0.16, 0.23, p) * (1 - smooth(0.56, 0.62, p)), 0.25);
  const root = PAD_ROOT * (1 - 0.25 * smooth(0.4, 0.5, p));
  for (let i = 0; i < v.padOsc.length; i++) set(v.padOsc[i].frequency, root * PAD_RATIOS[i], 0.3);

  // ACT 5b · the lab, over the same window as CANDLE_LAB.
  const labOn = smooth(0.5, 0.53, p) * (1 - smooth(0.585, 0.61, p));
  set(v.lab.gain, 0.07 * labOn, 0.18);

  // ACT 6 · THE FLOOR. Read every frame, because the visitor can reshape the
  // spread under frame zero before the film reaches this act; the module
  // store is a plain read, no React. The pitch glides fast so a changed
  // spread is simply the new note by the time the act opens.
  const floor = floorHz(getHeroPosition()?.k1);
  set(v.floor.gain, 0.36 * floorLevel(p), 0.15);
  for (const o of v.floorOsc) set(o.frequency, floor, 0.05);
  set(v.floorFilter.frequency, floor * 3.5, 0.05);

  // ACT 6-7 · safety opens the chord out of tune; consensus pulls it to unison
  // and the bull's arrival takes it away. The chord is built ON the floor, an
  // octave and a twelfth above it, so whatever strike the visitor chose, the
  // act's harmony is in their key: no spread can make the floor a wrong note.
  // With the example's K1 that is 110/165Hz, exactly where it always was.
  set(v.chord.gain, 0.24 * smooth(0.585, 0.63, p) * (1 - smooth(0.745, 0.79, p)), 0.22);
  set(v.chordRoot.frequency, floor * 2, 0.08);
  set(v.chordFifth.frequency, floor * 3, 0.08);
  set(v.chordFifth.detune, 42 * (1 - smooth(0.665, 0.725, p)), 0.25);

  // ACT 8 · the bull approaches, then charges. Both gain and pitch ride the
  // same curve Bull3D's mesh does, and both clear out of the impact flash.
  const charge = smooth(0.755, 0.805, p);
  set(v.sub.gain, 0.34 * smooth(0.73, 0.78, p) * (0.4 + 0.6 * charge) * (1 - smooth(0.806, 0.84, p)), 0.1);
  set(v.subOsc.frequency, 34 + 14 * charge, 0.15);

  // ACT 9 · the settle. It starts before the mark act does (0.822, not 0.84)
  // so it overlaps the sub's tail — timed to the act boundary there was a
  // measured 0.838-0.846 hole where every voice was off at once. Its own tail
  // overlaps the master duck above, so the film ends on one fade rather than
  // two. The scatter closes from the act's start to the welcome line's.
  set(v.settle.gain, 0.15 * smooth(0.822, 0.875, p) * (1 - smooth(0.95, 0.99, p)), 0.2);
  const scatter = 1 - smooth(ACTS.mark.from, SETTLED_AT, p);
  for (let i = 0; i < v.settleOsc.length; i++) {
    set(v.settleOsc[i].detune, SETTLE[i].scatter * scatter, 0.2);
  }
  set(v.settleFilter.frequency, 800 + 1800 * (1 - scatter), 0.3);

  // THE ROOM'S SIZE, per act. Drier in the corridor, where the roar should be
  // close and fast; wetter in the lab, where one sine in a big space is the
  // whole effect; wettest at the end, where the film dissolves into the room.
  set(v.bedSend.gain, 0.24 - 0.1 * inDive + 0.2 * labOn + 0.36 * smooth(0.83, 0.9, p), 0.3);

  // THE PRE-LAP. The bed's breath before each hit, as a function of where
  // the film is (cinema-score.ts, preLap). The time constant is short because
  // a quick scroll crosses the whole breath in a fraction of a second.
  set(v.preLap.gain, preLap(p), 0.05);

  // THE HITS. Edge-triggered on the film's own clock: crossing a beat forwards
  // fires it, scrubbing back over it fires nothing, and forwards again fires it
  // again — which is exactly what the picture does with the same two
  // detonations. Bounded both ways: a jump bigger than MAX_STEP is a cut and
  // fires nothing, and a re-crossing inside REFIRE_S does not stack.
  const step = p - lastP;
  if (lastP >= 0 && step > 0 && step <= MAX_STEP) {
    for (const h of HITS) {
      if (lastP < h.at && p >= h.at) fire(v, h.kind, floor);
    }
  }
  lastP = p;
}

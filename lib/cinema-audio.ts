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
// 1. NOTHING IS FETCHED. Every voice is an OscillatorNode, or the one noise
//    buffer generated at 2 seconds when the graph is first built. No mp3, no
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

import { BULL3D, CANDLE3D, CANDLE_BUILD_END } from "./cinema";

type Voices = {
  ctx: AudioContext;
  master: GainNode;
  fog: GainNode;
  roar: GainNode;
  roarFilter: BiquadFilterNode;
  /** The held chord under regime + candle. Retuned per frame — see PAD_RATIOS. */
  pad: GainNode;
  padOsc: OscillatorNode[];
  lab: GainNode;
  chord: GainNode;
  /** The fifth whose detune collapses to unison across the consensus act. */
  chordFifth: OscillatorNode;
  sub: GainNode;
  subOsc: OscillatorNode;
  rain: GainNode;
  noise: AudioBuffer;
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

/** The same smoothstep the picture uses, so envelopes have the film's shape. */
const smooth = (a: number, b: number, x: number) => {
  const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

// The pad is one chord: root, fifth, octave. Ratios are fixed; only the root
// moves (and it only moves once — see the crash, below).
const PAD_ROOT = 55; // A1
const PAD_RATIOS = [1, 1.5, 2];

// THE TWO HITS, in the film's own units. Both are derived from the numbers the
// picture already uses rather than typed in again, so a retimed act retimes its
// own sound:
//
//   THE CRASH LANDS. CandleField3D prints candle 26 — DIVERGE, the first red in
//   ~14,000px of scroll — at buildAt 0.4875. This is that instant in progress.
const CRASH_AT = CANDLE3D.in0 + 0.4875 * (CANDLE_BUILD_END - CANDLE3D.in0); // ≈0.408
//   THE BULL LANDS. Bull3D's charge completes and ImpactFlash peaks at bt 0.826.
const CHARGE_AT = BULL3D.in0 + 0.826 * (BULL3D.out1 - BULL3D.in0); // ≈0.805
const HITS: { at: number; strength: number }[] = [
  { at: CRASH_AT, strength: 0.85 },
  { at: CHARGE_AT, strength: 1 },
];

/** Two seconds of brown-ish noise, generated once. The bed for fog and roar. */
function makeNoise(ctx: AudioContext): AudioBuffer {
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
    const master = ctx.createGain();
    master.gain.value = 0;
    // Seven voices can now overlap where two used to. A limiter on the way out
    // means adding an act to the score can never clip the ones already there.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    master.connect(limiter).connect(ctx.destination);

    const noise = makeNoise(ctx);

    // ACT 1-2 · BOOT + ASSEMBLY — FOG, a low drone under the opening.
    const fog = ctx.createGain();
    fog.gain.value = 0;
    const fogFilter = ctx.createBiquadFilter();
    fogFilter.type = "lowpass";
    fogFilter.frequency.value = 90;
    loop(ctx, noise, fogFilter);
    fogFilter.connect(fog).connect(master);

    // ACT 3 · DIVE — ROAR, the corridor. Bandpass whose gain reads scroll
    // VELOCITY, so the corridor roars in proportion to how hard you are
    // scrolling. The clock already computes and damps that number; nothing new
    // is measured.
    const roar = ctx.createGain();
    roar.gain.value = 0;
    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = "bandpass";
    roarFilter.frequency.value = 320;
    roarFilter.Q.value = 0.8;
    loop(ctx, noise, roarFilter);
    roarFilter.connect(roar).connect(master);

    // ACT 4-5 · REGIME + CANDLE — PAD, one held chord under the whole middle of
    // the film. Lowpassed hard so it is felt as a floor rather than heard as a
    // melody; the acts above it have to stay legible.
    const pad = ctx.createGain();
    pad.gain.value = 0;
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 460;
    const padOsc = [
      osc(ctx, "sine", PAD_ROOT * PAD_RATIOS[0], padFilter, 0.6),
      osc(ctx, "sine", PAD_ROOT * PAD_RATIOS[1], padFilter, 0.34),
      osc(ctx, "triangle", PAD_ROOT * PAD_RATIOS[2], padFilter, 0.16),
    ];
    padFilter.connect(pad).connect(master);

    // ACT 5b · THE LAB — high, thin, and nearly still. The picture's note for
    // this beat is "the scene stops being weather and becomes an instrument
    // being read"; a single vibratoed sine is what an instrument sounds like.
    const lab = ctx.createGain();
    lab.gain.value = 0;
    const labOsc = osc(ctx, "sine", 1174, lab, 1);
    const vib = ctx.createOscillator();
    vib.type = "sine";
    vib.frequency.value = 5.2;
    const vibAmt = ctx.createGain();
    vibAmt.gain.value = 7; // ±7Hz — a breath, not a siren
    vib.connect(vibAmt).connect(labOsc.frequency);
    vib.start();
    lab.connect(master);

    // ACT 6-7 · SAFETY + CONSENSUS — two lines a fifth apart, starting out of
    // tune. "12 bots. One verdict." is a sentence about agreement, so the
    // detune collapses to unison exactly across the consensus act: the beat is
    // audible as beating that stops.
    const chord = ctx.createGain();
    chord.gain.value = 0;
    osc(ctx, "sine", 110, chord, 0.5);
    const chordFifth = osc(ctx, "sine", 165, chord, 0.42);
    chord.connect(master);

    // ACT 8 · THE BULL — sub-bass that arrives with the animal and rises with
    // the charge. Nothing else in the score is down here, so the approach has
    // the bottom of the room to itself.
    const sub = ctx.createGain();
    sub.gain.value = 0;
    const subOsc = osc(ctx, "sine", 34, sub, 1);
    sub.connect(master);

    // ACT 9 · MATRIX — the code rain, as a high shimmer rather than noise: the
    // frame is resolving into a page, and pages are digital. A slow tremolo in
    // series (not summed into the envelope) so it modulates the voice without
    // ever lifting it off zero while the act is closed.
    const rain = ctx.createGain();
    rain.gain.value = 0;
    osc(ctx, "sine", 2093, rain, 0.5);
    osc(ctx, "sine", 3136, rain, 0.3);
    const trem = ctx.createGain();
    trem.gain.value = 1;
    const tlfo = ctx.createOscillator();
    tlfo.type = "sine";
    tlfo.frequency.value = 3.4;
    const tlfoAmt = ctx.createGain();
    tlfoAmt.gain.value = 0.45;
    tlfo.connect(tlfoAmt).connect(trem.gain);
    tlfo.start();
    rain.connect(trem).connect(master);

    V = { ctx, master, fog, roar, roarFilter, pad, padOsc, lab, chord, chordFifth, sub, subOsc, rain, noise };
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

/** A short bandpassed click — the crash landing, or the bull's charge. */
export function cinemaImpact(strength = 1) {
  if (!V || !enabled) return;
  const { ctx, master } = V;
  const t = ctx.currentTime;
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 180 + 120 * strength;
  f.Q.value = 1.2;
  const src = ctx.createBufferSource();
  src.buffer = V.noise;
  src.connect(f).connect(g).connect(master);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5 * strength, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + 0.12 * strength);
  src.start(t);
  src.stop(t + 0.4);
}

/**
 * Called from the film's existing per-frame pass. Pure f(progress) plus the
 * clock's own damped velocity — no state of its own beyond the previous frame's
 * progress, which exists only so the two hits can be edge-triggered. Scrubbing
 * backwards sounds like scrubbing backwards.
 */
export function cinemaAudioFrame(progress: number, velocity: number) {
  if (!V || !enabled) return;
  const v = V;
  const t = v.ctx.currentTime;
  const p = progress;

  // Master ducks to nothing over the last 2% — the silence IS the ending. The
  // document.hidden term is belt-and-braces for browsers that keep rAF alive in
  // a hidden tab; the listener above is what covers the ones that do not.
  masterOut = 0.5 * (1 - smooth(0.96, 0.995, p));
  v.master.gain.setTargetAtTime(document.hidden ? 0 : masterOut, t, 0.12);

  // ACT 1-2 · fog lives under boot + assembly, then clears.
  v.fog.gain.setTargetAtTime(0.5 * (1 - smooth(0.1, 0.2, p)), t, 0.2);

  // ACT 3 · the corridor roars with how hard you scroll, only while the dive is up.
  const inDive = smooth(0.14, 0.17, p) * (1 - smooth(0.23, 0.26, p));
  const vel = Math.min(1, Math.abs(velocity) * 26);
  v.roar.gain.setTargetAtTime(inDive * vel * 0.42, t, 0.09);
  v.roarFilter.frequency.setTargetAtTime(240 + vel * 520, t, 0.12);

  // ACT 3b-5 · the pad. It fades in UNDER the dive rather than at the regime,
  // because roar is velocity-driven: a reader who stops scrolling in the
  // corridor stops the only voice in it, and measured, 0.17→0.22 went silent
  // for anyone who paused to look. The pad is the floor that hole needed.
  //
  // It then holds to the end of the lab and makes the score's only pitch move:
  // across the crash (0.40→0.50) the root falls a fourth. The picture withholds
  // its first red for exactly that span; this is the same withholding, on the
  // one parameter a held chord has left.
  v.pad.gain.setTargetAtTime(0.3 * smooth(0.16, 0.23, p) * (1 - smooth(0.56, 0.62, p)), t, 0.25);
  const root = PAD_ROOT * (1 - 0.25 * smooth(0.4, 0.5, p));
  for (let i = 0; i < v.padOsc.length; i++) {
    v.padOsc[i].frequency.setTargetAtTime(root * PAD_RATIOS[i], t, 0.3);
  }

  // ACT 5b · the lab, over the same window as CANDLE_LAB.
  v.lab.gain.setTargetAtTime(0.07 * smooth(0.5, 0.53, p) * (1 - smooth(0.585, 0.61, p)), t, 0.18);

  // ACT 6-7 · safety opens the chord out of tune; consensus pulls it to unison
  // and the bull's arrival takes it away.
  v.chord.gain.setTargetAtTime(0.24 * smooth(0.585, 0.63, p) * (1 - smooth(0.745, 0.79, p)), t, 0.22);
  v.chordFifth.detune.setTargetAtTime(42 * (1 - smooth(0.665, 0.725, p)), t, 0.25);

  // ACT 8 · the bull approaches, then charges. Both gain and pitch ride the
  // same curve Bull3D's mesh does, and both clear out of the impact flash.
  const charge = smooth(0.755, 0.805, p);
  v.sub.gain.setTargetAtTime(
    0.34 * smooth(0.73, 0.78, p) * (0.4 + 0.6 * charge) * (1 - smooth(0.806, 0.84, p)),
    t,
    0.1
  );
  v.subOsc.frequency.setTargetAtTime(34 + 14 * charge, t, 0.15);

  // ACT 9 · the rain. It starts before the matrix act does (0.828, not 0.84) so
  // it overlaps the sub's tail — timed to the act boundary there was a measured
  // 0.838-0.846 hole where every voice was off at once. Its own tail overlaps
  // the master duck above, so the film ends on one fade rather than two.
  v.rain.gain.setTargetAtTime(0.12 * smooth(0.828, 0.878, p) * (1 - smooth(0.95, 0.99, p)), t, 0.2);

  // THE HITS. Edge-triggered on the film's own clock: crossing a beat forwards
  // fires it, and scrubbing back over it and forwards again fires it again —
  // which is exactly what the picture does with the same two detonations.
  if (lastP >= 0) {
    for (const h of HITS) {
      if (lastP < h.at && p >= h.at) cinemaImpact(h.strength);
    }
  }
  lastP = p;
}

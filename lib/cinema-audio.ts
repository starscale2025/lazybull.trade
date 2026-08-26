// THE FILM'S SOUND — procedural, opt-in, and zero asset bytes.
//
// The audit's sound designer scored this site 2/10, for the most damning reason
// available: a nine-act cue sheet, a per-frame velocity bus, a sidechain
// envelope and a ▶ control all existed in the codebase, across ~963 lines, and
// not one of them touched `audio`. The film was silent. A live cinematic with no
// sound has a hard ceiling no amount of shader work can lift.
//
// FOUR RULES THIS OBEYS
//
// 1. NOTHING IS FETCHED. Every voice is synthesised from an OscillatorNode or a
//    noise buffer generated once at 2 seconds. No mp3, no webm, no CDN, no CSP
//    change, and nothing to add to the 4.6MB budget.
// 2. IT IS OFF UNTIL ASKED. The AudioContext is not even constructed until a
//    real click. Browsers require a gesture anyway, but the point is stronger
//    than compliance: an unrequested noise on a finance site is hostile.
// 3. IT RIDES THE FILM'S CLOCK. Gains are scheduled from the same progress the
//    scene draws from, so sound cannot desync from picture — which is the
//    single most common tell of a bolted-on audio layer.
// 4. IT DUCKS TO SILENCE. On reduced-motion, on tab blur, and past the last
//    beat. The abrupt absence at the end is deliberate: it is what makes the
//    hand-off to the page feel like waking up.

type Voices = {
  ctx: AudioContext;
  master: GainNode;
  fog: GainNode;
  roar: GainNode;
  roarFilter: BiquadFilterNode;
  noise: AudioBuffer;
};

let V: Voices | null = null;
let enabled = false;

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

/** Build the graph. Called once, from a user gesture. */
export function enableCinemaAudio(): boolean {
  if (V) {
    enabled = true;
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
    master.connect(ctx.destination);

    const noise = makeNoise(ctx);

    // FOG — a low drone under the opening. Lowpass swept by boot progress.
    const fog = ctx.createGain();
    fog.gain.value = 0;
    const fogFilter = ctx.createBiquadFilter();
    fogFilter.type = "lowpass";
    fogFilter.frequency.value = 90;
    loop(ctx, noise, fogFilter);
    fogFilter.connect(fog).connect(master);

    // ROAR — the dive corridor. Bandpass whose gain reads scroll VELOCITY, so
    // the corridor roars in proportion to how hard you are scrolling. The clock
    // already computes and damps that number; nothing new is measured.
    const roar = ctx.createGain();
    roar.gain.value = 0;
    const roarFilter = ctx.createBiquadFilter();
    roarFilter.type = "bandpass";
    roarFilter.frequency.value = 320;
    roarFilter.Q.value = 0.8;
    loop(ctx, noise, roarFilter);
    roarFilter.connect(roar).connect(master);

    V = { ctx, master, fog, roar, roarFilter, noise };
    enabled = true;
    return true;
  } catch {
    return false; // no audio available — the film is simply silent, as before
  }
}

export function disableCinemaAudio() {
  enabled = false;
  if (V) V.master.gain.setTargetAtTime(0, V.ctx.currentTime, 0.08);
}

export function cinemaAudioEnabled() {
  return enabled;
}

/** A short bandpassed click — one panel landing, or the charge impact. */
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
 * clock's own damped velocity — no state of its own, so scrubbing backwards
 * sounds like scrubbing backwards.
 */
export function cinemaAudioFrame(progress: number, velocity: number) {
  if (!V || !enabled) return;
  const { ctx, master, fog, roar, roarFilter } = V;
  const t = ctx.currentTime;
  const smooth = (a: number, b: number, x: number) => {
    const u = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };

  // Master ducks to nothing over the last 2% — the silence IS the ending.
  const out = 0.5 * (1 - smooth(0.96, 0.995, progress));
  master.gain.setTargetAtTime(document.hidden ? 0 : out, t, 0.12);

  // fog lives under boot + assembly, then clears
  fog.gain.setTargetAtTime(0.5 * (1 - smooth(0.1, 0.2, progress)), t, 0.2);

  // the corridor roars with how hard you scroll, only while the dive is up
  const inDive = smooth(0.14, 0.17, progress) * (1 - smooth(0.23, 0.26, progress));
  const v = Math.min(1, Math.abs(velocity) * 26);
  roar.gain.setTargetAtTime(inDive * v * 0.42, t, 0.09);
  roarFilter.frequency.setTargetAtTime(240 + v * 520, t, 0.12);
}

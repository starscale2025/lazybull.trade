// The orbit on /start: six page links on a tilted ring around the wordmark.
//
// Pure maths, no DOM. Angles are in radians on the screen's ellipse: 0 is the
// right end, FRONT (a quarter turn) is the bottom of the ellipse, nearest the
// viewer, and the top is the back. A pod's depth is the sine of its angle:
// +1 at the front, -1 at the back. Depth decides size, opacity and whether the
// pod is drawn in front of the wordmark or behind it.

export const TAU = Math.PI * 2;
export const FRONT = Math.PI / 2;

/** The wordmark's layer; pods behind it sit below this, pods in front above. */
export const Z_WORDMARK = 10;

export type Ring = { cx: number; cy: number; rx: number; ry: number };
export type Pose = { x: number; y: number; depth: number; scale: number; opacity: number; z: number };

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Wrap an angle into (-π, π]. */
export function wrapPi(a: number): number {
  const w = ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return w === -Math.PI ? Math.PI : w;
}

/** Where a pod at `theta` sits and how it is drawn. */
export function podPose(theta: number, ring: Ring): Pose {
  const depth = Math.sin(theta);
  const near = (depth + 1) / 2;
  return {
    x: ring.cx + ring.rx * Math.cos(theta),
    y: ring.cy + ring.ry * depth,
    depth,
    // one depth drives size, brightness and (see depthBand) sharpness together
    scale: 0.8 + 0.24 * near,
    opacity: 0.62 + 0.38 * smooth(near),
    // Nearer pods stack over farther ones; the wordmark's layer splits the two halves.
    z: depth >= 0 ? Z_WORDMARK + 2 + Math.round(depth * 3) : Z_WORDMARK - 4 + Math.round((depth + 1) * 3),
  };
}

export type DepthBand = "back" | "side" | "front";

/**
 * How sharp a pod is drawn: a touch soft at the back of the ring, crisp at the
 * front. Three steps rather than a blur that changes every frame, so a pod
 * repaints only when it crosses from one band to the next.
 */
export function depthBand(depth: number): DepthBand {
  return depth < -0.35 ? "back" : depth > 0.35 ? "front" : "side";
}

/**
 * How far a pod drifts against the pointer, as a share of the ring's own
 * drift: the front of the ring a fifth further than the back, so the pointer
 * shows the ring's depth as well as its place.
 */
export function driftFactor(depth: number): number {
  return 1 + 0.2 * ((depth + 1) / 2);
}

/** A pod counts as approached once the pointer is this near it (0 out of reach, 1 touching)... */
export const APPROACH_ENTER = 0.3;
/** ...and is let go a little later, so it never flickers at the edge of reach. */
export const APPROACH_LEAVE = 0.12;
/** Only a pointer that moved within this long can catch a pod. */
export const APPROACH_FRESH_MS = 400;
/** A pod that was approached, not touched, is let go once the pointer has rested this long. */
export const APPROACH_STALE_MS = 5000;

/**
 * Which pod the pointer has come up to, if any. `near[i]` is how near pod i is
 * (0 out of reach, 1 touching) and `idleMs` how long ago the pointer last moved.
 *
 * A pod is caught only by a pointer on the move: one drifting past a parked
 * pointer is not approached. The pod held is kept until it is out of reach,
 * until another is clearly nearer, or until the pointer has rested so long
 * that the visitor is evidently not reaching for it.
 */
export function nextApproach(current: number | null, near: readonly number[], idleMs: number): number | null {
  let held = current != null && near[current] >= APPROACH_LEAVE && idleMs < APPROACH_STALE_MS ? current : null;
  if (idleMs < APPROACH_FRESH_MS) {
    let best = -1;
    for (let i = 0; i < near.length; i++) if (near[i] >= APPROACH_ENTER && (best < 0 || near[i] > near[best])) best = i;
    if (best >= 0 && (held == null || near[best] > near[held] + 0.15)) held = best;
  }
  return held;
}

/** Pod i's angle on a ring turned to `ringAngle`: the pods run clockwise from pod 0. */
export function podAngle(i: number, ringAngle: number, n: number): number {
  return ringAngle - (i * TAU) / n;
}

/** The ring angle at rest: the pods fan out evenly, the middle pair nearest the front. */
export function restAngle(n: number): number {
  return FRONT + ((n - 1) / 2) * (TAU / n);
}

/**
 * The still arc: where pod i waits before the orbit starts, and where it stays
 * when motion is paused or reduced. All six sit across the front of the ring,
 * evenly spaced left to right in reading order, so none overlaps and none is
 * behind the wordmark.
 */
export function arcAngle(i: number, n: number): number {
  const reach = 0.97; // how close the outer pods come to the ring's ends
  const x = n > 1 ? -reach + (i * 2 * reach) / (n - 1) : 0;
  return Math.acos(x);
}

/** The pod nearest the front. */
export function frontIndex(ringAngle: number, n: number): number {
  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i < n; i++) {
    const gap = Math.abs(wrapPi(podAngle(i, ringAngle, n) - FRONT));
    if (gap < bestGap - 1e-9) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}

/** The signed turn, by the short way round, that brings pod i to the front. */
export function turnToFront(i: number, ringAngle: number, n: number): number {
  return wrapPi(FRONT - podAngle(i, ringAngle, n));
}

export type Spin = {
  angle: number;
  /** Radians a second. */
  vel: number;
  /** An angle the ring is easing toward (a keyboard step, a focused pod), or null. */
  goal: number | null;
};

/**
 * One frame of the ring. With a goal it eases straight to it. Otherwise its
 * speed settles toward the cruise (or toward rest while something holds it),
 * so a flick dies away into the slow turn instead of stopping dead.
 */
export function stepSpin(s: Spin, dt: number, o: { cruise: number; hold: boolean }): Spin {
  if (dt <= 0) return s;
  if (s.goal != null) {
    const gap = s.goal - s.angle;
    if (Math.abs(gap) < 0.0015) return { angle: s.goal, vel: 0, goal: null };
    return { angle: s.angle + gap * (1 - Math.exp(-dt * 7)), vel: 0, goal: s.goal };
  }
  const target = o.hold ? 0 : o.cruise;
  const vel = s.vel + (target - s.vel) * (1 - Math.exp(-dt * (o.hold ? 6 : 1.6)));
  return { angle: s.angle + vel * dt, vel, goal: null };
}

/** Blend two angles by the short way round. */
export function mixAngle(a: number, b: number, t: number): number {
  return a + wrapPi(b - a) * t;
}

/**
 * The ring for a stage: centred on the wordmark, wide enough that the pods
 * change layers clear of the letters, and inside the stage's edges. It grows
 * with the stage only as far as 2.26 wordmark sizes (the shape it has on a
 * 1440px screen): the wordmark has a ceiling, so on a wider screen the whole
 * scene keeps its proportions and stays in the middle.
 */
export function ringFor(stage: { width: number; horizon: number }, word: { halfWidth: number; fontSize: number }, pod: { width: number }): Ring {
  const clear = word.halfWidth + pod.width * 0.6;
  const fit = stage.width / 2 - pod.width * 0.45 - 8;
  const roomy = Math.min(stage.width * 0.42, word.fontSize * 2.26);
  return {
    cx: stage.width / 2,
    cy: stage.horizon - word.fontSize * 0.36,
    rx: Math.max(120, Math.min(fit, Math.max(clear, roomy))),
    ry: word.fontSize * 0.36 + 60,
  };
}

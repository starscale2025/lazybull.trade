import { ACTS, COPY_BEATS } from "@/lib/cinema";

// The film's page geometry, in ONE place.
//
// Two components have to agree on this number exactly: ScrollCinema, which
// renders the real pinned section, and CinemaGate, which reserves that section's
// height on the first paint so mounting the film shifts nothing. They used to
// each carry their own copy; if those two ever drift, the reservation stops
// matching the thing it reserves and the CLS this split was created to kill
// comes straight back.
//
// Deliberately a plain .ts module with no imports so both a client component and
// any future server component can read it without pulling anything into a bundle.

/**
 * Scrubbable length of the pinned cinema section, in vh.
 *
 * 1400 → 1500 when the ICE-LAB tail was widened. 1500 → 1370 in 2026-11 when
 * frame zero retired the boot and desk acts: the film now starts at the dive,
 * and the length is chosen so every act after the dive beat keeps exactly the
 * pace it had (0.835 of the film over the same 1169vh it used to get), with the
 * curtain's lift added in front. 1450 (the hold, Gate A2) → 1340 (Gate A4 #5):
 * the mark's act went from about 2,120 px to 740 (ACT_TEMPO below), the vote
 * gained about 210, and every other act stayed within 3% of its length.
 * 1340 → 1284 (the one take): the candle act's tail is the floor line's glide
 * now, not a lab, and gets half the road; the other acts keep their pace.
 */
export const SCROLL_LENGTH_VH = 1284;

/**
 * THE HOLD (2026-11, Gate A2). The last stretch of the section during which
 * the film stays at its final frame, still pinned, so the hand-off dissolve
 * plays on a held stage at any scroll speed instead of scrolling away half
 * done. SCROLL_LENGTH_VH grew by exactly this much (1370 → 1450), so every act
 * keeps the pace it had: the film itself still plays over 1270vh.
 */
export const HANDOFF_HOLD_VH = 80;

/**
 * How far the section pulls the following section UP, in vh. The film's last
 * frame settles to the page ground over it, so the two overlap by one viewport.
 */
export const HANDOFF_OVERLAP_VH = 100;

/**
 * FRAME ZERO's curtain, in vh. The hero instrument is the first frame, stacked
 * above the film; the film's section starts this far UP under it, so scrolling
 * lifts the hero off an already-pinned stage.
 */
export const CURTAIN_VH = 100;

/** Film progress where the film starts (the dive; boot and desk are retired). */
export const FILM_START = 0.15;
/** Film progress reached as the curtain finishes lifting: the dive's beat. */
export const FILM_LIFT_END = 0.165;

/**
 * Scroll progress (0..1 over the pinned section) → film progress (ACTS space).
 * The curtain's lift covers only the tunnel's run-up, so the first line of the
 * film appears as the hero clears, never under it.
 */
// The pinned scroll is SCROLL_LENGTH_VH less the one viewport the stage itself
// fills; the film plays over all of it except the hold at the end.
const PINNED_VH = SCROLL_LENGTH_VH - 100;
const PLAY_VH = PINNED_VH - HANDOFF_HOLD_VH;
/** Fraction of the section's scroll progress over which the film plays. */
export const FILM_SPAN = PLAY_VH / PINNED_VH;

// ── THE TEMPO MAP (Phase 4, M31) ────────────────────────────────────────────
// After the curtain the film used to advance at one constant rate per pixel.
// Now it brakes where there is something to read (inside each beat's plateau)
// and speeds through the dissolves between acts: a density over film
// progress, integrated into a monotone map. The map is piecewise linear on one
// fixed grid and so is its inverse, which makes the two exact inverses of each
// other (the rail's seeks and the reload resume depend on that).
const TEMPO_GRID = 2048;
/** More road for the vote, much less for the mark at rest (see ACT_TEMPO). */
const VOTE_TEMPO = 1.4;
const TAIL_TEMPO = 0.18;
/** The floor line's glide from the chart to the payoff, where a lab stood. */
const FLOOR_PASSAGE = { from: 0.505, to: 0.59 };
const FLOOR_TEMPO = 0.5;
/** Where the mark has finished forming (public/cinema/scene.html, MARK1). */
const MARK_REST = 0.87;
const BRAKE = 0.32; // up to 32% more scroll per film unit inside a beat
const RUSH = 0.28; // up to 28% less across an act seam
const SEAM_HALF = 0.012;

function tempoDensity(p: number): number {
  let brake = 0;
  for (const b of COPY_BEATS) {
    const f = Math.min(b.fade ?? 0.02, (b.to - b.from) / 2);
    const inside = smoothstep(b.from, b.from + f, p) * (1 - smoothstep(b.to - f, b.to, p));
    if (inside > brake) brake = inside;
  }
  let rush = 0;
  for (const seam of [ACTS.dive.to, ACTS.regime.to, ACTS.candle.to, ACTS.safety.to, ACTS.consensus.to, ACTS.bull.to]) {
    const near = 1 - smoothstep(0, SEAM_HALF, Math.abs(p - seam));
    if (near > rush) rush = near;
  }
  return (1 + BRAKE * brake - RUSH * rush) * actTempo(p);
}

// ACT TEMPO (Gate A4 #5). Some acts had the wrong amount of road, whatever
// the beats said. The vote read as a blink (about 520 px). After the bull, the
// mark formed in the first fifth of its act and then stood still for some
// 2,100 px plus the hold, a logo and two words: the reader's "this is empty".
// A smooth-edged multiplier per stretch; SCROLL_LENGTH_VH gives back exactly
// what the tail lost, less what the vote gained, so every other act keeps its
// length in pixels.
const ACT_TEMPO: { from: number; to: number; k: number }[] = [
  { from: ACTS.consensus.from, to: ACTS.consensus.to, k: VOTE_TEMPO },
  { from: FLOOR_PASSAGE.from, to: FLOOR_PASSAGE.to, k: FLOOR_TEMPO },
  { from: MARK_REST, to: 1, k: TAIL_TEMPO },
];
const TEMPO_EDGE = 0.008;

function actTempo(p: number): number {
  let k = 1;
  for (const a of ACT_TEMPO) {
    const w = smoothstep(a.from - TEMPO_EDGE, a.from + TEMPO_EDGE, p) * (1 - smoothstep(a.to - TEMPO_EDGE, a.to + TEMPO_EDGE, p));
    k *= 1 + (a.k - 1) * w;
  }
  return k;
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// CUM[i] = scroll share at film progress KNOT(i), from 0 at FILM_LIFT_END to 1 at 1.
const KNOT = (i: number) => FILM_LIFT_END + ((1 - FILM_LIFT_END) * i) / TEMPO_GRID;
const CUM = (() => {
  const c = new Float64Array(TEMPO_GRID + 1);
  for (let i = 1; i <= TEMPO_GRID; i++) {
    const d0 = tempoDensity(KNOT(i - 1));
    const d1 = tempoDensity(KNOT(i));
    c[i] = c[i - 1] + (d0 + d1) / 2;
  }
  const total = c[TEMPO_GRID];
  for (let i = 0; i <= TEMPO_GRID; i++) c[i] /= total;
  return c;
})();

/** Film progress (FILM_LIFT_END..1) → share of the post-curtain scroll (0..1). */
function playOf(p: number): number {
  const f = ((p - FILM_LIFT_END) / (1 - FILM_LIFT_END)) * TEMPO_GRID;
  if (f <= 0) return 0;
  if (f >= TEMPO_GRID) return 1;
  const i = Math.floor(f);
  return CUM[i] + (CUM[i + 1] - CUM[i]) * (f - i);
}

/** The inverse: share of the post-curtain scroll (0..1) → film progress. */
function filmOf(x: number): number {
  if (x <= 0) return FILM_LIFT_END;
  if (x >= 1) return 1;
  let lo = 0;
  let hi = TEMPO_GRID;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (CUM[mid] <= x) lo = mid;
    else hi = mid;
  }
  const t = (x - CUM[lo]) / Math.max(1e-12, CUM[hi] - CUM[lo]);
  return KNOT(lo) + (KNOT(hi) - KNOT(lo)) * t;
}

export function scrollToFilm(s: number): number {
  const c = CURTAIN_VH / PLAY_VH;
  const x = s < 0 ? 0 : s >= FILM_SPAN ? 1 : s / FILM_SPAN;
  if (x <= c) return FILM_START + (FILM_LIFT_END - FILM_START) * (x / c);
  return filmOf((x - c) / (1 - c));
}

/** The inverse, for the rail's seeks and the reload resume. Film 1 maps to the
 *  start of the hold. */
export function filmToScroll(p: number): number {
  const c = CURTAIN_VH / PLAY_VH;
  if (p <= FILM_START) return 0;
  if (p <= FILM_LIFT_END) return FILM_SPAN * c * ((p - FILM_START) / (FILM_LIFT_END - FILM_START));
  if (p >= 1) return FILM_SPAN;
  return FILM_SPAN * (c + (1 - c) * playOf(p));
}

/** How far through the hold `s` (raw section progress) is: 0 when the film
 *  reaches its last frame, 1 at the section's end. lib/cinema.ts
 *  handoffOpacity dissolves the stage over it. */
export function holdOf(s: number): number {
  if (!(s > FILM_SPAN)) return 0;
  return s >= 1 ? 1 : (s - FILM_SPAN) / (1 - FILM_SPAN);
}

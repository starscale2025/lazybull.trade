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
 * curtain's lift added in front.
 */
export const SCROLL_LENGTH_VH = 1450;

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

export function scrollToFilm(s: number): number {
  const c = CURTAIN_VH / PLAY_VH;
  const x = s < 0 ? 0 : s >= FILM_SPAN ? 1 : s / FILM_SPAN;
  if (x <= c) return FILM_START + (FILM_LIFT_END - FILM_START) * (x / c);
  return FILM_LIFT_END + (1 - FILM_LIFT_END) * ((x - c) / (1 - c));
}

/** The inverse, for the rail's seeks and the reload resume. Film 1 maps to the
 *  start of the hold. */
export function filmToScroll(p: number): number {
  const c = CURTAIN_VH / PLAY_VH;
  if (p <= FILM_START) return 0;
  if (p <= FILM_LIFT_END) return FILM_SPAN * c * ((p - FILM_START) / (FILM_LIFT_END - FILM_START));
  if (p >= 1) return FILM_SPAN;
  return FILM_SPAN * (c + (1 - c) * ((p - FILM_LIFT_END) / (1 - FILM_LIFT_END)));
}

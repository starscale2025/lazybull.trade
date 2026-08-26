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
 * 1400 → 1500 when the ICE-LAB tail was widened: it offsets the mild
 * progress-compression on safety/consensus so their felt pace barely changes,
 * and gives the lab's colour story its ~1.8x breathing room.
 */
export const SCROLL_LENGTH_VH = 1500;

/**
 * How far the section pulls the following hero UP, in vh. The film's last frame
 * resolves onto the hero, so the two overlap by exactly one viewport.
 */
export const HANDOFF_OVERLAP_VH = 100;

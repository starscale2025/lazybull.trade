// The film's memory across reloads and sessions, outside ScrollCinema so that
// CinemaGate can read it without loading the film (the film now mounts on
// scroll intent; see CinemaGate).
import { FILM_LIFT_END } from "./cinema-metrics";

// ── THE FILM'S MEMORY ────────────────────────────────────────────────────────
//
// Three keys, and each one now has a reader. They used to be written with a
// comment claiming "CinemaGate reads this" next to them; it did not, and a grep
// for either name found the two writes below and nothing else. So the film
// re-ran in full on every single load, including the reload you did because you
// were eight thousand pixels into it.
//
//   lb-cinema-seen        localStorage   played through, or skipped, at least
//                                        once on this device. STILL WRITTEN,
//                                        NO LONGER GATES: keying the intro on
//                                        it made the film a once-per-browser
//                                        event, so the site quietly lost its
//                                        opening for good. The gate reads the
//                                        session key below instead. Kept
//                                        because it is the honest record of
//                                        "has this person ever seen it", which
//                                        a future first-run tour would want.
//   lb-cinema-autoplayed  sessionStorage the film has already RUN in this tab →
//                                        same, but only for this tab, so a new
//                                        session gets the film back.
//   lb-cinema-resume      sessionStorage where in the film you were. Read only
//                                        below, and only after a reload.
//   lb-cinema-replay      sessionStorage you asked for the film (⌘K, or
//                                        GetStarted's "watch the film"). Read by
//                                        CinemaGate; CONSUMED here, the moment
//                                        the film actually starts.
//
// The consuming lives on this side on purpose. CinemaGate's decision is now a
// pure read, which is what lets it re-run freely — on a resize, on React's
// double-invoked effects in dev, and on a client-side navigation back to "/".
// When the gate consumed the flag itself it needed a module-level memo to
// survive those, and that memo then re-mounted the whole film on the trip back
// from /learn, which is the toll booth all of this exists to remove.
export const SEEN_KEY = "lb-cinema-seen";
export const AUTOPLAYED_KEY = "lb-cinema-autoplayed";
export const RESUME_KEY = "lb-cinema-resume";
export const REPLAY_KEY = "lb-cinema-replay";

/** Played through or skipped — never auto-play at them again. */
export function markCinemaSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
    sessionStorage.setItem(AUTOPLAYED_KEY, "1");
    sessionStorage.removeItem(RESUME_KEY); // the film is over; there is no place to return to
    sessionStorage.removeItem(REPLAY_KEY); // and any request for it has been met
  } catch {
    /* storage blocked (private mode, third-party frame) — the film just replays */
  }
}

/**
 * Where in the film to come back to, or null to start at the top.
 *
 * ONLY A RELOAD RESUMES. A fresh navigation to "/" is someone arriving, and
 * dropping an arrival into act six because they once left a tab open mid-film
 * would be stranger than replaying it. `back_forward` counts too: that is the
 * back button landing on a page it already had.
 */
export function cinemaResumeAt(): number | null {
  try {
    // Someone who asked for the film wants the film, not the back half of it.
    if (sessionStorage.getItem(REPLAY_KEY) === "1") return null;
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.type !== "reload" && nav?.type !== "back_forward") return null;
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (raw === null) return null;
    const p = Number(raw);
    // Up to the end of the curtain's lift there is nothing worth restoring:
    // the loop records FILM_START at rest under the hero, and the old 0.02
    // floor let that through, so a reload on frame zero scrolled the page
    // into the film. Above 0.97 the film is already handing off, and resuming
    // there would drop you into the seam.
    return Number.isFinite(p) && p > FILM_LIFT_END && p < 0.97 ? p : null;
  } catch {
    return null;
  }
}

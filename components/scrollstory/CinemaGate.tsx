"use client";

import { useEffect, useState } from "react";
import { ScrollCinema, cinemaResumeAt } from "./ScrollCinema";
import { MobileCinema } from "./MobileCinema";
import { CinemaStill } from "./CinemaStill";
import { SCROLL_LENGTH_VH } from "./cinema-metrics";

// The intro film auto-plays the FIRST time you land on the homepage, then hands
// off to the hero. Nobody is trapped: the cinema carries an always-visible
// "Skip intro" button, and scroll unlocks the moment the scene is ready.
//
// IT USED TO PLAY ON EVERY LOAD, FOREVER
// ──────────────────────────────────────
// ScrollCinema wrote `lb-cinema-seen` and `lb-cinema-autoplayed` on the way out,
// each with a comment saying CinemaGate read them. Neither name appeared
// anywhere else in the repo. So the flags were writes into a void and the film
// was a toll booth: the no-navbar IA sends every logo click back to "/", which
// meant a scroll-locked preloader and 13,500px of intro between a returning
// reader and the product, every single time.
//
// Now the flags decide. A reader who has been through the film once gets
// CinemaStill instead — the film's decisive frame plus its index, which is the
// same artifact reduced-motion and no-WebGL readers already get, and which is
// the point of the film compressed into one screen. GetStarted's "▶ watch the
// film" and ⌘K's "Replay the landing film" both set `lb-cinema-replay`, and that
// beats everything: an asked-for film always plays, from the top.
//
// A reload is the exception that is NOT a return visit — see cinemaResumeAt:
// reloading at act six means going back to act six, not being told you have
// already seen it.
//
// · phones (<768px) NEVER mount it: the boot act's laptop wireframe cannot
//   compose at 390px — the audit's mobile first impression was a black void with
//   three green lines. Mobile gets the designed static hero.
//
// WHY THIS COMPONENT RESERVES SPACE BEFORE IT DECIDES
// ───────────────────────────────────────────────────
// This gate used to render `null` until its effect ran. That meant the FIRST
// PAINT had no film in the document, so <GetStarted> painted at the top of the
// page — and ~810ms later the effect inserted a 13,500px section ABOVE it and
// shoved it down by the full height of the film.
//
// Measured: that single insertion was 0.959 of the homepage's 0.985 CLS.
// Google's "poor" threshold is 0.25. The control that proves the diagnosis is
// the same page at <768px, where this gate never mounts the film at all: 0.023.
//
// So the gate now always renders a box of exactly the film's size, and only
// swaps its CONTENTS. The reserved box is `hidden md:block`, which matches the
// (max-width: 767px) check below exactly — phones reserve nothing, because
// phones get nothing. Nothing moves on either one.
// "pending" until a REAL viewport width exists to decide from. Phones get their
// OWN film — a 2D canvas cut for portrait, zero three.js. See MobileCinema for
// why it is a different film rather than a smaller one.
type Mode = "pending" | "film" | "mobile" | "still";

/**
 * Film or still, at desktop width. A PURE READ — no writes, no memo.
 *
 * That matters more than it looks. `lb-cinema-replay` does have to be consumed
 * or the film would replay on every later load in the tab, but consuming it
 * here would make this a side effect, and this function runs again on every
 * resize, on React's double-invoked effects in dev, and on a client-side
 * navigation back to "/". Guarding that with a memo just moved the bug: the memo
 * outlives a route change, so returning from /learn re-mounted the film. So
 * ScrollCinema clears the flag instead, when the film actually starts, and this
 * stays a question rather than an action.
 */
function decideDesktop(): "film" | "still" {
  let replay = false;
  let seen = false;
  try {
    replay = sessionStorage.getItem("lb-cinema-replay") === "1";
    // SESSION-SCOPED, NOT FOREVER.
    //
    // This first read localStorage too, which meant the film played exactly
    // once per browser, ever — open the site tomorrow and the intro simply
    // did not exist any more. That overshot: the complaint was that a
    // scroll-locked film sat between a RETURNING reader and the product on
    // every logo click, not that the film should be a one-time event. Session
    // scope answers the first without the second — a fresh visit gets the
    // film, a hop to /learn and back does not.
    seen = sessionStorage.getItem("lb-cinema-autoplayed") === "1";
  } catch {
    /* storage blocked (private mode) — treat it as a first visit, play the film */
  }
  // A reload mid-film outranks "seen": the reader is not returning, they are
  // still here. ScrollCinema puts the scroll back where it was.
  return replay || !seen || cinemaResumeAt() !== null ? "film" : "still";
}

export function CinemaGate() {
  const [mode, setMode] = useState<Mode>("pending");

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    // Mirrors `mode` inside the effect so the decision above can happen out
    // here, where side effects are allowed, instead of inside the updater.
    let committed: Mode = "pending";

    const decide = () => {
      // A 0px viewport is NOT a phone — it is a window that has not laid out
      // yet (a background tab, an embedded frame, a window being restored).
      // Deciding from zero latched the intro into MobileCinema, whose own
      // md:hidden then collapsed it to height 0 the instant a real width
      // arrived: no film, no still, nothing at all. Wait for a width rather
      // than guess from the absence of one.
      if (!window.innerWidth) return;
      const phone = mql.matches;

      let next: Mode;
      if (committed === "film") {
        next = "film"; // once it is playing, never yank it
      } else if (committed === "pending") {
        // Phones never reach the desktop branch, so a replay asked for at phone
        // width survives untouched until a desktop width reads it.
        next = phone ? "mobile" : decideDesktop();
      } else {
        // Already committed to the phone branch. MobileCinema cannot survive a
        // widen, so hand off to the desktop STILL rather than mount 13,500px of
        // film mid-session and shove the page down by all of it.
        next = phone ? "mobile" : "still";
      }
      committed = next;
      setMode(next);
    };

    decide();
    mql.addEventListener("change", decide);
    // resize as well as the media query: `change` alone never fires for the
    // case that actually lost the film — first layout arriving after mount, so
    // width goes 0 -> real without ever crossing the 767px boundary.
    window.addEventListener("resize", decide);
    return () => {
      mql.removeEventListener("change", decide);
      window.removeEventListener("resize", decide);
    };
  }, []);

  if (mode === "film") return <ScrollCinema />;
  if (mode === "mobile") return <MobileCinema />;
  if (mode === "still") return <CinemaStill />;

  // The reservation. Same height and same negative hand-off overlap as the real
  // section in ScrollCinema — both divided by --ui-zoom for the reason
  // globals.css divides h-screen. Keep these two in step; cinema-metrics.ts is
  // the shared source of the number.
  return (
    <div
      aria-hidden
      data-cinema-reserve
      className="pointer-events-none relative z-20 hidden md:block"
      style={{
        height: `calc(${SCROLL_LENGTH_VH}vh / var(--ui-zoom))`,
        marginBottom: "calc(-100vh / var(--ui-zoom))",
      }}
    >
      {/* The stage the film will occupy, painted in the page ground so the
          pre-mount frame reads as the film's own black rather than as a gap.
          The loader gate takes over the moment ScrollCinema mounts. */}
      <div className="sticky top-0 h-screen w-full bg-bg" />
    </div>
  );
}

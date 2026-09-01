"use client";

import { useEffect, useState } from "react";
import { ScrollCinema } from "./ScrollCinema";
import { MobileCinema } from "./MobileCinema";
import { CinemaStill } from "./CinemaStill";
import { SCROLL_LENGTH_VH } from "./cinema-metrics";

// The intro film auto-plays on EVERY load of the homepage, then hands off to
// the hero. Nobody is trapped: the cinema carries an always-visible "Skip
// intro" button, and scroll unlocks the moment the scene is ready.
//
// TWO ATTEMPTS AT BEING CLEVER ABOUT REPEAT VISITORS, BOTH REVERTED
// ─────────────────────────────────────────────────────────────────
// A review called the film a toll booth: the no-navbar IA sends every logo
// click back to "/", so a returning reader met a scroll-locked preloader and
// 13,500px of intro on the way to the product. True, and the two fixes for it
// were both worse than the problem.
//
// Keying the gate on `lb-cinema-seen` (localStorage) meant the film played
// exactly once per browser and then never again — the site lost its opening
// permanently for precisely the people who visit most. Keying it on the
// session was gentler and still wrong for the same reason: this homepage IS
// the film, and a front door that quietly stops opening has optimised away
// the thing the site is known for.
//
// So it plays, every time. What survives from that work is the part that
// shortens the film without removing it: a reload resumes where you were,
// and Skip is always one click away. GetStarted's "▶ watch the film" and
// ⌘K's "Replay the landing film" set `lb-cinema-replay`, which forces it from
// the top even mid-session.
//
// Reloading at act six still puts you back at act six rather than the boot
// screen — that lives inside ScrollCinema now (cinemaResumeAt), and it is the
// one piece of the repeat-visitor work worth keeping, because it shortens the
// film without ever removing it.
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
 * THE FILM PLAYS ON EVERY LOAD. That is the owner's call and it is the
 * behaviour the site shipped with; two attempts at "be clever about repeat
 * visitors" both made it worse. Keying on localStorage meant the intro
 * existed exactly once per browser and then vanished for good. Keying on the
 * session was gentler and still wrong: the homepage IS the film, and a site
 * whose front door quietly stops opening for the people who come back most
 * has optimised away the thing it is known for.
 *
 * What DOES stay from that work, because none of it removes the film:
 *   · a reload mid-film resumes where you were instead of restarting from the
 *     boot screen (cinemaResumeAt, below)
 *   · "Skip intro" is always on screen, on desktop and on phones
 *   · ⌘K / "watch the film" force it from the top
 *
 * `lb-cinema-replay` still has to be CONSUMED, or an asked-for replay would
 * repeat on every later load in the tab — but consuming it here would make
 * this a side effect, and this function re-runs on resize, on React's
 * double-invoked effects in dev, and on a client-side navigation back to "/".
 * ScrollCinema clears it instead, when the film actually starts, so this stays
 * a question rather than an action.
 */
function decideDesktop(): "film" | "still" {
  try {
    /* Read only so the key is not left dangling; the film plays regardless. */
    sessionStorage.getItem("lb-cinema-replay");
  } catch {
    /* storage blocked (private mode) — irrelevant, the film plays anyway */
  }
  // Always. The still is still built and still shipped — it is what a
  // reduced-motion reader and a no-WebGL browser get (ScrollCinema falls back
  // to it internally), and what a phone gets after widening. It is just no
  // longer something an ordinary desktop visitor is quietly demoted to.
  return "film";
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

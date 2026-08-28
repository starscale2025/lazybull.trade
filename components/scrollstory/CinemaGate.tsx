"use client";

import { useEffect, useState } from "react";
import { ScrollCinema } from "./ScrollCinema";
import { MobileCinema } from "./MobileCinema";
import { CinemaStill } from "./CinemaStill";
import { SCROLL_LENGTH_VH } from "./cinema-metrics";

// The intro film AUTO-PLAYS on EVERY load, for everyone — logged in or not. It's
// the first thing you see each time you land on (or reload) the homepage, then
// hands off to the hero. Nobody is trapped: the cinema carries an always-visible
// "Skip intro" button, and scroll unlocks the moment the scene is ready.
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

export function CinemaGate() {
  const [mode, setMode] = useState<Mode>("pending");

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");

    const decide = () => {
      // A 0px viewport is NOT a phone — it is a window that has not laid out
      // yet (a background tab, an embedded frame, a window being restored).
      // Deciding from zero latched the intro into MobileCinema, whose own
      // md:hidden then collapsed it to height 0 the instant a real width
      // arrived: no film, no still, nothing at all. Wait for a width rather
      // than guess from the absence of one.
      if (!window.innerWidth) return;
      const phone = mql.matches;

      setMode((prev) => {
        if (prev === "film") return "film"; // once it is playing, never yank it
        if (prev === "pending") {
          if (!phone) {
            // ⌘K / "watch the film" sets this to force a replay; we auto-play on
            // every load anyway, so just clear it so it cannot linger.
            try {
              sessionStorage.removeItem("lb-cinema-replay");
            } catch {
              /* storage blocked — irrelevant, we play regardless */
            }
          }
          return phone ? "mobile" : "film";
        }
        // Already committed to the phone branch. MobileCinema cannot survive a
        // widen, so hand off to the desktop STILL rather than mount 13,500px of
        // film mid-session and shove the page down by all of it.
        return phone ? "mobile" : "still";
      });
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

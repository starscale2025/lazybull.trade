"use client";

import { useEffect, useState } from "react";
import { ScrollCinema } from "./ScrollCinema";

// The intro film AUTO-PLAYS on EVERY load, for everyone — logged in or not. It's
// the first thing you see each time you land on (or reload) the homepage, then
// hands off to the hero. Nobody is trapped: the cinema carries an always-visible
// "Skip intro" button, and scroll unlocks the moment the scene is ready.
//
// · phones (<768px) NEVER mount it: the boot act's laptop wireframe cannot
//   compose at 390px — the audit's mobile first impression was a black void with
//   three green lines. Mobile gets the designed static hero.
export function CinemaGate() {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    // phones keep the designed static hero
    if (window.matchMedia("(max-width: 767px)").matches) return;
    // ⌘K / "watch the film" set this to force a replay; we now auto-play on every
    // load anyway, so just clear it so it can't linger.
    try {
      sessionStorage.removeItem("lb-cinema-replay");
    } catch {
      /* storage blocked — irrelevant, we play regardless */
    }
    setPlay(true); // desktop: the cinema plays on every load
  }, []);

  return play ? <ScrollCinema /> : null;
}

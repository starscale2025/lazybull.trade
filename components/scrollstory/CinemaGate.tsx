"use client";

import { useEffect, useState } from "react";
import { ScrollCinema } from "./ScrollCinema";

// The intro film AUTO-PLAYS for EVERYONE — logged in or not — and hands off to
// the hero. It plays at most once per browser session: ScrollCinema sets
// `lb-cinema-autoplayed` (sessionStorage) when it collapses, so a same-session
// reload — or a nav back to "/" — doesn't replay it, while a fresh session plays
// it again. Everyone can bail instantly via the cinema's always-visible
// "Skip intro" button.
//
// · phones (<768px) NEVER mount it: the boot act's laptop wireframe cannot
//   compose at 390px — the audit's mobile first impression was a black void with
//   three green lines. Mobile gets the designed static hero.
// · lb-cinema-replay (sessionStorage): the ⌘K / "watch the film" replay — always
//   plays on desktop, even after you've seen it this session.
//
// The flag is set on COLLAPSE (not here), so React strict-mode's dev double-mount
// replays correctly instead of self-gating to blank.
export function CinemaGate() {
  const [play, setPlay] = useState(false);

  useEffect(() => {
    try {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const replay = sessionStorage.getItem("lb-cinema-replay") === "1";
      if (replay) sessionStorage.removeItem("lb-cinema-replay");
      if (mobile) return; // phones: designed static hero, never the cinema
      if (replay) {
        setPlay(true); // explicit replay always wins
        return;
      }
      // Everyone auto-plays once per session. ScrollCinema flips
      // lb-cinema-autoplayed on collapse, so this stays false for the rest of it.
      if (sessionStorage.getItem("lb-cinema-autoplayed") !== "1") setPlay(true);
    } catch {
      /* storage blocked → just show the page */
    }
  }, []);

  return play ? <ScrollCinema /> : null;
}

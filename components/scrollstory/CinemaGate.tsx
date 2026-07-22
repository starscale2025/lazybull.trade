"use client";

import { useEffect, useState } from "react";
import { ScrollCinema } from "./ScrollCinema";

// The cinema is OPT-IN, never a gate. The landing page is always visible
// first for everyone; the film plays only when someone chooses it via the
// hero's "▶ watch the film" chip (or the ⌘K "replay" command), which sets
// lb-cinema-replay and reloads.
//
// · phones (<768px) NEVER mount it: the boot act's laptop wireframe cannot
//   compose at 390px — the audit's mobile first impression was a black void
//   with three green lines. Mobile gets the designed static hero.
// · replay (lb-cinema-replay, sessionStorage): the ONLY thing that mounts the
//   cinema now. Consumed once, so a normal reload lands on the page.
//
// `flags` starts null so ScrollCinema is never mounted speculatively (the old
// gate preloaded ~2.5MB and locked scroll while the session resolved). Sign-in
// state no longer matters — nobody is forced through the intro.
export function CinemaGate() {
  const [flags, setFlags] = useState<null | { mobile: boolean; replay: boolean }>(null);

  useEffect(() => {
    try {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const replay = sessionStorage.getItem("lb-cinema-replay") === "1";
      if (replay) sessionStorage.removeItem("lb-cinema-replay");
      setFlags({ mobile, replay });
    } catch {
      setFlags({ mobile: false, replay: false });
    }
  }, []);

  if (!flags) return null;
  if (flags.mobile) return null;
  if (flags.replay) return <ScrollCinema />;
  return null; // landing is always visible; the film is opt-in
}

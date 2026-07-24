"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ScrollCinema } from "./ScrollCinema";

// The intro film AUTO-PLAYS for new (signed-out) visitors and hands off to the
// hero; signed-in members skip straight to the desk. It plays at most once per
// browser session: ScrollCinema sets `lb-cinema-autoplayed` (sessionStorage) when
// it collapses, so a same-session reload — or a nav back to "/" — doesn't replay
// it, while a fresh session plays it again. Everyone can bail instantly via the
// cinema's always-visible "Skip intro" button.
//
// · phones (<768px) NEVER mount it: the boot act's laptop wireframe cannot
//   compose at 390px — the audit's mobile first impression was a black void with
//   three green lines. Mobile gets the designed static hero.
// · lb-cinema-replay (sessionStorage): the ⌘K / "watch the film" replay — always
//   plays on desktop, even for members and even after you've seen it this session.
//
// Auth is read first so a signed-in visitor is never briefly dropped into the
// intro before we know who they are. The flag is set on COLLAPSE (not here), so
// React strict-mode's dev double-mount replays correctly instead of self-gating.
export function CinemaGate() {
  const { status } = useSession(); // "loading" | "authenticated" | "unauthenticated"
  const [play, setPlay] = useState(false);

  useEffect(() => {
    if (status === "loading") return; // wait until we know whether they're a member
    try {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const replay = sessionStorage.getItem("lb-cinema-replay") === "1";
      if (replay) sessionStorage.removeItem("lb-cinema-replay");
      if (mobile) return; // phones: designed static hero, never the cinema
      if (replay) {
        setPlay(true); // explicit replay always wins (members included)
        return;
      }
      if (status === "authenticated") return; // members skip the intro
      // New / signed-out visitor: auto-play once per session. ScrollCinema flips
      // lb-cinema-autoplayed on collapse, so this stays false for the rest of it.
      if (sessionStorage.getItem("lb-cinema-autoplayed") !== "1") setPlay(true);
    } catch {
      /* storage blocked → just show the page */
    }
  }, [status]);

  return play ? <ScrollCinema /> : null;
}

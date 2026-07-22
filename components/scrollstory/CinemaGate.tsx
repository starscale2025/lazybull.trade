"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ScrollCinema } from "./ScrollCinema";

// The cinema plays ONCE per visitor, ever — not once per pageview — and only
// where it can actually compose:
//
// · phones (<768px) NEVER mount it: the boot act's laptop wireframe cannot
//   compose at 390px — the audit's mobile first impression was a black void
//   with three green lines. Mobile gets the designed static hero instead.
// · replay (lb-cinema-replay, sessionStorage): the hero's "▶ replay the
//   film" chip sets it — the intro is a possession now, not a toll. Replay
//   overrides both the seen-flag and the signed-in skip, once.
// · seen-flag (lb-cinema-seen): the landing has no navbar, so every logo
//   click funnels back to "/"; without the flag anonymous users re-entered
//   the scroll-locked preloader on every return.
// · signed-in users skip it; first-time anonymous visitors get the film.
//
// `flags` starts null so ScrollCinema is never mounted speculatively (the
// old gate preloaded ~2.5MB and locked scroll while the session was still
// resolving, then threw it all away).
export function CinemaGate() {
  const { status } = useSession();
  const [flags, setFlags] = useState<null | { mobile: boolean; replay: boolean; seen: boolean }>(null);

  useEffect(() => {
    try {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const replay = sessionStorage.getItem("lb-cinema-replay") === "1";
      if (replay) sessionStorage.removeItem("lb-cinema-replay");
      const seen = localStorage.getItem("lb-cinema-seen") === "1";
      setFlags({ mobile, replay, seen });
    } catch {
      setFlags({ mobile: false, replay: false, seen: false });
    }
  }, []);

  if (!flags) return null;
  if (flags.mobile) return null;
  if (flags.replay) return <ScrollCinema />;
  if (flags.seen) return null;
  if (status !== "unauthenticated") return null; // loading or signed-in
  return <ScrollCinema />;
}

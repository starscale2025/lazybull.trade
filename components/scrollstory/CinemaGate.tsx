"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ScrollCinema } from "./ScrollCinema";

// The cinema plays ONCE per visitor, ever — not once per pageview. It skips
// for signed-in users AND for anyone who has already played (or skipped) it:
// the landing has no navbar, so every logo click funnels back to "/", and
// without the seen-flag anonymous users re-entered the scroll-locked
// preloader on every return. Renders the cinema as a bare sibling so its
// section.nextElementSibling is Get Started.
//
// `seen` starts null so we never mount ScrollCinema speculatively: the old
// gate mounted it while the session was still "loading", which kicked off the
// full preload (the three.js chunk, two GLBs, eight shots ≈ 2.5MB) and a
// scroll lock that a signed-in user's resolving session immediately threw
// away.
export function CinemaGate() {
  const { status } = useSession();
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setSeen(localStorage.getItem("lb-cinema-seen") === "1");
    } catch {
      setSeen(false);
    }
  }, []);

  if (status === "loading" || seen === null) return null;
  if (status === "authenticated" || seen) return null;
  return <ScrollCinema />;
}

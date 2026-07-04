"use client";

import { useSession } from "next-auth/react";
import { ScrollCinema } from "./ScrollCinema";

// Play-once for everyone, and skip entirely for signed-in users — returning
// members go straight to the Get Started / product handoff, no intro. Renders
// the cinema as a bare sibling so its section.nextElementSibling is Get Started.
export function CinemaGate() {
  const { status } = useSession();
  if (status === "authenticated") return null;
  return <ScrollCinema />;
}

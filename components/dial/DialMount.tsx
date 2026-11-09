"use client";

import dynamic from "next/dynamic";

// Client-only (its contents come from this browser's storage) and split out,
// because frame zero's byte budget is shared with the film.
const ShortcutDial = dynamic(() => import("./ShortcutDial").then((m) => m.ShortcutDial), { ssr: false });

export function DialMount() {
  return <ShortcutDial />;
}

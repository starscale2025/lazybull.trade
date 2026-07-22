"use client";

// The route veil: a 240ms phosphor settle on every navigation. The landing
// spends fifteen viewports teaching a cinematic language — hard-cutting to
// /quant like a 2009 browser undid all of it. Template remounts per route,
// so the veil replays on each navigation and never blocks input
// (pointer-events: none; reduced-motion kills it entirely in CSS).

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="route-veil" aria-hidden />
    </>
  );
}

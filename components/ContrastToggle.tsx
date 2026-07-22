"use client";

import { useEffect, useState } from "react";

// RADAR ⇄ STEALTH. Radar is the AA default everyone gets; Stealth restores
// the original low-glow whisper terminal for operators who choose it — and
// says so plainly. The vibe is a reward, never a toll.
export function ContrastToggle() {
  const [stealth, setStealth] = useState(false);

  useEffect(() => {
    try {
      setStealth(localStorage.getItem("lb-contrast") === "stealth");
    } catch {}
  }, []);

  const flip = () => {
    const next = !stealth;
    setStealth(next);
    const root = document.documentElement;
    if (next) root.dataset.contrast = "stealth";
    else delete root.dataset.contrast;
    try {
      if (next) localStorage.setItem("lb-contrast", "stealth");
      else localStorage.removeItem("lb-contrast");
    } catch {}
  };

  return (
    <button
      onClick={flip}
      aria-pressed={stealth}
      title={
        stealth
          ? "STEALTH: the original low-glow terminal — sub-AA contrast, by your choice. Click for RADAR."
          : "RADAR: full-contrast reading mode (WCAG AA). Click for STEALTH, the low-glow terminal."
      }
      className="inline-flex items-center gap-1.5 border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-dim transition-colors hover:border-fg-dim hover:text-fg"
    >
      <span className={`size-1 rounded-full ${stealth ? "bg-amber" : "bg-bull"}`} />
      {stealth ? "stealth" : "radar"}
    </button>
  );
}

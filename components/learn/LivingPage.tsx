"use client";

// THE LIVING PAGE (/learn L2). Sets --learn-vix (0..1) on the document root
// from the live VIX. It drove the scanline grain behind the Desk; that layer
// went in the calm pass (S1, 2026-11-09), so nothing reads the value now.
// Reuses the same /api/quote-batch feed and the same clamp the WONK type axis
// uses (lib/wonk). Renders nothing; polls on its own 60s interval (decoration
// data, separate from the ambient clock by design).

import { useEffect } from "react";

export function LivingPage() {
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const r = await fetch("/api/quote-batch?symbols=^VIX");
        const j = await r.json();
        const vix = j?.quotes?.find((q: { sym: string; last: number }) => q.sym === "^VIX")?.last;
        if (alive && typeof vix === "number") {
          const v = Math.min(1, Math.max(0, (vix - 12) / 28)); // same map as wonkFromVix, unquantized
          document.documentElement.style.setProperty("--learn-vix", v.toFixed(3));
          document.documentElement.style.setProperty("--learn-vix-raw", vix.toFixed(1));
        }
      } catch {
        /* keep the last value on a transient miss */
      }
    };
    pull();
    const id = setInterval(pull, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return null;
}

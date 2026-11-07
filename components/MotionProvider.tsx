"use client";

import { MotionConfig } from "motion/react";
import { useMotionPaused } from "@/lib/motion/bus";

/**
 * Motion honours the visitor's reduced-motion setting app-wide. There was no
 * MotionConfig anywhere before 2026-11, so every motion/react animation ran
 * regardless. Note: "user" only neutralises transform and position keys; an
 * opacity loop still needs its own useReducedMotion() guard (see RiskWizard).
 * The site's motion pause (lib/motion/bus.ts) counts as reduced motion too.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const paused = useMotionPaused();
  return <MotionConfig reducedMotion={paused ? "always" : "user"}>{children}</MotionConfig>;
}

"use client";

import { MotionConfig } from "motion/react";

/**
 * Motion honours the visitor's reduced-motion setting app-wide. There was no
 * MotionConfig anywhere before 2026-11, so every motion/react animation ran
 * regardless. Note: "user" only neutralises transform and position keys; an
 * opacity loop still needs its own useReducedMotion() guard (see RiskWizard).
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

// The brand ramp for HEIGHT, and only height (plan A5, Stage 3, rule 3): a
// value on a surface or in a heat strip, never shown without its legend bar.
// Since 2026-11-20 it is the site's one green (the owner moved the whole
// brand from violet to a neon-to-dark green), a single-hue ramp.
//
// Each theme has its own ramp, ordered so the highest value stands out most
// from that theme's page: on dark it climbs from a deep green to the neon;
// on light it flips, a mid-green floor to a near-black green crest. Pale
// greens could not be the light floor: they fall under 2.2:1 on paper.
//
// The steps are mixed in OKLab and published as CSS tokens (--viz-ramp-0 to
// --viz-ramp-8 in globals.css), so a figure follows the theme with no
// JavaScript. __tests__/viz.test.ts recomputes them from here and fails if
// the CSS drifts or a stop change breaks the lightness checks.

import { mixOklab } from "./color";

export type VizTheme = "dark" | "light";

export const RAMP_STOPS: Record<VizTheme, [string, string, string]> = {
  dark: ["#008044", "#00BC60", "#00FF87"],
  light: ["#36AE73", "#007942", "#003F20"],
};

/** The ground each ramp is judged against. */
export const RAMP_GROUND: Record<VizTheme, string> = { dark: "#050505", light: "#F7F6F0" };

/** How many discrete steps the CSS tokens carry. */
export const RAMP_STEPS = 9;

/** The colour at t in [0, 1] on a theme's ramp. */
export function rampColor(theme: VizTheme, t: number): string {
  const [a, b, c] = RAMP_STOPS[theme];
  const x = Math.min(1, Math.max(0, t));
  return x <= 0.5 ? mixOklab(a, b, x * 2) : mixOklab(b, c, (x - 0.5) * 2);
}

/** The discrete steps behind the CSS tokens. */
export function rampSteps(theme: VizTheme, n = RAMP_STEPS): string[] {
  return Array.from({ length: n }, (_, i) => rampColor(theme, i / (n - 1)));
}

/** A height in [0, 1] as the CSS token of its step. */
export function rampVar(t: number): string {
  const i = Math.round(Math.min(1, Math.max(0, t)) * (RAMP_STEPS - 1));
  return `var(--viz-ramp-${i})`;
}

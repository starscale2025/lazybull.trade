import { z } from "zod";

// Scroll-cinema timeline math. Pure functions, no DOM.
// Act boundaries MUST match PHASES in scripts/cinema/scene.html.
// Spec: docs/superpowers/specs/2026-07-03-scroll-cinema-homepage-design.md

export type Act = "boot" | "assembly" | "dive" | "bull" | "flash" | "handoff";

export const ACTS: Record<Act, { from: number; to: number }> = {
  boot: { from: 0, to: 0.12 },
  assembly: { from: 0.12, to: 0.32 },
  dive: { from: 0.32, to: 0.58 },
  bull: { from: 0.58, to: 0.8 },
  flash: { from: 0.8, to: 0.92 },
  handoff: { from: 0.92, to: 1 },
};

export type CopyBeat = {
  id: string;
  /** Scroll-progress window in which this beat is visible. */
  from: number;
  to: number;
  heading: string;
  sub?: string;
};

export const COPY_BEATS: CopyBeat[] = [
  { id: "boot", from: 0.02, to: 0.11, heading: "lazybull.trade", sub: "options, without the fog" },
  { id: "assembly", from: 0.15, to: 0.3, heading: "One terminal. Every tool." },
  { id: "dive-1", from: 0.34, to: 0.44, heading: "27 bots · 13 models · 8 live demos" },
  { id: "dive-2", from: 0.46, to: 0.56, heading: "0.4ms pricing engine", sub: "$100K paper account" },
  { id: "bull", from: 0.6, to: 0.78, heading: "Learn it. Backtest it.", sub: "Only then trade it." },
];

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Map scroll progress [0,1] to a frame index [0, frameCount-1]. */
export function progressToFrame(progress: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  const p = clamp01(progress);
  return Math.min(frameCount - 1, Math.floor(p * frameCount));
}

/**
 * Opacity for a copy beat: 0 at/outside [from,to], linear ramp over `fade`
 * inside each edge, plateau of 1 between the ramps.
 */
export function beatOpacity(
  progress: number,
  beat: Pick<CopyBeat, "from" | "to">,
  fade = 0.03
): number {
  const p = clamp01(progress);
  if (p <= beat.from || p >= beat.to) return 0;
  const f = Math.min(fade, (beat.to - beat.from) / 2);
  if (f <= 0) return 1;
  return Math.min(1, (p - beat.from) / f, (beat.to - p) / f);
}

/** Green-flash overlay opacity: triangle over the flash act, peak mid-act. */
export function flashOpacity(progress: number): number {
  const { from, to } = ACTS.flash;
  const p = clamp01(progress);
  if (p <= from || p >= to) return 0;
  const mid = (from + to) / 2;
  return p < mid ? (p - from) / (mid - from) : (to - p) / (to - mid);
}

// The canvas holds opaque almost to the very end: the final frames already
// show the homepage (resolved from the Matrix rain), so the gap above the
// rising real <Hero> stays hidden until the pin releases with the Hero at
// top:0. Only a 2% crossfade at the very end blends baked -> live.
const HANDOFF_FADE = { from: 0.98, to: 1.0 };

/** Whole-cinema opacity: ~1 throughout, a short crossfade to 0 at the very end. */
export function canvasOpacity(progress: number): number {
  const { from, to } = HANDOFF_FADE;
  const p = clamp01(progress);
  if (p <= from) return 1;
  if (p >= to) return 0;
  return 1 - (p - from) / (to - from);
}

const frameSetSchema = z.object({
  dir: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frameCount: z.number().int().positive(),
});

export const manifestSchema = z.object({
  desktop: frameSetSchema,
  mobile: frameSetSchema,
});

export type FrameSet = z.infer<typeof frameSetSchema>;
export type CinemaManifest = z.infer<typeof manifestSchema>;

/** Frame files are 1-based: frame_0001.webp … frame_NNNN.webp. */
export function frameUrl(dir: string, index: number): string {
  return `${dir}/frame_${String(index + 1).padStart(4, "0")}.webp`;
}

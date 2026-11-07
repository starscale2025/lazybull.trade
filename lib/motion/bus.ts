import { useSyncExternalStore } from "react";

/**
 * THE MOTION BUS (2026-11, THE MATTER plan §4.5).
 *
 * The page's motion state in one place. LenisRoot writes the scroll half once
 * per frame from GSAP's ticker, and a pointer listener writes the pointer.
 * Frame loops read `motion` directly: no React state, no per-frame events.
 * CSS readers (the tape lean, the type wonk) arrive in Phase 2, and the custom
 * property mirror lands with them, so no frame pays to write variables that
 * nothing reads.
 *
 * PAUSE is the site's control for motion that runs by itself (WCAG 2.2.2).
 * The footer's motion toggle and the ⌘K deck flip it, and it is remembered per
 * visitor. While paused:
 * - html[data-motion="paused"] ends every CSS animation (globals.css),
 * - Lenis scrolls 1:1,
 * - motion/react behaves as it does for reduced motion (MotionProvider),
 * - the hero's matter holds its last frame.
 * The film's own ambient motion joins in Phase 4, when its layers move onto
 * the single ticker (THE MATTER plan, M31).
 */
export const motion = {
  /** Page scroll, in px. */
  scroll: 0,
  /** 0..1 through the page. */
  progress: 0,
  /** Px per frame, signed; 0 at rest. */
  velocity: 0,
  direction: 0 as -1 | 0 | 1,
  /** -1 (left) .. 1 (right) across the viewport. */
  pointerX: 0,
  /** -1 (bottom) .. 1 (top) across the viewport. */
  pointerY: 0,
};

const KEY = "lb-motion";
let paused = false;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  try {
    paused = globalThis.localStorage?.getItem(KEY) === "paused";
  } catch {}
}

function reflect() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (paused) root.dataset.motion = "paused";
  else delete root.dataset.motion;
}

/** Read the visitor's stored choice and put it on <html>. Called once, on mount. */
export function initMotionPause() {
  load();
  reflect();
}

export function isMotionPaused(): boolean {
  load();
  return paused;
}

export function setMotionPaused(next: boolean) {
  load();
  if (paused === next) return;
  paused = next;
  try {
    if (next) globalThis.localStorage?.setItem(KEY, "paused");
    else globalThis.localStorage?.removeItem(KEY);
  } catch {}
  reflect();
  for (const fn of listeners) fn();
}

export function onMotionPausedChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** The pause as React state, for controls and providers. Server render: not paused. */
export function useMotionPaused(): boolean {
  return useSyncExternalStore(onMotionPausedChange, isMotionPaused, () => false);
}

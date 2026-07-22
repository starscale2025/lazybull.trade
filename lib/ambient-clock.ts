"use client";

// ONE AMBIENT CLOCK for every decorative animation on the site.
//
// The audit found four immortal pendulum rAFs simulating physics for offscreen
// footer chips, a per-frame getBoundingClientRect loop that never slept, and
// dozens of setState-per-frame scramblers stacking React commits. Each was its
// own rogue clock. This is the one shared ticker they all ride:
//
//   • runs ONLY while it has subscribers AND the tab is visible
//   • document.hidden freezes it — and on resume it does NOT integrate the
//     hidden gap (last = 0), so you return to a snapshot, never a jittery
//     replay that fast-forwards through the time you were away
//   • subscribers gate themselves on viewport with useInView, so a card that
//     scrolled offscreen stops costing anything
//
// Data polling (quotes, sync) lives on its own setInterval and is deliberately
// NOT on this clock — the market keeps moving while decoration sleeps.

import { useEffect, useRef, useState, type RefObject } from "react";

type FrameCb = (now: number, dt: number) => void;

const subs = new Set<FrameCb>();
let raf = 0;
let last = 0;
let hidden = false;

function loop(now: number) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  for (const cb of subs) cb(now, dt);
  raf = subs.size && !hidden ? requestAnimationFrame(loop) : 0;
}

function ensureRunning() {
  if (!raf && subs.size && !hidden) {
    last = 0; // fresh dt baseline; never replay a gap
    raf = requestAnimationFrame(loop);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    if (hidden) {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    } else {
      ensureRunning();
    }
  });
}

/** Subscribe a raw frame callback. Returns an unsubscribe. */
export function subscribeFrame(cb: FrameCb): () => void {
  subs.add(cb);
  ensureRunning();
  return () => {
    subs.delete(cb);
  };
}

/** Ride the shared clock while `enabled`. The callback is kept in a ref so a
    changing closure never forces a resubscribe. */
export function useAmbientFrame(cb: FrameCb, enabled = true): void {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    if (!enabled) return;
    return subscribeFrame((now, dt) => cbRef.current(now, dt));
  }, [enabled]);
}

/** Is this element in (or near) the viewport? One re-render on enter/exit —
    the gate for viewport-scoped ambient motion. */
export function useInView(ref: RefObject<Element | null>, rootMargin = "0px"): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);
  return inView;
}

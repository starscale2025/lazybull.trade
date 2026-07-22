"use client";

// The reel technique: a pinned viewport whose "video" is scrubbed by scroll.
// Implemented as a canvas frame-sequence (seeking <video> stutters; canvas is
// the industry standard — Apple product pages, award scroll films).
//
// - The section is `height` tall; the canvas sticks for the whole distance and
//   scroll progress picks the frame. Damped so fast flicks glide, not strobe.
// - Frames lazy-load when the section approaches (2 viewports out): the frame
//   grid loads in passes (every 8th, every 4th, ...) so a partial download
//   still scrubs coarsely instead of hanging on frame 0.
// - Reduced motion (or canvas failure) renders the poster still instead.
//
// Overlay children receive the live progress via --scrub CSS var on the
// wrapper, and beat helpers can fade copy in/out per progress range.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { subscribeFrame } from "@/lib/ambient-clock";

export function scrubFrameSrc(base: string, i: number) {
  return `${base}/f-${String(i).padStart(3, "0")}.webp`;
}

// Load order that fills coarse-to-fine: every 8th frame, then 4th, 2nd, rest.
export function loadOrder(count: number): number[] {
  const seen = new Set<number>();
  const order: number[] = [];
  for (const step of [8, 4, 2, 1]) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  return order;
}

export function ScrollScrub({
  base,
  frameCount,
  poster,
  posterAlt = "",
  height = "260vh",
  className = "",
  children,
}: {
  /** frames live at `${base}/f-000.webp` … */
  base: string;
  frameCount: number;
  /** static fallback + first paint */
  poster: string;
  posterAlt?: string;
  /** total scroll distance (CSS height of the outer section) */
  height?: string;
  className?: string;
  /** overlay content; use `--scrub` (0..1) for progress-driven styles */
  children?: ReactNode;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      return;
    }
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setReduced(true);
      return;
    }

    const frames: (HTMLImageElement | null)[] = Array(frameCount).fill(null);
    let started = false;
    let disposed = false;
    let unsubTick: (() => void) | null = null;
    let target = 0;
    let current = -1; // force first draw
    let drawnIdx = -1;

    const draw = (idx: number) => {
      // nearest loaded frame at-or-below idx, else nearest above
      let img: HTMLImageElement | null = null;
      for (let i = idx; i >= 0; i--) {
        if (frames[i]) {
          img = frames[i];
          break;
        }
      }
      if (!img) {
        for (let i = idx + 1; i < frameCount; i++) {
          if (frames[i]) {
            img = frames[i];
            break;
          }
        }
      }
      if (!img) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      // object-fit: cover
      const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * s;
      const dh = img.naturalHeight * s;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };

    const startLoading = () => {
      if (started) return;
      started = true;
      const order = loadOrder(frameCount);
      let cursor = 0;
      const CONCURRENCY = 6;
      const next = () => {
        if (disposed || cursor >= order.length) return;
        const i = order[cursor++];
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          frames[i] = img;
          if (Math.abs(i - Math.round(target * (frameCount - 1))) < 2) current = -1; // redraw
          next();
        };
        img.onerror = () => next();
        img.src = scrubFrameSrc(base, i);
      };
      for (let k = 0; k < CONCURRENCY; k++) next();
    };

    const tick = () => {
      if (disposed) return;
      const rect = section.getBoundingClientRect();
      const range = rect.height - window.innerHeight;
      target = range > 0 ? Math.min(1, Math.max(0, -rect.top / range)) : 0;
      current = current < 0 ? target : current + (target - current) * 0.16;
      const idx = Math.round(current * (frameCount - 1));
      if (idx !== drawnIdx) {
        drawnIdx = idx;
        draw(idx);
      }
      section.style.setProperty("--scrub", current.toFixed(4));
    };

    // The tick used to be a permanent rAF from mount — a getBoundingClientRect
    // + CSS-var write every frame for the life of the page even when the
    // section was nowhere near the viewport. Now the SAME IntersectionObserver
    // that triggers loading also gates the tick: it rides the shared ambient
    // clock only while the section is on/near screen (and freezes with the
    // tab), then unsubscribes.
    const io = new IntersectionObserver(
      (entries) => {
        const onScreen = entries.some((e) => e.isIntersecting);
        if (onScreen) {
          startLoading();
          if (!unsubTick) unsubTick = subscribeFrame(tick);
        } else if (unsubTick) {
          unsubTick();
          unsubTick = null;
        }
      },
      { rootMargin: "200% 0px" }
    );
    io.observe(section);

    return () => {
      disposed = true;
      unsubTick?.();
      io.disconnect();
    };
  }, [base, frameCount]);

  return (
    <section ref={sectionRef} className={`relative ${className}`} style={{ height }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {reduced ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={posterAlt} className="h-full w-full object-cover" />
        ) : (
          <canvas ref={canvasRef} className="h-full w-full" aria-label={posterAlt} role="img" />
        )}
        {children}
      </div>
    </section>
  );
}

/** Overlay copy that lives between two progress points, fading at the edges. */
export function ScrubBeat({
  from,
  to,
  children,
  className = "",
}: {
  from: number;
  to: number;
  children: ReactNode;
  className?: string;
}) {
  const mid = 0.12 * (to - from);
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center ${className}`}
      style={{
        opacity: `clamp(0, min(calc((var(--scrub, 0) - ${from}) / ${mid}), calc((${to} - var(--scrub, 0)) / ${mid})), 1)`,
      }}
    >
      {children}
    </div>
  );
}

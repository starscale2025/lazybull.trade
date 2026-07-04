"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ACTS, COPY_BEATS, beatOpacity, canvasOpacity, flashOpacity } from "@/lib/cinema";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const SCROLL_LENGTH_VH = 1000; // long pin: room for the expanded feature acts to read

// Distinct app-screen shots the scene composites (panels + the reveal hero).
const SHOT_NAMES = ["home", "learn", "trade", "quant", "pro", "chain", "bots", "about", "hero"];
const SHOTS = Object.fromEntries(SHOT_NAMES.map((n) => [n, `/cinema/shots/${n}.webp`]));

type SceneWindow = Window & {
  initScene?: (cfg: {
    shots: Record<string, string>;
    phases: Record<string, { from: number; to: number }>;
    bullFrames: string[] | null;
  }) => Promise<unknown>;
  renderAt?: (t: number) => void;
};

export function ScrollCinema() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  // "cinema" until proven otherwise; flips to static for reduced-motion or load failure
  const [mode, setMode] = useState<"cinema" | "static">("cinema");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode("static");
      return;
    }
    const section = sectionRef.current;
    const iframe = frameRef.current;
    if (!section || !iframe) return;

    // Start every load at the top so the intro plays from the beginning (and a
    // reload while past the cinema doesn't restore into a collapsed layout).
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";

    let disposed = false;
    let started = false;
    let ready = false;
    let st: ScrollTrigger | null = null;
    let raf = 0;
    let progress = 0; // smoothed value that drives the scene
    let targetProgress = 0; // raw scroll position
    let resizeTimer = 0;
    let collapsed = false;

    const win = () => iframe.contentWindow as SceneWindow | null;

    // Play-once: after the user scrolls all the way through onto the homepage,
    // remove the cinema from the layout (compensating scroll so nothing jumps)
    // so it can't be scrolled back into. The intro plays a single time.
    const collapse = () => {
      if (collapsed || disposed) return;
      collapsed = true;
      progress = 1;
      renderScene();
      applyOverlays();
      st?.kill();
      if (raf) cancelAnimationFrame(raf);
      // Anchor on the Hero: note where it sits now, remove the cinema, then
      // shift scroll by exactly how far the Hero moved so nothing visibly jumps.
      // Disable native scroll-anchoring so only our shift moves the scroll, and
      // re-assert on the next frame in case anything clobbered it mid-update.
      const hero = section.nextElementSibling as HTMLElement | null;
      const rootStyle = document.documentElement.style;
      const prevAnchor = rootStyle.overflowAnchor;
      rootStyle.overflowAnchor = "none";
      const before = hero ? hero.getBoundingClientRect().top : 0;
      section.style.display = "none";
      const keepHeroInPlace = () => {
        if (!hero) return;
        const delta = hero.getBoundingClientRect().top - before;
        if (Math.abs(delta) > 1) window.scrollBy(0, delta);
      };
      keepHeroInPlace();
      requestAnimationFrame(() => {
        keepHeroInPlace();
        rootStyle.overflowAnchor = prevAnchor;
      });
    };

    const applyOverlays = () => {
      if (stickyRef.current) stickyRef.current.style.opacity = String(canvasOpacity(progress));
      // faint bloom only — the scene's Matrix rain is the real green transition
      if (flashRef.current) flashRef.current.style.opacity = String(flashOpacity(progress) * 0.18);
      COPY_BEATS.forEach((beat, i) => {
        const el = copyRefs.current[i];
        if (!el) return;
        const o = beatOpacity(progress, beat);
        el.style.opacity = String(o);
        el.style.transform = `translate(-50%, calc(-50% + ${((1 - o) * 14).toFixed(2)}px))`;
      });
    };

    const renderScene = () => {
      if (ready) win()?.renderAt?.(progress);
    };

    // Smooth scrub: ease progress toward the scroll position each frame. Because
    // the scene renders LIVE (a pure function of t), every in-between value draws
    // a real frame — so it's fluid at 60fps at any scroll speed, not stepped.
    const SMOOTH = 0.12; // lower = glidier, higher = tighter to the scroll
    const loop = () => {
      const diff = targetProgress - progress;
      if (Math.abs(diff) < 0.0002) {
        progress = targetProgress;
        renderScene();
        applyOverlays();
        raf = 0;
        return;
      }
      progress += diff * SMOOTH;
      renderScene();
      applyOverlays();
      raf = requestAnimationFrame(loop);
    };

    const start = async () => {
      if (started || disposed) return;
      const w = win();
      if (!w?.initScene) return; // scene not loaded yet; onload will call again
      started = true;
      try {
        await w.initScene({ shots: SHOTS, phases: ACTS, bullFrames: null });
      } catch {
        if (!disposed) setMode("static");
        return;
      }
      if (disposed) return;
      ready = true;
      renderScene();
      applyOverlays();
      st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          targetProgress = self.progress;
          if (!raf) raf = requestAnimationFrame(loop);
        },
        onLeave: () => collapse(), // scrolled past the end onto the homepage → lock it out
      });
    };

    // The scene seeds particles/rain for a specific size; re-init on resize.
    const onResize = () => {
      if (!ready || collapsed) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        win()?.initScene?.({ shots: SHOTS, phases: ACTS, bullFrames: null }).then(renderScene);
      }, 160);
    };

    iframe.addEventListener("load", start);
    start(); // in case the iframe is already loaded
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      iframe.removeEventListener("load", start);
      window.removeEventListener("resize", onResize);
      st?.kill();
    };
  }, []);

  if (mode === "static") {
    // Reduced motion or scene unavailable: calm static hero, copy laid out plainly.
    return (
      <section data-cinema-static className="relative overflow-hidden border-b border-border bg-bg">
        <img
          src="/cinema/shots/hero.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-20"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div className="relative mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-24 text-center">
          {COPY_BEATS.map((b) => (
            <div key={b.id}>
              <div className="font-display text-3xl tracking-tightest text-fg md:text-4xl">{b.heading}</div>
              {b.sub && <div className="mt-2 font-mono text-sm text-fg-dim">{b.sub}</div>}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      data-cinema
      className="pointer-events-none relative z-20"
      style={{ height: `${SCROLL_LENGTH_VH}vh`, marginBottom: "-100vh" }}
    >
      {/* Backdrop lives on the sticky wrapper (which fades via canvasOpacity), NOT
          the section — otherwise the section's opaque bg stays over the real Hero
          in the -100vh overlap and the handoff reveals black instead of the page. */}
      <div ref={stickyRef} className="pointer-events-none sticky top-0 h-screen w-full overflow-hidden bg-bg">
        <iframe
          ref={frameRef}
          src="/cinema/scene.html"
          title=""
          aria-hidden
          tabIndex={-1}
          scrolling="no"
          className="pointer-events-none h-full w-full border-0"
        />
        {COPY_BEATS.map((b, i) => (
          <div
            key={b.id}
            ref={(el) => { copyRefs.current[i] = el; }}
            className="absolute left-1/2 top-1/2 w-[min(90vw,760px)] -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ opacity: 0 }}
          >
            <div className="font-display text-4xl tracking-tightest text-fg md:text-6xl">{b.heading}</div>
            {b.sub && <div className="mt-3 font-mono text-sm text-fg-dim md:text-base">{b.sub}</div>}
          </div>
        ))}
        <div ref={flashRef} className="absolute inset-0 bg-bull" style={{ opacity: 0 }} />
        <noscript>
          <img src="/cinema/shots/hero.webp" alt="LazyBull — options, without the fog" className="absolute inset-0 h-full w-full object-cover" />
        </noscript>
      </div>
    </section>
  );
}

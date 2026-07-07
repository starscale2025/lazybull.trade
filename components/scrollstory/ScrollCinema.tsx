"use client";

import { useEffect, useRef, useState, lazy, Suspense } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ACTS, BULL3D, CANDLE3D, DIVE3D, COPY_BEATS, beatOpacity, bull3dOpacity, candle3dOpacity, dive3dOpacity, canvasOpacity, flashOpacity } from "@/lib/cinema";
import { cinemaClock } from "@/lib/cinema-clock";

// Lazy so three.js only loads for users who actually get the cinema (not the
// reduced-motion static fallback, and not until after first paint).
const Bull3D = lazy(() => import("./Bull3D"));
const CandleField3D = lazy(() => import("./CandleField3D"));
const Tunnel3D = lazy(() => import("./Tunnel3D"));

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const SCROLL_LENGTH_VH = 1400; // long pin: room for the expanded feature acts to read slowly

// Distinct app-screen shots the scene composites (panels + the reveal hero).
// "/" is now the cinema itself, so no "home" shot — panels use real product routes.
const SHOT_NAMES = ["learn", "trade", "quant", "pro", "chain", "bots", "about", "hero"];
const SHOTS = Object.fromEntries(SHOT_NAMES.map((n) => [n, `/cinema/shots/${n}.webp`]));

type SceneWindow = Window & {
  initScene?: (cfg: {
    shots: Record<string, string>;
    phases: Record<string, { from: number; to: number }>;
    bullFrames: string[] | null;
  }) => Promise<unknown>;
  // `hideBull` / `hideCandle` / `hideDive` (per frame) drop the matching 2D draw
  // once that 3D layer is live. `now` (seconds) drives ambient, always-on motion;
  // `cx`/`cy` (-1..1) drive the cursor spotlight.
  renderAt?: (
    t: number,
    hideBull?: boolean,
    hideCandle?: boolean,
    now?: number,
    cx?: number,
    cy?: number,
    hideDive?: boolean
  ) => void;
};

export function ScrollCinema() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const collapseRef = useRef<(() => void) | null>(null);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const bull3dWrapRef = useRef<HTMLDivElement>(null);
  const bull3dActiveRef = useRef(false);
  const bull3dReadyRef = useRef(false);
  const [bull3dActive, setBull3dActive] = useState(false);
  const candle3dWrapRef = useRef<HTMLDivElement>(null);
  const candle3dActiveRef = useRef(false);
  const candle3dReadyRef = useRef(false);
  const [candle3dActive, setCandle3dActive] = useState(false);
  const dive3dWrapRef = useRef<HTMLDivElement>(null);
  const dive3dActiveRef = useRef(false);
  const dive3dReadyRef = useRef(false);
  const [dive3dActive, setDive3dActive] = useState(false);

  const tooltipRef = useRef<HTMLDivElement>(null); // live price tag on candle hover

  // Preloader: scroll is locked and a loading screen shows until the scene, its
  // panel screenshots, three.js and the bull model are all loaded — then the
  // scroll animation is enabled. No more scrolling into half-loaded frames.
  const [loading, setLoading] = useState(true);
  const [loadPct, setLoadPct] = useState(8);
  const [reveal, setReveal] = useState(false);

  // Each 3D layer's WebGL context going live tells the 2D scene to drop its
  // matching draw (via the per-frame hide flags). Stays false if WebGL fails →
  // the 2D bull / candle chart remain as fallbacks.
  const handleBullReady = () => {
    bull3dReadyRef.current = true;
  };
  const handleCandleReady = () => {
    candle3dReadyRef.current = true;
  };
  const handleDiveReady = () => {
    dive3dReadyRef.current = true;
  };

  // Skip the intro: land at the end (Get Started at top via the -100vh overlap),
  // then run the same play-once collapse so it can't be scrolled back into. No
  // one is trapped in the long scroll.
  const handleSkip = () => {
    const s = sectionRef.current;
    if (!s) return;
    window.scrollTo(0, s.offsetTop + s.offsetHeight - window.innerHeight + 4);
    collapseRef.current?.();
  };
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

    // Lock scroll while the cinema preloads so the scroll animation only begins
    // once everything is ready (restored on reveal / on cleanup).
    const rootStyle = document.documentElement.style;
    const prevOverflow = rootStyle.overflow;
    rootStyle.overflow = "hidden";
    window.scrollTo(0, 0);

    let disposed = false;
    let ready = false;
    let st: ScrollTrigger | null = null;
    let raf = 0;
    let progress = 0; // smoothed value that drives the scene
    let targetProgress = 0; // raw scroll position
    let resizeTimer = 0;
    let collapsed = false;
    let creep = 0; // interval that eases the loading bar up during preload
    let onSceneLoad: (() => void) | null = null;
    let pxS = 0; // damped pointer for layered parallax
    let pyS = 0;

    // Normalized pointer (-1..1) shared with the 3D layers via the clock.
    const onPointer = (e: PointerEvent) => {
      cinemaClock.px = (e.clientX / window.innerWidth) * 2 - 1;
      cinemaClock.py = (e.clientY / window.innerHeight) * 2 - 1;
    };
    // Clicks become world events (shockwaves, the bull's snort) — but never steal
    // real UI interactions (skip button, nav).
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("button, a, input, [role=button]")) return;
      cinemaClock.click = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
        t: performance.now(),
      };
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });

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
        // Removing 1400vh invalidates every other ScrollTrigger's start/end
        // (e.g. the footer's data-gsap reveals) — recompute so they still fire.
        ScrollTrigger.refresh();
      });
    };
    collapseRef.current = collapse; // let the Skip button trigger the same collapse

    const applyOverlays = (now = 0) => {
      if (stickyRef.current) stickyRef.current.style.opacity = String(canvasOpacity(progress));
      // faint bloom only — the scene's Matrix rain is the real green transition
      if (flashRef.current) flashRef.current.style.opacity = String(flashOpacity(progress) * 0.18);
      if (skipRef.current) {
        const o = progress < 0.85 ? 1 : Math.max(0, 1 - (progress - 0.85) / 0.08);
        skipRef.current.style.opacity = String(o);
        skipRef.current.style.pointerEvents = o > 0.1 ? "auto" : "none";
      }
      // 3D layers: crossfade each layer's DOM opacity over the 2D scene, and turn
      // its WebGL frameloop on only near its window (a rare toggle, not per frame).
      const driveLayer = (
        wrap: React.RefObject<HTMLDivElement | null>,
        opacity: number,
        win: typeof BULL3D,
        activeRef: React.RefObject<boolean>,
        setActive: (v: boolean) => void
      ) => {
        if (wrap.current) {
          wrap.current.style.opacity = String(opacity);
          wrap.current.style.visibility = opacity > 0.001 ? "visible" : "hidden";
        }
        const near = progress > win.in0 - 0.04 && progress < win.out1 + 0.04;
        if (near !== activeRef.current) {
          activeRef.current = near;
          setActive(near);
        }
      };
      driveLayer(bull3dWrapRef, bull3dOpacity(progress), BULL3D, bull3dActiveRef, setBull3dActive);
      driveLayer(candle3dWrapRef, candle3dOpacity(progress), CANDLE3D, candle3dActiveRef, setCandle3dActive);
      driveLayer(dive3dWrapRef, dive3dOpacity(progress), DIVE3D, dive3dActiveRef, setDive3dActive);
      COPY_BEATS.forEach((beat, i) => {
        const el = copyRefs.current[i];
        if (!el) return;
        const o = beatOpacity(progress, beat);
        el.style.opacity = String(o);
        // per-character stagger plays while the beat is on-window
        el.classList.toggle("beat-in", o > 0.1);
        // "top" beats anchor at their top edge (upper third); others center. The
        // type layer parallaxes harder than the scene → real depth.
        const baseY = beat.pos === "top" ? "0px" : "-50%";
        el.style.transform = `translate(calc(-50% + ${(pxS * -16).toFixed(1)}px), calc(${baseY} + ${((1 - o) * 14).toFixed(2)}px + ${(pyS * -10).toFixed(1)}px))`;
      });
      // Layered cursor parallax: the whole composited scene drifts gently against
      // the pointer (scaled up a hair so edges never peek in). During the matrix
      // burst the whole frame GLITCH-SHAKES (deterministic sin jitter × flash).
      const fl = flashOpacity(progress);
      const jx = Math.sin(now * 67) * 5 * fl;
      const jy = Math.cos(now * 53) * 4 * fl;
      const t3 = `translate3d(${(pxS * -7 + jx).toFixed(2)}px, ${(pyS * -5 + jy).toFixed(2)}px, 0) scale(1.015)`;
      if (frameRef.current) frameRef.current.style.transform = t3;
      if (candle3dWrapRef.current) candle3dWrapRef.current.style.transform = t3;
      if (bull3dWrapRef.current) bull3dWrapRef.current.style.transform = t3;
      if (dive3dWrapRef.current) dive3dWrapRef.current.style.transform = t3;
    };

    const renderScene = (now = 0) => {
      cinemaClock.progress = progress; // shared clock the 3D layers read
      // Keep the 2D particle logo hidden until the 3D bull has FULLY faded out
      // (>= out1). Then the classic logo plays in full — assemble → scatter →
      // Matrix — with no overlap between the two differently-posed bulls.
      const hideBull = bull3dReadyRef.current && progress < BULL3D.out1;
      if (ready)
        win()?.renderAt?.(
          progress,
          hideBull,
          candle3dReadyRef.current,
          now,
          pxS,
          pyS,
          dive3dReadyRef.current
        );
    };

    // Persistent render loop: smooth-scrubs progress toward the scroll position
    // AND keeps ambient time flowing, so the scene breathes even at rest (drifting
    // rain, marching dashes, pointer parallax) instead of freezing between scrolls.
    const SMOOTH = 0.12; // lower = glidier, higher = tighter to the scroll
    const tick = (ts: number) => {
      if (disposed || collapsed) return;
      const now = ts / 1000;
      const diff = targetProgress - progress;
      progress = Math.abs(diff) < 0.0002 ? targetProgress : progress + diff * SMOOTH;
      pxS += (cinemaClock.px - pxS) * 0.055;
      pyS += (cinemaClock.py - pyS) * 0.055;
      // damped scroll velocity → the 3D cameras kick their FOV when you scroll hard
      cinemaClock.vel += (Math.min(1, Math.abs(diff) * 14) - cinemaClock.vel) * 0.08;
      renderScene(now);
      applyOverlays(now);
      // interaction chrome: candle tooltip + the lagging cursor ring
      const hov = cinemaClock.hover;
      if (tooltipRef.current) {
        const el = tooltipRef.current;
        if (hov) {
          el.style.opacity = "1";
          el.style.transform = `translate(${(hov.sx + 14).toFixed(0)}px, ${(hov.sy - 40).toFixed(0)}px)`;
          el.style.borderColor = hov.up ? "rgba(0,255,135,0.55)" : "rgba(255,46,99,0.55)";
          const [l, p] = [el.children[0] as HTMLElement, el.children[1] as HTMLElement];
          if (l) l.textContent = hov.label;
          if (p) {
            p.textContent = hov.pct;
            p.style.color = hov.up ? "#00ff87" : "#ff2e63";
          }
        } else {
          el.style.opacity = "0";
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const createScrollTrigger = () => {
      st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          targetProgress = self.progress;
        },
        onLeave: () => collapse(), // scrolled past the end onto the homepage → lock it out
      });
      raf = requestAnimationFrame(tick); // the always-on loop starts with the scroll
    };

    // ---- preload: scene + panel shots, then three.js + the bull model ----
    const shotsLoaded = new Promise<void>((resolve, reject) => {
      let done = false;
      const run = async () => {
        if (done || disposed) return;
        const w = win();
        if (!w?.initScene) return; // iframe not ready yet; the load listener retries
        done = true;
        try {
          await w.initScene({ shots: SHOTS, phases: ACTS, bullFrames: null });
          ready = true;
          renderScene();
          applyOverlays();
          resolve();
        } catch {
          reject(new Error("scene"));
        }
      };
      onSceneLoad = run;
      iframe.addEventListener("load", run);
      run(); // in case the iframe is already loaded
    });
    // three.js chunks + the bull GLB (non-fatal — the 2D fallbacks cover failures).
    const extras = Promise.allSettled([
      import("./Bull3D"),
      import("./CandleField3D"),
      import("./Tunnel3D"),
      fetch("/models/bull.glb").then((r) => r.arrayBuffer()),
    ]);
    const minTime = new Promise((r) => window.setTimeout(r, 650)); // don't flash the loader

    creep = window.setInterval(() => setLoadPct((p) => (p < 90 ? p + 2 : p)), 120);

    let settled = false;
    const reveal = () => {
      if (settled || disposed) return;
      settled = true;
      window.clearInterval(creep);
      setLoadPct(100);
      window.setTimeout(() => {
        if (disposed) return;
        rootStyle.overflow = prevOverflow; // unlock scroll
        createScrollTrigger(); // enable the scroll animation
        setReveal(true); // fade the loading screen out
        window.setTimeout(() => { if (!disposed) setLoading(false); }, 550);
      }, 420);
    };
    Promise.all([shotsLoaded, extras, minTime]).then(reveal).catch(() => {
      if (settled || disposed) return;
      settled = true;
      window.clearInterval(creep);
      rootStyle.overflow = prevOverflow;
      setMode("static");
    });
    window.setTimeout(reveal, 15000); // safety: never trap the user behind a hung asset

    // The scene seeds particles/rain for a specific size; re-init on resize.
    const onResize = () => {
      if (!ready || collapsed) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        win()?.initScene?.({ shots: SHOTS, phases: ACTS, bullFrames: null }).then(() => renderScene());
      }, 160);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.clearInterval(creep);
      rootStyle.overflow = prevOverflow; // never leave scroll locked
      if (onSceneLoad) iframe.removeEventListener("load", onSceneLoad);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onDown);
      st?.kill();
    };
  }, []);

  // Headings render as per-word/per-char spans so each character can blur-rise
  // in with a stagger when its beat opens (scrub-safe: the container opacity is
  // still driven numerically every frame).
  const renderChars = (text: string) => {
    let k = 0;
    const words = text.split(" ");
    return words.map((w, wi) => (
      <span key={wi} className="beat-word">
        {Array.from(w).map((c) => {
          const i = k++;
          return (
            <span key={i} className="beat-char" style={{ "--i": i } as React.CSSProperties}>
              {c}
            </span>
          );
        })}
        {wi < words.length - 1 ? " " : ""}
      </span>
    ));
  };

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
          {/* Curated subset — the motion-only bookends (boot/welcome) and the second
              candle beat would make a static vertical list too long. */}
          {COPY_BEATS.filter((b) => !["boot", "welcome", "candle-vindication"].includes(b.id)).map((b) => (
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
    <>
      {loading && (
        <div
          aria-hidden
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-7 bg-bg transition-opacity duration-500 ease-out"
          style={{ opacity: reveal ? 0 : 1, pointerEvents: reveal ? "none" : "auto" }}
        >
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-[0.14]" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(ellipse at center, rgba(0,255,135,0.06), transparent 62%)" }}
          />
          <div className="relative flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center bg-bull font-mono text-[13px] font-bold tracking-tight text-bg">
              LB
            </span>
            <span className="font-display text-3xl tracking-tight text-fg">
              lazybull<span className="text-bull">.</span>
            </span>
          </div>
          <div className="relative h-px w-[260px] overflow-hidden bg-border">
            <div
              className="h-full bg-bull transition-[width] duration-300 ease-out"
              style={{ width: `${loadPct}%`, boxShadow: "0 0 12px rgba(0,255,135,0.7)" }}
            />
          </div>
          <div className="relative flex w-[260px] items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-fg-faint">
            <span className="flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-bull pulse-dot" /> Initializing terminal
            </span>
            <span className="tabular-nums text-bull/90">{Math.round(loadPct)}%</span>
          </div>
        </div>
      )}
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
        {/* Real-3D layers, each crossfaded over the 2D scene across its act. They
            sit above the iframe, below the copy text; only one is visible at a time. */}
        <div
          ref={dive3dWrapRef}
          className="pointer-events-none absolute inset-0"
          style={{ opacity: 0, visibility: "hidden", background: "#050505" }}
        >
          <Suspense fallback={null}>
            <Tunnel3D active={dive3dActive} onReady={handleDiveReady} />
          </Suspense>
        </div>
        <div
          ref={candle3dWrapRef}
          className="pointer-events-none absolute inset-0"
          style={{ opacity: 0, visibility: "hidden", background: "#050505" }}
        >
          <Suspense fallback={null}>
            <CandleField3D active={candle3dActive} onReady={handleCandleReady} />
          </Suspense>
        </div>
        <div
          ref={bull3dWrapRef}
          className="pointer-events-none absolute inset-0"
          style={{ opacity: 0, visibility: "hidden", background: "#050505" }}
        >
          <Suspense fallback={null}>
            <Bull3D active={bull3dActive} onReady={handleBullReady} />
          </Suspense>
        </div>
        {/* film grain layer: scanlines + vignette unify the 2D and 3D acts */}
        <div className="pointer-events-none absolute inset-0 scanlines opacity-[0.13]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.62) 100%)" }}
        />
        {COPY_BEATS.map((b, i) => (
          <div
            key={b.id}
            ref={(el) => { copyRefs.current[i] = el; }}
            className="absolute left-1/2 -translate-x-1/2 text-center"
            style={{ top: b.pos === "top" ? "14%" : "50%", opacity: 0, width: "min(92vw, 680px)" }}
          >
            <div
              className="font-display text-3xl tracking-tightest text-balance text-fg md:text-5xl"
              style={{ textShadow: "0 0 36px rgba(0,255,135,0.16), 0 2px 22px rgba(0,0,0,0.85)" }}
            >
              {renderChars(b.heading)}
            </div>
            {b.sub && <div className="beat-sub mt-3 font-mono text-sm text-fg-dim md:text-base">{b.sub}</div>}
          </div>
        ))}
        {/* live price tag — follows the hovered 3D candle */}
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute left-0 top-0 z-30 flex items-center gap-2 border bg-black/85 px-2.5 py-1.5 font-mono text-[11px] backdrop-blur-sm transition-opacity duration-150"
          style={{ opacity: 0, borderColor: "rgba(0,255,135,0.5)" }}
        >
          <span className="text-fg" />
          <span />
        </div>
        <div ref={flashRef} className="absolute inset-0 bg-bull" style={{ opacity: 0 }} />
        <button
          ref={skipRef}
          type="button"
          onClick={handleSkip}
          className="pointer-events-auto absolute bottom-7 left-1/2 z-30 -translate-x-1/2 border border-border bg-bg/70 px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-fg-dim backdrop-blur transition-colors hover:border-bull/50 hover:text-fg"
        >
          Skip intro ↓
        </button>
        <noscript>
          <img src="/cinema/shots/hero.webp" alt="LazyBull — options, without the fog" className="absolute inset-0 h-full w-full object-cover" />
        </noscript>
        <style>{`
          .beat-word { display: inline-block; white-space: nowrap; }
          .beat-char {
            display: inline-block; opacity: 0;
            transform: translateY(0.55em) rotate(1.5deg); filter: blur(9px);
            transition: opacity .5s cubic-bezier(.22,.68,.26,1), transform .55s cubic-bezier(.22,.68,.26,1), filter .5s ease;
          }
          .beat-in .beat-char {
            opacity: 1; transform: none; filter: blur(0);
            transition-delay: calc(var(--i) * 24ms);
          }
          .beat-sub { opacity: 0; transform: translateY(10px); transition: opacity .6s ease, transform .6s ease; }
          .beat-in .beat-sub { opacity: 1; transform: none; transition-delay: 420ms; }
          @media (prefers-reduced-motion: reduce) {
            .beat-char, .beat-sub { transition: none; opacity: 1; transform: none; filter: none; }
          }
        `}</style>
      </div>
      </section>
    </>
  );
}

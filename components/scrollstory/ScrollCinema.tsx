"use client";

import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ACTS, BULL3D, CANDLE3D, DIVE3D, COPY_BEATS, beatCharT, beatOpacity, bull3dOpacity, candle3dOpacity, candleLabT, clamp01, dive3dOpacity, canvasOpacity, flashOpacity } from "@/lib/cinema";
import { cinemaClock } from "@/lib/cinema-clock";
import {
  cinemaAudioFrame,
  cinemaAudioEnabled,
  cinemaImpact,
  enableCinemaAudio,
  disableCinemaAudio,
  stopCinemaAudio,
} from "@/lib/cinema-audio";
import { CinemaRail, type CinemaRailHandle } from "./CinemaRail";
import { CinemaStill } from "./CinemaStill";
// Shared with CinemaGate, which reserves exactly this height on the first paint
// so mounting the film shifts nothing. See cinema-metrics.ts.
import { SCROLL_LENGTH_VH } from "./cinema-metrics";

// smoothstep — the phase ramps for the quant-lab type-on/colour narration, kept
// identical in shape to the 3D IceCandle's so the panel and candle read as one clock.
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Lazy so three.js only loads for users who actually get the cinema (not the
// reduced-motion static fallback, and not until after first paint) — but
// through ONE boundary (three-stage.ts): three separate lazy chunks used to
// duplicate the entire three.js graph, shipping WebGLRenderer twice.
const Bull3D = lazy(() => import("./three-stage").then((m) => ({ default: m.Bull3D })));
const CandleField3D = lazy(() => import("./three-stage").then((m) => ({ default: m.CandleField3D })));
const Tunnel3D = lazy(() => import("./three-stage").then((m) => ({ default: m.Tunnel3D })));

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Distinct app-screen shots the scene composites (panels + the reveal hero).
// "/" is now the cinema itself, so no "home" shot — panels use real product routes.
const SHOT_NAMES = ["learn", "trade", "quant", "pro", "chain", "bots", "about", "hero"];
const SHOTS = Object.fromEntries(SHOT_NAMES.map((n) => [n, `/cinema/shots/${n}.webp`]));

type SceneWindow = Window & {
  initScene?: (cfg: {
    shots: Record<string, string>;
    phases: Record<string, { from: number; to: number }>;
    bullFrames: string[] | null;
    /** The parent's RESOLVED design tokens — the scene keeps no palette of its own. */
    tokens?: Record<string, string>;
    /** The parent's own mono font-family, injected into the frame as @font-face. */
    mono?: string;
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

// Cheap, cached, non-throwing WebGL support probe. Tries webgl2 then webgl, and
// treats a thrown getContext (some privacy modes) as "no".
let webglSupport: boolean | null = null;
function hasWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const c = document.createElement("canvas");
    webglSupport = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

// The scene is a same-origin <iframe> with its own document, so it does not
// inherit the page's tokens or its webfonts. It used to hardcode a copy of both,
// and both had drifted: --bear was #ff5c5c against the site's #ff2e63, and every
// ctx.font asked for `ui-monospace`, i.e. the OS default — so the nine-act
// showpiece was typeset in a different face on every operating system.
//
// These read what the page ACTUALLY resolved and hand it over.
function resolvedTokens(): Record<string, string> {
  const cs = getComputedStyle(document.documentElement);
  const get = (n: string) => cs.getPropertyValue(n).trim();
  return {
    bg: get("--bg"), fg: get("--fg"), fgDim: get("--fg-dim"),
    bull: get("--bull"), bear: get("--bear"),
    cyan: get("--cyan"), amber: get("--amber"),
  };
}

/**
 * Copy the page's mono @font-face rules into the frame and return the family.
 *
 * next/font self-hosts under /_next/static/media, so these are same-origin and
 * the cinema CSP's `default-src 'self'` already covers them — no new origin, no
 * network request beyond one the page has made anyway, and nothing to add to
 * the policy. Returns null if the rules cannot be read (a cross-origin
 * stylesheet throws on .cssRules), in which case the scene keeps its fallback.
 *
 * THE URLS MUST BE ABSOLUTISED. cssText serialises `src:` AS AUTHORED, and Next
 * authors it relative: `url("../media/xxx.woff2")`. That is correct from the
 * stylesheet's own home at /_next/static/chunks/, and wrong the moment the rule
 * is copied into a document based at /cinema/scene.html, where it resolves to
 * /media/xxx.woff2 and 404s. The failure is silent — the family string returned
 * below carries ui-monospace as its fallback, so the scene just quietly drew in
 * the OS default, which is the exact regression this function exists to
 * prevent. Resolve every url() against the sheet it came from.
 */
/** Rewrite every url() in a CSS rule to an absolute URL against `base`. */
function absolutise(css: string, base: string): string {
  return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (whole, _q, raw: string) => {
    try {
      return `url("${new URL(raw, base).href}")`;
    } catch {
      return whole; // data: or something exotic — leave it exactly as it was
    }
  });
}

function injectMono(doc: Document): string | null {
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-jetbrains")
    .trim();
  if (!family) return null;
  const bare = family.replace(/['"]/g, "").split(",")[0].trim();
  const faces: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin sheet — not ours anyway
    }
    for (const rule of Array.from(rules)) {
      if (rule.constructor.name !== "CSSFontFaceRule") continue;
      const text = rule.cssText;
      if (text.includes(bare)) faces.push(absolutise(text, sheet.href ?? document.baseURI));
    }
  }
  if (!faces.length) return null;
  const style = doc.createElement("style");
  style.textContent = faces.join("\n");
  doc.head.appendChild(style);
  return `${family}, ui-monospace, SFMono-Regular, Menlo, monospace`;
}

// ── THE FILM'S MEMORY ────────────────────────────────────────────────────────
//
// Three keys, and each one now has a reader. They used to be written with a
// comment claiming "CinemaGate reads this" next to them; it did not, and a grep
// for either name found the two writes below and nothing else. So the film
// re-ran in full on every single load, including the reload you did because you
// were eight thousand pixels into it.
//
//   lb-cinema-seen        localStorage   played through, or skipped, at least
//                                        once on this device. STILL WRITTEN,
//                                        NO LONGER GATES: keying the intro on
//                                        it made the film a once-per-browser
//                                        event, so the site quietly lost its
//                                        opening for good. The gate reads the
//                                        session key below instead. Kept
//                                        because it is the honest record of
//                                        "has this person ever seen it", which
//                                        a future first-run tour would want.
//   lb-cinema-autoplayed  sessionStorage the film has already RUN in this tab →
//                                        same, but only for this tab, so a new
//                                        session gets the film back.
//   lb-cinema-resume      sessionStorage where in the film you were. Read only
//                                        below, and only after a reload.
//   lb-cinema-replay      sessionStorage you asked for the film (⌘K, or
//                                        GetStarted's "watch the film"). Read by
//                                        CinemaGate; CONSUMED here, the moment
//                                        the film actually starts.
//
// The consuming lives on this side on purpose. CinemaGate's decision is now a
// pure read, which is what lets it re-run freely — on a resize, on React's
// double-invoked effects in dev, and on a client-side navigation back to "/".
// When the gate consumed the flag itself it needed a module-level memo to
// survive those, and that memo then re-mounted the whole film on the trip back
// from /learn, which is the toll booth all of this exists to remove.
const SEEN_KEY = "lb-cinema-seen";
const AUTOPLAYED_KEY = "lb-cinema-autoplayed";
const RESUME_KEY = "lb-cinema-resume";
const REPLAY_KEY = "lb-cinema-replay";

/** Played through or skipped — never auto-play at them again. */
function markCinemaSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
    sessionStorage.setItem(AUTOPLAYED_KEY, "1");
    sessionStorage.removeItem(RESUME_KEY); // the film is over; there is no place to return to
    sessionStorage.removeItem(REPLAY_KEY); // and any request for it has been met
  } catch {
    /* storage blocked (private mode, third-party frame) — the film just replays */
  }
}

/**
 * Where in the film to come back to, or null to start at the top.
 *
 * ONLY A RELOAD RESUMES. A fresh navigation to "/" is someone arriving, and
 * dropping an arrival into act six because they once left a tab open mid-film
 * would be stranger than replaying it. `back_forward` counts too: that is the
 * back button landing on a page it already had.
 */
export function cinemaResumeAt(): number | null {
  try {
    // Someone who asked for the film wants the film, not the back half of it.
    if (sessionStorage.getItem(REPLAY_KEY) === "1") return null;
    const nav = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.type !== "reload" && nav?.type !== "back_forward") return null;
    const raw = sessionStorage.getItem(RESUME_KEY);
    if (raw === null) return null;
    const p = Number(raw);
    // Below 0.02 there is nothing worth restoring; above 0.97 the film is
    // already handing off, and resuming there would drop you into the seam.
    return Number.isFinite(p) && p > 0.02 && p < 0.97 ? p : null;
  } catch {
    return null;
  }
}

export function ScrollCinema() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<CinemaRailHandle>(null);
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
  // quant-lab panel (the candle act's finale): the terminal that "computes"
  // while the ice candle stretches — lines + live value spans driven per frame
  const labRef = useRef<HTMLDivElement>(null);
  const labLineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labValRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const labPhaseRef = useRef<HTMLSpanElement>(null); // header tag: scan → candidate → stress → staged
  // per-line char lengths, measured once — the type-on reveals `budget` chars
  // cumulatively across lines (monospace → 1ch/char), so it's pure f(labT).
  const labLenRef = useRef<number[] | null>(null);

  // Preloader: scroll is locked and a loading screen shows until the scene, its
  // panel screenshots, three.js and the bull model are all loaded — then the
  // scroll animation is enabled. No more scrolling into half-loaded frames.
  const [loading, setLoading] = useState(true);
  // After the play-once collapse, the heavy children UNMOUNT (React state, not
  // display:none) so R3F disposes all three WebGL contexts, composer targets
  // and GLB geometry — hiding the section used to pin tens of MB of GPU
  // memory under a display:none div for the life of the page.
  const [dead, setDead] = useState(false);
  const [loadPct, setLoadPct] = useState(8);
  // Sound is OFF until asked. See lib/cinema-audio.ts.
  const [sound, setSound] = useState(false);
  const [reveal, setReveal] = useState(false);
  // gate held >10s → show "still loading" + a skip-to-static choice (we never
  // auto-reveal a half-loaded scene; the user decides)
  const [slowLoad, setSlowLoad] = useState(false);
  const bailToStaticRef = useRef<(() => void) | null>(null);

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

  // Skip the intro: THE SHATTER — you break the fourth wall to get to the
  // desk. A portaled glass-crack burst plays over the reveal (it survives the
  // cinema's own unmount), then the same play-once collapse runs so the
  // intro can't be scrolled back into. Reduced-motion skips the theatrics.
  const [shatter, setShatter] = useState(false);
  const doSkip = () => {
    const s = sectionRef.current;
    if (!s) return;
    window.scrollTo(0, s.offsetTop + s.offsetHeight - window.innerHeight + 4);
    collapseRef.current?.();
  };
  const handleSkip = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doSkip();
      return;
    }
    // The glass gets a sound if sound is on (it no-ops otherwise). The collapse
    // stops the audio ~180ms later, so what you hear is a crack and then the
    // room being gone — which is what the picture is doing.
    cinemaImpact(0.8);
    setShatter(true);
    window.setTimeout(doSkip, 180); // glass cracks, then the page is simply there
    window.setTimeout(() => setShatter(false), 700);
  };
  // "cinema" until proven otherwise; flips to static for reduced-motion or load failure
  const [mode, setMode] = useState<"cinema" | "static">("cinema");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode("static");
      return;
    }
    // No WebGL, no film. Six of the nine acts are R3F, so without a context the
    // reader gets thousands of pixels of black plus nine uncaught
    // "THREE.WebGLRenderer: Error creating WebGL context" errors — measured, and
    // strictly WORSE than the no-JavaScript experience (3,341 chars of readable
    // page vs 5,135). The static path below already exists and is already proven
    // by the reduced-motion audience; it simply was never reached this way.
    //
    // Probe on a throwaway canvas rather than waiting for R3F to fail: by the
    // time onCreated would tell us, three canvases have already thrown.
    if (!hasWebGL()) {
      setMode("static");
      return;
    }
    const section = sectionRef.current;
    const iframe = frameRef.current;
    if (!section || !iframe) return;

    // We restore the scroll ourselves (see resumeAt below), so the browser must
    // not also try: its restore lands before the film has a ScrollTrigger and
    // fights the preloader's lock.
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    // Where a reload left off, resolved ONCE. Read here rather than at reveal
    // because the preloader is about to scroll to 0, which is the position we
    // would otherwise be reading back.
    const resumeAt = cinemaResumeAt();

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
    let onSceneError: (() => void) | null = null;
    let sceneTimeout = 0;
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
      // SILENCE FIRST. The next three lines slam progress to 1, and the audio
      // pass rides progress — so a skip from act five would cross the bull's
      // impact beat on the way out and detonate it into a black frame. Silence
      // past the last beat is the designed ending; this is also the only place
      // that gives the AudioContext back, because the component stays MOUNTED
      // behind display:none and nothing else would.
      stopCinemaAudio();
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
      // Played through (or skipped) once — never replay the toll booth. The
      // no-navbar IA sends every logo click back to "/", so without this flag
      // anonymous users re-entered the scroll-locked preloader every time.
      markCinemaSeen();
      requestAnimationFrame(() => {
        keepHeroInPlace();
        rootStyle.overflowAnchor = prevAnchor;
        // Removing 1400vh invalidates every other ScrollTrigger's start/end
        // (e.g. the footer's data-gsap reveals) — recompute so they still fire.
        ScrollTrigger.refresh();
        // Now that layout has settled, free the GPU: unmount canvases + iframe.
        setDead(true);
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
      // The act rail rides this same pass — no second rAF, no per-frame React
      // state next to three WebGL contexts. It writes styles directly and only
      // announces on an act CHANGE.
      railRef.current?.update(progress);
      // Sound rides the SAME progress the scene draws from, so picture and
      // sound cannot desync. No-ops entirely until the gate's SOUND ON is used.
      if (cinemaAudioEnabled()) cinemaAudioFrame(progress, cinemaClock.vel);
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
        // The per-character stagger is now a NUMBER written every frame, not a
        // class flip: the CSS below derives each glyph's own 0→1 from this and
        // its index, so the reveal is f(progress) and scrubs backwards exactly
        // like the lab type-on does. See beatCharT in lib/cinema.ts.
        el.style.setProperty("--t", beatCharT(progress, beat).toFixed(4));
        // "top" beats anchor at their top edge (upper third); others center. The
        // type layer parallaxes harder than the scene → real depth.
        const baseY = beat.pos === "top" ? "0px" : "-50%";
        el.style.transform = `translate(calc(-50% + ${(pxS * -16).toFixed(1)}px), calc(${baseY} + ${((1 - o) * 14).toFixed(2)}px + ${(pyS * -10).toFixed(1)}px))`;
      });
      // Quant-lab panel — the candle finale's left-hand brain. Lines highlight
      // one-by-one and the live values (μ, σ, agree, K) interpolate on the SAME
      // clock (candleLabT) that spins + stretches the ice candle, so the math
      // visibly computes in sync. In with the liftoff, out with the candle
      // layer's own fade. Pure f(progress) like everything else here.
      if (labRef.current) {
        const lt = candleLabT(progress);
        const o =
          lt <= 0
            ? 0
            : Math.min(
                1,
                lt / 0.1,
                Math.max(0, (CANDLE3D.out1 - progress) / (CANDLE3D.out1 - CANDLE3D.out0))
              );
        const el = labRef.current;
        el.style.opacity = String(o);
        el.style.visibility = o > 0.001 ? "visible" : "hidden";
        if (o > 0.001) {
          // phase ramps — SAME shape as the 3D IceCandle, so the panel narrates
          // exactly what the candle is doing: ice-scan → green candidate → red
          // stress → settle. Pure f(lt); scrubbing back un-types + un-colours.
          const B = ss(0.44, 0.62, lt); // candidate (green) emerges
          const C = ss(0.66, 0.84, lt); // downside stress (red)
          const RS = ss(0.88, 0.985, lt); // settle / verdict
          // TYPE-ON: reveal `budget` pixels cumulatively across the lines. Widths
          // are the lines' intrinsic scrollWidth (glyph-accurate even for →/≥/μ/σ,
          // which the mono stack renders wider than 1ch — a ch reveal clipped them).
          // Measured once (scrollWidth is the full content width even while the line
          // is clipped to width:0). Pure f(lt) so scrub reverses cleanly.
          if (!labLenRef.current || labLenRef.current[0] === 0) {
            labLenRef.current = labLineRefs.current.map((ln) => (ln ? ln.scrollWidth + 2 : 0));
          }
          const lens = labLenRef.current;
          const total = lens.reduce((a, b) => a + b, 0) || 1;
          let budget = clamp01((lt - 0.02) / 0.9) * total; // 0→fully typed by lt≈0.92
          labLineRefs.current.forEach((ln, i) => {
            if (!ln) return;
            const len = lens[i] || 0;
            const typed = Math.max(0, Math.min(len, budget));
            budget -= len;
            ln.style.width = typed.toFixed(1) + "px";
            const started = typed > 0.5;
            const done = typed >= len - 0.5;
            ln.style.opacity = started ? "1" : "0";
            ln.classList.toggle("lab-caret", started && !done); // blink only at the frontier
            // phase accents narrate the colour story on the key lines
            // (indices match the SIX-line panel: 2 candidate, 3-4 stress, 5 verdict):
            let glow = 0.28; // base cyan-ish scan glow once a line is in
            let rgb = "125,255,201";
            if (i === 2) { rgb = "0,255,135"; glow = 0.2 + 0.6 * B; }          // candidate → green in phase B
            else if (i === 3 || i === 4) { rgb = "255,46,99"; glow = 0.15 + 0.6 * C; } // stress → red in phase C
            else if (i === 5) { rgb = "0,255,135"; glow = 0.2 + 0.7 * Math.max(RS, lt > 0.9 ? 1 : 0); } // verdict → green at settle
            ln.style.textShadow = started ? `0 0 ${(8 + 14 * glow).toFixed(0)}px rgba(${rgb},${glow.toFixed(2)})` : "none";
          });
          // live values interpolate on the SAME clock; all fixed-width so the ch
          // reveal stays exact. agree climbs to 6/6 for the settled verdict.
          const ve = clamp01(lt / 0.85);
          const mu = (0.12 + 0.72 * ve).toFixed(2);
          const sg = (1.24 + 0.68 * ve).toFixed(2);
          const ag = String(1 + Math.round(4 * ve));
          const K = String(240 + 2 * Math.round(9 * ve));
          const ag6 = String(1 + Math.round(5 * ve));
          const vals = [mu, sg, ag, K, ag6];
          labValRefs.current.forEach((sp, i) => {
            if (sp) sp.textContent = vals[i];
          });
          // header tag + its colour follow the phase the candle is in
          if (labPhaseRef.current) {
            const ph =
              lt >= 0.86 ? ["staged", "#00ff87"] : C > 0.5 ? ["stress", "#ff2e63"] : B > 0.5 ? ["candidate", "#00ff87"] : ["scan", "#bfe8ff"];
            labPhaseRef.current.textContent = ph[0];
            labPhaseRef.current.style.color = ph[1];
          }
        }
      }
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
      // Un-hide the 2D particle logo at out0 — where the 3D bull STARTS fading,
      // not where it finishes. Releasing at out1 left 0.793–0.80 with nothing
      // drawn at all (bull wrapper ~0, grid 0 since 0.796, consensus dead since
      // 0.754, logo still gated): a measured black frame on the charge, the
      // film's climax. The two bulls do overlap for that 0.02, but the charge's
      // impact flash is blowing the frame out across exactly that span, so what
      // reads is the logo condensing OUT of the burst — which is what
      // Bull3D's ImpactFlash was written to do.
      const hideBull = bull3dReadyRef.current && progress < BULL3D.out0;
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
    // Frame-rate-INDEPENDENT scrub smoothing. The old code advanced progress by a
    // fixed per-frame fraction, so a low-end device painting at 30fps advanced half
    // as fast and the scene visibly trailed the scroll — the "lag". Here progress
    // eases toward the scroll on a time-constant: dt normalises it so the felt
    // scrub speed is identical at 24fps or 120fps (no unbounded trailing on slow
    // GPUs). Rates are lowered so it's glidier/slower overall, and low-end gets
    // extra glide so any dropped frames read as ease, not judder. dt is clamped so
    // a long stall (tab blur, GC pause) resumes gently instead of lurching ahead.
    const LOW_END =
      (navigator.hardwareConcurrency || 8) <= 4 ||
      ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
    const EASE_RATE = LOW_END ? 3.0 : 5.0; // lower = slower/glidier (≈0.05 / 0.08 per 60fps frame)
    let lastNow = -1;
    // Resume marker bookkeeping. Twice a second at most, and only when the film
    // has actually moved — sessionStorage is synchronous, and this loop sits
    // next to three WebGL contexts.
    let lastSave = 0;
    let savedP = -1;
    const tick = (ts: number) => {
      if (disposed || collapsed) return;
      const now = ts / 1000;
      const dt = lastNow < 0 ? 1 / 60 : Math.min(0.05, now - lastNow);
      lastNow = now;
      const diff = targetProgress - progress;
      const k = 1 - Math.exp(-EASE_RATE * dt);
      progress = Math.abs(diff) < 0.0002 ? targetProgress : progress + diff * k;
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
          // Clamp to the frame: the sticky wrapper is overflow-hidden, so an
          // unclamped tag clips off the top/right edges (hovering the top 40px
          // or right ~120px). Flip to the cursor's LEFT when the right edge
          // would cut it; never let the top edge shear it.
          const host = stickyRef.current;
          const maxX = (host ? host.clientWidth : window.innerWidth) - el.offsetWidth - 8;
          let tx = hov.sx + 14;
          if (tx > maxX) tx = Math.max(8, hov.sx - el.offsetWidth - 14);
          const ty = Math.max(8, hov.sy - 40);
          el.style.transform = `translate(${tx.toFixed(0)}px, ${ty.toFixed(0)}px)`;
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
      // Remember the place. Written from the RAW scroll position, not the
      // smoothed one, so a reload lands where the reader actually was rather
      // than where the scrub had caught up to.
      if (now - lastSave > 0.5 && Math.abs(targetProgress - savedP) > 0.002) {
        lastSave = now;
        savedP = targetProgress;
        try {
          sessionStorage.setItem(RESUME_KEY, targetProgress.toFixed(4));
        } catch {
          /* storage blocked — a reload simply starts the film again */
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
      // The iframe firing `load` WITHOUT exposing initScene (dead/404 scene.html,
      // a cross-origin read, a network abort) used to hit the bare `return`
      // below, which neither resolved nor rejected — so Promise.all never
      // settled, its .catch(() => setMode("static")) was unreachable, and the
      // loading overlay sat at opacity 1 with scroll locked FOREVER. The
      // documented static fallback could never engage.
      let loadFired = false;
      const fail = () => {
        if (done || disposed) return;
        done = true;
        reject(new Error("scene"));
      };
      const run = async () => {
        if (done || disposed) return;
        let w: ReturnType<typeof win>;
        try {
          w = win();
        } catch {
          return fail(); // cross-origin: the scene will never be reachable
        }
        if (!w?.initScene) {
          // Before `load`, the iframe simply isn't ready yet and the listener
          // retries. After it, initScene is never going to appear.
          if (loadFired) fail();
          return;
        }
        done = true;
        try {
          await w.initScene({
            shots: SHOTS,
            phases: ACTS,
            bullFrames: null,
            tokens: resolvedTokens(),
            mono: injectMono(w.document) ?? undefined,
          });
          ready = true;
          renderScene();
          applyOverlays();
          resolve();
        } catch {
          reject(new Error("scene"));
        }
      };
      const onLoad = () => {
        loadFired = true;
        void run();
      };
      onSceneLoad = onLoad;
      onSceneError = fail;
      iframe.addEventListener("load", onLoad);
      iframe.addEventListener("error", fail);
      // Last-resort bound: if neither load nor error ever fires, still let the
      // gate resolve to the static fallback rather than trapping the page.
      sceneTimeout = window.setTimeout(fail, 20_000);
      void run(); // in case the iframe is already loaded
    });
    // THE DOOR WAITS ONLY ON WHAT ACT ONE NEEDS.
    //
    // This gate used to also await both GLBs, via two fetch() calls whose
    // ArrayBuffers were thrown away — they existed to warm the HTTP cache. Two
    // things were wrong with that. The models are not needed until CANDLE3D
    // (progress 0.32) and BULL3D (0.71), a third and three-quarters of the way
    // in, so the entrance was blocked on assets nobody sees for thousands of
    // pixels. And drei already downloads them itself: Bull3D calls
    // useGLTF.preload and CandleField3D loads its own, so bull-crystal.glb was
    // fetched TWICE on every visit — confirmed in the production network log.
    //
    // Dropping the warmers costs nothing: drei still starts its own load as
    // soon as the three-stage chunk evaluates, which is inside the gate, so the
    // models are already in flight while the loader finishes — they simply no
    // longer hold the door shut.
    //
    // Failures stay non-fatal (allSettled): a dead chunk reveals with its 2D
    // fallback — slow is not broken, and broken still degrades gracefully.
    const GATE_STEPS = 2; // scene+shots · the ONE three-stage chunk → the REAL progress bar
    let gateDone = 0;
    const step = <T,>(p: Promise<T>): Promise<T> => {
      const bump = () => {
        if (disposed) return;
        gateDone++;
        setLoadPct((prev) => Math.max(prev, Math.round((gateDone / GATE_STEPS) * 96)));
      };
      p.then(bump, bump);
      return p;
    };
    const extras = Promise.allSettled([step(import("./three-stage"))]);
    const minTime = new Promise((r) => window.setTimeout(r, 650)); // don't flash the loader

    // the bar is anchored to REAL gate steps; the creep only eases it toward
    // the next milestone so a long download still visibly breathes
    creep = window.setInterval(
      () => setLoadPct((p) => Math.min(p + 1, Math.round((gateDone / GATE_STEPS) * 96) + 8, 96)),
      150
    );

    let settled = false;
    // after 10s of honest waiting, offer a way out — never auto-reveal
    const slowTimer = window.setTimeout(() => {
      if (!settled && !disposed) setSlowLoad(true);
    }, 10000);
    const reveal = () => {
      if (settled || disposed) return;
      settled = true;
      window.clearInterval(creep);
      window.clearTimeout(slowTimer);
      setSlowLoad(false);
      setLoadPct(100);
      window.setTimeout(() => {
        if (disposed) return;
        rootStyle.overflow = prevOverflow; // unlock scroll
        // The film has actually started in this tab. CinemaGate reads this — it
        // is what stops a same-session return to "/" from replaying the intro.
        // And a replay request is met the moment the film runs, so consume it
        // here: leaving it set would replay on every later visit in this tab.
        try {
          sessionStorage.setItem(AUTOPLAYED_KEY, "1");
          sessionStorage.removeItem(REPLAY_KEY);
        } catch {}
        // RESUME. A reload used to snap to 0 and start again from the boot
        // screen, i.e. charge you 13,500px to get back to where you already
        // were. Put the scroll back BEFORE creating the trigger so the trigger
        // is born at the right progress, then snap the smoothed value onto it —
        // otherwise the film scrubs from act one to act six in one visible
        // lurch while the reader watches.
        if (resumeAt !== null) {
          const range = section.offsetHeight - window.innerHeight;
          if (range > 0) window.scrollTo(0, Math.round(section.offsetTop + range * resumeAt));
        }
        createScrollTrigger(); // enable the scroll animation
        if (resumeAt !== null) {
          // Take the number we just scrolled TO, not ScrollTrigger's read of it.
          // The trigger caches scroll positions and reports the pre-restore
          // value on the frame it is created — measured 0.722 for a restore to
          // 0.800, i.e. the film opened a whole act early. The trigger's start
          // is "top top" and its end "bottom bottom", so resumeAt IS its
          // progress at this scroll; update() puts its own bookkeeping straight.
          ScrollTrigger.update();
          targetProgress = resumeAt;
          progress = resumeAt;
          renderScene();
          applyOverlays();
        }
        setReveal(true); // fade the loading screen out
        window.setTimeout(() => { if (!disposed) setLoading(false); }, 550);
      }, 420);
    };
    // the loader's skip: the user bails to the static homepage — the same
    // landing as a genuine scene failure, but chosen, never automatic
    bailToStaticRef.current = () => {
      if (settled || disposed) return;
      settled = true;
      window.clearInterval(creep);
      window.clearTimeout(slowTimer);
      rootStyle.overflow = prevOverflow;
      markCinemaSeen(); // a chosen exit counts as seen — do not re-gate them
      stopCinemaAudio();
      setMode("static");
    };
    Promise.all([step(shotsLoaded), extras, minTime]).then(reveal).catch(() => {
      if (settled || disposed) return;
      settled = true;
      window.clearInterval(creep);
      window.clearTimeout(slowTimer);
      rootStyle.overflow = prevOverflow;
      setMode("static");
    });

    // The scene seeds particles/rain for a specific size; re-init on resize.
    const onResize = () => {
      if (!ready || collapsed) return;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const w2 = win();
        w2?.initScene?.({
          shots: SHOTS,
          phases: ACTS,
          bullFrames: null,
          tokens: resolvedTokens(),
          mono: w2 ? injectMono(w2.document) ?? undefined : undefined,
        }).then(() => renderScene());
      }, 160);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(slowTimer);
      window.clearInterval(creep);
      window.clearTimeout(sceneTimeout);
      rootStyle.overflow = prevOverflow; // never leave scroll locked
      if (onSceneLoad) iframe.removeEventListener("load", onSceneLoad);
      if (onSceneError) iframe.removeEventListener("error", onSceneError);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onDown);
      st?.kill();
      // The film owned an AudioContext and nothing gave it back. Unmounting the
      // cinema left oscillators running on the audio thread and one of the
      // browser's small per-document context slots held for the life of the
      // page — and in dev, one more on every hot reload.
      stopCinemaAudio();
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
    // Reduced motion, no WebGL, or a scene that failed to load. See
    // CinemaStill for why this is a drawn frame and not a list of headlines.
    return (
      <CinemaStill />
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
            <span className="flex size-8 items-center justify-center bg-bull font-mono text-[0.8125rem] font-bold tracking-tight text-bg">
              LB
            </span>
            <span className="font-display text-3xl tracking-tight text-fg">
              lazybull<span className="text-bull">.</span>
            </span>
          </div>
          <div className="relative h-px w-[16.25rem] overflow-hidden bg-border">
            <div
              className="h-full bg-bull transition-[width] duration-300 ease-out"
              style={{ width: `${loadPct}%`, boxShadow: "0 0 12px rgba(0,255,135,0.7)" }}
            />
          </div>
          <div className="relative flex w-[16.25rem] items-center justify-between font-mono text-[0.625rem] uppercase tracking-[0.15em] text-fg-faint">
            <span className="flex items-center gap-1.5">
              <span className="size-1 rounded-full bg-bull pulse-dot" /> Initializing terminal
            </span>
            <span className="tabular-nums text-bull/90">{Math.round(loadPct)}%</span>
          </div>
          {/* The one place an opt-in belongs: this is already a textbook
              entrance gate with a 0-100 counter, so asking here costs the
              reader nothing and satisfies the browser's gesture requirement by
              construction. Default OFF, always. */}
          <button
            type="button"
            onClick={() => {
              if (sound) {
                disableCinemaAudio();
                setSound(false);
              } else {
                setSound(enableCinemaAudio());
              }
            }}
            aria-pressed={sound}
            className="pointer-events-auto relative border border-border bg-bg/70 px-3 py-1.5 font-mono text-[0.625rem] uppercase tracking-[0.15em] text-fg-dim transition-colors hover:border-bull/50 hover:text-fg"
          >
            {sound ? "sound on" : "sound off"}
          </button>
          {/* The exit is available from second 0 — for the first 10 seconds of a
              slow load this overlay used to cover the only skip button, leaving
              no way out of a locked scroll. */}
          <div className="relative flex flex-col items-center gap-3">
            <div
              className="font-mono text-[0.625rem] uppercase tracking-[0.15em] text-fg-faint transition-opacity duration-500"
              style={{ opacity: slowLoad ? 1 : 0 }}
            >
              still loading the heavy bits…
            </div>
            <button
              type="button"
              onClick={() => bailToStaticRef.current?.()}
              className="pointer-events-auto border border-border bg-bg/70 px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim transition-colors hover:border-bull/50 hover:text-fg max-md:px-5 max-md:py-3"
            >
              Skip intro →
            </button>
          </div>
        </div>
      )}
      <section
        ref={sectionRef}
        data-cinema
        className="pointer-events-none relative z-20"
        // Divided by --ui-zoom for the same reason globals.css divides
        // h-screen: these are inline, so the stylesheet cannot reach them, and
        // an un-divided 1500vh would stretch the whole film by 10% and leave
        // the -100vh hand-off overlap short by the same amount.
        style={{
          height: `calc(${SCROLL_LENGTH_VH}vh / var(--ui-zoom))`,
          marginBottom: "calc(-100vh / var(--ui-zoom))",
        }}
      >
      {/* Backdrop lives on the sticky wrapper (which fades via canvasOpacity), NOT
          the section — otherwise the section's opaque bg stays over the real Hero
          in the -100vh overlap and the handoff reveals black instead of the page. */}
      {/* --rail-w reserves the act rail's column (rail at left-[2.5vw] + its
          rows) as ONE shared number: the lab panel offsets past it and the
          caption widths subtract it per side, so nothing prints over the rail. */}
      <div
        ref={stickyRef}
        className="pointer-events-none sticky top-0 h-screen w-full overflow-hidden bg-bg"
        style={{ "--rail-w": "200px" } as React.CSSProperties}
      >
        {!dead && (<>
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
        </>)}
        {/* film grain layer: scanlines + vignette unify the 2D and 3D acts */}
        <div className="pointer-events-none absolute inset-0 scanlines opacity-[0.13]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.62) 100%)" }}
        />
        {/* NOTE: no -translate-x-1/2 class here — Tailwind 4 translates via the
            native `translate` property, which would STACK with the imperative
            style.transform (-50% again) set every frame in applyOverlays and
            shove each beat half its width off-center. JS owns the transform. */}
        {COPY_BEATS.map((b, i) => (
          <div
            key={b.id}
            ref={(el) => { copyRefs.current[i] = el; }}
            className="absolute left-1/2 text-center"
            style={{
              // "top" beats: viewport-aware — 14% of a 720px viewport bottomed
              // the heading out into the rail's top rows, so the anchor stops
              // at calc(50% - 260px) (and never above 64px on short screens).
              top: b.pos === "top" ? "clamp(64px, 14%, calc(50% - 260px))" : "50%",
              opacity: 0,
              // Reserve the rail gutter on BOTH sides (centered text, one rail):
              // at 768-1000px the old min(92vw, 680px) printed captions over the
              // rail's box. 100vw divided by --ui-zoom (see the section note);
              // 2.5vw stays raw because the rail's own left-[2.5vw] is raw.
              width: "min(680px, calc(100vw / var(--ui-zoom) - 2 * (2.5vw + var(--rail-w) + 10px)))",
            }}
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
        {/* QUANT-LAB PANEL — the candle act's finale (candleLabT 0→1): the AI
            "takes one candle into the lab". Terminal lines light up with scroll
            while the ice candle spins/stretches on the right; all values are
            driven imperatively in applyOverlays on the same clock. */}
        {/* Position responsively via classes (JS only drives opacity/visibility):
            desktop = left rail beside the candle; <md = bottom sheet so the panel
            never sits on top of the ice candle on a phone. */}
        <div
          ref={labRef}
          data-lab-panel
          className="absolute z-20 border border-border bg-black/85 font-mono backdrop-blur-sm max-md:bottom-[13vh] max-md:left-1/2 max-md:w-[min(92vw,420px)] max-md:-translate-x-1/2 md:left-[calc(2.5vw+var(--rail-w))] md:top-1/2 md:w-[min(36vw,440px)] md:-translate-y-1/2"
          style={{
            opacity: 0,
            visibility: "hidden",
            boxShadow: "0 0 70px rgba(0,0,0,0.65), 0 0 28px rgba(191,232,255,0.07)",
          }}
        >
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2 text-[0.625rem] uppercase tracking-wider text-fg-dim">
            <span>quant-bot · candidate lab</span>
            <span ref={labPhaseRef} style={{ color: "#bfe8ff" }}>scan</span>
          </div>
          {/* Lines TYPE ON with scroll (width in ch, driven in applyOverlays) and
              light through the colour story: cyan scan → green candidate (B) →
              red downside stress (C) → green verdict. Content is descriptive /
              paper-only — never an imperative. */}
          {/* Six lines, not eleven: the four model-parameter rows (hurst, ewma,
              garch, kelly_cap …) collapsed into ONE summary row — they were
              noise competing with the three story lines. Full parameter detail
              lives on /trade/quant. Live values keep interpolating on the same
              clock via labValRefs. */}
          <div className="px-3.5 py-3 text-[0.6875rem] leading-[1.7] text-fg md:text-[0.75rem] md:leading-[1.8]">
            <div ref={(el) => { labLineRefs.current[0] = el; }} className="lab-line" style={{ opacity: 0 }}>
              <span className="text-fg-dim">$</span> <span className="text-bull">quantbot</span> --scan NVDA --paper
            </div>
            <div ref={(el) => { labLineRefs.current[1] = el; }} className="lab-line" style={{ opacity: 0 }}>
              <span className="text-bull">regime</span> TREND · μ +<span ref={(el) => { labValRefs.current[0] = el; }} style={{ color: "#28d7ff" }}>0.12</span> · σ <span ref={(el) => { labValRefs.current[1] = el; }} style={{ color: "#28d7ff" }}>1.24</span> · agree <span ref={(el) => { labValRefs.current[2] = el; }} style={{ color: "#28d7ff" }}>1</span>/6
            </div>
            <div ref={(el) => { labLineRefs.current[2] = el; }} className="lab-line" style={{ opacity: 0 }}>
              <span className="text-fg-dim">→</span> candidate = <span className="text-bull">CALL <span ref={(el) => { labValRefs.current[3] = el; }}>240</span></span> · agree <span ref={(el) => { labValRefs.current[4] = el; }}>1</span>/6
            </div>
            <div ref={(el) => { labLineRefs.current[3] = el; }} className="lab-line" style={{ opacity: 0, marginTop: "4px" }}>
              <span style={{ color: "#ff6b8a" }}>stress</span>(-2σ shock) <span className="text-fg-dim">→</span> max loss capped
            </div>
            <div ref={(el) => { labLineRefs.current[4] = el; }} className="lab-line" style={{ opacity: 0 }}>
              VaR(95%) = -1.0R <span className="text-fg-dim">·</span> daily kill-switch armed
            </div>
            <div ref={(el) => { labLineRefs.current[5] = el; }} className="lab-line" style={{ opacity: 0, marginTop: "4px" }}>
              <span className="text-fg-dim">→</span> historical agreement <span className="text-bull">6/6 models</span> · paper pick staged
            </div>
          </div>
          <div className="border-t border-border px-3.5 py-1.5 text-[0.625rem] uppercase tracking-[0.14em] text-fg-dim" style={{ opacity: 0.75 }}>
            simulated · educational — not advice
          </div>
        </div>
        {/* live price tag — follows the hovered 3D candle */}
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute left-0 top-0 z-30 flex items-center gap-2 border bg-black/85 px-2.5 py-1.5 font-mono text-[0.6875rem] backdrop-blur-sm transition-opacity duration-150"
          style={{ opacity: 0, borderColor: "rgba(0,255,135,0.5)" }}
        >
          <span className="text-fg" />
          <span />
        </div>
        <div ref={flashRef} className="absolute inset-0 bg-bull" style={{ opacity: 0 }} />
        {/* The film's spine. Replaces the dead-centre skip pill above md — that
            pill sat over the dive corridor's best panel and read as the film
            apologising for itself. Below md there is no film at all, so the
            pill stays there as the only control. */}
        <CinemaRail
          ref={railRef}
          onSkip={handleSkip}
          onSeek={(target) => {
            const sec = sectionRef.current;
            if (!sec) return;
            const range = sec.offsetHeight - window.innerHeight;
            window.scrollTo({ top: sec.offsetTop + range * target, behavior: "smooth" });
          }}
        />
        {/* `absolute bottom-7` anchored this to the sticky wrapper, which at
            scrollY=0 has not yet reached its top-0 pin and therefore sits ~91px
            down the page — putting the button fully BELOW the fold on mobile
            (measured: top=832 against an 812px viewport, not tappable). Anchor
            it to the viewport instead so it's reachable the moment you land.
            It also used to carry `md:hidden` — a mobile-only gate on a control
            inside a component that only ever mounts at md and up, so the film
            shipped with no skip on ANY width. Phones have their own now, in
            MobileCinema; this one is the desktop film's. */}
        <button
          ref={skipRef}
          type="button"
          onClick={handleSkip}
          className="pointer-events-auto fixed bottom-7 left-1/2 z-30 -translate-x-1/2 border border-border bg-bg/70 px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim backdrop-blur transition-colors hover:border-bull/50 hover:text-fg max-md:px-5 max-md:py-3"
        >
          Skip intro ↓
        </button>
        <noscript>
          <img src="/cinema/shots/hero.webp" alt="LazyBull — options, without the fog" className="absolute inset-0 h-full w-full object-cover" />
        </noscript>
        <style>{`
          .beat-word { display: inline-block; white-space: nowrap; }
          /* THE COPY LAYER RUNS ON THE FILM'S CLOCK.
             --t is written per frame by beatCharT(); --i is the glyph index.
             Each character derives its own 0→1 (--c) from those two numbers, so
             there is no transition, no transition-delay and no wall-clock
             anywhere in the reveal: it is f(progress), it scrubs backwards, and
             a fast scroll cannot outrun it.
             This also removed the film's four rogue easing curves —
             (.22,.68,.26,1), (.3,1.42,.42,1), (.3,1.3,.45,1) and plain 'ease' — against
             the contract's one. The shape now comes from beatCharT's smoothstep,
             which is the same ss01 beatOpacity and candleLabT already use. */
          .beat-char {
            display: inline-block;
            --c: clamp(0, calc((var(--t, 0) - var(--i) * 0.016) / 0.34), 1);
            opacity: var(--c);
            transform:
              translateY(calc((1 - var(--c)) * 0.55em))
              rotate(calc((1 - var(--c)) * 1.5deg));
            filter: blur(calc((1 - var(--c)) * 4px));
          }
          .beat-sub {
            /* Trails the headline: starts once the glyphs are ~65% through. */
            --c: clamp(0, calc((var(--t, 0) - 0.65) / 0.35), 1);
            opacity: var(--c);
            transform: translateY(calc((1 - var(--c)) * 10px));
            color: rgba(245,245,240,0.82); letter-spacing: 0.05em;
          }
          /* QUANT-LAB type-on: each line clips to a ch-width set every frame from
             labT (monospace → 1ch/char), so the reveal is pure f(progress) and
             scrubs backwards. Only the frontier line carries the blinking caret
             (a right border) — the one time-based touch, purely cosmetic. */
          .lab-line { display: block; white-space: nowrap; overflow: hidden; width: 0; }
          .lab-caret { box-shadow: inset -2px 0 0 0 rgba(191,232,255,0.85); animation: lab-blink 1.05s steps(1, end) infinite; }
          @keyframes lab-blink { 50% { box-shadow: inset -2px 0 0 0 transparent; } }
          @media (prefers-reduced-motion: reduce) {
            .beat-char, .beat-sub { --c: 1; opacity: 1; transform: none; filter: none; }
            .lab-caret { animation: none; }
          }
        `}</style>
      </div>
      </section>
      {shatter && typeof document !== "undefined" && createPortal(<ShatterOverlay />, document.body)}
    </>
  );
}

/** The glass-crack burst the skip plays — deterministic jagged radials, no
    randomness at render (scrub/replay discipline applies even to exits). */
function ShatterOverlay() {
  const cracks: string[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + Math.sin(i * 7.3) * 0.22;
    const k1 = 16 + ((i * 37) % 11);
    const k2 = 34 + ((i * 53) % 15);
    const r = 58 + ((i * 29) % 13);
    const bend1 = Math.sin(i * 3.1) * 4;
    const bend2 = Math.cos(i * 5.7) * 5;
    const x = (t: number, b: number) => 50 + Math.cos(a) * t + Math.cos(a + Math.PI / 2) * b;
    const y = (t: number, b: number) => 50 + Math.sin(a) * t + Math.sin(a + Math.PI / 2) * b;
    cracks.push(
      `M50,50 L${x(k1, bend1).toFixed(1)},${y(k1, bend1).toFixed(1)} L${x(k2, bend2).toFixed(1)},${y(k2, bend2).toFixed(1)} L${x(r, 0).toFixed(1)},${y(r, 0).toFixed(1)}`
    );
  }
  return (
    <div className="shatter-overlay" aria-hidden>
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        {cracks.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={i % 3 === 0 ? "rgba(0,255,135,0.75)" : "rgba(245,245,240,0.6)"}
            strokeWidth={i % 4 === 0 ? 0.35 : 0.18}
          />
        ))}
        <circle cx="50" cy="50" r="3.5" fill="none" stroke="rgba(0,255,135,0.8)" strokeWidth="0.3" />
        <circle cx="50" cy="50" r="7" fill="none" stroke="rgba(245,245,240,0.35)" strokeWidth="0.15" />
      </svg>
    </div>
  );
}

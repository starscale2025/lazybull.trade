"use client";

import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ACTS, CANDLE3D, COPY_BEATS, MOODS, SAFETY_LINES, beatCharT, beatOpacity, candle3dOpacity, clamp01, floorHandoff, handoffOpacity, matterNear, moodOpacity, safetyLight } from "@/lib/cinema";
import { advanceFilm, cinemaClock, damp } from "@/lib/cinema-clock";
import { isMotionPaused, motion as busMotion } from "@/lib/motion/bus";
import { getHeroPosition, onHeroPosition, useHeroChosen, type HeroPosition } from "@/lib/hero-position";
import {
  cinemaAudioFrame,
  cinemaAudioEnabled,
  enableCinemaAudio,
  disableCinemaAudio,
  stopCinemaAudio,
} from "@/lib/cinema-audio";
import { CinemaRail, type CinemaRailHandle } from "./CinemaRail";
import { CinemaStill } from "./CinemaStill";
// Shared with CinemaGate, which reserves exactly this height on the first paint
// so mounting the film shifts nothing. See cinema-metrics.ts.
import { setIslandStage } from "@/lib/island";
import { BULL_MARK } from "@/lib/bull-mark";
import { BullMark } from "@/components/BullMark";
import { SCROLL_LENGTH_VH, CURTAIN_VH, FILM_START, FILM_LIFT_END, scrollToFilm, filmToScroll, holdOf } from "./cinema-metrics";

declare global {
  // eslint-disable-next-line no-var
  var __filmToScroll: ((p: number) => number) | undefined;
}
// The page scrolls through Lenis; moving it with window.scrollTo mid-glide is undone next frame.
import { glideTo, isSmoothing, jumpBy, jumpTo } from "@/lib/motion/scroll";
import { AUTOPLAYED_KEY, REPLAY_KEY, RESUME_KEY, cinemaResumeAt, markCinemaSeen } from "./cinema-memory";

const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Lazy so three.js only loads for users who actually get the cinema (not the
// reduced-motion static fallback, and not until after first paint) — but
// through ONE boundary (three-stage.ts): three separate lazy chunks used to
// duplicate the entire three.js graph, shipping WebGLRenderer twice.
const CandleField3D = lazy(() => import("./three-stage").then((m) => ({ default: m.CandleField3D })));
const FilmMatter = lazy(() => import("./three-stage").then((m) => ({ default: m.FilmMatter })));

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Film progress. Past this the follower cuts instead of gliding (see tick()),
// and a rail seek further than this cuts behind a dip instead of gliding.
const JUMP_CUT = 0.15;
// The scroll must have been still this long at the end of the hold before
// the film collapses, so a scroll still travelling through the end is never
// cut mid-flight.
const COLLAPSE_IDLE_MS = 160;

// Distinct app-screen shots the scene composites (panels + the reveal hero).
// "/" is now the cinema itself, so no "home" shot — panels use real product routes.
const SHOT_NAMES = ["learn", "trade", "quant", "pro", "chain", "bots", "about"];
// Drawn from code by scripts/cinema/plates.mjs; screenshots went stale.
const SHOTS = Object.fromEntries(SHOT_NAMES.map((n) => [n, `/cinema/plates/${n}.svg`]));

type SceneWindow = Window & {
  initScene?: (cfg: {
    shots: Record<string, string>;
    phases: Record<string, { from: number; to: number }>;
    bullFrames: string[] | null;
    /** The parent's RESOLVED design tokens — the scene keeps no palette of its own. */
    tokens?: Record<string, string>;
    /** The parent's own mono font-family, injected into the frame as @font-face. */
    mono?: string;
    /** The hero's position, which the safety act draws (lib/hero-position.ts). */
    position?: HeroPosition;
    /** The act rail's right edge on the stage, in px, plate included. */
    insetLeft?: number;
  }) => Promise<unknown>;
  /** A new hero position after the scene is up: the visitor moved a strike. */
  setPosition?: (pos: HeroPosition) => void;
  /** Set by this page: it draws the mark's line itself (the match-cut). */
  markLineExternal?: boolean;
  /** Set by this page over the hold: how far the mark's particles have faded (0..1). */
  markFade?: number;
  /** The mark's box as shares of the scene, and its line width as a share of its width. */
  markRect?: () => { x: number; y: number; w: number; h: number; lw: number };
  /** The vote's ring as shares of the scene, for the matter to gather on. */
  ringRect?: () => { cx: number; cy: number; rx: number; ry: number } | null;
  /** The payoff's floor as shares of the scene, for the floor line to land on. */
  floorLine?: () => { x0: number; y0: number; x1: number; y1: number } | null;
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
function resolvedTokens(from: Element): Record<string, string> {
  const cs = getComputedStyle(from);
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

// The film's memory (seen / autoplayed / resume / replay) lives in
// cinema-memory.ts, where CinemaGate can read it before the film loads.

export function ScrollCinema() {
  // The safety line claims "a number you chose" only once the visitor has
  // set a spread (lib/cinema.ts SAFETY_LINES). Same windows, same order, so
  // every per-beat ref and opacity below still lines up with COPY_BEATS.
  const chosen = useHeroChosen();
  const beats = useMemo(
    () => COPY_BEATS.map((b) => (b.id === "safety" && chosen ? { ...b, ...SAFETY_LINES.chosen } : b)),
    [chosen]
  );
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  // The match-cut's line, drawn over the stage (see drawMatchCut).
  const cutRef = useRef<SVGSVGElement>(null);
  const cutRampRef = useRef<SVGPathElement>(null);
  const cutGradRef = useRef<SVGLinearGradientElement>(null);
  const cutUpRef = useRef<SVGPathElement>(null);
  const cutDnRef = useRef<SVGPathElement>(null);
  const cutClipUpRef = useRef<SVGRectElement>(null);
  const cutClipDnRef = useRef<SVGRectElement>(null);
  const railRef = useRef<CinemaRailHandle>(null);
  // The rail seek's dip to the stage colour; see onSeek.
  const dipRef = useRef<HTMLDivElement>(null);
  // The stage's lens vignette, which lifts off the safety act (safetyLight).
  const vignetteRef = useRef<HTMLDivElement>(null);
  const collapseRef = useRef<(() => void) | null>(null);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const candle3dWrapRef = useRef<HTMLDivElement>(null);
  const candle3dActiveRef = useRef(false);
  const candle3dReadyRef = useRef(false);
  const [candle3dActive, setCandle3dActive] = useState(false);
  // The matter (FilmMatter): the line at the start, the bull at the end.
  const matterWrapRef = useRef<HTMLDivElement>(null);
  const matterActiveRef = useRef(false);
  const matterReadyRef = useRef(false);
  const matterBullRef = useRef(false);
  const [matterActive, setMatterActive] = useState(false);
  // The floor line, once it has left the chart for the payoff.
  const floorSvgRef = useRef<SVGSVGElement>(null);
  const floorLineRef = useRef<SVGLineElement>(null);
  const floorCoreRef = useRef<SVGLineElement>(null);
  const moodRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const tooltipRef = useRef<HTMLDivElement>(null); // live price tag on candle hover
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
  // Sound is OFF until asked, from the rail. See lib/cinema-audio.ts.
  const [sound, setSound] = useState(false);
  const [reveal, setReveal] = useState(false);
  // gate held >10s → show "still loading" + a skip-to-static choice (we never
  // auto-reveal a half-loaded scene; the user decides)
  const [slowLoad, setSlowLoad] = useState(false);
  const bailToStaticRef = useRef<(() => void) | null>(null);

  // Each 3D layer's WebGL context going live tells the 2D scene to drop its
  // matching draw (via the per-frame hide flags). Stays false if WebGL fails →
  // the 2D bull / candle chart remain as fallbacks.
  const handleCandleReady = () => {
    candle3dReadyRef.current = true;
  };
  const handleMatterReady = () => {
    matterReadyRef.current = true;
  };
  const handleMatterBull = (ok: boolean) => {
    matterBullRef.current = ok;
  };
  // A lost WebGL context (GPU reset, too many contexts) hands the frame back
  // to the 2D scene, which draws its own version of whatever a layer that is
  // not ready would have shown. Restoring calls the ready handler again.
  const handleCandleLost = () => {
    candle3dReadyRef.current = false;
  };
  const handleMatterLost = () => {
    matterReadyRef.current = false;
  };

  // Skip the film: the stage dips to the page colour and the landing is simply
  // there. The collapse keeps the film from being scrolled back into.
  const doSkip = () => {
    const s = sectionRef.current;
    if (!s) return;
    jumpTo(s.offsetTop + s.offsetHeight - window.innerHeight + 4);
    collapseRef.current?.();
  };
  const handleSkip = () => {
    const dip = dipRef.current;
    if (!dip || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      doSkip();
      return;
    }
    dip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: "ease-in", fill: "forwards" }).finished.then(doSkip).catch(doSkip);
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
    // Where a reload left off, resolved ONCE, before anything can move the
    // scroll position this would otherwise be reading back.
    const resumeAt = cinemaResumeAt();

    // NEVER LOCK SCROLL. This used to set overflow:hidden and scrollTo(0,0)
    // while the scene preloaded: the H1 was 13,500px away, the first frame was
    // an empty laptop, and anyone who scrolled before the lock landed (0.2-2.1s
    // after navigation) was yanked back to the top. Frame zero is the hero
    // instrument now, stacked above this section, so the film can load under it
    // at its own pace. The page progress bar hides while the film is pinned;
    // the act rail is the film's meter (globals.css, html[data-film]).
    document.documentElement.dataset.film = "pinned";
    // For the frame-time gate (scripts/perf/budget.mjs) and the review tools:
    // film time → section progress, so a measured window is the act it names.
    globalThis.__filmToScroll = filmToScroll;

    let disposed = false;
    let ready = false;
    let sceneErrorLogged = false; // one console.error per mount, not one per frame
    let st: ScrollTrigger | null = null;
    let raf = 0;
    let progress = FILM_START; // smoothed value that drives the scene (film space)
    let targetProgress = FILM_START; // raw scroll position, mapped into film space
    let resizeTimer = 0;
    let collapsed = false;
    let creep = 0; // interval that eases the loading bar up during preload
    let onSceneLoad: (() => void) | null = null;
    let onSceneError: (() => void) | null = null;
    let sceneTimeout = 0;
    let pxS = 0; // damped pointer for layered parallax
    let pyS = 0;
    let scrollS = 0; // raw ScrollTrigger progress; 0 means the hero still covers the stage

    // OUT OF REACH UNDER THE CURTAIN. The hero is opaque and stacked above
    // this stage, but the rail's rows, its skip and the loader's buttons were
    // all still in the tab order behind it (re-tribunal regression 7, a WCAG
    // 2.2 SC 2.4.11 failure). Until the curtain has finished lifting the
    // whole section is inert. Driven by scroll rather than by the film loop,
    // because the loader can be on screen before that loop exists.
    let inertNow: boolean | null = null;
    const syncInert = () => {
      const range = section.offsetHeight - window.innerHeight;
      const s = range > 0 ? -section.getBoundingClientRect().top / range : 0;
      const behind = scrollToFilm(s) < FILM_LIFT_END - 1e-4;
      if (behind === inertNow) return;
      inertNow = behind;
      section.inert = behind;
    };
    syncInert();
    window.addEventListener("scroll", syncInert, { passive: true });
    // When the page last moved, for the collapse: it waits for the scroll to
    // come to rest at the end of the hold (Lenis keeps emitting scroll while
    // it eases, so its glide counts as moving).
    let lastScrollAt = performance.now();
    const markScroll = () => {
      lastScrollAt = performance.now();
    };
    window.addEventListener("scroll", markScroll, { passive: true });

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
    // Where the act rail ends, so the scene keeps its charts clear of it.
    // 28px is the rail's feathered plate (.cinema-rail::before).
    const railInset = () => {
      const host = stickyRef.current;
      const rail = host?.querySelector<HTMLElement>(".cinema-rail");
      if (!host || !rail?.offsetWidth) return 0;
      return Math.round(rail.getBoundingClientRect().right - host.getBoundingClientRect().left + 28);
    };

    // Play-once: after the user scrolls all the way through onto the homepage,
    // remove the cinema from the layout (compensating scroll so nothing jumps)
    // so it can't be scrolled back into. The intro plays a single time.
    const collapse = () => {
      if (collapsed || disposed) return;
      collapsed = true;
      if (cutRef.current) cutRef.current.style.display = "none";
      // SILENCE FIRST. The next three lines slam progress to 1, and the audio
      // pass rides progress — so a skip from act five would cross the bull's
      // impact beat on the way out and detonate it into a black frame. Silence
      // past the last beat is the designed ending; this is also the only place
      // that gives the AudioContext back, because the component stays MOUNTED
      // behind display:none and nothing else would.
      stopCinemaAudio();
      window.removeEventListener("scroll", syncInert);
      window.removeEventListener("scroll", markScroll);
      progress = 1;
      renderScene(cinemaClock.time);
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
      // Focus inside the film (the rail's Skip, a rail row) would be dropped to
      // <body> when the section hides; capture it so it can land somewhere real.
      const hadFocus = section.contains(document.activeElement);
      section.style.display = "none";
      delete document.documentElement.dataset.film;
      setIslandStage(null);
      // Frame zero's "or scroll for the film" is no longer true.
      document.documentElement.dataset.filmDone = "";
      if (hadFocus && hero) {
        const h = hero.querySelector<HTMLElement>("h1, h2, [data-skip-target]");
        if (h) {
          if (!h.hasAttribute("tabindex")) h.tabIndex = -1;
          h.focus({ preventScroll: true });
        }
      }
      const keepHeroInPlace = () => {
        if (!hero) return;
        const delta = hero.getBoundingClientRect().top - before;
        if (Math.abs(delta) > 1) jumpBy(delta);
      };
      keepHeroInPlace();
      // Played through (or skipped) once — never replay the toll booth. The
      // no-navbar IA sends every logo click back to "/", so without this flag
      // anonymous users re-entered the scroll-locked preloader every time.
      markCinemaSeen();
      requestAnimationFrame(() => {
        keepHeroInPlace();
        rootStyle.overflowAnchor = prevAnchor;
        // Both of these are heavy and neither is visible, so they wait for
        // idle instead of landing on the hand-off frame: a full ScrollTrigger
        // refresh, and tearing down three WebGL contexts, their composer
        // targets and the GLBs.
        const idle = (fn: () => void) =>
          typeof window.requestIdleCallback === "function"
            ? window.requestIdleCallback(fn, { timeout: 600 })
            : setTimeout(fn, 120);
        idle(() => {
          // Removing ~1370vh invalidates every other ScrollTrigger's start/end
          // (e.g. the footer's data-gsap reveals) — recompute so they still fire.
          ScrollTrigger.refresh();
          setDead(true);
        });
      });
    };
    collapseRef.current = collapse; // let the Skip button trigger the same collapse

    // THE MATCH-CUT (Gate A4 #5). The film used to end on the mark and then
    // simply dissolve, a logo standing still over a screen and a half of
    // scroll. Now the mark's line is drawn here, over the stage, from the
    // moment it comes up (scene.html leaves it to us: markLineExternal). Over
    // the hold it bends into the visitor's own payoff, wherever the
    // instrument rising underneath draws it: the left horn becomes the floor,
    // the muzzle the ramp between the strikes, the right horn the cap. Its
    // colour turns from the brand ramp to the instrument's red below $0 and
    // mint above, and it lands on the instrument's own line as the stage
    // finishes dissolving, then lets that line take over. The film's last
    // frame is the thing you can drag.
    const MARK_LINE_IN = 0.855; // scene.html: MARK1 - 0.01
    const drawMatchCut = () => {
      const svg = cutRef.current;
      const ramp = cutRampRef.current;
      const up = cutUpRef.current;
      const dn = cutDnRef.current;
      if (!svg || !ramp || !up || !dn) return;
      const hold = holdOf(scrollS);
      const appear = clamp01((progress - MARK_LINE_IN) / 0.04);
      const alpha = collapsed ? 0 : appear * (1 - clamp01((hold - 0.86) / 0.12));
      const mr = alpha > 0.002 ? win()?.markRect?.() : undefined;
      const frame = frameRef.current;
      if (!mr || !frame) {
        if (svg.style.display !== "none") svg.style.display = "none";
        return;
      }
      svg.style.display = "";
      const r = frame.getBoundingClientRect();
      const mark = BULL_MARK.map(([x, y]) => [r.left + (mr.x + x * mr.w) * r.width, r.top + (mr.y + y * mr.h) * r.height]);
      let pts = mark;
      let k = 0;
      let zeroY = -1e5;
      if (hold > 0) {
        const poly = document.querySelector<SVGPolylineElement>("[data-payoff-line]");
        const m = poly?.getScreenCTM();
        if (poly && m && poly.points.numberOfItems >= 4) {
          // [S_MIN, K1, K2, S_MAX] on the instrument, in client pixels.
          const P = [0, 1, 2, 3].map((i) => {
            const q = poly.points.getItem(i);
            return new DOMPoint(q.x, q.y).matrixTransform(m);
          });
          zeroY = new DOMPoint(0, Number(poly.dataset.zero)).matrixTransform(m).y;
          const half = mark.length / 2;
          const target = mark.map((_, i) => {
            const [a, b, t] = i < half ? [P[0], P[1], i / (half - 1)] : [P[2], P[3], (i - half) / (half - 1)];
            return [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t];
          });
          const u = clamp01((hold - 0.06) / 0.72);
          k = u * u * (3 - 2 * u);
          pts = mark.map(([x, y], i) => [x + (target[i][0] - x) * k, y + (target[i][1] - y) * k]);
        }
      }
      const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
      const width = (mr.lw * r.width + (2.5 - mr.lw * r.width) * k).toFixed(2);
      ramp.setAttribute("d", d);
      ramp.style.strokeWidth = width;
      ramp.style.opacity = (alpha * (1 - k)).toFixed(3);
      const g = cutGradRef.current;
      if (g) {
        g.setAttribute("x1", pts[0][0].toFixed(1));
        g.setAttribute("x2", pts[pts.length - 1][0].toFixed(1));
      }
      for (const p of [up, dn]) {
        p.setAttribute("d", d);
        p.style.strokeWidth = width;
        p.style.opacity = (alpha * k).toFixed(3);
      }
      cutClipUpRef.current?.setAttribute("height", String(Math.max(0, zeroY + 1e5)));
      cutClipDnRef.current?.setAttribute("y", zeroY.toFixed(1));
    };

    const applyOverlays = (now = 0) => {
      // The stage dissolves across the hold, in scroll (lib/cinema.ts, THE
      // HOLD IS THE HAND-OFF), while the landing rises under it.
      if (stickyRef.current) stickyRef.current.style.opacity = String(handoffOpacity(holdOf(scrollS)));
      drawMatchCut();
      // The Island (M32) recedes to its dot while the film is pinned, and
      // comes back as the pill, signed, where the film speaks of the visitor's
      // own position: the safety act, and the hold that hands off to the
      // landing (Gate A4 #4). A no-op unless the stage changes.
      const greet = (progress >= ACTS.safety.from && progress < ACTS.safety.to) || holdOf(scrollS) > 0;
      setIslandStage(scrollS > 0 && scrollS < 1 ? (greet ? "pill" : "dot") : null);
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
        scheduled: number,
        win: typeof CANDLE3D,
        activeRef: React.RefObject<boolean>,
        setActive: (v: boolean) => void,
        readyRef: React.RefObject<boolean>
      ) => {
        // Only a live layer covers the 2D scene: before its context exists,
        // and after one is lost, the scene draws the act itself underneath.
        const opacity = readyRef.current ? scheduled : 0;
        if (wrap.current) {
          wrap.current.style.opacity = String(opacity);
          wrap.current.style.visibility = opacity > 0.001 ? "visible" : "hidden";
        }
        // Warmed once under the curtain, post chain and all, so its first
        // visible frame is not also the frame that allocates all of that.
        const near = (scrollS <= 0 && warm < WARM_FRAMES) || (progress > win.in0 - 0.02 && progress < win.out1 + 0.02);
        if (near !== activeRef.current) {
          activeRef.current = near;
          setActive(near);
        }
      };
      if (vignetteRef.current) vignetteRef.current.style.opacity = String(1 - 0.9 * safetyLight(progress));
      driveLayer(candle3dWrapRef, candle3dOpacity(progress), CANDLE3D, candle3dActiveRef, setCandle3dActive, candle3dReadyRef);
      // The matter's layer is on for the two passages it owns. It carries no
      // parallax transform of its own: it has to land exactly on the mark.
      const matterOn = matterNear(progress);
      if (matterOn !== matterActiveRef.current) {
        matterActiveRef.current = matterOn;
        setMatterActive(matterOn);
      }
      if (matterWrapRef.current) matterWrapRef.current.style.visibility = matterOn && matterReadyRef.current ? "visible" : "hidden";
      // The scene's ring and mark, in the stage's clip space, for the matter.
      const sceneWin = win();
      const frameEl = frameRef.current;
      const stageEl = stickyRef.current;
      if (matterOn && frameEl && stageEl && sceneWin?.ringRect && sceneWin.markRect) {
        const fr = frameEl.getBoundingClientRect();
        const st = stageEl.getBoundingClientRect();
        const ndcX = (px: number) => ((px - st.left) / st.width) * 2 - 1;
        const ndcY = (py: number) => 1 - ((py - st.top) / st.height) * 2;
        const rg = sceneWin.ringRect();
        if (rg) {
          cinemaClock.stage.ring = [ndcX(fr.left + rg.cx * fr.width), ndcY(fr.top + rg.cy * fr.height), (rg.rx * fr.width * 2) / st.width, (rg.ry * fr.height * 2) / st.height];
        }
        const mk = sceneWin.markRect();
        cinemaClock.stage.mark = [ndcX(fr.left + mk.x * fr.width), ndcY(fr.top + mk.y * fr.height), (mk.w * fr.width * 2) / st.width, (mk.h * fr.height * 2) / st.height];
      }
      // THE FLOOR LINE CARRIES THE CUT (the one take). The chart clears, and
      // the one thing left standing is the line where the loss stops; it
      // glides from where the candle camera sees it to the payoff's own floor,
      // and the worst case draws itself on from there.
      const floorSvg = floorSvgRef.current;
      const floorLine = floorLineRef.current;
      if (floorSvg && floorLine) {
        const alpha = ss(0.505, 0.516, progress) * (1 - ss(0.598, 0.612, progress));
        const from = cinemaClock.stage.floor;
        const to = alpha > 0.002 ? sceneWin?.floorLine?.() : null;
        if (from && to) {
          const k = floorHandoff(progress);
          const w = floorSvg.clientWidth;
          const h = floorSvg.clientHeight;
          for (const ln of [floorLine, floorCoreRef.current]) {
            ln?.setAttribute("x1", (from[0] + (to.x0 * w - from[0]) * k).toFixed(1));
            ln?.setAttribute("y1", (from[1] + (to.y0 * h - from[1]) * k).toFixed(1));
            ln?.setAttribute("x2", (from[2] + (to.x1 * w - from[2]) * k).toFixed(1));
            ln?.setAttribute("y2", (from[3] + (to.y1 * h - from[3]) * k).toFixed(1));
          }
          floorSvg.style.opacity = alpha.toFixed(3);
          floorSvg.style.display = "";
        } else if (floorSvg.style.display !== "none") {
          floorSvg.style.display = "none";
        }
      }
      MOODS.forEach((m, i) => {
        const el = moodRefs.current[i];
        if (el) el.style.opacity = moodOpacity(progress, m).toFixed(3);
      });
      COPY_BEATS.forEach((beat, i) => {
        const el = copyRefs.current[i];
        if (!el) return;
        const o = beatOpacity(progress, beat, beat.fade);
        el.style.opacity = String(o);
        // The per-character stagger is now a NUMBER written every frame, not a
        // class flip: the CSS below derives each glyph's own 0→1 from this and
        // its index, so the reveal is f(progress) and scrubs backwards exactly
        // See beatCharT in lib/cinema.ts.
        el.style.setProperty("--t", beatCharT(progress, beat).toFixed(4));
        // "top" beats anchor at their top edge (upper third); "left" beats at
        // their left edge (the left third, beside the bull); others center. The
        // type layer parallaxes harder than the scene → real depth.
        const baseY = beat.pos === "top" || beat.pos === "left" || beat.pos === "right" ? "0px" : "-50%";
        const baseX = beat.pos === "left" || beat.pos === "right" ? "0px" : "-50%";
        el.style.transform = `translate(calc(${baseX} + ${(pxS * -16).toFixed(1)}px), calc(${baseY} + ${((1 - o) * 14).toFixed(2)}px + ${(pyS * -10).toFixed(1)}px))`;
      });
      // Layered cursor parallax: the whole composited scene drifts gently against
      // the pointer (scaled up a hair so edges never peek in). The glitch-shake
      // that rattled the whole frame through the matrix burst is gone (Gate A3
      // #7): it shook the picture, not anything in it.
      const t3 = `translate3d(${(pxS * -7).toFixed(2)}px, ${(pyS * -5).toFixed(2)}px, 0) scale(1.015)`;
      if (frameRef.current) frameRef.current.style.transform = t3;
      if (candle3dWrapRef.current) candle3dWrapRef.current.style.transform = t3;
      if (floorSvgRef.current) floorSvgRef.current.style.transform = t3;
    };

    const syncPosition = () => {
      const pos = getHeroPosition();
      if (ready && pos) win()?.setPosition?.(pos);
    };

    const renderScene = (now = 0) => {
      cinemaClock.progress = progress; // shared clock the 3D layers read
      // The matter owns the bull and the mark's particles once its model has
      // been sampled; until then, or without it, the 2D scene draws its own.
      const hideBull = matterReadyRef.current && matterBullRef.current;
      // A throw from the scene must cost one 2D frame, not the film: this runs
      // inside the rAF loop, and an uncaught error here ended the loop, which
      // froze the whole film at the last good act (2026-11-06: a scene helper
      // read an out-of-scope canvas context on the vote act's first frame).
      if (ready) {
        try {
          const sw = win();
          if (sw && cutRef.current && sw.markRect) {
            if (!sw.markLineExternal) sw.markLineExternal = true;
            sw.markFade = clamp01(holdOf(scrollS) / 0.15);
          }
          win()?.renderAt?.(
            progress,
            hideBull,
            candle3dReadyRef.current,
            now,
            pxS,
            pyS,
            matterReadyRef.current
          );
        } catch (err) {
          if (!sceneErrorLogged) {
            sceneErrorLogged = true;
            console.error("cinema scene: renderAt threw; the film keeps running", err);
          }
        }
      }
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
    // Under Lenis the scroll arrives already eased, and two lags in series
    // compound: at 5.0 the picture trailed the wheel by ~1.4 s. The follower
    // tightens so wheel-stop to film-settle stays where native scrolling had
    // it (~0.8 s, measured on the prod build); the glide is Lenis's now.
    const EASE_RATE_LENIS = LOW_END ? 9.0 : 14.0;
    let lastNow = -1;
    // Resume marker bookkeeping. Twice a second at most, and only when the film
    // has actually moved — sessionStorage is synchronous, and this loop sits
    // next to three WebGL contexts.
    let lastSave = 0;
    let savedP = -1;
    // PARKED UNDER THE CURTAIN. While the hero covers every pixel of the stage
    // (the trigger has not started, so raw scroll progress is exactly 0),
    // drawing the film is pure waste, and it was not cheap: FILM_START sits
    // inside the dive's near window, so the tunnel's WebGL loop and the 2D
    // scene redrew at full rate under an opaque hero while the visitor dragged
    // strikes on it (re-tribunal regression 8). The loop draws a short warm-up
    // first, counted from the moment the tunnel's context exists, so shaders
    // compile and the plates upload out of sight. Then it stops drawing until
    // the curtain moves.
    const WARM_FRAMES = 45;
    let warm = 0;
    let parked = false;
    const park = () => {
      parked = true;
      for (const [ref, set] of [
        [matterActiveRef, setMatterActive],
        [candle3dActiveRef, setCandle3dActive],
      ] as const) {
        if (ref.current) {
          ref.current = false;
          set(false);
        }
      }
    };
    const tick = (ts: number) => {
      if (disposed || collapsed) return;
      const now = ts / 1000;
      const dt = lastNow < 0 ? 1 / 60 : Math.min(0.05, now - lastNow);
      lastNow = now;
      if (scrollS <= 0 && Math.abs(progress - FILM_START) < 1e-4) {
        if (warm >= WARM_FRAMES) {
          if (!parked) park();
          raf = requestAnimationFrame(tick);
          return;
        }
        // a quarter-rate count if the tunnel never comes up, so a failed
        // context still parks within a few seconds
        warm += matterReadyRef.current ? 1 : 0.25;
      }
      parked = false;
      // THE FILM'S OWN TIME (M31): it runs only while the film plays and the
      // site is not paused, and every layer's ambient motion (the 2D scene's
      // and, through advanceFilm below, the 3D layers') reads it. Scroll still
      // moves the picture while paused; only what moves by itself stops.
      cinemaClock.dt = dt;
      if (!isMotionPaused()) cinemaClock.time += dt;
      // THE END IS WHERE THE PICTURE ENDS. Collapsing on ScrollTrigger's raw
      // onLeave cut the film off wherever the smoothed follower happened to
      // be, up to a few percent short, so the last frames never played and
      // the hand-off read as a hard cut (re-tribunal regression 6). Collapsing
      // as the hold BEGAN (Gate A3 #3) left the landing 80vh down, so the
      // page showed frame zero again. Collapse once the whole hold has been
      // scrolled (the landing is at the top of the screen by then), the
      // picture has caught up, and the scroll has come to rest.
      if (scrollS >= 1 && progress >= 0.999 && performance.now() - lastScrollAt > COLLAPSE_IDLE_MS) {
        collapse();
        return;
      }
      let diff = targetProgress - progress;
      // A jump (Home/End, a rail seek, a fragment link) CUTS instead of gliding:
      // easing across half the film fast-forwards every act in between, mounting
      // and compiling three WebGL layers on the way to a frame nobody asked for.
      // Ordinary scrolling never lags this far behind. A first-order follower
      // trails a steady scroll by speed / rate, and one film unit is ~1,400vh,
      // so a lag of 0.15 takes ~1,050vh/s at the native rate (630vh/s on
      // LOW_END) and ~2,900vh/s under Lenis (1,900vh/s on LOW_END). The old
      // "~8,000vh/s" here was never right (Gate A2).
      if (Math.abs(diff) > JUMP_CUT) {
        progress = targetProgress;
        diff = 0;
      }
      const k = 1 - Math.exp(-(isSmoothing() ? EASE_RATE_LENIS : EASE_RATE) * dt);
      progress = Math.abs(diff) < 0.0002 ? targetProgress : progress + diff * k;
      pxS += (cinemaClock.px - pxS) * damp(0.055, dt);
      pyS += (cinemaClock.py - pyS) * damp(0.055, dt);
      // Scroll velocity, from the page's own (the motion bus, written by
      // Lenis) rather than from how far the follower lags: the 3D cameras
      // kick their FOV when you scroll hard.
      cinemaClock.vel += (Math.min(1, Math.abs(busMotion.velocity) / 45) - cinemaClock.vel) * damp(0.08, dt);
      renderScene(cinemaClock.time);
      applyOverlays(now);
      // ONE CLOCK (M31): the 3D layers draw here, in this frame, at film time.
      advanceFilm(cinemaClock.time);
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
          const [l, p] = [el.children[0] as HTMLElement, el.children[1] as HTMLElement];
          if (l) l.textContent = hov.label;
          if (p) {
            p.textContent = hov.pct;
            p.style.color = hov.up ? "#52ffa5" : "#ff2e63";
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
          scrollS = self.progress;
          targetProgress = scrollToFilm(self.progress);
        },
        // Past the end: pin the target at the last frame. The tick collapses
        // the film once the picture has played out to it.
        onLeave: () => {
          scrollS = 1;
          targetProgress = 1;
        },
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
            tokens: resolvedTokens(section),
            mono: injectMono(w.document) ?? undefined,
            position: getHeroPosition() ?? undefined,
            insetLeft: railInset(),
          });
          ready = true;
          // initScene applies the position it was handed AFTER a font await,
          // and setPosition is dropped until `ready`: a strike dragged in that
          // window left the safety act on a stale spread (Gate A2). Push the
          // latest one now that the scene will take it.
          syncPosition();
          renderScene(cinemaClock.time);
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
    // things were wrong with that. The models are not needed until the candle
    // act (progress 0.32) and the bull (0.71), so the entrance was blocked on
    // assets nobody sees for thousands of pixels; and the layers load their
    // own, so bull-crystal.glb was fetched TWICE on every visit.
    //
    // Dropping the warmers costs nothing: each layer starts its own load when
    // it mounts, so the models are in flight while the loader finishes.
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
      // No 420ms beat here any more, and no 650ms floor above: those existed
      // to hold a scroll lock that is gone. The film reveals the moment its
      // geometry is ready, under the hero curtain.
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
      // lurch while the reader watches. Only if the reader has not moved yet:
      // never yank someone who already scrolled.
      let resumed = false;
      if (resumeAt !== null && window.scrollY < 4) {
        const range = section.offsetHeight - window.innerHeight;
        if (range > 0) {
          jumpTo(Math.round(section.offsetTop + range * filmToScroll(resumeAt)));
          resumed = true;
        }
      }
      createScrollTrigger(); // enable the scroll animation
      if (resumed && resumeAt !== null) {
        // Take the number we just scrolled TO, not ScrollTrigger's read of it.
        // The trigger caches scroll positions and reports the pre-restore
        // value on the frame it is created — measured 0.722 for a restore to
        // 0.800, i.e. the film opened a whole act early. update() puts its own
        // bookkeeping straight.
        ScrollTrigger.update();
        targetProgress = resumeAt;
        progress = resumeAt;
        renderScene(cinemaClock.time);
        applyOverlays();
      }
      setReveal(true); // fade the loading screen out
      window.setTimeout(() => { if (!disposed) setLoading(false); }, 550);
    };
    // the loader's skip: the user bails to the static homepage — the same
    // landing as a genuine scene failure, but chosen, never automatic
    bailToStaticRef.current = () => {
      if (settled || disposed) return;
      settled = true;
      window.clearInterval(creep);
      window.clearTimeout(slowTimer);
      delete document.documentElement.dataset.film;
      setIslandStage(null);
      markCinemaSeen(); // a chosen exit counts as seen — do not re-gate them
      stopCinemaAudio();
      setMode("static");
    };
    Promise.all([step(shotsLoaded), extras]).then(reveal).catch(() => {
      if (settled || disposed) return;
      settled = true;
      window.clearInterval(creep);
      window.clearTimeout(slowTimer);
      delete document.documentElement.dataset.film;
      setIslandStage(null);
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
          tokens: resolvedTokens(section),
          mono: w2 ? injectMono(w2.document) ?? undefined : undefined,
          position: getHeroPosition() ?? undefined,
          insetLeft: railInset(),
        }).then(() => {
          // Same race on every re-init: the snapshot above lands late.
          syncPosition();
          renderScene(cinemaClock.time);
        });
      }, 160);
    };
    window.addEventListener("resize", onResize);

    // The visitor can still be dragging strikes on the hero after the scene is
    // up; the safety act follows. Drawn on the next frame the film renders.
    const offPosition = onHeroPosition(syncPosition);

    return () => {
      offPosition();
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(slowTimer);
      window.clearInterval(creep);
      window.clearTimeout(sceneTimeout);
      delete document.documentElement.dataset.film;
      setIslandStage(null);
      delete globalThis.__filmToScroll;
      if (onSceneLoad) iframe.removeEventListener("load", onSceneLoad);
      if (onSceneError) iframe.removeEventListener("error", onSceneError);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", markScroll);
      window.removeEventListener("scroll", syncInert);
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
      <section
        ref={sectionRef}
        data-cinema
        // The film is light on a black stage in either theme: additive light
        // has nothing to show against paper.
        data-theme="dark"
        className="pointer-events-none relative z-20"
        // Divided by --ui-zoom for the same reason globals.css divides
        // h-screen: these are inline, so the stylesheet cannot reach them, and
        // an un-divided 1500vh would stretch the whole film by 10% and leave
        // the -100vh hand-off overlap short by the same amount.
        style={{
          height: `calc(${SCROLL_LENGTH_VH}vh / var(--ui-zoom))`,
          // The curtain: start one viewport UP, under the hero instrument, so
          // scrolling lifts frame zero off an already-pinned stage.
          marginTop: `calc(-${CURTAIN_VH}vh / var(--ui-zoom))`,
          marginBottom: "calc(-100vh / var(--ui-zoom))",
        }}
      >
      {/* Backdrop lives on the sticky wrapper (which fades via handoffOpacity), NOT
          the section — otherwise the section's opaque bg stays over the real Hero
          in the -100vh overlap and the handoff reveals black instead of the page. */}
      {/* --rail-w reserves the act rail's column (rail at left-[2.5vw] + its
          rows) as ONE shared number: the
          caption widths subtract it per side, so nothing prints over the rail. */}
      <div
        ref={stickyRef}
        className="pointer-events-none sticky top-0 h-screen w-full overflow-hidden bg-bg"
        style={{ "--rail-w": "200px" } as React.CSSProperties}
      >
        {/* The loader lives INSIDE the stage now. It used to be a fixed,
            full-viewport gate at z-120 over a scroll lock; under frame zero it
            sits beneath the hero curtain and only shows if a reader scrolls
            into the film before its geometry is ready. */}
      {loading && (
        // Not aria-hidden as a whole: it holds a real button, and a focusable
        // control inside aria-hidden is announced as nothing. The decoration
        // is hidden piece by piece instead, and the whole layer goes inert the
        // moment it starts fading out.
        <div
          inert={reveal}
          className="absolute inset-0 z-[40] flex flex-col items-center justify-center gap-7 bg-bg transition-opacity duration-500 ease-out"
          style={{ opacity: reveal ? 0 : 1, pointerEvents: reveal ? "none" : "auto" }}
        >
          <div aria-hidden className="relative flex items-center gap-2.5">
            <BullMark className="h-7 w-10" />
            <span className="font-display text-3xl tracking-tight text-fg">
              lazybull<span className="text-bull">.</span>
            </span>
          </div>
          <div aria-hidden className="relative h-px w-[16.25rem] overflow-hidden bg-border">
            <div
              className="h-full bg-[image:var(--grad-fill)] transition-[width] duration-300 ease-out"
              style={{ width: `${loadPct}%` }}
            />
          </div>
          {/* The exit is available from second 0 — for the first 10 seconds of a
              slow load this overlay used to cover the only skip button, leaving
              no way out of a locked scroll. */}
          <div className="relative flex flex-col items-center gap-3">
            <div
              aria-hidden={!slowLoad}
              className="text-[0.8125rem] text-fg-faint transition-opacity duration-500"
              style={{ opacity: slowLoad ? 1 : 0 }}
            >
              Still loading…
            </div>
            <button
              type="button"
              onClick={() => bailToStaticRef.current?.()}
              className="calm-link pointer-events-auto py-2 text-[0.875rem]"
            >
              Skip the film ›
            </button>
          </div>
        </div>
      )}
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
        {/* The candle act crossfades over the 2D scene; the matter sits above
            it (it pours into the first candle) and is otherwise transparent. */}
        <div
          ref={candle3dWrapRef}
          className="pointer-events-none absolute inset-0"
          style={{ opacity: 0, visibility: "hidden", background: "#050505" }}
        >
          <Suspense fallback={null}>
            <CandleField3D active={candle3dActive} onReady={handleCandleReady} onLost={handleCandleLost} />
          </Suspense>
        </div>
        <div ref={matterWrapRef} className="pointer-events-none absolute inset-0" style={{ visibility: "hidden" }}>
          <Suspense fallback={null}>
            <FilmMatter active={matterActive} onReady={handleMatterReady} onLost={handleMatterLost} onBull={handleMatterBull} />
          </Suspense>
        </div>
        <svg ref={floorSvgRef} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" style={{ display: "none" }}>
          <line ref={floorLineRef} stroke="var(--bear)" strokeWidth="3" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 7px rgba(255,46,99,0.7))" }} />
          <line ref={floorCoreRef} stroke="#ffd9e2" strokeWidth="0.9" strokeLinecap="round" />
        </svg>
        </>)}
        {/* One vignette over the 2D and 3D acts. The static scanline layer
            that used to sit here was a texture painted on the lens, not grain:
            it did not move with anything, and the grade belongs to the
            composers now (ToneMapping in each 3D layer). */}
        <div
          ref={vignetteRef}
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.62) 100%)" }}
        />
        {/* NOTE: no -translate-x-1/2 class here — Tailwind 4 translates via the
            native `translate` property, which would STACK with the imperative
            style.transform (-50% again) set every frame in applyOverlays and
            shove each beat half its width off-center. JS owns the transform. */}
        {beats.map((b, i) => (
          <div
            key={b.id}
            ref={(el) => { copyRefs.current[i] = el; }}
            className={`${b.pos === "left" ? "absolute text-left" : b.pos === "right" ? "absolute text-right" : "absolute left-1/2 text-center"}${b.id.startsWith("candle") ? " beat-scrim" : ""}`}
            style={{
              // "top" beats: viewport-aware — 14% of a 720px viewport bottomed
              // the heading out into the rail's top rows, so the anchor stops
              // at calc(50% - 260px) (and never above 64px on short screens).
              // "left" beats sit in the upper-left, above the bull's horns: the
              // bull fills the lower right and faces left, so beside it at
              // mid-height its head still crossed the line (Gate A2, d12).
              top:
                b.pos === "top"
                  ? "clamp(64px, 14%, calc(50% - 260px))"
                  : b.pos === "left"
                    ? "clamp(64px, 15%, calc(50% - 250px))"
                    : b.pos === "right"
                      ? "44%"
                      : "50%",
              opacity: 0,
              ...(b.pos === "right"
                ? {
                    // The empty side of a fall: the candles run from top left
                    // to bottom right, and the floor line is above this.
                    right: "6vw",
                    width: "min(460px, 36vw)",
                  }
                : b.pos === "left"
                ? {
                    // The left third, clear of the rail: the subject (the bull)
                    // is framed in the right third (Bull3D's lens shift).
                    left: "calc(2.5vw + var(--rail-w) + 24px)",
                    width: "min(520px, calc(100vw / var(--ui-zoom) * 0.5 - 2.5vw - var(--rail-w) - 48px))",
                  }
                : {
                    // Reserve the rail gutter on BOTH sides (centered text, one rail):
                    // at 768-1000px the old min(92vw, 680px) printed captions over the
                    // rail's box. 100vw divided by --ui-zoom (see the section note);
                    // 2.5vw stays raw because the rail's own left-[2.5vw] is raw.
                    width: "min(680px, calc(100vw / var(--ui-zoom) - 2 * (2.5vw + var(--rail-w) + 10px)))",
                  }),
            }}
          >
            <div
              className="font-display text-3xl tracking-tightest text-balance text-fg md:text-5xl"
              style={{ textShadow: "0 2px 22px rgba(0,0,0,0.85)" }}
            >
              {renderChars(b.heading)}
            </div>
            {b.sub && <div className="beat-sub mt-3 text-[0.9375rem] leading-relaxed text-fg-dim md:text-[1.0625rem]">{b.sub}</div>}
          </div>
        ))}
        {/* The market's mood, in one word under the line. */}
        <div aria-hidden className="pointer-events-none absolute bottom-[13%] left-1/2 h-6 w-64 -translate-x-1/2 text-center text-[0.9375rem] text-fg-dim">
          {MOODS.map((m, i) => (
            <span
              key={m.word}
              ref={(el) => {
                moodRefs.current[i] = el;
              }}
              className="absolute inset-0"
              style={{ opacity: 0 }}
            >
              {m.word}
            </span>
          ))}
        </div>
        {/* live price tag — follows the hovered 3D candle */}
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute left-0 top-0 z-30 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1 t-data text-[0.75rem] transition-opacity duration-150"
          style={{ opacity: 0 }}
        >
          <span className="text-fg" />
          <span />
        </div>
        {/* The rail seek's dip: over every layer of the picture and its copy
            (z-20), under the rail and the price tag (z-30), so the control you
            clicked never blinks. */}
        <div ref={dipRef} aria-hidden className="pointer-events-none absolute inset-0 z-[25] bg-bg opacity-0" />
        {/* The film's spine, and its only control: the acts, sound, and skip.
            The centre "Skip intro" pill that used to sit beside it is gone; it
            duplicated the rail's skip row, sat over the dive's best frame, and
            was one of eleven controls the keyboard could reach under the
            curtain (re-tribunal regression 7). Phones have their own film. */}
        <CinemaRail
          ref={railRef}
          onSkip={handleSkip}
          sound={sound}
          onSound={() => {
            if (sound) {
              disableCinemaAudio();
              setSound(false);
            } else {
              setSound(enableCinemaAudio());
            }
          }}
          onSeek={(target) => {
            const sec = sectionRef.current;
            if (!sec) return;
            const range = sec.offsetHeight - window.innerHeight;
            // Never seek under the curtain: act one starts at FILM_START, and
            // filmToScroll(FILM_START) is 0, the top of the page, so row 01
            // used to drop the hero back over the film it was opening.
            const p = Math.max(target, FILM_LIFT_END);
            const y = sec.offsetTop + range * filmToScroll(p);
            // A neighbouring act glides. Anything further CUTS behind a short
            // dip to the stage colour, so the film never fast-forwards through
            // the acts in between (Gate A2, ranked item 7): the follower
            // already cuts a jump this size, and the dip hides the cut and the
            // next act's layers coming up.
            const here = scrollToFilm(Math.min(1, Math.max(0, (window.scrollY - sec.offsetTop) / range)));
            const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            if (Math.abs(p - here) <= JUMP_CUT && !reduced) {
              glideTo(y, { duration: 1.1 });
              return;
            }
            const dip = dipRef.current;
            if (!dip || reduced) {
              jumpTo(y);
              return;
            }
            dip.getAnimations().forEach((a) => a.cancel());
            dip
              .animate([{ opacity: 0 }, { opacity: 1 }], { duration: 90, easing: "ease-in", fill: "forwards" })
              .finished.then(() => {
                jumpTo(y);
                // two frames: the follower cuts, then the new act draws
                requestAnimationFrame(() =>
                  requestAnimationFrame(() => {
                    dip.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-out", fill: "forwards" });
                  })
                );
              })
              .catch(() => {});
          }}
        />
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
          @media (prefers-reduced-motion: reduce) {
            .beat-char, .beat-sub { --c: 1; opacity: 1; transform: none; filter: none; }
            .lab-caret { animation: none; }
          }
        `}</style>
      </div>
      </section>
      {/* The match-cut's line (drawMatchCut): over the stage and the landing
          both, because it travels from one to the other. */}
      {typeof document !== "undefined" &&
        createPortal(
          <svg
            ref={cutRef}
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[var(--z-dialog)]"
            style={{ display: "none", width: "100vw", height: "100vh" }}
          >
            <defs>
              <linearGradient ref={cutGradRef} id="lb-cut-ramp" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#7b5cff" />
                <stop offset="0.52" stopColor="#4d8dff" />
                <stop offset="1" stopColor="#6dffc0" />
              </linearGradient>
              <clipPath id="lb-cut-up" clipPathUnits="userSpaceOnUse">
                <rect ref={cutClipUpRef} x="-100000" y="-100000" width="300000" height="0" />
              </clipPath>
              <clipPath id="lb-cut-dn" clipPathUnits="userSpaceOnUse">
                <rect ref={cutClipDnRef} x="-100000" y="0" width="300000" height="300000" />
              </clipPath>
            </defs>
            <path
              ref={cutRampRef}
              fill="none"
              stroke="url(#lb-cut-ramp)"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 9px rgba(110,120,255,0.55))" }}
            />
            <path ref={cutUpRef} fill="none" stroke="var(--bull)" strokeLinejoin="round" clipPath="url(#lb-cut-up)" />
            <path ref={cutDnRef} fill="none" stroke="var(--bear)" strokeLinejoin="round" clipPath="url(#lb-cut-dn)" />
          </svg>,
          document.body
        )}
    </>
  );
}

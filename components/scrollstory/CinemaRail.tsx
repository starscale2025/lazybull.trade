"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ACTS } from "@/lib/cinema";

/**
 * THE ACT RAIL — the film's spine.
 *
 * A 13,500px pinned film had no indication of where you were in it, how many
 * acts there were, or how much was left. The only chrome was a "SKIP INTRO"
 * pill parked dead centre over the dive corridor's best panel — which both
 * defaced the signature shot and read as the film apologising for itself.
 *
 * This replaces it: the acts as numbered rows down the left edge, a hairline
 * filled to progress, the current act marked, then two controls: sound, and the
 * skip, demoted to the last row where it reads as one option among several
 * rather than an escape hatch.
 *
 * SOUND LIVES HERE. Its only switch used to be a chip on the loader, which sits
 * under the hero curtain now and unmounts half a second after the film
 * reveals, so the score was unreachable for almost everyone (re-tribunal
 * regression 1). PLAN.md decision 3 puts it in the chapter bar, not in frame
 * zero, and the chapter bar is this.
 *
 * TWO THINGS IT DELIBERATELY IS NOT:
 *
 * 1. It is NOT React state. The film already runs one damped follower and one
 *    per-frame DOM pass; a rail driven by useState would re-render nine rows
 *    sixty times a second next to three WebGL contexts. `update()` below is
 *    called from the cinema's existing applyOverlays and writes styles directly.
 * 2. It is NOT a scrubber. The rows are real <button>s that scroll to an act's
 *    start, so the film is navigable by keyboard and by screen reader, but the
 *    scroll position remains the single source of truth.
 *
 * The Dock invariant in scripts/guard.mjs bans `fixed` + `bottom-*` + `right-*`
 * in one className. This is a LEFT rail and never trips it.
 */

// Boot and the desk are retired: frame zero (the hero instrument) replaced
// them in 2026-11 and the film now starts at the dive, so they are never on
// screen and have no business in the film's own table of contents.
const ACT_ORDER = [
  "dive",
  "regime",
  "candle",
  "safety",
  "consensus",
  "bull",
  "matrix",
] as const;

/** What each act is actually about, for the label and the announcer. */
const ACT_LABEL: Record<(typeof ACT_ORDER)[number], string> = {
  dive: "the dive",
  regime: "regime",
  candle: "the crash",
  safety: "your worst case",
  consensus: "the vote",
  bull: "conviction",
  matrix: "welcome in",
};

export type CinemaRailHandle = {
  /** Called from the cinema's existing per-frame pass. No rAF of its own. */
  update: (progress: number) => void;
};

export const CinemaRail = forwardRef<
  CinemaRailHandle,
  {
    onSkip: () => void;
    onSeek: (progress: number) => void;
    sound: boolean;
    onSound: () => void;
  }
>(function CinemaRail({ onSkip, onSeek, sound, onSound }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const lastAct = useRef<number>(-1);
  // Where each act row's tick sits along the fill, measured once and again on
  // resize: a layout read, so never per frame.
  const geo = useRef<{ h: number; ticks: number[] } | null>(null);
  useEffect(() => {
    const drop = () => {
      geo.current = null;
    };
    window.addEventListener("resize", drop);
    return () => window.removeEventListener("resize", drop);
  }, []);
  const measure = () => {
    const fill = fillRef.current;
    if (!fill?.offsetHeight) return null;
    const top = fill.offsetTop;
    const ticks = rowRefs.current.map((el) => (el ? el.offsetTop + el.offsetHeight / 2 - top : 0));
    return { h: fill.offsetHeight, ticks };
  };

  useImperativeHandle(ref, () => ({
    update(progress: number) {
      // the whole rail fades with the film's own outro
      const host = hostRef.current;
      if (host) {
        const o = progress < 0.86 ? 1 : Math.max(0, 1 - (progress - 0.86) / 0.07);
        host.style.opacity = String(o);
        host.style.pointerEvents = o > 0.1 ? "auto" : "none";
      }
      // Which act is the viewer actually LOOKING at?
      //
      // Not simply which ACTS window progress falls in. The scene crossfades
      // neighbours by ±0.02 (see actEnv in scene.html), so for the first ~0.02
      // of a new act the previous one is still the picture on screen. Switching
      // on the raw boundary made the rail read "05 the crash" over a regime
      // frame. Biasing by the same crossfade width makes the label agree with
      // the pixels, which is the entire job of an act rail.
      const CROSSFADE = 0.02;
      const seen = progress - CROSSFADE;
      let act = 0;
      let frac = 0; // how far through that act
      for (let i = 0; i < ACT_ORDER.length; i++) {
        const a = ACTS[ACT_ORDER[i]];
        if (seen >= a.from && seen < a.to) {
          act = i;
          frac = (seen - a.from) / (a.to - a.from);
          break;
        }
        if (seen >= a.to) {
          act = i;
          frac = 1;
        }
      }
      // THE FILL TELLS THE TRUTH ABOUT THE ROWS. It used to be raw film
      // progress, which is already 0.15 when the film starts (boot and the
      // desk are retired) and is linear in progress while the rows are evenly
      // spaced and the acts are not, so it sat 15% down before act one and
      // drifted off the current row act by act. Now it reaches a row's tick
      // as that act begins and the next row's as it ends.
      const fill = fillRef.current;
      if (fill) {
        const g = geo.current ?? (geo.current = measure());
        if (g) {
          const from = g.ticks[act];
          const to = act + 1 < g.ticks.length ? g.ticks[act + 1] : g.h;
          const y = from + (to - from) * Math.max(0, Math.min(1, frac));
          fill.style.transform = `scaleY(${Math.max(0, Math.min(1, y / g.h)).toFixed(4)})`;
        }
      }
      if (act === lastAct.current) return;
      lastAct.current = act;
      rowRefs.current.forEach((el, i) => {
        if (!el) return;
        const on = i === act;
        el.dataset.on = on ? "1" : "0";
        if (on) el.setAttribute("aria-current", "step");
        else el.removeAttribute("aria-current");
      });
      // one polite announcement per act change — not per frame
      if (liveRef.current) {
        liveRef.current.textContent = `Act ${act + 1} of ${ACT_ORDER.length}: ${ACT_LABEL[ACT_ORDER[act]]}`;
      }
    },
  }));

  return (
    <div
      ref={hostRef}
      className="cinema-rail pointer-events-auto absolute left-[2.5vw] top-1/2 z-30 hidden -translate-y-1/2 md:block"
    >
      <p ref={liveRef} aria-live="polite" className="sr-only" />
      <nav aria-label="Film acts" className="relative flex flex-col gap-2 pl-3">
        {/* the spine: a hairline the progress fills top-down */}
        <span aria-hidden className="absolute left-0 top-1 bottom-1 w-px bg-[var(--border)]" />
        <span
          ref={fillRef}
          aria-hidden
          className="absolute left-0 top-1 bottom-1 w-px origin-top bg-bull"
          style={{ transform: "scaleY(0)", boxShadow: "var(--glow-rail)" }}
        />
        {ACT_ORDER.map((act, i) => (
          <button
            key={act}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            type="button"
            data-on="0"
            onClick={() => onSeek(ACTS[act].from)}
            aria-label={`Act ${i + 1} of ${ACT_ORDER.length}: ${ACT_LABEL[act]}`}
            className="rail-row group flex items-center gap-2 text-left"
          >
            <span className="rail-tick block h-px w-3 bg-fg-dim" aria-hidden />
            <span className="rail-num t-data text-[0.625rem] text-fg-dim" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="rail-label t-chrome text-fg-dim" aria-hidden>
              {ACT_LABEL[act]}
            </span>
          </button>
        ))}
        {/* Sound: OFF until asked, always. Turning it on is the browser's
            required gesture by construction. */}
        <button
          type="button"
          onClick={onSound}
          aria-pressed={sound}
          className="rail-row rail-skip mt-1 flex items-center gap-2 text-left"
        >
          <span className="rail-tick block h-px w-3 bg-fg-dim" aria-hidden />
          <span className="t-chrome text-fg-dim">{sound ? "sound on" : "sound off"}</span>
        </button>
        {/* Skip demoted to the rail's last row: one option among several, on
            the left edge, instead of a pill parked over the dive corridor. */}
        <button
          type="button"
          onClick={onSkip}
          className="rail-row rail-skip flex items-center gap-2 text-left"
        >
          <span className="rail-tick block h-px w-3 bg-fg-dim" aria-hidden />
          <span className="t-chrome text-fg-dim">skip film ↓</span>
        </button>
      </nav>
    </div>
  );
});

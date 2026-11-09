"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ACTS, CANDLE_LAB } from "@/lib/cinema";
import { CANDLE_CRASH_AT } from "@/lib/candle-series";
import { FILM_LIFT_END } from "./cinema-metrics";

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
//
// The candle act is three rows, not one. Called "the crash" from end to end,
// the rail labelled a rising market a crash for a third of the act and the
// lab finale for another third (Gate A2): it reads climb · crash · lab now,
// split where the colour script changes room (lib/cinema.ts).
/** What each act is actually about, for the label and the announcer, and where it runs. */
const RAIL = [
  { key: "dive", label: "the dive", ...ACTS.dive },
  { key: "regime", label: "regime", ...ACTS.regime },
  // The crash row turns at the first red print, the frame the sound and the
  // camera hit too (lib/candle-series.ts), not at the copy's pre-lap.
  { key: "climb", label: "the climb", from: ACTS.candle.from, to: CANDLE_CRASH_AT },
  { key: "crash", label: "the crash", from: CANDLE_CRASH_AT, to: CANDLE_LAB.from },
  { key: "lab", label: "the lab", from: CANDLE_LAB.from, to: ACTS.candle.to },
  { key: "safety", label: "your worst case", ...ACTS.safety },
  { key: "consensus", label: "the vote", ...ACTS.consensus },
  { key: "bull", label: "conviction", ...ACTS.bull },
  { key: "mark", label: "welcome in", ...ACTS.mark },
] as const;

/** Rows that begin mid-shot (a cut inside the candle act, not a new act). */
const IN_SHOT = new Set<string>(["crash", "lab"]);

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
      // The rail arrives as the curtain finishes lifting, and leaves with the
      // film's own outro. It used to stand there from the first pixel of the
      // lift, half under the hero, offering controls nobody could see the
      // point of yet (Gate A2, d03).
      const host = hostRef.current;
      if (host) {
        const arrive = Math.max(0, Math.min(1, (progress - FILM_LIFT_END) / 0.012));
        const leave = progress < 0.86 ? 1 : Math.max(0, 1 - (progress - 0.86) / 0.07);
        const o = arrive * leave;
        host.style.opacity = String(o);
        host.style.pointerEvents = o > 0.1 ? "auto" : "none";
      }
      // Which act is the viewer actually LOOKING at?
      //
      // Not simply which ACTS window progress falls in. The scene crossfades
      // neighbouring ACTS by ±0.02 (see actEnv in scene.html), so for the first
      // ~0.02 of a new act the previous one is still the picture on screen.
      // Switching on the raw boundary made the rail read "05 the crash" over a
      // regime frame, so those boundaries are pushed back by the crossfade.
      // The candle act's own splits (climb · crash · lab) are cuts inside one
      // shot, with no crossfade: biasing them too kept "the climb" up over the
      // first red candles (Gate A3 #5), so they switch exactly where they are.
      const CROSSFADE = 0.02;
      const starts = RAIL.map((r) => r.from + (IN_SHOT.has(r.key) ? 0 : CROSSFADE));
      let act = 0;
      for (let i = 0; i < RAIL.length; i++) if (progress >= starts[i]) act = i;
      const end = act + 1 < RAIL.length ? starts[act + 1] : RAIL[act].to + CROSSFADE;
      const frac = Math.max(0, Math.min(1, (progress - starts[act]) / Math.max(1e-6, end - starts[act])));
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
          // The last act fills a little past its own tick, never on down the
          // spine past the sound and skip rows, which are not acts.
          const to =
            act + 1 < g.ticks.length ? g.ticks[act + 1] : from + (from - (g.ticks[act - 1] ?? 0)) * 0.45;
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
        liveRef.current.textContent = `Act ${act + 1} of ${RAIL.length}: ${RAIL[act].label}`;
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
          className="absolute left-0 top-1 bottom-1 w-px origin-top bg-[linear-gradient(180deg,#8f73ff,#5c9aff_55%,#52ffa5)]"
          style={{ transform: "scaleY(0)", boxShadow: "var(--glow-rail)" }}
        />
        {RAIL.map((row, i) => (
          <button
            key={row.key}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            type="button"
            data-on="0"
            onClick={() => onSeek(row.from)}
            aria-label={`Act ${i + 1} of ${RAIL.length}: ${row.label}`}
            className="rail-row group flex items-center gap-2 text-left"
          >
            <span className="rail-tick block h-px w-3 bg-fg-dim" aria-hidden />
            <span className="rail-num t-data text-[0.625rem] text-fg-dim" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="rail-label t-chrome text-fg-dim" aria-hidden>
              {row.label}
            </span>
          </button>
        ))}
        {/* Sound: OFF until asked, always. Turning it on is the browser's
            required gesture by construction. One fixed name, with aria-pressed
            carrying the state: a label that changed under a toggle announced
            "sound off, pressed" (Gate A2). The on/off word is for the eye. */}
        <button
          type="button"
          onClick={onSound}
          aria-pressed={sound}
          className="rail-row rail-skip mt-1 flex items-center gap-2 text-left"
        >
          <span className="rail-tick block h-px w-3 bg-fg-dim" aria-hidden />
          {/* A speaker and its level (Gate A3 #10): the row reads as sound at
              a glance, and the bars stand up when it is on. */}
          <svg aria-hidden viewBox="0 0 16 12" className={`h-2.5 w-3.5 ${sound ? "text-bull" : "text-fg-dim"}`} fill="none">
            <path d="M1 4.2h2.6L7 1.5v9L3.6 7.8H1z" fill="currentColor" />
            <path d="M10 4.6v2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity={sound ? 1 : 0.35} />
            <path d="M12.4 3.2v5.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity={sound ? 1 : 0.35} />
            <path d="M14.8 1.8v8.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity={sound ? 1 : 0.35} />
          </svg>
          <span className="t-chrome text-fg-dim">
            sound <span aria-hidden className={sound ? "text-bull" : undefined}>{sound ? "on" : "off"}</span>
          </span>
        </button>
        {/* Skip demoted to the rail's last row: one option among several, on
            the left edge, instead of a pill parked over the dive corridor. */}
        <button
          type="button"
          onClick={onSkip}
          className="rail-row rail-skip flex items-center gap-2 text-left"
        >
          <span className="rail-tick block h-px w-3 bg-fg-dim" aria-hidden />
          <span className="t-chrome text-fg-dim">skip the film ↓</span>
        </button>
      </nav>
    </div>
  );
});

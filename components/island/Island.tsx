"use client";

/**
 * THE ISLAND (M32, 2026-11-09), from the owner's Live Activity reference: a
 * black capsule that holds one live fact: a small mint label, one big number,
 * and an arc of segments with the current one lit, a raised mint pill with a
 * glyph in it.
 *
 * At rest it is a compact pill under the page's chrome: the nav, or frame
 * zero's ticker tape. With no chrome in view it recedes to its dot at the top
 * edge, and so it does while the film is pinned, except where the film speaks
 * of the visitor's own position (lib/island.ts, setIslandStage). It opens on
 * hover, on a keyboard focus or a tap, and by itself for a few seconds when
 * what it holds changes (never in the film), then folds back. There is only
 * ever one (lib/island.ts).
 *
 * The Island is black in either theme, so its colours are fixed values, not
 * the page's tokens (on paper, --fg is near black and vanished on it).
 *
 * Calm (M33): pure black, mint as its only accent, the reading sans, springs
 * that can be interrupted. Under reduced motion or the site's pause, motion's
 * MotionConfig (components/MotionProvider.tsx) turns the spring into an
 * instant change and the content simply fades.
 *
 * Accessibility: the capsule is a button (aria-expanded; aria-controls only
 * while there is a panel to control) that opens and closes it. A keyboard
 * focus opens it and leaving it folds it; a pointer's focus does not, or a
 * click would open and toggle shut in one go. Escape closes it. While it is
 * mounted the page's scroll-padding grows by its height (globals.css), so a
 * focused control never scrolls in under it. A polite live region says the publisher's
 * `announce` line only when that line changes, so a drag on the page below
 * does not make it talk over the page's own announcements.
 */

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getIslandStage, useIsland, useIslandStage, type IslandGlyph, type IslandState } from "@/lib/island";
import { RollingNumber } from "@/components/motion/RollingNumber";

const SPRING = { type: "spring", stiffness: 380, damping: 30, mass: 0.9 } as const;
const HOLD_MS = 4000;
const UNDER_NAV = 8;

// ── the dial ─────────────────────────────────────────────────────────────────
// A wide dial whose rim rises through the lower right of the card and runs off
// its edge, as in the reference. It turns rather than relights: the lit
// segment always sits at ANCHOR, and when it changes the whole dial rotates
// to bring the new one there. Angles are in screen space (y down), so the top
// of the circle is -90°.
const CX = 300;
const CY = 300;
const R = 230;
const ANCHOR = -96;
const STEP = 18; // degrees per segment, gap included
const STROKE = 22;
const GAP = ((STROKE + 7) / R) * (180 / Math.PI); // round caps eat into the gap

const rad = (d: number) => (d * Math.PI) / 180;
const at = (d: number) => [CX + R * Math.cos(rad(d)), CY + R * Math.sin(rad(d))] as const;
function arc(mid: number) {
  const [x1, y1] = at(mid - (STEP - GAP) / 2);
  const [x2, y2] = at(mid + (STEP - GAP) / 2);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function Glyph({ kind, x, y }: { kind: IslandGlyph; x: number; y: number }) {
  // 14px line glyphs, drawn in the pill's own dark green-black.
  const t = `translate(${(x - 7).toFixed(1)} ${(y - 7).toFixed(1)})`;
  const stroke = { stroke: "#03140b", strokeWidth: 1.7, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return kind === "payoff" ? (
    // The spread's own shape: the floor, the ramp between the strikes, the cap.
    // (An arrow onto a line read as "download".)
    <g transform={t}>
      <path d="M1 10.5h3.8l4.4-7h3.8" {...stroke} />
    </g>
  ) : (
    <g transform={t}>
      <circle cx="7" cy="7" r="5.5" {...stroke} />
      <path d="M7 4v3.2l2.2 1.4" {...stroke} />
    </g>
  );
}

function Dial({ segments, active, glyph }: Pick<IslandState, "segments" | "active" | "glyph">) {
  const uid = useId().replace(/:/g, "");
  const n = Math.max(2, Math.min(12, Math.round(segments)));
  const lit = Math.max(0, Math.min(n - 1, Math.round(active)));
  const [gx, gy] = at(ANCHOR);
  return (
    <svg aria-hidden viewBox="0 0 360 156" className="pointer-events-none absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id={`${uid}-mint`} gradientUnits="userSpaceOnUse" x1={gx - 30} y1={gy - 10} x2={gx + 30} y2={gy + 10}>
          <stop offset="0" stopColor="#8affc6" />
          <stop offset="1" stopColor="#2fd98a" />
        </linearGradient>
        {/* userSpaceOnUse: a stroked arc's bounding box ignores the stroke,
            so a bbox-relative region clipped the glow into a hard box. */}
        <filter id={`${uid}-glow`} filterUnits="userSpaceOnUse" x="0" y="0" width="360" height="156">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <radialGradient id={`${uid}-well`} cx={CX} cy={CY} r={R + 40} gradientUnits="userSpaceOnUse">
          <stop offset="0.82" stopColor="#0c2a1c" stopOpacity="0.5" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        {/* The dial fades out under the copy on the left. */}
        <linearGradient id={`${uid}-fade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.28" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id={`${uid}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="360" height="156">
          <rect width="360" height="156" fill={`url(#${uid}-fade)`} />
        </mask>
      </defs>
      <g mask={`url(#${uid}-mask)`}>
        <circle cx={CX} cy={CY} r={R + 40} fill={`url(#${uid}-well)`} />
        <g
          className="island-dial"
          style={{ transform: `rotate(${-lit * STEP}deg)`, transformOrigin: `${CX}px ${CY}px` }}
        >
          {Array.from({ length: n }, (_, i) =>
            i === lit ? null : (
              <path key={i} d={arc(ANCHOR + i * STEP)} stroke="#17231d" strokeWidth={STROKE} strokeLinecap="round" fill="none" />
            )
          )}
        </g>
      </g>
      {/* The lit segment stays put at the anchor; the dial turns under it. */}
      <path d={arc(ANCHOR)} stroke="#52ffa5" strokeWidth={STROKE + 8} strokeLinecap="round" fill="none" filter={`url(#${uid}-glow)`} opacity="0.6" />
      <path d={arc(ANCHOR)} stroke={`url(#${uid}-mint)`} strokeWidth={STROKE + 2} strokeLinecap="round" fill="none" />
      <Glyph kind={glyph} x={gx} y={gy} />
    </svg>
  );
}

export function Island() {
  const state = useIsland();
  const stage = useIslandStage();
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(12);
  // Under the page's chrome (a nav or the ticker) the pill has somewhere to
  // sit; with none in view it would sit on the page's content, so it recedes.
  const [anchored, setAnchored] = useState(true);
  const form: "dot" | "pill" = stage ?? (anchored ? "pill" : "dot");
  const [said, setSaid] = useState("");
  const hold = useRef(0);
  const hovering = useRef(false);
  const lastValue = useRef<string | null>(null);
  const panelId = useId();

  const fold = useCallback((after = 0) => {
    window.clearTimeout(hold.current);
    hold.current = window.setTimeout(() => {
      if (!hovering.current) setOpen(false);
    }, after);
  }, []);

  // News opens it for a moment: a first appearance, or a new value.
  useEffect(() => {
    if (!state) {
      lastValue.current = null;
      setOpen(false);
      return;
    }
    if (state.value !== lastValue.current) {
      lastValue.current = state.value;
      // On a phone the open card would cover half the screen, so news only
      // updates the pill there; a tap opens it. Nor does it open over the film.
      if (window.matchMedia("(max-width: 639px)").matches || getIslandStage()) return;
      setOpen(true);
      fold(HOLD_MS);
    }
  }, [state, fold]);

  // The announcement, only when the publisher's line changes.
  useEffect(() => {
    if (state && state.announce !== said) setSaid(state.announce);
  }, [state, said]);

  // Sit under the chrome when some is on screen, else recede at the top edge.
  useEffect(() => {
    if (!state) return;
    let raf = 0;
    const place = () => {
      raf = 0;
      let y = 0;
      const navs = document.querySelectorAll<HTMLElement>(".nav-bar:not([data-nav-hidden]) .nav-pill");
      navs.forEach((n) => {
        const r = n.getBoundingClientRect();
        // Only a nav at the top counts (stuck, or resting under the ticker
        // tape): one still scrolling in from further down the page is not
        // where the top edge is.
        if (r.height > 0 && r.top >= -1 && r.top <= 80) y = Math.max(y, r.bottom);
      });
      // Frame zero's ticker tape (TickerBar), while any of it is on screen.
      document.querySelectorAll<HTMLElement>("[data-island-anchor]").forEach((n) => {
        const r = n.getBoundingClientRect();
        if (r.height > 0 && r.bottom > 8 && r.top <= 80) y = Math.max(y, r.bottom);
      });
      setAnchored(y > 0);
      setTop(y > 0 ? Math.round(y + UNDER_NAV) : 12);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(place);
    };
    place();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    // The nav slides away on the way down (NavAutoHide); follow it when its
    // slide ends, which no scroll event reports.
    document.addEventListener("transitionend", queue);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
      document.removeEventListener("transitionend", queue);
    };
  }, [state]);

  useEffect(() => () => window.clearTimeout(hold.current), []);

  // Room for it in the page's scroll-padding while it is mounted (SC 2.4.11).
  useEffect(() => {
    if (!state) return;
    document.documentElement.dataset.island = "";
    return () => {
      delete document.documentElement.dataset.island;
    };
  }, [state]);

  // The film takes the Island over (setIslandStage): fold an open card.
  useEffect(() => {
    if (stage) setOpen(false);
  }, [stage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {said}
      </div>
      <AnimatePresence>
        {state && (
          <motion.div
            key="island"
            initial={{ opacity: 0, y: -8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.92 }}
            transition={SPRING}
            className="island-root pointer-events-none fixed inset-x-0 z-[46] flex justify-center px-3 transition-[top] duration-500 [transition-timing-function:var(--ease-settle)]"
            style={{ top: `calc(${stage ? 12 : top}px + env(safe-area-inset-top, 0px))` }}
          >
            <motion.div
              layout
              transition={SPRING}
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                hovering.current = true;
                window.clearTimeout(hold.current);
                setOpen(true);
              }}
              onPointerLeave={(e) => {
                if (e.pointerType !== "mouse") return;
                hovering.current = false;
                fold(500);
              }}
              onBlur={(e) => {
                // Focus left the capsule (not just moved to its link): fold.
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                if (!hovering.current) setOpen(false);
              }}
              className="island pointer-events-auto relative overflow-hidden bg-black text-[#f5f5f0]"
              style={{
                width: open ? "min(360px, calc(100vw - 24px))" : "auto",
                height: open ? 156 : form === "dot" ? 24 : 38,
                borderRadius: open ? 34 : form === "dot" ? 12 : 19,
              }}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? panelId : undefined}
                aria-label={`${state.label}: ${state.value}, ${state.caption}. ${open ? "Close" : "Open"} the live activity.`}
                onClick={() => {
                  setOpen((o) => !o);
                  window.clearTimeout(hold.current);
                }}
                onFocus={(e) => {
                  if (!e.currentTarget.matches(":focus-visible")) return;
                  window.clearTimeout(hold.current);
                  setOpen(true);
                }}
                className="absolute inset-0 z-10 cursor-pointer rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bull"
              />
              <AnimatePresence initial={false} mode="popLayout">
                {open ? (
                  <motion.div
                    key="open"
                    id={panelId}
                    initial={{ opacity: 0, filter: "blur(6px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(6px)" }}
                    transition={{ duration: 0.22 }}
                    className="absolute inset-0"
                  >
                    <Dial segments={state.segments} active={state.active} glyph={state.glyph} />
                    <div className="relative px-6 pt-5">
                      <div className="text-[0.8125rem] font-semibold tracking-[-0.005em] text-[#52ffa5]">{state.label}</div>
                      <RollingNumber
                        value={state.value}
                        className="mt-1 text-[1.875rem] font-semibold leading-none tracking-[-0.03em] text-[#f5f5f0]"
                      />
                      <div className="mt-1.5 max-w-[10rem] text-[0.75rem] leading-snug text-[#f5f5f0]/60">{state.caption}</div>
                    </div>
                    {state.href && (
                      <Link
                        href={state.href}
                        className="absolute right-5 top-[1.15rem] z-20 text-[0.8125rem] font-medium text-[#f5f5f0]/60 transition-colors hover:text-[#f5f5f0]"
                      >
                        {state.hrefLabel ?? "Open"} <span aria-hidden>›</span>
                      </Link>
                    )}
                  </motion.div>
                ) : form === "dot" ? (
                  <motion.div
                    key="dot"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex h-full items-center px-2"
                  >
                    <span aria-hidden className="size-2 rounded-full bg-[#52ffa5] shadow-[0_0_10px_rgba(82,255,165,0.7)]" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="compact"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex h-full items-center gap-2.5 whitespace-nowrap pl-3.5 pr-4"
                  >
                    <span aria-hidden className="size-2 rounded-full bg-[#52ffa5] shadow-[0_0_10px_rgba(82,255,165,0.7)]" />
                    <span className="text-[0.8125rem] font-medium text-[#52ffa5]">{state.label}</span>
                    <RollingNumber value={state.value} className="text-[0.8125rem] font-semibold text-[#f5f5f0]" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

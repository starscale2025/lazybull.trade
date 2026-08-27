"use client";

// THE DESK — the split-screen backbone of the redesigned /learn (plan "The
// Desk", phase L0). A run of demo chapters shares ONE sticky terminal on the
// right; the editorial copy for each chapter scrolls past on the left. As a
// chapter crosses the viewport middle an IntersectionObserver flips
// `active`, and the terminal swaps to that chapter's live demo with a
// one-beat CRT channel-flicker. The demo is never off-screen.
//
// Only the ACTIVE demo is mounted (keyed remount), so heavy cells — the §06
// 3D greek surface — cost nothing until you reach them and unmount when you
// leave. Below lg the split collapses: each chapter renders its copy followed
// by its demo inline, no pin.
//
// Motion rides the shared ambient clock elsewhere; here the only animation is
// the CSS swap, which self-limits to one shot and respects reduced-motion.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Predict, type PredictConfig } from "./Predict";

export type Regime = "trend" | "random" | "revert" | "risk" | "options";

// The regime → accent used for the living-page hue. Set inline on .learn-hue
// so the DECLARED value changes each swap and `transition: color` fires
// (a var that mutates underneath a transition freezes — the WONK lesson).
const ACCENT: Record<Regime, string> = {
  trend: "var(--bull)",
  random: "var(--fg-dim)",
  revert: "var(--cyan)",
  risk: "var(--amber)",
  options: "var(--plasma)",
};

export type DeskChapter = {
  num: string;
  id: string;
  label: string;
  regime: Regime;
  hint: string; // terminal affordance, e.g. "DRAG THE KNOB →"
  headline: ReactNode;
  thesis: ReactNode;
  body: ReactNode;
  predict?: PredictConfig; // "call your shot" quiz shown in the copy
  aside?: ReactNode; // optional extra left content (stat strips, links)
  takeaway?: ReactNode;
  demo: ReactNode; // the interactive cell — mounted only while active
};

/** null until mounted (SSR-safe), then true/false. Reads innerWidth on a
    resize listener rather than a matchMedia change event — resize is more
    reliable across environments (some miss the mql 'change'). */
function useIsDesktop(): boolean | null {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const check = () => setDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return desktop;
}

export function SplitDesk({ chapters }: { chapters: DeskChapter[] }) {
  const isDesktop = useIsDesktop();
  const [active, setActive] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const prevActive = useRef(0);

  // Track which chapter owns the viewport middle. Chosen deliberately over an
  // IntersectionObserver: IO reports nothing while the document is
  // visibility:hidden (background tabs, the test harness), whereas a direct
  // scroll read keeps working. The read is a handful of getBoundingClientRect
  // calls per scroll event (already frame-throttled by the browser) and only
  // commits state when the winning index actually changes.
  useEffect(() => {
    if (isDesktop !== true) return;
    const compute = () => {
      const mid = window.innerHeight / 2;
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < sectionRefs.current.length; i++) {
        const el = sectionRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const dist = Math.abs((r.top + r.bottom) / 2 - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      }
      setActive((prev) => (prev === best ? prev : best));
    };
    compute();
    window.addEventListener("scroll", compute, { passive: true });
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute);
      window.removeEventListener("resize", compute);
    };
  }, [isDesktop, chapters.length]);

  // One-beat channel flicker on swap.
  useEffect(() => {
    if (active === prevActive.current) return;
    prevActive.current = active;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSwapping(true);
    const t = setTimeout(() => setSwapping(false), 320);
    return () => clearTimeout(t);
  }, [active]);

  const current = chapters[active];

  // ── mobile / pre-mount: stacked, demo inline ─────────────────────────────
  if (isDesktop !== true) {
    return (
      <div className="border-b border-border">
        {chapters.map((ch) => (
          <section
            key={ch.id}
            id={ch.id}
            data-regime={ch.regime}
            className="relative overflow-hidden border-t border-border first:border-t-0 section-y-sm pl-5 pr-5 lg:pl-[13rem]"
          >
            <ChapterCopy ch={ch} />
            <DeskFrame label={`TERMINAL §${ch.num}`} hint={ch.hint} className="mt-10">
              {/* Pre-mount (isDesktop === null) shows a poster; once mounted on
                  mobile the real demo renders inline. */}
              {isDesktop === false ? ch.demo : <DeskPoster label={ch.label} />}
            </DeskFrame>
            {ch.takeaway}
          </section>
        ))}
      </div>
    );
  }

  // ── desktop: sticky terminal + scrolling copy ────────────────────────────
  return (
    <div
      className="relative grid border-b border-border lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)]"
      data-regime={current.regime}
    >
      {/* living-page layers: regime hue (cross-fades with the active chapter)
          + VIX-driven grain. Behind the columns, non-interactive. */}
      <div className="learn-hue" style={{ color: ACCENT[current.regime] }} aria-hidden />
      <div className="learn-grain" aria-hidden />

      {/* LEFT — the book */}
      <div className="relative z-[1]">
        {chapters.map((ch, i) => (
          <section
            key={ch.id}
            id={ch.id}
            ref={(el) => {
              sectionRefs.current[i] = el;
            }}
            data-regime={ch.regime}
            className="relative flex min-h-screen flex-col justify-center border-t border-border first:border-t-0 section-y pl-5 pr-5 lg:pl-[13rem] xl:pr-10"
          >
            <ChapterCopy ch={ch} active={i === active} />
            {ch.takeaway}
          </section>
        ))}
      </div>

      {/* RIGHT — the terminal (sticky). Height divides by --ui-zoom: the html
          zoom inflates dvh units, and an uncompensated frame overflows the true
          viewport by ~10%. Tall demos scroll INSIDE the frame (my-auto centres
          short ones without clipping tall ones the way justify-center did), so
          the TERMINAL header and status row stay reachable at every position. */}
      <div className="relative z-[1] border-l border-border">
        <div className="sticky top-14 flex h-[calc(100dvh/var(--ui-zoom)-3.5rem)] flex-col overflow-y-auto px-5 py-8 xl:px-8 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
          <div className="my-auto">
            <DeskFrame label={`TERMINAL §${current.num}`} hint={current.hint} live>
              <div className="relative">
                {swapping && <div className="desk-flicker pointer-events-none absolute inset-0 z-20 bg-bg" aria-hidden />}
                <div key={current.id} className="desk-swap-in">
                  {current.demo}
                </div>
              </div>
            </DeskFrame>
            {/* status — announced to AT, and the human-visible chapter marker */}
            <div className="mt-3 flex items-center justify-between t-eyebrow text-fg-faint" aria-live="polite">
              <span>
                ch {current.num} · <span className="text-bull">{current.label}</span>
              </span>
              <span>
                {active + 1}/{chapters.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── the editorial block for one chapter ────────────────────────────────────
function ChapterCopy({ ch, active }: { ch: DeskChapter; active?: boolean }) {
  return (
    <>
      <div
        className={`flex items-center gap-3 t-eyebrow text-fg-faint ${
          active === false ? "opacity-45" : ""
        } transition-opacity duration-500`}
      >
        <span className="size-1.5 rounded-full bg-bull pulse-dot" />
        <span className="text-fg-dim">CHAPTER {ch.num}</span>
        <span className="h-px w-10 bg-border" />
        <span className="text-bull">{ch.label}</span>
      </div>

      <h2 className="mt-8 font-display tracking-tightest leading-[0.86]" style={{ fontSize: "clamp(2.6rem, 5.5vw, 5rem)" }}>
        {ch.headline}
      </h2>

      <div className="mt-6 max-w-[52ch] font-display italic font-light text-cyan text-xl md:text-2xl tracking-tight">
        <span className="text-cyan/60 mr-2">↳</span>
        {ch.thesis}
      </div>

      <div className="mt-8 max-w-[54ch] font-display text-lg leading-relaxed text-fg-dim">{ch.body}</div>

      {ch.predict && <Predict id={ch.id} cfg={ch.predict} />}

      {ch.aside && <div className="mt-10">{ch.aside}</div>}
    </>
  );
}

// ── the instrument frame — bigger, louder than the old TerminalFrame ───────
function DeskFrame({
  label,
  hint,
  live,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  live?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute -top-3 left-0 right-0 z-10 flex items-center justify-between bg-bg px-2">
        <div className="flex items-center gap-2 t-eyebrow">
          <span className="size-1 rounded-full bg-bull pulse-dot" />
          <span className="text-bull">{label}</span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-faint">{live ? "LIVE · INTERACTIVE" : "INTERACTIVE"}</span>
        </div>
        {hint && <div className="hidden t-eyebrow text-amber sm:block">{hint}</div>}
      </div>
      {/* @container: the demos inside size themselves off THIS box, not the
          viewport. They sit in a sticky column that is 46% of the page — about
          560px on a 1440 screen, and narrower still because --ui-zoom scales
          the whole document — yet they were splitting into 12-column layouts on
          `lg:`, which fires at a 1024px VIEWPORT. The result was a chart squashed
          into ~370px beside a ~185px sidebar, inside a container wide enough for
          neither. A container query asks the only question that was ever
          relevant: how much room do I actually have? */}
      <div className="@container relative border border-border bg-bg p-4 @2xl:p-6 ambient-glow">
        <span className="pointer-events-none absolute -left-px -top-px size-3 border-l border-t border-bull" />
        <span className="pointer-events-none absolute -right-px -top-px size-3 border-r border-t border-bull" />
        <span className="pointer-events-none absolute -left-px -bottom-px size-3 border-l border-b border-bull" />
        <span className="pointer-events-none absolute -right-px -bottom-px size-3 border-r border-b border-bull" />
        {children}
      </div>
    </div>
  );
}

// Placeholder shown before the client decides desktop vs mobile (avoids
// mounting heavy demos during that one indeterminate frame).
function DeskPoster({ label }: { label: string }) {
  return (
    <div className="flex h-[320px] items-center justify-center t-eyebrow text-fg-faint">
      <span className="size-1 rounded-full bg-bull pulse-dot mr-2" /> loading {label}…
    </div>
  );
}

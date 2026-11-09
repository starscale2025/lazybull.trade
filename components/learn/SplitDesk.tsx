"use client";

// THE DESK — the split-screen backbone of the redesigned /learn (plan "The
// Desk", phase L0). A run of demo chapters shares ONE sticky terminal on the
// right; the editorial copy for each chapter scrolls past on the left. As a
// chapter crosses the viewport middle an IntersectionObserver flips
// `active`, and the terminal swaps to that chapter's live demo with a
// one-beat channel-flicker. The demo is never off-screen.
//
// Only the ACTIVE demo is mounted (keyed remount), so heavy cells — the §06
// 3D greek surface — cost nothing until you reach them and unmount when you
// leave. Below lg the split collapses: each chapter renders its copy followed
// by its demo inline, no pin.
//
// Motion rides the shared ambient clock elsewhere; here the only animation is
// the CSS swap, which self-limits to one shot and respects reduced-motion.
//
// Calm (S1, 2026-11-09): the terminal is one calm panel (a demo's inner frames
// are soft wells, never a panel in a panel). Gone: the TERMINAL tab, the corner
// ticks, the pulsing dots, the glow, and the two layers behind the columns, a
// regime hue that tinted the glass mint and amber, and scanline grain.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Predict, type PredictConfig } from "./Predict";

export type Regime = "trend" | "random" | "revert" | "risk" | "options";

export type DeskChapter = {
  num: string;
  id: string;
  label: string;
  regime: Regime;
  hint: string; // terminal affordance, e.g. "Drag the knob →"
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
      <div>
        {chapters.map((ch) => (
          <section
            key={ch.id}
            id={ch.id}
            data-regime={ch.regime}
            className="relative overflow-hidden section-y-sm pl-5 pr-5 lg:pl-[13rem]"
          >
            <ChapterCopy ch={ch} />
            <DeskFrame hint={ch.hint} className="mt-10">
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
      className="relative grid lg:grid-cols-[minmax(0,1fr)_minmax(0,46%)]"
      data-regime={current.regime}
    >
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
            className="relative flex min-h-screen flex-col justify-center section-y pl-5 pr-5 lg:pl-[13rem] xl:pr-10"
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
          the panel's label row and status row stay reachable at every position. */}
      <div className="relative z-[1]">
        <div className="sticky top-14 flex h-[calc(100dvh/var(--ui-zoom)-3.5rem)] flex-col overflow-y-auto px-5 py-8 xl:px-8 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
          <div className="my-auto">
            <DeskFrame hint={current.hint}>
              <div className="relative">
                {swapping && <div className="desk-flicker pointer-events-none absolute inset-0 z-20 bg-bg" aria-hidden />}
                <div key={current.id} className="desk-swap-in">
                  {current.demo}
                </div>
              </div>
            </DeskFrame>
            {/* status — announced to AT, and the human-visible chapter marker */}
            <div className="mt-3 flex items-center justify-between t-label text-fg-faint" aria-live="polite">
              <span>
                Ch {current.num} · <span className="text-fg-dim">{current.label}</span>
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
      <div className={`t-eyebrow text-brand-ink ${active === false ? "opacity-45" : ""} transition-opacity duration-500`}>
        Chapter {ch.num} · {ch.label}
      </div>

      <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.25rem)] leading-[1] tracking-[-0.035em] text-fg text-balance">
        {ch.headline}
      </h2>

      <div className="mt-5 max-w-[52ch] font-display text-xl tracking-tight text-fg md:text-2xl">{ch.thesis}</div>

      <div className="mt-5 max-w-[54ch] text-[1.0625rem] leading-[1.6] text-fg-dim">{ch.body}</div>

      {ch.predict && <Predict id={ch.id} cfg={ch.predict} />}

      {ch.aside && <div className="mt-10">{ch.aside}</div>}
    </>
  );
}

// ── the demo's frame: one calm panel with a plain label row ────────────────
function DeskFrame({
  hint,
  className = "",
  children,
}: {
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    // @container: the demos inside size themselves off THIS box, not the
    // viewport. They sit in a sticky column that is 46% of the page — about
    // 560px on a 1440 screen, and narrower still because --ui-zoom scales
    // the whole document — yet they were splitting into 12-column layouts on
    // `lg:`, which fires at a 1024px VIEWPORT. The result was a chart squashed
    // into ~370px beside a ~185px sidebar, inside a container wide enough for
    // neither. A container query asks the only question that was ever
    // relevant: how much room do I actually have?
    <div className={`@container calm-panel p-4 md:p-5 ${className}`}>
      <i aria-hidden className="lit-aura" />
      <div className="mb-3 flex items-center justify-between gap-3 t-label text-fg-faint">
        <span>Interactive</span>
        {hint && <span className="hidden sm:block">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// Placeholder shown before the client decides desktop vs mobile (avoids
// mounting heavy demos during that one indeterminate frame).
function DeskPoster({ label }: { label: string }) {
  return <div className="flex h-[20rem] items-center justify-center t-label text-fg-faint">{label} · loading…</div>;
}

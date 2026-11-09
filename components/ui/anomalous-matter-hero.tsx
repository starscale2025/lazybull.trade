"use client";

/**
 * AnomalousMatterHero, from 21st.dev, adapted to lazybull.
 *
 * The original shipped as one file: the Three.js scene and the section around
 * it. Here the section (the copy, the h1, the actions) is server-rendered and
 * paints first; the sphere is THE MATTER (components/matter/engine.ts), the
 * site's one particle material, which arrives in this section's slot after
 * the page has loaded and gone idle. The headline stays the LCP and three
 * never blocks it.
 *
 * Also changed from the original:
 *   · The big line is the <h1>. The original put the small mono overline in
 *     the h1 and the headline in a <p>.
 *   · The project's tokens (bg-bg, text-fg, font-display) instead of the
 *     snippet's --background / --sky-300 / --gray-300 variables, which this
 *     codebase does not define, and no tw-animate-css: the entrance is the
 *     `matter-in` keyframe in globals.css, which reduced motion switches off.
 *   · A CSS haze (`matter-glow`) under the canvas, in the same tints as the
 *     sphere: the backdrop before the first WebGL frame, and the whole of it
 *     when WebGL never comes.
 *   · Children: frame zero's actions and footnote sit under the description.
 */

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { MatterSlot } from "@/components/matter/MatterSlot";

type Props = Omit<ComponentPropsWithoutRef<"section">, "title"> & {
  /** The small line over the headline. */
  title?: ReactNode;
  /** The headline, rendered as the page's <h1>. */
  subtitle: ReactNode;
  description?: ReactNode;
  /** Directly under the headline: frame zero's touchable position (M12). */
  beneath?: ReactNode;
  /** Under the description: actions, footnotes. */
  children?: ReactNode;
  /** id for the <h1>, so the section can be labelled by it. */
  headingId?: string;
};

export function AnomalousMatterHero({
  title,
  subtitle,
  description,
  beneath,
  children,
  headingId,
  className = "",
  ...rest
}: Props) {
  return (
    <section
      {...rest}
      className={`relative isolate flex min-h-screen w-full flex-col overflow-hidden bg-bg text-fg ${className}`}
    >
      <div aria-hidden className="matter-glow pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* THE MATTER's sphere (components/matter/engine.ts), loaded after
            load and idle; it drains into the film's seam as the curtain
            lifts (M11). */}
        <MatterSlot shape="sphere" drain />
      </div>
      {/* The bottom fades to the page under the copy, low and short: the
          sphere dissolves itself above the description (the scene's fade
          band), so this only has to settle the last stretch into the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg from-5% via-bg/70 via-20% to-transparent to-40%"
        // Steps aside as the curtain lifts, so the sphere can be seen
        // draining into the seam (--matter-lift, written by the engine).
        style={{ opacity: "calc(1 - var(--matter-lift, 0) * 2.2)" }}
      />
      {/* The last stretch always settles to the page, lifted or not: this is
          what the skirt under the hero continues (app/page.tsx). */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[20vh] bg-gradient-to-t from-bg to-transparent" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-end px-4 pb-12 pt-32 text-center md:pb-16">
        <div className="flex w-full max-w-4xl flex-col items-center">
          {title && <div className="matter-in">{title}</div>}
          <h1
            id={headingId}
            className="matter-rise wonk-type mt-6 font-display text-fg"
            // Sized by the shorter side: on a 1280×720 laptop the width
            // alone set it so large the copy climbed into the sphere.
            style={{ fontSize: "clamp(3rem, min(8.4vw, 12.5vh), 7.75rem)", lineHeight: 0.95, letterSpacing: "-0.025em" }}
          >
            {subtitle}
          </h1>
          {beneath}
          {description && (
            <p className="matter-in mt-6 max-w-xl text-pretty text-base leading-relaxed text-fg-dim [animation-delay:200ms] md:text-lg">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

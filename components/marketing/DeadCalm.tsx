"use client";

import { MatterSlot } from "@/components/matter/MatterSlot";
import { setMotionPaused, useMotionPaused } from "@/lib/motion/bus";

/**
 * DEAD CALM (Phase 3, M15 + M17): the one deliberately still place on the
 * page, under "Boring, by design."
 *
 * The matter lies down here as a single flat ledger line, and the wave it
 * arrives with dies to nothing (components/matter/engine.ts, the ledger).
 * Beside it, the site's kill switch: the one control that stops everything
 * that moves on its own (lib/motion/bus.ts, WCAG 2.2.2). The matter freezes
 * mid-air, the tapes halt, scrolling goes 1:1 and the route morphs stop. The
 * same switch is in the footer and in ⌘K, and it is remembered.
 */
export function DeadCalm() {
  const paused = useMotionPaused();
  return (
    <div className="lg:col-span-2">
      <div className="relative h-24 md:h-28">
        <MatterSlot shape="ledger" />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="m-0 max-w-md text-[0.9375rem] leading-relaxed text-fg-dim">
          One switch stops everything on this site that moves by itself. The same idea as the desk&apos;s kill
          switch, for the page.
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={paused}
          onClick={() => setMotionPaused(!paused)}
          className="group inline-flex items-center gap-3 rounded-full py-1.5 pl-1.5 pr-4 text-[0.9375rem] font-medium text-fg transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)]"
        >
          <span
            aria-hidden
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 ${
              paused ? "bg-amber/80" : "bg-[color-mix(in_srgb,var(--fg)_16%,transparent)]"
            }`}
          >
            <span
              className={`absolute size-5 rounded-full bg-fg shadow transition-transform duration-300 [transition-timing-function:var(--ease-settle)] ${
                paused ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </span>
          {paused ? "Motion stopped" : "Stop all motion"}
        </button>
      </div>
    </div>
  );
}

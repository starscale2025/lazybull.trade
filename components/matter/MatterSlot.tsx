"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef } from "react";
import { addMatterSlot, removeMatterSlot, type MatterShape } from "@/lib/matter";
import { isToolRoute } from "@/lib/motion/routes";

/**
 * A place on the page where the matter may appear (lib/matter.ts). It is an
 * empty, aria-hidden box: the engine moves its one canvas in here while this
 * slot is the one most on screen. Size and stack it like any backdrop layer.
 * On a tool route it registers nothing: the matter stays dormant there.
 */
export function MatterSlot({
  shape,
  drain = false,
  className = "absolute inset-0",
}: {
  shape: MatterShape;
  /** Drain into the film's seam as the curtain lifts (the hero only, M11). */
  drain?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const tool = isToolRoute(usePathname());
  useEffect(() => {
    const el = ref.current;
    if (!el || tool) return;
    addMatterSlot({ id, el, shape, drain });
    return () => removeMatterSlot(id);
  }, [id, shape, drain, tool]);
  return <div ref={ref} aria-hidden data-matter-slot={shape} className={`pointer-events-none ${className}`} />;
}

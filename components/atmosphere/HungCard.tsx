"use client";

// Reel-5 motion language: a pill card hanging from a thin wire, swaying with a
// damped pendulum. Sway is idle-animated; hovering gives it a push.
//
// The four of these on the landing used to run four immortal rAF loops
// integrating physics forever, even 3,000px offscreen. Now they ride the one
// shared ambient clock (lib/ambient-clock) and only while in view: scroll past
// and the physics stop costing anything; the tab hidden freezes them all.

import { useEffect, useRef, type ReactNode } from "react";
import { subscribeFrame, useInView } from "@/lib/ambient-clock";

export function HungCard({
  children,
  wire = 56,
  phase = 0,
}: {
  children: ReactNode;
  wire?: number;
  phase?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const vel = useRef(0);
  const ang = useRef(0);
  const inView = useInView(rootRef, "120px");

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const unsub = subscribeFrame((now, dt) => {
      const drive = Math.sin(now / 1000 + phase) * 0.012; // idle breeze
      const acc = -ang.current * 6 - vel.current * 1.6 + drive;
      vel.current += acc * dt;
      ang.current += vel.current * dt;
      el.style.transform = `rotate(${(ang.current * 57.3).toFixed(2)}deg)`;
    });
    const push = () => {
      vel.current += 0.5;
    };
    el.addEventListener("pointerenter", push);
    return () => {
      unsub();
      el.removeEventListener("pointerenter", push);
    };
  }, [phase, inView]);

  return (
    <div ref={rootRef} className="flex flex-col items-center">
      <div className="w-px bg-border" style={{ height: wire }} aria-hidden />
      <div ref={ref} style={{ transformOrigin: `50% ${-wire}px` }}>
        {children}
      </div>
    </div>
  );
}

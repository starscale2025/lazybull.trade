"use client";

// Reel-5 motion language: a pill card hanging from a thin wire, swaying with a
// damped pendulum. Sway is idle-animated; hovering gives it a push.

import { useEffect, useRef, type ReactNode } from "react";

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
  const vel = useRef(0);
  const ang = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const drive = Math.sin(now / 1000 + phase) * 0.012; // idle breeze
      const acc = -ang.current * 6 - vel.current * 1.6 + drive;
      vel.current += acc * dt;
      ang.current += vel.current * dt;
      el.style.transform = `rotate(${(ang.current * 57.3).toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const push = () => {
      vel.current += 0.5;
    };
    el.addEventListener("pointerenter", push);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", push);
    };
  }, [phase]);
  return (
    <div className="flex flex-col items-center">
      <div className="w-px bg-border" style={{ height: wire }} aria-hidden />
      <div ref={ref} style={{ transformOrigin: `50% ${-wire}px` }}>
        {children}
      </div>
    </div>
  );
}

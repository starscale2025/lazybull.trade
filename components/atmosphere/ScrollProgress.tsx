"use client";

import { useEffect, useRef } from "react";

export function ScrollProgress() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const compute = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      // A 0..1 scale for transform: scaleX (compositor-only) instead of an
      // animated width, which re-laid out the bar on every scroll frame.
      const p = scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 0;
      el.style.setProperty("--p", p.toFixed(4));
      raf = 0;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div className="scroll-progress-rail" aria-hidden>
      <div ref={ref} className="scroll-progress-fill" />
    </div>
  );
}

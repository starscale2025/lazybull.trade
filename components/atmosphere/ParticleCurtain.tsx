"use client";

// Buterine-reel effect: a curtain of glyphs raining from beneath a hero
// object, drawn on a lightweight canvas. Deterministic per seed; time-driven;
// pauses off-screen via IntersectionObserver; disabled for reduced motion.

import { useEffect, useRef } from "react";

const GLYPHS = "01↑↓$ΔΘΓν%◦·";

export function buildColumns(count: number, seed: number) {
  let a = seed | 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => ({
    x: (i + 0.5) / count,
    phase: rnd(),
    speed: 0.25 + rnd() * 1.35,
    len: 6 + Math.floor(rnd() * 14),
  }));
}

export function ParticleCurtain({
  height = 260,
  seed = 7,
  className = "",
}: {
  height?: number;
  seed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let running = false;
    const cols = buildColumns(Math.max(8, Math.floor(canvas.clientWidth / 22)), seed);
    const resize = () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };
    resize();
    const draw = (ts: number) => {
      if (!running) return;
      const t = ts / 1000;
      const W = canvas.clientWidth;
      ctx.clearRect(0, 0, W, height);
      ctx.font = "11px ui-monospace, monospace";
      for (const c of cols) {
        const head = ((c.phase + t * c.speed * 0.12) % 1) * (height + 140) - 70;
        for (let k = 0; k < c.len; k++) {
          const y = head - k * 14;
          if (y < 0 || y > height) continue;
          const fade = (1 - k / c.len) * (1 - y / height) * 0.85;
          ctx.fillStyle = `rgba(0,255,135,${Math.max(0, fade * 0.6)})`;
          ctx.fillText(GLYPHS[(c.len * 7 + k * 3 + ((c.phase * 97) | 0)) % GLYPHS.length], c.x * W, y);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      if (running) raf = requestAnimationFrame(draw);
      else cancelAnimationFrame(raf);
    });
    io.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [height, seed]);
  return (
    <canvas ref={ref} aria-hidden className={`pointer-events-none block w-full ${className}`} style={{ height }} />
  );
}

"use client";

// THE GREEK SURFACE (/learn redesign L3) — §06's set piece. An orbitable 3D
// surface of a Black-Scholes greek across strike × time-to-expiry.
//
// Deliberately hand-rolled in Canvas 2.5D, not React-Three-Fiber. Routing
// real WebGL onto /learn would either duplicate the three.js chunk (the guard
// blocks that) or drag the entire cinema 3D barrel — bull GLB preload and all
// — onto this page. A projected wireframe costs ~0 bundle, renders anywhere,
// and fits the page's own colophon: "charts hand-rolled in SVG; every line
// drew itself in." The maths underneath is the SAME priceOption() the flat
// lab uses — not a screenshot, not a mock.
//
// Rotation lives in refs and draws imperatively (no per-frame React, the
// fidelity-ladder rule). Idle auto-spin rides the shared ambient clock, so it
// gates on viewport and freezes with the tab; drag always works; reduced
// motion just doesn't auto-spin.

import { useEffect, useMemo, useRef, useState } from "react";
import { priceOption, type Greeks } from "@/lib/pricing";
import { subscribeFrame, useInView } from "@/lib/ambient-clock";

type GreekKey = "delta" | "gamma" | "theta" | "vega";

const GREEKS: { key: GreekKey; label: string; sym: string; accent: string; blurb: string }[] = [
  { key: "delta", label: "Delta", sym: "Δ", accent: "0,255,135", blurb: "Directional exposure — rises toward 1 as the call goes deep in-the-money." },
  { key: "gamma", label: "Gamma", sym: "Γ", accent: "0,229,255", blurb: "Curvature — a sharp ridge at-the-money that spikes as expiry approaches." },
  { key: "theta", label: "Theta", sym: "Θ", accent: "255,184,0", blurb: "Time decay — the ground falls away fastest for near-dated at-the-money options." },
  { key: "vega", label: "Vega", sym: "ν", accent: "201,255,0", blurb: "Vol sensitivity — a broad hill, tallest for longer-dated, near-the-money strikes." },
];

const NX = 22; // strikes
const NY = 22; // expiries
const SPOT = 100;
const R = 0.04;
const SIGMA = 0.25;

// Build the greek grid once per greek. Strike 0.6–1.4×spot, expiry 3d–1y.
function buildGrid(greek: GreekKey) {
  const z: number[][] = [];
  let lo = Infinity;
  let hi = -Infinity;
  for (let j = 0; j < NY; j++) {
    const t = 0.008 + (j / (NY - 1)) * (1 - 0.008); // years
    z[j] = [];
    for (let i = 0; i < NX; i++) {
      const strike = SPOT * (0.6 + (i / (NX - 1)) * 0.8);
      const g = priceOption(SPOT, strike, t, R, SIGMA, "C").greeks[greek as keyof Greeks];
      z[j][i] = g;
      if (g < lo) lo = g;
      if (g > hi) hi = g;
    }
  }
  const span = hi - lo || 1;
  const norm = z.map((row) => row.map((v) => (v - lo) / span)); // 0..1 height
  return { norm };
}

export function GreekSurface3D() {
  const [greek, setGreek] = useState<GreekKey>("delta");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const yaw = useRef(-0.6);
  const pitch = useRef(0.62);
  const dragging = useRef(false);
  const grid = useMemo(() => buildGrid(greek), [greek]);
  const accent = GREEKS.find((g) => g.key === greek)!.accent;
  const inView = useInView(canvasRef, "100px"); // gates the idle spin (mobile mounts every demo)

  // Imperative draw — reads rotation refs, so idle spin and drag never
  // re-render React.
  const draw = useMemo(() => {
    return () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = cv.clientWidth;
      const H = cv.clientHeight || 380;
      if (cv.width !== W * dpr || cv.height !== H * dpr) {
        cv.width = W * dpr;
        cv.height = H * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H * 0.56;
      const sx = W * 0.34;
      const sy = W * 0.2;
      const hz = H * 0.5;
      const cosY = Math.cos(yaw.current);
      const sinY = Math.sin(yaw.current);
      const depthK = Math.sin(pitch.current);

      const project = (i: number, j: number, h: number) => {
        const x = (i / (NX - 1) - 0.5) * 2;
        const y = (j / (NY - 1) - 0.5) * 2;
        const rx = x * cosY - y * sinY;
        const ry = x * sinY + y * cosY;
        return { X: cx + rx * sx, Y: cy + ry * sy * depthK - h * hz, depth: ry };
      };

      // Collect row + column segments with a depth for painter ordering.
      type Seg = { a: { X: number; Y: number }; b: { X: number; Y: number }; depth: number; h: number };
      const segs: Seg[] = [];
      for (let j = 0; j < NY; j++) {
        for (let i = 0; i < NX - 1; i++) {
          const p = project(i, j, grid.norm[j][i]);
          const q = project(i + 1, j, grid.norm[j][i + 1]);
          segs.push({ a: p, b: q, depth: (p.depth + q.depth) / 2, h: (grid.norm[j][i] + grid.norm[j][i + 1]) / 2 });
        }
      }
      for (let i = 0; i < NX; i++) {
        for (let j = 0; j < NY - 1; j++) {
          const p = project(i, j, grid.norm[j][i]);
          const q = project(i, j + 1, grid.norm[j + 1][i]);
          segs.push({ a: p, b: q, depth: (p.depth + q.depth) / 2, h: (grid.norm[j][i] + grid.norm[j + 1][i]) / 2 });
        }
      }
      segs.sort((m, n) => m.depth - n.depth); // back to front

      // floor grid (faint)
      ctx.lineWidth = 1;
      for (const s of segs) {
        const fog = 0.25 + 0.55 * ((s.depth + 1.6) / 3.2); // farther = dimmer
        const glow = 0.35 + 0.65 * s.h; // ridge brighter
        ctx.strokeStyle = `rgba(${accent}, ${(fog * glow).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(s.a.X, s.a.Y);
        ctx.lineTo(s.b.X, s.b.Y);
        ctx.stroke();
      }

      // axis labels
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillStyle = "rgba(150,150,140,0.85)";
      ctx.fillText("STRIKE →", cx + sx * 0.2, cy + sy * depthK + 22);
      ctx.fillText("← TIME TO EXPIRY", cx - sx, cy - sy * depthK - 8);
    };
  }, [grid, accent]);

  // Redraw on greek change / mount / resize.
  useEffect(() => {
    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  // Idle auto-spin on the ambient clock — only while on screen (mobile mounts
  // all demos at once), frozen in hidden tabs, skipped for reduced motion.
  // Drag pauses it.
  useEffect(() => {
    if (!inView) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    return subscribeFrame((_now, dt) => {
      if (dragging.current) return;
      yaw.current += dt * 0.18;
      draw();
    });
  }, [draw, inView]);

  // Pointer orbit.
  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    yaw.current += e.movementX * 0.008;
    pitch.current = Math.max(0.15, Math.min(1.2, pitch.current + e.movementY * 0.005));
    draw();
  };
  const onUp = () => {
    dragging.current = false;
  };

  const active = GREEKS.find((g) => g.key === greek)!;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Choose a greek">
          {GREEKS.map((g) => (
            <button
              key={g.key}
              onClick={() => setGreek(g.key)}
              aria-pressed={greek === g.key}
              className={`flex h-7 items-center gap-1.5 border px-2.5 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors ${
                greek === g.key ? "border-transparent text-bg" : "border-border bg-bg text-fg-dim hover:text-fg"
              }`}
              style={greek === g.key ? { background: `rgb(${g.accent})` } : undefined}
            >
              <span className="text-[0.8125rem] not-italic">{g.sym}</span>
              {g.label}
            </button>
          ))}
        </div>
        <span className="hidden font-mono text-[0.625rem] uppercase tracking-[0.25em] text-fg-faint sm:block">drag to orbit</span>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="block h-[21.25rem] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        role="img"
        aria-label={`3D surface of ${active.label} across strike and time to expiry. ${active.blurb}`}
      />

      <p className="mt-3 font-mono text-[0.75rem] leading-relaxed text-fg-dim">
        <span className="font-semibold" style={{ color: `rgb(${accent})` }}>
          {active.sym} {active.label} —{" "}
        </span>
        {active.blurb}
      </p>
    </div>
  );
}

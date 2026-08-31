"use client";

import { useEffect, useRef, useState } from "react";
import { cinemaClock } from "@/lib/cinema-clock";

/**
 * THE PHONE'S FILM — a different film, not a smaller one.
 *
 * Phones used to get nothing. `CinemaGate` switched the cinema off below 768px
 * and handed over a static hero, so the single most expensive thing on the site
 * was desktop-only — on a product whose strategy is explicitly India-first, i.e.
 * mobile-first. The audit scored mobile 3/10 and called it "not a design, a
 * residue".
 *
 * WHY THIS IS NOT THE DESKTOP FILM, EVER:
 *
 *  1. The budget forbids it. The three.js carrier is 1.29MB against a 1.6MB
 *     per-chunk cap. Desktop heap measures 159MB against 87MB here. Shipping
 *     three simultaneous WebGL contexts to a mid-range Android on 4G is not
 *     ambition, it is negligence.
 *  2. The desktop compositions are LANDSCAPE by construction — a laptop
 *     wireframe, a twelve-bot radial ring, a corridor. Squeezed into 9:16 they
 *     produce exactly what CinemaGate's own comment confesses: "a black void
 *     with three green lines".
 *  3. A phone can do something a desktop cannot. It can be tilted.
 *
 * So: one 2D canvas, five acts cut for portrait, zero three.js, no new chunk.
 * Three of the five acts are about OPTIONS rather than markets — a better ratio
 * than the desktop film manages.
 *
 * It shares `lib/cinema-clock` verbatim, so the two films have the same feel and
 * the timeline stays single-source. Only the RENDERING forks.
 */

// ── the five acts, in progress space ────────────────────────────────────────
const ACTS = [
  { key: "boot", from: 0.0, to: 0.16, label: "boot" },
  { key: "print", from: 0.16, to: 0.44, label: "the tape" },
  { key: "crash", from: 0.44, to: 0.62, label: "the crash" },
  { key: "cone", from: 0.62, to: 0.82, label: "the forecast" },
  { key: "bull", from: 0.82, to: 1.0, label: "conviction" },
] as const;

// The phone film's copy is a SECOND, independent array — the desktop beats in
// lib/cinema.ts do not reach here. When the desktop copy was rewritten off the
// spec sheet, this file still carried the oracle framing ("it saw the crash
// coming", "flagged 12 bars early") and shipped it to every phone. Two films,
// one story: if you change a beat there, change its counterpart here.
const COPY: { from: number; to: number; h: string; sub: string }[] = [
  { from: 0.03, to: 0.14, h: "Options you can see.", sub: "paper-only · $0 at risk" },
  { from: 0.2, to: 0.4, h: "Markets have moods.", sub: "trending, reverting, or noise" },
  { from: 0.47, to: 0.6, h: "Then the floor goes.", sub: "the part nobody rehearses" },
  { from: 0.65, to: 0.8, h: "Your worst case is a number you chose.", sub: "not one you find out afterwards" },
  { from: 0.86, to: 0.99, h: "Learn it. Then trade it.", sub: "welcome in" },
];

const N = 34; // candles — fewer than desktop's 48; portrait has less width
const DIVERGE = 20; // where the crash begins
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// deterministic tape — seeded, so scrubbing reverses exactly (same discipline
// as the desktop film: no Math.random at render time, ever)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}
const CANDLES = (() => {
  const rnd = mulberry32(7); // fixed seed: the tape must be identical every load
  const out: { o: number; c: number; hi: number; lo: number; up: boolean }[] = [];
  let p = 40;
  for (let i = 0; i < N; i++) {
    const o = p;
    p += i < DIVERGE ? 1.5 + (rnd() - 0.5) * 1.6 : -3.1 + (rnd() - 0.5) * 1.8;
    const c = p;
    const wick = 0.8 + rnd() * 1.4;
    out.push({ o, c, hi: Math.max(o, c) + wick, lo: Math.min(o, c) - wick, up: c >= o });
  }
  return out;
})();
const LO = Math.min(...CANDLES.map((c) => c.lo));
const HI = Math.max(...CANDLES.map((c) => c.hi));

// the bull silhouette, as a normalised half-profile mirrored — same shape
// language as the desktop particle logo, drawn as one filled path
const BULL_HALF: [number, number][] = [
  [0.05, 0.3], [0.14, 0.24], [0.24, 0.2], [0.42, 0.12], [0.62, 0.04],
  [0.44, 0.21], [0.31, 0.27], [0.32, 0.36], [0.36, 0.46],
  [0.3, 0.58], [0.23, 0.71], [0.17, 0.81], [0.1, 0.9], [0.03, 0.95],
];

export function MobileCinema() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [dead, setDead] = useState(false);
  const buzzed = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDead(true); // the designed static hero below is the fallback
      return;
    }
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setDead(true);
      return;
    }

    // ── the tilt is the mobile cursor ──────────────────────────────────────
    // Written into the SAME two fields the desktop pointer writes, so every
    // consumer of the clock is unchanged. Never prompts: on Android this is
    // granted already, and on iOS the event simply never fires unless the user
    // opts in elsewhere. A permission modal in front of a first-time visitor to
    // enable a parallax effect is a conversion tax.
    const onTilt = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0; // left/right, -90..90
      const b = e.beta ?? 0; // front/back, -180..180
      // quantised, or the glass shimmers on every hand tremor
      cinemaClock.px = Math.floor(clamp01((g + 30) / 60) * 2000 - 1000) / 1000;
      cinemaClock.py = Math.floor(clamp01((b - 20) / 60) * 2000 - 1000) / 1000;
    };
    window.addEventListener("deviceorientation", onTilt);

    let raf = 0;
    let progress = 0;
    let target = 0;
    let last = -1;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const css = getComputedStyle(document.documentElement);
    const BULL = css.getPropertyValue("--bull").trim() || "#00ff87";
    const BEAR = css.getPropertyValue("--bear").trim() || "#ff2e63";
    const INK = css.getPropertyValue("--fg").trim() || "#f5f5f0";
    const DIM = css.getPropertyValue("--fg-dim").trim() || "#8a8a82";

    const draw = (p: number) => {
      const r = canvas.getBoundingClientRect();
      const W = r.width, H = r.height;
      ctx.clearRect(0, 0, W, H);

      // ── act 1 · the aperture opens ───────────────────────────────────────
      const boot = ss(0.0, 0.13, p);
      if (boot < 1) {
        const rad = lerp(0, Math.hypot(W, H) * 0.62, boot);
        ctx.save();
        ctx.globalAlpha = 1 - boot * 0.9;
        ctx.strokeStyle = BULL;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(W / 2, H / 2, Math.max(1, rad), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // the chart lives in the middle band; type sits above and below it
      const padX = W * 0.09;
      const chartTop = H * 0.3;
      const chartH = H * 0.42;
      const cw = (W - padX * 2) / N;
      const yOf = (v: number) => chartTop + chartH * (1 - (v - LO) / (HI - LO));

      // how many candles have printed
      const printed = Math.floor(clamp01(ss(0.16, 0.58, p)) * N);

      // ── act 4 · the forecast cone — drawn EARLY, before the crash ────────
      // Same argument as the desktop film: it opens twelve bars before DIVERGE
      // so "flagged 12 bars early" is countable rather than asserted.
      const coneT = ss(0.3, 0.52, p) * (1 - ss(0.9, 1.0, p));
      if (coneT > 0.001) {
        const startI = DIVERGE - 12;
        const x0 = padX + startI * cw;
        const base = CANDLES[startI].c;
        ctx.save();
        ctx.globalAlpha = 0.3 * coneT;
        const grad = ctx.createLinearGradient(x0, 0, padX + N * cw, 0);
        grad.addColorStop(0, BULL);
        grad.addColorStop(1, BEAR);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x0, yOf(base));
        const span = (N - startI) * cw;
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          ctx.lineTo(x0 + span * t * coneT, yOf(base - t * 9 - t * t * 12));
        }
        for (let i = 24; i >= 0; i--) {
          const t = i / 24;
          ctx.lineTo(x0 + span * t * coneT, yOf(base - t * 9 + t * t * 10 + 4));
        }
        ctx.closePath();
        ctx.fill();
        // the median the AI actually called
        ctx.globalAlpha = 0.9 * coneT;
        ctx.strokeStyle = "#ffb800";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const t = i / 24;
          const x = x0 + span * t * coneT;
          const y = yOf(base - t * 9 - t * t * 1);
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── acts 2 + 3 · the tape prints, then detonates ─────────────────────
      // The tape recedes once the bull begins to rise: two full-strength
      // subjects in a 9:16 frame just fight each other.
      const tapeAlpha = 1 - ss(0.82, 0.93, p) * 0.72;
      ctx.save();
      ctx.globalAlpha = tapeAlpha;
      for (let i = 0; i < printed; i++) {
        const c = CANDLES[i];
        const x = padX + i * cw + cw * 0.5;
        const crashed = !c.up && i >= DIVERGE;
        const col = c.up ? BULL : BEAR;
        // a shard burst on each crash bar as it lands
        const age = clamp01((printed - i) / 6);
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yOf(c.hi));
        ctx.lineTo(x, yOf(c.lo));
        ctx.stroke();
        ctx.fillStyle = col;
        const bt = yOf(Math.max(c.o, c.c));
        const bb = yOf(Math.min(c.o, c.c));
        ctx.globalAlpha = c.up ? 0.85 : 0.95;
        ctx.fillRect(x - cw * 0.32, bt, cw * 0.64, Math.max(1.5, bb - bt));
        if (crashed && age < 1) {
          ctx.globalAlpha = (1 - age) * 0.7;
          for (let s = 0; s < 4; s++) {
            const a = (s / 4) * Math.PI * 2 + i;
            const d = age * 16;
            ctx.fillRect(x + Math.cos(a) * d, bb + Math.sin(a) * d, 2, 2);
          }
        }
        ctx.restore();
      }
      ctx.restore(); // tape alpha

      // ── act 5 · the bull charges ─────────────────────────────────────────
      const bt2 = ss(0.82, 0.97, p);
      if (bt2 > 0.001) {
        const sc = lerp(H * 0.16, H * 0.42, bt2);
        const cx = W / 2 + cinemaClock.px * 10;
        const cy = H * 0.52 + cinemaClock.py * 8;
        // Drawn as a lit OUTLINE with a faint fill, not a solid shape. A flat
        // fill at full alpha read as a green blob pasted over the chart; the
        // brand's language here is wireframe and phosphor (the desktop film
        // opens on a self-drawing outline and closes on particles), so the
        // silhouette should look drawn rather than stamped.
        const vis = Math.min(1, bt2 * 2) * (1 - ss(0.97, 1.0, p));
        ctx.save();
        ctx.beginPath();
        const pts = [...BULL_HALF, ...[...BULL_HALF].reverse().map(([x, y]) => [-x, y] as [number, number])];
        pts.forEach(([hx, hy], i) => {
          const X = cx + hx * sc;
          const Y = cy + (hy - 0.5) * sc;
          i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
        });
        ctx.closePath();
        ctx.globalAlpha = vis * 0.14;
        ctx.fillStyle = BULL;
        ctx.fill();
        ctx.globalAlpha = vis;
        ctx.strokeStyle = BULL;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.shadowColor = BULL;
        ctx.shadowBlur = 18 * vis;
        ctx.stroke();
        ctx.restore();
      }

      // the act rail, as a hairline down the left edge
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = DIM;
      ctx.fillRect(padX * 0.4, chartTop, 1, chartH);
      ctx.fillStyle = BULL;
      ctx.fillRect(padX * 0.4, chartTop, 1, chartH * clamp01(p));
      ctx.restore();
      void INK;
    };

    const tick = (now: number) => {
      const rect = section.getBoundingClientRect();
      const range = rect.height - window.innerHeight;
      target = clamp01(range > 0 ? -rect.top / range : 0);
      // the same damped follower shape the desktop film uses
      const k = 1 - Math.exp(-5 * 0.016);
      progress += (target - progress) * k;
      if (Math.abs(target - progress) < 0.0002) progress = target;
      cinemaClock.progress = progress;

      // one haptic, on the crash, once — Android only, so garnish never signal
      if (!buzzed.current && progress > 0.46) {
        buzzed.current = true;
        try {
          navigator.vibrate?.([8, 40, 14]);
        } catch {
          /* unsupported — silent by design */
        }
      }

      if (Math.abs(progress - last) > 0.0004) {
        last = progress;
        draw(progress);
        COPY.forEach((b, i) => {
          const el = copyRefs.current[i];
          if (!el) return;
          const o = Math.min(1, ss(b.from, b.from + 0.03, progress), 1 - ss(b.to - 0.03, b.to, progress));
          el.style.opacity = String(Math.max(0, o));
        });
      }
      raf = requestAnimationFrame(tick);
      void now;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("deviceorientation", onTilt);
    };
  }, []);

  if (dead) return null;

  return (
    <section
      ref={sectionRef}
      data-mobile-cinema
      className="relative md:hidden"
      style={{ height: "400svh" }}
      aria-label="Intro film"
    >
      <div
        className="sticky w-full overflow-hidden bg-bg"
        style={{
          top: "calc(env(safe-area-inset-top) + 10px)",
          aspectRatio: "9 / 16",
          // 62svh left ~300px of dead page below the stage on a 844px screen —
          // a 9:16 box on a 390px phone wants 693px and was being capped at 523.
          // 80svh lets the frame actually fill the phone while still leaving the
          // hero peeking underneath, which is what tells you to keep scrolling.
          maxHeight: "80svh",
        }}
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {/* THE ONLY WAY OUT OF THE MOBILE FILM.
            ScrollCinema ships a "Skip intro" button styled `md:hidden` — a
            mobile-only control inside a component CinemaGate only mounts at
            768px and up, so it could never render anywhere. Phones got 400svh
            of scroll-driven canvas with no escape at all. Fixed to the
            viewport (not the sticky stage, which sits below the fold before it
            pins) so it is reachable the moment you land. */}
        <button
          type="button"
          onClick={() => {
            const el = sectionRef.current;
            if (!el) return;
            // INSTANT, not smooth — same as the desktop doSkip. A smooth scroll
            // is animated by the browser over several frames, and the film's own
            // scroll-driven frame loop cancels it mid-flight, so the page never
            // moved. Measured: with `behavior:"smooth"` the button left scrollY
            // at 0; instant lands at the handoff and stays.
            window.scrollTo(0, el.offsetTop + el.offsetHeight - window.innerHeight + 4);
          }}
          className="pointer-events-auto fixed bottom-7 left-1/2 z-30 -translate-x-1/2 border border-border bg-bg/70 px-5 py-3 font-mono text-[0.6875rem] uppercase tracking-wider text-fg-dim backdrop-blur transition-colors hover:border-bull/50 hover:text-fg"
        >
          Skip intro ↓
        </button>
        {COPY.map((b, i) => (
          <div
            key={b.h}
            ref={(el) => {
              copyRefs.current[i] = el;
            }}
            style={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 top-[7%] px-6 text-center"
          >
            <p className="font-display text-[clamp(1.5rem,7vw,2.1rem)] leading-[1.05] tracking-[-0.03em] text-fg">
              {b.h}
            </p>
            <p className="mt-2 t-chrome text-fg-dim">{b.sub}</p>
          </div>
        ))}
      </div>
      {/* A parallel semantic path — the canvas is decorative, so the acts must
          exist as text for a screen reader and for no-JS. */}
      <ul className="sr-only">
        {ACTS.map((a) => (
          <li key={a.key}>{a.label}</li>
        ))}
      </ul>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cinemaClock } from "@/lib/cinema-clock";
import { getHeroPosition, useHeroChosen } from "@/lib/hero-position";
import { SAFETY_LINES, TAGLINE, TAGLINE_LEAD } from "@/lib/cinema";
import { BULL_MARK } from "@/lib/bull-mark";
import { S_MAX, S_MIN, START_STRIKES, figures, money } from "@/lib/hero-spread";
import { isMotionPaused, onMotionPausedChange } from "@/lib/motion/bus";
import { jumpTo } from "@/lib/motion/scroll";

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
 * the timeline stays single-source. Only the RENDERING forks. And it ends where
 * the desktop film ends (Gate A3 #13): on the bull mark (lib/bull-mark.ts), the
 * same mark the nav carries, with the line and a way in under it.
 */

// ── the five acts, in progress space ────────────────────────────────────────
const ACTS = [
  { key: "boot", from: 0.0, to: 0.16, label: "boot" },
  { key: "print", from: 0.16, to: 0.44, label: "the tape" },
  { key: "crash", from: 0.44, to: 0.62, label: "the crash" },
  { key: "floor", from: 0.62, to: 0.82, label: "your worst case" },
  { key: "mark", from: 0.82, to: 1.0, label: "welcome in" },
] as const;

// The phone film's copy is a SECOND, independent array — the desktop beats in
// lib/cinema.ts do not reach here. When the desktop copy was rewritten off the
// spec sheet, this file still carried the oracle framing (a forecast that
// claimed foresight of the crash) and shipped it to every phone. Two films,
// one story: if you change a beat there, change its counterpart here.
const COPY: { from: number; to: number; h: string; sub: string; cta?: true; safety?: true }[] = [
  // Beat one used to repeat the H1. Frame zero (the hero instrument) is above
  // this film now, so the film opens on the paper-only promise instead.
  { from: 0.03, to: 0.14, h: "No trade here uses real money.", sub: "paper-only · $0 at risk" },
  { from: 0.2, to: 0.4, h: "Markets have moods.", sub: "trending, reverting, or noise" },
  { from: 0.47, to: 0.6, h: "Then the floor goes.", sub: "the part nobody rehearses" },
  // Says "you chose" only once the visitor has (lib/cinema.ts SAFETY_LINES).
  { from: 0.65, to: 0.8, h: SAFETY_LINES.example.heading, sub: "set before the trade, not found out afterwards", safety: true },
  // THE FILM ENDS ON THE LINE AND A WAY IN, never on a faded crash (Gate A2,
  // m53). The beat holds past 1.0, so the last frame is the mark, this line
  // under it, and a first step on paper. "Welcome in." is the desktop film's
  // last line too, so the two films close on the same words.
  { from: 0.88, to: 1.04, h: `${TAGLINE_LEAD} ${TAGLINE}`, sub: "Welcome in.", cta: true },
];

const N = 34; // candles — fewer than desktop's 48; portrait has less width
const DIVERGE = 20; // where the crash begins
// How quickly the tilt follower closes on the sensor, per second. About a
// quarter-second lag: enough to swallow a hand's tremor, short enough that the
// mark still answers the wrist.
const TILT_RATE = 4;
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

// ── the frame, composed to the whole phone ───────────────────────────────────
// The picture used to keep a 9:16 frame centred in a 100svh stage. On a
// Pixel 7 that is a 732px picture in a 915px stage: a bar of nothing above and
// below, the chart in a middle band, and the lower third of the screen, the
// part a thumb rests over, holding only the skip pill (Gate A3 #13). Every
// position is now a fraction of the stage itself. The type keeps the top; the
// picture runs from under it down to the skip pill's row.
type Box = { x: number; y: number; w: number; h: number };
type Layout = { W: number; H: number; padX: number; top: number; bottom: number; plot: Box; mark: Box };

const MARK_AR = 0.8; // the mark's box, height over width
const FIG_ROOM = 52; // under the payoff's floor: the figure and its caption

function layout(W: number, H: number): Layout {
  const land = W > H; // a phone on its side (CinemaGate routes short landscape here too)
  const padX = Math.max(18, W * 0.09);
  // A two- or three-line headline and its sub, set from 7%, end near a
  // quarter of the way down; the picture starts under them, so nothing drawn
  // here can print across a headline.
  const top = H * (land ? 0.34 : 0.29);
  const bottom = H - Math.max(68, H * 0.085);
  const band = bottom - top;
  // The payoff is never taller than it is wide: in a portrait-tall box the
  // ramp between the strikes stands up as a cliff and stops reading as the
  // instrument's hockey-stick. Centred in the band, figure included.
  const pw = Math.min(W - padX * 2, (band - FIG_ROOM) * 2.4);
  const ph = Math.max(40, Math.min(band - FIG_ROOM, pw * 0.9));
  const plot = { x: (W - pw) / 2, y: top + (band - FIG_ROOM - ph) * 0.5, w: pw, h: ph };
  // The mark sits over the closing line in portrait (the line is set from
  // 55%, so the box ends at 52% and the jaw a little above that), which puts
  // the way in at about 70% down, under the thumb rather than under the
  // notch. Beside the line on a phone held sideways, where a stack would not
  // fit the height.
  let mark: Box;
  if (land) {
    const h = Math.min(H * 0.46, W * 0.32 * MARK_AR);
    mark = { x: W * 0.28 - h / MARK_AR / 2, y: H * 0.5 - h / 2, w: h / MARK_AR, h };
  } else {
    const w = Math.min(W * 0.58, (H * 0.25) / MARK_AR);
    mark = { x: (W - w) / 2, y: H * 0.52 - w * MARK_AR, w, h: w * MARK_AR };
  }
  return { W, H, padX, top, bottom, plot, mark };
}

/** The first `t` (0..1, by length) of a polyline as a path, and where the pen is. */
function partial(pts: ReadonlyArray<readonly [number, number]>, t: number) {
  const path = new Path2D();
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let left = total * clamp01(t);
  let tip: [number, number] = [pts[0][0], pts[0][1]];
  path.moveTo(tip[0], tip[1]);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay);
    const f = len > 0 ? Math.min(1, left / len) : 1;
    tip = [ax + (bx - ax) * f, ay + (by - ay) * f];
    path.lineTo(tip[0], tip[1]);
    left -= len;
  }
  return { path, tip };
}

export function MobileCinema() {
  const chosen = useHeroChosen();
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  const skipRef = useRef<HTMLButtonElement>(null);
  const [dead, setDead] = useState(false);
  const buzzed = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDead(true); // the designed static hero below is the fallback
      return;
    }
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!section || !stage || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setDead(true);
      return;
    }

    // The example spread, priced once. Not read off lib/hero-position unless
    // the visitor has set one: on a phone the film plays before the
    // instrument, which is what publishes there, so on a first pass the film
    // must not depend on the instrument having mounted.
    const EXAMPLE = { k1: START_STRIKES.k1, k2: START_STRIKES.k2, ...figures(START_STRIKES.k1, START_STRIKES.k2), chosen: false };
    const spreadNow = () => {
      const pos = getHeroPosition();
      return pos?.chosen ? pos : EXAMPLE;
    };

    let L = layout(canvas.clientWidth || 1, canvas.clientHeight || 1);
    let inView = false;
    let paused = isMotionPaused();

    // ── the tilt is the mobile cursor ──────────────────────────────────────
    // Written into the SAME two fields the desktop pointer writes, so every
    // consumer of the clock is unchanged. Never prompts: on Android this is
    // granted already, and on iOS the event simply never fires unless the user
    // opts in elsewhere. A permission modal in front of a first-time visitor to
    // enable a parallax effect is a conversion tax.
    //
    // The sensor only sets a TARGET. The frame loop follows it on real dt
    // (TILT_RATE), the same follower shape as the scroll, so the response is
    // the same at 60Hz and at 120Hz; writing the sensor straight into the
    // clock made the mark step at the sensor's rate and shimmer with every
    // tremor. A dead band keeps a hand at rest from waking the loop at all.
    let tiltTX = 0;
    let tiltTY = 0;
    let tiltX = 0;
    let tiltY = 0;
    let drawnTX = 0;
    let drawnTY = 0;
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      const x = clamp01((e.gamma + 30) / 60) * 2 - 1; // left/right, -90..90
      const y = clamp01((e.beta - 20) / 60) * 2 - 1; // front/back, -180..180
      if (Math.abs(x - tiltTX) < 0.02 && Math.abs(y - tiltTY) < 0.02) return;
      tiltTX = x;
      tiltTY = y;
      // Only the closing mark reads the tilt; before it, a tilt is not a frame.
      if (progress > 0.8) kick();
    };
    let tiltOn = false;
    const setTilt = (on: boolean) => {
      if (on === tiltOn) return;
      tiltOn = on;
      if (on) window.addEventListener("deviceorientation", onTilt);
      else window.removeEventListener("deviceorientation", onTilt);
    };

    let raf = 0;
    let progress = 0;
    let target = 0;
    let last = -1;
    let prevNow = 0;
    // Arriving from elsewhere (a Skip, a jump, a reload) lands on the frame
    // where the reader is, instead of gliding there through every act between.
    let snap = true;
    let ctaO = 0;
    let lastExit = -1;
    // SETTLE AND PARK. The loop used to re-arm every frame forever, reading
    // layout each time, even parked at the footer under a 4x CPU throttle.
    // Now it runs only while something moves (scroll, resize, tilt) and parks
    // itself once the followers have caught up.
    const kick = () => {
      if (!raf && inView) raf = requestAnimationFrame(tick);
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      L = layout(r.width, r.height);
    };
    const onResize = () => {
      resize();
      last = -1;
      kick();
    };

    // Read per entry rather than once, so a theme switched while the film was
    // off screen is the theme it comes back in.
    let BULL = "#52ffa5";
    let BEAR = "#ff2e63";
    let DIM = "#8a8a82";
    let FAINT = "#787872";
    let CYAN = "#3884ff";
    let RULE = "#1f1f1f";
    let BG = "#050505";
    let MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
    // The brand ramp, violet → blue → mint, from --grad-line's own stops, so
    // the mark is drawn in the same three colours as every brand accent.
    let RAMP = ["#8f73ff", "#5c9aff", "#52ffa5"];
    const readTokens = () => {
      const css = getComputedStyle(document.documentElement);
      const tok = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
      BULL = tok("--bull", BULL);
      BEAR = tok("--bear", BEAR);
      DIM = tok("--fg-dim", DIM);
      FAINT = tok("--fg-faint", FAINT);
      CYAN = tok("--cyan", CYAN);
      RULE = tok("--border", RULE);
      BG = tok("--bg", BG);
      // next/font's family (the instrument's labels are set in it), then the
      // system monos in case it has not loaded yet
      const jb = tok("--font-jetbrains", "");
      MONO = `${jb ? `${jb}, ` : ""}ui-monospace, SFMono-Regular, Menlo, monospace`;
      const stops = tok("--grad-line", "").match(/#[0-9a-f]{6}\b/gi);
      if (stops && stops.length >= 3) RAMP = stops.slice(0, 3);
    };

    // Offscreen, the film costs nothing: no scroll or resize listener, no
    // tilt listener, no frame loop and no backing store. The scroll listener
    // used to stay bound for the life of the page, waking the loop on every
    // scroll of the landing and the footer to measure a film nobody could see.
    const io = new IntersectionObserver(([entry]) => {
      inView = !!entry?.isIntersecting;
      if (inView) {
        window.addEventListener("scroll", kick, { passive: true });
        window.addEventListener("resize", onResize);
        setTilt(!paused);
        readTokens();
        resize();
        snap = true;
        last = -1;
        lastExit = -1;
        kick();
      } else {
        window.removeEventListener("scroll", kick);
        window.removeEventListener("resize", onResize);
        setTilt(false);
        cancelAnimationFrame(raf);
        raf = 0;
        prevNow = 0;
        canvas.width = 0;
        canvas.height = 0;
      }
    });
    io.observe(section);

    // THE SITE'S PAUSE (lib/motion/bus.ts). The film is scrubbed by the reader,
    // so it keeps scrubbing, but nothing moves that the reader did not move:
    // the tilt lets go and the mark sits centred, and the scroll follower
    // steps 1:1 with the page instead of gliding, as Lenis does while paused.
    const offPause = onMotionPausedChange(() => {
      paused = isMotionPaused();
      if (paused) {
        tiltTX = tiltTY = tiltX = tiltY = 0;
        cinemaClock.px = cinemaClock.py = 0;
      }
      setTilt(inView && !paused);
      last = -1;
      kick();
    });

    const mono = (px: number, weight = 500) => `${weight} ${px}px ${MONO}`;

    // ── act 1 · the aperture opens ─────────────────────────────────────────
    // Inside the picture's band, never over the type: it used to grow from
    // the centre of the whole frame to past its corners, and crossed the
    // opening headline on its way out (m39).
    const drawBoot = (p: number) => {
      const boot = ss(0.0, 0.13, p);
      if (boot >= 1) return;
      const cy = (L.top + L.bottom) / 2;
      const rad = lerp(0, (L.bottom - L.top) / 2 - 6, 1 - (1 - boot) * (1 - boot));
      ctx.save();
      ctx.globalAlpha = 1 - boot;
      ctx.strokeStyle = BULL;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(L.W / 2, cy, Math.max(1, rad), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };

    // ── acts 2 + 3 · the tape prints, then detonates ───────────────────────
    // It leaves as the payoff arrives (0.605 to 0.655) rather than lingering
    // under it: a price chart and a payoff share neither axis, and two charts
    // on one phone read as one confusing chart.
    const drawTape = (p: number) => {
      const tapeAlpha = 1 - ss(0.605, 0.655, p);
      if (tapeAlpha < 0.001) return;
      const { padX, top } = L;
      const chartH = L.bottom - L.top;
      const cw = (L.W - padX * 2) / N;
      const yOf = (v: number) => top + chartH * (1 - (v - LO) / (HI - LO));
      const printed = Math.floor(clamp01(ss(0.16, 0.58, p)) * N);
      for (let i = 0; i < printed; i++) {
        const c = CANDLES[i];
        const x = padX + i * cw + cw * 0.5;
        const crashed = !c.up && i >= DIVERGE;
        const col = c.up ? BULL : BEAR;
        // a shard burst on each crash bar as it lands
        const age = clamp01((printed - i) / 6);
        ctx.save();
        ctx.globalAlpha = 0.9 * tapeAlpha; // canvas alpha does not multiply across save()
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, yOf(c.hi));
        ctx.lineTo(x, yOf(c.lo));
        ctx.stroke();
        ctx.fillStyle = col;
        const bt = yOf(Math.max(c.o, c.c));
        const bb = yOf(Math.min(c.o, c.c));
        ctx.globalAlpha = (c.up ? 0.85 : 0.95) * tapeAlpha;
        ctx.fillRect(x - cw * 0.32, bt, cw * 0.64, Math.max(1.5, bb - bt));
        if (crashed && age < 1) {
          ctx.globalAlpha = (1 - age) * 0.7 * tapeAlpha;
          for (let s = 0; s < 4; s++) {
            const a = (s / 4) * Math.PI * 2 + i;
            const d = age * 16;
            ctx.fillRect(x + Math.cos(a) * d, bb + Math.sin(a) * d, 2, 2);
          }
        }
        ctx.restore();
      }
    };

    // ── act 4 · your worst case, as the instrument draws it ────────────────
    // This act used to put a red line across the crash at the lower strike and
    // print the loss beside it: a floor on a PRICE chart, which says nothing
    // about why the loss stops there. It is the payoff now, the hockey-stick
    // the landing's instrument shows next (components/PayoffInstrument.tsx):
    // P&L at expiry against the price, on a $0 axis, a flat floor left of K1,
    // a ramp, a flat cap right of K2, diamonds at the strikes, and the most it
    // can lose in --bear under the floor. The crash the reader just watched is
    // the left of this picture: however far the price falls, the line stays on
    // the floor. Nothing here is predicted, only bounded.
    //
    // One linear scale fits the whole position in the box, so the floor and
    // the cap keep their true proportion; the $0 axis sits where that puts it,
    // held between 30% and 70% of the box so neither side flattens to a line.
    const drawPayoff = (p: number) => {
      const vis = 1 - ss(0.79, 0.835, p); // gone before the mark starts to draw
      const axisT = ss(0.61, 0.65, p); // the $0 axis rules across first
      if (vis < 0.001 || axisT < 0.001) return;
      const lineT = ss(0.63, 0.715, p); // then the position, left to right: floor first
      const figT = ss(0.66, 0.695, p); // the number lands once the floor is down
      const fillT = ss(0.695, 0.73, p); // and the areas, once the line is whole

      const s = spreadNow();
      const { x: x0, y: y0, w: pw, h: ph } = L.plot;
      const x1 = x0 + pw;
      const loss = Math.max(1, s.maxLoss);
      const gain = Math.max(1, s.maxProfit);
      const zf = Math.min(0.7, Math.max(0.3, gain / (gain + loss)));
      const zeroY = y0 + ph * zf;
      const k = Math.min((zeroY - y0) / gain, (y0 + ph - zeroY) / loss);
      const xS = (v: number) => x0 + ((v - S_MIN) / (S_MAX - S_MIN)) * pw;
      const yP = (pnl: number) => zeroY - pnl * k;
      const floorY = yP(-loss);
      const pts: [number, number][] = [
        [xS(S_MIN), floorY],
        [xS(s.k1), floorY],
        [xS(s.k2), yP(gain)],
        [xS(S_MAX), yP(gain)],
      ];

      ctx.save();
      ctx.globalAlpha = vis;

      // the strikes, as the instrument rules them: faint, dashed, full height
      ctx.save();
      ctx.globalAlpha = 0.9 * vis * lineT;
      ctx.strokeStyle = RULE;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      for (const kx of [xS(s.k1), xS(s.k2)]) {
        ctx.beginPath();
        ctx.moveTo(kx, y0);
        ctx.lineTo(kx, y0 + ph);
        ctx.stroke();
      }
      ctx.restore();

      // the areas: the gain above $0, the loss below, at the instrument's weights
      if (fillT > 0.001) {
        const area = new Path2D();
        area.moveTo(pts[0][0], zeroY);
        for (const [x, y] of pts) area.lineTo(x, y);
        area.lineTo(pts[pts.length - 1][0], zeroY);
        area.closePath();
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, L.W, zeroY);
        ctx.clip();
        ctx.globalAlpha = 0.1 * vis * fillT;
        ctx.fillStyle = BULL;
        ctx.fill(area);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, zeroY, L.W, L.H - zeroY);
        ctx.clip();
        ctx.globalAlpha = 0.12 * vis * fillT;
        ctx.fillStyle = BEAR;
        ctx.fill(area);
        ctx.restore();
      }

      // the $0 axis, and its name at the left, above the floor's side
      ctx.save();
      ctx.globalAlpha = vis;
      ctx.strokeStyle = FAINT;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x0, zeroY);
      ctx.lineTo(x0 + pw * axisT, zeroY);
      ctx.stroke();
      ctx.globalAlpha = vis * axisT;
      ctx.fillStyle = DIM;
      ctx.font = mono(10);
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText("$0", x0, zeroY - 5);
      ctx.restore();

      // the position at expiry: red under $0, mint over it
      let tipX = x0;
      if (lineT > 0.001) {
        const { path, tip } = partial(pts, lineT);
        tipX = tip[0];
        ctx.save();
        ctx.lineWidth = 2.5;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, L.W, zeroY);
        ctx.clip();
        ctx.strokeStyle = BULL;
        ctx.stroke(path);
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, zeroY, L.W, L.H - zeroY);
        ctx.clip();
        ctx.strokeStyle = BEAR;
        ctx.stroke(path);
        ctx.restore();
        ctx.restore();
      }

      // the strike diamonds, on the axis, as the line reaches each one. Their
      // names go where the line never is: K1's above the axis and to its
      // left (the floor is under it, the ramp to its right), K2's under the
      // axis (the cap is over it).
      for (const [name, kv] of [[`K1 ${s.k1}`, s.k1], [`K2 ${s.k2}`, s.k2]] as const) {
        const kx = xS(kv);
        const a = clamp01((tipX - kx + 10) / 18);
        if (a < 0.001) continue;
        ctx.save();
        ctx.globalAlpha = vis * a;
        ctx.translate(kx, zeroY);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = BG;
        ctx.fillRect(-4.5, -4.5, 9, 9);
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 1.25;
        ctx.strokeRect(-4.5, -4.5, 9, 9);
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = vis * a;
        ctx.fillStyle = DIM;
        ctx.font = mono(10);
        if (kv === s.k1) {
          // right-aligned to the diamond, but never back over the "$0"
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.fillText(name, Math.max(x0 + 24, kx - 8 - ctx.measureText(name).width), zeroY - 6);
        } else {
          ctx.textAlign = "center";
          ctx.textBaseline = "top";
          ctx.fillText(name, Math.min(x1 - 22, kx), zeroY + 9);
        }
        ctx.restore();
      }

      // THE NUMBER: the most it can lose, in --bear, under the floor, and
      // honest about whose spread it is (the instrument's own caption).
      if (figT > 0.001) {
        const lead = `−${money(loss)}`;
        const note = `MOST IT CAN LOSE · ${s.chosen ? "YOU SET IT BEFORE THE TRADE" : "AN EXAMPLE SPREAD"}`;
        ctx.save();
        ctx.globalAlpha = vis * figT;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillStyle = BEAR;
        ctx.font = mono(18, 600);
        ctx.fillText(lead, x0, floorY + 10);
        ctx.fillStyle = DIM;
        ctx.font = mono(10);
        ctx.fillText(note, x0, floorY + 33);
        ctx.restore();
      }
      ctx.restore();
    };

    // ── act 5 · the mark draws itself ──────────────────────────────────────
    // The 28-vertex bull outline (a half-profile, mirrored) is retired: a
    // silhouette of its own that matched nothing else on the site. The film now ends on the brand's mark,
    // a long strangle at expiry read as a head (the floor is the jaw, the
    // rising legs the horns), so the act before it hands over a floor and this
    // one closes on a floor. It draws with the scroll, horn to horn, in the
    // brand ramp, and it is the film's one gradient. The tilt moves it a few
    // pixels; that is the only thing on the phone the tilt still moves.
    const drawMark = (p: number) => {
      const t = ss(0.825, 0.93, p);
      if (t < 0.001) return;
      const { x, y, w, h } = L.mark;
      const ox = x + tiltX * 6;
      const oy = y + tiltY * 4;
      const pts = BULL_MARK.map(([u, v]) => [ox + u * w, oy + v * h] as const);
      const { path, tip } = partial(pts, t);
      const ramp = ctx.createLinearGradient(ox, 0, ox + w, 0);
      RAMP.forEach((c, i) => ramp.addColorStop(i / (RAMP.length - 1), c));
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = ramp;
      ctx.lineWidth = Math.max(2.5, w * 0.014);
      ctx.shadowColor = RAMP[0];
      ctx.shadowBlur = 14;
      ctx.stroke(path);
      // the pen, while it is still drawing
      if (t < 1) {
        ctx.shadowBlur = 10;
        ctx.fillStyle = ramp;
        ctx.beginPath();
        ctx.arc(tip[0], tip[1], 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    // the act rail, as a hairline down the left edge of the picture; it
    // leaves with the last act, so the closing frame is the mark and the line
    const drawRail = (p: number) => {
      const a = 0.5 * (1 - ss(0.84, 0.9, p));
      if (a < 0.001) return;
      const x = L.padX * 0.4;
      const h = L.bottom - L.top;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = DIM;
      ctx.fillRect(x, L.top, 1, h);
      ctx.fillStyle = BULL;
      ctx.fillRect(x, L.top, 1, h * clamp01(p));
      ctx.restore();
    };

    const draw = (p: number) => {
      if (!canvas.width) return;
      ctx.clearRect(0, 0, L.W, L.H);
      drawBoot(p);
      drawTape(p);
      drawPayoff(p);
      drawMark(p);
      drawRail(p);
    };

    const ctaIndex = COPY.findIndex((b) => b.cta);

    const tick = (now: number) => {
      raf = 0;
      const rect = section.getBoundingClientRect();
      const range = rect.height - window.innerHeight;
      target = clamp01(range > 0 ? -rect.top / range : 0);
      // the same damped follower shape the desktop film uses, on real dt
      const dt = Math.min(0.05, prevNow ? (now - prevNow) / 1000 : 0.016);
      prevNow = now;
      const before = progress;
      const arrived = snap;
      snap = false;
      if (arrived || paused) {
        progress = target;
      } else {
        progress += (target - progress) * (1 - Math.exp(-5 * dt));
        if (Math.abs(target - progress) < 0.0002) progress = target;
      }
      cinemaClock.progress = progress;

      const kt = 1 - Math.exp(-TILT_RATE * dt);
      tiltX += (tiltTX - tiltX) * kt;
      tiltY += (tiltTY - tiltY) * kt;
      if (Math.abs(tiltTX - tiltX) < 0.001) tiltX = tiltTX;
      if (Math.abs(tiltTY - tiltY) < 0.001) tiltY = tiltTY;
      cinemaClock.px = tiltX;
      cinemaClock.py = tiltY;
      const tiltMoved = progress > 0.8 && (Math.abs(tiltX - drawnTX) > 0.002 || Math.abs(tiltY - drawnTY) > 0.002);

      // one haptic, on the crash, once — Android only, so garnish never signal.
      // Only when the reader scrolls into it, never on arriving mid-film.
      if (!buzzed.current && !arrived && before < 0.46 && progress >= 0.46) {
        buzzed.current = true;
        try {
          navigator.vibrate?.([8, 40, 14]);
        } catch {
          /* unsupported — silent by design */
        }
      }

      if (Math.abs(progress - last) > 0.0004 || tiltMoved) {
        last = progress;
        drawnTX = tiltX;
        drawnTY = tiltY;
        draw(progress);
        COPY.forEach((b, i) => {
          const el = copyRefs.current[i];
          if (!el) return;
          const o = Math.max(0, Math.min(1, ss(b.from, b.from + 0.03, progress), 1 - ss(b.to - 0.03, b.to, progress)));
          el.style.opacity = String(o);
          if (b.cta) ctaO = o;
        });
        // Skip leaves with the film: faded and inert by 0.9, so it can never
        // sit under the landing passing taps through to its links.
        const pill = skipRef.current;
        if (pill) {
          pill.style.opacity = String(1 - ss(0.86, 0.9, progress));
          pill.inert = progress >= 0.9;
        }
        lastExit = -1; // the way in's state depends on both
      }

      // ── the exit: the last frame dissolves ───────────────────────────────
      // How far the stage has slid off, 0..1, once the film's scroll is spent.
      // Where scroll-driven animations exist, CSS (below, in the markup) holds
      // the stage still and fades it as the landing rises over it; this is the
      // fallback, a fade as it slides, and the part only script can do: the
      // way in goes inert as it dissolves, so a tap meant for the landing
      // never lands on a link the reader can barely see.
      const exitT = clamp01((L.H - rect.bottom) / L.H);
      if (exitT !== lastExit) {
        lastExit = exitT;
        stage.style.opacity = String(1 - clamp01(exitT / 0.6));
        stage.style.pointerEvents = exitT > 0.3 ? "none" : "";
        const cta = copyRefs.current[ctaIndex];
        if (cta) cta.inert = ctaO < 0.5 || exitT > 0.3;
      }

      const moving = Math.abs(target - progress) > 0.0002 || tiltX !== tiltTX || tiltY !== tiltTY;
      if (moving) {
        kick();
      } else {
        prevNow = 0;
      }
    };

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      offPause();
      setTilt(false);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", kick);
    };
  }, []);

  if (dead) return null;

  return (
    <section
      ref={sectionRef}
      data-mobile-cinema
      className="film-phone-only relative"
      style={{ height: "400svh" }}
      aria-label="Intro film"
    >
      {/* THE LAST FRAME DISSOLVES instead of sliding off (Gate A3 #13). When
          the film's scroll is spent, the sticky stage used to ride up off the
          top with the section, the closing frame and its way in sliding away
          like a page being turned. Over the section's exit, this holds the
          stage where it is (the counter-translate cancels the slide exactly:
          the range starts when the stage itself starts to move, 100dvh -
          100svh after the section's end reaches the bottom of the viewport)
          and fades it, while the instrument rises in over it (it is the next
          section, positioned, so it paints above the stage). On the
          compositor, so it stays locked to the finger on a phone, where a
          script counter-translate trails native touch scroll by a frame and
          shakes; the script's fade is the fallback where this is not
          supported. Gated by @supports: without a scroll timeline, the same
          animation would run once on load on the document timeline and hide
          the film. The inset is zeroed because its default is the root's
          scroll-padding (the nav clearance in globals.css), which ended the
          range 80px early and let the frame drift down as it faded. */}
      <style>{`
        @supports (animation-timeline: view()) {
          [data-mobile-cinema] { view-timeline: --mc-film block; view-timeline-inset: 0px; }
          [data-mc-stage] {
            animation: mc-dissolve linear both;
            animation-duration: auto;
            animation-timeline: --mc-film;
            animation-range: exit 0% exit 100%;
            animation-range: exit calc(100dvh - 100svh) exit 100%;
          }
        }
        @keyframes mc-dissolve {
          0% { opacity: 1; transform: translateY(0); }
          60% { opacity: 0; }
          100% { opacity: 0; transform: translateY(100%); visibility: hidden; }
        }
      `}</style>
      <div
        ref={stageRef}
        data-mc-stage
        className="sticky top-0 w-full overflow-hidden bg-bg"
        style={{
          // The whole phone, and the picture is composed to it (see layout):
          // a 9:16 box capped at 80svh left a band of page showing under the
          // stage (Gate A2, m50-m53), and a 9:16 picture letterboxed inside
          // the whole phone left the lower third empty (Gate A3 #13).
          height: "100svh",
        }}
      >
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />
        {/* THE ONLY WAY OUT OF THE MOBILE FILM.
            ScrollCinema ships a "Skip intro" button styled `md:hidden` — a
            mobile-only control inside a component CinemaGate only mounts at
            768px and up, so it could never render anywhere. Phones got 400svh
            of scroll-driven canvas with no escape at all. It used to be
            `fixed`, which inside this sticky stage's stacking context painted
            it UNDER every later section while it kept receiving taps (a tap
            on it at the footer opened /quant). It is pinned with the stage
            now and leaves with it.
            In the corner, not centred under the picture: centred, it was the
            one thing in the lower third and read as the film's subject. The
            insets keep it off the home indicator and the rounded corners. */}
        <button
          ref={skipRef}
          type="button"
          onClick={() => {
            const el = sectionRef.current;
            if (!el) return;
            // INSTANT, not smooth: the film's frame loop cancels a smooth
            // scroll mid-flight. Lands on the section after the film, and only
            // ever moves the reader DOWN.
            const dest = el.getBoundingClientRect().bottom + window.scrollY;
            if (dest > window.scrollY) jumpTo(dest);
          }}
          className="pointer-events-auto absolute z-30 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-bg/80 px-4 text-[0.8125rem] text-fg-dim transition-colors hover:border-bull/50 hover:text-fg"
          style={{
            right: "max(1rem, env(safe-area-inset-right, 0px))",
            bottom: "max(1.25rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          Skip the film <span aria-hidden>↓</span>
        </button>
        {COPY.map((b, i) => (
          <div
            key={i}
            ref={(el) => {
              copyRefs.current[i] = el;
            }}
            // The beats sit in the top band, clear of the notch; the closing
            // one sits under the mark (beside it on a phone held sideways),
            // where the picture has made room for it.
            style={b.cta ? { opacity: 0 } : { opacity: 0, top: "max(7%, calc(env(safe-area-inset-top, 0px) + 1rem))" }}
            // hidden until its beat is up, so the way in is never a stray tab stop
            inert={b.cta ? true : undefined}
            className={
              b.cta
                ? "pointer-events-none absolute inset-x-0 top-[55%] px-6 text-center landscape:left-1/2 landscape:right-[6%] landscape:top-1/2 landscape:-translate-y-1/2 landscape:px-0 landscape:text-left"
                : "pointer-events-none absolute inset-x-0 px-6 text-center"
            }
          >
            <p className="font-display text-[clamp(1.5rem,7vw,2.1rem)] leading-[1.05] tracking-[-0.03em] text-balance text-fg">
              {b.cta ? (
                // The lead over the line, as two lines: run together, a phone
                // broke it at the hyphen ("paper- / trade it.").
                <>
                  <span className="block">{TAGLINE_LEAD}</span>{" "}
                  <span className="block">{TAGLINE}</span>
                </>
              ) : b.safety && chosen ? (
                SAFETY_LINES.chosen.heading
              ) : (
                b.h
              )}
            </p>
            {b.cta ? (
              <p className="mt-3 text-[0.9375rem] text-fg-dim">{b.sub}</p>
            ) : (
              <p className="mt-2 t-chrome text-fg-dim">{b.safety && chosen ? "not one you find out afterwards" : b.sub}</p>
            )}
            {b.cta && (
              <Link
                href="/trade"
                className="btn-grad pointer-events-auto mt-6 inline-flex min-h-11 items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold tracking-[-0.01em]"
              >
                Start on paper <span aria-hidden>→</span>
              </Link>
            )}
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

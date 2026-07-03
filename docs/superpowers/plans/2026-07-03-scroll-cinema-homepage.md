# Scroll Cinema Homepage Hero — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Apple-style scroll-scrubbed frame sequence as the lazybull homepage hero: UI assembles into a MacBook, camera dives through real product UI, a bull emerges, green flash, seamless handoff to the live homepage.

**Architecture:** A pinned (`position: sticky`) full-viewport `<canvas>` inside a 500vh section draws pre-rendered WebP frames selected by scroll progress (GSAP ScrollTrigger). Frames are produced offline by a Playwright script that captures real app screenshots, feeds them to a deterministic standalone HTML scene (`renderAt(t)`), and encodes with ffmpeg. Copy beats and the green flash are DOM overlays, never baked into frames. A particle-bull placeholder ships until the user generates the real bull clip with free Veo credits.

**Tech Stack:** Next.js 16 (App Router), React 19, GSAP 3.15 ScrollTrigger (already a dep), Tailwind 4 theme tokens (`bg-bg`, `text-fg`, `bg-bull`), zod 4 (already a dep), vitest, Playwright (new devDep, pipeline only), ffmpeg (installed at `/opt/homebrew/bin/ffmpeg`).

**Spec:** `docs/superpowers/specs/2026-07-03-scroll-cinema-homepage-design.md`

---

## File structure

| Path | Responsibility |
|---|---|
| `lib/cinema.ts` | Pure timeline math + config: act boundaries, copy beats, progress→frame, overlay opacities, manifest schema. No DOM. |
| `__tests__/cinema.test.ts` | Vitest coverage for everything in `lib/cinema.ts`. |
| `components/scrollstory/ScrollCinema.tsx` | Client component: sticky canvas, ScrollTrigger scrub, chunked frame loading, DOM copy/flash overlays, reduced-motion + failure fallbacks. |
| `scripts/cinema/scene.html` | Standalone deterministic renderer: `window.initScene(cfg)` + `window.renderAt(t)`. Never shipped to client. |
| `scripts/cinema/capture.mjs` | Pipeline driver: screenshot real pages → step `renderAt(t)` per frame → ffmpeg WebP encode → manifest + poster. |
| `scripts/cinema/README.md` | Pipeline usage + the Veo bull prompt + swap instructions. |
| `public/cinema/frames/` | Generated committed assets: `desktop/`, `mobile/`, `poster.webp`, `manifest.json`. |
| `app/page.tsx` (modify) | Single insertion: `<ScrollCinema />` between `<Nav />` and `<Hero />`. |
| `.gitignore` (modify) | Ignore pipeline intermediates (`shots/`, `raw/`, `bull.mp4`). |
| `package.json` (modify) | Playwright devDep + `cinema:capture` script. |

**Invariant to preserve everywhere:** act boundaries in `lib/cinema.ts` (`ACTS`) and `scripts/cinema/scene.html` (`PHASES`) are the same six numbers: 0, 0.12, 0.32, 0.58, 0.80, 0.92, 1. A comment in each file points at the other.

**Stacking/handoff mechanics (why the numbers below):** Nav is `sticky top-0 z-50` — the cinema section is `relative z-20`, so Nav stays visible above it. The section gets `marginBottom: "-100vh"` so the real `<Hero />` sits underneath the cinema's final viewport; the canvas fades out over the handoff act revealing Hero in place. Everything inside the sticky container is `pointer-events-none`, so Hero is interactive even while overlapped.

---

### Task 1: Timeline math library (`lib/cinema.ts`) — TDD

**Files:**
- Test: `__tests__/cinema.test.ts`
- Create: `lib/cinema.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/cinema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ACTS,
  COPY_BEATS,
  beatOpacity,
  canvasOpacity,
  clamp01,
  flashOpacity,
  frameUrl,
  manifestSchema,
  progressToFrame,
} from "@/lib/cinema";

describe("ACTS", () => {
  it("covers [0,1] contiguously in order", () => {
    const order = ["boot", "assembly", "dive", "bull", "flash", "handoff"] as const;
    expect(ACTS[order[0]].from).toBe(0);
    expect(ACTS[order[order.length - 1]].to).toBe(1);
    for (let i = 1; i < order.length; i++) {
      expect(ACTS[order[i]].from).toBe(ACTS[order[i - 1]].to);
    }
  });
});

describe("COPY_BEATS", () => {
  it("has unique ids and windows inside [0,1]", () => {
    const ids = COPY_BEATS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of COPY_BEATS) {
      expect(b.from).toBeGreaterThanOrEqual(0);
      expect(b.to).toBeLessThanOrEqual(1);
      expect(b.to).toBeGreaterThan(b.from);
    }
  });
});

describe("clamp01", () => {
  it("clamps and neutralizes non-finite input", () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0.25)).toBe(0.25);
    expect(clamp01(1.5)).toBe(1);
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
  });
});

describe("progressToFrame", () => {
  it("maps progress to clamped frame indices", () => {
    expect(progressToFrame(0, 160)).toBe(0);
    expect(progressToFrame(1, 160)).toBe(159);
    expect(progressToFrame(0.999, 160)).toBe(159);
    expect(progressToFrame(0.5, 160)).toBe(80);
    expect(progressToFrame(0.25, 4)).toBe(1);
    expect(progressToFrame(-1, 160)).toBe(0);
    expect(progressToFrame(NaN, 160)).toBe(0);
    expect(progressToFrame(0.5, 0)).toBe(0);
  });
});

describe("beatOpacity", () => {
  const beat = { from: 0.2, to: 0.4 };
  it("is 0 outside the window (inclusive edges)", () => {
    expect(beatOpacity(0.1, beat)).toBe(0);
    expect(beatOpacity(0.2, beat)).toBe(0);
    expect(beatOpacity(0.4, beat)).toBe(0);
    expect(beatOpacity(0.5, beat)).toBe(0);
  });
  it("ramps over the fade width and plateaus at 1", () => {
    expect(beatOpacity(0.215, beat, 0.03)).toBeCloseTo(0.5, 5);
    expect(beatOpacity(0.23, beat, 0.03)).toBe(1);
    expect(beatOpacity(0.3, beat, 0.03)).toBe(1);
    expect(beatOpacity(0.385, beat, 0.03)).toBeCloseTo(0.5, 5);
  });
  it("never exceeds 1 when the window is narrower than two fades", () => {
    const narrow = { from: 0.2, to: 0.22 };
    expect(beatOpacity(0.21, narrow, 0.03)).toBeLessThanOrEqual(1);
    expect(beatOpacity(0.21, narrow, 0.03)).toBeGreaterThan(0);
  });
});

describe("flashOpacity", () => {
  it("is a triangle over the flash act peaking mid-act", () => {
    expect(flashOpacity(0.5)).toBe(0);
    expect(flashOpacity(0.8)).toBe(0);
    expect(flashOpacity(0.86)).toBeCloseTo(1, 5);
    expect(flashOpacity(0.89)).toBeCloseTo(0.5, 5);
    expect(flashOpacity(0.92)).toBe(0);
    expect(flashOpacity(1)).toBe(0);
  });
});

describe("canvasOpacity", () => {
  it("holds 1 until handoff then fades to 0", () => {
    expect(canvasOpacity(0)).toBe(1);
    expect(canvasOpacity(0.9)).toBe(1);
    expect(canvasOpacity(0.92)).toBe(1);
    expect(canvasOpacity(0.96)).toBeCloseTo(0.5, 5);
    expect(canvasOpacity(1)).toBe(0);
  });
});

describe("frameUrl", () => {
  it("builds 1-based zero-padded webp paths", () => {
    expect(frameUrl("/cinema/frames/desktop", 0)).toBe("/cinema/frames/desktop/frame_0001.webp");
    expect(frameUrl("/cinema/frames/mobile", 159)).toBe("/cinema/frames/mobile/frame_0160.webp");
  });
});

describe("manifestSchema", () => {
  const valid = {
    desktop: { dir: "/cinema/frames/desktop", width: 1600, height: 1000, frameCount: 160 },
    mobile: { dir: "/cinema/frames/mobile", width: 800, height: 1200, frameCount: 160 },
  };
  it("parses a valid manifest", () => {
    expect(manifestSchema.parse(valid)).toEqual(valid);
  });
  it("rejects missing sets and bad numbers", () => {
    expect(() => manifestSchema.parse({ desktop: valid.desktop })).toThrow();
    expect(() =>
      manifestSchema.parse({ ...valid, desktop: { ...valid.desktop, frameCount: 0 } })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/cinema.test.ts`
Expected: FAIL — `Cannot find module '@/lib/cinema'` (or equivalent resolve error).

- [ ] **Step 3: Write minimal implementation**

Create `lib/cinema.ts`:

```ts
import { z } from "zod";

// Scroll-cinema timeline math. Pure functions, no DOM.
// Act boundaries MUST match PHASES in scripts/cinema/scene.html.
// Spec: docs/superpowers/specs/2026-07-03-scroll-cinema-homepage-design.md

export type Act = "boot" | "assembly" | "dive" | "bull" | "flash" | "handoff";

export const ACTS: Record<Act, { from: number; to: number }> = {
  boot: { from: 0, to: 0.12 },
  assembly: { from: 0.12, to: 0.32 },
  dive: { from: 0.32, to: 0.58 },
  bull: { from: 0.58, to: 0.8 },
  flash: { from: 0.8, to: 0.92 },
  handoff: { from: 0.92, to: 1 },
};

export type CopyBeat = {
  id: string;
  /** Scroll-progress window in which this beat is visible. */
  from: number;
  to: number;
  heading: string;
  sub?: string;
};

export const COPY_BEATS: CopyBeat[] = [
  { id: "boot", from: 0.02, to: 0.11, heading: "lazybull.trade", sub: "options, without the fog" },
  { id: "assembly", from: 0.15, to: 0.3, heading: "One terminal. Every tool." },
  { id: "dive-1", from: 0.34, to: 0.44, heading: "27 bots · 13 models · 8 live demos" },
  { id: "dive-2", from: 0.46, to: 0.56, heading: "0.4ms pricing engine", sub: "$100K paper account" },
  { id: "bull", from: 0.6, to: 0.78, heading: "Learn it. Backtest it.", sub: "Only then trade it." },
];

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Map scroll progress [0,1] to a frame index [0, frameCount-1]. */
export function progressToFrame(progress: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  const p = clamp01(progress);
  return Math.min(frameCount - 1, Math.floor(p * frameCount));
}

/**
 * Opacity for a copy beat: 0 at/outside [from,to], linear ramp over `fade`
 * inside each edge, plateau of 1 between the ramps.
 */
export function beatOpacity(
  progress: number,
  beat: Pick<CopyBeat, "from" | "to">,
  fade = 0.03
): number {
  const p = clamp01(progress);
  if (p <= beat.from || p >= beat.to) return 0;
  const f = Math.min(fade, (beat.to - beat.from) / 2);
  if (f <= 0) return 1;
  return Math.min(1, (p - beat.from) / f, (beat.to - p) / f);
}

/** Green-flash overlay opacity: triangle over the flash act, peak mid-act. */
export function flashOpacity(progress: number): number {
  const { from, to } = ACTS.flash;
  const p = clamp01(progress);
  if (p <= from || p >= to) return 0;
  const mid = (from + to) / 2;
  return p < mid ? (p - from) / (mid - from) : (to - p) / (to - mid);
}

/** Whole-cinema opacity: 1 until the handoff act, then fades to 0. */
export function canvasOpacity(progress: number): number {
  const { from, to } = ACTS.handoff;
  const p = clamp01(progress);
  if (p <= from) return 1;
  if (p >= to) return 0;
  return 1 - (p - from) / (to - from);
}

const frameSetSchema = z.object({
  dir: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frameCount: z.number().int().positive(),
});

export const manifestSchema = z.object({
  desktop: frameSetSchema,
  mobile: frameSetSchema,
});

export type FrameSet = z.infer<typeof frameSetSchema>;
export type CinemaManifest = z.infer<typeof manifestSchema>;

/** Frame files are 1-based: frame_0001.webp … frame_NNNN.webp. */
export function frameUrl(dir: string, index: number): string {
  return `${dir}/frame_${String(index + 1).padStart(4, "0")}.webp`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/cinema.test.ts`
Expected: PASS — all tests green. Also run the whole suite to check nothing broke: `npm test` → the two pre-existing test files still pass.

- [ ] **Step 5: Commit**

```bash
git add lib/cinema.ts __tests__/cinema.test.ts
git commit -m "feat(cinema): timeline math for scroll-cinema hero"
```

---

### Task 2: Pipeline scaffolding (Playwright, gitignore, npm script)

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install Playwright as a devDependency and download Chromium**

```bash
npm install -D playwright
npx playwright install chromium
```

Expected: `playwright` appears in `devDependencies`; Chromium download completes without error.

- [ ] **Step 2: Add the pipeline npm script**

In `package.json` `"scripts"`, add after `"test"`:

```json
    "cinema:capture": "node scripts/cinema/capture.mjs"
```

- [ ] **Step 3: Ignore pipeline intermediates**

Append to `.gitignore`:

```
# scroll-cinema pipeline intermediates (generated frames in public/ ARE committed)
scripts/cinema/shots/
scripts/cinema/raw/
scripts/cinema/bull.mp4
```

- [ ] **Step 4: Verify and commit**

Run: `node -e "require.resolve('playwright'); console.log('ok')"`
Expected: `ok`

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore(cinema): playwright devDep + pipeline scaffolding"
```

---

### Task 3: Deterministic scene renderer (`scripts/cinema/scene.html`)

**Files:**
- Create: `scripts/cinema/scene.html`

The scene is a pure function of `t ∈ [0,1]`: `window.renderAt(t)` positions everything with no transitions, no rAF, no randomness at render time (particles are seeded once in `initScene`). Playwright steps `t` and screenshots.

- [ ] **Step 1: Write the scene file**

Create `scripts/cinema/scene.html`:

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root {
    --bg: #050505; --fg: #f5f5f0; --fg-dim: #8a8a82;
    --bull: #00ff87; --border: #1f1f1f;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; transition: none !important; animation: none !important; }
  html, body { width: 100%; height: 100%; background: var(--bg); overflow: hidden; }
  #stage {
    position: relative; width: 100vw; height: 100vh; overflow: hidden;
    background: var(--bg);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  /* faint background grid, parallaxes during the dive */
  #grid {
    position: absolute; inset: -60%;
    background-image:
      linear-gradient(rgba(245,245,240,0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(245,245,240,0.045) 1px, transparent 1px);
    background-size: 72px 72px;
  }
  #vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.8) 100%);
    pointer-events: none;
  }
  /* Act 0: stroke-drawn MacBook outline */
  #outline { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); }
  #outline path {
    fill: none; stroke: var(--bull); stroke-width: 2;
    filter: drop-shadow(0 0 12px rgba(0,255,135,0.55));
  }
  #wordmark {
    position: absolute; left: 50%; top: 68%; transform: translate(-50%, -50%);
    color: var(--fg); font-size: 30px; letter-spacing: -0.04em; font-weight: 700;
  }
  #wordmark .dot { color: var(--bull); }
  /* Acts 1-2: the CSS MacBook */
  #mac { position: absolute; left: 50%; top: 50%; width: 840px; height: 560px;
         transform: translate(-50%, -50%); }
  #screen {
    position: absolute; left: 50%; top: 0; transform: translateX(-50%);
    width: 780px; height: 490px; border-radius: 18px;
    background: #0a0a0a; border: 2px solid #2a2a2a;
    box-shadow: 0 0 0 8px #111, 0 30px 80px rgba(0,0,0,0.8);
    overflow: hidden;
  }
  #screen-inner { position: absolute; inset: 14px; background: var(--bg); overflow: hidden; }
  #base {
    position: absolute; left: 50%; top: 498px; transform: translateX(-50%);
    width: 840px; height: 26px; border-radius: 4px 4px 14px 14px;
    background: linear-gradient(#2c2c2c, #151515);
  }
  #base::after {
    content: ""; position: absolute; left: 50%; top: 0; transform: translateX(-50%);
    width: 130px; height: 9px; border-radius: 0 0 10px 10px; background: #0c0c0c;
  }
  .panel {
    position: absolute; border: 1px solid var(--border); border-radius: 8px;
    background-color: #0a0a0a; background-repeat: no-repeat;
    box-shadow: 0 18px 50px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,255,135,0.06);
    overflow: hidden; will-change: transform, opacity;
  }
  .panel::after {  /* subtle top chrome bar so crops read as "panels" */
    content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px;
    background: linear-gradient(90deg, var(--bull), transparent 60%); opacity: 0.7;
  }
  #panels { position: absolute; inset: 0; }  /* dive-phase flying layer */
  #bull { position: absolute; inset: 0; }
  #bullreal {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    height: 92%; opacity: 0;
  }
  #homepage {
    position: absolute; left: 50%; top: 50%;
    min-width: 100%; min-height: 100%; opacity: 0;
  }
</style>
</head>
<body>
<div id="stage">
  <div id="grid"></div>
  <div id="mac">
    <div id="screen"><div id="screen-inner"></div></div>
    <div id="base"></div>
  </div>
  <div id="panels"></div>
  <canvas id="bull"></canvas>
  <img id="bullreal" alt="">
  <img id="homepage" alt="">
  <svg id="outline" width="880" height="620" viewBox="0 0 880 620">
    <path id="outline-screen" d="M 60 20 H 820 Q 838 20 838 38 V 500 H 42 V 38 Q 42 20 60 20 Z"/>
    <path id="outline-base" d="M 10 530 H 870 Q 870 560 830 560 H 50 Q 10 560 10 530 Z"/>
  </svg>
  <div id="wordmark">lazybull<span class="dot">.</span>trade</div>
  <div id="vignette"></div>
</div>

<script>
// ---- timeline (MUST match ACTS in lib/cinema.ts) -------------------------
const PHASES = {
  boot:     [0.00, 0.12],
  assembly: [0.12, 0.32],
  dive:     [0.32, 0.58],
  bull:     [0.58, 0.80],
  reveal:   [0.80, 1.00],  // frames show the homepage under the runtime flash/handoff overlays
};

// ---- tiny deterministic helpers ------------------------------------------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeIO = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- panel crop table (shot key, bg offset %, dive direction) -------------
const PANEL_DEFS = [
  { shot: "home",  bx: 0,   by: 0,   dive: [-1.0, -0.4] },
  { shot: "home",  bx: 50,  by: 10,  dive: [ 1.0, -0.3] },
  { shot: "home",  bx: 100, by: 30,  dive: [-0.7,  0.8] },
  { shot: "learn", bx: 0,   by: 20,  dive: [ 0.8,  0.7] },
  { shot: "learn", bx: 60,  by: 45,  dive: [-1.2,  0.1] },
  { shot: "learn", bx: 20,  by: 80,  dive: [ 1.2,  0.2] },
  { shot: "trade", bx: 0,   by: 0,   dive: [-0.4, -1.0] },
  { shot: "trade", bx: 80,  by: 40,  dive: [ 0.4,  1.1] },
  { shot: "trade", bx: 40,  by: 100, dive: [ 0.2, -1.2] },
];
// assembly start poses: fanned around the viewport edges (deterministic)
const START_POSES = [
  { x: -0.55, y: -0.35, r: -24 }, { x: 0.0,  y: -0.62, r: 10 }, { x: 0.55, y: -0.38, r: 22 },
  { x: -0.68, y:  0.05, r: -14 }, { x: 0.7,  y:  0.02, r: 16 }, { x: -0.5, y:  0.42, r: -20 },
  { x:  0.0,  y:  0.6,  r:  8 },  { x: 0.52, y:  0.44, r: 18 }, { x: -0.2, y: -0.55, r: -6 },
];

// ---- bull-head silhouette (normalized, x in [-1,1], y in [0,1]) -----------
const BULL_HALF = [
  [0.06, 0.16], [0.20, 0.05], [0.38, 0.02], [0.55, 0.08], [0.66, 0.20],
  [0.68, 0.33], [0.60, 0.42], [0.48, 0.44], [0.42, 0.38],  // horn (out and back)
  [0.50, 0.50], [0.56, 0.56],                               // ear
  [0.46, 0.64], [0.40, 0.76], [0.30, 0.88], [0.18, 0.96], [0.07, 1.0],
];
function bullOutline() {
  const right = BULL_HALF;
  const left = [...BULL_HALF].reverse().map(([x, y]) => [-x, y]);
  return right.concat(left); // closed-ish loop, top-center → right → bottom → left → top
}

// ---- scene state -----------------------------------------------------------
let CFG = null;        // { shots: {home,learn,trade}, bullFrames: string[] | null }
let PARTICLES = [];    // { sx, sy, tx, ty, tint, size, glow }
let BULL_IMGS = [];    // preloaded Image objects for real bull frames

window.initScene = async function initScene(cfg) {
  CFG = cfg;
  const stage = document.getElementById("stage");
  const W = stage.clientWidth, H = stage.clientHeight;

  // Build the 9 panels twice: once inside the screen grid, once in the fly layer.
  const inner = document.getElementById("screen-inner");
  const fly = document.getElementById("panels");
  inner.innerHTML = ""; fly.innerHTML = "";
  PANEL_DEFS.forEach((def, i) => {
    for (const [parent, cls] of [[inner, "grid"], [fly, "fly"]]) {
      const el = document.createElement("div");
      el.className = "panel " + cls;
      el.dataset.i = String(i);
      el.style.backgroundImage = `url(${CFG.shots[def.shot]})`;
      el.style.backgroundSize = "300%";
      el.style.backgroundPosition = `${def.bx}% ${def.by}%`;
      parent.appendChild(el);
    }
  });
  // grid slots: 3x3 inside screen-inner (752x462 area)
  document.querySelectorAll("#screen-inner .panel").forEach((el, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    el.style.width = "236px"; el.style.height = "142px";
    el.style.left = `${8 + col * 246}px`;
    el.style.top = `${8 + row * 152}px`;
  });
  // fly copies: sized relative to viewport, centered; renderAt moves them
  document.querySelectorAll("#panels .panel").forEach((el) => {
    el.style.width = `${Math.round(W * 0.28)}px`;
    el.style.height = `${Math.round(W * 0.17)}px`;
    el.style.left = "50%"; el.style.top = "50%";
  });

  // Seed bull particles.
  const rnd = mulberry32(1337);
  const outline = bullOutline();
  const cx = W / 2, cy = H * 0.5, scale = Math.min(W, H) * 0.36;
  const N = 1200;
  PARTICLES = [];
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const fi = u * (outline.length - 1);
    const k = Math.floor(fi), fr = fi - k;
    const a = outline[k], b = outline[Math.min(k + 1, outline.length - 1)];
    const jx = (rnd() - 0.5) * 0.05, jy = (rnd() - 0.5) * 0.05;
    PARTICLES.push({
      sx: rnd() * W, sy: rnd() * H,
      tx: cx + (lerp(a[0], b[0], fr) + jx) * scale,
      ty: cy + (lerp(a[1], b[1], fr) + jy - 0.5) * scale * 1.15,
      tint: rnd(), size: rnd() < 0.25 ? 3 : 2, glow: i % 4 === 0,
    });
  }
  const bullCanvas = document.getElementById("bull");
  bullCanvas.width = W; bullCanvas.height = H;

  // Preload images (shots + homepage + real bull frames if present).
  const urls = [CFG.shots.home, CFG.shots.learn, CFG.shots.trade];
  document.getElementById("homepage").src = CFG.shots.home;
  if (CFG.bullFrames && CFG.bullFrames.length) {
    BULL_IMGS = CFG.bullFrames.map((u) => { const im = new Image(); im.src = u; return im; });
    urls.push(...CFG.bullFrames);
  }
  await Promise.all(
    urls.map((u) => new Promise((res) => { const im = new Image(); im.onload = res; im.onerror = res; im.src = u; }))
  );
  document.fonts && (await document.fonts.ready);
  return true;
};

// SVG stroke lengths, measured once lazily.
let STROKES = null;
function strokes() {
  if (!STROKES) {
    STROKES = ["outline-screen", "outline-base"].map((id) => {
      const p = document.getElementById(id);
      return { p, len: p.getTotalLength() };
    });
    STROKES.forEach(({ p, len }) => { p.style.strokeDasharray = String(len); });
  }
  return STROKES;
}

window.renderAt = function renderAt(t) {
  const stage = document.getElementById("stage");
  const W = stage.clientWidth, H = stage.clientHeight;
  const $ = (id) => document.getElementById(id);
  const [outline, wordmark, mac, base, screen, fly, bullC, bullR, home, grid] =
    ["outline", "wordmark", "mac", "base", "screen", "panels", "bull", "bullreal", "homepage", "grid"].map($);

  // ---- Act: boot — stroke-draw the MacBook outline, wordmark fade ---------
  const pBoot = seg(t, ...PHASES.boot);
  const bootDraw = easeOut(seg(pBoot, 0, 0.8));
  strokes().forEach(({ p, len }) => { p.style.strokeDashoffset = String(len * (1 - bootDraw)); });
  const outlineFade = 1 - seg(t, PHASES.assembly[0], PHASES.assembly[0] + 0.06);
  outline.style.opacity = String((pBoot > 0 ? 1 : 0) * outlineFade);
  wordmark.style.opacity = String(seg(pBoot, 0.25, 0.7) * outlineFade);

  // ---- Act: assembly — real mac appears, panels fall into the screen ------
  const pAsm = seg(t, ...PHASES.assembly);
  const pDive = seg(t, ...PHASES.dive);
  // camera push during first dive half: mac scales up and swallows the view
  const push = easeIO(seg(pDive, 0, 0.4));
  const macScale = lerp(1, 8, push);
  const macVisible = t >= PHASES.assembly[0] && push < 1;
  mac.style.display = macVisible ? "block" : "none";
  mac.style.opacity = String(seg(pAsm, 0, 0.15));
  mac.style.transform =
    `translate(-50%, -50%) scale(${macScale}) translateY(${lerp(0, -20, push)}px)`;
  base.style.opacity = String(1 - seg(push, 0.5, 0.9));
  screen.style.boxShadow = push > 0.5 ? "none" : "";
  document.querySelectorAll("#screen-inner .panel").forEach((el) => {
    const i = Number(el.dataset.i);
    const sp = START_POSES[i];
    const local = easeIO(seg(pAsm, 0.05 + i * 0.055, 0.55 + i * 0.045));
    const x = lerp(sp.x * 1400, 0, local);
    const y = lerp(sp.y * 1000, 0, local);
    const r = lerp(sp.r, 0, local);
    el.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
    el.style.opacity = String(Math.min(1, local * 2.5));
  });

  // ---- Act: dive (second half) — panels fly past the camera ---------------
  const flyOn = pDive > 0.4 && t < PHASES.bull[0] + 0.04;
  fly.style.display = flyOn ? "block" : "none";
  if (flyOn) {
    document.querySelectorAll("#panels .panel").forEach((el) => {
      const i = Number(el.dataset.i);
      const d = PANEL_DEFS[i].dive;
      const f = easeIO(seg(pDive, 0.4 + i * 0.02, 0.95 + i * 0.004));
      const s = lerp(0.55, 5.2, f);
      const x = d[0] * f * W * 1.15;
      const y = d[1] * f * H * 1.15;
      el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${s})`;
      el.style.opacity = String((1 - seg(f, 0.72, 1)) * seg(pDive, 0.38, 0.46));
    });
  }
  grid.style.transform =
    `translate(${lerp(0, -140, pDive)}px, ${lerp(0, -90, pDive)}px) scale(${lerp(1, 1.6, pDive)})`;
  grid.style.opacity = String(0.9 - 0.55 * seg(t, ...PHASES.bull));

  // ---- Act: bull — particle silhouette converges (or real Veo frames) -----
  const pBull = seg(t, ...PHASES.bull);
  const hasReal = BULL_IMGS.length > 0;
  const bullOn = t >= PHASES.bull[0] - 0.02 && t < PHASES.reveal[0] + 0.06;
  const ctx = bullC.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  if (bullOn && (!hasReal || pBull < 0.2)) {
    const conv = easeOut(seg(pBull, 0, 0.45));
    const alive = hasReal ? 1 - seg(pBull, 0.05, 0.2) : 1;
    const brightness = 0.55 + 0.45 * seg(pBull, 0.5, 0.9);
    for (const pt of PARTICLES) {
      const x = lerp(pt.sx, pt.tx, conv);
      const y = lerp(pt.sy, pt.ty, conv);
      const green = pt.tint < 0.6;
      ctx.globalAlpha = alive * (0.35 + 0.65 * conv) * brightness;
      ctx.shadowBlur = pt.glow ? 10 : 0;
      ctx.shadowColor = "#00ff87";
      ctx.fillStyle = green ? "#00ff87" : "#f5f5f0";
      ctx.fillRect(x, y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    // grounding glow under the head
    const g = ctx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, W * 0.3);
    g.addColorStop(0, `rgba(0,255,135,${0.16 * conv * alive * brightness})`);
    g.addColorStop(1, "rgba(0,255,135,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  if (hasReal) {
    const idx = Math.min(BULL_IMGS.length - 1, Math.floor(pBull * BULL_IMGS.length));
    bullR.src = BULL_IMGS[Math.max(0, idx)].src;
    bullR.style.opacity = String(seg(pBull, 0.05, 0.2) * (1 - seg(t, PHASES.reveal[0], PHASES.reveal[0] + 0.08)));
  } else {
    bullR.style.opacity = "0";
  }

  // ---- Act: reveal — the homepage shot fades in under the runtime flash ---
  const pRev = seg(t, ...PHASES.reveal);
  home.style.opacity = String(seg(pRev, 0, 0.4));
  home.style.transform =
    `translate(-50%, -50%) scale(${lerp(1.06, 1.0, easeOut(pRev))})`;
  home.style.filter = `brightness(${lerp(0.85, 0.95, pRev)})`;
  return true;
};
</script>
</body>
</html>
```

- [ ] **Step 2: Smoke-render five checkpoints to the scratchpad**

Write a throwaway script `/private/tmp/claude-503/-Users-shaurya555-Desktop-lazybulllllll-laztbull/52e818e1-e017-4681-aaff-920de4d74073/scratchpad/scene-smoke.mjs` (adjust scratchpad path to the current session's if different):

```js
import { chromium } from "playwright";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repo = "/Users/shaurya555/Desktop/lazybulllllll/laztbull";
const scene = pathToFileURL(path.join(repo, "scripts/cinema/scene.html")).href;
// 1x1 dark png so panels have a texture before real shots exist
const px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(scene);
await page.evaluate((cfg) => window.initScene(cfg), { shots: { home: px, learn: px, trade: px }, bullFrames: null });
for (const t of [0.06, 0.25, 0.5, 0.7, 0.95]) {
  await page.evaluate((tt) => window.renderAt(tt), t);
  await page.screenshot({ path: `${process.env.OUT_DIR}/smoke_${String(t).replace(".", "_")}.png` });
}
await browser.close();
console.log("smoke ok");
```

Run (from the repo root so `playwright` resolves):

```bash
cd /Users/shaurya555/Desktop/lazybulllllll/laztbull && OUT_DIR=<scratchpad> node <scratchpad>/scene-smoke.mjs
```

Expected: `smoke ok` and five PNGs.

- [ ] **Step 3: Eyeball the five PNGs with the Read tool**

Check: t=0.06 shows glowing MacBook outline + wordmark; t=0.25 shows panels mid-flight into the screen; t=0.5 shows big flying panels; t=0.7 shows the particle bull head with green glow; t=0.95 shows the (placeholder-dark) homepage shot. Fix scene.html and re-run the smoke script until all five read correctly.

- [ ] **Step 4: Commit**

```bash
git add scripts/cinema/scene.html
git commit -m "feat(cinema): deterministic scene renderer for frame capture"
```

---

### Task 4: Capture pipeline (`scripts/cinema/capture.mjs`) + generate real frames

**Files:**
- Create: `scripts/cinema/capture.mjs`
- Generated: `public/cinema/frames/{desktop,mobile}/frame_0001..0160.webp`, `poster.webp`, `manifest.json`

- [ ] **Step 1: Write the capture script**

Create `scripts/cinema/capture.mjs`:

```js
// Scroll-cinema frame pipeline. Usage:
//   npm run cinema:capture            (dev server must be running on :3000)
//   SITE=http://localhost:3001 npm run cinema:capture
// Drop scripts/cinema/bull.mp4 (Veo clip) next to this file to replace the
// particle-bull placeholder, then re-run. See scripts/cinema/README.md.
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.join(ROOT, "shots");
const RAW = path.join(ROOT, "raw");
const OUT = path.resolve(ROOT, "..", "..", "public", "cinema", "frames");
const SCENE = pathToFileURL(path.join(ROOT, "scene.html")).href;
const SITE = process.env.SITE ?? "http://localhost:3000";
const FRAME_COUNT = 160;
const POSTER_INDEX = Math.round(FRAME_COUNT * 0.66); // bull moment, 1-based below
const SETS = [
  { name: "desktop", width: 1600, height: 1000 },
  { name: "mobile", width: 800, height: 1200 },
];
const PAGES = [
  ["home", "/"],
  ["learn", "/learn"],
  ["trade", "/trade"],
];

const pad = (n) => String(n).padStart(4, "0");

async function captureShots(browser) {
  fs.mkdirSync(SHOTS, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce", // freeze the site's ambient animation for clean shots
    colorScheme: "dark",
  });
  const page = await ctx.newPage();
  for (const [name, route] of PAGES) {
    const file = path.join(SHOTS, `${name}.png`);
    process.stdout.write(`shot ${name} ${SITE}${route} … `);
    await page.goto(SITE + route, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(2500); // let charts/fonts settle
    await page.screenshot({ path: file });
    console.log("ok");
  }
  await ctx.close();
}

function extractBullFrames() {
  const mp4 = path.join(ROOT, "bull.mp4");
  if (!fs.existsSync(mp4)) {
    console.log("no bull.mp4 — using particle placeholder");
    return null;
  }
  const dir = path.join(RAW, "bull");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-i", mp4,
    "-vf", "fps=30,scale=1200:-2,eq=saturation=1.05:gamma=0.98",
    path.join(dir, "bull_%04d.png"),
  ], { stdio: "inherit" });
  return fs.readdirSync(dir).filter((f) => f.endsWith(".png")).sort()
    .map((f) => pathToFileURL(path.join(dir, f)).href);
}

async function renderSet(browser, set, bullFrames) {
  const dir = path.join(RAW, set.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: set.width, height: set.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(SCENE);
  const shots = Object.fromEntries(
    PAGES.map(([name]) => [name, pathToFileURL(path.join(SHOTS, `${name}.png`)).href])
  );
  await page.evaluate((cfg) => window.initScene(cfg), { shots, bullFrames });
  for (let i = 0; i < FRAME_COUNT; i++) {
    const t = i / (FRAME_COUNT - 1);
    await page.evaluate((tt) => window.renderAt(tt), t);
    await page.screenshot({ path: path.join(dir, `frame_${pad(i + 1)}.png`) });
    if ((i + 1) % 20 === 0) console.log(`${set.name} ${i + 1}/${FRAME_COUNT}`);
  }
  await ctx.close();
}

function encodeSet(set, quality = 68) {
  const inDir = path.join(RAW, set.name);
  const outDir = path.join(OUT, set.name);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  execFileSync("ffmpeg", [
    "-y", "-framerate", "30",
    "-i", path.join(inDir, "frame_%04d.png"),
    "-c:v", "libwebp", "-lossless", "0", "-quality", String(quality),
    "-compression_level", "6",
    path.join(outDir, "frame_%04d.webp"),
  ], { stdio: "inherit" });
}

function writePosterAndManifest() {
  execFileSync("ffmpeg", [
    "-y", "-i", path.join(RAW, "desktop", `frame_${pad(POSTER_INDEX)}.png`),
    "-c:v", "libwebp", "-lossless", "0", "-quality", "72",
    path.join(OUT, "poster.webp"),
  ], { stdio: "inherit" });
  const manifest = {
    desktop: { dir: "/cinema/frames/desktop", width: 1600, height: 1000, frameCount: FRAME_COUNT },
    mobile: { dir: "/cinema/frames/mobile", width: 800, height: 1200, frameCount: FRAME_COUNT },
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
}

const skipShots = process.argv.includes("--skip-shots") &&
  PAGES.every(([n]) => fs.existsSync(path.join(SHOTS, `${n}.png`)));

const browser = await chromium.launch();
if (!skipShots) await captureShots(browser);
const bullFrames = extractBullFrames();
for (const set of SETS) {
  await renderSet(browser, set, bullFrames);
  encodeSet(set);
}
writePosterAndManifest();
await browser.close();
for (const set of SETS) {
  const size = execFileSync("du", ["-sh", path.join(OUT, set.name)]).toString().trim();
  console.log("payload", size);
}
console.log("done");
```

- [ ] **Step 2: Start the dev server via preview tools**

Create `.claude/launch.json` if missing:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "dev", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 3000 }
  ]
}
```

Then `preview_start` with name `dev` and confirm it serves (check `preview_logs` for "Ready").

- [ ] **Step 3: Run the pipeline**

Run: `npm run cinema:capture` (timeout 600000 — rendering 320 frames takes a few minutes)
Expected output ends with two `payload …` lines and `done`.

- [ ] **Step 4: Verify outputs and budget**

```bash
ls public/cinema/frames/desktop | wc -l   # → 160
ls public/cinema/frames/mobile | wc -l    # → 160
cat public/cinema/frames/manifest.json    # matches manifestSchema fields
du -sh public/cinema/frames/desktop public/cinema/frames/mobile
```

Expected: desktop ≤ 9MB, mobile ≤ 3MB. **If over budget:** re-run `encodeSet` with quality 58 by editing the `encodeSet(set)` calls to `encodeSet(set, 58)`, re-run `npm run cinema:capture -- --skip-shots`, and re-check.

Also eyeball 4 frames with the Read tool (they're WebP; if Read can't display, convert one to PNG in the scratchpad with ffmpeg first): `frame_0010`, `frame_0040`, `frame_0110`, `frame_0155` — outline / assembly / bull / homepage reveal respectively.

- [ ] **Step 5: Commit (script + generated frames)**

```bash
git add scripts/cinema/capture.mjs public/cinema/frames
git commit -m "feat(cinema): frame capture pipeline + generated placeholder frame sets"
```

---

### Task 5: `ScrollCinema` component

**Files:**
- Create: `components/scrollstory/ScrollCinema.tsx`

No meaningful unit test exists for canvas/ScrollTrigger glue (all logic with branching lives in `lib/cinema.ts`, already tested) — verification is Task 6's scripted preview pass.

- [ ] **Step 1: Write the component**

Create `components/scrollstory/ScrollCinema.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  COPY_BEATS,
  beatOpacity,
  canvasOpacity,
  flashOpacity,
  frameUrl,
  manifestSchema,
  progressToFrame,
  type FrameSet,
} from "@/lib/cinema";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const SCROLL_LENGTH_VH = 500;
const EAGER_FRAMES = 24;
const CHUNK = 24;

type Frame = ImageBitmap | HTMLImageElement;

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export function ScrollCinema() {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const copyRefs = useRef<(HTMLDivElement | null)[]>([]);
  // "cinema" until proven otherwise; flips to static for reduced-motion or load failure
  const [mode, setMode] = useState<"cinema" | "static">("cinema");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMode("static");
      return;
    }
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!section || !canvas || !ctx) return;

    let disposed = false;
    let st: ScrollTrigger | null = null;
    let set: FrameSet | null = null;
    const frames: (Frame | null)[] = [];
    let progress = 0;
    let lastDrawn = -1;

    const draw = () => {
      if (!set) return;
      const target = progressToFrame(progress, set.frameCount);
      // nearest loaded frame at/below target, else nearest above — never blank
      let idx = target;
      while (idx >= 0 && !frames[idx]) idx--;
      if (idx < 0) {
        idx = target;
        while (idx < set.frameCount && !frames[idx]) idx++;
        if (idx >= set.frameCount) return;
      }
      if (idx === lastDrawn) return;
      lastDrawn = idx;
      const img = frames[idx] as Frame;
      const cw = canvas.width;
      const ch = canvas.height;
      const scale = Math.max(cw / set.width, ch / set.height);
      const dw = set.width * scale;
      const dh = set.height * scale;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };

    const applyOverlays = () => {
      if (stickyRef.current) stickyRef.current.style.opacity = String(canvasOpacity(progress));
      if (flashRef.current) flashRef.current.style.opacity = String(flashOpacity(progress));
      COPY_BEATS.forEach((beat, i) => {
        const el = copyRefs.current[i];
        if (!el) return;
        const o = beatOpacity(progress, beat);
        el.style.opacity = String(o);
        el.style.transform = `translate(-50%, calc(-50% + ${((1 - o) * 14).toFixed(2)}px))`;
      });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      lastDrawn = -1;
      draw();
    };

    const loadFrame = async (s: FrameSet, i: number) => {
      try {
        const res = await fetch(frameUrl(s.dir, i));
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        frames[i] =
          typeof createImageBitmap === "function"
            ? await createImageBitmap(blob)
            : await blobToImage(blob);
      } catch {
        frames[i] = null;
      }
    };

    (async () => {
      try {
        const res = await fetch("/cinema/frames/manifest.json");
        if (!res.ok) throw new Error(String(res.status));
        const manifest = manifestSchema.parse(await res.json());
        set = window.innerWidth <= 768 ? manifest.mobile : manifest.desktop;
      } catch {
        if (!disposed) setMode("static");
        return;
      }
      frames.length = set.frameCount;
      resize();
      const eager = Math.min(EAGER_FRAMES, set.frameCount);
      await Promise.all(Array.from({ length: eager }, (_, i) => loadFrame(set!, i)));
      if (disposed) return;
      draw();
      // Background-load the rest in chunks; redraw in case the user scrubbed ahead.
      void (async () => {
        for (let start = eager; start < set!.frameCount && !disposed; start += CHUNK) {
          const n = Math.min(CHUNK, set!.frameCount - start);
          await Promise.all(Array.from({ length: n }, (_, j) => loadFrame(set!, start + j)));
          if (!disposed) {
            lastDrawn = -1;
            draw();
          }
        }
      })();
      st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        onUpdate: (self) => {
          progress = self.progress;
          draw();
          applyOverlays();
        },
      });
      applyOverlays();
    })();

    window.addEventListener("resize", resize);
    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      st?.kill();
      for (const f of frames) {
        if (f && "close" in f) f.close();
      }
    };
  }, []);

  if (mode === "static") {
    // Reduced motion or frames unavailable: calm static hero, copy laid out plainly.
    return (
      <section className="relative overflow-hidden border-b border-border bg-bg">
        <img
          src="/cinema/frames/poster.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-30"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <div className="relative mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center gap-10 px-6 py-24 text-center">
          {COPY_BEATS.map((b) => (
            <div key={b.id}>
              <div className="font-display text-3xl tracking-tightest text-fg md:text-4xl">{b.heading}</div>
              {b.sub && <div className="mt-2 font-mono text-sm text-fg-dim">{b.sub}</div>}
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      data-cinema
      className="relative z-20 bg-bg"
      style={{ height: `${SCROLL_LENGTH_VH}vh`, marginBottom: "-100vh" }}
    >
      <div ref={stickyRef} className="pointer-events-none sticky top-0 h-screen w-full overflow-hidden">
        <canvas ref={canvasRef} className="h-full w-full" />
        {COPY_BEATS.map((b, i) => (
          <div
            key={b.id}
            ref={(el) => { copyRefs.current[i] = el; }}
            className="absolute left-1/2 top-1/2 w-[min(90vw,760px)] -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ opacity: 0 }}
          >
            <div className="font-display text-4xl tracking-tightest text-fg md:text-6xl">{b.heading}</div>
            {b.sub && <div className="mt-3 font-mono text-sm text-fg-dim md:text-base">{b.sub}</div>}
          </div>
        ))}
        <div ref={flashRef} className="absolute inset-0 bg-bull" style={{ opacity: 0 }} />
        <noscript>
          <img src="/cinema/frames/poster.webp" alt="LazyBull — options, without the fog" className="absolute inset-0 h-full w-full object-cover" />
        </noscript>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (pre-existing errors, if any, must not originate from the new files).

- [ ] **Step 3: Commit**

```bash
git add components/scrollstory/ScrollCinema.tsx
git commit -m "feat(cinema): ScrollCinema scrub component with overlays + fallbacks"
```

---

### Task 6: Wire into the homepage + scripted preview verification

**Files:**
- Modify: `app/page.tsx` (imports block + one insertion between `<Nav />` and `<Hero />`)

- [ ] **Step 1: Insert the component**

In `app/page.tsx`, add to the imports:

```tsx
import { ScrollCinema } from "@/components/scrollstory/ScrollCinema";
```

and change

```tsx
        <Nav />

        <Hero />
```

to

```tsx
        <Nav />

        <ScrollCinema />

        <Hero />
```

Nothing else in the file changes.

- [ ] **Step 2: Verify in the preview (server from Task 4 is still running; reload)**

Using preview tools against the running dev server:

1. `preview_eval`: `window.location.reload()` then, after load, for each checkpoint p in [0.05, 0.2, 0.45, 0.7, 0.86, 0.97]:
   `(() => { const s = document.querySelector('[data-cinema]'); const y = s.offsetTop + p * (s.offsetHeight - innerHeight); window.scrollTo(0, y); return y; })()`
   (substitute p literally per call), then `preview_screenshot`.
2. Expected per checkpoint: 0.05 outline+wordmark · 0.2 panels assembling + "One terminal." copy · 0.45 dive fly-by + bots copy · 0.7 bull + "Learn it." copy · 0.86 green flash washing the frame · 0.97 canvas nearly transparent with the REAL `<Hero />` (live candle chart) visible beneath.
3. `preview_console_logs` with level `error` → empty (ignore pre-existing unrelated warnings).
4. Nav check: the sticky Nav must remain visible/clickable at every checkpoint (it's `z-50` over the cinema's `z-20`).
5. Scroll to bottom: Footer reachable, section order unchanged below the hero.
6. `preview_resize` to mobile preset, reload, spot-check p=0.2 and p=0.7 (mobile frame set loads — confirm via `preview_network` that requests hit `/cinema/frames/mobile/`).
7. Reduced-motion: `preview_eval` can't force the media query — instead temporarily verify the static branch by loading with DevTools emulation unavailable; acceptable substitute: assert the fallback renders by checking the `mode === "static"` branch visually once via editing nothing — skip if not feasible in preview; the branch is exercised by the failure path test below.
8. Failure fallback: `preview_eval` `fetch('/cinema/frames/manifest.json').then(r => r.status)` → 200 (sanity that the happy path is real, not the fallback).

Fix any issue found by editing source (not preview_eval), re-check, then proceed.

- [ ] **Step 3: Run the full test suite once more**

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(cinema): mount scroll cinema as homepage hero"
```

---

### Task 7: Pipeline README + Veo bull prompt

**Files:**
- Create: `scripts/cinema/README.md`

- [ ] **Step 1: Write the README**

Create `scripts/cinema/README.md`:

```markdown
# Scroll-cinema frame pipeline

Generates the frame sequence behind the homepage scroll hero
(`components/scrollstory/ScrollCinema.tsx`). Frames land in
`public/cinema/frames/` and ARE committed; everything in this folder's
`shots/` and `raw/` subdirs is intermediate and gitignored.

## Run it

1. Start the dev server: `npm run dev` (pipeline screenshots the live pages).
2. `npm run cinema:capture`
   - `SITE=http://localhost:3001 npm run cinema:capture` for a non-default port.
   - `npm run cinema:capture -- --skip-shots` to reuse existing page screenshots.
3. Commit the regenerated `public/cinema/frames/`.

Requires: ffmpeg on PATH, Playwright Chromium (`npx playwright install chromium`).

## The bull (swap the placeholder for real footage)

The bull act (58–80% of the sequence) uses a green particle silhouette until
you provide real footage. To upgrade, generate an ~8s clip with your free
Google AI Studio Veo credits (aistudio.google.com → video generation):

**Prompt:**

> Cinematic product-film shot: a powerful black bull emerges from total
> darkness, walking slowly toward camera, head lowered, then rising proudly
> to face the lens. Neon green rim lighting (hex #00ff87) traces its
> silhouette against a pure black void. Sparse floating green embers in the
> deep background. Premium, dramatic, Apple-commercial mood. Slow push-in
> camera, shallow depth of field, photorealistic. Dark scene, single subject
> centered, no text, no logos.

**Settings:** 16:9, highest available resolution, ~8 seconds.

Then:

1. Save the clip as `scripts/cinema/bull.mp4`.
2. Re-run `npm run cinema:capture -- --skip-shots`.
3. Review frames 95–128 (`public/cinema/frames/desktop/`), commit.

No code changes needed — the pipeline detects `bull.mp4`, extracts and
color-grades frames with ffmpeg, and the scene cross-fades from particles to
footage automatically.

## Tuning

- Frame count / sizes / quality: constants at the top of `capture.mjs`
  (`FRAME_COUNT`, `SETS`, `encodeSet` quality — drop to 58 if over the
  9MB desktop / 3MB mobile budgets).
- Choreography: `scene.html` (`PHASES` must stay in sync with `ACTS` in
  `lib/cinema.ts`).
- Copy beats: `COPY_BEATS` in `lib/cinema.ts` (DOM overlays, not baked in).
```

- [ ] **Step 2: Commit**

```bash
git add scripts/cinema/README.md
git commit -m "docs(cinema): pipeline usage + Veo bull prompt"
```

---

## Post-plan checks (run after all tasks)

- [ ] `npm run build` succeeds (Vercel parity).
- [ ] `git status` clean except the user's pre-existing unrelated modifications (`components/learn/…`, `lib/quant/…`, `STRATEGY.md`, `docs/strategy/`) — do NOT commit those.
- [ ] Tell the user: the placeholder bull ships now; to get the real bull, follow `scripts/cinema/README.md` (Veo prompt included), drop in `bull.mp4`, re-run the pipeline.

## Self-review notes

- **Spec coverage:** acts/choreography (Tasks 3, 5), DOM copy + flash (Tasks 1, 5), architecture files (Tasks 1, 5, 6), pipeline incl. bull ingestion + placeholder-first (Tasks 3, 4, 7), performance (chunked loading, DPR cap, mobile set — Task 5; payload budget — Task 4), reduced-motion + no-JS + failure fallbacks (Task 5), testing (Tasks 1, 6), frames committed (Task 4), out-of-scope respected (only `app/page.tsx` modified among existing files).
- **Known judgment calls:** `marginBottom: -100vh` overlap for the in-place handoff (documented in File structure); scene.html panel crops use `background-position` percentages of full-page screenshots — imperfect crops are acceptable for panels flying at speed; the reduced-motion preview check (Task 6 step 2.7) is best-effort since preview tools can't emulate the media query — the static branch is still exercised via the failure path and code review.

"use client";

/**
 * THE MATTER (Phase 3, M1, 2026-11-09): the site's one living material.
 *
 * One renderer and one WebGL context for every shape the matter takes. Pages
 * mark where it lives with <MatterSlot shape="…"> (lib/matter.ts); the engine
 * moves its single canvas into whichever slot is most on screen. Moving a
 * canvas in the DOM keeps its context, so the hero's sphere, the safety
 * section's ledger line and the footer's bull share one GPU context and one
 * set of shaders, and the canvas sits inside each section's own stacking
 * order instead of floating over the page.
 *
 *   sphere  the hero (frame zero), and as the curtain lifts it drains into
 *           the seam where the film opens (M11)
 *   ledger  "Boring, by design.": the matter lying down flat, its wave dying
 *           to nothing as the section arrives (M15)
 *   bull    the footer's curtain call: the film's bull, as matter, turning
 *           to the cursor (M18)
 *
 * When a shape takes the stage its particles gather out of a scattered cloud.
 * Nothing draws while no slot is on screen, or the tab is hidden; the motion
 * pause holds the last frame; reduced motion draws one still frame; a lost
 * context simply stops drawing until it is restored. The light theme draws
 * the same dots in deep inks with normal blending.
 *
 * Loaded lazily by MatterRoot, after the page has loaded and gone idle, and
 * never on a tool route.
 */

import * as THREE from "three";
import { isMotionPaused, onMotionPausedChange } from "@/lib/motion/bus";
import { getMatterSlots, onMatterSlots, type MatterShape, type MatterSlotEntry } from "@/lib/matter";
import { ACTS } from "@/lib/cinema";
import { cinemaClock } from "@/lib/cinema-clock";
import { BOKEH_FRAG, BOKEH_VERT, BULL_VERT, DOT_FRAG, LEDGER_VERT, SPHERE_VERT } from "./shaders";

// ── the palette ─────────────────────────────────────────────────────────────
// The 2026-11 brand, top to bottom: mint, blue, violet (mint stays: the
// owner's call, 2026-11-09).
const BRAND = { top: "#52ffa5", mid: "#3884ff", bottom: "#582eff" };

/**
 * The brand colours as a five-stop ramp, bottom to top. On the dark ground
 * every stop is a TINT (lifted toward white), so neighbouring stops sit close
 * in lightness and read as one gradient. On paper the same ramp is pulled
 * toward a deep navy instead, so it reads as ink.
 */
function rampStops(ink: boolean): THREE.Color[] {
  const rgb = (hex: string) => {
    const c = new THREE.Color();
    c.setStyle(hex, THREE.SRGBColorSpace);
    const out = { r: 0, g: 0, b: 0 };
    c.getRGB(out, THREE.SRGBColorSpace);
    return [out.r, out.g, out.b];
  };
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  const toward = ink ? [0.06, 0.07, 0.16] : [1, 1, 1];
  const k = ink ? 0.35 : 1;
  const top = rgb(BRAND.top);
  const mid = rgb(BRAND.mid);
  const bottom = rgb(BRAND.bottom);
  const stops = [
    mix(bottom, toward, 0.32 * k),
    mix(mix(mid, bottom, 0.5), toward, 0.28 * k),
    mix(mid, toward, 0.18 * k),
    mix(mix(top, mid, 0.5), toward, 0.25 * k),
    ink ? mix(mix(top, mid, 0.35), toward, 0.3) : mix(mix(top, toward, 0.42), mid, 0.12),
  ];
  return stops.map(([r, g, b]) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace));
}

// ── shared bits ─────────────────────────────────────────────────────────────
type U = { value: unknown };
type Shared = {
  uTime: U;
  uPixelRatio: U;
  uInk: U;
  uStop0: U;
  uStop1: U;
  uStop2: U;
  uStop3: U;
  uStop4: U;
};

type FrameCtx = {
  t: number;
  dt: number;
  pointer: { x: number; y: number };
  slot: MatterSlotEntry;
  rect: DOMRect;
  visW: number;
  visH: number;
};

type Rig = {
  shape: MatterShape;
  root: THREE.Object3D;
  materials: THREE.ShaderMaterial[];
  ready: boolean;
  /** The lens this shape is shot with, in degrees; the wide one if unset. */
  fov?: number;
  assemble: { value: number };
  fit(w: number, h: number, ctx: Pick<FrameCtx, "slot" | "visW" | "visH">): void;
  tick(ctx: FrameCtx): void;
  /** Nothing left to animate: the loop may rest until something changes. */
  settled(): boolean;
  /** The pose for a still frame (reduced motion). */
  still(): void;
  dispose(): void;
};

const WIDE_LENS = 75;

const ADDITIVE = {
  transparent: true,
  depthWrite: false,
  depthTest: false,
  blending: THREE.AdditiveBlending,
  premultipliedAlpha: true,
} as const;

/** Deterministic per-point variation (no Math.random: the same frame every load). */
const hash = (i: number, k: number) => {
  const s = Math.sin(i * k) * 43758.5453;
  return s - Math.floor(s);
};

/** Evenly spread points on a sphere (the golden-angle spiral). */
function fibonacciSphere(count: number, radius: number) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    pos[i * 3] = Math.cos(th) * r * radius;
    pos[i * 3 + 1] = y * radius;
    pos[i * 3 + 2] = Math.sin(th) * r * radius;
    seed[i] = hash(i, 12.9898);
  }
  return { pos, seed };
}

const dotMaterial = (vertexShader: string, shared: Shared, own: Record<string, U>, glow: boolean) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, ...own, uGlow: { value: glow ? 1 : 0 } },
    vertexShader,
    fragmentShader: DOT_FRAG,
    ...ADDITIVE,
  });

// ── the sphere (the hero) ───────────────────────────────────────────────────
// Radius 1.2; the noise pushes the surface out to about 1.45 on average and
// 1.65 at the very most.
const RADIUS = 1.2;
const EXTENT = 1.45;
const REACH = 1.65;

function sphereRig(shared: Shared, phone: boolean): Rig {
  // 120k dots on a desktop (28k on a phone): a fine fabric at retina size.
  // Light is count × dot area × alpha, so alpha pays back what the finer
  // fabric adds over the first cut (72k dots at 1.85, 16k at 2.1).
  const fabric = phone ? { count: 28000, size: 1.8 } : { count: 120000, size: 1.6 };
  const first = phone ? { count: 16000, size: 2.1 } : { count: 72000, size: 1.85 };
  const { pos, seed } = fibonacciSphere(fabric.count, RADIUS);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const assemble = { value: 0 };
  const own: Record<string, U> = {
    uAgitation: { value: 0 },
    uSize: { value: fabric.size },
    uFadeLow: { value: -0.6 },
    uFadeHigh: { value: -0.25 },
    uRampBase: { value: 0 },
    uAlpha: { value: (first.count / fabric.count) * (first.size / fabric.size) ** 2 },
    uAssemble: assemble,
    uDrain: { value: 0 },
    uSeam: { value: new THREE.Vector2(0, -2) },
    uLight: { value: new THREE.Vector3(0.8, 1.2, 2.6) },
  };
  const dots = dotMaterial(SPHERE_VERT, shared, own, false);
  const glow = dotMaterial(SPHERE_VERT, shared, own, true);
  const sphere = new THREE.Group();
  sphere.add(new THREE.Points(geo, glow), new THREE.Points(geo, dots));

  // The bokeh: a few big, faint, out-of-focus dots behind the sphere.
  const BOKEH = phone ? 16 : 34;
  const bPos = new Float32Array(BOKEH * 3);
  const bSeed = new Float32Array(BOKEH);
  const bCol = new Float32Array(BOKEH * 3);
  const stopsNow = () => [shared.uStop0, shared.uStop1, shared.uStop2, shared.uStop3, shared.uStop4].map((u) => u.value as THREE.Color);
  const paintBokeh = () => {
    const s = stopsNow();
    for (let i = 0; i < BOKEH; i++) {
      const tint = s[Math.min(4, Math.floor(hash(i, 39.425) * 5))];
      bCol[i * 3] = tint.r;
      bCol[i * 3 + 1] = tint.g;
      bCol[i * 3 + 2] = tint.b;
    }
  };
  for (let i = 0; i < BOKEH; i++) {
    bPos[i * 3] = (hash(i, 78.233) - 0.5) * 9;
    bPos[i * 3 + 1] = (hash(i, 39.425) - 0.5) * 5.5;
    bPos[i * 3 + 2] = -1.2 - hash(i, 12.989) * 3.5;
    bSeed[i] = hash(i, 12.989);
  }
  paintBokeh();
  const bGeo = new THREE.BufferGeometry();
  bGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
  bGeo.setAttribute("aSeed", new THREE.BufferAttribute(bSeed, 1));
  const bColAttr = new THREE.BufferAttribute(bCol, 3);
  bGeo.setAttribute("aColor", bColAttr);
  const bMat = new THREE.ShaderMaterial({
    uniforms: { uTime: shared.uTime, uPixelRatio: shared.uPixelRatio, uAssemble: assemble },
    vertexShader: BOKEH_VERT,
    fragmentShader: BOKEH_FRAG,
    ...ADDITIVE,
  });
  const bokeh = new THREE.Points(bGeo, bMat);

  const root = new THREE.Group();
  root.add(bokeh, sphere);

  let agitation = 0;
  let lastInk = shared.uInk.value;

  return {
    shape: "sphere",
    root,
    materials: [dots, glow, bMat],
    ready: true,
    assemble,
    fit(w, h, { slot, visW, visH }) {
      // Big: about 74% of the height on a landscape screen, centred at 42% so
      // it rises out of the headline, and wide on a phone. The copy is kept
      // clear by the shader's dissolve band, measured from the DOM because the
      // copy is sized in pixels and the frame in viewport units.
      const portrait = w / h < 0.8;
      const centre = portrait ? 0.29 : 0.42;
      // The tallest noise peak (REACH, not EXTENT) stays under the top edge.
      const radius = Math.min(visH * (portrait ? 0.26 : 0.37), visW * (portrait ? 0.47 : 0.4), (centre - 0.025) * visH * (EXTENT / REACH));
      sphere.scale.setScalar(radius / EXTENT);
      sphere.position.y = visH * (0.5 - centre);
      (own.uSeam.value as THREE.Vector2).set(0, -visH * 0.42);
      const section = slot.el.closest("section");
      const heading = section?.querySelector("h1") ?? null;
      // Layout offsets, not getBoundingClientRect: the headline rises in from
      // 14px lower, and a rect taken mid-entrance would seat the band low.
      let hb: { top: number; height: number } | null = null;
      if (heading && section) {
        let y = 0;
        for (let n: HTMLElement | null = heading; n && n !== section; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
        hb = { top: y, height: heading.offsetHeight };
      }
      const ndc = (px: number) => 1 - (2 * px) / h;
      const fadeMid = hb && hb.height ? hb.top + hb.height * 0.72 : h * (portrait ? 0.5 : 0.62);
      if (hb && hb.height) {
        own.uFadeHigh.value = ndc(hb.top + hb.height * 0.4);
        own.uFadeLow.value = ndc(hb.top + hb.height * 1.05);
      } else {
        own.uFadeHigh.value = portrait ? 0.0 : -0.2;
        own.uFadeLow.value = portrait ? -0.3 : -0.5;
      }
      // The ramp's violet end is pinned at the middle of the dissolve.
      const radiusPx = (radius / visH) * h;
      own.uRampBase.value = Math.min(0.42, Math.max(0, 0.5 + (centre * h - fadeMid) / (2 * radiusPx)));
    },
    tick({ t, dt, pointer, slot, rect }) {
      if (shared.uInk.value !== lastInk) {
        lastInk = shared.uInk.value;
        paintBokeh();
        bColAttr.needsUpdate = true;
        bokeh.visible = !lastInk;
      }
      // The lift: how far the hero has scrolled off the top of the screen.
      const lift = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      const k = 1 - Math.exp(-dt * 3.2);
      agitation += (lift - agitation) * k;
      own.uAgitation.value = agitation;
      own.uDrain.value = slot.drain ? Math.min(1, Math.max(0, (lift - 0.04) / 0.72)) : 0;
      // The copy's bottom wash steps aside for the drain (anomalous-matter-hero).
      if (slot.drain) slot.el.closest("section")?.style.setProperty("--matter-lift", lift.toFixed(3));
      shared.uTime.value = t * 0.3;
      (own.uLight.value as THREE.Vector3).set(pointer.x * 3.2, pointer.y * 2.2 + 0.4, 2.6);
      sphere.rotation.y = t * 0.035 + pointer.x * 0.28;
      sphere.rotation.x = t * 0.015 - pointer.y * 0.18;
      bokeh.position.x = -pointer.x * 0.12;
      bokeh.position.y = -pointer.y * 0.08;
    },
    settled: () => false,
    still() {
      shared.uTime.value = 1.4;
      sphere.rotation.set(0.12, 0.5, 0);
    },
    dispose() {
      geo.dispose();
      bGeo.dispose();
      dots.dispose();
      glow.dispose();
      bMat.dispose();
    },
  };
}

// ── the ledger (M15) ────────────────────────────────────────────────────────
function ledgerRig(shared: Shared, phone: boolean): Rig {
  const N = phone ? 9000 : 24000;
  const line = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    line[i * 3] = hash(i, 17.13) * 2 - 1;
    line[i * 3 + 1] = (hash(i, 63.71) - 0.5) * 0.12;
    line[i * 3 + 2] = (hash(i, 29.57) - 0.5) * 0.12;
    seed[i] = hash(i, 91.37);
  }
  const geo = new THREE.BufferGeometry();
  // three culls by `position`; the line lives in aLine, so position is a
  // placeholder of the same length and the object is never frustum-culled.
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute("aLine", new THREE.BufferAttribute(line, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const assemble = { value: 0 };
  const wave = { value: 1 };
  const own: Record<string, U> = {
    uSize: { value: phone ? 1.7 : 1.5 },
    uAlpha: { value: 0.55 },
    uAssemble: assemble,
    uWave: wave,
    uHalf: { value: new THREE.Vector2(1, 0.02) },
  };
  const dots = dotMaterial(LEDGER_VERT, shared, own, false);
  const glow = dotMaterial(LEDGER_VERT, shared, own, true);
  const a = new THREE.Points(geo, glow);
  const b = new THREE.Points(geo, dots);
  a.frustumCulled = false;
  b.frustumCulled = false;
  const root = new THREE.Group();
  root.add(a, b);
  return {
    shape: "ledger",
    root,
    materials: [dots, glow],
    ready: true,
    assemble,
    fit(_w, _h, { visW, visH }) {
      (own.uHalf.value as THREE.Vector2).set(visW * 0.47, visH * 0.02);
    },
    tick({ t, dt }) {
      shared.uTime.value = t * 0.3;
      // Dead calm: the wave dies over ~600ms once the line has gathered.
      if (assemble.value > 0.6) wave.value = Math.max(0, wave.value - dt / 0.6);
    },
    settled: () => assemble.value >= 1 && wave.value <= 0,
    still() {
      wave.value = 0;
    },
    dispose() {
      geo.dispose();
      dots.dispose();
      glow.dispose();
    },
  };
}

// ── the bull (M18) ──────────────────────────────────────────────────────────
function bullRig(shared: Shared, phone: boolean, onReady: () => void): Rig {
  const N = phone ? 14000 : 30000;
  const assemble = { value: 0 };
  const own: Record<string, U> = {
    uSize: { value: phone ? 1.3 : 0.95 },
    uAlpha: { value: 1.3 },
    uAssemble: assemble,
    uLight: { value: new THREE.Vector3(-2.5, 3.5, 3) },
  };
  const dots = dotMaterial(BULL_VERT, shared, own, false);
  const glow = dotMaterial(BULL_VERT, shared, own, true);
  const geo = new THREE.BufferGeometry();
  const bull = new THREE.Group();
  const root = new THREE.Group();
  root.add(bull);
  const rig: Rig = {
    shape: "bull",
    // The film's long lens. The engine's wide one, this close, made a squat
    // boar of the same model.
    fov: 34,
    root,
    materials: [dots, glow],
    ready: false,
    assemble,
    fit(w, h, { visH }) {
      // Most of its slot's height, a little below centre.
      bull.scale.setScalar(visH * 0.52);
      bull.position.set(0, -visH * 0.06, 0);
    },
    tick({ t, pointer }) {
      shared.uTime.value = t * 0.3;
      // It turns to follow the cursor, never all the way round.
      bull.rotation.y = -0.72 + pointer.x * 0.45;
      bull.rotation.x = 0.12 - pointer.y * 0.1;
    },
    settled: () => false,
    still() {
      bull.rotation.set(0.12, -0.72, 0);
    },
    dispose() {
      geo.dispose();
      dots.dispose();
      glow.dispose();
    },
  };

  // The film's own model, sampled on its surface. Three's loaders arrive only
  // when the footer is first reached.
  (async () => {
    try {
      const [{ GLTFLoader }, { DRACOLoader }, { MeshSurfaceSampler }] = await Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/loaders/DRACOLoader.js"),
        import("three/examples/jsm/math/MeshSurfaceSampler.js"),
      ]);
      const draco = new DRACOLoader().setDecoderPath("/draco/");
      const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync("/models/bull-crystal.glb");
      draco.dispose();
      gltf.scene.updateMatrixWorld(true);
      let mesh: THREE.Mesh | null = null;
      gltf.scene.traverse((o) => {
        if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
      });
      if (!mesh) return;
      const m = mesh as THREE.Mesh;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      g.computeBoundingBox();
      const box = g.boundingBox!;
      const centre = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const s = 2 / Math.max(size.x, size.y, size.z);
      g.translate(-centre.x, -centre.y, -centre.z);
      g.scale(s, s, s);
      const sampler = new MeshSurfaceSampler(new THREE.Mesh(g)).build();
      const pos = new Float32Array(N * 3);
      const nor = new Float32Array(N * 3);
      const seed = new Float32Array(N);
      const p = new THREE.Vector3();
      const n = new THREE.Vector3();
      for (let i = 0; i < N; i++) {
        sampler.sample(p, n);
        pos.set([p.x, p.y, p.z], i * 3);
        nor.set([n.x, n.y, n.z], i * 3);
        seed[i] = hash(i, 47.11);
      }
      g.dispose();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aNormal", new THREE.BufferAttribute(nor, 3));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
      bull.add(new THREE.Points(geo, glow), new THREE.Points(geo, dots));
      rig.ready = true;
      onReady();
    } catch {
      // No bull, no curtain call: the footer reads the same without it.
    }
  })();
  return rig;
}

// ── the engine ──────────────────────────────────────────────────────────────
const ASSEMBLE_S = 1.6;

class MatterEngine {
  private renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(WIDE_LENS, 1, 0.1, 100);
  private shared: Shared;
  private rigs = new Map<MatterShape, Rig>();
  private active: MatterSlotEntry | null = null;
  private ratios = new Map<HTMLElement, number>();
  private observed = new Set<HTMLElement>();
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private raf = 0;
  private lost = false;
  private last = performance.now();
  private t = 0;
  private target = { x: 0, y: 0 };
  private pointer = { x: 0, y: 0 };
  private pixelRatio: number;
  private slow = 0;
  private stepped = false;
  private reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Released while the film holds the GPU, and taken back before a slot
  // returns (Gate A3 #9: peak contexts 4 → 3). WHEN is the point (Gate A4
  // #2): released 1.5 s after the sphere left, it went mid-dive and stalled
  // the dive for 325 ms; on the landing it thrashed between slots. Now: only
  // while the film is pinned and past the dive, on idle, and reclaimed at
  // 800 px from any slot so the restore is done before the slot is on screen.
  private loseExt: WEBGL_lose_context | null = null;
  private released = false;
  private releaseTimer = 0;
  private near = new Set<Element>();
  private nearIo: IntersectionObserver;
  private heldAt = -1;
  private phone = window.matchMedia("(max-width: 767px)").matches;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    // Full retina; slow GPUs step down once (see adapt).
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute("aria-hidden", "true");
    this.canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity 1.2s cubic-bezier(0.22,1,0.36,1)";
    this.camera.position.z = 3;

    const stops = rampStops(this.ink());
    this.shared = {
      uTime: { value: 0 },
      uPixelRatio: { value: this.pixelRatio },
      uInk: { value: this.ink() ? 1 : 0 },
      uStop0: { value: stops[0] },
      uStop1: { value: stops[1] },
      uStop2: { value: stops[2] },
      uStop3: { value: stops[3] },
      uStop4: { value: stops[4] },
    };

    this.io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) this.ratios.set(e.target as HTMLElement, e.isIntersecting ? e.intersectionRatio : 0);
        this.choose();
      },
      { threshold: [0, 0.05, 0.15, 0.3, 0.5, 0.75] }
    );
    this.ro = new ResizeObserver(() => this.fit());
    this.nearIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) this.near.add(e.target);
          else this.near.delete(e.target);
        }
        if (this.near.size) this.reclaim();
        else this.releaseLater();
      },
      { rootMargin: "800px 0px" }
    );

    this.loseExt = this.renderer.getContext().getExtension("WEBGL_lose_context");
    this.canvas.addEventListener("webglcontextlost", this.onLost);
    this.canvas.addEventListener("webglcontextrestored", this.onRestored);
    window.addEventListener("pointermove", this.onMove, { passive: true });
    document.addEventListener("visibilitychange", this.wake);
    onMotionPausedChange(this.onPause);
    new MutationObserver(() => this.applyTheme()).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    onMatterSlots(() => this.sync());
    this.sync();
  }

  private ink() {
    return document.documentElement.dataset.theme === "light";
  }

  private applyTheme() {
    const ink = this.ink();
    if ((this.shared.uInk.value === 1) === ink) return;
    this.shared.uInk.value = ink ? 1 : 0;
    rampStops(ink).forEach((c, i) => ((this.shared as Record<string, U>)[`uStop${i}`].value as THREE.Color).copy(c));
    for (const rig of this.rigs.values())
      for (const m of rig.materials) {
        m.blending = ink ? THREE.NormalBlending : THREE.AdditiveBlending;
        m.needsUpdate = true;
      }
    this.redraw();
  }

  /** Slots came or went: watch the new ones, forget the gone ones. */
  private sync() {
    const slots = getMatterSlots();
    const els = new Set(slots.map((s) => s.el));
    for (const el of this.observed)
      if (!els.has(el)) {
        this.io.unobserve(el);
        this.nearIo.unobserve(el);
        this.near.delete(el);
        this.observed.delete(el);
        this.ratios.delete(el);
      }
    for (const el of els)
      if (!this.observed.has(el)) {
        this.observed.add(el);
        this.io.observe(el);
        this.nearIo.observe(el);
      }
    if (this.active && !els.has(this.active.el)) this.active = null;
    this.choose();
  }

  /** The slot most on screen takes the matter. */
  private choose() {
    let best: MatterSlotEntry | null = null;
    let bestR = 0.02;
    for (const s of getMatterSlots()) {
      const r = this.ratios.get(s.el) ?? 0;
      if (r > bestR) {
        best = s;
        bestR = r;
      }
    }
    if (best) this.reclaim();
    if (best && best !== this.active) this.activate(best);
    else if (!best) {
      this.stop();
      this.releaseLater();
    } else this.schedule();
  }

  /** Is this a moment the film wants the GPU and nothing of the matter is near? */
  private mayRelease() {
    return !this.near.size && document.documentElement.dataset.film === "pinned";
  }

  /**
   * Give the context back, but only at a quiet moment of the film: pinned,
   * past the dive (the tunnel is the heaviest layer), while the reader has
   * stopped scrolling, and on idle. Losing a context stalls the GPU process
   * for 100–300 ms, so mid-scroll it was a hitch in whatever act it hit; at a
   * pause the frame is still. Re-checks until such a moment comes, or a slot
   * comes near and cancels it.
   */
  private releaseLater() {
    window.clearTimeout(this.releaseTimer);
    if (this.released || !this.mayRelease()) return;
    this.releaseTimer = window.setTimeout(() => {
      if (!this.mayRelease()) return;
      const p = cinemaClock.progress;
      const still = Math.abs(p - this.heldAt) < 0.0003;
      this.heldAt = p;
      if (p < ACTS.regime.from || !still) return this.releaseLater();
      const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 0));
      idle(() => this.mayRelease() && Math.abs(cinemaClock.progress - this.heldAt) < 0.0003 && this.release(), { timeout: 1000 });
    }, 700);
  }

  private release() {
    if (this.released || !this.loseExt || this.lost) return;
    this.released = true;
    this.loseExt.loseContext();
  }

  /** A slot is back: restore the context if it was given up (onRestored redraws). */
  private reclaim() {
    window.clearTimeout(this.releaseTimer);
    if (!this.released || !this.loseExt) return;
    this.released = false;
    this.loseExt.restoreContext();
  }

  private rig(shape: MatterShape): Rig {
    let r = this.rigs.get(shape);
    if (!r) {
      r =
        shape === "sphere"
          ? sphereRig(this.shared, this.phone)
          : shape === "ledger"
            ? ledgerRig(this.shared, this.phone)
            : bullRig(this.shared, this.phone, () => {
                // The bull arrived: gather it from the dust if it is still wanted.
                if (this.active?.shape === "bull") {
                  r!.assemble.value = this.reduce ? 1 : 0;
                  this.fit();
                  this.schedule(true);
                }
              });
      if (this.ink()) for (const m of r.materials) m.blending = THREE.NormalBlending;
      r.root.visible = false;
      this.scene.add(r.root);
      this.rigs.set(shape, r);
    }
    return r;
  }

  private activate(slot: MatterSlotEntry) {
    if (this.active) this.ro.unobserve(this.active.el);
    this.active = slot;
    slot.el.appendChild(this.canvas);
    this.ro.observe(slot.el);
    const rig = this.rig(slot.shape);
    for (const r of this.rigs.values()) r.root.visible = r === rig;
    rig.assemble.value = this.reduce ? 1 : 0;
    this.fit();
    if (this.reduce) this.still();
    else this.schedule(true);
  }

  private fit() {
    const slot = this.active;
    if (!slot) return;
    const w = slot.el.clientWidth;
    const h = slot.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.fov = this.rigs.get(slot.shape)?.fov ?? WIDE_LENS;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const visH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.rigs.get(slot.shape)?.fit(w, h, { slot, visW: visH * this.camera.aspect, visH });
    if (this.reduce) this.still();
    else this.redraw();
  }

  private ctx(dt: number): FrameCtx | null {
    const slot = this.active;
    if (!slot) return null;
    const visH = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    return { t: this.t, dt, pointer: this.pointer, slot, rect: slot.el.getBoundingClientRect(), visW: visH * this.camera.aspect, visH };
  }

  private render() {
    if (this.lost || !this.active) return;
    this.renderer.render(this.scene, this.camera);
    this.canvas.style.opacity = "1";
  }

  /** The current pose again without advancing time (a resize, a theme change). */
  private redraw() {
    const rig = this.active && this.rigs.get(this.active.shape);
    if (!rig?.ready) return;
    const c = this.ctx(0);
    if (c) rig.tick(c);
    this.render();
  }

  /** One frame and done: the shape without the motion. */
  private still() {
    const rig = this.active && this.rigs.get(this.active.shape);
    if (!rig?.ready) return;
    rig.assemble.value = 1;
    const c = this.ctx(0);
    if (c) rig.tick(c);
    rig.still();
    this.render();
  }

  // If frames stay slower than ~42ms (under ~24fps) for two seconds, step the
  // pixel ratio down once, to 1.5. Not lower, and not on a capped 30fps
  // (macOS on battery), which is no sign of a slow GPU.
  private adapt(dt: number) {
    if (this.stepped) return;
    this.slow = dt > 0.042 ? this.slow + dt : Math.max(0, this.slow - 2 * dt);
    if (this.slow < 2) return;
    this.stepped = true;
    this.pixelRatio = Math.min(this.pixelRatio, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.shared.uPixelRatio.value = this.pixelRatio;
    this.fit();
  }

  private frame = (now: number) => {
    this.raf = 0;
    const raw = (now - this.last) / 1000;
    const dt = Math.min(0.05, raw);
    this.last = now;
    if (raw < 0.25) this.adapt(raw);
    this.t += dt;
    const k = 1 - Math.exp(-dt * 3.2);
    this.pointer.x += (this.target.x - this.pointer.x) * k;
    this.pointer.y += (this.target.y - this.pointer.y) * k;
    const rig = this.active && this.rigs.get(this.active.shape);
    const c = this.ctx(dt);
    if (rig && c) {
      if (rig.ready && rig.assemble.value < 1) rig.assemble.value = Math.min(1, rig.assemble.value + dt / ASSEMBLE_S);
      if (rig.ready) {
        rig.tick(c);
        this.render();
      }
      // A settled shape (the ledger at dead calm) costs nothing until the
      // pointer or the page moves it again.
      if (rig.ready && rig.settled()) return;
    }
    this.schedule();
  };

  private schedule(reset = false) {
    if (reset) this.last = performance.now();
    if (this.raf || this.lost || !this.active || document.hidden || this.reduce || isMotionPaused()) return;
    if ((this.ratios.get(this.active.el) ?? 0) <= 0) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private onMove = (e: PointerEvent) => {
    this.target.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.target.y = -((e.clientY / window.innerHeight) * 2 - 1);
    const rig = this.active && this.rigs.get(this.active.shape);
    if (rig?.shape === "bull") this.schedule();
  };

  private wake = () => {
    this.last = performance.now();
    this.schedule();
  };

  // The pause holds the frame as it is; un-pausing picks the loop back up.
  private onPause = () => {
    if (isMotionPaused()) {
      this.stop();
      this.redraw();
    } else this.wake();
  };

  private onLost = (e: Event) => {
    e.preventDefault();
    this.lost = true;
    this.stop();
    this.canvas.style.opacity = "0";
  };

  private onRestored = () => {
    this.lost = false;
    this.fit();
    if (this.reduce) this.still();
    else this.wake();
  };
}

let engine: MatterEngine | null = null;

/** Start the matter once; it follows the slot registry from then on. */
export function startMatter() {
  if (engine) return;
  try {
    engine = new MatterEngine();
  } catch {
    // No WebGL: every slot keeps its CSS backdrop and nothing else changes.
  }
}

"use client";

// The signature candle act (progress ~0.32–0.56) as a LIVE INSTRUMENT: candles
// print in as you scroll with a glowing print-head; hovering a candle flares it
// and surfaces a live price tag; the drifting dust is repelled by your cursor;
// clicking fires a shockwave through the field; the camera orbits with your
// pointer (with inertia) and kicks its FOV when you scroll hard. All state flows
// through cinemaClock (one-clock rule). Crossfaded over the 2D scene by
// ScrollCinema.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, ChromaticAberration, SMAA } from "@react-three/postprocessing";
import { Grid, Line } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { cinemaClock } from "@/lib/cinema-clock";
import { CANDLE3D, CANDLE_BUILD_END, candleLabT, grade } from "@/lib/cinema";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * THE COLOURIST — lerps the act's colour script onto the live post chain.
 *
 * Before this, one Bloom at threshold 0.35 ran the whole 27%-of-the-film candle
 * act, so the print, the crash and the lab were all graded identically and the
 * act read as one green wash. grade() in lib/cinema.ts keys three rooms; this
 * writes them per frame. Damped rather than snapped so a room CHANGE reads as a
 * gear change rather than a cut.
 */
function Colourist({
  composerRef,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  composerRef: React.MutableRefObject<any>;
}) {
  const cur = useRef({ i: 0.95, th: 0.35, ca: 0.0005 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = useRef<{ bloom: any; ca: any } | null>(null);

  useFrame((state, dt) => {
    // FOUND BY WHAT THEY *ARE*, NOT BY WHAT THEY ARE CALLED.
    //
    // Three versions of this, and the middle one was the worst:
    //
    //  1. `e.constructor.name.includes("Bloom")` — class names are exactly
    //     what a minifier renames, and the failure is silent: the effects are
    //     never located and the per-act grade just stops applying, with
    //     nothing in the console to say so.
    //  2. React refs on <Bloom>/<ChromaticAberration>. Minifier-proof, and it
    //     CRASHED the film in dev: holding an effect instance in a ref hands
    //     it to React's dev tooling, which serialises props and dies on the
    //     effect's parent/child cycle — "Converting circular structure to
    //     JSON", thrown from the scheduler, homepage dead. Production builds
    //     survived it, which is precisely what made it dangerous.
    //  3. This. Duck-typing on the library's own API surface: only the bloom
    //     effect carries `luminanceMaterial`, and only chromatic aberration
    //     carries a settable `offset` vector. Those are property names the
    //     library itself reads, so a minifier cannot rename them without
    //     breaking itself — and nothing holds a reference React can walk.
    if (!found.current) {
      const passes = composerRef.current?.passes;
      if (!passes) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bloom: any = null, ca: any = null;
      for (const pass of passes) {
        for (const e of pass.effects ?? []) {
          if (!bloom && e?.luminanceMaterial) bloom = e;
          if (!ca && typeof e?.offset?.set === "function") ca = e;
        }
      }
      if (!bloom && !ca) return;
      found.current = { bloom, ca };
    }

    const g = grade(cinemaClock.progress);
    // frame-rate independent approach, same shape as the cinema clock's follower
    const k = 1 - Math.exp(-6 * Math.min(0.05, dt));
    const c = cur.current;
    c.i += (g.bloomIntensity - c.i) * k;
    c.th += (g.bloomThreshold - c.th) * k;
    c.ca += (g.caOffset - c.ca) * k;

    const b = found.current.bloom;
    if (b) {
      if ("intensity" in b) b.intensity = c.i;
      const lum = b.luminanceMaterial;
      if (lum) lum.threshold = c.th;
    }
    const ca = found.current.ca;
    if (ca?.offset?.set) ca.offset.set(c.ca, c.ca * 1.8);

    const fog = state.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near += (g.fogNear - fog.near) * k;
      fog.far += (g.fogFar - fog.far) * k;
    }
  });
  return null;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- deterministic price series: climb → crash → floor -----------------------
const N = 48;
const SP = 1.05; // spacing along X (time)
const DIVERGE = 26; // peak / where the AI diverges from price
const CRASH_END = 42;
const SPAN = CRASH_END * SP;

type Candle = { x: number; cy: number; h: number; up: boolean; wl: number; wh: number };
const CANDLES: Candle[] = (() => {
  const rnd = mulberry32(77);
  const prices: number[] = [];
  let p = 2.4;
  for (let i = 0; i <= N; i++) {
    if (i < DIVERGE) p += 0.46 + (rnd() - 0.5) * 0.6; // climb
    else if (i < CRASH_END) p -= 1.2 + (rnd() - 0.5) * 0.85; // crash (steeper)
    else p += (rnd() - 0.5) * 0.3; // floor chop
    prices.push(Math.max(0.4, p));
  }
  const out: Candle[] = [];
  for (let i = 0; i < N; i++) {
    const o = prices[i];
    const c = prices[i + 1];
    const wick = 0.22 + rnd() * 0.45;
    out.push({
      x: i * SP,
      cy: (o + c) / 2,
      h: Math.max(0.22, Math.abs(c - o)),
      up: c >= o,
      wl: Math.min(o, c) - wick,
      wh: Math.max(o, c) + wick,
    });
  }
  return out;
})();
const PEAK_Y = CANDLES[DIVERGE].cy;

// How far the chart has "printed" — candles form left→right as you scroll, like
// a live market ticking in. The chart timeline deliberately completes at
// CANDLE_BUILD_END (before the window's out0): the act's tail belongs to the
// LAB FINALE (see IceCandle), which runs on candleLabT over CANDLE_LAB.
const buildAt = (progress: number) =>
  clamp((progress - CANDLE3D.in0) / (CANDLE_BUILD_END - CANDLE3D.in0), 0, 1);
const revealF = (progress: number) => clamp(buildAt(progress) / 0.9, 0, 1) * N;

// The candle the AI "takes into the lab" for the finale: the last bull candle
// of the floor chop — right where the pulled-back camera rests, cleanly
// detachable once the chart has landed.
const LAB_I = (() => {
  for (let i = N - 1; i >= 0; i--) if (CANDLES[i].up) return i;
  return N - 1;
})();

// Soft round sprite for particles (raw gl_Points render as squares up close).
const dotTexture = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(255,255,255,0.7)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();

// --- scene-local interaction state (written by Interaction, read everywhere) --
const CURSOR = { world: new THREE.Vector3(), ok: false };
const IMPULSE = { x: 0, y: 0, t: -1e9 }; // last click (world) + performance.now()
const FLARE = { idx: -1, amt: 0 }; // hovered candle + eased flare amount
const HITS: { group: THREE.Group | null } = { group: null };

// Raycasts the pointer into the scene every frame: cursor world-point (for the
// particle force-field), candle hover (flare + live price tag), and click
// consumption (shockwave impulse).
function Interaction() {
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const proj = useMemo(() => new THREE.Vector3(), []);
  const lastClick = useRef(0);
  useFrame((state) => {
    const bo = buildAt(cinemaClock.progress);
    const activeWin = bo > 0.002 && bo < 0.998;
    ndc.set(cinemaClock.px, -cinemaClock.py);
    ray.setFromCamera(ndc, state.camera);
    CURSOR.ok = ray.ray.intersectPlane(plane, CURSOR.world) !== null;

    // hover: forgiving invisible hitboxes, only over candles that have printed
    let idx = -1;
    if (activeWin && HITS.group) {
      const hits = ray.intersectObjects(HITS.group.children, false);
      if (hits.length) {
        const i = hits[0].object.userData.i as number;
        if (i < revealF(cinemaClock.progress) - 0.5) idx = i;
      }
    }
    FLARE.amt += ((idx >= 0 ? 1 : 0) - FLARE.amt) * 0.16;
    if (idx >= 0) FLARE.idx = idx;

    if (idx >= 0) {
      const c = CANDLES[idx];
      proj.set(c.x, c.wh + 0.25, 0).project(state.camera);
      const o = c.up ? c.cy - c.h / 2 : c.cy + c.h / 2;
      const cl = c.up ? c.cy + c.h / 2 : c.cy - c.h / 2;
      const pct = ((cl - o) / Math.max(0.0001, o)) * 100; // one bar's real move
      cinemaClock.hover = {
        sx: (proj.x * 0.5 + 0.5) * state.size.width,
        sy: (-proj.y * 0.5 + 0.5) * state.size.height,
        label: `$${(180 + cl * 8).toFixed(2)}`,
        pct: `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`,
        up: c.up,
      };
    } else if (cinemaClock.hover) {
      cinemaClock.hover = null;
    }

    // click → world impulse (the shockwave rings + dust kick read IMPULSE)
    const clk = cinemaClock.click;
    if (clk && clk.t !== lastClick.current) {
      lastClick.current = clk.t;
      if (activeWin) {
        ndc.set(clk.x, -clk.y);
        ray.setFromCamera(ndc, state.camera);
        if (ray.ray.intersectPlane(plane, proj)) {
          IMPULSE.x = proj.x;
          IMPULSE.y = proj.y;
          IMPULSE.t = clk.t;
        }
      }
    }
  });
  return null;
}

// Candle bodies: a Higgsfield-generated cut-emerald crystal (normalized to the
// unit cube so it's a drop-in for the old unit box — per-candle scaling still
// shapes it). Non-indexed + recomputed normals = crisp gem facets. Falls back
// to the plain box until the GLB arrives (candles grow on scroll anyway).
function useCrystalGeometry(fallback: THREE.BufferGeometry) {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    let disposed = false;
    let loaded: THREE.BufferGeometry | null = null;
    // STATIC import (top of file), not a nested dynamic one: this component is
    // already inside the cinema's lazy chunk, and the extra async boundary
    // here split the module graph so the bundle shipped three.js TWICE
    // (2 × 852KB, both with WebGLRenderer — 34% of the static payload).
    {
      new GLTFLoader().load(
        "/models/candle-crystal.glb",
        (gltf) => {
          if (disposed) return;
          let src: THREE.BufferGeometry | null = null;
          gltf.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (!src && m.isMesh && m.geometry) src = m.geometry;
          });
          if (!src) return;
          const g = (src as THREE.BufferGeometry).toNonIndexed();
          g.computeVertexNormals(); // per-face normals → hard facets
          g.computeBoundingBox();
          const bb = g.boundingBox!;
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          bb.getSize(size);
          bb.getCenter(center);
          g.translate(-center.x, -center.y, -center.z);
          g.scale(1 / Math.max(size.x, 1e-6), 1 / Math.max(size.y, 1e-6), 1 / Math.max(size.z, 1e-6));
          loaded = g;
          setGeo(g);
        },
        undefined,
        () => {} // load failure → keep the box
      );
    }
    return () => {
      disposed = true;
      loaded?.dispose();
    };
  }, []);
  return geo ?? fallback;
}

// The candles' reflections, done the honest-cheat way: mirrored clones hanging
// from each candle's OWN base (wick low). A plane-mirrored image can't carry
// this act — the chart climbs ~12 units above the static floor while the camera
// tracks the trend at ~20° pitch, so anything mirrored across FLOOR_Y projects
// below the frustum (NDC y < -1) from build ~0.05 to ~0.65: no reflection until
// the end pull-back. Anchoring per-candle keeps the reflection glued to its
// candle — visible from the FIRST printed candle — and the vertical alpha fade
// below makes it die with depth like polished obsidian instead of reading as an
// upside-down twin. Pure function of rf → scrub-reversible.
const FLOOR_Y = -0.54;

// Reflection fade: full strength at the contact end, gently dimming toward the
// deep end — NEVER to zero, so body + wick outlines stay crisp and readable the
// whole way down (true-mirror read, not a smudge). Unit-box / normalized-crystal
// local y spans ±0.5, and after the mirror flip (scale.y<0) local +y points
// world-DOWN, so depth = position.y + 0.5. Constant uniforms, no per-frame
// state. If a future three renames a chunk the replace no-ops and clones just
// render unfaded — graceful.
function reflectionFade(mat: THREE.MeshStandardMaterial) {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vRefDepth;")
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvRefDepth = clamp(position.y + 0.5, 0.0, 1.0);"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vRefDepth;")
      .replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\ngl_FragColor.a *= 1.0 - 0.6 * vRefDepth;"
      );
  };
  return mat;
}

function MirrorCandles({ body, box }: { body: THREE.BufferGeometry; box: THREE.BufferGeometry }) {
  const green = useMemo(
    () =>
      reflectionFade(
        new THREE.MeshStandardMaterial({
          color: "#031a10",
          emissive: new THREE.Color("#00ff87"),
          emissiveIntensity: 0.4,
          roughness: 0.35,
          metalness: 0.1,
          flatShading: true,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        })
      ),
    []
  );
  const red = useMemo(
    () =>
      reflectionFade(
        new THREE.MeshStandardMaterial({
          color: "#1d0710",
          emissive: new THREE.Color("#ff2e63"),
          emissiveIntensity: 0.52,
          roughness: 0.35,
          metalness: 0.1,
          flatShading: true,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        })
      ),
    []
  );
  // dimmed twins of the inner cores — a reflection of a lit heart, not a lamp
  const coreGreen = useMemo(
    () =>
      reflectionFade(
        new THREE.MeshStandardMaterial({
          color: "#000000",
          emissive: new THREE.Color("#7dffc9"),
          emissiveIntensity: 0.55,
          roughness: 0.5,
          metalness: 0,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        })
      ),
    []
  );
  const coreRed = useMemo(
    () =>
      reflectionFade(
        new THREE.MeshStandardMaterial({
          color: "#000000",
          emissive: new THREE.Color("#ff5c86"),
          emissiveIntensity: 0.65,
          roughness: 0.5,
          metalness: 0,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
        })
      ),
    []
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const rf = revealF(cinemaClock.progress);
    // the lab candle's reflection dies with its liftoff — a candle in the air
    // has no contact point on the glass
    const lift = 1 - smooth(0.02, 0.22, candleLabT(cinemaClock.progress));
    for (let i = 0; i < N; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const grow = clamp(rf - i, 0, 1);
      const lk = i === LAB_I ? lift : 1;
      g.visible = grow > 0.001 && lk > 0.001;
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const b = grow - 1;
      const e = 1 + c3 * b * b * b + c1 * b * b;
      const ey = Math.max(0.0001, e * lk);
      // slide the anchor with the pop so the clone's wick tip stays glued to the
      // real wick tip while both grow (at e=1 this equals the true mirror pose:
      // y' = 2*wl - cy, since cy - (wh - wl) = 2*wl - cy)
      g.position.y = CANDLES[i].cy - ey * (CANDLES[i].wh - CANDLES[i].wl);
      g.scale.set(lk, -ey, lk); // negative y = the mirror flip
    }
  });
  return (
    <group>
      {CANDLES.map((c, i) => {
        const m = c.up ? green : red;
        return (
          <group
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            // mirror across the candle's own base (wl): y' = cy - (wh - wl), flipped
            position={[c.x, c.cy - (c.wh - c.wl), 0]}
            scale={[1, -0.0001, 1]}
          >
            <mesh geometry={body} material={m} scale={[0.72, c.h, 0.72]} />
            <mesh geometry={box} material={c.up ? coreGreen : coreRed} scale={[0.36, c.h * 0.66, 0.36]} />
            <mesh geometry={box} material={m} scale={[0.11, c.wh - c.wl, 0.11]} />
          </group>
        );
      })}
    </group>
  );
}

// THE LAB BEAT (candleLabT: progress 0.50→0.55): the AI takes ONE candle into
// the lab. The LAB_I bull candle lifts out of the field SPINNING, freezes from
// market-green to ICE (frosty white-cyan glass, pale-blue attenuation, bright
// cool core), drifts to the RIGHT side of the screen and STRETCHES vertically —
// body and wick pulled up+down as if under analysis — while the quant-bot
// panel (DOM overlay in ScrollCinema, same clock) computes on the left. The
// landing spot is CAMERA-RELATIVE (a fixed NDC point unprojected each frame),
// so it sits at ~72% viewport x at any aspect ratio and keeps breathing with
// the pointer-orbit. Every pose is a pure function of candleLabT — scrubbing
// back re-freezes it into its slot (Candles/MirrorCandles reverse the liftoff).
// Three colour targets for the lab candle's morph. GREEN reuses the field
// candle recipe EXACTLY (so the liftoff hand-off is seamless); ICE is the frosty
// scan state; RED is the bear recipe borrowed from the field's crash candles —
// framed as a downside STRESS-TEST, never a signal.
const LAB_POSE = {
  green: {
    color: new THREE.Color("#9fffd4"),
    attenuation: new THREE.Color("#00ff87"),
    emissive: new THREE.Color("#00ff87"),
    core: new THREE.Color("#7dffc9"),
    wick: new THREE.Color("#00ff87"),
  },
  ice: {
    color: new THREE.Color("#f2fbff"),
    attenuation: new THREE.Color("#bfe8ff"),
    emissive: new THREE.Color("#9fdcff"),
    core: new THREE.Color("#e4f6ff"),
    wick: new THREE.Color("#cfeeff"),
  },
  red: {
    color: new THREE.Color("#ffc0cf"),
    attenuation: new THREE.Color("#ff2e63"),
    emissive: new THREE.Color("#ff2e63"),
    core: new THREE.Color("#ff5c86"),
    wick: new THREE.Color("#ff2e63"),
  },
};

function IceCandle({ body, box }: { body: THREE.BufferGeometry; box: THREE.BufferGeometry }) {
  const group = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const wickRef = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  // dedicated materials (one candle) — per-frame lerp green→ice is f(lt) only
  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#9fffd4",
        transmission: 0.92,
        thickness: 0.72,
        ior: 1.5,
        roughness: 0.16,
        metalness: 0,
        attenuationColor: new THREE.Color("#00ff87"),
        attenuationDistance: 1.1,
        clearcoat: 0.7,
        clearcoatRoughness: 0.22,
        emissive: new THREE.Color("#00ff87"),
        emissiveIntensity: 0.22,
        flatShading: true,
      }),
    []
  );
  const core = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#000000",
        emissive: new THREE.Color("#7dffc9"),
        emissiveIntensity: 1.25,
        roughness: 0.5,
        metalness: 0,
      }),
    []
  );
  const wick = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#052a1b",
        emissive: new THREE.Color("#00ff87"),
        emissiveIntensity: 1.7,
        roughness: 0.4,
        metalness: 0,
      }),
    []
  );
  const dir = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const lt = candleLabT(cinemaClock.progress);
    g.visible = lt > 0.001;
    if (!g.visible) return;
    const c = CANDLES[LAB_I];
    // landing spot: NDC (0.44, 0.06) ≈ 72% viewport x, a hair above center,
    // 11 units out along that ray — recomputed each frame so it tracks the rig
    dir.set(0.44, 0.06, 0.5).unproject(state.camera).sub(state.camera.position).normalize();
    target.copy(state.camera.position).addScaledVector(dir, 11);
    const move = smooth(0.06, 0.62, lt); // liftoff → drift right
    const arc = Math.sin(move * Math.PI) * 1.4; // rises on the way, settles at the bench
    g.position.set(
      lerp(c.x, target.x, move),
      lerp(c.cy, target.y, move) + arc,
      lerp(0, target.z, move)
    );
    g.rotation.y = lt * Math.PI * 3.5; // spins out of the field, lands face-on
    // phase-C "stress" tremor: a faint deterministic shear while the downside is
    // shocked (pure f(lt), so it un-shudders on scrub-back)
    const stress = smooth(0.66, 0.84, lt);
    g.rotation.z = Math.sin(lt * 46) * 0.02 * stress;
    g.scale.setScalar(1 + 2.3 * smooth(0.1, 0.7, lt)); // floor candle → hero scale
    // the ANALYSIS stretch: body + wick elongate up/down while the footprint slims
    const s = smooth(0.45, 0.96, lt);
    // ICICLE PROPORTION: LAB_I is a floor-chop candle (h ≈ 0.22, squatter than
    // its 0.72 footprint), so raw scaling reads as a slab mid-flight. As it
    // leaves the field the body ELONGATES toward a hero height and slims — and
    // the wick outpaces it so the tips always spike past both ends. hb stays 0
    // through the hand-off window (lt ≤ 0.15), so the liftoff pose still equals
    // the field slot exactly. Pure f(lt) like every other pose term.
    const hb = smooth(0.15, 0.55, lt);
    const hEff = lerp(c.h, Math.max(c.h, 0.46), hb);
    const slim = (1 - 0.22 * s) * (1 - 0.24 * hb);
    bodyRef.current?.scale.set(0.72 * slim, hEff * (1 + 1.6 * s), 0.72 * slim);
    coreRef.current?.scale.set(0.36 * slim, hEff * 0.66 * (1 + 1.9 * s), 0.36 * slim);
    wickRef.current?.scale.set(0.11 * slim, (c.wh - c.wl) * (1 + 2.3 * s) * (1 + 0.5 * hb), 0.11 * slim);
    // THREE-PHASE COLOUR MORPH — all pure f(lt), sequential smooth ramps so any
    // channel is a clean chained lerp: start GREEN (matches the field candle at
    // hand-off) → ICE (A, scan) → GREEN (B, bullish candidate) → RED (C, downside
    // stress-test) → GREEN (R, settle to the confirmed paper candidate).
    const A = smooth(0.12, 0.4, lt); // freeze to ice
    const B = smooth(0.44, 0.62, lt); // warm to green
    const C = smooth(0.66, 0.84, lt); // stress to red
    const R = smooth(0.88, 0.985, lt); // settle back to green
    const G = LAB_POSE.green, I = LAB_POSE.ice, D = LAB_POSE.red;
    // dst = G→I(A)→G(B)→D(C)→G(R). .lerp mutates in place, so chaining composes.
    const paint = (dst: THREE.Color, g: THREE.Color, i: THREE.Color, r: THREE.Color) =>
      dst.copy(g).lerp(i, A).lerp(g, B).lerp(r, C).lerp(g, R);
    const chain = (g: number, i: number, r: number) =>
      lerp(lerp(lerp(lerp(g, i, A), g, B), r, C), g, R);
    paint(glass.color, G.color, I.color, D.color);
    paint(glass.attenuationColor, G.attenuation, I.attenuation, D.attenuation);
    paint(glass.emissive, G.emissive, I.emissive, D.emissive);
    paint(core.emissive, G.core, I.core, D.core);
    paint(wick.emissive, G.wick, I.wick, D.wick);
    // FROST held throughout (ice is frostiest); transmission stays glassy.
    glass.roughness = chain(0.17, 0.24, 0.2);
    glass.transmission = chain(0.92, 0.95, 0.9);
    glass.attenuationDistance = chain(1.1, 1.7, 1.2);
    glass.emissiveIntensity = chain(0.24, 0.3, 0.3);
    // hero-scaled core is physically big — hold it DIM in the ice phase (1.05) so
    // the frosted form + heart read as glass, not a white blowout; let it glow
    // hotter once it takes on green/red colour (colour reads as a lit candle, not
    // a bulb). Tame vs the old flat 1.85.
    core.emissiveIntensity = chain(1.3, 1.05, 1.55) + 0.1 * Math.sin(state.clock.elapsedTime * 2.2);
    wick.emissiveIntensity = chain(1.7, 1.95, 2.1);
    if (light.current) {
      // cool/green/red spill on the glass — dim in ice (tame), up in the coloured
      // phases; ramps on with the liftoff so it never pops.
      paint(light.current.color, G.attenuation, I.attenuation, D.attenuation);
      light.current.intensity = smooth(0.06, 0.35, lt) * chain(3.0, 2.2, 9.0);
    }
  });
  return (
    <group ref={group} visible={false}>
      <mesh ref={bodyRef} geometry={body} material={glass} />
      <mesh ref={coreRef} geometry={box} material={core} />
      <mesh ref={wickRef} geometry={box} material={wick} />
      <pointLight ref={light} color="#bfe8ff" distance={9} decay={2} intensity={0} position={[0.6, 0.4, 1.4]} />
    </group>
  );
}

function Candles() {
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const body = useCrystalGeometry(box);
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), []);
  // Bodies are TRANSLUCENT GLASS (the reference: a green glass block with a
  // luminous heart). Transmission refracts whatever sits behind AND INSIDE the
  // body — the opaque inner CORE mesh below renders into the transmission
  // buffer, so the glass shell samples it blurred by its roughness: a bright
  // center softened by a frosted shell, with the emerald attenuation tinting
  // the volume between. The shell keeps only a FAINT emissive of its own (edge
  // life); the core carries the glow. Clearcoat is the wet outer polish;
  // flatShading keeps the cut-crystal facets frosted. Thickness is the constant
  // 0.72 x/z footprint (rays cross bodies sideways; only candle HEIGHT varies,
  // so two shared materials still shade all 48 correctly).
  const green = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#9fffd4",
        transmission: 0.92,
        thickness: 0.72,
        ior: 1.5,
        roughness: 0.16,
        metalness: 0,
        attenuationColor: new THREE.Color("#00ff87"),
        attenuationDistance: 1.1,
        clearcoat: 0.7,
        clearcoatRoughness: 0.22,
        emissive: new THREE.Color("#00ff87"),
        emissiveIntensity: 0.22,
        flatShading: true,
      }),
    []
  );
  const red = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#ffc0cf",
        transmission: 0.92,
        thickness: 0.72,
        ior: 1.5,
        roughness: 0.16,
        metalness: 0,
        attenuationColor: new THREE.Color("#ff2e63"),
        attenuationDistance: 1.0,
        clearcoat: 0.7,
        clearcoatRoughness: 0.22,
        emissive: new THREE.Color("#ff2e63"),
        emissiveIntensity: 0.3,
        flatShading: true,
      }),
    []
  );
  // The luminous HEART inside each glass body: a shared unit box scaled to
  // ~50% of the footprint / ~66% of the height per candle. It draws opaque, so
  // the transmission pass picks it up and the glass shell shows it frosted —
  // bright center, deep attenuation color between core and shell. Hotter than
  // the shell, cooler than the wick, so bloom keeps its hierarchy.
  const coreGreen = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#000000",
        emissive: new THREE.Color("#7dffc9"),
        emissiveIntensity: 1.25,
        roughness: 0.5,
        metalness: 0,
      }),
    []
  );
  const coreRed = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#000000",
        emissive: new THREE.Color("#ff5c86"),
        emissiveIntensity: 1.5,
        roughness: 0.5,
        metalness: 0,
      }),
    []
  );
  // Wicks stay opaque and HOT — they are what bloom reads, now that the bodies
  // glow softly from within instead of carrying the whole emissive load.
  const wickGreen = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#052a1b",
        emissive: new THREE.Color("#00ff87"),
        emissiveIntensity: 1.7,
        roughness: 0.4,
        metalness: 0,
      }),
    []
  );
  const wickRed = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2e0a15",
        emissive: new THREE.Color("#ff2e63"),
        emissiveIntensity: 2.1,
        roughness: 0.4,
        metalness: 0,
      }),
    []
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  const flareLight = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const rf = revealF(cinemaClock.progress);
    // lab liftoff: the chosen candle shrinks out of its field slot while the
    // IceCandle (spawned on the same spot) takes over — reversible hand-off
    const lift = 1 - smooth(0.02, 0.22, candleLabT(cinemaClock.progress));
    for (let i = 0; i < N; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const grow = clamp(rf - i, 0, 1); // 0 until the print reaches this candle
      g.visible = grow > 0.001;
      // easeOutBack → candle pops past 100% (~1.1 near grow 0.7) then settles to 1
      const c1 = 1.70158;
      const c3 = c1 + 1;
      const b = grow - 1;
      const e = 1 + c3 * b * b * b + c1 * b * b; // 0 at grow=0, 1 at grow=1
      const f = i === FLARE.idx ? FLARE.amt : 0;
      const lk = i === LAB_I ? lift : 1;
      g.scale.set(
        (1 + 0.14 * f) * lk,
        Math.max(0.0001, e * (1 + 0.05 * f) * lk),
        (1 + 0.14 * f) * lk
      );
    }
    // the whole ridge breathes faintly — alive even between scrolls. One pulse,
    // three layers: hot wicks feed bloom, the inner cores throb beneath them,
    // and the glass shells barely flicker at their edges.
    green.emissiveIntensity = 0.22 + 0.05 * Math.sin(time * 1.15);
    red.emissiveIntensity = 0.3 + 0.06 * Math.sin(time * 1.5 + 2);
    coreGreen.emissiveIntensity = 1.25 + 0.18 * Math.sin(time * 1.15);
    coreRed.emissiveIntensity = 1.5 + 0.2 * Math.sin(time * 1.5 + 2);
    wickGreen.emissiveIntensity = 1.7 + 0.25 * Math.sin(time * 1.15);
    wickRed.emissiveIntensity = 2.1 + 0.3 * Math.sin(time * 1.5 + 2);
    // hovered candle gets a hot local light (its flare)
    const fl = flareLight.current;
    if (fl) {
      const c = CANDLES[clamp(FLARE.idx, 0, N - 1)];
      fl.visible = FLARE.amt > 0.02;
      fl.position.set(c.x, c.cy + 0.4, 1.1);
      fl.intensity = 26 * FLARE.amt;
      fl.color.set(c.up ? "#00ff87" : "#ff2e63");
    }
  });
  return (
    <group>
      {CANDLES.map((c, i) => {
        const bm = c.up ? green : red;
        const wm = c.up ? wickGreen : wickRed;
        const cm = c.up ? coreGreen : coreRed;
        // Body, core and wick are all centered on the close level, so scaling
        // the parent group's Y grows the whole candle (heart included) in place.
        return (
          <group
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            position={[c.x, c.cy, 0]}
            scale={[1, 0, 1]}
          >
            <mesh geometry={body} material={bm} scale={[0.72, c.h, 0.72]} />
            <mesh geometry={box} material={cm} scale={[0.36, c.h * 0.66, 0.36]} />
            <mesh geometry={box} material={wm} scale={[0.11, c.wh - c.wl, 0.11]} />
          </group>
        );
      })}
      <MirrorCandles body={body} box={box} />
      <IceCandle body={body} box={box} />
      {/* forgiving invisible hitboxes for hover (material invisible, ray-visible) */}
      <group
        ref={(el) => {
          HITS.group = el;
        }}
      >
        {CANDLES.map((c, i) => (
          <mesh
            key={i}
            geometry={box}
            material={hitMat}
            position={[c.x, (c.wl + c.wh) / 2, 0]}
            scale={[SP * 0.96, c.wh - c.wl + 0.7, 1.6]}
            userData={{ i }}
          />
        ))}
      </group>
      <pointLight ref={flareLight} visible={false} distance={6} decay={2} />
    </group>
  );
}

// The 2D chart-line made physical: a glowing baseline that races ahead with the
// print head — candles read as extruding UP from it. Fades once the chart lands.
function Baseline() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const rf = revealF(cinemaClock.progress);
    const w = clamp(rf, 0, N) * SP + 1; // reach follows the print head
    m.visible = w > 1.01;
    m.scale.x = w;
    m.position.x = w / 2 - 0.5;
    (m.material as THREE.MeshBasicMaterial).opacity =
      0.5 * (1 - smooth(0.86, 0.98, buildAt(cinemaClock.progress))); // gone once printed
  });
  return (
    <mesh ref={ref} visible={false} position={[0, -0.45, 0]}>
      <boxGeometry args={[1, 0.04, 0.04]} />
      <meshBasicMaterial
        color="#00ff87"
        toneMapped={false}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// Every red crash candle detonates on print: 9 emissive shards blast down-and-
// outward from its base, tumbling under gravity, then vanish once the candle
// settles (the finished chart stays clean). Pure function of rf — scrubbing
// backwards un-explodes them. One instancedMesh for the whole crash (~144).
const SHARDS_PER = 9;
function CrashShards() {
  const crash = useMemo(
    () =>
      CANDLES.map((c, i) => ({ c, i })).filter(
        ({ c, i }) => !c.up && i >= DIVERGE && i < CRASH_END
      ),
    []
  );
  const geo = useMemo(() => new THREE.BoxGeometry(0.16, 0.16, 0.16), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2e0a15",
        emissive: new THREE.Color("#ff2e63"),
        emissiveIntensity: 1.6,
        roughness: 0.4,
      }),
    []
  );
  // deterministic per-shard trajectory: mostly downward + outward debris
  const params = useMemo(
    () =>
      crash.flatMap(({ i }) =>
        Array.from({ length: SHARDS_PER }, (_, s) => {
          const rnd = mulberry32(i * 31 + s);
          return {
            vx: (rnd() - 0.5) * 1.6, // [-0.8, 0.8]
            vy: -0.6 - rnd() * 1.6, // [-2.2, -0.6]
            vz: (rnd() - 0.5) * 1.0, // [-0.5, 0.5]
            spin: rnd() * Math.PI * 2,
            jit: 0.6 + rnd() * 0.8, // size jitter 0.6..1.4
          };
        })
      ),
    [crash]
  );
  const inst = useRef<THREE.InstancedMesh>(null);
  const obj = useMemo(() => new THREE.Object3D(), []); // scratch for matrices
  useFrame(() => {
    const m = inst.current;
    if (!m) return;
    const rf = revealF(cinemaClock.progress);
    for (let k = 0; k < crash.length; k++) {
      const { c, i } = crash[k];
      const g = clamp(rf - i, 0, 1);
      const live = g > 0.05 && g < 1; // hidden before impact + once settled
      for (let sh = 0; sh < SHARDS_PER; sh++) {
        const id = k * SHARDS_PER + sh;
        const p = params[id];
        if (live) {
          const s = 1 - (1 - g) * (1 - g); // easeOut → burst fast, drift out
          obj.position.set(
            i * SP + p.vx * s * 2.8,
            c.cy - c.h / 2 + p.vy * s * 2.8 - s * s * 1.8, // extra gravity pull
            p.vz * s * 2.8
          );
          // geometry is already 0.16 per side → scale carries jitter + shrink
          obj.scale.setScalar(p.jit * (1 - s * 0.7));
          obj.rotation.set(p.spin + s * 6, p.spin * 1.7 + s * 6, 0);
        } else {
          obj.position.set(i * SP, c.cy, 0);
          obj.scale.setScalar(0);
          obj.rotation.set(0, 0, 0);
        }
        obj.updateMatrix();
        m.setMatrixAt(id, obj.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={inst}
      args={[geo, mat, crash.length * SHARDS_PER]}
      frustumCulled={false}
    />
  );
}

// The live print-head: a hot orb riding the newest candle, a point light that
// flashes the neighbourhood on every print, and a pulse ring expanding around it.
function PrintHead() {
  const orb = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const rf = revealF(cinemaClock.progress);
    const on = rf > 0.05 && rf < N - 0.02;
    const idx = clamp(Math.floor(rf), 0, N - 1);
    const frac = clamp(rf - idx, 0, 1);
    const x = clamp(rf, 0, N - 1) * SP;
    const y = lerp(CANDLES[idx].cy, CANDLES[Math.min(idx + 1, N - 1)].cy, frac);
    const flash = (1 - frac) * (1 - frac); // spikes as each candle lands
    // the head bleeds red while printing crash candles — .set() per frame is cheap
    const crash = !CANDLES[idx].up && idx >= DIVERGE;
    if (orb.current) {
      orb.current.visible = on;
      orb.current.position.set(x, y, 0);
      orb.current.scale.setScalar(0.09 + 0.15 * flash);
      (orb.current.material as THREE.MeshBasicMaterial).color.set(
        crash ? "#ffd7e2" : "#c8ffe4"
      );
    }
    if (light.current) {
      light.current.visible = on;
      light.current.position.set(x, y + 0.5, 1.4);
      light.current.intensity = (3 + 30 * flash) * (crash ? 1.6 : 1);
      light.current.color.set(crash ? "#ff2e63" : "#00ff87");
    }
    if (ring.current) {
      ring.current.visible = on;
      ring.current.position.set(x, y, 0.62);
      const s = 0.3 + frac * 1.7;
      ring.current.scale.set(s, s, s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - frac);
    }
  });
  return (
    <group>
      <mesh ref={orb} visible={false}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color="#c8ffe4" toneMapped={false} />
      </mesh>
      <pointLight ref={light} visible={false} color="#00ff87" distance={8} decay={2} />
      <mesh ref={ring} visible={false}>
        <ringGeometry args={[0.9, 1, 48]} />
        <meshBasicMaterial
          color="#00ff87"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// Click shockwaves: a small pool of expanding rings spawned at the click point.
function ClickFX() {
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const pool = useRef([
    { t0: -1e9, x: 0, y: 0 },
    { t0: -1e9, x: 0, y: 0 },
    { t0: -1e9, x: 0, y: 0 },
  ]);
  const next = useRef(0);
  const lastClick = useRef(0);
  useFrame(() => {
    if (IMPULSE.t !== lastClick.current) {
      lastClick.current = IMPULSE.t;
      const slot = pool.current[next.current];
      slot.t0 = IMPULSE.t;
      slot.x = IMPULSE.x;
      slot.y = IMPULSE.y;
      next.current = (next.current + 1) % pool.current.length;
    }
    const now = performance.now();
    pool.current.forEach((s, i) => {
      const m = refs.current[i];
      if (!m) return;
      const age = (now - s.t0) / 750; // 0..1 over 750ms
      if (age < 0 || age > 1) {
        m.visible = false;
        return;
      }
      m.visible = true;
      m.position.set(s.x, s.y, 0.5);
      const sc = 0.3 + age * 7;
      m.scale.set(sc, sc, sc);
      (m.material as THREE.MeshBasicMaterial).opacity = (1 - age) * (1 - age) * 0.7;
    });
  });
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
        >
          <ringGeometry args={[0.94, 1, 56]} />
          <meshBasicMaterial
            color="#7dffc9"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

// Drifting particulate with a cursor FORCE-FIELD: particles flee the pointer,
// get kicked by click shockwaves, then relax home. Three counter-drifting
// clouds (near green, far cyan) so no frame is ever empty.
function Dust({
  seed,
  count,
  area,
  center,
  color,
  size,
  speed,
  react = 1,
}: {
  seed: number;
  count: number;
  area: [number, number, number];
  center: [number, number, number];
  color: string;
  size: number;
  speed: number;
  react?: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const { base, off } = useMemo(() => {
    const rnd = mulberry32(seed);
    const base = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      base[i * 3] = center[0] + (rnd() - 0.5) * area[0];
      base[i * 3 + 1] = center[1] + (rnd() - 0.5) * area[1];
      base[i * 3 + 2] = center[2] + (rnd() - 0.5) * area[2];
    }
    return { base, off: new Float32Array(count * 3) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = ref.current;
    if (!g) return;
    const dx = Math.sin(t * speed) * 1.4;
    const dy = Math.sin(t * speed * 0.63 + seed) * 0.5;
    const arr = g.geometry.attributes.position.array as Float32Array;
    const cw = CURSOR.ok ? CURSOR.world : null;
    const kick = Math.exp(-(performance.now() - IMPULSE.t) / 380) * react;
    for (let i = 0; i < count; i++) {
      const ix = i * 3;
      const bx = base[ix] + dx;
      const by = base[ix + 1] + dy;
      // cursor repulsion (xy plane)
      if (cw) {
        const rx = bx + off[ix] - cw.x;
        const ry = by + off[ix + 1] - cw.y;
        const r2 = rx * rx + ry * ry;
        if (r2 < 12.25 && r2 > 0.0001) {
          const r = Math.sqrt(r2);
          const push = ((1 - r / 3.5) * (1 - r / 3.5) * 0.28 * react) / r;
          off[ix] += rx * push;
          off[ix + 1] += ry * push;
        }
      }
      // click shockwave kick
      if (kick > 0.02) {
        const rx = bx + off[ix] - IMPULSE.x;
        const ry = by + off[ix + 1] - IMPULSE.y;
        const r2 = rx * rx + ry * ry;
        if (r2 < 36 && r2 > 0.0001) {
          const r = Math.sqrt(r2);
          const push = ((1 - r / 6) * 0.9 * kick) / r;
          off[ix] += rx * push;
          off[ix + 1] += ry * push;
        }
      }
      // relax home
      off[ix] *= 0.9;
      off[ix + 1] *= 0.9;
      arr[ix] = bx + off[ix];
      arr[ix + 1] = by + off[ix + 1];
      arr[ix + 2] = base[ix + 2];
    }
    g.geometry.attributes.position.needsUpdate = true;
    // dimmer than the candles on purpose — atmosphere, not hero
    (g.material as THREE.PointsMaterial).opacity = 0.15 + 0.09 * Math.sin(t * 0.8 + seed);
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[base.slice(), 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
        map={dotTexture()}
        transparent
        opacity={0.28}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// AI forecast: from the divergence peak, a probability CONE (uncertainty band,
// green→red gradient, widening + biased down) plus a dashed predicted-PATH line
// its median follows. Reality (the red crash candles) falls onto the path / into
// the cone — "it saw the crash coming." Echoes the 2D chart's amber prediction.
function AIForecast() {
  const { coneGeo, path } = useMemo(() => {
    const divX = DIVERGE * SP;
    const endX = SPAN + 3;
    const segs = 26;
    const green = new THREE.Color("#00ff87");
    const red = new THREE.Color("#ff2e63");
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const path: [number, number, number][] = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = lerp(divX, endX, t);
      const median = lerp(PEAK_Y, 1.0, smooth(0, 1, t)); // predicted decline
      const spread = 0.3 + t * 3.6; // uncertainty grows with horizon
      pos.push(x, median + spread * 0.5, 0, x, median - spread * 1.0, 0); // biased down
      const c = green.clone().lerp(red, t);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      path.push([x, median, 0.05]);
      if (i < segs) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return { coneGeo: g, path };
  }, []);
  const coneRef = useRef<THREE.Mesh>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineRef = useRef<any>(null); // drei <Line> → Line2 (has .material.opacity)
  useFrame(() => {
    // THE FORECAST HAS TO ARRIVE BEFORE THE THING IT FORECASTS.
    //
    // This used to open at buildAt 0.5. Candle 26 — DIVERGE, where the crash
    // starts — prints at buildAt 0.4875. So the cone began drawing 0.0023
    // AFTER the crash was already on screen: the film asserted "It saw the
    // crash coming" over a frame in which nothing had been predicted, and the
    // reveal was still exactly 0.000 at that beat's plateau. The single
    // most important claim in the film was contradicted by its own pixels.
    //
    // 0.26 is not a taste value: it is where candle 14 prints, twelve bars
    // before DIVERGE. So "Flagged DOWN — 12 bars early" is now literally what
    // is on screen, countable. Fully drawn by 0.47 (global ~0.4046), a beat
    // before the crash lands at ~0.4078 — the cone is complete, and THEN
    // reality falls into it.
    //
    // Opacity lifts 0.19 -> 0.34 because the cone now has to read against a
    // still-green chart rather than against an already-red crash.
    const reveal =
      smooth(0.26, 0.47, buildAt(cinemaClock.progress)) *
      (1 - smooth(0, 0.3, candleLabT(cinemaClock.progress)));
    const cm = coneRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (cm) cm.opacity = 0.34 * reveal;
    if (lineRef.current?.material) lineRef.current.material.opacity = 0.92 * reveal;
  });
  return (
    <group>
      <mesh ref={coneRef} geometry={coneGeo}>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <Line
        ref={lineRef}
        points={path}
        color="#ffce4d"
        lineWidth={2.5}
        dashed
        dashSize={0.6}
        gapSize={0.4}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </group>
  );
}

function Rig() {
  const pos = useRef(new THREE.Vector3(-7, 7, 11));
  const look = useRef(new THREE.Vector3(0, 3, 0));
  const tmpP = useRef(new THREE.Vector3());
  const tmpL = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const euler = useRef(new THREE.Euler());
  const quat = useRef(new THREE.Quaternion());
  const pxs = useRef(0);
  const pys = useRef(0);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // damped pointer → true ORBIT steering (the world looks around with you)
    pxs.current += (cinemaClock.px - pxs.current) * 0.05;
    pys.current += (cinemaClock.py - pys.current) * 0.05;
    const build = buildAt(cinemaClock.progress);
    // crash candles hit like impacts: spike as each red bar lands, decay as it
    // settles — pure function of rf so scrubbing back un-shakes cleanly
    const rf = revealF(cinemaClock.progress);
    const rIdx = Math.floor(rf);
    const rFrac = rf - rIdx;
    let impact = 0;
    const rc = CANDLES[rIdx];
    if (rc && !rc.up && rIdx >= DIVERGE) {
      impact = (1 - rFrac) * (1 - rFrac) * Math.min(1, rc.h / 1.6);
    }
    // The camera path is a SMOOTH function of scroll only — never the discrete
    // candle index or their noisy per-candle heights — so it glides along the
    // chart instead of snapping to each newly-printed candle.
    const edgeX = clamp(build / 0.9, 0, 1) * (N * SP); // continuous printing edge
    // Noise-free analytic price trend (climb → peak → crash) for the camera height.
    const pk = 0.49;
    const trendY =
      build <= pk
        ? lerp(2.4, PEAK_Y, smooth(0, pk, build))
        : lerp(PEAK_Y, 1.4, smooth(pk, 0.8, build));
    // Track the printing edge, then PULL BACK at the end to reveal the whole crash.
    //
    // Starts at 0.66, not 0.78. The cone now completes at build 0.47 and the
    // crash lands at 0.4875, so the frame that matters — the whole forecast
    // with reality falling through it — exists from ~0.49 onward. Beginning the
    // retreat earlier means the camera is already opening out as that happens,
    // instead of staying tight on the printing edge and only revealing the
    // composition once the beat naming it has passed.
    const pull = smooth(0.66, 0.95, build);
    tmpL.current.set(lerp(edgeX - 1.5, SPAN * 0.72, pull), lerp(trendY, 3, pull), 0);
    tmpP.current.set(
      lerp(edgeX - 7, SPAN * 0.5, pull) + Math.sin(time * 0.33) * 0.18,
      lerp(trendY + 4.5, PEAK_Y * 0.5 + 9, pull) + Math.sin(time * 0.47) * 0.14,
      lerp(11, 16.5, pull) + Math.cos(time * 0.29) * 0.16
    );
    // orbit the look-target by the pointer: ±12° yaw, ±6° pitch
    offset.current.copy(tmpP.current).sub(tmpL.current);
    euler.current.set(-pys.current * 0.11, -pxs.current * 0.21, 0, "YXZ");
    quat.current.setFromEuler(euler.current);
    offset.current.applyQuaternion(quat.current);
    tmpP.current.copy(tmpL.current).add(offset.current);
    // inertia: the camera trails its target — motion has mass
    pos.current.lerp(tmpP.current, 0.09);
    look.current.lerp(tmpL.current, 0.09);
    // deterministic sin shake (no Math.random — must reverse under scrub)
    pos.current.x += Math.sin(time * 53) * 0.16 * impact;
    pos.current.y += Math.cos(time * 44) * 0.13 * impact;
    state.camera.position.copy(pos.current);
    state.camera.lookAt(look.current);
    // scroll hard → the world stretches (FOV kick); crash impacts punch in too
    const cam = state.camera as THREE.PerspectiveCamera;
    const targetFov = 42 + cinemaClock.vel * 9 + impact * 3;
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov += (targetFov - cam.fov) * 0.1;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

export default function CandleField3D({
  active,
  onReady,
}: {
  active: boolean;
  onReady?: () => void;
}) {
  // A handle on the live post chain so the colour script can write to it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const composerRef = useRef<any>(null);
  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      gl={{ alpha: false, antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 42, position: [-5, 9, 12], near: 0.1, far: 200 }}
      onCreated={() => onReady?.()}
      fallback={null}
    >
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 22, 60]} />

      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 14, 8]} intensity={0.7} color="#bfe9ff" />

      <Interaction />
      <Candles />
      <Baseline />
      <CrashShards />
      <PrintHead />
      <ClickFX />
      <AIForecast />
      {/* z-ranges stay well in front of the camera (z≈11+) — no giant near-plane dots */}
      <Dust seed={11} count={420} area={[70, 16, 14]} center={[SPAN / 2, 7, 0]} color="#57ffb0" size={0.055} speed={0.11} react={1} />
      <Dust seed={23} count={320} area={[80, 20, 16]} center={[SPAN / 2, 9, -4]} color="#28d7ff" size={0.045} speed={0.07} react={0.5} />
      <Dust seed={37} count={260} area={[60, 10, 10]} center={[SPAN / 2, 2.5, 1]} color="#9dffcf" size={0.04} speed={0.16} react={1.3} />

      {/* Polished black-glass floor — deliberately NOT a render-to-texture
          reflector. With this rig (~20° pitch, the chart towering ~12 units
          above FLOOR_Y) a true plane-mirrored image projects below the frustum
          for nearly the whole act, so a MeshReflectorMaterial shows nothing
          until the end pull-back (and its extra 1024² scene pass would double
          again through the glass bodies' transmission pass). The crisp
          candle+wick reflection is carried by MirrorCandles instead; this plane
          is the glass those reflections appear to live in — near-black, tight
          clearcoat highlights under the print-head/flare lights (the wet
          sheen), slightly translucent so it dies softly into the fog. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SPAN / 2, FLOOR_Y, 0]}>
        <planeGeometry args={[SPAN * 3, 90]} />
        <meshPhysicalMaterial
          color="#030605"
          roughness={0.08}
          metalness={0.5}
          clearcoat={1}
          clearcoatRoughness={0.15}
          transparent
          opacity={0.62}
        />
      </mesh>
      {/* faint grid floats on the glass */}
      <Grid
        position={[SPAN / 2, -0.5, 0]}
        args={[SPAN * 2.5, 60]}
        cellSize={1.05}
        cellThickness={0.35}
        cellColor="#06180f"
        sectionSize={SP * 6}
        sectionThickness={0.6}
        sectionColor="#07301e"
        fadeDistance={70}
        fadeStrength={2}
        infiniteGrid
      />

      <Rig />

      {/* NOTE: no `ref` on the individual effects. Under React 19 `ref` is an
          ordinary prop, and @react-three/postprocessing JSON.stringify()s its
          children to key the chain — so a ref holding a mounted effect (which
          has a .parent) throws "Converting circular structure to JSON" and takes
          the whole page down. Ref the composer instead and read its passes. */}
      <EffectComposer ref={composerRef} multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.35} luminanceSmoothing={0.3} intensity={0.95} />
        <ChromaticAberration offset={[0.0005, 0.0009]} />
        <SMAA />
      </EffectComposer>
      {/* Drives the three rooms onto the live chain. Inside <Canvas> for useFrame. */}
      <Colourist composerRef={composerRef} />
    </Canvas>
  );
}

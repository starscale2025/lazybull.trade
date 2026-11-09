"use client";

// The candle act (progress ~0.32–0.58) as a live chart of glass: each candle a
// cut crystal bar with light traced through it (glass-candle.ts), standing in
// a dark studio with air behind it and black glass under it. Candles print in
// as you scroll; hovering one surfaces its price; the camera orbits with your
// pointer (with inertia). All state flows
// through cinemaClock (one-clock rule). Crossfaded over the 2D scene by
// ScrollCinema.

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, DepthOfField, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { cinemaClock, damp } from "@/lib/cinema-clock";
import { grade } from "@/lib/cinema";
import { CANDLES, CANDLE_CAM_START, CRASH_END, FIRST_RED_I, N, PEAK_Y, SP, SPAN, buildAt, floorReachF, floorY, revealF } from "@/lib/candle-series";
import { getHeroPosition, onHeroPosition } from "@/lib/hero-position";
import { START_STRIKES, figures, money } from "@/lib/hero-spread";
import {
  AIR_FRAG,
  AIR_VERT,
  CUT_CROWN,
  CUT_H0,
  FLOOR_FRAG,
  FLOOR_VERT,
  GLASS_VERT,
  MIRROR_FRAG,
  MIRROR_VERT,
  SHARD_FRAG,
  SHARD_VERT,
  WICK_FRAG,
  WICK_VERT,
  airNoise,
  crystalCut,
  glassFrag,
} from "./glass-candle";
import { watchContext } from "./gl-context";
import { Grade } from "./Grade";
import { FilmDriver } from "./FilmDriver";
import { FILM_DPR_MAX, FilmDpr } from "./FilmDpr";

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Lerps the act's grade (lib/cinema.ts) onto the live bloom and fog, and keeps
 * the lens focused on the printing edge. Effects are found by what they carry
 * (only bloom has `luminanceMaterial`, only depth of field `cocMaterial`):
 * names a minifier cannot rename, and no React ref on the effect, which crashes
 * the page (see the note on the composer below).
 */
function Colourist({
  composerRef,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  composerRef: React.MutableRefObject<any>;
}) {
  const cur = useRef({ i: 0.32, th: 1.05, focus: 12 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const found = useRef<{ bloom: any; dof: any } | null>(null);
  const head = useMemo(() => new THREE.Vector3(), []);

  useFrame((state, dt) => {
    if (!found.current) {
      const passes = composerRef.current?.passes;
      if (!passes) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bloom: any = null, dof: any = null;
      for (const pass of passes) {
        for (const e of pass.effects ?? []) {
          if (!bloom && e?.luminanceMaterial) bloom = e;
          if (!dof && e?.cocMaterial) dof = e;
        }
      }
      if (!bloom) return;
      found.current = { bloom, dof };
    }

    const g = grade(cinemaClock.progress);
    const k = 1 - Math.exp(-6 * Math.min(0.05, dt));
    const c = cur.current;
    c.i += (g.bloomIntensity - c.i) * k;
    c.th += (g.bloomThreshold - c.th) * k;

    const b = found.current.bloom;
    if ("intensity" in b) b.intensity = c.i;
    const lum = b.luminanceMaterial;
    if (lum) lum.threshold = c.th;

    const dof = found.current.dof;
    if (dof) {
      const rf = revealF(cinemaClock.progress);
      const idx = clamp(Math.floor(rf), 0, N - 1);
      head.set(clamp(rf, 0, N - 1) * SP, CANDLES[idx].cy, 0);
      const pull = smooth(0.46, 0.5, cinemaClock.progress);
      c.focus += (state.camera.position.distanceTo(head) - c.focus) * k;
      dof.cocMaterial.focusDistance = c.focus;
      dof.cocMaterial.focusRange = lerp(9, 44, pull);
    }

    const fog = state.scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near += (g.fogNear - fog.near) * k;
      fog.far += (g.fogFar - fog.far) * k;
      GLASS.uFog.value.set(fog.near, fog.far);
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

// The deterministic price series (climb → crash → floor chop) and the print
// head that reveals it live in lib/candle-series.ts, so the sound, the rail
// and the tests key to the same candles this scene prints (Gate A4 #3).


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

const FLOOR_Y = -0.54;

const STAGE = {
  uHead: { value: new THREE.Vector3() },
  uTint: { value: new THREE.Color(0.1, 1, 0.6) },
  uTime: { value: 0 },
  uOn: { value: 1 },
  mix: 0,
};

/** What every glass surface needs to know each frame, shared by the bars and their wicks. */
const GLASS = {
  uReveal: { value: 0 },
  uSweep: { value: 0 },
  uFlareIdx: { value: -1 },
  uFlare: { value: 0 },
  uHeat: { value: 0 },
  uFog: { value: new THREE.Vector2(22, 60) },
  uLightPos: { value: new THREE.Vector3() },
  uLightCol: { value: new THREE.Color("#52ffa5") },
};

/** The stage: the air behind the chart and the black glass under it. */
function Stage() {
  const { airMat, floorMat, quad } = useMemo(() => {
    const airMat = new THREE.ShaderMaterial({
      vertexShader: AIR_VERT,
      fragmentShader: AIR_FRAG,
      depthWrite: false,
      depthTest: false,
      uniforms: { uInvView: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() }, uHead: STAGE.uHead, uTint: STAGE.uTint, uTime: STAGE.uTime, uOn: STAGE.uOn, uNoise: { value: airNoise() } },
    });
    const floorMat = new THREE.ShaderMaterial({
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uHead: STAGE.uHead, uTint: STAGE.uTint, uFog: GLASS.uFog },
    });
    return { airMat, floorMat, quad: new THREE.PlaneGeometry(2, 2) };
  }, []);
  useFrame((state) => {
    (airMat.uniforms.uInvView.value as THREE.Matrix4).copy(state.camera.matrixWorld);
    (airMat.uniforms.uInvProj.value as THREE.Matrix4).copy(state.camera.projectionMatrixInverse);
    STAGE.uTime.value = cinemaClock.time;
    const crashing = revealF(cinemaClock.progress) > FIRST_RED_I ? 1 : 0;
    STAGE.mix += (crashing - STAGE.mix) * damp(0.05, cinemaClock.dt);
    STAGE.uTint.value.setRGB(0.1 + 0.9 * STAGE.mix, 1 - 0.84 * STAGE.mix, 0.6 - 0.26 * STAGE.mix);
    STAGE.uHead.value.copy(GLASS.uLightPos.value);
    STAGE.uOn.value = 1 - smooth(0.455, 0.495, cinemaClock.progress);
  });
  return (
    <>
      <mesh geometry={quad} material={airMat} frustumCulled={false} renderOrder={-10} />
      <mesh rotation-x={-Math.PI / 2} position={[SPAN / 2, FLOOR_Y, 0]} material={floorMat} renderOrder={-1}>
        <planeGeometry args={[SPAN * 5, 180]} />
      </mesh>
    </>
  );
}

function Candles() {
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), []);
  const { bars, wicks, barMat, wickMat, mirrorMat } = useMemo(() => {
    const cut = crystalCut();
    const center = new Float32Array(N * 3);
    const halfY = new Float32Array(N);
    const up = new Float32Array(N);
    const index = new Float32Array(N);
    const wCenter = new Float32Array(N * 3);
    const wHalf = new Float32Array(N);
    CANDLES.forEach((c, i) => {
      center.set([c.x, c.cy, 0], i * 3);
      halfY[i] = Math.max(c.h / 2, CUT_CROWN * 1.6);
      up[i] = c.up ? 1 : 0;
      index[i] = i;
      wCenter.set([c.x, (c.wl + c.wh) / 2, 0], i * 3);
      wHalf[i] = (c.wh - c.wl) / 2;
    });
    const instanced = (base: THREE.BufferGeometry, cen: Float32Array, half: Float32Array) => {
      const g = new THREE.InstancedBufferGeometry();
      g.index = base.index;
      g.setAttribute("position", base.attributes.position);
      g.setAttribute("normal", base.attributes.normal);
      g.setAttribute("aCenter", new THREE.InstancedBufferAttribute(cen, 3));
      g.setAttribute("aHalfY", new THREE.InstancedBufferAttribute(half, 1));
      g.setAttribute("aUp", new THREE.InstancedBufferAttribute(up, 1));
      g.setAttribute("aIndex", new THREE.InstancedBufferAttribute(index, 1));
      g.instanceCount = N;
      return g;
    };
    const bars = instanced(cut.geometry, center, halfY);
    const wickBase = new THREE.CylinderGeometry(0.0125, 0.0125, 1, 10, 1, true);
    const wicks = instanced(wickBase, wCenter, wHalf);
    const barMat = new THREE.ShaderMaterial({
      vertexShader: GLASS_VERT,
      fragmentShader: glassFrag(cut.count),
      uniforms: {
        ...GLASS,
        uN: { value: cut.normals },
        uD: { value: cut.offsets },
        uLift: { value: cut.lifts },
        uH0: { value: CUT_H0 },
        uCrown: { value: CUT_CROWN },
      },
    });
    const wickMat = new THREE.ShaderMaterial({ vertexShader: WICK_VERT, fragmentShader: WICK_FRAG, uniforms: GLASS });
    const mirrorMat = new THREE.ShaderMaterial({
      vertexShader: MIRROR_VERT,
      fragmentShader: MIRROR_FRAG,
      side: THREE.BackSide,
      uniforms: { ...GLASS, uH0: { value: CUT_H0 }, uCrown: { value: CUT_CROWN }, uFloorY: { value: FLOOR_Y } },
    });
    return { bars, wicks, barMat, wickMat, mirrorMat };
  }, []);

  useFrame(() => {
    const p = cinemaClock.progress;
    GLASS.uReveal.value = revealF(p);
    // The lights turn with the scroll, a slow quarter-turn over the act, so
    // the facets catch and lose them as the chart goes by.
    GLASS.uSweep.value = (p - 0.32) * 3.4;
    GLASS.uFlareIdx.value = FLARE.idx;
    GLASS.uFlare.value = FLARE.amt;
  });

  return (
    <group>
      <mesh geometry={bars} material={mirrorMat} frustumCulled={false} renderOrder={-2} />
      <mesh geometry={wicks} material={wickMat} frustumCulled={false} />
      <mesh geometry={bars} material={barMat} frustumCulled={false} />
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
    </group>
  );
}

// THE FLOOR AT K1 (Phase 4, M26 as Gate A4 #3 corrected it). The visitor's
// long strike, with the chart's peak as SIM 100 (lib/candle-series.ts,
// floorY), or the example spread's 100 until they have chosen one. One thin
// line, in as the falling price reaches it: the price keeps falling, and what
// stops at the floor is the loss, which the label says in real type (a DOM
// line, not a texture). Pure function of progress and the position.
const SLAB_X1 = N * SP + 0.6;
const FLOOR_Z = 0.5;

function floorLabel(): string {
  const p = getHeroPosition();
  if (p?.chosen) return `Your floor. Below ${p.k1} the loss stops at −${money(p.maxLoss)}. Illustrative, SIM.`;
  const f = figures(START_STRIKES.k1, START_STRIKES.k2);
  return `An example floor. Below ${START_STRIKES.k1} the loss stops at −${money(f.maxLoss)}. Illustrative, SIM.`;
}

function Shards() {
  const { geometry, material } = useMemo(() => {
    const falling = CANDLES.map((c, i) => ({ c, i })).filter(({ c, i }) => !c.up && i >= FIRST_RED_I && i < CRASH_END);
    const PER = 14;
    const count = falling.length * PER;
    const origin = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const axis = new Float32Array(count * 3);
    const param = new Float32Array(count * 2);
    const rnd = mulberry32(4411);
    falling.forEach(({ c, i }, k) => {
      for (let n = 0; n < PER; n++) {
        const id = k * PER + n;
        origin.set([c.x + (rnd() - 0.5) * 0.5, c.cy - c.h / 2 + rnd() * c.h * 0.4, (rnd() - 0.5) * 0.5], id * 3);
        vel.set([(rnd() - 0.5) * 2.1, -0.3 - rnd() * 1.4, (rnd() - 0.2) * 1.6], id * 3);
        const a = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        axis.set([a.x, a.y, a.z], id * 3);
        param.set([i, 0.05 + rnd() * rnd() * 0.15], id * 2);
      }
    });
    const base = new THREE.TetrahedronGeometry(1, 0);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute("position", base.attributes.position);
    geometry.setAttribute("normal", base.attributes.normal);
    geometry.setAttribute("aOrigin", new THREE.InstancedBufferAttribute(origin, 3));
    geometry.setAttribute("aVel", new THREE.InstancedBufferAttribute(vel, 3));
    geometry.setAttribute("aAxis", new THREE.InstancedBufferAttribute(axis, 3));
    geometry.setAttribute("aParam", new THREE.InstancedBufferAttribute(param, 2));
    geometry.instanceCount = count;
    const material = new THREE.ShaderMaterial({
      vertexShader: SHARD_VERT,
      fragmentShader: SHARD_FRAG,
      side: THREE.DoubleSide,
      uniforms: { uReveal: GLASS.uReveal, uSweep: GLASS.uSweep, uFog: GLASS.uFog },
    });
    return { geometry, material };
  }, []);
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

function FloorSlab() {
  const group = useRef<THREE.Group>(null);
  const tagAnchor = useRef<THREE.Group>(null);
  const tag = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(floorLabel);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const take = () => setText(floorLabel());
    take();
    return onHeroPosition(take);
  }, []);
  const edge = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color("#ff2e63").multiplyScalar(1.7),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const rf = revealF(cinemaClock.progress);
    const k1 = getHeroPosition()?.k1 ?? START_STRIKES.k1;
    const y = floorY(k1);
    const reach = floorReachF(y);
    const on = smooth(reach - 1.2, reach, rf);
    g.visible = on > 0.002;
    const x0 = Math.max(0, reach - 1) * SP;
    g.position.set((x0 + SLAB_X1) / 2, y, 0);
    g.scale.x = SLAB_X1 - x0;
    if (tagAnchor.current) tagAnchor.current.position.x = ((reach + 2.5) * SP - (x0 + SLAB_X1) / 2) / (SLAB_X1 - x0);
    // The page draws this same line over the stage from here on, so it can
    // leave the chart for the payoff (ScrollCinema, floorHandoff). Where it
    // starts from is wherever this camera sees it.
    edge.opacity = on * (1 - smooth(0.505, 0.516, cinemaClock.progress));
    a.set(x0, y, FLOOR_Z).project(state.camera);
    b.set(SLAB_X1, y, FLOOR_Z).project(state.camera);
    const { width, height } = state.size;
    cinemaClock.stage.floor = [
      (a.x * 0.5 + 0.5) * width,
      (-a.y * 0.5 + 0.5) * height,
      (b.x * 0.5 + 0.5) * width,
      (-b.y * 0.5 + 0.5) * height,
    ];
    const words = 1 - smooth(0.5, 0.512, cinemaClock.progress);
    if (tag.current) tag.current.style.opacity = (on * words * smooth(reach, reach + 0.6, rf)).toFixed(3);
  });
  return (
    <group ref={group} visible={false}>
      <mesh material={edge} position={[0, 0, FLOOR_Z]}>
        <boxGeometry args={[1, 0.022, 0.022]} />
      </mesh>
      {/* Html projects its world position, so the group's x-scale moves the
          anchor without stretching the type. */}
      <group ref={tagAnchor} position={[-0.5, 0, FLOOR_Z]}>
        <Html zIndexRange={[1, 0]} style={{ pointerEvents: "none" }}>
          <div
            ref={tag}
            className="whitespace-nowrap text-[13px] text-fg-dim"
            style={{ opacity: 0, transform: "translate(6px, 8px)" }}
          >
            {text}
          </div>
        </Html>
      </group>
    </group>
  );
}

// The working light: it rides the printing edge, so each new bar is seen by
// what it catches, and it tells the glass where it is for the surface glint.
function PrintLight() {
  const head = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const rf = revealF(cinemaClock.progress);
    const idx = clamp(Math.floor(rf), 0, N - 1);
    const frac = clamp(rf - idx, 0, 1);
    const x = clamp(rf, 0, N - 1) * SP;
    const y = lerp(CANDLES[idx].cy, CANDLES[Math.min(idx + 1, N - 1)].cy, frac);
    const crash = !CANDLES[idx].up && idx >= FIRST_RED_I;
    GLASS.uLightPos.value.set(x, y + 1.6, 3.4);
    GLASS.uLightCol.value.set(crash ? "#ff2e63" : "#52ffa5");
    GLASS.uHeat.value += ((crash ? 1 : 0) - GLASS.uHeat.value) * damp(0.06, cinemaClock.dt);
    head.set(x, y, 0).project(state.camera);
    cinemaClock.stage.head = [head.x, head.y];
  });
  return null;
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

/** The camera's trauma at print position `rf`: the strongest live hit from the crash's red candles. */
function traumaAt(rf: number) {
  let t = 0;
  // From the first red print: the crash is one frame (lib/candle-series.ts).
  for (let i = FIRST_RED_I; i < CRASH_END; i++) {
    const c = CANDLES[i];
    if (c.up) continue;
    const since = rf - i;
    if (since < 0) break;
    t = Math.max(t, Math.exp(-since * 2.4) * Math.min(1, c.h / 1.6));
  }
  return t;
}

function Rig() {
  const pos = useRef(new THREE.Vector3(...CANDLE_CAM_START.pos));
  const look = useRef(new THREE.Vector3(...CANDLE_CAM_START.look));
  const tmpP = useRef(new THREE.Vector3());
  const tmpL = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const euler = useRef(new THREE.Euler());
  const quat = useRef(new THREE.Quaternion());
  const pxs = useRef(0);
  const pys = useRef(0);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // damped pointer → true ORBIT steering (the world looks around with you);
    // every follower here is dt-correct (M31), so 120Hz glides like 60Hz
    const dt = cinemaClock.dt;
    pxs.current += (cinemaClock.px - pxs.current) * damp(0.05, dt);
    pys.current += (cinemaClock.py - pys.current) * damp(0.05, dt);
    const build = buildAt(cinemaClock.progress);
    // TRAUMA (Gate A3, materials): every red crash candle adds a hit that
    // decays over about a candle's print, and the strongest still alive is
    // the camera's trauma. The shake is trauma squared over smooth noise, not
    // a buzzing sin(time·53), so a small candle barely nudges and the big
    // drops land. Still a pure function of rf: scrubbing back un-shakes.
    const rf = revealF(cinemaClock.progress);
    const impact = traumaAt(rf);
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
    //
    // Wider and with the look raised (Gate A4 #3): the old pull-back framed the
    // crash from below the peak, so the floor at K1, which sits just under the
    // peak, was above the top of the frame. Now the peak and the floor land
    // around y 250–285 of 900, under the act's copy, and the chop still reads
    // at the bottom: the whole sentence, the price falling through the floor.
    const pull = smooth(0.66, 0.95, build);
    // In close on the first bars, where the glass is the subject, easing out
    // to the working distance as the chart gets going.
    const near = 1 - smooth(0.02, 0.2, build);
    const back = lerp(10.5, 5.6, near);
    const side = lerp(6.2, 3.1, near);
    const rise = lerp(3.4, 1.3, near);
    tmpL.current.set(lerp(edgeX - side * 0.2, SPAN * 0.78, pull), lerp(trendY + 0.15, 9, pull), 0);
    tmpP.current.set(
      lerp(edgeX - side, SPAN * 0.5, pull) + Math.sin(time * 0.33) * 0.12,
      lerp(trendY + rise, PEAK_Y * 0.5 + 5, pull) + Math.sin(time * 0.47) * 0.09,
      lerp(back, 40, pull) + Math.cos(time * 0.29) * 0.1
    );
    // orbit the look-target by the pointer: ±12° yaw, ±6° pitch
    offset.current.copy(tmpP.current).sub(tmpL.current);
    euler.current.set(-pys.current * 0.11, -pxs.current * 0.21, 0, "YXZ");
    quat.current.setFromEuler(euler.current);
    offset.current.applyQuaternion(quat.current);
    tmpP.current.copy(tmpL.current).add(offset.current);
    // inertia: the camera trails its target — motion has mass
    pos.current.lerp(tmpP.current, damp(0.09, dt));
    look.current.lerp(tmpL.current, damp(0.09, dt));
    // deterministic smooth noise (no Math.random: it must reverse under scrub)
    const shake = impact * impact;
    pos.current.x += (Math.sin(time * 11.1) + Math.sin(time * 15.7 + 1.3)) * 0.02 * shake;
    pos.current.y += (Math.sin(time * 9.3 + 0.7) + Math.sin(time * 13.1 + 2.9)) * 0.018 * shake;
    state.camera.position.copy(pos.current);
    state.camera.lookAt(look.current);
    // scroll hard → the world stretches (FOV kick); crash impacts punch in too
    const cam = state.camera as THREE.PerspectiveCamera;
    const targetFov = CANDLE_CAM_START.fov + cinemaClock.vel * 2.5;
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov += (targetFov - cam.fov) * damp(0.1, dt);
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

export default function CandleField3D({
  active,
  onReady,
  onLost,
}: {
  active: boolean;
  onReady?: () => void;
  onLost?: () => void;
}) {
  // A handle on the live post chain so the colour script can write to it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const composerRef = useRef<any>(null);
  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, FILM_DPR_MAX]}
      // On the film's one clock (M31): drawn by ScrollCinema's tick, never by a loop of its own.
      frameloop="never"
      gl={{ alpha: false, antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: CANDLE_CAM_START.fov, position: CANDLE_CAM_START.pos, near: 0.1, far: 200 }}
      onCreated={({ gl }) => {
        onReady?.();
        watchContext(gl.domElement, onLost, onReady);
      }}
      fallback={null}
    >
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 22, 60]} />

      <Interaction />
      <Stage />
      <Candles />
      <Shards />
      <FloorSlab />
      <PrintLight />
      {/* A little dust in the key light, so the stage has air. */}
      <Dust seed={11} count={220} area={[70, 16, 14]} center={[SPAN / 2, 7, 0]} color="#8f9bff" size={0.03} speed={0.08} react={0.6} />

      <Rig />
      <FilmDriver active={active} />
      <FilmDpr />

      {/* NOTE: no `ref` on the individual effects. Under React 19 `ref` is an
          ordinary prop, and @react-three/postprocessing JSON.stringify()s its
          children to key the chain — so a ref holding a mounted effect (which
          has a .parent) throws "Converting circular structure to JSON" and takes
          the whole page down. Ref the composer instead and read its passes. */}
      <EffectComposer ref={composerRef} multisampling={0}>
        {/* Focus rides the printing edge (the Colourist writes it each frame). */}
        <DepthOfField focusDistance={12} focusRange={9} bokehScale={2.2} resolutionScale={0.5} />
        {/* Half resolution: a glow is the one thing that loses nothing to it.
            Five levels keep it round the filaments instead of washing the frame. */}
        <Bloom mipmapBlur levels={3} radius={0.5} resolutionScale={0.5} luminanceThreshold={1.05} luminanceSmoothing={0.3} intensity={0.3} />
        {/* TONE MAPPING, which is not the grade. A composer renders into a float target, and three only
            tone-maps on the way to the screen, so this layer had none: every
            emissive over 1.0 clipped flat (the 2026-11 re-tribunal measured
            54.7% of the cube clipped and 186px undithered green runs). Khronos
            PBR Neutral rolls highlights off instead of cutting them and leaves
            hues alone below that; AgX was tried first and turned the crash red
            salmon and the bull green mint, which breaks a colour script built
            on red arriving late and hard. SMAA after it, on display values. */}
        <ToneMapping mode={ToneMappingMode.NEUTRAL} />
        {/* The grade itself: the loss red and gain green back on their tokens,
            and a dither for the 8-bit steps. See Grade.tsx. */}
        <Grade />
        <SMAA />
      </EffectComposer>
      {/* Drives the three rooms onto the live chain. Inside <Canvas> for useFrame. */}
      <Colourist composerRef={composerRef} />
    </Canvas>
  );
}

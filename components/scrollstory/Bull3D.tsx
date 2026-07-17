"use client";

// Targeted real-3D "hero moment": the bull act (progress ~0.71–0.85) rendered as
// a dark sculpture under green/cyan rim light + bloom — standing on black glass,
// wrapped in an orbiting energy aura and ground mist, breathing, its head turning
// toward the cursor. Reads the shared cinemaClock in useFrame (one-clock rule) —
// no per-frame React state. The whole layer's DOM opacity is crossfaded by
// ScrollCinema via bull3dOpacity(), so it dissolves into the 2D logo underneath.

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { cinemaClock } from "@/lib/cinema-clock";
import { BULL3D } from "@/lib/cinema";

// Model: Higgsfield/Meshy image_to_3d from our own faceted-obsidian bull concept
// still — owned output, no attribution. Deliberately low-poly (~8k tri, untextured)
// so flatShading reads as sharp crystal facets; the in-code obsidian material +
// green fresnel seams own the whole look. Previous smooth statue kept at
// /models/bull-obsidian.glb as a fallback.
const MODEL = "/models/bull-crystal.glb";
useGLTF.preload(MODEL, "/draco/");

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
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

// --- scene-local interaction state -------------------------------------------
const CURSORB = { world: new THREE.Vector3(), ok: false };
const SNORT = { t: -1e9 }; // last time the bull was clicked (performance.now())

// Raycasts the pointer onto the scene plane (aura force-field) and consumes
// clicks: clicking on/near the bull makes it SNORT.
function BullInteraction() {
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const lastClick = useRef(0);
  useFrame((state) => {
    ndc.set(cinemaClock.px, -cinemaClock.py);
    ray.setFromCamera(ndc, state.camera);
    CURSORB.ok = ray.ray.intersectPlane(plane, CURSORB.world) !== null;
    const clk = cinemaClock.click;
    if (clk && clk.t !== lastClick.current) {
      lastClick.current = clk.t;
      const p = cinemaClock.progress;
      const bt = (p - BULL3D.in0) / (BULL3D.out1 - BULL3D.in0);
      if (bt > 0.02 && bt < 0.98) {
        ndc.set(clk.x, -clk.y);
        ray.setFromCamera(ndc, state.camera);
        if (ray.ray.intersectPlane(plane, hit) && Math.abs(hit.x) < 2.2 && hit.y > -0.2 && hit.y < 2.8) {
          SNORT.t = clk.t; // clicked the bull → snort
        }
      }
    }
  });
  return null;
}

// Particle assembly: ~1400 motes scattered on a shell converge onto the bull's
// surface as it rises — the swarm BECOMES the bull, then dies as it lands.
// Rendered inside the same <group> as the model so it inherits every transform
// (rise, charge, snort scale). Pure f(bt) per particle → scrub-reversible.
function AssemblyParticles({ fitted }: { fitted: THREE.Object3D }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, targets, scatters, stagger, count } = useMemo(() => {
    // holder object: TS flow-narrowing can't see assignments inside traverse()
    const found: { m: THREE.Mesh | null } = { m: null };
    fitted.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!found.m && m.isMesh && m.geometry) found.m = m;
    });
    const mesh = found.m;
    // include the fit scale/offset applied after the memo's first update pass
    fitted.updateWorldMatrix(true, true);
    const pos = mesh
      ? (mesh.geometry.attributes.position as THREE.BufferAttribute)
      : null;
    const total = pos ? pos.count : 0;
    const stride = Math.max(1, Math.floor(total / 1400));
    const count = pos ? Math.min(1400, Math.floor(total / stride)) : 0;
    const targets = new Float32Array(count * 3);
    const scatters = new Float32Array(count * 3);
    const stagger = new Float32Array(count);
    const rnd = mulberry32(7);
    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      v.fromBufferAttribute(pos!, i * stride);
      // fitted has no parent at memo time → "world" here IS the group's local space
      mesh!.localToWorld(v);
      targets[i * 3] = v.x + (rnd() * 2 - 1) * 0.01;
      targets[i * 3 + 1] = v.y + (rnd() * 2 - 1) * 0.01;
      targets[i * 3 + 2] = v.z + (rnd() * 2 - 1) * 0.01;
      // scatter start: random point on a shell r 3.2..5 around the bull's chest
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const rr = 3.2 + rnd() * 1.8;
      const sxy = Math.sqrt(1 - u * u);
      scatters[i * 3] = Math.cos(th) * sxy * rr;
      scatters[i * 3 + 1] = 1.3 + u * rr;
      scatters[i * 3 + 2] = Math.sin(th) * sxy * rr;
      stagger[i] = rnd();
    }
    const positions = new Float32Array(scatters); // start fully scattered
    return { positions, targets, scatters, stagger, count };
  }, [fitted]);
  useFrame(() => {
    const pts = ref.current;
    if (!pts || count === 0) return;
    // same local time + rise curve as Bull's useFrame so the swarm lands exactly
    // when the model finishes rising
    const bt = clamp(
      (cinemaClock.progress - BULL3D.in0) / (BULL3D.out1 - BULL3D.in0),
      0,
      1
    );
    const rise = smooth(0, 0.34, bt);
    const fade = 1 - smooth(0.3, 0.42, bt); // bull absorbs the swarm as it settles
    (pts.material as THREE.PointsMaterial).opacity = fade;
    pts.visible = fade >= 0.01; // skip draw for the rest of the act
    if (!pts.visible) return;
    const arr = pts.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const conv = clamp(rise * 1.45 - stagger[i] * 0.45, 0, 1); // staggered arrival
      const k = 1 - (1 - conv) ** 3; // easeOut cubic → decelerating landing
      arr[i * 3] = lerp(scatters[i * 3], targets[i * 3], k);
      arr[i * 3 + 1] = lerp(scatters[i * 3 + 1], targets[i * 3 + 1], k);
      arr[i * 3 + 2] = lerp(scatters[i * 3 + 2], targets[i * 3 + 2], k);
    }
    pts.geometry.attributes.position.needsUpdate = true;
  });
  if (count === 0) return null;
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#7dffc9"
        size={0.035}
        sizeAttenuation
        map={dotTexture()}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Bull() {
  const { scene } = useGLTF(MODEL, "/draco/");
  const group = useRef<THREE.Group>(null);
  const pxs = useRef(0);

  // Skeleton-safe clone (plain clone breaks skinned binds), fit into a ~2.6-unit
  // height standing on y=0 and centered on x/z. The obsidian GLB carries its own
  // PBR textures — keep them and layer the fresnel rim on top; only untextured
  // meshes fall back to the flat sculptural material.
  const fitted = useMemo(() => {
    const root = skeletonClone(scene);
    // Bounds from geometry (Box3.setFromObject is unreliable on skinned meshes).
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        tmp.copy(m.geometry.boundingBox as THREE.Box3).applyMatrix4(m.matrixWorld);
        box.union(tmp);
      }
    });
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    // 1.7 (was 2.3 for the compact standing obsidian statue): the crystal bull is
    // a LUNGING sculpt, ~2.5x longer (z) than tall — at a 2.3-height fit it filled
    // the whole frame, parked its nose ~1.7 units from the camera at rest and
    // swallowed the aura cylinder (r ≤ 2.65) inside its own silhouette. 1.7 keeps
    // body + aura framed through the rise/turntable and saves the nose-past-camera
    // moment for the actual charge finale.
    const s = 1.7 / size.y;
    root.scale.multiplyScalar(s);
    root.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const mat = new THREE.MeshStandardMaterial({
      color: "#070b0e",
      roughness: 0.2,
      metalness: 0.4,
      flatShading: true, // faceted obsidian-crystal read — sharp low-poly facets catch the rim light
      side: THREE.DoubleSide, // Meshy meshes can ship reversed winding — render both sides so nothing culls
    });
    // Fresnel edge-glow: a continuous green→cyan rim on the silhouette (independent
    // of light angle) so the sculpture always reads against the black + feeds bloom.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float _fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 4.5);
         vec3 _rim = mix(vec3(0.0, 1.0, 0.529), vec3(0.0, 0.898, 1.0), clamp(normal.x * 0.5 + 0.5, 0.0, 1.0));
         totalEmissiveRadiance += _rim * _fres * 1.05;`
      );
    };
    mat.customProgramCacheKey = () => "bull-fresnel";
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = m.material as THREE.MeshStandardMaterial;
      if (src?.isMeshStandardMaterial && src.map) {
        const base = src.clone(); // don't mutate the useGLTF cache
        base.roughness = Math.min(base.roughness, 0.24);
        base.metalness = Math.max(base.metalness ?? 0.3, 0.38);
        base.flatShading = true; // faceted crystal read on the textured obsidian meshes too
        base.onBeforeCompile = mat.onBeforeCompile;
        base.customProgramCacheKey = () => "bull-fresnel";
        base.needsUpdate = true;
        m.material = base;
      } else {
        m.material = mat;
      }
    });
    return root;
  }, [scene]);

  const headLight = useRef<THREE.PointLight>(null);
  const headWorld = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const time = state.clock.elapsedTime;
    const p = cinemaClock.progress;
    // Local time across the whole bull layer window.
    const bt = clamp((p - BULL3D.in0) / (BULL3D.out1 - BULL3D.in0), 0, 1);
    // Emergence: rise + settle over the first third, then a slow turntable.
    const rise = smooth(0, 0.34, bt);
    // Charge finale: lean back + head down (windup), then LUNGE at the camera.
    const windup = smooth(0.66, 0.8, bt);
    const charge = smooth(0.8, 0.97, bt);
    pxs.current += (cinemaClock.px - pxs.current) * 0.045;
    const snort = Math.exp(-(performance.now() - SNORT.t) / 480); // click → snort
    g.position.y = (1 - rise) * -1.1 + Math.sin(time * 1.05) * 0.02 * rise; // breathing
    // assigned (not +=) so scrubbing backwards reverses cleanly — pure f(bt)
    g.position.z = -windup * 0.5 + charge * charge * 4.2; // recoil, then accelerate
    g.position.x = charge * 0.5;
    g.scale.setScalar(
      (0.92 + 0.08 * rise) * (1 + Math.sin(time * 0.9) * 0.005 + 0.05 * snort) +
        charge * 0.15 // looms as it closes the distance
    );
    // slow turntable + the head tracks the cursor hard — it WATCHES you
    g.rotation.y = -0.62 + bt * 0.7 + pxs.current * 0.42 + charge * 0.55; // squares up to the viewer
    // snort toss + windup head-dip + mid-lunge head toss, all additive
    g.rotation.x = -0.09 * snort + 0.1 * windup - 0.22 * charge;
    // eye-line light: ignites when your cursor comes near its face (or it snorts)
    const hl = headLight.current;
    if (hl) {
      hl.getWorldPosition(headWorld).project(state.camera);
      const d = Math.hypot(headWorld.x - cinemaClock.px, headWorld.y - -cinemaClock.py);
      const prox = clamp(1 - d / 0.55, 0, 1);
      hl.intensity = 0.4 + prox * 5 + snort * 10;
    }
  });

  return (
    <group ref={group}>
      <primitive object={fitted} />
      {/* the swarm that converges into the bull during the rise */}
      <AssemblyParticles fitted={fitted} />
      {/* rides the head as the bull turns */}
      <pointLight
        ref={headLight}
        position={[-1.02, 1.78, 0.5]}
        color="#7dffc9"
        distance={2.6}
        decay={2}
        intensity={0.4}
      />
    </group>
  );
}

// Orbiting energy aura: green motes rising in a cylinder around the bull —
// the same particle language as the logo it dissolves into.
function Aura() {
  const ref = useRef<THREE.Points>(null);
  const COUNT = 850;
  const { positions, a0, r0, h0, sp } = useMemo(() => {
    const rnd = mulberry32(41);
    const positions = new Float32Array(COUNT * 3);
    const a0 = new Float32Array(COUNT);
    const r0 = new Float32Array(COUNT);
    const h0 = new Float32Array(COUNT);
    const sp = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      a0[i] = rnd() * Math.PI * 2;
      r0[i] = 1.15 + rnd() * 1.5;
      h0[i] = rnd() * 3.0;
      sp[i] = 0.25 + rnd() * 0.5;
    }
    return { positions, a0, r0, h0, sp };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame((state) => {
    const pts = ref.current;
    if (!pts) return;
    const t = state.clock.elapsedTime;
    const arr = pts.geometry.attributes.position.array as Float32Array;
    // snort → the aura blasts outward and races; cursor → motes shy away
    const burst = Math.exp(-(performance.now() - SNORT.t) / 520);
    // charge finale → the aura streams off the bull as it runs (pure f(bt))
    const abt = clamp(
      (cinemaClock.progress - BULL3D.in0) / (BULL3D.out1 - BULL3D.in0),
      0,
      1
    );
    const chargeBurst = smooth(0.8, 0.97, abt);
    const cw = CURSORB.ok ? CURSORB.world : null;
    for (let i = 0; i < COUNT; i++) {
      const a = a0[i] + t * sp[i] * (0.55 + burst * 1.6 + chargeBurst * 2.0);
      const h = (h0[i] + t * sp[i] * 0.5) % 3.0;
      const r =
        r0[i] *
        (1 - h * 0.11) *
        (1 + burst * 0.55 * (1 - h / 3)) *
        (1 + chargeBurst * 0.9);
      let x = Math.cos(a) * r;
      let y = h * 0.92 + 0.12;
      const z = Math.sin(a) * r * 0.62; // squashed to hug the body
      if (cw) {
        const rx = x - cw.x;
        const ry = y - cw.y;
        const r2 = rx * rx + ry * ry;
        if (r2 < 1.9 && r2 > 0.0001) {
          const d = Math.sqrt(r2);
          const push = (1 - d / 1.38) * 0.5;
          x += (rx / d) * push;
          y += (ry / d) * push;
        }
      }
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    // base dimmed 0.4→0.32 so the assembly swarm owns the emergence beat
    (pts.material as THREE.PointsMaterial).opacity =
      0.32 + 0.12 * Math.sin(t * 0.8) + 0.3 * burst + chargeBurst * 0.35;
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#38ffa1"
        size={0.028}
        sizeAttenuation
        map={dotTexture()}
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// White-green impact flash: a huge additive sprite glued 2 units in front of the
// camera. As the DOM wrapper crossfades out at the end of the act it whites the
// frame, so the particle-logo act appears out of the burst. Pure f(bt).
function ImpactFlash() {
  const ref = useRef<THREE.Sprite>(null);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const s = ref.current;
    if (!s) return;
    const bt = clamp(
      (cinemaClock.progress - BULL3D.in0) / (BULL3D.out1 - BULL3D.in0),
      0,
      1
    );
    const flash = smooth(0.9, 1.0, bt) * 0.9;
    (s.material as THREE.SpriteMaterial).opacity = flash;
    s.visible = flash > 0.001; // skip the draw call outside the burst
    // re-glue every frame: camera position + 2 along the view direction, so the
    // quad survives the Rig's orbit/shake and always covers the viewport
    state.camera.getWorldDirection(fwd);
    s.position.copy(state.camera.position).addScaledVector(fwd, 2);
  });
  return (
    <sprite ref={ref} scale={[40, 40, 1]} frustumCulled={false} renderOrder={999}>
      <spriteMaterial
        map={dotTexture()}
        color="#ccffe2"
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

function Rig() {
  const pos = useRef(new THREE.Vector3(2.5, 1.55, 5.3));
  const look = useRef(new THREE.Vector3(0, 1.15, 0));
  const tmpP = useRef(new THREE.Vector3());
  const tmpL = useRef(new THREE.Vector3());
  const offset = useRef(new THREE.Vector3());
  const euler = useRef(new THREE.Euler());
  const quat = useRef(new THREE.Quaternion());
  const pxs = useRef(0);
  const pys = useRef(0);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    pxs.current += (cinemaClock.px - pxs.current) * 0.05;
    pys.current += (cinemaClock.py - pys.current) * 0.05;
    const bt = clamp(
      (cinemaClock.progress - BULL3D.in0) / (BULL3D.out1 - BULL3D.in0),
      0,
      1
    );
    const charge = smooth(0.8, 0.97, bt);
    // Gentle dolly-in through the beat + a slow handheld sway; the camera backs
    // off slightly during the charge — then the bull overtakes it anyway.
    const z = 5.3 - 0.7 * smooth(0, 1, bt) + charge * 0.6;
    tmpL.current.set(0, 1.15 - pys.current * 0.1, 0);
    tmpP.current.set(
      2.5 + Math.sin(time * 0.31) * 0.07,
      1.55 + Math.sin(time * 0.43) * 0.05,
      z
    );
    // true orbit: your pointer walks the camera AROUND the bull (±14° / ±7°)
    offset.current.copy(tmpP.current).sub(tmpL.current);
    euler.current.set(-pys.current * 0.12, -pxs.current * 0.25, 0, "YXZ");
    quat.current.setFromEuler(euler.current);
    offset.current.applyQuaternion(quat.current);
    tmpP.current.copy(tmpL.current).add(offset.current);
    pos.current.lerp(tmpP.current, 0.08);
    look.current.lerp(tmpL.current, 0.08);
    state.camera.position.copy(pos.current);
    // impact shake, applied after the smoothed pos so it never feeds back into
    // the lerp state — sin-based = deterministic + fully reversible
    state.camera.position.x += Math.sin(time * 47.0) * 0.1 * charge;
    state.camera.position.y += Math.cos(time * 39.0) * 0.08 * charge;
    state.camera.lookAt(look.current);
    // scroll velocity → FOV kick; the charge punches the FOV wide open
    const cam = state.camera as THREE.PerspectiveCamera;
    const targetFov = 34 + cinemaClock.vel * 7 + charge * 24;
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov += (targetFov - cam.fov) * 0.1;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

export default function Bull3D({
  active,
  onReady,
}: {
  active: boolean;
  onReady?: () => void;
}) {
  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, 2]}
      frameloop={active ? "always" : "never"}
      gl={{ alpha: false, antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: 34, position: [2.5, 1.55, 5.3], near: 0.1, far: 60 }}
      onCreated={() => onReady?.()}
      fallback={null}
    >
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 7, 16]} />

      {/* Dim ambient so recesses aren't pure black */}
      <ambientLight intensity={0.12} />
      {/* Key: soft cool-white, front-top-left */}
      <directionalLight position={[3.5, 5, 4]} intensity={2.1} color="#dfeee7" />
      {/* Rim: bright green from behind-right → sculptural edge glow */}
      <directionalLight position={[-4.5, 2.4, -3.2]} intensity={5} color="#00ff87" />
      {/* Rim: subtle cyan accent from behind-left (kept low so the rear stays dark
          and sculptural, not flat teal) */}
      <directionalLight position={[4.8, 1.4, -4.2]} intensity={1.5} color="#00e5ff" />

      <Suspense fallback={null}>
        <Bull />
      </Suspense>
      <BullInteraction />
      <Aura />
      {/* no floor plane: the bull stands in pure black void — every floor
          treatment (mist, shadows, mirror) read as a green wash on real GPUs */}

      <Rig />
      <ImpactFlash />

      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          luminanceThreshold={0.55}
          luminanceSmoothing={0.25}
          intensity={0.9}
        />
        <ChromaticAberration offset={[0.0005, 0.0009]} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}

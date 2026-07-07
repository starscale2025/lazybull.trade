"use client";

// Targeted real-3D "hero moment": the bull act (progress ~0.71–0.85) rendered as
// a dark sculpture under green/cyan rim light + bloom — standing on black glass,
// wrapped in an orbiting energy aura and ground mist, breathing, its head turning
// toward the cursor. Reads the shared cinemaClock in useFrame (one-clock rule) —
// no per-frame React state. The whole layer's DOM opacity is crossfaded by
// ScrollCinema via bull3dOpacity(), so it dissolves into the 2D logo underneath.

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, ContactShadows, MeshReflectorMaterial } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { cinemaClock } from "@/lib/cinema-clock";
import { BULL3D } from "@/lib/cinema";

// Model: "Bull" by Poly by Google — CC BY 3.0 (via poly.pizza/m/fWsIqDIIJ5S).
// Attribution required; see public/models/CREDITS.md.
const MODEL = "/models/bull.glb";
useGLTF.preload(MODEL);

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
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

function Bull() {
  const { scene } = useGLTF(MODEL);
  const group = useRef<THREE.Group>(null);
  const pxs = useRef(0);

  // Skeleton-safe clone (plain clone breaks skinned binds), fit into a ~2.6-unit
  // height standing on y=0 and centered on x/z, and override every material with
  // one dark sculptural surface (the GLB ships no textures).
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
    const s = 2.6 / size.y;
    root.scale.multiplyScalar(s);
    root.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const mat = new THREE.MeshStandardMaterial({
      color: "#0a0d0b",
      roughness: 0.4,
      metalness: 0.45,
    });
    // Fresnel edge-glow: a continuous green→cyan rim on the silhouette (independent
    // of light angle) so the sculpture always reads against the black + feeds bloom.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float _fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 4.5);
         vec3 _rim = mix(vec3(0.0, 1.0, 0.529), vec3(0.0, 0.898, 1.0), clamp(normal.x * 0.5 + 0.5, 0.0, 1.0));
         totalEmissiveRadiance += _rim * _fres * 0.7;`
      );
    };
    mat.customProgramCacheKey = () => "bull-fresnel";
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = mat;
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
    pxs.current += (cinemaClock.px - pxs.current) * 0.045;
    const snort = Math.exp(-(performance.now() - SNORT.t) / 480); // click → snort
    g.position.y = (1 - rise) * -1.1 + Math.sin(time * 1.05) * 0.02 * rise; // breathing
    g.scale.setScalar(
      (0.92 + 0.08 * rise) * (1 + Math.sin(time * 0.9) * 0.005 + 0.05 * snort)
    );
    // slow turntable + the head tracks the cursor hard — it WATCHES you
    g.rotation.y = -0.62 + bt * 0.7 + pxs.current * 0.42;
    g.rotation.x = -0.09 * snort; // the head tosses up on the snort
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
    const cw = CURSORB.ok ? CURSORB.world : null;
    for (let i = 0; i < COUNT; i++) {
      const a = a0[i] + t * sp[i] * (0.55 + burst * 1.6);
      const h = (h0[i] + t * sp[i] * 0.5) % 3.0;
      const r = r0[i] * (1 - h * 0.11) * (1 + burst * 0.55 * (1 - h / 3));
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
    (pts.material as THREE.PointsMaterial).opacity =
      0.5 + 0.16 * Math.sin(t * 0.8) + 0.3 * burst;
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

// Low ground mist: soft additive billboards drifting through the bull's legs.
function Mist() {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, "rgba(140,255,200,0.55)");
    grad.addColorStop(1, "rgba(140,255,200,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  const refs = useRef<(THREE.Sprite | null)[]>([]);
  const PUFFS = [
    { x: -1.4, y: 0.32, s: 4.6, sp: 0.16, ph: 0 },
    { x: 1.2, y: 0.24, s: 3.8, sp: 0.11, ph: 2.4 },
    { x: 0, y: 0.4, s: 5.4, sp: 0.08, ph: 4.2 },
  ];
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    PUFFS.forEach((p, i) => {
      const s = refs.current[i];
      if (!s) return;
      s.position.set(p.x + Math.sin(t * p.sp + p.ph) * 1.3, p.y, 0.6);
      (s.material as THREE.SpriteMaterial).opacity = 0.04 + 0.022 * Math.sin(t * 0.5 + p.ph);
    });
  });
  return (
    <group>
      {PUFFS.map((p, i) => (
        <sprite
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          scale={[p.s, p.s * 0.42, 1]}
        >
          <spriteMaterial map={tex} transparent opacity={0.06} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
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
    // Gentle dolly-in through the beat + a slow handheld sway.
    const z = 5.3 - 0.7 * smooth(0, 1, bt);
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
    state.camera.lookAt(look.current);
    // scroll velocity → FOV kick
    const cam = state.camera as THREE.PerspectiveCamera;
    const targetFov = 34 + cinemaClock.vel * 7;
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
      <Mist />

      {/* black-glass floor: the rimmed silhouette reflects beneath the bull */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <planeGeometry args={[36, 36]} />
        <MeshReflectorMaterial
          blur={[380, 120]}
          resolution={1024}
          mixBlur={0.9}
          mixStrength={1.8}
          roughness={0.8}
          depthScale={1.0}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.2}
          color="#060807"
          metalness={0.5}
          mirror={0.62}
        />
      </mesh>
      {/* Soft green contact shadow keeps the sculpture seated on the glass */}
      <ContactShadows
        position={[0, 0.008, 0]}
        opacity={0.42}
        scale={14}
        blur={2.8}
        far={4}
        resolution={512}
        color="#00160c"
      />

      <Rig />

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

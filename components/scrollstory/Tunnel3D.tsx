"use client";

// The DIVE act (progress ~0.148–0.242) as a REAL 3D warp tunnel: the camera
// flies down a corridor of glowing app-screen panels toward a blinding light,
// speed-lines streaking past. Camera z is a pure ease of scroll progress (scrubs
// clean both ways); ambient roll/streaks ride the elapsed clock; pointer steers
// the lens; scroll velocity kicks the FOV and brightens the warp lines. All
// state flows through cinemaClock (one-clock rule). Crossfaded over the 2D
// scene by ScrollCinema.

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, ChromaticAberration, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import { cinemaClock } from "@/lib/cinema-clock";
import { DIVE3D } from "@/lib/cinema";

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

// Local act time: 0 at the layer's fade-in start, 1 at its fade-out end.
const diveT = (progress: number) =>
  clamp((progress - DIVE3D.in0) / (DIVE3D.out1 - DIVE3D.in0), 0, 1);
// Camera z is a pure easeInOut of scroll — the flythrough scrubs both ways.
const CAM_Z0 = 2;
const CAM_Z1 = -58;
const camZAt = (progress: number) => lerp(CAM_Z0, CAM_Z1, smooth(0, 1, diveT(progress)));

// --- corridor layout ----------------------------------------------------------
const SHOTS = ["learn", "trade", "quant", "pro", "chain", "bots", "about"].map(
  (n) => `/cinema/shots/${n}.webp`
);
const PANEL_N = 16;
const PANEL_Z0 = -4;
const PANEL_Z1 = -52;
type Panel = { pos: [number, number, number]; rot: [number, number, number]; tex: number };
const PANELS: Panel[] = (() => {
  const out: Panel[] = [];
  for (let i = 0; i < PANEL_N; i++) {
    const z = PANEL_Z0 + ((PANEL_Z1 - PANEL_Z0) / (PANEL_N - 1)) * i;
    const tex = i % SHOTS.length;
    // cycle left / right / above / below — each tilted toward the flight path
    const side = i % 4;
    if (side === 0) out.push({ pos: [-5.4, 0, z], rot: [0, 0.55, 0], tex });
    else if (side === 1) out.push({ pos: [5.4, 0, z], rot: [0, -0.55, 0], tex });
    else if (side === 2) out.push({ pos: [0, 3.6, z], rot: [0.5, 0, 0], tex });
    else out.push({ pos: [0, -3.6, z], rot: [-0.5, 0, 0], tex });
  }
  return out;
})();

// Soft round sprite for the dust (raw gl_Points render as squares up close).
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

// The light at the end: hot white core → green falloff, built once on a canvas.
const glowTexture = (() => {
  let t: THREE.CanvasTexture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 126);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.22, "rgba(224,255,240,0.95)");
    grad.addColorStop(0.5, "rgba(0,255,135,0.4)");
    grad.addColorStop(1, "rgba(0,255,135,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();

// Corridor of app screens: 16 planes cycling 7 shots, each with a glowing green
// edge frame. Source images are 4800x3000 — far too big to upload raw — so each
// is downscaled onto a 1024x640 canvas before becoming a texture. Panels show a
// dark slab until their texture lands (frames keep the corridor readable).
const DRIFT_Y = 0.18; // ambient float amplitude (y)
const DRIFT_X = 0.12; // ambient float amplitude (x)
const WOBBLE = 0.03; // ambient rotation wobble (rad, ~0.3Hz)
const PROX_RANGE = 7; // z distance where the camera starts pushing a panel aside
const PUSH_X = 1.4; // outward push for wall (x) panels
const PUSH_Y = 1.0; // outward push for ceiling/floor (y) panels
const TILT_AWAY = 0.18; // extra tilt away from the lens at full proximity
const PUSH_EASE = 0.12; // per-frame lerp toward the proximity target (deterministic converge)

function Corridor() {
  const plane = useMemo(() => new THREE.PlaneGeometry(6.4, 4), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(plane), [plane]);
  const frameMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#00ff87", transparent: true, opacity: 0.38 }),
    []
  );
  // one material per shot (not per panel) — 7 uploads, panels share
  const mats = useMemo(
    () => SHOTS.map(() => new THREE.MeshBasicMaterial({ color: "#0c1a13", toneMapped: false })),
    []
  );
  const texRef = useRef<(THREE.CanvasTexture | null)[]>(SHOTS.map(() => null));
  const panelRefs = useRef<(THREE.Group | null)[]>(PANELS.map(() => null));
  // per-panel ambient phase — deterministic, so drift is identical every mount
  const phases = useMemo(() => {
    const rnd = mulberry32(1717);
    return PANELS.map(() => rnd() * Math.PI * 2);
  }, []);
  // smoothed proximity per panel — eased toward a scroll-pure target, never accumulated
  const proxSm = useRef(new Float32Array(PANEL_N));
  useEffect(() => {
    let alive = true;
    SHOTS.forEach((url, i) => {
      const img = new Image();
      img.onload = () => {
        if (!alive) return;
        const c = document.createElement("canvas");
        c.width = 1024;
        c.height = 640;
        c.getContext("2d")!.drawImage(img, 0, 0, 1024, 640);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        texRef.current[i] = t;
      };
      img.src = url;
    });
    return () => {
      alive = false;
    };
  }, []);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // swap placeholder → screenshot the frame its texture arrives (no re-render)
    for (let i = 0; i < mats.length; i++) {
      const t = texRef.current[i];
      const m = mats[i];
      if (t && m.map !== t) {
        m.map = t;
        m.color.set("#8fcbaa"); // dimmed below the end light — screens are chorus, not hero
        m.needsUpdate = true;
      }
    }
    // frames breathe faintly — the corridor feels powered-on
    frameMat.opacity = 0.38 + 0.08 * Math.sin(time * 1.4);

    // Minority-Report drift + proximity push. All offsets are FROM memoized
    // bases (PANELS) — nothing accumulates, so scrubbing is reversible.
    const camZ = state.camera.position.z;
    for (let i = 0; i < PANELS.length; i++) {
      const g = panelRefs.current[i];
      if (!g) continue;
      const p = PANELS[i];
      const ph = phases[i];
      // target is pure f(camZ) = f(scroll); easing converges deterministically
      const prox = clamp(1 - Math.abs(p.pos[2] - camZ) / PROX_RANGE, 0, 1);
      proxSm.current[i] += (prox - proxSm.current[i]) * PUSH_EASE;
      const ps = proxSm.current[i];
      const dx = Math.cos(time * 0.4 + ph * 2) * DRIFT_X;
      const dy = Math.sin(time * 0.5 + ph) * DRIFT_Y;
      const wob = Math.sin(time * 1.9 + ph * 3) * WOBBLE; // ~0.3Hz roll wobble
      const onXWall = p.pos[0] !== 0;
      if (onXWall) {
        // side panel: ease outward along x, tilt further on its y hinge
        g.position.set(p.pos[0] + dx + Math.sign(p.pos[0]) * ps * PUSH_X, p.pos[1] + dy, p.pos[2]);
        g.rotation.set(p.rot[0], p.rot[1] + Math.sign(p.rot[1]) * ps * TILT_AWAY, p.rot[2] + wob);
      } else {
        // ceiling/floor panel: ease outward along y, tilt further on its x hinge
        g.position.set(p.pos[0] + dx, p.pos[1] + dy + Math.sign(p.pos[1]) * ps * PUSH_Y, p.pos[2]);
        g.rotation.set(p.rot[0] + Math.sign(p.rot[0]) * ps * TILT_AWAY, p.rot[1], p.rot[2] + wob);
      }
    }
  });
  return (
    <group>
      {PANELS.map((p, i) => (
        <group
          key={i}
          ref={(el) => {
            panelRefs.current[i] = el;
          }}
          position={p.pos}
          rotation={p.rot}
        >
          <mesh geometry={plane} material={mats[p.tex]} />
          {/* tiny z lift keeps the frame from fighting the plane */}
          <lineSegments geometry={edges} material={frameMat} position={[0, 0, 0.01]} />
        </group>
      ))}
    </group>
  );
}

// --- warp speed-lines: one LineSegments draw call ------------------------------
const LINE_N = 340;
const LINE_LEN = 1.6;
const WRAP = 70; // z window around the camera the lines recycle through
function SpeedLines() {
  const { geo, mat, x, y, base, speed, par } = useMemo(() => {
    const rnd = mulberry32(4242);
    const x = new Float32Array(LINE_N);
    const y = new Float32Array(LINE_N);
    const base = new Float32Array(LINE_N);
    const speed = new Float32Array(LINE_N);
    const par = new Float32Array(LINE_N);
    const pos = new Float32Array(LINE_N * 6);
    for (let i = 0; i < LINE_N; i++) {
      const ang = rnd() * Math.PI * 2;
      const rad = 2 + rnd() * 6; // ring around the flight path, clear of the lens
      x[i] = Math.cos(ang) * rad;
      y[i] = Math.sin(ang) * rad;
      base[i] = rnd() * WRAP;
      speed[i] = 0.55 + rnd() * 0.9;
      par[i] = 0.35 + rnd() * 0.65; // fraction of camera motion felt as streak
      pos[i * 6] = x[i];
      pos[i * 6 + 1] = y[i];
      pos[i * 6 + 3] = x[i];
      pos[i * 6 + 4] = y[i];
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({
      color: "#baffdd",
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    return { geo, mat, x, y, base, speed, par };
  }, []);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const camZ = camZAt(cinemaClock.progress);
    const arr = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < LINE_N; i++) {
      // phase wraps inside a WRAP-long band riding the camera: time gives the
      // constant warp flow, -camZ*par adds the camera's own motion (parallax)
      let ph = (base[i] + time * speed[i] * 8 - camZ * par[i]) % WRAP;
      if (ph < 0) ph += WRAP;
      const z = camZ - 60 + ph; // 60 ahead of the lens, 10 behind
      arr[i * 6 + 2] = z + LINE_LEN;
      arr[i * 6 + 5] = z;
    }
    geo.attributes.position.needsUpdate = true;
    // scroll harder → the warp burns brighter
    mat.opacity = 0.25 + cinemaClock.vel * 0.5;
  });
  return <lineSegments geometry={geo} material={mat} frustumCulled={false} />;
}

// The blinding destination: grows and brightens as t→1, so the layer's fade-out
// hands off mid-whiteout to the regime act. fog:false — its ramp is authored.
function EndLight() {
  const ref = useRef<THREE.Sprite>(null);
  const mat = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTexture(),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false, // blooms HARD by design
        fog: false,
      }),
    []
  );
  useFrame(() => {
    const t = diveT(cinemaClock.progress);
    const s = ref.current;
    if (!s) return;
    const sc = lerp(8, 26, t);
    s.scale.set(sc, sc, 1);
    mat.opacity = 0.5 + 0.5 * t;
  });
  return <sprite ref={ref} material={mat} position={[0, 0, -62]} scale={[8, 8, 1]} />;
}

// Ambient dust drifting in the corridor — cheap group-level drift, no per-point work.
function Dust() {
  const ref = useRef<THREE.Points>(null);
  const base = useMemo(() => {
    const rnd = mulberry32(913);
    const a = new Float32Array(150 * 3);
    for (let i = 0; i < 150; i++) {
      a[i * 3] = (rnd() - 0.5) * 10;
      a[i * 3 + 1] = (rnd() - 0.5) * 7;
      a[i * 3 + 2] = -2 - rnd() * 56;
    }
    return a;
  }, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = ref.current;
    if (!g) return;
    g.position.x = Math.sin(t * 0.21) * 0.5;
    g.position.y = Math.sin(t * 0.34 + 1.7) * 0.35;
    (g.material as THREE.PointsMaterial).opacity = 0.24 + 0.1 * Math.sin(t * 0.7);
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[base, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#8fffc9"
        size={0.05}
        sizeAttenuation
        map={dotTexture()}
        transparent
        opacity={0.24}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// Camera: pure-scroll flythrough + damped pointer steering + ambient roll +
// velocity/rush FOV. No lookAt — the lens stays down-corridor, roll is authored.
function Rig() {
  const pxs = useRef(0);
  const pys = useRef(0);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const t = diveT(cinemaClock.progress);
    pxs.current += (cinemaClock.px - pxs.current) * 0.05;
    pys.current += (cinemaClock.py - pys.current) * 0.05;
    const cam = state.camera as THREE.PerspectiveCamera;
    cam.position.set(pxs.current * 1.6, -pys.current * 1.0, camZAt(cinemaClock.progress));
    cam.rotation.set(0, 0, Math.sin(time * 0.4) * 0.03 + pxs.current * 0.06);
    // rush peaks mid-tunnel (sin hump) and scroll speed stretches the world
    const targetFov = 58 + cinemaClock.vel * 14 + 10 * Math.sin(t * Math.PI);
    if (Math.abs(cam.fov - targetFov) > 0.01) {
      cam.fov += (targetFov - cam.fov) * 0.1;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

export default function Tunnel3D({
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
      camera={{ fov: 58, position: [0, 0, CAM_Z0], near: 0.1, far: 160 }}
      onCreated={() => onReady?.()}
      fallback={null}
    >
      <color attach="background" args={["#050505"]} />
      {/* fog swallows the far corridor — panels resolve as you fly into them */}
      <fog attach="fog" args={["#050505", 6, 80]} />

      <Corridor />
      <SpeedLines />
      <EndLight />
      <Dust />
      <Rig />

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.4} luminanceSmoothing={0.3} intensity={1.0} />
        <ChromaticAberration offset={[0.0006, 0.001]} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}

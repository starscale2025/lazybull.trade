"use client";

// Targeted real-3D "hero moment": the signature candle act (progress ~0.32–0.56)
// as a canyon of 3D candlesticks the camera flies along — green candles climbing
// into a peak, then red candles collapsing into a crash, with a translucent AI
// probability cone that bracketed the drop. Candles print in live with a glowing
// print-head, reflected in a black-glass floor, with drifting dust and a weighted,
// cursor-reactive camera. Reads the shared cinemaClock in useFrame (one-clock
// rule). Crossfaded over the 2D scene by ScrollCinema.

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, ChromaticAberration, SMAA } from "@react-three/postprocessing";
import { Grid, Line, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";
import { cinemaClock } from "@/lib/cinema-clock";
import { CANDLE3D } from "@/lib/cinema";

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
// a live market ticking in. Completes a touch before the layer fades out.
const buildAt = (progress: number) =>
  clamp((progress - CANDLE3D.in0) / (CANDLE3D.out0 - CANDLE3D.in0), 0, 1);
const revealF = (progress: number) => clamp(buildAt(progress) / 0.9, 0, 1) * N;

function Candles() {
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const green = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#052a1b",
        emissive: new THREE.Color("#00ff87"),
        emissiveIntensity: 0.9,
        roughness: 0.3,
        metalness: 0.1,
      }),
    []
  );
  const red = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2e0a15",
        emissive: new THREE.Color("#ff2e63"),
        emissiveIntensity: 1.2,
        roughness: 0.3,
        metalness: 0.1,
      }),
    []
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const rf = revealF(cinemaClock.progress);
    for (let i = 0; i < N; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const grow = clamp(rf - i, 0, 1); // 0 until the print reaches this candle
      g.visible = grow > 0.001;
      const e = 1 - (1 - grow) * (1 - grow); // easeOut → candle snaps in, then settles
      g.scale.set(1, e, 1);
    }
    // the whole ridge breathes faintly — alive even between scrolls
    green.emissiveIntensity = 0.9 + 0.1 * Math.sin(time * 1.15);
    red.emissiveIntensity = 1.2 + 0.14 * Math.sin(time * 1.5 + 2);
  });
  return (
    <group>
      {CANDLES.map((c, i) => {
        const m = c.up ? green : red;
        // Body + wick are both centered on the close level, so scaling the parent
        // group's Y grows the whole candle in place.
        return (
          <group
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            position={[c.x, c.cy, 0]}
            scale={[1, 0, 1]}
          >
            <mesh geometry={box} material={m} scale={[0.72, c.h, 0.72]} />
            <mesh geometry={box} material={m} scale={[0.11, c.wh - c.wl, 0.11]} />
          </group>
        );
      })}
    </group>
  );
}

// The live print-head: a hot orb riding the newest candle, a point light that
// flashes the neighbourhood on every print, and a shockwave ring expanding
// across the glass floor beneath it — the "market ticking in" made physical.
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
    if (orb.current) {
      orb.current.visible = on;
      orb.current.position.set(x, y, 0);
      orb.current.scale.setScalar(0.09 + 0.15 * flash);
    }
    if (light.current) {
      light.current.visible = on;
      light.current.position.set(x, y + 0.5, 1.4);
      light.current.intensity = 3 + 30 * flash;
    }
    if (ring.current) {
      ring.current.visible = on;
      // pulse AT the printing candle (XY plane faces the camera), not on the floor
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

// Drifting particulate — three counter-drifting clouds (near green, far cyan)
// fill the air so no frame is ever empty.
function Dust({
  seed,
  count,
  area,
  center,
  color,
  size,
  speed,
}: {
  seed: number;
  count: number;
  area: [number, number, number];
  center: [number, number, number];
  color: string;
  size: number;
  speed: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const rnd = mulberry32(seed);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = center[0] + (rnd() - 0.5) * area[0];
      arr[i * 3 + 1] = center[1] + (rnd() - 0.5) * area[1];
      arr[i * 3 + 2] = center[2] + (rnd() - 0.5) * area[2];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const g = ref.current;
    if (!g) return;
    g.position.x = Math.sin(t * speed) * 1.4;
    g.position.y = Math.sin(t * speed * 0.63 + seed) * 0.5;
    (g.material as THREE.PointsMaterial).opacity = 0.2 + 0.12 * Math.sin(t * 0.8 + seed);
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={color}
        size={size}
        sizeAttenuation
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
    // The forecast draws in as price diverges from the AI's call (the crash) —
    // the prediction appears just before reality falls into it.
    const reveal = smooth(0.5, 0.82, buildAt(cinemaClock.progress));
    const cm = coneRef.current?.material as THREE.MeshBasicMaterial | undefined;
    if (cm) cm.opacity = 0.19 * reveal;
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
  const pxs = useRef(0);
  const pys = useRef(0);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    // damped pointer → parallax with weight
    pxs.current += (cinemaClock.px - pxs.current) * 0.05;
    pys.current += (cinemaClock.py - pys.current) * 0.05;
    const build = buildAt(cinemaClock.progress);
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
    const pull = smooth(0.78, 1.0, build);
    tmpP.current.set(
      lerp(edgeX - 7, SPAN * 0.5, pull) + pxs.current * 1.1 + Math.sin(time * 0.33) * 0.18,
      lerp(trendY + 4.5, PEAK_Y * 0.5 + 9, pull) - pys.current * 0.65 + Math.sin(time * 0.47) * 0.14,
      lerp(11, 16.5, pull) + Math.cos(time * 0.29) * 0.16
    );
    tmpL.current.set(
      lerp(edgeX - 1.5, SPAN * 0.72, pull) + pxs.current * 0.5,
      lerp(trendY, 3, pull) - pys.current * 0.3,
      0
    );
    // inertia: the camera trails its target — motion has mass
    pos.current.lerp(tmpP.current, 0.09);
    look.current.lerp(tmpL.current, 0.09);
    state.camera.position.copy(pos.current);
    state.camera.lookAt(look.current);
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

      <Candles />
      <PrintHead />
      <AIForecast />
      <Dust seed={11} count={420} area={[70, 16, 26]} center={[SPAN / 2, 7, 2]} color="#57ffb0" size={0.055} speed={0.11} />
      <Dust seed={23} count={320} area={[80, 20, 34]} center={[SPAN / 2, 9, -6]} color="#28d7ff" size={0.045} speed={0.07} />
      <Dust seed={37} count={260} area={[60, 10, 18]} center={[SPAN / 2, 2.5, 5]} color="#9dffcf" size={0.04} speed={0.16} />

      {/* black-glass floor: the glowing ridge reflects in it (the “wet look”) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[SPAN / 2, -0.54, 0]}>
        <planeGeometry args={[SPAN * 3, 90]} />
        <MeshReflectorMaterial
          blur={[320, 90]}
          resolution={1024}
          mixBlur={0.85}
          mixStrength={2.6}
          roughness={0.72}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#050806"
          metalness={0.55}
          mirror={0.72}
        />
      </mesh>
      {/* faint grid floats on the glass */}
      <Grid
        position={[SPAN / 2, -0.5, 0]}
        args={[SPAN * 2.5, 60]}
        cellSize={1.05}
        cellThickness={0.6}
        cellColor="#0c3524"
        sectionSize={SP * 6}
        sectionThickness={1}
        sectionColor="#0e5c3a"
        fadeDistance={70}
        fadeStrength={2}
        infiniteGrid
      />

      <Rig />

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={0.35} luminanceSmoothing={0.3} intensity={0.95} />
        <ChromaticAberration offset={[0.0005, 0.0009]} />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}

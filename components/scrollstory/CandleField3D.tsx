"use client";

// The signature candle act (progress ~0.32–0.56) as a LIVE INSTRUMENT: candles
// print in as you scroll with a glowing print-head; hovering a candle flares it
// and surfaces a live price tag; the drifting dust is repelled by your cursor;
// clicking fires a shockwave through the field; the camera orbits with your
// pointer (with inertia) and kicks its FOV when you scroll hard. All state flows
// through cinemaClock (one-clock rule). Crossfaded over the 2D scene by
// ScrollCinema.

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

function Candles() {
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ visible: false }), []);
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
  const flareLight = useRef<THREE.PointLight>(null);
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const rf = revealF(cinemaClock.progress);
    for (let i = 0; i < N; i++) {
      const g = refs.current[i];
      if (!g) continue;
      const grow = clamp(rf - i, 0, 1); // 0 until the print reaches this candle
      g.visible = grow > 0.001;
      const e = 1 - (1 - grow) * (1 - grow); // easeOut → candle snaps in, then settles
      const f = i === FLARE.idx ? FLARE.amt : 0;
      g.scale.set(1 + 0.14 * f, e * (1 + 0.05 * f), 1 + 0.14 * f);
    }
    // the whole ridge breathes faintly — alive even between scrolls
    green.emissiveIntensity = 0.9 + 0.1 * Math.sin(time * 1.15);
    red.emissiveIntensity = 1.2 + 0.14 * Math.sin(time * 1.5 + 2);
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
    (g.material as THREE.PointsMaterial).opacity = 0.22 + 0.12 * Math.sin(t * 0.8 + seed);
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
    const pull = smooth(0.78, 1.0, build);
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
      <CrashShards />
      <PrintHead />
      <ClickFX />
      <AIForecast />
      {/* z-ranges stay well in front of the camera (z≈11+) — no giant near-plane dots */}
      <Dust seed={11} count={420} area={[70, 16, 14]} center={[SPAN / 2, 7, 0]} color="#57ffb0" size={0.055} speed={0.11} react={1} />
      <Dust seed={23} count={320} area={[80, 20, 16]} center={[SPAN / 2, 9, -4]} color="#28d7ff" size={0.045} speed={0.07} react={0.5} />
      <Dust seed={37} count={260} area={[60, 10, 10]} center={[SPAN / 2, 2.5, 1]} color="#9dffcf" size={0.04} speed={0.16} react={1.3} />

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

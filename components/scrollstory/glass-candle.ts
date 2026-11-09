import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";

/**
 * THE GLASS (2026-11-09). A candle is a cut crystal bar with a filament of
 * light down its axis, and this traces the light through it per pixel: into
 * the top surface, around the inside by total internal reflection, and out of
 * whichever face lets it go. Colour comes from how far a ray travelled through
 * the glass (Beer's law), so thin edges run pale and deep sections go rich, and
 * dispersion splits the exit ray into its colours.
 *
 * The bar is a convex solid: a list of planes. That is what makes this cheap. A
 * ray inside a convex solid leaves through the nearest plane in front of it, so
 * there is no mesh to search and no second render of the scene behind it. The
 * mesh drawn on screen is built from the same planes, and every candle shares
 * it: each plane either runs parallel to the height or belongs to one end of
 * the bar, so a taller candle only moves the two ends apart.
 */

/** The height the shared geometry is built at; a candle's own height moves its ends from here. */
export const CUT_H0 = 0.5;
/** How tall the cut ends are; a candle may not get shorter than this. */
export const CUT_CROWN = 0.052;
const HALF_WIDTH = 0.3;
const CORNER = 0.08;
const CROWN_TILT = (50 * Math.PI) / 180;

type Plane = { n: THREE.Vector3; d: number };

function cutPlanes(): Plane[] {
  const sides: { th: number; s: number }[] = [];
  for (let q = 0; q < 4; q++) {
    const base = (q * Math.PI) / 2;
    sides.push({ th: base, s: HALF_WIDTH });
    for (const deg of [22.5, 45, 67.5]) {
      const k = (deg * Math.PI) / 180;
      sides.push({ th: base + k, s: (HALF_WIDTH - CORNER) * (Math.cos(k) + Math.sin(k)) + CORNER });
    }
  }
  const planes: Plane[] = [];
  for (const { th, s } of sides) planes.push({ n: new THREE.Vector3(Math.cos(th), 0, Math.sin(th)), d: s });
  planes.push({ n: new THREE.Vector3(0, 1, 0), d: CUT_H0 }, { n: new THREE.Vector3(0, -1, 0), d: CUT_H0 });
  const st = Math.sin(CROWN_TILT);
  const ct = Math.cos(CROWN_TILT);
  for (const y of [1, -1]) {
    for (const { th, s } of sides) {
      planes.push({
        n: new THREE.Vector3(Math.cos(th) * st, y * ct, Math.sin(th) * st),
        d: st * s + ct * (CUT_H0 - CUT_CROWN),
      });
    }
  }
  return planes;
}

/** The corners of the solid: wherever three planes meet inside all the others. */
function cornersOf(planes: Plane[]): THREE.Vector3[] {
  const found = new Map<string, THREE.Vector3>();
  const m = new THREE.Matrix3();
  const inv = new THREE.Matrix3();
  const p = new THREE.Vector3();
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      for (let k = j + 1; k < planes.length; k++) {
        const [a, b, c] = [planes[i], planes[j], planes[k]];
        m.set(a.n.x, a.n.y, a.n.z, b.n.x, b.n.y, b.n.z, c.n.x, c.n.y, c.n.z);
        if (Math.abs(m.determinant()) < 1e-6) continue;
        inv.copy(m).invert();
        p.set(a.d, b.d, c.d).applyMatrix3(inv);
        if (planes.some((q) => q.n.dot(p) > q.d + 1e-6)) continue;
        const key = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;
        if (!found.has(key)) found.set(key, p.clone());
      }
    }
  }
  return [...found.values()];
}

export type CrystalCut = {
  geometry: THREE.BufferGeometry;
  normals: THREE.Vector3[];
  offsets: number[];
  /** How far each plane moves when the bar's half-height changes. */
  lifts: number[];
  count: number;
};

export function crystalCut(): CrystalCut {
  const planes = cutPlanes();
  return {
    geometry: new ConvexGeometry(cornersOf(planes)),
    normals: planes.map((p) => p.n),
    offsets: planes.map((p) => p.d),
    lifts: planes.map((p) => Math.abs(p.n.y) > 1e-4 ? Math.abs(p.n.y) : 0),
    count: planes.length,
  };
}

/**
 * The room, as the glass sees it: a dark studio with a few long softboxes. A
 * function rather than a texture, so a highlight stays razor sharp however
 * close the camera gets. `uSweep` turns the lights a little with the scroll,
 * which is what sets the facets flashing as the chart moves past them.
 */
export const STUDIO = /* glsl */ `
  uniform float uSweep;
  float softbox(vec3 d, vec3 L, vec3 U, vec3 V, vec2 hs, float edge) {
    float c = dot(d, L);
    if (c <= 0.0) return 0.0;
    vec3 p = d / c;
    return smoothstep(hs.x, hs.x - edge, abs(dot(p, U))) * smoothstep(hs.y, hs.y - edge, abs(dot(p, V)));
  }
  vec3 studio(vec3 dir) {
    float c = cos(uSweep), s = sin(uSweep);
    vec3 d = vec3(c * dir.x - s * dir.z, dir.y, s * dir.x + c * dir.z);
    // the room itself: nearly black, a little lift overhead and behind
    vec3 col = mix(vec3(0.003, 0.0035, 0.005), vec3(0.018, 0.021, 0.03), smoothstep(-0.2, 1.0, d.y));
    col += vec3(0.012, 0.016, 0.03) * smoothstep(0.1, 0.95, -d.z);
    // overhead bank
    col += vec3(1.7, 1.8, 2.0) * softbox(d, vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), vec2(1.5, 0.42), 0.3);
    // the long strip behind, for the rim along every top edge
    col += vec3(11.0, 12.0, 14.0) * softbox(d, normalize(vec3(0.0, 0.42, -1.0)), vec3(1.0, 0.0, 0.0), normalize(vec3(0.0, 1.0, 0.42)), vec2(2.4, 0.075), 0.03);
    // tall strips either side
    col += vec3(13.0, 13.0, 15.0) * softbox(d, normalize(vec3(-1.0, 0.12, 0.42)), vec3(0.0, 1.0, 0.0), normalize(vec3(0.42, 0.0, 1.0)), vec2(1.9, 0.06), 0.025);
    col += vec3(8.0, 8.6, 11.0) * softbox(d, normalize(vec3(1.0, 0.2, 0.55)), vec3(0.0, 1.0, 0.0), normalize(vec3(-0.55, 0.0, 1.0)), vec2(1.5, 0.1), 0.04);
    // a low strip in front, the horizontal line of light across the faces
    col += vec3(1.2, 1.3, 1.6) * softbox(d, normalize(vec3(0.0, -0.3, 1.0)), vec3(1.0, 0.0, 0.0), normalize(vec3(0.0, 1.0, 0.3)), vec2(2.2, 0.03), 0.02);
    return col;
  }
`;

export const GLASS_VERT = /* glsl */ `
  uniform float uReveal;
  uniform float uH0;
  uniform float uCrown;
  attribute vec3 aCenter;
  attribute float aHalfY;
  attribute float aUp;
  attribute float aIndex;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vHalfY;
  varying float vUp;
  varying float vIndex;
  void main() {
    float grow = clamp(uReveal - aIndex, 0.0, 1.0);
    if (grow <= 0.0005) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    // easeOutBack: it overshoots a little and settles, as if it had weight
    float b = grow - 1.0;
    float e = 1.0 + 2.70158 * b * b * b + 1.70158 * b * b;
    float hy = max(aHalfY * e, uCrown * 1.3);
    float s = smoothstep(0.0, 0.18, grow);
    vec3 local = position;
    local.y += sign(local.y) * (hy - uH0);
    vLocal = local;
    vHalfY = hy;
    vUp = aUp;
    vIndex = aIndex;
    vN = normal;
    vWorld = aCenter + local * vec3(s, 1.0, s);
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

export function glassFrag(planes: number) {
  return /* glsl */ `
  #define K ${planes}
  precision highp float;
  uniform vec3 uN[K];
  uniform float uD[K];
  uniform float uLift[K];
  uniform float uH0;
  uniform float uFlareIdx;
  uniform float uFlare;
  uniform float uHeat;
  uniform vec3 uLightPos;
  uniform vec3 uLightCol;
  uniform vec2 uFog;
  varying vec3 vLocal;
  varying vec3 vWorld;
  varying vec3 vN;
  varying float vHalfY;
  varying float vUp;
  varying float vIndex;
  ${STUDIO}

  const float IOR = 1.52;
  const int BOUNCES = 4;

  // Where a ray inside the bar next reaches its surface, and which face that is.
  float exitT(vec3 o, vec3 d, out vec3 hit) {
    float best = 1e6;
    hit = vec3(0.0, 1.0, 0.0);
    for (int i = 0; i < K; i++) {
      float den = dot(uN[i], d);
      if (den > 1e-5) {
        float t = (uD[i] + uLift[i] * (vHalfY - uH0) - dot(uN[i], o)) / den;
        if (t < best) { best = t; hit = uN[i]; }
      }
    }
    return max(best, 0.0);
  }

  float schlick(float c, float f0) {
    float m = clamp(1.0 - c, 0.0, 1.0);
    float m2 = m * m;
    return f0 + (1.0 - f0) * m2 * m2 * m;
  }

  // The light the filament puts into one straight run through the glass: a hot
  // thread down the axis in a soft sheath of its own light.
  float filament(vec3 p, vec3 d, float t) {
    float sum = 0.0;
    float ds = t / 6.0;
    for (int i = 0; i < 6; i++) {
      vec3 q = p + d * (ds * (float(i) + 0.5));
      float r2 = dot(q.xz, q.xz);
      float along = smoothstep(vHalfY - 0.02, vHalfY - 0.16, abs(q.y));
      sum += along * (exp(-r2 / 0.0008) * 18.0 + exp(-r2 / 0.02) * 0.42);
    }
    return sum * ds;
  }

  void main() {
    vec3 N = normalize(vN);
    vec3 rd = normalize(vWorld - cameraPosition);
    vec3 absorb = mix(vec3(0.05, 4.2, 2.5), vec3(5.0, 0.06, 1.8), vUp);
    vec3 heartCol = mix(vec3(1.0, 0.16, 0.34), vec3(0.3, 1.0, 0.62), vUp);
    float flare = abs(vIndex - uFlareIdx) < 0.5 ? uFlare : 0.0;
    float heart = (1.0 + 1.4 * flare) * (1.0 + 0.5 * uHeat);

    float cosI = max(-dot(rd, N), 0.0);
    float F = schlick(cosI, 0.043);
    vec3 surface = studio(reflect(rd, N));
    // a point of the moving light on the surface itself
    vec3 toL = normalize(uLightPos - vWorld);
    surface += uLightCol * pow(max(dot(N, normalize(toL - rd)), 0.0), 220.0) * 14.0;

    vec3 p = vLocal + N * -0.0008;
    vec3 dir = refract(rd, N, 1.0 / IOR);
    vec3 T = vec3(1.0);
    vec3 inner = vec3(0.0);
    for (int b = 0; b < BOUNCES; b++) {
      vec3 n;
      float t = exitT(p, dir, n);
      inner += T * heartCol * filament(p, dir, t) * heart;
      // a whisper of body colour, as dust and flaws in the glass scatter it
      inner += T * heartCol * t * 0.005;
      T *= exp(-absorb * t);
      vec3 q = p + dir * t;
      float c = dot(dir, n);
      vec3 outward = refract(dir, -n, IOR);
      if (dot(outward, outward) > 1e-6) {
        float fr = schlick(c > 0.0 ? sqrt(max(1.0 - IOR * IOR * (1.0 - c * c), 0.0)) : 0.0, 0.043);
        vec3 seen;
        if (b == 0) {
          // the colours part on the way out of the first face
          vec3 oR = refract(dir, -n, IOR * 0.984);
          vec3 oB = refract(dir, -n, IOR * 1.016);
          seen = vec3(
            studio(dot(oR, oR) > 1e-6 ? oR : outward).r,
            studio(outward).g,
            studio(dot(oB, oB) > 1e-6 ? oB : outward).b
          );
        } else {
          seen = studio(outward);
        }
        inner += T * (1.0 - fr) * seen;
        T *= fr;
      }
      dir = reflect(dir, n);
      p = q - n * 0.0008;
    }

    vec3 col = surface * F + inner * (1.0 - F);
    float dist = length(vWorld - cameraPosition);
    float fog = smoothstep(uFog.x, uFog.y, dist);
    col = mix(col, vec3(0.0015, 0.0015, 0.0015), fog);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;
}

/** The wick: the same filament where it runs out of the bar, in a thin sleeve. */
export const WICK_VERT = /* glsl */ `
  uniform float uReveal;
  attribute vec3 aCenter;
  attribute float aHalfY;
  attribute float aUp;
  attribute float aIndex;
  varying float vUp;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vTip;
  void main() {
    float grow = clamp(uReveal - aIndex, 0.0, 1.0);
    if (grow <= 0.0005) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    float b = grow - 1.0;
    float e = 1.0 + 2.70158 * b * b * b + 1.70158 * b * b;
    vUp = aUp;
    vN = normal;
    vTip = abs(position.y) * 2.0;
    vWorld = aCenter + position * vec3(1.0, aHalfY * 2.0 * e, 1.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

export const WICK_FRAG = /* glsl */ `
  uniform vec2 uFog;
  varying float vUp;
  varying vec3 vN;
  varying vec3 vWorld;
  varying float vTip;
  void main() {
    vec3 hot = mix(vec3(1.0, 0.16, 0.34), vec3(0.3, 1.0, 0.62), vUp);
    vec3 rd = normalize(vWorld - cameraPosition);
    // brightest down the middle of the thread, and spent by the time it
    // reaches the tip: the filament running out of the bar and dying away
    float core = pow(clamp(-dot(rd, normalize(vN)), 0.0, 1.0), 2.0);
    vec3 col = hot * (0.12 + 1.15 * core) * mix(1.25, 0.12, smoothstep(0.1, 1.0, vTip));
    col = mix(col, vec3(0.0015), smoothstep(uFog.x, uFog.y, length(vWorld - cameraPosition)));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/**
 * The air behind the chart: a slow smoke on a far plane, lit from behind the
 * printing edge and tinted by what is being printed, with soft shafts falling
 * through it from high up. One full-frame quad, dithered so the long dark
 * gradients do not band.
 */
export const AIR_VERT = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.9999, 1.0);
  }
`;

export const AIR_FRAG = /* glsl */ `
  precision highp float;
  uniform mat4 uInvView;
  uniform mat4 uInvProj;
  uniform vec3 uHead;
  uniform vec3 uTint;
  uniform float uTime;
  uniform float uOn;
  uniform sampler2D uNoise;
  varying vec2 vNdc;

  void main() {
    vec4 v = uInvProj * vec4(vNdc, 1.0, 1.0);
    vec3 dir = normalize(mat3(uInvView) * (v.xyz / v.w));
    vec3 cam = uInvView[3].xyz;
    float t = (-14.0 - cam.z) / min(dir.z, -0.05);
    vec3 w = cam + dir * t;

    // Two sheets of baked noise sliding past each other: smoke for three
    // texture reads, where computing it per pixel cost the act its frame time.
    float s = texture2D(uNoise, w.xy * 0.021 + vec2(uTime * 0.004, 0.0)).r;
    s = mix(s, texture2D(uNoise, w.xy * 0.047 - vec2(0.0, uTime * 0.006)).r, 0.45);
    vec2 toHead = (w.xy - uHead.xy) / vec2(15.0, 10.0);
    float pool = exp(-dot(toHead, toHead) * 1.6);

    // shafts fanning down from a window high above and behind the edge
    vec2 from = w.xy - (uHead.xy + vec2(-9.0, 26.0));
    float ang = atan(from.x, -from.y);
    float shaft = texture2D(uNoise, vec2(ang * 0.62, uTime * 0.0025)).r;
    shaft = smoothstep(0.5, 0.74, shaft) * exp(-dot(from, from) / 2200.0);

    vec3 col = uTint * pool * pool * (0.0016 + 0.03 * s * s * 4.0);
    col += vec3(0.62, 0.72, 1.0) * shaft * (0.0012 + 0.022 * s) * uOn;
    col += vec3(0.0015);
    // dither: a long dark gradient bands in eight bits without it
    float n = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    col += (n - 0.5) * 0.0012;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** A tiling sheet of soft noise, for the air. */
export function airNoise(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size);
  let state = 0x5bd1e995;
  const rnd = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const octaves = [4, 8, 16, 32].map((n) => ({ n, g: Array.from({ length: n * n }, rnd) }));
  const smooth = (x: number) => x * x * (3 - 2 * x);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sum = 0;
      let amp = 0.5;
      let total = 0;
      for (const { n, g } of octaves) {
        const fx = (x / size) * n;
        const fy = (y / size) * n;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const u = smooth(fx - ix);
        const v = smooth(fy - iy);
        const at = (a: number, b: number) => g[((b + n) % n) * n + ((a + n) % n)];
        sum += amp * (at(ix, iy) * (1 - u) * (1 - v) + at(ix + 1, iy) * u * (1 - v) + at(ix, iy + 1) * (1 - u) * v + at(ix + 1, iy + 1) * u * v);
        total += amp;
        amp *= 0.5;
      }
      data[y * size + x] = Math.round((sum / total) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Mirror images of the bars, under the floor: bright where they stand close to it. */
export const MIRROR_VERT = /* glsl */ `
  uniform float uReveal;
  uniform float uH0;
  uniform float uCrown;
  uniform float uFloorY;
  attribute vec3 aCenter;
  attribute float aHalfY;
  attribute float aUp;
  attribute float aIndex;
  varying float vUp;
  varying float vHeight;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying float vHalfY;
  void main() {
    float grow = clamp(uReveal - aIndex, 0.0, 1.0);
    if (grow <= 0.0005) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    float b = grow - 1.0;
    float e = 1.0 + 2.70158 * b * b * b + 1.70158 * b * b;
    float hy = max(aHalfY * e, uCrown * 1.3);
    vec3 local = position;
    local.y += sign(local.y) * (hy - uH0);
    vec3 world = aCenter + local;
    vHeight = world.y - uFloorY;
    vLocal = local;
    vHalfY = hy;
    vUp = aUp;
    world.y = 2.0 * uFloorY - world.y;
    vWorld = world;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

export const MIRROR_FRAG = /* glsl */ `
  uniform vec2 uFog;
  varying float vUp;
  varying float vHeight;
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying float vHalfY;
  void main() {
    vec3 hot = mix(vec3(1.0, 0.16, 0.34), vec3(0.3, 1.0, 0.62), vUp);
    float r2 = dot(vLocal.xz, vLocal.xz);
    float glow = 0.1 + 1.6 * exp(-r2 / 0.012);
    vec3 col = hot * glow * exp(-vHeight * 0.34);
    col = mix(col, vec3(0.0015), smoothstep(uFog.x, uFog.y, length(vWorld - cameraPosition)));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

/** The floor: black glass, a sheen of the studio in it, and the pool of the working light. */
export const FLOOR_VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

export const FLOOR_FRAG = /* glsl */ `
  uniform vec3 uHead;
  uniform vec3 uTint;
  uniform vec2 uFog;
  varying vec3 vWorld;
  void main() {
    vec3 rd = normalize(vWorld - cameraPosition);
    float c = max(-rd.y, 0.0);
    float m = 1.0 - c;
    float F = 0.04 + 0.96 * m * m * m * m * m;
    // A broad sheen low on the horizon, not the strip lights themselves: at
    // this angle black glass shows them as hard white bands.
    vec3 R = reflect(rd, vec3(0.0, 1.0, 0.0));
    float band = exp(-pow((R.y - 0.16) * 4.0, 2.0)) * smoothstep(-0.2, 0.5, -R.z);
    vec3 sheen = vec3(0.42, 0.48, 0.66) * band * F * 0.1;
    vec2 d = (vWorld.xz - vec2(uHead.x, 0.0)) / vec2(8.0, 6.0);
    sheen += uTint * exp(-dot(d, d)) * 0.012;
    float fade = 1.0 - smoothstep(uFog.x, uFog.y, length(vWorld - cameraPosition));
    gl_FragColor = vec4(sheen * fade, 0.78 * fade + 0.0);
    #include <colorspace_fragment>
  }
`;

/**
 * The glass that comes off in the crash: a few slivers per falling bar, thrown
 * down and outward, tumbling, catching the strip lights. Every position is a
 * function of the print head, so scrubbing back puts them away again.
 */
export const SHARD_VERT = /* glsl */ `
  uniform float uReveal;
  attribute vec3 aOrigin;
  attribute vec3 aVel;
  attribute vec3 aAxis;
  attribute vec2 aParam;
  varying vec3 vN;
  varying vec3 vWorld;
  vec3 turn(vec3 v, vec3 k, float a) {
    float c = cos(a), s = sin(a);
    return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
  }
  void main() {
    float g = clamp((uReveal - aParam.x) / 3.2, 0.0, 1.0);
    if (g <= 0.012 || g >= 0.995) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    float s = 1.0 - (1.0 - g) * (1.0 - g);
    float ang = s * 8.0 + aParam.x * 2.3;
    float fade = 1.0 - smoothstep(0.72, 1.0, g);
    vec3 p = turn(position * vec3(0.55, 1.5, 0.22), aAxis, ang) * aParam.y * fade;
    vN = turn(normal, aAxis, ang);
    vWorld = aOrigin + aVel * s * 2.9 + vec3(0.0, -g * g * 3.4, 0.0) + p;
    gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
  }
`;

export const SHARD_FRAG = /* glsl */ `
  uniform vec2 uFog;
  varying vec3 vN;
  varying vec3 vWorld;
  ${STUDIO}
  void main() {
    vec3 rd = normalize(vWorld - cameraPosition);
    vec3 N = normalize(vN);
    if (dot(N, rd) > 0.0) N = -N;
    float c = max(-dot(rd, N), 0.0);
    float m = 1.0 - c;
    float F = 0.08 + 0.92 * m * m * m * m * m;
    vec3 col = studio(reflect(rd, N)) * F * 1.4;
    col += vec3(1.0, 0.16, 0.34) * (0.1 + 0.8 * pow(m, 2.0));
    col = mix(col, vec3(0.0015), smoothstep(uFog.x, uFog.y, length(vWorld - cameraPosition)));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

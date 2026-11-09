/**
 * THE MATTER's shaders (Phase 3, 2026-11-09). The sphere's are the hero's own
 * (they were tuned in the hero's first scene, retired into this engine: the
 * ramp by height, the rim that carries the light, the glow pass, the
 * dissolve under the copy), with two additions every shape shares:
 *
 *   uAssemble 0 → 1  the particles gather out of a scattered cloud when a
 *                    shape takes the stage, each on its own delay (aSeed).
 *   uInk      0 | 1  the light theme: drawn in deep inks with normal
 *                    blending, because additive light vanishes on paper.
 *
 * The ledger (M15) and the bull (M18) are new shapes on the same dots.
 */

// Ashima Arts' 3D simplex noise (MIT), as in the original.
export const NOISE = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`;

// The five-stop ramp, bottom to top.
export const RAMP = /* glsl */ `
  uniform vec3 uStop0;
  uniform vec3 uStop1;
  uniform vec3 uStop2;
  uniform vec3 uStop3;
  uniform vec3 uStop4;
  vec3 ramp(float h) {
    h = clamp(h, 0.0, 1.0) * 4.0;
    vec3 c = mix(uStop0, uStop1, smoothstep(0.0, 1.0, h));
    c = mix(c, uStop2, smoothstep(1.0, 2.0, h));
    c = mix(c, uStop3, smoothstep(2.0, 3.0, h));
    return mix(c, uStop4, smoothstep(3.0, 4.0, h));
  }
`;

// Where a point starts when a shape assembles: out along its own direction,
// a long way off. Shared so every shape gathers the same way.
const SCATTER = /* glsl */ `
  vec3 scatterDir(float s) {
    vec3 d = vec3(fract(s * 91.7) - 0.5, fract(s * 53.3) - 0.5, fract(s * 17.9) - 0.5);
    return normalize(d + vec3(1e-3));
  }
  float gathered(float s, float t) {
    // each point on its own delay, then a long settle
    float a = clamp((t - s * 0.45) / 0.55, 0.0, 1.0);
    return 1.0 - pow(1.0 - a, 3.0);
  }
`;

export const SPHERE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAgitation;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uGlow;
  uniform float uFadeLow;
  uniform float uFadeHigh;
  uniform float uRampBase;
  uniform float uAlpha;
  uniform float uAssemble;
  uniform float uDrain;
  uniform vec2 uSeam;
  uniform vec3 uLight;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  ${NOISE}
  ${RAMP}
  ${SCATTER}
  void main() {
    vec3 n = normalize(position);
    float speed = 0.45 + 0.9 * uAgitation;
    // Two octaves: the slow swell, and a finer chop riding on it.
    float d = snoise(position * 1.5 + uTime * speed);
    d += 0.38 * snoise(position * 3.4 - uTime * 0.55 * speed);
    vec3 p = position + n * d * (0.22 + 0.16 * uAgitation);

    vec4 world = modelMatrix * vec4(p, 1.0);

    // Height on screen, relative to the sphere's own centre and size, so the
    // ramp stays put while the shape turns.
    float scale = length(modelMatrix[1].xyz);
    float h = (world.y - modelMatrix[3].y) / (1.45 * scale) * 0.5 + 0.5;

    vec3 wn = normalize(mat3(modelMatrix) * n);
    vec3 toEye = normalize(cameraPosition - world.xyz);
    float nv = dot(wn, toEye);

    // Gathering out of the dust.
    float g = gathered(aSeed, uAssemble);
    world.xyz = mix(world.xyz + scatterDir(aSeed) * (3.0 + 4.0 * aSeed), world.xyz, g);

    // THE LIFT (M11): as the curtain rises the sphere drains, each point on
    // its own delay, down into the seam where the film opens (uSeam, the
    // bottom centre of the hero), narrowing as it goes. The glow pass trails
    // a little behind each point, so the drain reads as streaks.
    float dr = clamp(uDrain * 1.7 - aSeed * 0.7, 0.0, 1.0);
    float dd = dr * dr;
    vec3 sink = vec3(uSeam.x + (world.x - uSeam.x) * 0.1, uSeam.y, world.z * 0.35);
    world.xyz = mix(world.xyz, sink, dd);
    if (uGlow > 0.5) world.y += dr * (1.0 - dr) * 0.8;

    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;

    // The face turned towards you all but vanishes; the rim carries the light.
    float rim = pow(1.0 - abs(nv), 1.2);
    float lit = max(dot(wn, normalize(uLight - world.xyz)), 0.0);
    float front = nv > 0.0 ? 1.0 : 0.5;
    float twinkle = 0.82 + 0.18 * sin(uTime * 2.4 + aSeed * 61.0);
    // Dissolve into the copy: gone below the headline, whole above its middle.
    // The drain lifts the dissolve, or the streaks would vanish at the band.
    float fade = mix(smoothstep(uFadeLow, uFadeHigh, gl_Position.y / gl_Position.w), 1.0, smoothstep(0.0, 0.25, uDrain));

    // The ramp starts where the dissolve does, so violet lands on the lowest
    // part you can still see rather than in the faded-out base.
    float hv = clamp((h - uRampBase) / max(0.2, 1.0 - uRampBase), 0.0, 1.0);
    vColor = ramp(hv) * (0.8 + 0.42 * lit);
    float a = (0.05 + 0.75 * mix(rim, 0.6, dr)) * front * (0.7 + 0.6 * aSeed) * twinkle * fade * uAlpha;
    a *= g * (1.0 - smoothstep(0.86, 1.0, dr));
    // The glow pass is the same dots, four times the size at ~7% strength:
    // where they pile up (the rim) they bloom, without a post-processing pass.
    vAlpha = uGlow > 0.5 ? a * 0.07 : a;
    gl_PointSize = uSize * (0.75 + 0.5 * aSeed) * (uGlow > 0.5 ? 4.0 : 1.0) * uPixelRatio * (3.0 / -mv.z);
  }
`;

// THE LEDGER (M15, "Boring, by design."): the matter lying down as one flat
// line. aLine.x runs -1..1 along it; the wave on it (uWave) dies to zero as
// the section takes the stage, which is the whole point of the section.
export const LEDGER_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uGlow;
  uniform float uAlpha;
  uniform float uAssemble;
  uniform float uWave;
  uniform vec2 uHalf;
  attribute float aSeed;
  attribute vec3 aLine;
  varying vec3 vColor;
  varying float vAlpha;
  ${RAMP}
  ${SCATTER}
  void main() {
    float x = aLine.x;
    float wave = sin(x * 7.0 + uTime * 1.3) * 0.5 + sin(x * 17.0 - uTime * 0.9) * 0.25;
    vec3 p = vec3(x * uHalf.x, aLine.y * uHalf.y + wave * uWave * uHalf.y * 6.0, aLine.z);
    float g = gathered(aSeed, uAssemble);
    p = mix(p + scatterDir(aSeed) * (2.0 + 3.0 * aSeed), p, g);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = ramp(x * 0.5 + 0.5);
    // Brightest in the middle third, falling away to the ends.
    float ends = 1.0 - smoothstep(0.55, 1.0, abs(x));
    float a = (0.35 + 0.65 * aSeed) * ends * g * uAlpha;
    vAlpha = uGlow > 0.5 ? a * 0.09 : a;
    gl_PointSize = uSize * (0.6 + 0.6 * aSeed) * (uGlow > 0.5 ? 4.0 : 1.0) * uPixelRatio * (3.0 / -mv.z);
  }
`;

// The light on the bull's surface, shared by the footer's bull and the film's.
// Points are spread evenly over the model, so wherever the surface is seen
// edge-on more of them land in each pixel, and additive light turned that into
// a hard white outline round the silhouette and along every seam. Scaling each
// point by how squarely it faces you cancels the pile-up exactly; the far side
// is dropped, so it cannot show through; and what is left is lit like a
// surface, from a key above and a soft fill, with only a breath of rim.
export const BULL_LIGHT = /* glsl */ `
  float bullLight(vec3 wn, vec3 toEye, vec3 toLight) {
    float nv = dot(wn, toEye);
    float facing = smoothstep(-0.02, 0.24, nv);
    float spread = clamp(nv, 0.1, 1.0);
    float key = max(dot(wn, toLight), 0.0);
    float fill = 0.5 + 0.5 * wn.y;
    float rim = pow(1.0 - clamp(nv, 0.0, 1.0), 3.0);
    return facing * (spread * (0.12 + 0.72 * key + 0.2 * fill) + 0.05 * rim);
  }
`;

// THE BULL (M18, the curtain call): the film's bull as matter, points on the
// surface of /models/bull-crystal.glb, normalised to a unit box. It turns to
// the cursor (the object's rotation, set in JS) and breathes a little.
export const BULL_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uGlow;
  uniform float uAlpha;
  uniform float uAssemble;
  uniform vec3 uLight;
  attribute float aSeed;
  attribute vec3 aNormal;
  varying vec3 vColor;
  varying float vAlpha;
  ${RAMP}
  ${SCATTER}
  ${BULL_LIGHT}
  void main() {
    vec3 p = position * (1.0 + 0.012 * sin(uTime * 1.6 + position.y * 4.0));
    vec4 world = modelMatrix * vec4(p, 1.0);
    float g = gathered(aSeed, uAssemble);
    world.xyz = mix(world.xyz + scatterDir(aSeed) * (2.5 + 3.5 * aSeed), world.xyz, g);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    vec3 wn = normalize(mat3(modelMatrix) * aNormal);
    vec3 toEye = normalize(cameraPosition - world.xyz);
    vec3 toLight = normalize(uLight - world.xyz);
    float lit = max(dot(wn, toLight), 0.0);
    // Across the body as it is seen, as on the film's bull.
    float h = clamp((position.x * 0.58 - position.z * 0.81) * 0.5 + 0.5, 0.0, 1.0);
    vColor = ramp(h) * (0.75 + 0.45 * lit);
    float twinkle = 0.85 + 0.15 * sin(uTime * 2.2 + aSeed * 47.0);
    float a = bullLight(wn, toEye, toLight) * (0.7 + 0.6 * aSeed) * twinkle * g * uAlpha;
    vAlpha = uGlow > 0.5 ? a * 0.06 : a;
    gl_PointSize = uSize * (0.75 + 0.5 * aSeed) * (uGlow > 0.5 ? 4.0 : 1.0) * uPixelRatio * (3.0 / -mv.z);
  }
`;

// One fragment for every shape's dots. Additive light on the dark ground; on
// paper (uInk) the same dots as ink, darker and more opaque, normal blending.
export const DOT_FRAG = /* glsl */ `
  uniform float uGlow;
  uniform float uInk;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    // Dots: a crisp disc with a hair of feather. Glow: a gaussian.
    float fall = uGlow > 0.5 ? exp(-r * r * 14.0) : smoothstep(0.5, 0.34, r);
    float a = vAlpha * fall * (uInk > 0.5 ? 1.8 : 1.0);
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor, min(a, 1.0));
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
  }
`;

// The bokeh: a few big, faint, out-of-focus dots drifting behind the sphere.
export const BOKEH_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uAssemble;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float t = uTime * 0.35 + aSeed * 6.2831;
    vec3 p = position + vec3(sin(t) * 0.18, cos(t * 0.8) * 0.14, 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    // A slow breath, so the field is never quite still.
    vAlpha = (0.05 + 0.13 * aSeed) * (0.75 + 0.25 * sin(t * 1.7)) * uAssemble;
    gl_PointSize = (10.0 + 26.0 * aSeed) * uPixelRatio * (3.0 / -mv.z);
  }
`;

export const BOKEH_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = vAlpha * smoothstep(0.5, 0.0, r);
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
  }
`;

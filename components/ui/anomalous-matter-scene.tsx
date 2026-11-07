"use client";

/**
 * THE MATTER, frame zero's backdrop.
 *
 * Adapted from 21st.dev's "anomalous-matter-hero" (GenerativeArtScene): a
 * sphere whose surface simplex noise keeps pushing around, lit by a light that
 * follows the cursor. Here it is the market: a form that never holds still. It
 * is decoration, so it is aria-hidden and the page is whole without it. The
 * CSS haze in AnomalousMatterHero stands in until the first frame; under
 * reduced motion it draws one still frame; with no WebGL, or a lost context,
 * it simply never shows.
 *
 * HOW THE COLOURS BLEND (2026-11-06, second pass). The first cut was a
 * wireframe with violet troughs, blue crests and a mint rim: three full-chroma
 * colours at three very different lightnesses, so they read as three pieces,
 * and every crossing line burned white. Matched against the owner's reference
 * (a particle sphere that goes pale aqua at the top, through teal and steel
 * blue, to lavender at the bottom, on black with one soft haze):
 *   · One ramp, by height on screen, not by noise: mint at the top, blue in
 *     the middle, violet at the bottom, with a teal and a blue-violet between.
 *   · Every stop is a TINT of the brand colour (lifted toward white, see
 *     ramp()), so neighbouring stops sit close in lightness and the eye reads
 *     one gradient instead of three colours.
 *   · Points, not lines: crisp round dots, 120k on a desktop and 28k on a
 *     phone (phones stay under the ~50k where mid-range GPUs start dropping
 *     frames), at full retina resolution. Finer since 2026-11-07: the first
 *     cut had 72k and 16k, larger; each dot is now smaller and fainter, so the
 *     surface reads at a higher resolution with the same light. Their alpha
 *     follows the angle to the eye, so the face turned towards you all but
 *     vanishes and the rim, where dots pile up, carries the light: the dark
 *     core and the glowing ring. A second pass of the same dots, 4x larger
 *     at 7%, makes the rim bloom without a post-processing pass.
 *   · Size (third pass, 2026-11-06): big, ~74% of the height, rising out of
 *     the headline; the shader dissolves it under the copy instead of the
 *     layout shrinking it to fit above.
 *   · A few out-of-focus bokeh dots behind, in the same tints.
 *
 * What the original got wrong, still fixed here: THREE.Color cannot read
 * "hsl(var(--sky-300))"; the shader read a light uniform the JS never set; it
 * lit object-space normals. And cost: this is a fourth WebGL context on a page
 * whose film already holds three, so it draws only while frame zero is mostly
 * on screen and the tab is visible, caps the pixel ratio, frees its context on
 * unmount and survives a context loss. Easing is per-second, so it reads the
 * same at 60 and 120 Hz; scrolling the curtain up agitates the surface a
 * little, the first hint of the film underneath.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { isMotionPaused, onMotionPausedChange } from "@/lib/motion/bus";

export type MatterPalette = {
  /** The top of the sphere. */
  top: string;
  /** The middle. */
  mid: string;
  /** The bottom. */
  bottom: string;
};

// Ashima Arts' 3D simplex noise (MIT), as in the original.
const NOISE = /* glsl */ `
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

// The five-stop ramp, bottom to top, picked by height on screen.
const RAMP = /* glsl */ `
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

const SPHERE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uAgitation;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uGlow;
  uniform float uFadeLow;
  uniform float uFadeHigh;
  uniform float uRampBase;
  uniform float uAlpha;
  uniform vec3 uLight;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  ${NOISE}
  ${RAMP}
  void main() {
    vec3 n = normalize(position);
    float speed = 0.45 + 0.9 * uAgitation;
    // Two octaves: the slow swell, and a finer chop riding on it.
    float d = snoise(position * 1.5 + uTime * speed);
    d += 0.38 * snoise(position * 3.4 - uTime * 0.55 * speed);
    vec3 p = position + n * d * (0.22 + 0.16 * uAgitation);

    vec4 world = modelMatrix * vec4(p, 1.0);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;

    // Height on screen, relative to the sphere's own centre and size, so the
    // ramp stays put while the shape turns.
    float scale = length(modelMatrix[1].xyz);
    float h = (world.y - modelMatrix[3].y) / (1.45 * scale) * 0.5 + 0.5;

    vec3 wn = normalize(mat3(modelMatrix) * n);
    vec3 toEye = normalize(cameraPosition - world.xyz);
    float nv = dot(wn, toEye);
    // The face turned towards you all but vanishes; the rim carries the light.
    float rim = pow(1.0 - abs(nv), 1.2);
    float lit = max(dot(wn, normalize(uLight - world.xyz)), 0.0);
    float front = nv > 0.0 ? 1.0 : 0.5;
    float twinkle = 0.82 + 0.18 * sin(uTime * 2.4 + aSeed * 61.0);
    // Dissolve into the copy: gone below the headline, whole above its middle.
    float fade = smoothstep(uFadeLow, uFadeHigh, gl_Position.y / gl_Position.w);

    // The ramp starts where the dissolve does, so violet lands on the lowest
    // part you can still see rather than in the faded-out base.
    float hv = clamp((h - uRampBase) / max(0.2, 1.0 - uRampBase), 0.0, 1.0);
    vColor = ramp(hv) * (0.8 + 0.42 * lit);
    float a = (0.05 + 0.75 * rim) * front * (0.7 + 0.6 * aSeed) * twinkle * fade * uAlpha;
    // The glow pass is the same dots, four times the size at ~7% strength:
    // where they pile up (the rim) they bloom, without a post-processing pass.
    vAlpha = uGlow > 0.5 ? a * 0.07 : a;
    gl_PointSize = uSize * (0.75 + 0.5 * aSeed) * (uGlow > 0.5 ? 4.0 : 1.0) * uPixelRatio * (3.0 / -mv.z);
  }
`;

const DOT_FRAG = /* glsl */ `
  uniform float uGlow;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    // Dots: a crisp disc with a hair of feather. Glow: a gaussian.
    float fall = uGlow > 0.5 ? exp(-r * r * 14.0) : smoothstep(0.5, 0.34, r);
    float a = vAlpha * fall;
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
  }
`;

// The bokeh: a few big, faint, out-of-focus dots drifting behind the sphere.
const BOKEH_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
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
    vAlpha = (0.05 + 0.13 * aSeed) * (0.75 + 0.25 * sin(t * 1.7));
    gl_PointSize = (10.0 + 26.0 * aSeed) * uPixelRatio * (3.0 / -mv.z);
  }
`;

const BOKEH_FRAG = /* glsl */ `
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

/**
 * The brand colours as a five-stop ramp of tints, bottom to top. Mixed in
 * sRGB, which is how the eye judges "between", then handed to three as sRGB.
 * The lift toward white is what makes the stops blend: raw, the mint is near
 * white and the violet near black, and the ramp would break into bands.
 */
function ramp(p: MatterPalette): THREE.Color[] {
  const rgb = (hex: string) => {
    const c = new THREE.Color();
    c.setStyle(hex, THREE.SRGBColorSpace);
    // setStyle stores linear; read it back as sRGB components to mix in.
    const out = { r: 0, g: 0, b: 0 };
    c.getRGB(out, THREE.SRGBColorSpace);
    return [out.r, out.g, out.b];
  };
  const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
  const white = [1, 1, 1];
  const top = rgb(p.top);
  const mid = rgb(p.mid);
  const bottom = rgb(p.bottom);
  const stops = [
    mix(bottom, white, 0.32), // lavender
    mix(mix(mid, bottom, 0.5), white, 0.28), // blue-violet
    mix(mid, white, 0.18), // blue
    mix(mix(top, mid, 0.5), white, 0.25), // teal
    mix(mix(top, white, 0.42), mid, 0.12), // pale aqua-mint
  ];
  return stops.map(([r, g, b]) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace));
}

/** Evenly spread points on a unit sphere (the golden-angle spiral). */
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
    // Deterministic per-point variation (no Math.random: same frame every load).
    const s = Math.sin(i * 12.9898) * 43758.5453;
    seed[i] = s - Math.floor(s);
  }
  return { pos, seed };
}

// Radius 1.2; the noise pushes the surface out to about 1.45 on average and
// 1.65 at the very most.
const RADIUS = 1.2;
const EXTENT = 1.45;
const REACH = 1.65;

export default function GenerativeArtScene({ palette }: { palette: MatterPalette }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const { top, mid, bottom } = palette;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const phone = window.matchMedia("(max-width: 767px)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    } catch {
      return; // no WebGL: the CSS haze is the whole backdrop
    }
    // Full retina: at 1.75 a 2x display upscaled the canvas and the dots went
    // soft. Slower GPUs step down on their own (see the frame loop).
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(pixelRatio);
    const canvas = renderer.domElement;
    canvas.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;opacity:0;transition:opacity 1.6s cubic-bezier(0.22,1,0.36,1)";
    mount.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
    camera.position.z = 3;
    const stops = ramp({ top, mid, bottom });

    // ── the sphere ───────────────────────────────────────────────────────────
    // 120k dots on a desktop (28k on a phone): a fine fabric at retina size.
    // The vertex work is per dot per pass; desktop GPUs take it in ~2ms.
    // Light is count × dot area × alpha, so alpha pays back what the finer
    // fabric adds over the first cut (72k dots at 1.85, 16k at 2.1).
    const fabric = phone ? { count: 28000, size: 1.8 } : { count: 120000, size: 1.6 };
    const first = phone ? { count: 16000, size: 2.1 } : { count: 72000, size: 1.85 };
    const { pos, seed } = fibonacciSphere(fabric.count, RADIUS);
    const sphereGeo = new THREE.BufferGeometry();
    sphereGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sphereGeo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const uniforms = {
      uTime: { value: 0 },
      uAgitation: { value: 0 },
      uSize: { value: fabric.size },
      uPixelRatio: { value: pixelRatio },
      uGlow: { value: 0 },
      uFadeLow: { value: -0.6 },
      uFadeHigh: { value: -0.25 },
      uRampBase: { value: 0 },
      uAlpha: { value: (first.count / fabric.count) * (first.size / fabric.size) ** 2 },
      uLight: { value: new THREE.Vector3(0.8, 1.2, 2.6) },
      uStop0: { value: stops[0] },
      uStop1: { value: stops[1] },
      uStop2: { value: stops[2] },
      uStop3: { value: stops[3] },
      uStop4: { value: stops[4] },
    };
    const additive = {
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    } as const;
    const sphereMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: SPHERE_VERT,
      fragmentShader: DOT_FRAG,
      ...additive,
    });
    // The glow shares every uniform but its own switch.
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { ...uniforms, uGlow: { value: 1 } },
      vertexShader: SPHERE_VERT,
      fragmentShader: DOT_FRAG,
      ...additive,
    });
    const sphere = new THREE.Group();
    sphere.add(new THREE.Points(sphereGeo, glowMat), new THREE.Points(sphereGeo, sphereMat));
    scene.add(sphere);

    // ── the bokeh ────────────────────────────────────────────────────────────
    const BOKEH = phone ? 16 : 34;
    const bPos = new Float32Array(BOKEH * 3);
    const bSeed = new Float32Array(BOKEH);
    const bCol = new Float32Array(BOKEH * 3);
    for (let i = 0; i < BOKEH; i++) {
      const a = Math.sin(i * 78.233) * 43758.5453;
      const b = Math.sin(i * 39.425) * 24634.6345;
      const c = Math.sin(i * 12.989) * 14375.5453;
      const fa = a - Math.floor(a);
      const fb = b - Math.floor(b);
      const fc = c - Math.floor(c);
      bPos[i * 3] = (fa - 0.5) * 9;
      bPos[i * 3 + 1] = (fb - 0.5) * 5.5;
      bPos[i * 3 + 2] = -1.2 - fc * 3.5;
      bSeed[i] = fc;
      const tint = stops[Math.min(4, Math.floor(fb * 5))];
      bCol[i * 3] = tint.r;
      bCol[i * 3 + 1] = tint.g;
      bCol[i * 3 + 2] = tint.b;
    }
    const bokehGeo = new THREE.BufferGeometry();
    bokehGeo.setAttribute("position", new THREE.BufferAttribute(bPos, 3));
    bokehGeo.setAttribute("aSeed", new THREE.BufferAttribute(bSeed, 1));
    bokehGeo.setAttribute("aColor", new THREE.BufferAttribute(bCol, 3));
    const bokehMat = new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime, uPixelRatio: uniforms.uPixelRatio },
      vertexShader: BOKEH_VERT,
      fragmentShader: BOKEH_FRAG,
      ...additive,
    });
    const bokeh = new THREE.Points(bokehGeo, bokehMat);
    scene.add(bokeh);

    // Big: about 74% of the height on a landscape screen, centred at 41% so it
    // rises out of the headline, and wide on a phone. The copy is NOT kept
    // clear by shrinking the sphere any more (that left it a quarter of the
    // width, 2026-11-06); the shader dissolves it instead, through a band from
    // the middle of the headline down to its last line, measured from the DOM
    // because the copy is sized in pixels and the frame in viewport units.
    const section = mount.closest("section");
    const heading = section?.querySelector("h1") ?? null;
    // Layout offsets, not getBoundingClientRect: the headline rises in from
    // 14px lower, and a rect taken mid-entrance would seat the band low.
    const headingBox = () => {
      if (!heading || !section) return null;
      let y = 0;
      for (let n: HTMLElement | null = heading; n && n !== section; n = n.offsetParent as HTMLElement | null) y += n.offsetTop;
      return { top: y, height: heading.offsetHeight };
    };
    const fit = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const visW = visH * camera.aspect;
      const portrait = camera.aspect < 0.8;
      const centre = portrait ? 0.29 : 0.42; // fraction of the height, from the top
      // As big as the frame allows, but the tallest noise peak (REACH, not the
      // average EXTENT) stays under the top edge: a flat-cut crown read as a
      // dome on a 1280x720 laptop.
      const radius = Math.min(
        visH * (portrait ? 0.26 : 0.37),
        visW * (portrait ? 0.47 : 0.4),
        (centre - 0.025) * visH * (EXTENT / REACH),
      );
      sphere.scale.setScalar(radius / EXTENT);
      sphere.position.y = visH * (0.5 - centre);
      const hb = headingBox();
      const ndc = (px: number) => 1 - (2 * px) / h;
      const fadeMid = hb && hb.height ? hb.top + hb.height * 0.72 : h * (portrait ? 0.5 : 0.62);
      if (hb && hb.height) {
        uniforms.uFadeHigh.value = ndc(hb.top + hb.height * 0.4);
        uniforms.uFadeLow.value = ndc(hb.top + hb.height * 1.05);
      } else {
        uniforms.uFadeHigh.value = portrait ? 0.0 : -0.2;
        uniforms.uFadeLow.value = portrait ? -0.3 : -0.5;
      }
      // The sphere's own height coordinate (0 base, 1 crown) at the middle of
      // the dissolve: the ramp's violet end is pinned there.
      const radiusPx = (radius / visH) * h;
      uniforms.uRampBase.value = Math.min(0.42, Math.max(0, 0.5 + (centre * h - fadeMid) / (2 * radiusPx)));
    };
    fit();

    const target = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };
    let agitation = 0;
    let t = 0;
    let last = performance.now();
    let raf = 0;
    let visible = true;
    let lost = false;
    let shown = false;

    const show = () => {
      if (shown) return;
      shown = true;
      canvas.style.opacity = "1";
    };

    // Adaptive resolution: if frames stay slower than ~42ms (under ~24fps)
    // for two seconds, step the pixel ratio down once, to 1.5. It used to
    // step at 24ms, twice, down to ~1x: but macOS on battery caps rAF at
    // ~30fps (33ms a frame however idle the GPU is), and that alone took a
    // fast GPU down to ~1x and turned the dots soft (2026-11-07).
    let slow = 0;
    let stepped = false;
    const adapt = (dt: number) => {
      if (stepped) return;
      slow = dt > 0.042 ? slow + dt : Math.max(0, slow - 2 * dt);
      if (slow < 2) return;
      stepped = true;
      pixelRatio = Math.min(pixelRatio, 1.5);
      renderer.setPixelRatio(pixelRatio);
      uniforms.uPixelRatio.value = pixelRatio;
      fit();
    };

    const frame = (now: number) => {
      raf = 0;
      const raw = (now - last) / 1000;
      const dt = Math.min(0.05, raw);
      last = now;
      t += dt;
      if (raw < 0.25) adapt(raw);
      const k = 1 - Math.exp(-dt * 3.2);
      pointer.x += (target.x - pointer.x) * k;
      pointer.y += (target.y - pointer.y) * k;
      const lift = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)));
      agitation += (lift - agitation) * k;

      uniforms.uTime.value = t * 0.3;
      uniforms.uAgitation.value = agitation;
      uniforms.uLight.value.set(pointer.x * 3.2, pointer.y * 2.2 + 0.4, 2.6);
      sphere.rotation.y = t * 0.035 + pointer.x * 0.28;
      sphere.rotation.x = t * 0.015 - pointer.y * 0.18;
      // The bokeh sits deeper, so it drifts less with the cursor: parallax.
      bokeh.position.x = -pointer.x * 0.12;
      bokeh.position.y = -pointer.y * 0.08;
      renderer.render(scene, camera);
      show();
      schedule();
    };

    // A paused site (lib/motion/bus.ts) holds the last frame: frozen mid-air.
    const schedule = () => {
      if (!raf && visible && !lost && !document.hidden && !isMotionPaused()) raf = requestAnimationFrame(frame);
    };

    // The current pose again, without advancing time: a resize or a restored
    // context clears the canvas, and a paused site must not go blank.
    const redraw = () => {
      if (lost) return;
      renderer.render(scene, camera);
      show();
    };

    // One frame and done: the shape without the motion.
    const still = () => {
      if (lost) return;
      uniforms.uTime.value = 1.4;
      sphere.rotation.set(0.12, 0.5, 0);
      renderer.render(scene, camera);
      show();
    };

    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    const onVisibility = () => {
      last = performance.now();
      schedule();
    };
    // Mostly off screen means the curtain is lifting off the film: stop and
    // leave the film the GPU.
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.intersectionRatio > 0.3;
        if (visible) {
          last = performance.now();
          schedule();
        }
      },
      { threshold: [0, 0.3, 0.6] },
    );
    const ro = new ResizeObserver(() => {
      fit();
      if (reduce) still();
      else if (isMotionPaused()) redraw();
    });
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      canvas.style.opacity = "0";
      shown = false;
    };
    const onRestored = () => {
      lost = false;
      fit();
      if (reduce) still();
      else if (isMotionPaused()) redraw();
      else schedule();
    };

    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    io.observe(mount);
    ro.observe(mount);
    // The headline reflows when its web font arrives; refit when it does.
    if (heading) ro.observe(heading);
    if (reduce) {
      still();
    } else {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      // Paused before it ever moved: show the shape, still.
      if (isMotionPaused()) still();
      schedule();
    }
    // Un-pausing picks the loop up where it stopped (onVisibility resets the clock).
    const offPause = reduce ? () => {} : onMotionPausedChange(onVisibility);

    return () => {
      offPause();
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      sphereGeo.dispose();
      sphereMat.dispose();
      glowMat.dispose();
      bokehGeo.dispose();
      bokehMat.dispose();
      renderer.dispose();
      // Browsers cap live WebGL contexts; give this one back now rather than
      // whenever the collector gets to it.
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [top, mid, bottom]);

  return <div ref={mountRef} aria-hidden className="absolute inset-0 h-full w-full" />;
}

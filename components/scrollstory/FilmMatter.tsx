"use client";

/**
 * THE MATTER, ON FILM (2026-11-09, the one take).
 *
 * One cloud of points carries the film's two long passages, so that nothing
 * has to cut between them:
 *
 *   the river   What drains out of the hero lands as a line across the stage.
 *               The line is the market: calm, then choppy, then trending. Then
 *               it retracts into the point where the first candle prints.
 *   the bull    The vote's spokes come apart into the same dust, the dust
 *               gathers into the bull, and the bull's points stream onto the
 *               mark, where the page's own line takes over.
 *
 * It replaces a warp tunnel of floating screens and a crystal bull with an
 * impact flash, which between them owned the film's two white-outs. Everything
 * is a pure function of film progress (lib/cinema.ts matterAt), so it scrubs
 * both ways; the slow flow along the line runs on the film's own time.
 */

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { cinemaClock, damp } from "@/lib/cinema-clock";
import { matterAt } from "@/lib/cinema";
import { BULL_MARK } from "@/lib/bull-mark";
import { BULL_LIGHT, DOT_FRAG, NOISE } from "@/components/matter/shaders";
import { watchContext } from "./gl-context";
import { FilmDriver } from "./FilmDriver";
import { FilmDpr } from "./FilmDpr";

const MODEL = "/models/bull-crystal.glb";
/** The yaw the bull is seen at, which orders its points left to right for the mark. */
const SEEN_YAW = -0.95;

const VERT = /* glsl */ `
  uniform float uStage;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  uniform float uGlow;
  uniform float uAlpha;
  uniform float uDensity;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  // the river
  uniform float uBirth;
  uniform float uChop;
  uniform float uTrend;
  uniform float uPour;
  uniform float uPourU;
  uniform vec2 uPourAt;
  uniform vec2 uHalf;
  uniform float uLen;
  uniform float uRiverY;
  uniform float uRiverAmp;
  uniform float uMeander;
  uniform float uCurtain;
  uniform float uFocus;
  uniform float uAperture;
  // the bull
  uniform float uRingOn;
  uniform float uSwarm;
  uniform float uMark;
  uniform float uFade;
  uniform vec2 uRingC;
  uniform vec2 uRingR;
  uniform vec4 uMarkBox;
  uniform mat4 uBullM;
  uniform vec3 uLight;

  attribute vec2 aRiver;
  attribute vec2 aThread;
  attribute vec3 aRand;
  attribute float aKind;
  attribute float aSeed;
  attribute vec2 aRing;
  attribute vec3 aBull;
  attribute vec3 aBullN;
  attribute vec3 aMark;

  varying vec3 vColor;
  varying float vAlpha;

  ${NOISE}
  ${BULL_LIGHT}

  const float PI = 3.14159265;
  float ease(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
  vec3 tint(float k) {
    k = clamp(k, 0.0, 1.0);
    return k < 0.5 ? mix(uA, uB, k * 2.0) : mix(uB, uC, k * 2.0 - 1.0);
  }

  // The market's three moods, each a function of position along the line.
  float calmAt(float u) {
    return 0.1 * snoise(vec3(u * 2.6, uTime * 0.16, 1.7));
  }
  float chopAt(float u) {
    return 0.52 * snoise(vec3(u * 9.0, uTime * 0.05, 3.1))
      + 0.3 * snoise(vec3(u * 23.0, 0.0, 9.4))
      + 0.14 * snoise(vec3(u * 57.0, 0.0, 5.2));
  }
  float trendAt(float u) {
    return mix(-0.86, 0.9, u)
      + 0.07 * snoise(vec3(u * 13.0, 0.0, 2.2))
      + 0.03 * snoise(vec3(u * 41.0, 0.0, 7.1));
  }
  float pathAt(float u) {
    float y = calmAt(u) * (1.0 - uChop);
    if (uChop > 0.001) y += chopAt(u) * uChop;
    if (uTrend > 0.001) y = mix(y, trendAt(u), uTrend);
    return y;
  }

  void main() {
    float a;
    float size = uSize * (0.75 + 0.5 * aSeed);
    vec2 p;

    if (uStage < 0.5) {
      // ── the river ── a real line in real space: the camera flies along it.
      bool runner = aKind > 3.5;
      bool falls = aKind > 2.5 && aKind < 3.5;
      float u = fract(aRiver.x + uTime * (runner ? 0.045 + 0.06 * aSeed : 0.006 + 0.016 * aSeed));
      // The line runs past both edges of the frontal view; v is 0..1 across what that view can see.
      float v = 0.5 + (u - 0.5) * 1.35;
      vec3 w = vec3(
        mix(-uLen, uLen, u),
        uRiverY + pathAt(v) * uRiverAmp,
        sin(v * 4.6 + 0.6) * 0.42 * uMeander
      );
      w += position * vec3(uHalf.y, uHalf.y, 1.0);
      // The fine threads wandering round the line; they draw in close once it
      // has something to say.
      w.y += aThread.x * snoise(vec3(v * 2.2 + aThread.y, uTime * 0.06, aThread.y * 3.1)) * (1.0 - 0.7 * max(uChop, uTrend)) * uHalf.y;
      // The curtain: dust shed by the line, drifting down and fading out.
      float hang = 0.0;
      if (falls) {
        float h = fract(aSeed * 37.31 + uTime * (0.018 + 0.03 * fract(aSeed * 91.7)));
        hang = h * h;
        w.y -= hang * uHalf.y * (0.16 + 0.62 * fract(aSeed * 17.3)) * uCurtain;
        w.x += (fract(aSeed * 53.3) - 0.5) * 0.14 * h;
      }

      // It lands in the middle, where the hero drained, and spreads both ways.
      float reach = clamp(abs(v - 0.5) * 2.0, 0.0, 1.0);
      // Each point on its own beat and its own line, so it falls as dust, not as a sheet.
      float b = ease(uBirth * 2.2 - reach * 0.7 - aRand.x * 0.5);
      vec3 spill = vec3(
        (aRand.y - 0.5) * 1.3,
        uHalf.y * 1.25 - aRand.z * 0.9,
        position.z + (aSeed - 0.5) * 1.4
      );
      w = mix(spill, w, b);

      vec4 mv = viewMatrix * vec4(w, 1.0);
      vec4 clip = projectionMatrix * mv;
      if (clip.w < 0.06) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        gl_PointSize = 0.0;
        vAlpha = 0.0;
        vColor = vec3(0.0);
        return;
      }
      p = clip.xy / clip.w;

      // It retracts from both ends into the point where the first candle prints.
      float far = clamp(abs(u - uPourU) / max(uPourU, 1.0 - uPourU), 0.0, 1.0);
      float pr = ease(uPour * 1.3 - (1.0 - far) * 0.3);
      p = mix(p, uPourAt + position.xy * 0.4, pr);

      // A light travels the line once per lap, the panels' aura in another form.
      float lap = fract(uTime / 7.0) * 1.5 - 0.25;
      float pulse = exp(-pow((v - lap) * 11.0, 2.0));

      float ends = smoothstep(0.0, 0.04, u) * (1.0 - smoothstep(0.96, 1.0, u));
      // It thins as it goes, so it is spent by the time it reaches the candle.
      a = aRiver.y * ends * smoothstep(0.0, 0.3, b) * (1.0 - smoothstep(0.2, 0.74, pr));
      a *= 0.8 + 0.2 * sin(uTime * 2.1 + aSeed * 61.0);
      a *= 1.0 + 1.4 * pulse;
      if (falls) a *= pow(1.0 - fract(aSeed * 37.31 + uTime * (0.018 + 0.03 * fract(aSeed * 91.7))), 1.4) * uCurtain * 2.6;
      a *= uDensity;
      vColor = tint(clamp(v, 0.0, 1.0));

      // The lens: points away from the plane of focus open into soft discs,
      // their light spread over the larger area.
      float dist = -mv.z;
      // It goes dark toward the horizon, and does not burn out right at the lens.
      a *= mix(1.0, (1.0 - smoothstep(2.3, 4.9, dist)) * smoothstep(0.55, 2.3, dist), uMeander);
      a = min(a, aRiver.y * 8.0);
      size *= 5.0 / dist;
      if (uGlow < 0.5) {
        float coc = min(abs(dist - uFocus) / dist * uAperture, 30.0);
        float grown = sqrt(size * size + coc * coc);
        a *= min(1.0, (size * size) / (grown * grown)) * (1.0 + coc * 0.32);
        size = grown;
      }
      gl_Position = vec4(p, 0.0, 1.0);
    } else {
      // ── the bull ───────────────────────────────────────────────────────
      vec4 world = uBullM * vec4(aBull, 1.0);
      vec4 mv = viewMatrix * world;
      vec4 clip = projectionMatrix * mv;
      vec2 bull = clip.xy / clip.w;

      vec2 ring = uRingC + uRingR * aRing.y * vec2(cos(aRing.x), sin(aRing.x));
      float s = ease(uSwarm * 1.5 - aSeed * 0.5);
      p = mix(ring, bull, s);
      float flight = sin(s * PI);
      p += flight * 0.05 * vec2(
        snoise(vec3(aSeed * 40.0, uTime * 0.2, 0.0)),
        snoise(vec3(aSeed * 70.0, uTime * 0.2, 4.0))
      );

      float m = ease(uMark * 1.45 - aMark.z * 0.45);
      vec2 mark = uMarkBox.xy + vec2(aMark.x * uMarkBox.z, -aMark.y * uMarkBox.w);
      p = mix(p, mark, m);
      // Each point wanders on its way, so the cloud pours rather than slides.
      float wander = sin(m * PI);
      p += wander * 0.075 * vec2(
        snoise(vec3(aSeed * 31.0, uTime * 0.25, 2.0)),
        snoise(vec3(aSeed * 57.0, uTime * 0.25, 9.0))
      );

      vec3 wn = normalize(mat3(uBullM) * aBullN);
      vec3 toEye = normalize(cameraPosition - world.xyz);
      float lit = bullLight(wn, toEye, normalize(uLight));

      float dust = (0.012 + 0.04 * aSeed) * aRing.y;
      a = mix(dust * uRingOn, lit * 2.4, s) * uDensity;
      // On the mark the whole cloud is packed onto a line; each point has to
      // give up most of its light or the line burns out to white.
      a = mix(a, 0.05 * uDensity, m);
      a *= uFade * (0.82 + 0.18 * sin(uTime * 2.2 + aSeed * 47.0));
      vColor = tint(aMark.z);
      size *= (3.0 / -mv.z) * mix(1.0, 0.72, m) * 1.65;
      gl_Position = vec4(p, 0.0, 1.0);
    }

    a *= uAlpha;
    vAlpha = uGlow > 0.5 ? a * 0.28 : a;
    gl_PointSize = size * (uGlow > 0.5 ? 4.0 : 1.0) * uPixelRatio;
  }
`;

/** The far distance: a thin field of points, most of them well out of focus. */
const DEEP_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uOn;
  attribute float aSeed;
  attribute vec3 aTint;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position + vec3(sin(uTime * 0.05 + aSeed * 20.0), cos(uTime * 0.04 + aSeed * 31.0), 0.0) * 0.12;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = max(-mv.z, 0.2);
    float size = (0.9 + 1.6 * aSeed * aSeed) * 5.0 / dist;
    float coc = min(abs(dist - uFocus) / dist * (1.6 + uAperture), 26.0) * step(0.55, aSeed);
    float grown = sqrt(size * size + coc * coc);
    float twinkle = 0.7 + 0.3 * sin(uTime * (0.6 + aSeed * 1.4) + aSeed * 71.0);
    vAlpha = (0.2 + 0.5 * aSeed) * twinkle * uOn * min(1.0, (size * size) / (grown * grown) * 3.0);
    vColor = aTint;
    gl_PointSize = grown * uPixelRatio;
  }
`;

const DEEP_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = vAlpha * smoothstep(0.5, 0.36, r);
    if (a < 0.002) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
  }
`;

/** A faint nebula behind the line, so the dark has depth. Dithered against banding. */
const CLOUD_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform float uTime;
  uniform float uOn;
  uniform vec2 uDrift;
  varying vec2 vNdc;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z
    );
  }
  void main() {
    vec3 q = vec3(vNdc * vec2(1.6, 1.0) * 1.7 + uDrift, uTime * 0.03);
    float a = 0.5, n = 0.0;
    for (int i = 0; i < 4; i++) { n += a * noise(q); q = q * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; }
    float k = vNdc.x * 0.5 + 0.5;
    vec3 tint = k < 0.5 ? mix(uA, uB, k * 2.0) : mix(uB, uC, k * 2.0 - 1.0);
    float band = exp(-pow((vNdc.y + 0.22) * 1.5, 2.0));
    float m = smoothstep(0.34, 0.86, n) * band * uOn;
    float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    vec3 col = tint * m * 0.085 + (dither - 0.5) * 0.0016 * step(0.001, m);
    gl_FragColor = vec4(max(col, 0.0), m * 0.085);
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
  }
`;

const CLOUD_VERT = /* glsl */ `
  varying vec2 vNdc;
  void main() {
    vNdc = position.xy;
    gl_Position = vec4(position.xy, 0.999, 1.0);
  }
`;

/** Deterministic per-point variation: the same film on every load. */
const hash = (i: number, k: number) => {
  const s = Math.sin(i * k) * 43758.5453;
  return s - Math.floor(s);
};
/** A point on the mark, `t` of the way along its length. */
function markAt(t: number): [number, number] {
  const segs = BULL_MARK.slice(1).map((b, i) => {
    const a = BULL_MARK[i];
    return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) };
  });
  let d = t * segs.reduce((s, x) => s + x.len, 0);
  for (const sg of segs) {
    if (d <= sg.len || sg === segs[segs.length - 1]) {
      const k = sg.len ? Math.min(1, d / sg.len) : 0;
      return [sg.a[0] + (sg.b[0] - sg.a[0]) * k, sg.a[1] + (sg.b[1] - sg.a[1]) * k];
    }
    d -= sg.len;
  }
  return [1, 0];
}

function buildAttributes(count: number) {
  const off = new Float32Array(count * 3);
  const river = new Float32Array(count * 2);
  const thread = new Float32Array(count * 2);
  const rand = new Float32Array(count * 3);
  const kindOf = new Float32Array(count);
  const seed = new Float32Array(count);
  const ring = new Float32Array(count * 2);
  const bull = new Float32Array(count * 3);
  const bullN = new Float32Array(count * 3);
  const mark = new Float32Array(count * 3);
  // One proper generator, not a hash of the index: index hashes correlate,
  // and a million correlated points show up on screen as stripes.
  let state = 0x9e3779b9;
  const rnd = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(1e-6, rnd()))) * Math.cos(2 * Math.PI * rnd());
  for (let i = 0; i < count; i++) {
    seed[i] = rnd();
    river[i * 2] = rnd();
    rand.set([rnd(), rnd(), rnd()], i * 3);
    // Four in ten make the line, a quarter the six fine threads that wander
    // round it (each thread one curve, so it reads as a thread), a fifth the
    // curtain of dust falling from it, the rest the air around them. A few
    // run along the line much faster than the rest.
    const kind = rnd();
    const isLine = kind < 0.4;
    const isThread = !isLine && kind < 0.65;
    const isCurtain = !isLine && !isThread && kind < 0.86;
    const isRunner = !isLine && !isThread && !isCurtain && kind < 0.875;
    kindOf[i] = isLine ? 0 : isThread ? 1 : isCurtain ? 3 : isRunner ? 4 : 2;
    const sigma = isLine || isRunner ? 0.0028 : isThread ? 0.0012 : isCurtain ? 0.004 : 0.05;
    const depth = isLine || isRunner || isThread ? 0.006 : isCurtain ? 0.09 : 0.75;
    river[i * 2 + 1] = isRunner ? 0.9 : isLine ? 0.13 : isThread ? 0.2 : isCurtain ? 0.15 : 0.14;
    if (isThread) {
      const strand = Math.floor(rnd() * 6);
      thread[i * 2] = 0.02 + 0.075 * hash(strand, 21.7);
      thread[i * 2 + 1] = hash(strand, 83.3) * 20;
    }
    off[i * 3] = normal() * sigma * 0.5;
    off[i * 3 + 1] = normal() * sigma;
    off[i * 3 + 2] = normal() * depth;
    // The vote: along one of its twelve spokes, thickest at the node.
    const spoke = Math.floor(rnd() * 12);
    ring[i * 2] = -(-Math.PI / 2 + (spoke / 12) * Math.PI * 2 + normal() * 0.07);
    ring[i * 2 + 1] = Math.pow(rnd(), 0.55);
    // Placeholder until the model is sampled: the mark, read by arc length.
    const t = rnd();
    const [mx, my] = markAt(t);
    mark.set([mx, my, t], i * 3);
  }
  return { off, river, thread, rand, kindOf, seed, ring, bull, bullN, mark };
}

function Matter({ active, onBull }: { active: boolean; onBull?: (ok: boolean) => void }) {
  const size = useThree((s) => s.size);
  const count = useMemo(() => ((navigator.hardwareConcurrency || 8) <= 4 ? 70000 : 180000), []);
  const attrs = useMemo(() => buildAttributes(count), [count]);
  const { dotGeo, glowGeo } = useMemo(() => {
    const mk = () => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(attrs.off, 3));
      g.setAttribute("aRiver", new THREE.BufferAttribute(attrs.river, 2));
      g.setAttribute("aThread", new THREE.BufferAttribute(attrs.thread, 2));
      g.setAttribute("aKind", new THREE.BufferAttribute(attrs.kindOf, 1));
      g.setAttribute("aRand", new THREE.BufferAttribute(attrs.rand, 3));
      g.setAttribute("aSeed", new THREE.BufferAttribute(attrs.seed, 1));
      g.setAttribute("aRing", new THREE.BufferAttribute(attrs.ring, 2));
      g.setAttribute("aBull", new THREE.BufferAttribute(attrs.bull, 3));
      g.setAttribute("aBullN", new THREE.BufferAttribute(attrs.bullN, 3));
      g.setAttribute("aMark", new THREE.BufferAttribute(attrs.mark, 3));
      return g;
    };
    const dotGeo = mk();
    const glowGeo = mk();
    // The glow is the same dots at four times the size: a quarter of them,
    // each four times as strong, is the same light for a quarter of the cost.
    glowGeo.setDrawRange(0, Math.floor(count / 4));
    return { dotGeo, glowGeo };
  }, [attrs, count]);

  const shared = useMemo(
    () => ({
      uStage: { value: 0 },
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: 1.5 },
      uAlpha: { value: 1 },
      uDensity: { value: 90000 / count },
      uInk: { value: 0 },
      uA: { value: new THREE.Color("#8f73ff") },
      uB: { value: new THREE.Color("#5c9aff") },
      uC: { value: new THREE.Color("#52ffa5") },
      uBirth: { value: 0 },
      uChop: { value: 0 },
      uTrend: { value: 0 },
      uPour: { value: 0 },
      uPourU: { value: 0.5 },
      uPourAt: { value: new THREE.Vector2() },
      uHalf: { value: new THREE.Vector2(2.4, 1.53) },
      uLen: { value: 3.3 },
      uRiverY: { value: -0.21 },
      uRiverAmp: { value: 0.52 },
      uMeander: { value: 0 },
      uCurtain: { value: 0 },
      uFocus: { value: 5 },
      uAperture: { value: 0 },
      uRingOn: { value: 0 },
      uSwarm: { value: 0 },
      uMark: { value: 0 },
      uFade: { value: 1 },
      uRingC: { value: new THREE.Vector2(0, -0.12) },
      uRingR: { value: new THREE.Vector2(0.15, 0.25) },
      uMarkBox: { value: new THREE.Vector4(0.2, 0.2, 0.4, 0.3) },
      uBullM: { value: new THREE.Matrix4() },
      uLight: { value: new THREE.Vector3(-0.45, 0.7, 0.6) },
    }),
    [count]
  );
  const { dots, glow } = useMemo(() => {
    const make = (isGlow: boolean) =>
      new THREE.ShaderMaterial({
        uniforms: { ...shared, uGlow: { value: isGlow ? 1 : 0 } },
        vertexShader: VERT,
        fragmentShader: DOT_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        premultipliedAlpha: true,
      });
    return { dots: make(false), glow: make(true) };
  }, [shared]);

  useEffect(
    () => () => {
      dotGeo.dispose();
      glowGeo.dispose();
      dots.dispose();
      glow.dispose();
    },
    [dotGeo, glowGeo, dots, glow]
  );

  const halfH = Math.tan((17 * Math.PI) / 180) * 5;
  useEffect(() => {
    const halfW = halfH * (size.width / Math.max(1, size.height));
    shared.uHalf.value.set(halfW, halfH);
    shared.uLen.value = halfW * 1.35;
  }, [size, shared, halfH]);

  // Deep space, and the nebula in it.
  const deep = useMemo(() => {
    const N = 4200;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const tint = new Float32Array(N * 3);
    const palette = [new THREE.Color("#8f73ff"), new THREE.Color("#5c9aff"), new THREE.Color("#52ffa5"), new THREE.Color("#dfe6ff"), new THREE.Color("#dfe6ff")];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (hash(i, 11.7) - 0.5) * 34;
      pos[i * 3 + 1] = (hash(i, 23.9) - 0.5) * 18;
      pos[i * 3 + 2] = hash(i, 5.31) < 0.14 ? 1.2 + hash(i, 3.3) * 2.6 : -1 - hash(i, 7.7) * 22;
      seed[i] = hash(i, 41.3);
      const c = palette[Math.floor(hash(i, 67.1) * palette.length)];
      tint.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    geo.setAttribute("aTint", new THREE.BufferAttribute(tint, 3));
    const uniforms = {
      uTime: shared.uTime,
      uPixelRatio: shared.uPixelRatio,
      uFocus: shared.uFocus,
      uAperture: shared.uAperture,
      uOn: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: DEEP_VERT,
      fragmentShader: DEEP_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    });
    const cloudUniforms = { uA: shared.uA, uB: shared.uB, uC: shared.uC, uTime: shared.uTime, uOn: { value: 0 }, uDrift: { value: new THREE.Vector2() } };
    const cloud = new THREE.ShaderMaterial({
      uniforms: cloudUniforms,
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    });
    return { geo, mat, uOn: uniforms.uOn, cloud, cloudOn: cloudUniforms.uOn, drift: cloudUniforms.uDrift, quad: new THREE.PlaneGeometry(2, 2) };
  }, [shared]);
  useEffect(
    () => () => {
      deep.geo.dispose();
      deep.mat.dispose();
      deep.cloud.dispose();
      deep.quad.dispose();
    },
    [deep]
  );

  // The bull is the film's own model, sampled on its surface. A few thousand
  // points per task, so the sampling never costs the scroll a long frame.
  const onBullRef = useRef(onBull);
  onBullRef.current = onBull;
  useEffect(() => {
    let disposed = false;
    let timer = 0;
    (async () => {
      try {
        const draco = new DRACOLoader().setDecoderPath("/draco/");
        const gltf = await new GLTFLoader().setDRACOLoader(draco).loadAsync(MODEL);
        draco.dispose();
        if (disposed) return;
        gltf.scene.updateMatrixWorld(true);
        let mesh: THREE.Mesh | null = null;
        gltf.scene.traverse((o) => {
          if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
        });
        if (!mesh) throw new Error("no mesh");
        const m = mesh as THREE.Mesh;
        const g = m.geometry.clone();
        g.applyMatrix4(m.matrixWorld);
        g.computeBoundingBox();
        const box = g.boundingBox!;
        const centre = box.getCenter(new THREE.Vector3());
        const extent = box.getSize(new THREE.Vector3());
        const s = 2 / Math.max(extent.x, extent.y, extent.z);
        g.translate(-centre.x, -centre.y, -centre.z);
        g.scale(s, s, s);
        const sampler = new MeshSurfaceSampler(new THREE.Mesh(g)).build();
        const p = new THREE.Vector3();
        const n = new THREE.Vector3();
        const sin = Math.sin(SEEN_YAW);
        const cos = Math.cos(SEEN_YAW);
        const across = new Float32Array(count);
        let lo = Infinity;
        let hi = -Infinity;
        let i = 0;
        const step = () => {
          if (disposed) return;
          const end = Math.min(count, i + 6000);
          for (; i < end; i++) {
            sampler.sample(p, n);
            attrs.bull.set([p.x, p.y, p.z], i * 3);
            attrs.bullN.set([n.x, n.y, n.z], i * 3);
            const q = p.x * cos + p.z * sin;
            across[i] = q;
            if (q < lo) lo = q;
            if (q > hi) hi = q;
          }
          if (i < count) {
            timer = window.setTimeout(step, 0);
            return;
          }
          // Each point takes the place on the mark that sits under it, so the
          // cloud closes up rather than crossing over itself, and keeps its
          // colour, which runs left to right on both.
          for (let k = 0; k < count; k++) {
            const t = Math.min(1, Math.max(0, (across[k] - lo) / Math.max(1e-6, hi - lo) + (hash(k, 29.3) - 0.5) * 0.08));
            const [mx, my] = markAt(t);
            attrs.mark.set([mx, my, t], k * 3);
          }
          for (const geo of [dotGeo, glowGeo]) {
            geo.attributes.aBull.needsUpdate = true;
            geo.attributes.aBullN.needsUpdate = true;
            geo.attributes.aMark.needsUpdate = true;
          }
          g.dispose();
          onBullRef.current?.(true);
        };
        step();
      } catch {
        // No model: the 2D scene keeps drawing its own bull underneath.
        onBullRef.current?.(false);
      }
    })();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [attrs, count, dotGeo, glowGeo]);

  const pointsRef = useRef<(THREE.Object3D | null)[]>([]);
  const pose = useMemo(
    () => ({
      q: new THREE.Quaternion(),
      e: new THREE.Euler(),
      p: new THREE.Vector3(),
      s: new THREE.Vector3(),
      cam: new THREE.Vector3(0, 0, 5),
      look: new THREE.Vector3(),
      px: 0,
      py: 0,
    }),
    []
  );

  useFrame((state) => {
    const f = matterAt(cinemaClock.progress);
    const dt = cinemaClock.dt;
    pose.px += (cinemaClock.px - pose.px) * damp(0.05, dt);
    pose.py += (cinemaClock.py - pose.py) * damp(0.05, dt);
    shared.uStage.value = f.stage;
    shared.uTime.value = cinemaClock.time;
    shared.uPixelRatio.value = state.gl.getPixelRatio();
    shared.uBirth.value = f.birth;
    shared.uChop.value = f.chop;
    shared.uTrend.value = f.trend;
    shared.uPour.value = f.pour;
    shared.uMeander.value = f.glide;
    shared.uCurtain.value = f.curtain;
    deep.uOn.value = f.deep;
    deep.cloudOn.value = f.cloud;
    pointsRef.current.forEach((pt) => {
      if (pt) pt.visible = f.stage === 0 ? cinemaClock.progress < 0.37 : f.ringOn > 0;
    });
    shared.uRingOn.value = f.ringOn;
    shared.uSwarm.value = f.swarm;
    shared.uMark.value = f.mark;
    shared.uFade.value = f.fade;
    const { ring, mark, head } = cinemaClock.stage;
    // The line feeds the candle being printed, wherever the camera has it.
    if (head) {
      shared.uPourAt.value.set(head[0], head[1]);
      shared.uPourU.value = Math.min(1, Math.max(0, 0.5 + (head[0] * shared.uHalf.value.x) / (2 * shared.uLen.value)));
    }
    if (ring) {
      shared.uRingC.value.set(ring[0], ring[1]);
      shared.uRingR.value.set(ring[2], ring[3]);
    }
    if (mark) shared.uMarkBox.value.set(mark[0], mark[1], mark[2], mark[3]);

    // The camera. Square on when the line lands and when it has to read as a
    // chart; between those it comes down and flies along it.
    const cam = state.camera;
    const len = shared.uLen.value;
    const riverY = shared.uRiverY.value;
    const along = Math.min(1, Math.max(0, (cinemaClock.progress - 0.178) / 0.062)) * 1.25;
    pose.cam.set(
      THREE.MathUtils.lerp(0, -len * 0.66 + along, f.glide) - pose.px * 0.07,
      THREE.MathUtils.lerp(0, riverY + 0.2, f.glide) + pose.py * 0.05,
      THREE.MathUtils.lerp(5, 1.75, f.glide)
    );
    pose.look.set(
      THREE.MathUtils.lerp(0, len * 0.2 + along, f.glide),
      THREE.MathUtils.lerp(0, riverY + 0.04, f.glide),
      THREE.MathUtils.lerp(0, -0.3, f.glide)
    );
    cam.position.copy(pose.cam);
    cam.lookAt(pose.look);
    shared.uFocus.value = THREE.MathUtils.lerp(5, pose.cam.distanceTo(pose.look) * 0.9, f.glide);
    shared.uAperture.value = THREE.MathUtils.lerp(0.6, 15, f.glide);
    deep.drift.value.set(pose.cam.x * 0.08, pose.cam.y * 0.08);

    // The bull stands in the right third, turns a little as it holds the
    // stage, and turns further as it goes. It watches the pointer.
    const halfW = shared.uHalf.value.x;
    const scale = Math.min(1.42, halfW * 0.58);
    pose.e.set(0.12 - pose.py * 0.1, -0.92 + f.hold * 0.22 + pose.px * 0.28, 0, "YXZ");
    pose.q.setFromEuler(pose.e);
    pose.p.set(halfW * 0.42 - f.charge * halfW * 0.05, -0.32 + Math.sin(cinemaClock.time * 1.05) * 0.012, f.charge * 0.25);
    pose.s.setScalar(scale);
    shared.uBullM.value.compose(pose.p, pose.q, pose.s);
  });

  return (
    <>
      <mesh geometry={deep.quad} material={deep.cloud} frustumCulled={false} renderOrder={-3} />
      <points geometry={deep.geo} material={deep.mat} frustumCulled={false} renderOrder={-2} />
      <points ref={(el) => void (pointsRef.current[0] = el)} geometry={glowGeo} material={glow} frustumCulled={false} />
      <points ref={(el) => void (pointsRef.current[1] = el)} geometry={dotGeo} material={dots} frustumCulled={false} />
      <FilmDriver active={active} />
      <FilmDpr max={2} />
    </>
  );
}

export default function FilmMatter({
  active,
  onReady,
  onLost,
  onBull,
}: {
  active: boolean;
  onReady?: () => void;
  onLost?: () => void;
  /** The model has been sampled (or could not be). */
  onBull?: (ok: boolean) => void;
}) {
  return (
    <Canvas
      className="h-full w-full"
      dpr={[1, 2]}
      frameloop="never"
      gl={{ alpha: true, antialias: false, powerPreference: "high-performance", premultipliedAlpha: true }}
      camera={{ fov: 34, position: [0, 0, 5], near: 0.1, far: 50 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        onReady?.();
        watchContext(gl.domElement, onLost, onReady);
      }}
      fallback={null}
    >
      <Matter active={active} onBull={onBull} />
    </Canvas>
  );
}

"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { BlendFunction, Effect } from "postprocessing";

/**
 * THE GRADE, the first real one (2026-11, Gate A2). Runs after ToneMapping in
 * each of the film's three composers. The tone mapping is not a grade: Neutral
 * rolls the highlights off, and on the way it turned the crash coral (measured
 * ~354° against the token's 345°, at two-thirds of its saturation) and left
 * 11–34px steps in the dark gradients. This puts three things back:
 *
 * - HUE ANCHORS. Pixels near the loss red or the gain green are pulled back to
 *   the --bear / --bull tokens' hue and saturation, so the 3D's red is the same
 *   red as the hero and the 2D floor. Red only ever means loss in this film.
 * - DITHER. One step of interleaved-gradient noise in sRGB space, where the
 *   8-bit banding actually happens (dithering linear values amplifies them
 *   near black ~13x and lifts the blacks).
 * - TOE. A lift in the darks only, for the dive (d04), where the corridor's
 *   shadows crushed to a flat black under the headline. A gamma bend, so pure
 *   black stays the page's black and the 3D never reads as a grey veil over
 *   the 2D scene it crossfades with.
 *
 * THE MATTER plan's M27 grows this into the per-act grade on the cinema clock.
 */

const fragmentShader = /* glsl */ `
uniform vec3 uBear;   // linear-space HSV of the --bear token
uniform vec3 uBull;   // linear-space HSV of the --bull token
uniform float uToe;
uniform float uFrame;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 toLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
// Signed shortest hue step from a to b, in turns.
float hueStep(float a, float b) {
  float d = b - a;
  return d - floor(d + 0.5);
}
vec3 anchor(vec3 hsv, vec3 token) {
  float d = hueStep(hsv.x, token.x);
  float w = (1.0 - smoothstep(0.035, 0.085, abs(d))) * smoothstep(0.18, 0.4, hsv.y);
  hsv.x = fract(hsv.x + d * w);
  hsv.y = mix(hsv.y, max(hsv.y, token.y * 0.94), w);
  return hsv;
}
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = clamp(inputColor.rgb, 0.0, 1.0);
  vec3 hsv = rgb2hsv(c);
  hsv = anchor(hsv, uBear);
  hsv = anchor(hsv, uBull);
  c = hsv2rgb(hsv);
  vec3 s = toSRGB(c);
  float luma = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s = mix(s, pow(s, vec3(1.0 - uToe)), 1.0 - smoothstep(0.0, 0.4, luma));
  s += (ign(gl_FragCoord.xy + vec2(uFrame * 5.588, uFrame * 9.237)) - 0.5) / 255.0;
  outputColor = vec4(toLinear(clamp(s, 0.0, 1.0)), inputColor.a);
}
`;

function tokenHSV(name: string, fallback: string): THREE.Vector3 {
  let css = fallback;
  if (typeof document !== "undefined") {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (v) css = v;
  }
  const color = new THREE.Color();
  try {
    color.setStyle(css); // three converts the sRGB token to its linear working space
  } catch {
    color.setStyle(fallback);
  }
  // HSV from the linear RGB the shader also works in.
  const { r, g, b } = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return new THREE.Vector3(h, max > 0 ? d / max : 0, max);
}

class GradeEffect extends Effect {
  constructor(toe: number) {
    super("GradeEffect", fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ["uBear", new THREE.Uniform(tokenHSV("--bear", "#ff2e63"))],
        ["uBull", new THREE.Uniform(tokenHSV("--bull", "#52ffa5"))],
        ["uToe", new THREE.Uniform(toe)],
        ["uFrame", new THREE.Uniform(0)],
      ]),
    });
  }
  update() {
    const u = this.uniforms.get("uFrame")!;
    u.value = (u.value + 1) % 64;
  }
}

/** The film's grade; put it after <ToneMapping /> and before <SMAA />. `toe`
 *  0..~0.25 bends the darks up (0 = none). */
export function Grade({ toe = 0 }: { toe?: number }) {
  const effect = useMemo(() => new GradeEffect(toe), [toe]);
  return <primitive object={effect} dispose={null} />;
}

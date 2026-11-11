"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { WebGLRenderTarget, type Object3D } from "three";
import { cinemaClock, registerFilmFrame } from "@/lib/cinema-clock";

/**
 * Puts a film layer's <Canvas> on the film's one clock (Phase 4, M31). The
 * canvas runs frameloop="never"; while the layer is live this registers its
 * root's `advance`, and ScrollCinema's tick draws it in the same frame as the
 * 2D scene with the film's own time (cinemaClock.time), so ambient motion
 * stops when the film is parked or the site is paused.
 *
 * It also warms the layer's shaders the moment the layer mounts, off the main
 * thread where the driver allows (compileAsync, KHR_parallel_shader_compile),
 * so the first frame of an act does not stall on compiling the glass. Place it
 * after the layer's scene content, before the composer.
 *
 * compile() walks only VISIBLE objects, so everything an act hides until its
 * beat (the floor, the crash shards) used to compile, and
 * upload its buffers, on the frame it first appeared, mid-act (Gate A4 #2).
 * The warm-up shows them for the length of the compile and, while the layer
 * is still off screen, one plain draw, which also allocates the targets and
 * uploads the geometry; then it hides them again before anything can paint.
 */
export function FilmDriver({ active }: { active: boolean }) {
  const advance = useThree((s) => s.advance);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    // three reads every shader's compile log on the spot to report errors,
    // which forces a synchronous compile and defeats the parallel one below.
    // Development keeps the checks; production does not pay for them (Stage 2, F2).
    gl.debug.checkShaderErrors = process.env.NODE_ENV !== "production";
    // Everything is shown for as long as a call takes and hidden again before
    // the browser can paint, so hidden objects compile and upload too.
    const showAll = () => {
      const hidden: Object3D[] = [];
      scene.traverse((o) => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
      });
      return () => {
        for (const o of hidden) o.visible = false;
      };
    };
    let cancelled = false;
    const hide = showAll();
    // compileAsync gathers the programs now and links them off the main
    // thread where the driver allows (KHR_parallel_shader_compile). Twice:
    // for the screen, and for a render target, because a layer under a
    // post-processing chain draws into the composer's target, where three
    // builds every material without tone mapping. Only the screen variants
    // used to be warmed, so the candle act linked five programs (the glass
    // among them) on its first visible frame at film 0.321, a 74 ms stall.
    const compile = () => (gl.compileAsync ? gl.compileAsync(scene, camera) : Promise.resolve());
    const toScreen = compile();
    const target = new WebGLRenderTarget(1, 1);
    const previous = gl.getRenderTarget();
    gl.setRenderTarget(target);
    const toTarget = compile(); // the program variants are chosen during this call
    gl.setRenderTarget(previous);
    target.dispose();
    const compiled = Promise.all([toScreen, toTarget]);
    hide();
    // Then, once they are linked, one whole frame of the layer, post-processing
    // included, while its wrapper is still transparent: a plain gl.render left
    // the composer's passes to compile on the first visible frame (a 45 ms
    // hitch at film 0.320), and drawing before the link finished forced every
    // program to compile on the spot (F2). A layer mounted inside its window
    // skips it.
    // In its own idle slot: both layers' compiles finish together, and their
    // two warm frames back to back in one task were 130 ms of frame zero not
    // moving at the first wheel step.
    const warm = () => {
      if (cancelled || activeRef.current) return;
      const hideAgain = showAll();
      advance(cinemaClock.time);
      hideAgain();
    };
    compiled
      .catch(() => {})
      .then(() => {
        if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(warm, { timeout: 1500 });
        else setTimeout(warm, 60);
      });
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, advance]);
  useEffect(() => (active ? registerFilmFrame((t) => advance(t)) : undefined), [active, advance]);
  return null;
}

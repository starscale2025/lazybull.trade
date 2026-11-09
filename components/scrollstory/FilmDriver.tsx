"use client";

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type { Object3D } from "three";
import { registerFilmFrame } from "@/lib/cinema-clock";

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
    const hidden: Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    gl.compileAsync?.(scene, camera).catch(() => {});
    // The layer's wrapper is transparent until its window, so this draw is
    // never seen; a layer mounted inside its window skips it.
    if (!activeRef.current) gl.render(scene, camera);
    for (const o of hidden) o.visible = false;
  }, [gl, scene, camera]);
  useEffect(() => (active ? registerFilmFrame((t) => advance(t)) : undefined), [active, advance]);
  return null;
}

"use client";

// Targeted real-3D "hero moment": the bull act (progress ~0.71–0.85) rendered as
// a dark sculpture under green/cyan rim light + bloom, replacing the 2D particle
// bull. Reads the shared cinemaClock in useFrame (one-clock rule) — no per-frame
// React state. The whole layer's DOM opacity is crossfaded by ScrollCinema via
// bull3dOpacity(), so it dissolves into the 2D Matrix rain underneath.

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, ContactShadows } from "@react-three/drei";
import { EffectComposer, Bloom, SMAA } from "@react-three/postprocessing";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { cinemaClock } from "@/lib/cinema-clock";
import { BULL3D } from "@/lib/cinema";

// Model: "Bull" by Poly by Google — CC BY 3.0 (via poly.pizza/m/fWsIqDIIJ5S).
// Attribution required; see public/models/CREDITS.md.
const MODEL = "/models/bull.glb";
useGLTF.preload(MODEL);

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function Bull() {
  const { scene } = useGLTF(MODEL);
  const group = useRef<THREE.Group>(null);

  // Skeleton-safe clone (the GLB is rigged; plain clone breaks the skinned bind),
  // fit into a ~2.6-unit height standing on y=0 and centered on x/z, and override
  // every material with one dark sculptural surface (the GLB ships no textures).
  const fitted = useMemo(() => {
    const root = skeletonClone(scene);
    // Bounds from geometry (Box3.setFromObject is unreliable on skinned meshes).
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const tmp = new THREE.Box3();
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        tmp.copy(m.geometry.boundingBox as THREE.Box3).applyMatrix4(m.matrixWorld);
        box.union(tmp);
      }
    });
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const s = 2.6 / size.y;
    root.scale.multiplyScalar(s);
    root.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    const mat = new THREE.MeshStandardMaterial({
      color: "#0a0d0b",
      roughness: 0.4,
      metalness: 0.45,
    });
    // Fresnel edge-glow: a continuous green→cyan rim on the silhouette (independent
    // of light angle) so the sculpture always reads against the black + feeds bloom.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float _fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 4.5);
         vec3 _rim = mix(vec3(0.0, 1.0, 0.529), vec3(0.0, 0.898, 1.0), clamp(normal.x * 0.5 + 0.5, 0.0, 1.0));
         totalEmissiveRadiance += _rim * _fres * 0.7;`
      );
    };
    mat.customProgramCacheKey = () => "bull-fresnel";
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = mat;
    });
    return root;
  }, [scene]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = cinemaClock.progress;
    // Local time across the whole bull layer window.
    const bt = clamp((p - BULL3D.in0) / (BULL3D.out1 - BULL3D.in0), 0, 1);
    // Emergence: rise + settle over the first third, then a slow turntable.
    const rise = smooth(0, 0.34, bt);
    g.position.y = (1 - rise) * -1.1;
    g.scale.setScalar(0.92 + 0.08 * rise);
    g.rotation.y = -0.62 + bt * 0.7; // slow, presenting a 3/4 profile
  });

  return (
    <group ref={group}>
      <primitive object={fitted} />
    </group>
  );
}

function Rig() {
  useFrame((state) => {
    const bt = clamp(
      (cinemaClock.progress - BULL3D.in0) / (BULL3D.out1 - BULL3D.in0),
      0,
      1
    );
    // Gentle dolly-in through the beat.
    const z = 5.3 - 0.7 * smooth(0, 1, bt);
    state.camera.position.set(2.5, 1.55, z);
    state.camera.lookAt(0, 1.15, 0);
  });
  return null;
}

export default function Bull3D({
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
      camera={{ fov: 34, position: [2.5, 1.55, 5.3], near: 0.1, far: 60 }}
      onCreated={() => onReady?.()}
      fallback={null}
    >
      <color attach="background" args={["#050505"]} />
      <fog attach="fog" args={["#050505", 7, 16]} />

      {/* Dim ambient so recesses aren't pure black */}
      <ambientLight intensity={0.12} />
      {/* Key: soft cool-white, front-top-left */}
      <directionalLight position={[3.5, 5, 4]} intensity={2.1} color="#dfeee7" />
      {/* Rim: bright green from behind-right → sculptural edge glow */}
      <directionalLight position={[-4.5, 2.4, -3.2]} intensity={5} color="#00ff87" />
      {/* Rim: subtle cyan accent from behind-left (kept low so the rear stays dark
          and sculptural, not flat teal) */}
      <directionalLight position={[4.8, 1.4, -4.2]} intensity={1.5} color="#00e5ff" />

      <Suspense fallback={null}>
        <Bull />
      </Suspense>

      {/* Soft green contact shadow to ground the sculpture */}
      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.55}
        scale={9}
        blur={2.6}
        far={4}
        resolution={512}
        color="#00160c"
      />

      <Rig />

      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          luminanceThreshold={0.55}
          luminanceSmoothing={0.25}
          intensity={0.85}
        />
        <SMAA />
      </EffectComposer>
    </Canvas>
  );
}

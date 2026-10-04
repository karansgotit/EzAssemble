"use client";

import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type ComponentRef, type RefObject } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import { fitDistance, type Bounds } from "./geometry";
import type { Vec3 } from "./types";

const GLIDE_SECONDS = 0.75;
const MARGIN = 1.18; // air around the framed parts
const MIN_DISTANCE_CM = 45;
// Front-left-above, like the manual's drawings; lower and more head-on once the unit stands.
const VIEW_LYING: Vec3 = [-0.6, 1, 1.2];
const VIEW_STANDING: Vec3 = [-0.65, 0.45, 1.5];

interface Glide {
  elapsed: number;
  fromPosition: Vector3;
  toPosition: Vector3;
  fromTarget: Vector3;
  toTarget: Vector3;
}

interface CameraRigProps {
  bounds: Bounds;
  frameKey: string;
  standing: boolean;
  lookAt: RefObject<Vector3 | null>; // owned by the canvas, so the view survives a step change
}

// Frames `bounds` whenever `frameKey` changes, then leaves the camera to the user's orbiting.
export function CameraRig({ bounds, frameKey, standing, lookAt }: CameraRigProps) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const glide = useRef<Glide | null>(null);
  const latest = useRef(bounds);
  latest.current = bounds;

  useEffect(() => {
    const { min, max } = latest.current;
    const toTarget = new Vector3(...min).add(new Vector3(...max)).multiplyScalar(0.5);
    const vertical = ((camera instanceof PerspectiveCamera ? camera.fov : 30) * Math.PI) / 180;
    const direction = standing ? VIEW_STANDING : VIEW_LYING;
    // Fit the parts to the picture as seen from this direction, so every step fills it alike.
    const fitted = fitDistance(latest.current, direction, vertical, size.width / Math.max(1, size.height));
    const distance = Math.max(MIN_DISTANCE_CM, fitted * MARGIN);
    const view = new Vector3(...direction).normalize();
    const fromTarget = lookAt.current?.clone() ?? toTarget.clone();
    controls.current?.target.copy(fromTarget);
    glide.current = {
      elapsed: 0,
      fromPosition: camera.position.clone(),
      toPosition: toTarget.clone().addScaledVector(view, distance),
      fromTarget,
      toTarget,
    };
  }, [frameKey, standing, size.width, size.height, camera, lookAt]);

  useFrame((_, delta) => {
    if (!controls.current) return;
    lookAt.current = (lookAt.current ?? new Vector3()).copy(controls.current.target);
    const g = glide.current;
    if (!g) return;
    g.elapsed += delta;
    // Ease in as well as out, so the view does not lurch as a step opens.
    const through = Math.min(1, g.elapsed / GLIDE_SECONDS);
    const eased = through < 0.5 ? 4 * through ** 3 : 1 - Math.pow(-2 * through + 2, 3) / 2;
    camera.position.lerpVectors(g.fromPosition, g.toPosition, eased);
    controls.current.target.lerpVectors(g.fromTarget, g.toTarget, eased);
    controls.current.update();
    if (eased >= 1) glide.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      minDistance={25}
      maxDistance={1100}
      maxPolarAngle={Math.PI * 0.49}
      onStart={() => {
        glide.current = null;
      }}
    />
  );
}

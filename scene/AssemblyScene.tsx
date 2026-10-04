"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Vector3 } from "three";
import { CameraRig } from "./CameraRig";
import { COLORS } from "./constants";
import { Ghost } from "./Ghost";
import { add, boundsOf, cornersOf, rotate, type Bounds, type Cuboid } from "./geometry";
import { MotionGuide } from "./MotionGuide";
import { PartMesh } from "./PartMesh";
import { ASSEMBLY_ID, assemblyBounds, resolveScene, type AssemblyPose } from "./resolveScene";
import { buildTracks, sample, type Pose } from "./tracks";
import type { SceneManual } from "./types";

// docs/CONTRACTS.md §7. The player loads this with next/dynamic and ssr: false.
export interface AssemblySceneProps {
  manual: SceneManual;
  stepIndex: number; // 0-based into manual.steps
  playKey: number; // increment → restart animation
  playing: boolean;
  speed: 0.5 | 1 | 2;
  scrubT: number | null; // 0..1 overrides time; null = play
  showTrap: boolean;
  onProgress: (t: number) => void;
  onDone: () => void;
}

const MAX_FRAME_SECONDS = 0.1; // a background tab must not make the animation jump
const REPORT_EVERY_SECONDS = 0.03;

// The box that holds `bounds` once the whole assembly has been turned and moved by `pose`.
function boundsInWorld(bounds: Bounds, pose: AssemblyPose): Bounds {
  const corners = cornersOf(bounds).map((c): Cuboid => ({ position: add(rotate(c, pose.quaternion), pose.position), size: [0, 0, 0] }));
  return boundsOf(corners, bounds);
}

type WorldProps = AssemblySceneProps & { lookAt: RefObject<Vector3 | null> };

function World({ manual, stepIndex, playKey, playing, speed, scrubT, showTrap, onProgress, onDone, lookAt }: WorldProps) {
  const { before, after, tracks, totalDuration } = useMemo(() => {
    const before = resolveScene(manual, stepIndex - 1);
    const after = resolveScene(manual, stepIndex);
    return { before, after, ...buildTracks(manual, before, after) };
  }, [manual, stepIndex]);

  useEffect(() => {
    for (const warning of after.warnings) console.warn(`[scene] ${warning}`);
  }, [after]);

  const clock = useRef(0);
  const finished = useRef(false);
  const reported = useRef(-1);
  const [time, setTime] = useState(0);

  useFrame((_, delta) => {
    if (scrubT !== null) {
      clock.current = Math.max(0, Math.min(1, scrubT)) * totalDuration;
      finished.current = false;
    } else if (playing) {
      clock.current = Math.min(totalDuration, clock.current + Math.min(delta, MAX_FRAME_SECONDS) * speed);
    }
    setTime(clock.current);
    const atEnd = clock.current >= totalDuration;
    if (Math.abs(clock.current - reported.current) > REPORT_EVERY_SECONDS || (atEnd && reported.current !== clock.current)) {
      reported.current = clock.current;
      onProgress(clock.current / totalDuration);
    }
    if (atEnd && scrubT === null && !finished.current) {
      finished.current = true;
      onDone();
    }
  });

  const poses = sample(tracks, time);
  const flipping = tracks.some((t) => t.id === ASSEMBLY_ID);
  const assembly: AssemblyPose = poses.get(ASSEMBLY_ID) ?? after.assembly;
  const flipDone = !flipping || time >= totalDuration;
  const standing = flipDone && after.assembly.quaternion[3] !== 1;
  const lying = before.assembly.quaternion[3] === 1 && after.assembly.quaternion[3] === 1;
  const current = new Set(flipping ? after.placed.keys() : tracks.map((t) => t.id));
  const step = manual.steps[stepIndex];
  const trapPiece = step?.trap ? [...after.placed.values()].find((p) => p.partId === step.trap?.part) : undefined;

  // What the camera should hold in view: this step's pieces (where they start and where they
  // land) and what they attach to; the whole build on the first step and on a flip.
  const focus = useMemo(() => {
    const everything = stepIndex <= 0 || flipping || tracks.length === 0;
    if (everything) return assemblyBounds(after, manual);
    const boxes: Cuboid[] = [];
    for (const { action, ids } of after.stepActions[after.stepActions.length - 1] ?? []) {
      const target = action.target === undefined ? undefined : after.placed.get(`${action.target}#1`);
      if (target) boxes.push(target);
      for (const id of ids) {
        const piece = after.placed.get(id);
        if (piece) boxes.push(piece);
      }
    }
    for (const track of tracks) {
      const piece = after.placed.get(track.id);
      if (piece) boxes.push({ position: track.from.position, size: piece.size });
    }
    return boundsOf(boxes, assemblyBounds(after, manual));
  }, [after, flipping, manual, stepIndex, tracks]);

  const [length, , width] = manual.buildSizeCm;
  const still: Pose = { position: [0, 0, 0], quaternion: [0, 0, 0, 1], spin: 0, opacity: 1 };

  return (
    <>
      <color attach="background" args={[COLORS.background]} />
      <hemisphereLight args={["#ffffff", "#c6c2b8", 2.2]} />
      <directionalLight position={[-80, 180, 100]} intensity={2.5} />

      <group position={assembly.position} quaternion={assembly.quaternion}>
        {[...after.placed.values()].map((piece) => (
          <PartMesh
            key={piece.id}
            piece={piece}
            pose={poses.get(piece.id) ?? { ...still, position: piece.position, quaternion: piece.quaternion, spin: piece.spin }}
            current={current.has(piece.id)}
          />
        ))}
        {tracks.map((track) => (
          <MotionGuide key={`${track.id}-${track.start}`} track={track} time={time} />
        ))}
        {showTrap && step?.trap && trapPiece && <Ghost piece={trapPiece} trap={step.trap} time={time} />}
      </group>

      {lying && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[length / 2, -0.3, width / 2]}>
          <planeGeometry args={[length * 1.2, width * 1.4]} />
          <meshStandardMaterial color={COLORS.floor} roughness={1} />
        </mesh>
      )}
      <ContactShadows position={[length / 2, -0.6, width / 2]} scale={length * 2.2} opacity={0.22} blur={2.8} far={length * 1.2} resolution={256} />

      <CameraRig
        bounds={standing ? boundsInWorld(focus, after.assembly) : focus}
        frameKey={`${manual.id}-${stepIndex}-${playKey}`}
        standing={standing}
        lookAt={lookAt}
      />
    </>
  );
}

export function AssemblyScene(props: AssemblySceneProps) {
  const lookAt = useRef<Vector3 | null>(null);
  return (
    <Canvas
      camera={{ position: [-110, 220, 290], fov: 30, near: 0.1, far: 2500 }}
      dpr={[1, 2]}
      fallback={<p>3D needs WebGL. You can still follow the original diagrams.</p>}
    >
      {/* Re-mounting on step change or replay resets the clock; the scene is rebuilt from data. */}
      <World key={`${props.manual.id}-${props.stepIndex}-${props.playKey}`} {...props} lookAt={lookAt} />
    </Canvas>
  );
}

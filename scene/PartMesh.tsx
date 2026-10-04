"use client";

import { Edges } from "@react-three/drei";
import { memo } from "react";
import { EDGE_WIDTH, type SceneColors } from "./constants";
import { FeatureMarker } from "./FeatureMarker";
import { NO_ROTATION, cylinderIn, turnOnto } from "./geometry";
import type { Placed } from "./resolveScene";
import type { Pose } from "./tracks";
import { useSceneColors } from "./useSceneColors";
import { HARDWARE_KINDS, type Feature, type PartKind, type Vec3 } from "./types";

const HEADED: PartKind[] = ["screw", "camBolt", "nail"]; // a wider head on the outer end
const SLOTTED: PartKind[] = ["screw", "camBolt", "cam"]; // a drive slot, so turning shows
const AXES: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function fillOf(piece: Placed, current: boolean, colors: SceneColors): string {
  if (piece.kind === "dowel") return colors.wood;
  if (HARDWARE_KINDS.includes(piece.kind)) return colors.steel;
  return current ? colors.current : colors.previous;
}

const NO_FEATURES: Feature[] = [];

// One piece: a box or cylinder with drawn edges, at the pose it has this frame. Memoised: a
// big manual has hundreds of pieces and only this step's few move, so the rest are not
// redrawn by React on every frame.
export const PartMesh = memo(function PartMesh({ piece, pose, current, features = NO_FEATURES }: { piece: Placed; pose: Pose; current: boolean; features?: Feature[] }) {
  const colors = useSceneColors();
  const hardware = HARDWARE_KINDS.includes(piece.kind);
  const box = piece.shape === "box" && !hardware;
  // Hardware is sized along its own axis (+y, turned by its pose). A round leg is given as the
  // box it fills, so it runs along that box's longest side.
  const round = hardware ? { axis: 1, radius: piece.size[0] / 2, length: piece.size[1] } : cylinderIn(piece.size);
  const fill = fillOf(piece, current, colors);
  const steel = hardware && piece.kind !== "dowel";
  const edge = current || hardware ? colors.edgeStrong : colors.edge;
  const edgeWidth = hardware ? EDGE_WIDTH.hardware : current ? EDGE_WIDTH.current : EDGE_WIDTH.previous;
  const faded = pose.opacity < 1;
  return (
    <group position={pose.position} quaternion={pose.quaternion}>
      <group quaternion={box ? NO_ROTATION : turnOnto([0, 1, 0], AXES[round.axis])}>
        <group rotation={[0, pose.spin, 0]}>
          <mesh>
            {box ? <boxGeometry args={piece.size} /> : <cylinderGeometry args={[round.radius, round.radius, round.length, 16]} />}
            <meshStandardMaterial
              color={fill}
              roughness={steel ? 0.45 : 0.9}
              metalness={steel ? 0.35 : 0}
              transparent={faded}
              opacity={pose.opacity}
              depthWrite={!faded}
            />
            <Edges color={edge} lineWidth={edgeWidth} transparent={faded} opacity={pose.opacity} />
          </mesh>
          {HEADED.includes(piece.kind) && (
            <mesh position={[0, round.length / 2, 0]}>
              <cylinderGeometry args={[round.radius * 1.8, round.radius * 1.8, 0.8, 16]} />
              <meshStandardMaterial color={colors.steel} transparent={faded} opacity={pose.opacity} />
              <Edges color={colors.edgeStrong} lineWidth={EDGE_WIDTH.hardware} />
            </mesh>
          )}
          {SLOTTED.includes(piece.kind) && (
            <mesh position={[0, round.length / 2 + 0.45, 0]}>
              <boxGeometry args={[round.radius * (HEADED.includes(piece.kind) ? 2.5 : 1.6), 0.1, 0.35]} />
              <meshBasicMaterial color={colors.edgeStrong} transparent={faded} opacity={pose.opacity} />
            </mesh>
          )}
        </group>
      </group>
      {box && features.length > 0 && <FeatureMarker size={piece.size} features={features} opacity={pose.opacity} />}
    </group>
  );
});

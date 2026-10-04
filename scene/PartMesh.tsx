"use client";

import { Edges } from "@react-three/drei";
import { COLORS } from "./constants";
import type { Placed } from "./resolveScene";
import type { Pose } from "./tracks";

const HEADED = ["screw", "camBolt", "nail"];

function fillOf(piece: Placed, current: boolean): string {
  if (piece.kind === "dowel") return COLORS.wood;
  if (piece.shape === "cylinder" && piece.kind !== "leg") return COLORS.steel;
  return current ? COLORS.current : COLORS.previous;
}

// One piece: a box or cylinder with drawn edges, at the pose it has this frame.
export function PartMesh({ piece, pose, current }: { piece: Placed; pose: Pose; current: boolean }) {
  const [width, height, depth] = piece.size;
  const solid = piece.shape === "box";
  const metal = fillOf(piece, current) === COLORS.steel;
  const edge = current || !solid ? COLORS.edgeStrong : COLORS.edge;
  const faded = pose.opacity < 1;
  return (
    <group position={pose.position} quaternion={pose.quaternion}>
      <group rotation={[0, pose.spin, 0]}>
        <mesh>
          {solid ? <boxGeometry args={[width, height, depth]} /> : <cylinderGeometry args={[width / 2, width / 2, height, 16]} />}
          <meshStandardMaterial
            color={fillOf(piece, current)}
            roughness={metal ? 0.4 : 0.85}
            metalness={metal ? 0.5 : 0}
            transparent={faded}
            opacity={pose.opacity}
            depthWrite={!faded}
          />
          <Edges color={edge} lineWidth={current ? 1.7 : 1} transparent={faded} opacity={pose.opacity} />
        </mesh>
        {HEADED.includes(piece.kind) && (
          <group position={[0, height / 2, 0]}>
            <mesh>
              <cylinderGeometry args={[width * 0.9, width * 0.9, 0.8, 16]} />
              <meshStandardMaterial color={COLORS.steel} transparent={faded} opacity={pose.opacity} />
              <Edges color={COLORS.edgeStrong} />
            </mesh>
            {/* The drive slot, so a turning screw visibly turns. */}
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[width * 1.25, 0.1, 0.35]} />
              <meshBasicMaterial color={COLORS.edgeStrong} transparent={faded} opacity={pose.opacity} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

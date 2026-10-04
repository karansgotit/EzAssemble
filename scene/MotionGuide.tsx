"use client";

import { Line } from "@react-three/drei";
import { COLORS } from "./constants";
import { alongNormal, mix, scale, add } from "./geometry";
import type { Track } from "./tracks";
import type { Vec3 } from "./types";

const FADE_SECONDS = 0.25;

// The dashed arrow along a piece's path, like the arrows in the manual's drawings.
export function MotionGuide({ track, time }: { track: Track; time: number }) {
  if (track.pivot || track.verb === "lock") return null;
  const end = track.start + track.duration;
  if (time < track.start || time > end + FADE_SECONDS) return null;

  const travel = add(track.to.position, scale(track.from.position, -1));
  const length = Math.hypot(...travel);
  if (length < 0.01) return null;
  const direction = scale(travel, 1 / length) as Vec3;
  const opacity = 1 - Math.max(0, time - end) / FADE_SECONDS;

  return (
    <group>
      <Line
        points={[track.from.position, track.to.position]}
        color={COLORS.guide}
        lineWidth={1.7}
        dashed
        dashSize={1.5}
        gapSize={1}
        transparent
        opacity={opacity}
      />
      <mesh position={mix(track.from.position, track.to.position, 0.8)} quaternion={alongNormal(direction)}>
        <coneGeometry args={[1.3, 3, 12]} />
        <meshBasicMaterial color={COLORS.guide} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

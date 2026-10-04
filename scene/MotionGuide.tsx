"use client";

import { Line } from "@react-three/drei";
import { GUIDE_DASH_CM, GUIDE_WIDTH } from "./constants";
import { alongNormal, mix, scale, add } from "./geometry";
import type { Track } from "./tracks";
import type { Vec3 } from "./types";
import { useSceneColors } from "./useSceneColors";

const FADE_SECONDS = 0.25;

// The dashed arrow along a piece's path, like the arrows in the manual's drawings.
export function MotionGuide({ track, time }: { track: Track; time: number }) {
  const colors = useSceneColors();
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
        color={colors.guide}
        lineWidth={GUIDE_WIDTH}
        dashed
        dashSize={GUIDE_DASH_CM[0]}
        gapSize={GUIDE_DASH_CM[1]}
        transparent
        opacity={opacity}
      />
      <mesh position={mix(track.from.position, track.to.position, 0.8)} quaternion={alongNormal(direction)}>
        <coneGeometry args={[1.5, 3.6, 16]} />
        <meshBasicMaterial color={colors.guide} transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

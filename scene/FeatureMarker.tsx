"use client";

import { COLORS } from "./constants";
import { turnOnto } from "./geometry";
import { featureMarks } from "./ghostFrames";
import type { Feature, Vec3 } from "./types";

const STRIPE_WIDTH_CM = 0.65;
const LONG_SIDE: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// Drilled-hole dots and finished-edge stripes on a part, drawn in the part's own frame so they
// turn with it. On the ghost they are what makes wrong and right look different.
export function FeatureMarker({ size, features, opacity = 1 }: { size: Vec3; features: Feature[]; opacity?: number }) {
  return (
    <>
      {featureMarks(size, features).map((mark, m) =>
        mark.positions.map((position, i) => (
          <mesh
            key={`${m}-${i}`}
            position={position}
            // Circles and planes face +z; a stripe's length runs along +x.
            quaternion={mark.type === "holes" ? turnOnto([0, 0, 1], mark.normal) : turnOnto([1, 0, 0], LONG_SIDE[mark.longAxis])}
          >
            {mark.type === "holes" ? <circleGeometry args={[mark.radius, 16]} /> : <boxGeometry args={[mark.length, STRIPE_WIDTH_CM, STRIPE_WIDTH_CM]} />}
            <meshBasicMaterial color={mark.type === "holes" ? COLORS.hole : COLORS.guide} transparent opacity={opacity} depthWrite={false} />
          </mesh>
        )),
      )}
    </>
  );
}

import { GHOST_OPACITY, TRAP_FADE_SECONDS, TRAP_SECONDS, TRAP_TURN_SECONDS, TRAP_WRONG_SECONDS } from "./constants";
import {
  FACE_NORMALS, NO_ROTATION, aboutAxis, faceRect, normalAxis, pointsOnFace, slerp, type Quat,
} from "./geometry";
import { easeInOutCubic } from "./tracks";
import type { Face, Feature, SceneTrap, Vec3, WrongOrientation } from "./types";

const UNIT: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// Which axis each kind of mistake turns the part about, in order of preference (0 = x, 1 = y,
// 2 = z), and how far. A turn about the holed face's own normal would leave the holes where
// they are and show nothing, so the first axis that is not that normal is used.
const WRONG_TURN: Record<WrongOrientation, { axes: number[]; radians: number }> = {
  "flipped-horizontal": { axes: [1, 0], radians: Math.PI },
  "flipped-vertical": { axes: [0, 2], radians: Math.PI },
  "rotated-90": { axes: [2, 0], radians: Math.PI / 2 },
};

// How the part is turned, about its own centre, when it is put in the wrong way.
export function wrongRotation(wrong: WrongOrientation, mustFace: Face): Quat {
  const { axes, radians } = WRONG_TURN[wrong] ?? WRONG_TURN["flipped-horizontal"];
  const faceAxis = normalAxis(FACE_NORMALS[mustFace] ?? FACE_NORMALS.top);
  return aboutAxis(UNIT[axes.find((axis) => axis !== faceAxis) ?? axes[0]], radians);
}

// Honest about where the warning comes from: the manual drew it, or the geometry allows it.
export function ghostLabel(trap: SceneTrap, corrected: boolean): string {
  if (corrected) return `✓ ${trap.hint}`;
  return trap.source === "manual" ? "✗ From the manual" : "✗ Possible mistake";
}

export interface GhostFrame {
  quaternion: Quat; // turn about the part's centre; none once it is the right way round
  rightness: number; // 0 = wrong (red) … 1 = right (green)
  opacity: number;
  label: string;
}

// The ghost at `seconds` into the trap: wrong and red, then turning right and green, then
// fading. Undefined once it is over and the step's own motion takes the stage.
export function ghostAt(trap: SceneTrap, seconds: number): GhostFrame | undefined {
  if (seconds >= TRAP_SECONDS) return undefined;
  const turning = Math.max(0, Math.min(1, (seconds - TRAP_WRONG_SECONDS) / TRAP_TURN_SECONDS));
  const rightness = easeInOutCubic(turning);
  const fading = Math.max(0, (seconds - TRAP_WRONG_SECONDS - TRAP_TURN_SECONDS) / TRAP_FADE_SECONDS);
  return {
    quaternion: slerp(wrongRotation(trap.wrong, trap.mustFace), NO_ROTATION, rightness),
    rightness,
    opacity: GHOST_OPACITY * (1 - fading),
    label: ghostLabel(trap, seconds >= TRAP_WRONG_SECONDS),
  };
}

const HOLE_COUNT = 4;
const MAX_HOLE_RADIUS_CM = 0.7;
const LIFT_CM = 0.09; // just off the surface, so the marks do not flicker against it

export interface FeatureMark {
  type: Feature["type"];
  normal: Vec3;
  positions: Vec3[]; // relative to the part's centre
  radius: number; // holes
  length: number; // finished edge: the stripe's length along the face's long side
  longAxis: number;
}

// Where to draw a part's drilled holes (a row of dots) and finished edges (one stripe).
export function featureMarks(size: Vec3, features: Feature[]): FeatureMark[] {
  return features.flatMap((feature): FeatureMark[] => {
    const normal = FACE_NORMALS[feature.face];
    if (!normal) return [];
    const rect = faceRect({ position: [0, 0, 0], size }, feature.face);
    const [u, v] = [0, 1, 2].filter((i) => i !== rect.axis);
    const longAxis = size[u] >= size[v] ? u : v;
    const short = Math.min(size[u], size[v]);
    const lifted = (p: Vec3): Vec3 => p.map((c, i) => c + normal[i] * LIFT_CM) as Vec3;
    const holes = feature.type === "holes";
    return [{
      type: feature.type,
      normal,
      positions: pointsOnFace(rect, holes ? HOLE_COUNT : 1, 0.2, 0.8).map(lifted),
      radius: Math.min(MAX_HOLE_RADIUS_CM, short * 0.4),
      length: size[longAxis] * 0.85,
      longAxis,
    }];
  });
}

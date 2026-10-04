import { Matrix4, Quaternion, Vector3 } from "three";
import type { BuildOrientation, Face, Vec3 } from "./types";

// A rotation as [x, y, z, w]. Plain data, so poses can be compared and tested.
export type Quat = [number, number, number, number];
export const NO_ROTATION: Quat = [0, 0, 0, 1];

// An axis-aligned box in the build frame: centre and full size, in cm.
export interface Cuboid {
  position: Vec3;
  size: Vec3;
}

export interface Bounds {
  min: Vec3;
  max: Vec3;
}

// One face of a cuboid: flat on `axis` at `plane`, spanning min..max on the other two axes.
export interface FaceRect {
  axis: number;
  plane: number;
  min: Vec3;
  max: Vec3;
}

// Build frame (CONTRACTS §4.1): +x right, +y up, +z toward the viewer.
export const FACE_NORMALS: Record<Face, Vec3> = {
  top: [0, 1, 0],
  bottom: [0, -1, 0],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  front: [0, 0, 1],
  back: [0, 0, -1],
};

const AXES = [0, 1, 2];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
export const mix = (a: Vec3, b: Vec3, t: number): Vec3 => add(scale(a, 1 - t), scale(b, t));
export const normalAxis = (normal: Vec3): number => normal.findIndex((n) => n !== 0);

const toQuat = (q: Quaternion): Quat => [q.x, q.y, q.z, q.w];
const fromQuat = (q: Quat): Quaternion => new Quaternion(q[0], q[1], q[2], q[3]);

export function boundsOfCuboid(box: Cuboid): Bounds {
  return {
    min: box.position.map((c, i) => c - box.size[i] / 2) as Vec3,
    max: box.position.map((c, i) => c + box.size[i] / 2) as Vec3,
  };
}

export function faceRect(box: Cuboid, face: Face): FaceRect {
  const normal = FACE_NORMALS[face];
  const axis = normalAxis(normal);
  const { min, max } = boundsOfCuboid(box);
  const plane = normal[axis] > 0 ? max[axis] : min[axis];
  min[axis] = plane;
  max[axis] = plane;
  return { axis, plane, min, max };
}

// The part of a face that another part's footprint covers: where the two meet.
// Undefined when the other part does not sit over this face at all.
export function jointStrip(rect: FaceRect, other: Cuboid): FaceRect | undefined {
  const footprint = boundsOfCuboid(other);
  const min: Vec3 = [...rect.min];
  const max: Vec3 = [...rect.max];
  for (const i of AXES) {
    if (i === rect.axis) continue;
    min[i] = Math.max(min[i], footprint.min[i]);
    max[i] = Math.min(max[i], footprint.max[i]);
    if (max[i] <= min[i]) return undefined;
  }
  return { ...rect, min, max };
}

// `count` points on a face, spread along its longer side between two fractions of that side
// and centred on the shorter one.
export function pointsOnFace(rect: FaceRect, count: number, from: number, to: number): Vec3[] {
  const [u, v] = AXES.filter((i) => i !== rect.axis);
  const long = rect.max[u] - rect.min[u] >= rect.max[v] - rect.min[v] ? u : v;
  const points: Vec3[] = [];
  for (let i = 0; i < count; i++) {
    const fraction = count === 1 ? (from + to) / 2 : from + ((to - from) * i) / (count - 1);
    const point = mix(rect.min, rect.max, 0.5);
    point[long] = rect.min[long] + (rect.max[long] - rect.min[long]) * fraction;
    points.push(point);
  }
  return points;
}

export function boundsOf(boxes: Cuboid[], fallback: Bounds): Bounds {
  if (boxes.length === 0) return fallback;
  const all = boxes.map(boundsOfCuboid);
  return {
    min: AXES.map((i) => Math.min(...all.map((b) => b.min[i]))) as Vec3,
    max: AXES.map((i) => Math.max(...all.map((b) => b.max[i]))) as Vec3,
  };
}

export function cornersOf(bounds: Bounds): Vec3[] {
  const corners: Vec3[] = [];
  for (const x of [bounds.min[0], bounds.max[0]]) {
    for (const y of [bounds.min[1], bounds.max[1]]) {
      for (const z of [bounds.min[2], bounds.max[2]]) corners.push([x, y, z]);
    }
  }
  return corners;
}

export function rotate(v: Vec3, q: Quat): Vec3 {
  const out = new Vector3(...v).applyQuaternion(fromQuat(q));
  return [out.x, out.y, out.z];
}

export function slerp(a: Quat, b: Quat, t: number): Quat {
  return toQuat(fromQuat(a).slerp(fromQuat(b), t));
}

// Cylinders are modelled along +y; this turns that axis onto a face normal.
export function alongNormal(normal: Vec3): Quat {
  return toQuat(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(...normal)));
}

// The whole-assembly rotation a flip ends in. "turn-over" is half a turn about x. "stand-up"
// for an on-back build sends the length (+x) down, so the x = 0 end finishes on top, and the
// open front (+y) toward the viewer. The other build orientations come in AJI-04.
export function flipRotation(orientation: BuildOrientation, mode: "stand-up" | "turn-over"): Quat {
  if (mode === "turn-over") return toQuat(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI));
  if (orientation !== "on-back") return NO_ROTATION;
  const basis = new Matrix4().makeBasis(new Vector3(0, -1, 0), new Vector3(0, 0, 1), new Vector3(-1, 0, 0));
  return toQuat(new Quaternion().setFromRotationMatrix(basis));
}

// Where to put the assembly group so it turns about the centre of `bounds` and its lowest
// corner rests on the floor (y = 0).
export function settleOnFloor(bounds: Bounds, rotation: Quat): Vec3 {
  const centre = mix(bounds.min, bounds.max, 0.5);
  const turned = rotate(centre, rotation);
  const lowest = Math.min(...cornersOf(bounds).map((c) => rotate(add(c, scale(centre, -1)), rotation)[1]));
  return [centre[0] - turned[0], -lowest - turned[1], centre[2] - turned[2]];
}

import { FACE_NORMALS, boundsOfCuboid, faceRect, normalAxis, type Cuboid } from "./geometry";
import { labelRoot } from "./layout";
import { HARDWARE_KINDS, type Action, type Face, type ScenePart, type SceneStep, type SceneTrap, type WrongOrientation } from "./types";

// How close a neighbour must be to the holed face to count as sitting on it, in cm.
const TOUCHING_CM = 0.5;

const OPPOSITE: Record<Face, Face> = { top: "bottom", bottom: "top", left: "right", right: "left", front: "back", back: "front" };

const isSolid = (part: ScenePart | undefined): part is ScenePart => !!part && !HARDWARE_KINDS.includes(part.kind);
const cuboidOf = (part: ScenePart): Cuboid | undefined =>
  part.sizeCm && part.homeCm ? { position: part.homeCm, size: part.sizeCm } : undefined;

// The one face with drilled holes, if the part is a plain box with holes on exactly one face.
// Such a board looks the same either way round, which is what makes fitting it backwards possible.
function holedFace(part: ScenePart): Face | undefined {
  if (part.shape !== "box") return undefined;
  const faces = new Set(part.features.filter((f) => f.type === "holes").map((f) => f.face));
  return faces.size === 1 ? [...faces][0] : undefined;
}

// Does `other` sit against `face` of `part` in the snapped layout?
function sitsOnFace(part: ScenePart, face: Face, other: ScenePart): boolean {
  const box = cuboidOf(part);
  const otherBox = cuboidOf(other);
  if (!box || !otherBox) return false;
  const rect = faceRect(box, face);
  const outward = FACE_NORMALS[face][rect.axis];
  const { min, max } = boundsOfCuboid(otherBox);
  const near = outward > 0 ? min[rect.axis] : max[rect.axis];
  if (Math.abs(near - rect.plane) > TOUCHING_CM) return false;
  return [0, 1, 2].every((i) => i === rect.axis || Math.min(max[i], rect.max[i]) - Math.max(min[i], rect.min[i]) > TOUCHING_CM);
}

// Half a turn that carries the holed face to the opposite side. Top/bottom holes need a turn
// about a horizontal axis; holes on any side face swap by turning about the vertical.
const wrongWayFor = (face: Face): WrongOrientation =>
  normalAxis(FACE_NORMALS[face]) === 1 ? "flipped-vertical" : "flipped-horizontal";

// The part the holed face must point at, or undefined when nothing in the manual shows it.
// Evidence, in order: the panel it is placed against lies on that face; hardware driven in for
// it this step sits on that face; anything, in any step, goes into or against that face.
function neighbourOnFace(part: ScenePart, face: Face, action: Action, step: SceneStep, steps: SceneStep[], parts: Map<string, ScenePart>) {
  const target = action.target === undefined ? undefined : parts.get(action.target);
  if (isSolid(target) && sitsOnFace(part, face, target)) return target;

  for (const other of step.actions) {
    const holder = other.target === undefined ? undefined : parts.get(other.target);
    if (other.for === part.id && other.face === OPPOSITE[face] && isSolid(holder)) return holder;
  }

  for (const later of steps) {
    for (const other of later.actions) {
      if (other.target !== part.id || other.face !== face) continue;
      const joined = parts.get(other.for ?? other.part);
      if (isSolid(joined)) return joined;
    }
  }
  return undefined;
}

// Fills `trap` on each step. A warning the manual draws is kept as it is. Otherwise a step
// gets a "possible mistake" only when the geometry proves one: a plain board, holes on one
// face, and that face has to meet a particular neighbour. No evidence, no trap.
export function deriveTraps(parts: ScenePart[], steps: SceneStep[]): SceneStep[] {
  const byId = new Map(parts.map((p) => [p.id, p]));
  const placedKinds = new Set<string>();

  return steps.map((step) => {
    let found: SceneTrap | undefined;
    for (const action of step.actions) {
      if (action.verb !== "place" && action.verb !== "attach") continue;
      const part = byId.get(action.part);
      if (!isSolid(part)) continue;
      const kind = labelRoot(part.label);
      const firstOfKind = !placedKinds.has(kind);
      placedKinds.add(kind);

      const face = holedFace(part);
      const neighbour = face && !found && !step.trap ? neighbourOnFace(part, face, action, step, steps, byId) : undefined;
      if (!face || !neighbour) continue;
      found = {
        part: part.id,
        mustFace: face,
        wrong: wrongWayFor(face),
        hint: `Drilled holes face the ${labelRoot(neighbour.label)}`,
        source: "geometry",
        autoplay: firstOfKind, // later boards of the same kind get a button instead
      };
    }
    return found ? { ...step, trap: found } : step;
  });
}

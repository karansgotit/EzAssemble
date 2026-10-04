import { SCREW_TURNS, hardwareScaleFor } from "./constants";
import { implicitTargetId } from "@/schema/placement";
import {
  FACE_NORMALS, NO_ROTATION, add, alongNormal, boundsOf, faceRect, flipRotation, jointStrip,
  pointsOnFace, scale, settleOnFloor, type Bounds, type Cuboid, type Quat,
} from "./geometry";
import { HARDWARE_KINDS, type Action, type PartKind, type SceneManual, type ScenePart, type Vec3, type Verb } from "./types";

// One physical piece: "dowel#3" is the third dowel. Poses are in the build frame.
export interface Placed extends Cuboid {
  id: string;
  partId: string;
  kind: PartKind;
  shape: "box" | "cylinder";
  quaternion: Quat;
  spin: number; // radians turned about its own axis (screws, cam locks)
}

export interface AssemblyPose {
  position: Vec3;
  quaternion: Quat;
}

// What one action did: the pieces it moved, the direction they came in along, and how they
// move. `motion` is the action's verb, except that hardware moves the way its kind does.
export interface ResolvedAction {
  action: Action;
  ids: string[];
  normal: Vec3;
  motion: Verb;
}

export interface SceneState {
  placed: Map<string, Placed>;
  stepActions: ResolvedAction[][]; // one entry per step resolved so far
  assembly: AssemblyPose; // display-only rotation of the whole build (flips)
  warnings: string[]; // actions that were skipped, and why
}

export const ASSEMBLY_ID = "assembly";

const isHardware = (part: ScenePart): boolean => HARDWARE_KINDS.includes(part.kind);
const instanceId = (partId: string, n: number): string => `${partId}#${n}`;

// Screws and cam bolts are turned in; dowels, cams and nails are pushed or tapped straight in.
const TURNED_IN: PartKind[] = ["screw", "camBolt"];
export const hardwareMotion = (kind: PartKind): Verb => (TURNED_IN.includes(kind) ? "screw" : "insert");

// Fractions of a face's long side that hardware is spread between when the action names no
// `for` part. One piece lands mid-range (15%, 50%, 85%); several share the range.
const SPREAD: Record<NonNullable<Action["at"]>, [number, number]> = {
  start: [0.05, 0.25],
  middle: [0.4, 0.6],
  end: [0.75, 0.95],
  all: [0.15, 0.85],
};
const JOINT_SPREAD: [number, number] = [0.25, 0.75];

const VERBS: Verb[] = ["insert", "attach", "screw", "lock", "place", "flip"];
const MAX_PIECES_PER_ACTION = 64;

const isVec3 = (v: unknown): v is Vec3 =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
const isPositive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

export function assemblyBounds(state: SceneState, manual: SceneManual): Bounds {
  const solid = [...state.placed.values()].filter((p) => !HARDWARE_KINDS.includes(p.kind));
  const size = isVec3(manual?.buildSizeCm) && manual.buildSizeCm.every(isPositive) ? manual.buildSizeCm : ([100, 100, 100] as Vec3);
  return boundsOf(solid, { min: [0, 0, 0], max: size });
}

// Pure and never throws: replays steps 0..upToStep and returns where every piece is afterwards.
// An action it cannot make sense of is skipped and explained in `warnings`.
export function resolveScene(manual: SceneManual, upToStep: number, hardwareScale = hardwareScaleFor(manual?.buildSizeCm)): SceneState {
  const partList = Array.isArray(manual?.parts) ? manual.parts.filter((p) => p && typeof p.id === "string") : [];
  const parts = new Map(partList.map((p) => [p.id, p]));
  const used = new Map<string, number>();
  const inserted = new Map<string, string[]>();
  const state: SceneState = {
    placed: new Map(),
    stepActions: [],
    assembly: { position: [0, 0, 0], quaternion: NO_ROTATION },
    warnings: [],
  };

  const cuboidOf = (part: ScenePart): Cuboid | undefined =>
    isVec3(part.sizeCm) && isVec3(part.homeCm) && part.sizeCm.every(isPositive)
      ? { position: [...part.homeCm], size: [...part.sizeCm] }
      : undefined;

  const putSolid = (part: ScenePart, box: Cuboid, id: string): void => {
    state.placed.set(id, { ...box, id, partId: part.id, kind: part.kind, shape: part.shape, quaternion: NO_ROTATION, spin: 0 });
  };

  // Next unused instance numbers of a part, or undefined if the box does not hold that many.
  const claim = (part: ScenePart, count: number): string[] | undefined => {
    const start = used.get(part.id) ?? 0;
    if (start + count > part.count) return undefined;
    used.set(part.id, start + count);
    return Array.from({ length: count }, (_, i) => instanceId(part.id, start + i + 1));
  };

  const resolveAction = (action: Action, where: string): ResolvedAction | undefined => {
    const skip = (why: string): undefined => {
      state.warnings.push(`${where}: ${why}, so it was skipped`);
      return undefined;
    };
    if (!action || !VERBS.includes(action.verb)) return skip(`"${String(action?.verb)}" is not a known verb`);
    if (action.face !== undefined && !FACE_NORMALS[action.face]) return skip(`"${String(action.face)}" is not a known face`);
    const normal = FACE_NORMALS[action.face ?? "top"];

    if (action.verb === "flip") {
      const quaternion = flipRotation(manual.buildOrientation, action.flipMode ?? "stand-up", state.assembly.quaternion);
      state.assembly = { quaternion, position: settleOnFloor(assemblyBounds(state, manual), quaternion) };
      return { action, ids: [ASSEMBLY_ID], normal, motion: "flip" };
    }

    const part = parts.get(action.part);
    if (!part) return skip(`part "${action.part}" is not in the parts list`);
    if (!Number.isInteger(action.count) || action.count < 1 || action.count > MAX_PIECES_PER_ACTION) {
      return skip(`${String(action.count)} is not a usable count`);
    }
    if (action.for !== undefined && !parts.has(action.for)) return skip(`"${action.for}" (for) is not in the parts list`);
    const target = action.target === undefined ? undefined : parts.get(action.target);
    if (action.target !== undefined && !target) return skip(`target "${action.target}" is not in the parts list`);
    const targetBox = target && !isHardware(target) ? cuboidOf(target) : undefined;
    const introduceTarget = (): void => {
      const placedIds = [...state.placed.values()].map(piece => piece.partId);
      if (target && targetBox && implicitTargetId(action, partList, placedIds)) {
        putSolid(target, targetBox, instanceId(target.id, 1));
        used.set(target.id, 1);
      }
    };

    if (action.verb === "lock") {
      const ids = (inserted.get(part.id) ?? []).slice(-action.count);
      if (ids.length === 0) return skip(`no "${part.id}" has been inserted to lock`);
      for (const id of ids) {
        const piece = state.placed.get(id);
        if (piece) state.placed.set(id, { ...piece, spin: piece.spin + Math.PI / 2 });
      }
      return { action, ids, normal, motion: "lock" };
    }

    if (!isHardware(part)) {
      if (part.count !== 1 || action.count !== 1) return skip(`each solid needs its own id and position with count 1`);
      const box = cuboidOf(part);
      if (!box) return skip(`part "${part.id}" has no size or position`);
      // An implicit foundation can later receive an explicit placement/attachment action.
      const existingId = instanceId(part.id, 1);
      const ids = state.placed.has(existingId) ? [existingId] : claim(part, action.count);
      if (!ids) return skip(`more "${part.id}" are used than the ${part.count} in the box`);
      // The first panel something is built onto is already lying there, even with no action of its own.
      introduceTarget();
      for (const id of ids) putSolid(part, box, id);
      return { action, ids, normal, motion: action.verb === "attach" ? "attach" : "place" };
    }

    if (!isPositive(part.hardwareMm?.length) || !isPositive(part.hardwareMm?.diameter)) return skip(`hardware "${part.id}" has no size`);
    if (!target || !targetBox || !action.face) return skip(`hardware "${part.id}" needs a target panel and a face`);
    const face = faceRect(targetBox, action.face);
    const forPart = action.for === undefined ? undefined : parts.get(action.for);
    const forBox = forPart && !isHardware(forPart) ? cuboidOf(forPart) : undefined;
    const strip = forBox ? jointStrip(face, forBox) : undefined;
    if (action.for !== undefined && !strip) {
      state.warnings.push(`${where}: "${action.for}" does not sit on that face, so the hardware was spread along it`);
    }
    const ids = claim(part, action.count);
    if (!ids) return skip(`more "${part.id}" are used than the ${part.count} in the box`);
    introduceTarget();

    const points = strip
      ? pointsOnFace(strip, action.count, ...JOINT_SPREAD)
      : pointsOnFace(face, action.count, ...SPREAD[action.at ?? "all"]);
    const length = ((part.hardwareMm?.length ?? 0) / 10) * hardwareScale;
    const diameter = ((part.hardwareMm?.diameter ?? 0) / 10) * hardwareScale;
    // Dowels sit half in each panel; everything else is driven in until its head is flush.
    const sink = part.kind === "dowel" ? 0 : length / 2;
    const motion = hardwareMotion(part.kind);
    ids.forEach((id, i) => {
      state.placed.set(id, {
        id,
        partId: part.id,
        kind: part.kind,
        shape: "cylinder",
        position: add(points[i], scale(normal, -sink)),
        size: [diameter, length, diameter],
        quaternion: alongNormal(normal),
        spin: motion === "screw" ? SCREW_TURNS * 2 * Math.PI : 0,
      });
    });
    inserted.set(part.id, [...(inserted.get(part.id) ?? []), ...ids]);
    return { action, ids, normal, motion };
  };

  const steps = Array.isArray(manual?.steps) ? manual.steps : [];
  for (const step of steps.slice(0, Math.max(0, upToStep + 1))) {
    const resolved: ResolvedAction[] = [];
    // Info, sub-assembly and failed steps move nothing: the scene stays as the last step left it.
    const actions = step?.kind === "assembly" && Array.isArray(step.actions) ? step.actions : [];
    actions.forEach((action, i) => {
      const where = `step ${step.stepNumber}, action ${i + 1}`;
      try {
        const done = resolveAction(action, where);
        if (done) resolved.push(done);
      } catch (error) {
        // Last line of defence: whatever is wrong with this action, the rest still plays.
        state.warnings.push(`${where}: could not be shown (${error instanceof Error ? error.message : String(error)}), so it was skipped`);
      }
    });
    state.stepActions.push(resolved);
  }
  return state;
}

import { HARDWARE_SCALE, SCREW_TURNS } from "./constants";
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

export function assemblyBounds(state: SceneState, manual: SceneManual): Bounds {
  const solid = [...state.placed.values()].filter((p) => !HARDWARE_KINDS.includes(p.kind));
  return boundsOf(solid, { min: [0, 0, 0], max: manual.buildSizeCm });
}

// Pure and never throws: replays steps 0..upToStep and returns where every piece is afterwards.
// An action it cannot make sense of is skipped and explained in `warnings`.
export function resolveScene(manual: SceneManual, upToStep: number, hardwareScale = HARDWARE_SCALE): SceneState {
  const parts = new Map(manual.parts.map((p) => [p.id, p]));
  const used = new Map<string, number>();
  const inserted = new Map<string, string[]>();
  const state: SceneState = {
    placed: new Map(),
    stepActions: [],
    assembly: { position: [0, 0, 0], quaternion: NO_ROTATION },
    warnings: [],
  };

  const cuboidOf = (part: ScenePart): Cuboid | undefined =>
    part.sizeCm && part.homeCm ? { position: [...part.homeCm], size: [...part.sizeCm] } : undefined;

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
    const normal = FACE_NORMALS[action.face ?? "top"] ?? FACE_NORMALS.top;

    if (action.verb === "flip") {
      const quaternion = flipRotation(manual.buildOrientation, action.flipMode ?? "stand-up", state.assembly.quaternion);
      state.assembly = { quaternion, position: settleOnFloor(assemblyBounds(state, manual), quaternion) };
      return { action, ids: [ASSEMBLY_ID], normal, motion: "flip" };
    }

    const part = parts.get(action.part);
    if (!part) return skip(`part "${action.part}" is not in the parts list`);
    const target = action.target === undefined ? undefined : parts.get(action.target);
    if (action.target !== undefined && !target) return skip(`target "${action.target}" is not in the parts list`);
    const targetBox = target && !isHardware(target) ? cuboidOf(target) : undefined;
    const introduceTarget = (): void => {
      const placedIds = [...state.placed.values()].map(piece => piece.partId);
      if (target && targetBox && implicitTargetId(action, manual.parts, placedIds)) {
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

    if (!part.hardwareMm) return skip(`hardware "${part.id}" has no size`);
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
    const length = (part.hardwareMm.length / 10) * hardwareScale;
    const diameter = (part.hardwareMm.diameter / 10) * hardwareScale;
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

  const steps = Array.isArray(manual.steps) ? manual.steps : [];
  for (const step of steps.slice(0, Math.max(0, upToStep + 1))) {
    const resolved: ResolvedAction[] = [];
    (step.actions ?? []).forEach((action, i) => {
      const done = resolveAction(action, `step ${step.stepNumber}, action ${i + 1}`);
      if (done) resolved.push(done);
    });
    state.stepActions.push(resolved);
  }
  return state;
}

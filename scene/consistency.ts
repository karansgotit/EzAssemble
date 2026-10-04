import { boundsOfCuboid } from "./geometry";
import { HARDWARE_KINDS, type SceneManual, type ScenePart } from "./types";

// How far apart two parts may be and still count as touching, in cm.
const TOUCHING_CM = 0.5;

const AXES = [0, 1, 2];
const isNumbers = (v: unknown): v is number[] =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));

// How far apart two parts are in the snapped layout: 0 when they touch or overlap. Parts that
// only meet along an edge or at a corner do not count as touching, so that is reported as 0.1.
function gapBetween(a: ScenePart, b: ScenePart): number | undefined {
  if (!isNumbers(a.sizeCm) || !isNumbers(a.homeCm) || !isNumbers(b.sizeCm) || !isNumbers(b.homeCm)) return undefined;
  const boxA = boundsOfCuboid({ position: a.homeCm, size: a.sizeCm });
  const boxB = boundsOfCuboid({ position: b.homeCm, size: b.sizeCm });
  // Per axis: positive = space between them, negative = how much they overlap.
  const apart = AXES.map((i) => Math.max(boxA.min[i], boxB.min[i]) - Math.min(boxA.max[i], boxB.max[i]));
  const gap = Math.max(0, ...apart);
  if (gap > TOUCHING_CM) return gap;
  const sharesAFace = apart.filter((s) => s < -TOUCHING_CM).length >= 2;
  return sharesAFace ? 0 : 0.1;
}

// For every panel a step places or attaches: does it really touch the part the step says it
// joins? A step that says "place the shelf against the long panel" while the layout has them
// apart means the step or the layout is wrong; the orchestrator marks it low confidence.
// Pure and never throws. Actions the scene would skip anyway (unknown ids, no geometry) are
// not reported here.
export function checkConsistency(manual: SceneManual): { stepNumber: number; problem: string }[] {
  const problems: { stepNumber: number; problem: string }[] = [];
  const parts = new Map((Array.isArray(manual?.parts) ? manual.parts : []).filter((p) => p).map((p) => [p.id, p]));

  for (const step of Array.isArray(manual?.steps) ? manual.steps : []) {
    if (step?.kind !== "assembly" || !Array.isArray(step.actions)) continue;
    for (const action of step.actions) {
      if (action?.verb !== "place" && action?.verb !== "attach") continue;
      const part = parts.get(action.part);
      const target = action.target === undefined ? undefined : parts.get(action.target);
      if (!part || !target || part === target) continue;
      if (HARDWARE_KINDS.includes(part.kind) || HARDWARE_KINDS.includes(target.kind)) continue;
      const gap = gapBetween(part, target);
      if (gap === undefined || gap === 0) continue;
      const how = gap > TOUCHING_CM ? `they are ${Math.round(gap * 10) / 10} cm apart` : "they only meet at an edge";
      problems.push({ stepNumber: step.stepNumber, problem: `${part.id} does not touch ${target.id}: ${how}` });
    }
  }
  return problems;
}

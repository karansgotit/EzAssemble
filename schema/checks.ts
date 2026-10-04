import { HARDWARE_KINDS } from "./common";
import type { AiPart, PartsLayout } from "./ai/partsLayout";
import type { Step } from "./ai/step";
import { implicitTargetId } from "./placement";

export function checkPartsLayout(layout: PartsLayout): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const part of layout.parts) {
    if (ids.has(part.id)) errors.push(`part "${part.id}" has a duplicate id`);
    ids.add(part.id);
    if (part.id === "assembly") errors.push('The id "assembly" is reserved for flip actions.');
    if (HARDWARE_KINDS.includes(part.kind)) {
      if (!part.hardwareMm || part.sizeFrac || part.homeFrac) errors.push(`part "${part.id}": hardware needs hardwareMm and no layout fractions`);
    } else {
      if (part.count !== 1) errors.push(`part "${part.id}": every solid needs its own id, with count 1`);
      if (part.hardwareMm) errors.push(`part "${part.id}": non-hardware must not have hardwareMm`);
      if (!part.sizeFrac || !part.homeFrac) errors.push(`part "${part.id}": non-hardware needs sizeFrac and homeFrac`);
      if (part.sizeFrac?.some(n => !Number.isFinite(n) || n <= 0 || n > 1)) errors.push(`part "${part.id}": sizeFrac values must be in (0, 1]`);
      if (part.homeFrac?.some(n => !Number.isFinite(n) || n <= 0 || n >= 1)) errors.push(`part "${part.id}": homeFrac values must be in (0, 1)`);
    }
  }
  return errors;
}

export function checkStep(step: Step, parts: AiPart[], placedPartIds: string[]): string[] {
  const errors: string[] = [];
  const known = new Map(parts.map(part => [part.id, part]));
  const placed = new Set(placedPartIds);
  if (step.kind === "assembly" && !step.actions.length) errors.push('kind "assembly" requires at least one action');
  if (step.kind === "info" && step.actions.length) errors.push('kind "info" requires no actions');
  for (const [i, action] of step.actions.entries()) {
    const prefix = `action ${i + 1}`;
    for (const [field, id] of [["part", action.part], ["target", action.target], ["for", action.for]]) {
      if (id !== undefined && !(field === "part" && action.verb === "flip" && id === "assembly") && !known.has(id)) {
        errors.push(`${prefix}: ${field} "${id}" is not a known part id`);
      }
    }
    if (action.verb === "flip") {
      if (action.part !== "assembly" || !action.flipMode || action.count !== 1 || action.target || action.face || action.for || action.at) {
        errors.push(`${prefix}: flip must use part "assembly", count 1 and a flipMode, without joint fields`);
      }
      continue;
    }
    if (action.part === "assembly") errors.push(`${prefix}: "assembly" is reserved for flip`);
    const part = known.get(action.part);
    if (!part) continue;
    const hardware = HARDWARE_KINDS.includes(part.kind);
    if (["insert", "screw", "lock"].includes(action.verb) && !hardware) errors.push(`${prefix}: "${action.verb}" needs hardware, but "${part.id}" is a ${part.kind}`);
    if (["place", "attach"].includes(action.verb) && hardware) errors.push(`${prefix}: "${action.verb}" needs a panel or other solid part, but "${part.id}" is hardware`);
    if (hardware && (!action.target || !action.face)) errors.push(`${prefix}: hardware needs a target and a face`);
    if (!hardware && action.count !== 1) errors.push(`${prefix}: non-hardware actions must place one distinct piece`);
    if (action.target === action.part) errors.push(`${prefix}: a part cannot target itself`);
    for (const id of [action.target, action.for]) {
      const jointPart = id ? known.get(id) : undefined;
      if (jointPart && HARDWARE_KINDS.includes(jointPart.kind)) errors.push(`${prefix}: joint target/for must refer to non-hardware`);
    }
    if (action.flipMode || (!hardware && (action.for || action.at))) errors.push(`${prefix}: fields do not apply to this verb`);
    // Only the opening step (nothing placed yet) may introduce foundations; later an unplaced target is a mistake.
    const implicit = implicitTargetId(action, parts, [...placed]);
    if (implicit && !placedPartIds.length) placed.add(implicit);
    else if (implicit) errors.push(`${prefix}: target "${implicit}" has not been placed yet`);
    if (action.verb === "lock" && action.target && !placed.has(action.target)) errors.push(`${prefix}: lock target "${action.target}" has not been placed`);
    if (action.verb === "place" || action.verb === "attach") placed.add(action.part);
  }
  if (step.orientationTrap) {
    const id = step.orientationTrap.part;
    if (!known.has(id)) errors.push(`orientationTrap.part "${id}" is not a known part id`);
    if (!step.actions.some(action => action.part === id || action.target === id)) errors.push(`orientationTrap.part "${id}" does not appear in the actions`);
  }
  return errors;
}

// Implicit foundations claim a solid once; locks reuse hardware rather than consuming it.
export function checkCumulativeCounts(steps: Step[], parts: AiPart[]): { stepNumber: number; message: string }[] {
  const errors: { stepNumber: number; message: string }[] = [];
  const known = new Map(parts.map(part => [part.id, part]));
  const counts = new Map<string, number>();
  const inserted = new Map<string, number>();
  const placed = new Set<string>();
  for (const step of steps) {
    if (step.kind !== "assembly") continue;
    const claim = (id: string, amount: number) => {
      const n = (counts.get(id) ?? 0) + amount;
      counts.set(id, n);
      const part = known.get(id);
      if (part && n > part.count) errors.push({ stepNumber: step.stepNumber, message: `${id}: ${n} instances used, but only ${part.count} available` });
    };
    for (const action of step.actions) {
      if (action.verb === "flip") continue;
      const target = implicitTargetId(action, parts, [...placed]);
      if (target) { placed.add(target); claim(target, 1); }
      if (action.verb === "lock") {
        if ((inserted.get(action.part) ?? 0) < action.count) errors.push({ stepNumber: step.stepNumber, message: `${action.part}: insert enough hardware before locking it` });
      } else if (action.verb === "place" || action.verb === "attach") {
        if (!placed.has(action.part)) claim(action.part, action.count);
        placed.add(action.part);
      } else {
        claim(action.part, action.count);
        if (action.verb === "insert") inserted.set(action.part, (inserted.get(action.part) ?? 0) + action.count);
      }
    }
  }
  return errors;
}

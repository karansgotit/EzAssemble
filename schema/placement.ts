import { HARDWARE_KINDS, type PartKind } from "./common";
import type { Action } from "./ai/step";

type PartRef = { id: string; kind: PartKind };

// A receiving solid is introduced implicitly when first referenced. This includes the
// foundation, which KALLAX never explicitly places. Hardware never becomes a foundation.
export function implicitTargetId(action: Action, parts: readonly PartRef[], placedPartIds: readonly string[]): string | undefined {
  if (action.verb === "flip" || action.verb === "lock" || !action.target) return undefined;
  const target = parts.find(part => part.id === action.target);
  return target && !HARDWARE_KINDS.includes(target.kind) && !placedPartIds.includes(target.id) ? target.id : undefined;
}

// Call after a successfully validated step; failed/info/subassembly steps do not advance state.
export function placedPartsAfterStep(
  step: { kind: string; actions: readonly Action[] }, parts: readonly PartRef[], before: readonly string[] = [],
): string[] {
  const placed = new Set(before);
  if (step.kind !== "assembly") return [...placed];
  for (const action of step.actions) {
    const target = implicitTargetId(action, parts, [...placed]);
    if (target) placed.add(target);
    if (action.verb === "place" || action.verb === "attach") placed.add(action.part);
  }
  return [...placed];
}

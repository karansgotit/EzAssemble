// Pure helpers that decide what the player shows for a step.
import type { PartKind, ScenePart, SceneStep, SceneTrap } from "./tempContracts";

export type TrayItem = { id: string; label: string; ikeaNumber?: string; kind: PartKind | "unknown"; count: number };

/** The parts a step uses, with counts added up across its actions, in first-use order. Never throws. */
export function partsForStep(parts: ScenePart[], step: SceneStep): TrayItem[] {
  const counts = new Map<string, number>();
  for (const action of step.actions) {
    if (action.part === "assembly") continue; // a flip moves everything; it uses no part
    counts.set(action.part, (counts.get(action.part) ?? 0) + action.count);
  }
  return [...counts].map(([id, count]) => {
    const part = parts.find((p) => p.id === id);
    return part
      ? { id, label: part.label, ikeaNumber: part.ikeaNumber, kind: part.kind, count }
      : { id, label: id, kind: "unknown", count };
  });
}

/** Only assembly steps have a 3D animation; info, sub-assembly and failed steps don't. */
export function hasAnimation(step: SceneStep): boolean {
  return step.kind === "assembly";
}

/** The ghost plays by itself only the first time a step with an autoplay trap is opened (FR-54). */
export function shouldAutoplayTrap(step: SceneStep, seenStepNumbers: ReadonlySet<number>): boolean {
  return hasAnimation(step) && step.trap?.autoplay === true && !seenStepNumbers.has(step.stepNumber);
}

/** Button text for replaying the ghost. No trap → no button (FR-55). Never says "common mistake" (FR-53). */
export function trapButtonLabel(trap: SceneTrap | undefined): string | null {
  if (!trap) return null;
  return trap.source === "manual" ? "Show the mistake" : "Show possible mistake";
}

export function clampStepIndex(index: number, total: number): number {
  return Math.min(Math.max(Math.trunc(index), 0), Math.max(total - 1, 0));
}

/** What a step's marker in the navigation shows: a small map of the manual, not a row of identical dots. */
export type StepMarker = {
  label: string; // the manual's own step number
  kind: SceneStep["kind"];
  warning: boolean; // the step has a wrong-way preview
  unsure: boolean; // the AI was not certain about it
};

export function stepMarkers(steps: readonly SceneStep[]): StepMarker[] {
  return steps.map((step) => ({
    label: String(step.stepNumber),
    kind: step.kind,
    warning: hasAnimation(step) && step.trap !== undefined,
    unsure: step.kind === "assembly" && step.confidence === "low",
  }));
}

/** What a screen reader hears for a marker: "Step 7, has a warning". */
export function markerDescription(marker: StepMarker): string {
  const notes = [
    marker.kind === "info" && "information only",
    marker.kind === "subassembly" && "assembled separately",
    marker.kind === "failed" && "could not be read",
    marker.warning && "has a warning",
    marker.unsure && "the AI was unsure",
  ].filter(Boolean);
  return [`Step ${marker.label}`, ...notes].join(", ");
}

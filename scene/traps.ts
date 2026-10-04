import type { ScenePart, SceneStep } from "./types";

// Stub: geometry-based "possible mistake" traps are derived in AJI-05. Until then the only
// traps are the ones the manual itself draws, which are already on the steps.
export function deriveTraps(_parts: ScenePart[], steps: SceneStep[]): SceneStep[] {
  return steps;
}

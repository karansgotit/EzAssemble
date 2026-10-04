import { snapLayout } from "./layout";
import { deriveTraps } from "./traps";
import type { BuildOrientation, SavedManual, SavedStep, SceneManual, SceneStep, Vec3 } from "./types";

export const FAILED_STEP_TEXT = "Follow the original diagram for this step.";

// CONTRACTS §4.1: the upright product size [width, height, depth] as it lies while being built.
export function toBuildSize(productSizeCm: Vec3, orientation: BuildOrientation): Vec3 {
  const [w, h, d] = productSizeCm;
  if (orientation === "on-back") return [h, d, w];
  if (orientation === "on-side") return [h, w, d];
  return [w, h, d]; // upright and upside-down
}

const joinUrl = (base: string, path: string): string => `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;

// One saved step (ok, failed or sub-assembly) → the single step shape the scene and player use.
function toSceneStep(entry: SavedStep, cropBaseUrl: string): SceneStep {
  if (entry.status === "subassembly") {
    return { stepNumber: entry.stepNumber, kind: "subassembly", instruction: entry.message, actions: [], confidence: "high" };
  }
  const crop = joinUrl(cropBaseUrl, entry.crop);
  if (entry.status === "failed") {
    return { stepNumber: entry.stepNumber, kind: "failed", instruction: FAILED_STEP_TEXT, actions: [], confidence: "low", crop };
  }
  const { step } = entry;
  const sceneStep: SceneStep = {
    stepNumber: step.stepNumber,
    kind: step.kind,
    instruction: step.instruction,
    actions: step.actions,
    confidence: step.confidence,
    crop,
  };
  // A warning the manual itself draws always plays the first time the step is shown.
  if (step.orientationTrap) sceneStep.trap = { ...step.orientationTrap, autoplay: true };
  return sceneStep;
}

// Stored manual (raw AI output) → what the 3D engine eats: exact geometry, one step shape,
// resolved traps. Recomputed every time a manual opens. Never throws: anything wrong with the
// layout comes back in `layoutErrors`, for a dev warning.
export function buildSceneManual(saved: SavedManual, cropBaseUrl: string): { manual: SceneManual; layoutErrors: string[] } {
  try {
    const buildOrientation = saved.layout.buildOrientation;
    const buildSizeCm = toBuildSize(saved.productSizeCm, buildOrientation);
    const snapped = snapLayout(saved.layout, buildSizeCm);
    let steps = saved.steps.map((entry) => toSceneStep(entry, cropBaseUrl));
    // A layout we could not make sound means every animation built on it is suspect.
    if (!snapped.ok) steps = steps.map((s) => (s.kind === "assembly" ? { ...s, confidence: "low" } : s));
    return {
      manual: { id: saved.id, title: saved.title, buildSizeCm, buildOrientation, parts: snapped.parts, steps: deriveTraps(snapped.parts, steps) },
      layoutErrors: snapped.errors,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      manual: { id: String(saved?.id ?? ""), title: String(saved?.title ?? ""), buildSizeCm: [1, 1, 1], buildOrientation: "upright", parts: [], steps: [] },
      layoutErrors: [`The saved manual could not be turned into a scene: ${reason}`],
    };
  }
}

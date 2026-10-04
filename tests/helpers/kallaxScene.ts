import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Action, Confidence, Face, SceneManual, ScenePart, SceneStep, WrongOrientation } from "@/scene/types";

// Stand-in for fixtures/kallax.scene.json until KAR-02 lands: the same conversion that task
// describes, from the prototype's hand-made KALLAX data (read as data, not imported; D-17).
// When the real fixture exists, make loadKallaxScene() read it and delete the rest of this file.

type ReferenceStep = {
  stepNumber: number;
  kind: "assembly" | "info";
  instruction: string;
  actions: Action[];
  confidence: Confidence;
  orientationTrap?: { part: string; mustFace: Face; wrong: WrongOrientation; hint: string };
};
type Reference = { title: string; parts: ScenePart[]; steps: ReferenceStep[] };

const referencePath = fileURLToPath(new URL("../../reference/prototype/src/fixtures/kallax.json", import.meta.url));

export function loadKallaxScene(): SceneManual {
  const reference = JSON.parse(readFileSync(referencePath, "utf8")) as Reference;
  const steps = reference.steps.map((step): SceneStep => {
    const trap = step.orientationTrap;
    return {
      stepNumber: step.stepNumber,
      kind: step.kind,
      instruction: step.instruction,
      actions: step.actions,
      confidence: step.confidence,
      crop: `/manuals/kallax/crops/step-${String(step.stepNumber).padStart(2, "0")}.jpg`,
      ...(trap && {
        trap: { part: trap.part, mustFace: trap.mustFace, wrong: trap.wrong, hint: trap.hint, source: "manual", autoplay: true },
      }),
    };
  });
  return {
    id: "kallax",
    title: reference.title,
    buildSizeCm: [147, 39, 77],
    buildOrientation: "on-back",
    parts: reference.parts,
    steps,
  };
}

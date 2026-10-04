import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PartsLayout, SavedManual, SceneManual, Step } from "@/schema";
import { loadKallaxScene } from "./kallaxScene";

export const scene = SceneManual.parse(loadKallaxScene());
export const layout = PartsLayout.parse({
  buildOrientation: scene.buildOrientation,
  parts: scene.parts.map(({ sizeCm, homeCm, ...part }) => ({
    ...part,
    ...(sizeCm && { sizeFrac: sizeCm.map((n, i) => n / scene.buildSizeCm[i]) }),
    ...(homeCm && { homeFrac: homeCm.map((n, i) => n / scene.buildSizeCm[i]) }),
  })),
});
const path = fileURLToPath(new URL("../../reference/prototype/src/fixtures/kallax.json", import.meta.url));
// D-17 permits converting fixture data, not importing reference implementation code.
const raw = JSON.parse(readFileSync(path, "utf8")) as { steps: Record<string, unknown>[] };
export const steps = raw.steps.map(step => Step.parse({
  ...step,
  ...(step.orientationTrap ? { orientationTrap: { ...(step.orientationTrap as object), source: "manual" } } : {}),
}));
export const saved = SavedManual.parse({
  schemaVersion: 1, id: "kallax", title: scene.title, productSizeCm: [77, 147, 39],
  pages: [], layout, createdAt: "2026-10-04T00:00:00Z",
  steps: steps.map(step => ({ status: "ok", step, crop: `crops/step-${step.stepNumber}.jpg`, attempts: 1 })),
});

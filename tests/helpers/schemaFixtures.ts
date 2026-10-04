import { readFileSync } from "node:fs";
import { SavedManual } from "@/schema";
import { loadKallaxScene } from "./kallaxScene";

export const scene = loadKallaxScene();
export const saved = SavedManual.parse(JSON.parse(readFileSync(new URL("../../fixtures/kallax.gold.json", import.meta.url), "utf8")));
export const layout = saved.layout;
export const steps = saved.steps.map(entry => {
  if (entry.status !== "ok") throw new Error("Every KALLAX gold step must have status ok.");
  return entry.step;
});

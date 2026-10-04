import { readFileSync } from "node:fs";
import { SceneManual } from "@/schema";

// Load the actual fixture consumed by the scene, so missing or invalid outputs fail tests.
export function loadKallaxScene(): SceneManual {
  return SceneManual.parse(JSON.parse(readFileSync(new URL("../../fixtures/kallax.scene.json", import.meta.url), "utf8")));
}

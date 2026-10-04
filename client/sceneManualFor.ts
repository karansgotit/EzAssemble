// TEMPORARY until AJI-03: turns a saved manual into the SceneManual the player needs.
// The real version is buildSceneManual(saved, cropBaseUrl) in scene/. Until it lands, only KALLAX can
// be opened, using the hand-converted fixtures/kallax.scene.json. Replace the body of this one function.
import kallaxScene from "@/fixtures/kallax.scene.json";
import { type SavedManual, SceneManual } from "@/schema";

export type SceneResult = { ok: true; manual: SceneManual } | { ok: false; errors: string[] };

export function sceneManualFor(saved: SavedManual): SceneResult {
  if (saved.id !== "kallax") {
    return { ok: false, errors: [`The 3D scene for "${saved.title}" can't be built yet. Only KALLAX can be opened for now.`] };
  }
  const parsed = SceneManual.safeParse(kallaxScene);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) };
  }
  return { ok: true, manual: parsed.data };
}

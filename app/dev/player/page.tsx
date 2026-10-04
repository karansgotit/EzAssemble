"use client";

// Dev-only page for SMI-03: the step player.
//   /dev/player              gold KALLAX (fixtures/kallax.scene.json) in the real 3D scene
//   /dev/player?manual=fake  the fake manual with the edge-case steps, in the stand-in scene
// Keyboard: ← → change step · Space play/pause · R replay. Add &mode=processing for the upload view.
import { useSyncExternalStore } from "react";
import { fakeManual } from "@/fake-data/manual";
import kallaxScene from "@/fixtures/kallax.scene.json";
import { ScenePlaceholder } from "@/player/ScenePlaceholder";
import { StepPlayer } from "@/player/StepPlayer";
import { SceneManual } from "@/schema";

function subscribe() {
  return () => {};
}

const gold = SceneManual.safeParse(kallaxScene);

export default function PlayerDevPage() {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const params = new URLSearchParams(search);
  const mode = params.get("mode") === "processing" ? "processing" : "library";

  // The fake manual has no part sizes or positions, so it uses the stand-in scene, not the real 3D one.
  if (params.get("manual") === "fake") return <StepPlayer manual={fakeManual} mode={mode} Scene={ScenePlaceholder} />;
  if (!gold.success) {
    return (
      <main className="placeholder">
        <h1>fixtures/kallax.scene.json is not a valid scene manual</h1>
        <pre>{gold.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n")}</pre>
      </main>
    );
  }
  return <StepPlayer manual={gold.data} mode={mode} />;
}

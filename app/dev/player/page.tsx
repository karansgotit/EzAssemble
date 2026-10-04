"use client";

// Dev-only page for SMI-03: the step player on FAKE data with a stand-in for the 3D scene.
// Keyboard: ← → change step · Space play/pause · R replay. Add ?mode=processing for the upload view.
import { useSyncExternalStore } from "react";
import { StepPlayer } from "@/player/StepPlayer";
import { fakeManual } from "@/fake-data/manual";

function subscribe() {
  return () => {};
}

export default function PlayerDevPage() {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const mode = new URLSearchParams(search).get("mode") === "processing" ? "processing" : "library";
  return <StepPlayer manual={fakeManual} mode={mode} />;
}

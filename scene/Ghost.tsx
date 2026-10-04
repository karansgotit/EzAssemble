"use client";

import type { Placed } from "./resolveScene";
import type { SceneTrap } from "./types";

// Stub: the wrong-vs-right ghost (red wrong pose → green right pose) is built in AJI-06.
export function Ghost(_props: { piece: Placed; trap: SceneTrap; time: number }) {
  return null;
}

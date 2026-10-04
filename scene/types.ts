// The scene's view of the shared contracts (docs/CONTRACTS.md). Everything here comes from
// schema/; scene files import from this one place.
import type { ScenePart } from "@/schema/scene";

export { HARDWARE_KINDS } from "@/schema/common";
export type {
  BuildOrientation, Confidence, Face, PartKind, Vec3, Verb, WrongOrientation,
} from "@/schema/common";
export type { AiPart, PartsLayout } from "@/schema/ai/partsLayout";
export type { Action } from "@/schema/ai/step";
export type { SavedManual, SavedStep } from "@/schema/saved";
export type { SceneManual, ScenePart, SceneStep, SceneTrap } from "@/schema/scene";

export type Feature = ScenePart["features"][number];
export type HardwareMm = NonNullable<ScenePart["hardwareMm"]>;

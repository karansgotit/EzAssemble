// Shared runtime schemas and inferred data types are owned by schema/.
export { HARDWARE_KINDS } from "@/schema";
export type {
  Action, AiPart, BuildOrientation, Confidence, Face, PartKind, PartsLayout,
  SceneManual, ScenePart, SceneStep, SceneTrap, Vec3, Verb, WrongOrientation,
} from "@/schema";
import type { ScenePart } from "@/schema";
export type Feature = ScenePart["features"][number];
export type HardwareMm = NonNullable<ScenePart["hardwareMm"]>;

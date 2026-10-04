// Compatibility import path; every data shape comes from the shared schema now.
export type {
  Action, BuildOrientation, Confidence, Face, PartKind, SceneManual, ScenePart,
  SceneStep, SceneTrap, Vec3, Verb, WrongOrientation,
} from "@/schema";
import type { SceneManual } from "@/schema";
import type { Speed } from "./playback";

export type AssemblySceneProps = {
  manual: SceneManual;
  stepIndex: number;
  playKey: number;
  playing: boolean;
  speed: Speed;
  scrubT: number | null;
  showTrap: boolean;
  onProgress: (t: number) => void;
  onDone: () => void;
};

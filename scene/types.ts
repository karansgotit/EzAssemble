// Local copies of the shared shapes in docs/CONTRACTS.md §1, §2.2, §2.3 and §4, so the scene can
// be built before KAR-01 lands. Once schema/ exists, replace this file's contents with re-exports
// from "@/schema"; nothing else belongs here.

export type Vec3 = [number, number, number];

export type Face = "top" | "bottom" | "left" | "right" | "front" | "back";

export type Verb = "insert" | "attach" | "screw" | "lock" | "place" | "flip";

export type PartKind = "panel" | "leg" | "dowel" | "screw" | "cam" | "camBolt" | "nail" | "other";
export const HARDWARE_KINDS: PartKind[] = ["dowel", "screw", "cam", "camBolt", "nail"];

export type BuildOrientation = "upright" | "on-back" | "upside-down" | "on-side";

export type Confidence = "high" | "medium" | "low";

export type WrongOrientation = "flipped-vertical" | "flipped-horizontal" | "rotated-90";

export type Feature = { type: "holes" | "finished-edge"; face: Face };
export type HardwareMm = { length: number; diameter: number };

export type AiPart = {
  id: string;
  ikeaNumber?: string;
  label: string;
  kind: PartKind;
  count: number;
  shape: "box" | "cylinder";
  sizeFrac?: Vec3;
  homeFrac?: Vec3;
  hardwareMm?: HardwareMm;
  features: Feature[];
};

export type PartsLayout = { buildOrientation: BuildOrientation; parts: AiPart[] };

export type Action = {
  verb: Verb;
  part: string; // a part id, or "assembly" for flip
  count: number;
  target?: string;
  face?: Face;
  for?: string;
  at?: "start" | "middle" | "end" | "all";
  flipMode?: "stand-up" | "turn-over";
};

export type ScenePart = {
  id: string;
  ikeaNumber?: string;
  label: string;
  kind: PartKind;
  count: number;
  shape: "box" | "cylinder";
  sizeCm?: Vec3;
  homeCm?: Vec3;
  hardwareMm?: HardwareMm;
  features: Feature[];
};

export type SceneTrap = {
  part: string;
  mustFace: Face;
  wrong: WrongOrientation;
  hint: string;
  source: "manual" | "geometry";
  autoplay: boolean;
};

export type SceneStep = {
  stepNumber: number;
  kind: "assembly" | "info" | "subassembly" | "failed";
  instruction: string;
  actions: Action[];
  trap?: SceneTrap;
  confidence: Confidence;
  crop?: string;
};

export type SceneManual = {
  id: string;
  title: string;
  buildSizeCm: Vec3;
  buildOrientation: BuildOrientation;
  parts: ScenePart[];
  steps: SceneStep[];
};

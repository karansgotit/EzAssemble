// Local copies of the shared shapes in docs/CONTRACTS.md §1, §2.2 and §4, so AJI-01 can start
// before KAR-01 lands. Once schema/ exists, replace this file's contents with re-exports from
// "@/schema"; nothing else belongs here.

export type Vec3 = [number, number, number];

export type Face = "top" | "bottom" | "left" | "right" | "front" | "back";

export type PartKind = "panel" | "leg" | "dowel" | "screw" | "cam" | "camBolt" | "nail" | "other";
export const HARDWARE_KINDS: PartKind[] = ["dowel", "screw", "cam", "camBolt", "nail"];

export type BuildOrientation = "upright" | "on-back" | "upside-down" | "on-side";

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

// Scene shapes = the exact, ready-to-draw input for the 3D engine. Built by our code
// from the saved manual (fractions → cm, 3 step cases → one step shape).
import { z } from "zod";
import { BuildOrientation, Confidence, Face, HARDWARE_KINDS, PartId, PartKind, ProductSizeCm, Vec3, WrongOrientation } from "./common";
import { Action } from "./ai/step";

export const ScenePart = z.object({
  id: PartId, ikeaNumber: z.string().optional(), label: z.string(),
  kind: PartKind, count: z.number().int().min(1).max(64), shape: z.enum(["box", "cylinder"]),
  sizeCm: Vec3.optional(),        // non-hardware: exact size, BUILD frame
  homeCm: Vec3.optional(),        // non-hardware: exact centre, BUILD frame
  hardwareMm: z.object({ length: z.number(), diameter: z.number() }).optional(),
  features: z.array(z.object({ type: z.enum(["holes", "finished-edge"]), face: Face })),
}).refine(part => HARDWARE_KINDS.includes(part.kind) || part.count === 1, {
  message: "Each non-hardware piece needs its own id and position, with count 1.", path: ["count"],
});
export type ScenePart = z.infer<typeof ScenePart>;

export const SceneTrap = z.object({
  part: PartId, mustFace: Face, wrong: WrongOrientation, hint: z.string(),
  source: z.enum(["manual", "geometry"]),
  autoplay: z.boolean(),          // manual: true; geometry: true only on first placement of that panel type
});
export type SceneTrap = z.infer<typeof SceneTrap>;

export const SceneStep = z.object({
  stepNumber: z.number().int(),
  kind: z.enum(["assembly", "info", "subassembly", "failed"]),
  instruction: z.string(),        // for subassembly: the template message; for failed: "Follow the original diagram for this step."
  actions: z.array(Action),       // empty for info / subassembly / failed
  trap: SceneTrap.optional(),
  confidence: Confidence,
  crop: z.string().optional(),    // URL of the diagram, absent for subassembly
});
export type SceneStep = z.infer<typeof SceneStep>;

export const SceneManual = z.object({
  id: z.string(), title: z.string(),
  buildSizeCm: ProductSizeCm,     // positive product size mapped into BUILD frame (§4.1)
  buildOrientation: BuildOrientation,
  parts: z.array(ScenePart),
  steps: z.array(SceneStep),
});
export type SceneManual = z.infer<typeof SceneManual>;

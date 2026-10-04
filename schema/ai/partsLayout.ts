// PartsLayout = the AI's description of every part in the furniture (what it is,
// how many, roughly how big, where it goes). This is only the shape of the answer;
// the AI fills it in from the parts page, cover and step thumbnails.
import { z } from "zod";

import { BuildOrientation, Face, HARDWARE_KINDS, PartId, PartKind, Vec3 } from "../common";

export const AiPart = z.object({
  id: PartId,                                  // stable for the whole manual, e.g. "long_panel_1"
  ikeaNumber: z.string().max(12).optional(),   // printed on hardware only, e.g. "101339"
  label: z.string().max(40),                   // "Long side panel"
  kind: PartKind,
  count: z.number().int().min(1).max(64),
  shape: z.enum(["box", "cylinder"]),
  sizeFrac: Vec3.optional(),                   // panel/leg/other: size in BUILD frame, as fraction of build-frame size (0–1]
  homeFrac: Vec3.optional(),                   // panel/leg/other: centre in BUILD frame, as fraction (0–1)
  hardwareMm: z.object({ length: z.number().positive(), diameter: z.number().positive() }).optional(),
  features: z.array(z.object({
    type: z.enum(["holes", "finished-edge"]),
    face: Face,                                // in BUILD frame
  })).default([]),
}).refine(part => HARDWARE_KINDS.includes(part.kind) || part.count === 1, {
  message: "Each non-hardware piece needs its own id and position, with count 1.", path: ["count"],
});
export type AiPart = z.infer<typeof AiPart>;

export const PartsLayout = z.object({
  buildOrientation: BuildOrientation,
  parts: z.array(AiPart).min(1).max(80),
});
export type PartsLayout = z.infer<typeof PartsLayout>;

// Step = the AI's description of one manual step: what moves where (actions),
// a plain-English instruction, and a mistake warning only if the manual draws one.
import { z } from "zod";
import { Confidence, Face, PartId, Verb, WrongOrientation } from "../common";

export const Action = z.object({
  verb: Verb,
  part: z.union([PartId, z.literal("assembly")]),  // "assembly" only for verb "flip"
  count: z.number().int().min(1).max(32),
  target: PartId.optional(),        // the part it goes into / against (not for flip)
  face: Face.optional(),            // face OF THE TARGET, in BUILD frame
  for: PartId.optional(),           // hardware only: the part this hardware will hold
  at: z.enum(["start", "middle", "end", "all"]).optional(),  // hardware fallback if no `for`
  flipMode: z.enum(["stand-up", "turn-over"]).optional(),    // flip only
});
export type Action = z.infer<typeof Action>;

export const ManualTrap = z.object({     // ONLY when the manual image itself draws the mistake
  part: PartId,
  mustFace: Face,                        // which way the holes/edge must face (BUILD frame)
  wrong: WrongOrientation,
  hint: z.string().max(80),              // "Drilled holes face inward"
  source: z.literal("manual"),
});
export type ManualTrap = z.infer<typeof ManualTrap>;

export const Step = z.object({
  stepNumber: z.number().int().min(1),
  variant: z.string().max(30).optional(),
  kind: z.enum(["assembly", "info"]),    // "subassembly" is never produced by AI; see SavedStep
  instruction: z.string().min(10).max(220),
  actions: z.array(Action).max(4),
  orientationTrap: ManualTrap.optional(),
  confidence: Confidence,
});
export type Step = z.infer<typeof Step>;

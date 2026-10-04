// Saved shapes = what gets written to public/manuals/<id>/manual.json so the app can
// replay a processed manual without calling the AI again.
import { z } from "zod";
import { ProductSizeCm } from "./common";
import { PageIndex } from "./ai/pageIndex";
import { PartsLayout } from "./ai/partsLayout";
import { Step } from "./ai/step";

export const SavedStep = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), step: Step, crop: z.string(), attempts: z.number().int() }),
  z.object({ status: z.literal("failed"), stepNumber: z.number().int(), crop: z.string(),
             errors: z.array(z.string()), attempts: z.number().int() }),
  z.object({ status: z.literal("subassembly"), stepNumber: z.number().int(),   // = first source step
             sourceSteps: z.array(z.number().int()).min(1), label: z.string(),   // "drawer"
             message: z.string() }),                                              // template text, no AI
]);
export type SavedStep = z.infer<typeof SavedStep>;

export const SavedManual = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),     // "kallax", "lack", "malm"
  title: z.string(),                              // "KALLAX 2×4 shelving unit"
  productSizeCm: ProductSizeCm,                   // UPRIGHT [width, height, depth], positive cm
  pages: z.array(PageIndex),                      // raw call-1 output, index = page number - 1
  layout: PartsLayout,                            // raw call-2 output
  steps: z.array(SavedStep),                      // in display order
  createdAt: z.string(),                          // ISO date
  usage: z.object({ calls: z.number(), inputTokens: z.number(), outputTokens: z.number(),
                    estUsd: z.number() }).optional(),
});
export type SavedManual = z.infer<typeof SavedManual>;

export const LibraryIndex = z.array(z.object({
  id: z.string(), title: z.string(), stepCount: z.number().int(),
  thumbnail: z.string(),        // path relative to the manual folder, e.g. "crops/step-01.jpg"
  createdAt: z.string(),
}));
export type LibraryIndex = z.infer<typeof LibraryIndex>;

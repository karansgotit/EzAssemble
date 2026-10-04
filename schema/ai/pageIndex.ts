import { z } from "zod";

export const StepBox = z.tuple([
  z.number().min(0).max(1000), z.number().min(0).max(1000),
  z.number().min(0).max(1000), z.number().min(0).max(1000),
]).refine(([ymin, xmin, ymax, xmax]) => ymin < ymax && xmin < xmax, {
  message: "A step box must have ymin < ymax and xmin < xmax.",
});
export type StepBox = z.infer<typeof StepBox>;

export const PageIndex = z.object({
  pageType: z.enum(["cover", "warning", "tools", "parts", "steps", "other"]),
  steps: z.array(z.object({
    stepNumber: z.number().int().min(1).max(200),
    box: StepBox,  // [ymin, xmin, ymax, xmax], ordered and within 0–1000
    variant: z.string().max(30).optional(),       // branching steps, e.g. "vertical" | "horizontal"
    subassembly: z.string().max(30).optional(),   // e.g. "drawer" if this step builds a separate unit
  })),
}).refine(page => page.pageType === "steps" || page.steps.length === 0, {
  message: "Only a steps page may contain step boxes.", path: ["steps"],
});
export type PageIndex = z.infer<typeof PageIndex>;

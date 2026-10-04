// API shapes = what the browser sends to each server route (requests, checked first)
// and what every route sends back (ApiResult: either the data or the errors).
import { z } from "zod";
import { PartId, ProductSizeCm } from "./common";
import { AiPart } from "./ai/partsLayout";
import { Step } from "./ai/step";
import { SavedManual } from "./saved";
import { checkRequestBudget, MAX_IMAGE_BASE64_CHARS } from "./requestBudget";

const ImageBase64 = z.string().min(1).max(MAX_IMAGE_BASE64_CHARS);

export type Usage = { model: string; inputTokens: number; outputTokens: number; ms: number };
export type ApiResult<T> =
  | { ok: true;  data: T; attempts: number; usage: Usage[] }
  | { ok: false; errors: string[]; attempts: number; usage: Usage[] };

export const IndexPageRequest = z.object({
  image: ImageBase64,
  pageNumber: z.number().int().min(1),
}).superRefine(checkRequestBudget);
export type IndexPageRequest = z.infer<typeof IndexPageRequest>;

export const PartsRequest = z.object({
  title: z.string(),
  productSizeCm: ProductSizeCm,
  partsPages: z.array(ImageBase64).min(1),
  cover: ImageBase64,
  stepThumbs: z.array(ImageBase64),
  previousErrors: z.array(z.string()).optional(),
}).superRefine(checkRequestBudget);
export type PartsRequest = z.infer<typeof PartsRequest>;

export const AnalyzeStepRequest = z.object({
  image: ImageBase64,
  stepNumber: z.number().int().min(1),
  parts: z.array(AiPart),
  placedPartIds: z.array(PartId),
  previousInstructions: z.array(z.string()),
}).superRefine(checkRequestBudget);
export type AnalyzeStepRequest = z.infer<typeof AnalyzeStepRequest>;

export const SaveManualRequest = z.object({
  manual: SavedManual,
  crops: z.array(z.object({ name: z.string(), base64: z.string() })),
}); // Dev-only, local disk save: not subject to the hosted AI request budget.
export type SaveManualRequest = z.infer<typeof SaveManualRequest>;

export const AskRequest = z.object({
  question: z.string().min(1),
  step: Step,
  image: ImageBase64,
}).superRefine(checkRequestBudget);
export type AskRequest = z.infer<typeof AskRequest>;

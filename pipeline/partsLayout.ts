import "server-only";
import { PartsLayout, PartsRequest, checkPartsLayout } from "@/schema";
import { PARTS_MODEL } from "./config";
import { callStructured, type StructuredOptions } from "./gemini";
import { loadPrompt } from "./prompts";

// Call 2: every part plus a rough build-frame layout, from the cover, parts pages and step thumbnails.
export function partsLayout(request: PartsRequest, options: Partial<Pick<StructuredOptions<PartsLayout>,
  "generate" | "model" | "signal" | "timeoutMs" | "onRejected">> = {}) {
  const input = PartsRequest.parse(request);
  const previous = input.previousErrors ?? [];
  return callStructured({
    ...options,
    model: options.model ?? PARTS_MODEL,
    prompt: loadPrompt("parts-layout", {
      title: input.title,
      productSizeCm: input.productSizeCm.join(" × "),
      partsPageCount: input.partsPages.length,
      stepThumbCount: input.stepThumbs.length,
      previousErrors: previous.length ? `Fix these problems:\n${previous.map(e => `- ${e}`).join("\n")}` : "None.",
    }),
    images: [input.cover, ...input.partsPages, ...input.stepThumbs],
    schema: PartsLayout,
    semanticCheck: checkPartsLayout,
  });
}

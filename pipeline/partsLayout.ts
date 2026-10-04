import "server-only";
import { randomUUID } from "node:crypto";
import { PartsLayout, PartsRequest, checkPartsLayout } from "@/schema";
import { PARTS_MODEL } from "./config";
import { callStructured, type StructuredOptions } from "./gemini";
import { loadPrompt } from "./prompts";

// Call 2: every part plus a rough build-frame layout, from the cover, parts pages and step thumbnails.
export async function partsLayout(request: PartsRequest, options: Partial<Pick<StructuredOptions<PartsLayout>,
  "generate" | "model" | "signal" | "timeoutMs" | "onRejected">> = {}) {
  const input = PartsRequest.parse(request);
  const previous = input.previousErrors ?? [];
  const debug = process.env.DEBUG_AI_PARTS === "1";
  const requestId = debug ? randomUUID() : "";
  let rejectedAttempt = 0;
  const log = (event: string, detail: unknown) => {
    if (debug) console.log(`[ai:parts:${requestId}] ${event}`, JSON.stringify(detail));
  };
  // Never log the prompt, request images, credentials or raw SDK errors.
  try {
    const result = await callStructured({
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
      onRejected: (answer, errors) => {
        log("rejected", { attempt: ++rejectedAttempt, answer: answer.slice(0, 16000),
          truncated: answer.length > 16000, errors });
        options.onRejected?.(answer, errors);
      },
    });
    log("final", result);
    return result;
  } catch (error) {
    log("request-failed", { message: "The request failed before a final result; see the route status log." });
    throw error;
  }
}

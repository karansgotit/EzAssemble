import "server-only";
import { AnalyzeStepRequest, Step, checkStep } from "@/schema";
import { ANALYZE_STEP_MODEL } from "./config";
import { callStructured, type StructuredOptions } from "./gemini";
import { loadPrompt } from "./prompts";

// Shared by the spike and future route; retain layout fractions/features in the prompt.
export function analyzeStep(request: AnalyzeStepRequest, options: Partial<Pick<StructuredOptions<Step>,
  "generate" | "model" | "signal" | "timeoutMs" | "onRejected">> = {}) {
  const input = AnalyzeStepRequest.parse(request);
  return callStructured({
    ...options,
    model: options.model ?? ANALYZE_STEP_MODEL,
    prompt: loadPrompt("analyze-step", input),
    images: [input.image],
    schema: Step,
    semanticCheck: step => [
      ...(step.stepNumber === input.stepNumber ? [] : [`stepNumber must be ${input.stepNumber}.`]),
      ...checkStep(step, input.parts, input.placedPartIds),
    ],
  });
}

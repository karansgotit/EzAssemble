import "server-only";
import { ThinkingLevel } from "@google/genai";

// Which Gemini models we call. D-20: start with Flash for everything; switch "strong" to a Pro model only if the eval says accuracy needs it.
export const MODELS = { fast: "gemini-3.8-flash", strong: "gemini-3.1-pro-preview" } as const;
export type ModelTier = keyof typeof MODELS;

export const RETRIES = 2;       // after the first try, so at most 3 attempts (CONTRACTS §5)
export const TEMPERATURE = 0;   // Pro setting retained from eval; Flash 3.8 ignores sampling controls.
export const REQUEST_TIMEOUT_MS = 55_000; // leaves headroom inside the 60 s route
export const MAX_OUTPUT_TOKENS = 8192;
export const ANALYZE_STEP_MODEL: ModelTier = "fast";
export const PARTS_MODEL: ModelTier = "fast"; // KAR-07: Flash beat Pro on KALLAX (orientation, layout, holes) at 25 s vs 40 s
// Unlimited thinking took 100–200 s and up to 30k tokens per step (KAR-04 spike); routes have 60 s.
export const THINKING_LEVEL = ThinkingLevel.LOW;

// USD per 1M tokens, for cost estimates. Gemini 3.8 Flash on Vertex AI, introductory price until 2026-12-31.
export const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
  "gemini-3.1-pro-preview": { input: 2.0, output: 12.0 }, // standard synchronous rate, not Flex/Batch
};

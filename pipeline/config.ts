import "server-only";

// Which Gemini models we call. D-20: start with Flash for everything; switch "strong" to a Pro model only if the eval says accuracy needs it.
export const MODELS = { fast: "gemini-3.8-flash", strong: "gemini-3.8-flash" } as const;
export type ModelTier = keyof typeof MODELS;

export const RETRIES = 2;       // after the first try, so at most 3 attempts (CONTRACTS §5)
export const TEMPERATURE = 0;   // same picture in → same answer out, as far as possible

// USD per 1M tokens, for cost estimates. Gemini 3.8 Flash on Vertex AI, introductory price until 2026-12-31.
export const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
};
import "server-only";
import { z } from "zod";
import type { ApiResult, Usage } from "@/schema";
import { MODELS, RETRIES, TEMPERATURE, type ModelTier } from "./config";
import { getVertexClient } from "./vertex";

// One model call. Tests pass a fake one, so they need no network and cost nothing.
export type Generate = (request: { model: string; prompt: string; images: string[]; jsonSchema: unknown }) =>
  Promise<{ text: string; inputTokens: number; outputTokens: number }>;

const vertexGenerate: Generate = async ({ model, prompt, images, jsonSchema }) => {
  const response = await getVertexClient().models.generateContent({
    model,
    contents: [{ role: "user", parts: [...images.map(data => ({ inlineData: { mimeType: "image/jpeg", data } })), { text: prompt }] }],
    config: { responseMimeType: "application/json", responseJsonSchema: jsonSchema, temperature: TEMPERATURE },
  });
  const usage = response.usageMetadata;
  return {
    text: response.text ?? "",
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0), // thinking is billed as output
  };
};

// Gemini accepts only part of JSON Schema: keep what it supports and turn `const` into a one-value `enum`.
// Dropped rules (text lengths, id patterns, "more than 0") are still enforced by Zod on the answer.
const SUPPORTED = new Set(["type", "format", "title", "description", "enum", "items", "prefixItems", "minItems",
  "maxItems", "minimum", "maximum", "anyOf", "oneOf", "properties", "additionalProperties", "required", "$defs", "$ref"]);

export function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "const") out.enum = [value];
    else if (key === "properties" || key === "$defs") {
      out[key] = Object.fromEntries(Object.entries(value as object).map(([name, sub]) => [name, toGeminiSchema(sub)]));
    } else if (SUPPORTED.has(key) && typeof value !== "boolean") out[key] = toGeminiSchema(value);
  }
  return out;
}

function check<T>(text: string, schema: z.ZodType<T>, semanticCheck: (data: T) => string[]):
  { ok: true; data: T } | { ok: false; errors: string[] } {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The answer was not valid JSON."] };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map(i => `${i.path.join(".") || "answer"}: ${i.message}`) };
  const problems = semanticCheck(parsed.data);
  return problems.length ? { ok: false, errors: problems } : { ok: true, data: parsed.data };
}

// Ask → check the shape (Zod) → check the meaning (semanticCheck). On failure, ask again with the errors, at most RETRIES times.
export async function callStructured<T>(options: {
  prompt: string;
  images: string[];
  schema: z.ZodType<T>;
  semanticCheck?: (data: T) => string[];
  model: ModelTier;
  generate?: Generate;
}): Promise<ApiResult<T>> {
  const { prompt, images, schema, semanticCheck = () => [], generate = vertexGenerate } = options;
  const model = MODELS[options.model];
  const jsonSchema = toGeminiSchema(z.toJSONSchema(schema, { io: "input" }));
  const usage: Usage[] = [];
  let errors: string[] = [];

  for (let attempt = 1; attempt <= RETRIES + 1; attempt++) {
    const feedback = errors.length ? `\n\nYour previous answer was rejected:\n${errors.map(e => `- ${e}`).join("\n")}\nReturn a corrected answer.` : "";
    const started = Date.now();
    let reply: Awaited<ReturnType<Generate>>;
    try {
      reply = await generate({ model, prompt: prompt + feedback, images, jsonSchema });
    } catch (error) {
      // Do not log raw SDK errors: they may contain request data or credentials.
      console.error(`[gemini] ${model} attempt ${attempt}/${RETRIES + 1}: request failed, ${Date.now() - started} ms`);
      throw error; // Preserve the original error for route-level 503 handling.
    }
    const ms = Date.now() - started;
    usage.push({ model, inputTokens: reply.inputTokens, outputTokens: reply.outputTokens, ms });

    const result = check(reply.text, schema, semanticCheck);
    console.log(`[gemini] ${model} attempt ${attempt}/${RETRIES + 1}: ${result.ok ? "ok" : `${result.errors.length} error(s)`}, ${reply.inputTokens} in / ${reply.outputTokens} out, ${ms} ms`);
    if (result.ok) return { ok: true, data: result.data, attempts: attempt, usage };
    errors = result.errors;
  }
  return { ok: false, errors, attempts: RETRIES + 1, usage };
}

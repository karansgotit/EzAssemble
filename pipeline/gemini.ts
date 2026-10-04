import "server-only";
import { ApiError } from "@google/genai";
import { z } from "zod";
import type { ApiResult, Usage } from "@/schema";
import { MODELS, RETRIES, TEMPERATURE, THINKING_LEVEL, REQUEST_TIMEOUT_MS, MAX_OUTPUT_TOKENS, type ModelTier } from "./config";
import { getVertexClient } from "./vertex";
import { withDeadline, PipelineDeadlineError } from "./deadline";
import { normalizeOptionalNulls } from "./wireValues";

// One model call. Tests pass a fake one, so they need no network and cost nothing.
export type Generate = (request: { model: string; prompt: string; images: string[]; jsonSchema: unknown; signal?: AbortSignal; timeoutMs?: number }) =>
  Promise<{ text: string; inputTokens: number; outputTokens: number }>;

const vertexGenerate: Generate = async ({ model, prompt, images, jsonSchema, signal, timeoutMs }) => {
  const response = await getVertexClient().models.generateContent({
    model,
    contents: [{ role: "user", parts: [...images.map(data => ({ inlineData: { mimeType: "image/jpeg", data } })), { text: prompt }] }],
    config: {
      responseMimeType: "application/json", responseJsonSchema: jsonSchema,
      ...(model === MODELS.strong ? { temperature: TEMPERATURE } : {}),
      maxOutputTokens: MAX_OUTPUT_TOKENS, abortSignal: signal,
      httpOptions: { timeout: timeoutMs, retryOptions: { attempts: 1 } },
      // Gemini 3 uses thinking levels; the shared deadline bounds request latency.
      thinkingConfig: { thinkingLevel: THINKING_LEVEL },
    },
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
  // Requiring an explicit decision improved the KAR-04 Step results. This is a wire adapter,
  // not a universal Gemini limitation; normalization preserves genuine nullable fields.
  if (out.properties) {
    const properties = out.properties as Record<string, unknown>;
    const required = new Set(out.required as string[] | undefined);
    for (const name of Object.keys(properties)) {
      if (!required.has(name)) properties[name] = { anyOf: [properties[name], { type: "null" }] };
    }
    out.required = Object.keys(properties);
  }
  // Vertex rejects (HTTP 400) a list of objects with a large maxItems, e.g. PartsLayout's 80 parts (KAR-07).
  // Drop it for lists of objects; Zod still enforces the limit on the answer.
  if (out.type === "array" && (out.items as { properties?: unknown } | undefined)?.properties) delete out.maxItems;
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
  const parsed = schema.safeParse(normalizeOptionalNulls(json, schema));
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map(i => `${describePath(json, i.path)}: ${i.message}`) };
  const problems = semanticCheck(parsed.data);
  return problems.length ? { ok: false, errors: problems } : { ok: true, data: parsed.data };
}

// "parts.8.count" means nothing on a retry (the model reorders lists), so name list items by their id:
// part "threaded_sleeve" (parts.8) count.
function describePath(json: unknown, path: PropertyKey[]): string {
  let node = json, label = "";
  for (const [i, key] of path.entries()) {
    node = node && typeof node === "object" ? (node as Record<PropertyKey, unknown>)[key] : undefined;
    const id = node && typeof node === "object" ? (node as { id?: unknown }).id : undefined;
    if (typeof key === "number" && typeof id === "string") label = `${String(path[i - 1] ?? "item").replace(/s$/, "")} "${id}" (${path.slice(0, i + 1).join(".")})`;
    else if (label) label += ` ${String(key)}`;
  }
  return label || path.join(".") || "answer";
}

// Ask → check the shape (Zod) → check the meaning (semanticCheck). On failure, ask again with the errors, at most RETRIES times.
export type StructuredOptions<T> = {
  prompt: string;
  images: string[];
  schema: z.ZodType<T>;
  semanticCheck?: (data: T) => string[];
  model: ModelTier;
  generate?: Generate;
  timeoutMs?: number;
  signal?: AbortSignal;
  onRejected?: (answer: string, errors: string[]) => void; // e.g. scripts printing what the model got wrong
};

export async function callStructured<T>(options: StructuredOptions<T>): Promise<ApiResult<T>> {
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("timeoutMs must be positive and finite.");
  const progress = { attempts: 0, usage: [] as Usage[], errors: [] as string[] };
  try {
    return await withDeadline(Math.min(timeoutMs, REQUEST_TIMEOUT_MS), options.signal,
      (signal, remainingMs) => runStructured(options, signal, remainingMs, progress));
  } catch (error) {
    // Our own deadline: either ours fired, or Vertex hit the timeout we passed it (504 DEADLINE_EXCEEDED).
    // That is a failed answer (ok: false, 200), not an unavailable service; the client must not retry it.
    const deadline = error instanceof PipelineDeadlineError || (error instanceof ApiError && error.status === 504);
    if (deadline) {
      const timedOut = new PipelineDeadlineError("Model request timed out. Follow the original diagram.").message;
      return { ok: false, errors: [...progress.errors, timedOut], attempts: progress.attempts, usage: [...progress.usage] };
    }
    throw error;
  }
}

async function runStructured<T>(options: StructuredOptions<T>, signal: AbortSignal, remainingMs: () => number,
  progress: { attempts: number; usage: Usage[]; errors: string[] }): Promise<ApiResult<T>> {
  const { prompt, images, schema, semanticCheck = () => [], generate = vertexGenerate, onRejected } = options;
  const model = MODELS[options.model];
  const jsonSchema = toGeminiSchema(z.toJSONSchema(schema, { io: "input" }));
  const usage = progress.usage;
  let errors: string[] = [];

  for (let attempt = 1; attempt <= RETRIES + 1; attempt++) {
    signal.throwIfAborted();
    const feedback = errors.length ? `\n\nYour previous answer was rejected:\n${errors.map(e => `- ${e}`).join("\n")}\nReturn a corrected answer.` : "";
    const started = Date.now();
    let reply: Awaited<ReturnType<Generate>>;
    try {
      progress.attempts = attempt;
      reply = await generate({ model, prompt: prompt + feedback, images, jsonSchema, signal, timeoutMs: remainingMs() });
      signal.throwIfAborted();
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
    errors = progress.errors = result.errors;
    onRejected?.(reply.text, errors);
  }
  return { ok: false, errors, attempts: RETRIES + 1, usage };
}

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { SavedManual } from "@/schema";
import { callStructured, type Generate } from "@/pipeline/gemini";
import { analyzeStep } from "@/pipeline/analyzeStep";
import { MAX_OUTPUT_TOKENS, MODELS } from "@/pipeline/config";

const sdk = vi.hoisted(() => vi.fn());
vi.mock("@/pipeline/vertex", () => ({ getVertexClient: () => ({ models: { generateContent: sdk } }) }));
const reply = (value: unknown) => ({ text: JSON.stringify(value), inputTokens: 10, outputTokens: 5 });
const base = { prompt: "test", images: [], schema: z.object({ value: z.string() }), model: "fast" as const };
beforeEach(() => { vi.spyOn(console, "log").mockImplementation(() => {}); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); sdk.mockReset(); });

it("caps SDK output and disables hidden transport retries", async () => {
  sdk.mockResolvedValue({ text: '{"value":"ok"}' });
  await callStructured(base);
  expect(sdk.mock.calls[0][0].config).toMatchObject({ maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: expect.any(AbortSignal), httpOptions: { retryOptions: { attempts: 1 } } });
  expect(sdk.mock.calls[0][0].config).not.toHaveProperty("temperature");
  expect(sdk.mock.calls[0][0].config.httpOptions.timeout).toBeLessThanOrEqual(55_000);
});

it("returns a bounded failure even when a generator ignores cancellation", async () => {
  vi.useFakeTimers();
  const generate = vi.fn<Generate>(() => new Promise(() => {}));
  const pending = callStructured({ ...base, generate, timeoutMs: 10 });
  await vi.advanceTimersByTimeAsync(11);
  expect(await pending).toMatchObject({ ok: false, attempts: 1, usage: [] });
  expect(generate.mock.calls[0][0].signal?.aborted).toBe(true);
  expect(generate).toHaveBeenCalledTimes(1);
});

it("shares the deadline across validation retries and ignores late replies", async () => {
  vi.useFakeTimers();
  const generate = vi.fn<Generate>(async () => {
    await new Promise(resolve => setTimeout(resolve, 6));
    return reply({ value: 42 });
  });
  const pending = callStructured({ ...base, generate, timeoutMs: 10 });
  await vi.advanceTimersByTimeAsync(11);
  expect(await pending).toMatchObject({ ok: false, attempts: 2, usage: [expect.any(Object)] });
  vi.spyOn(console, "error").mockImplementation(() => {});
  await vi.advanceTimersByTimeAsync(20);
  expect(generate).toHaveBeenCalledTimes(2);
});

it("does not send a request after caller cancellation", async () => {
  const controller = new AbortController(); controller.abort();
  const generate = vi.fn<Generate>();
  await expect(callStructured({ ...base, generate, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
  expect(generate).not.toHaveBeenCalled();
});

it("preserves genuine nulls and removes only optional synthetic nulls, including nested unions", async () => {
  const schema = z.object({ required: z.string().nullable(), optional: z.string().nullable().optional(),
    plain: z.string().optional(), rows: z.array(z.union([
      z.object({ kind: z.literal("a"), note: z.string().optional() }),
      z.object({ kind: z.literal("b"), note: z.string().nullable() }),
    ])) });
  const data = { required: null, optional: null, plain: null, rows: [{ kind: "a", note: null }, { kind: "b", note: null }] };
  const result = await callStructured({ ...base, schema, generate: async () => reply(data) });
  expect(result).toMatchObject({ ok: true, data: { required: null, optional: null, rows: [{ kind: "a" }, { kind: "b", note: null }] } });
  if (result.ok) { expect(result.data).not.toHaveProperty("plain"); expect(result.data.rows[0]).not.toHaveProperty("note"); }
});

it("keeps required nonnullable nulls invalid", async () => {
  const result = await callStructured({ ...base, generate: async () => reply({ value: null }) });
  expect(result).toMatchObject({ ok: false, attempts: 3 });
});

it("passes complete layout to Flash and retries a mismatched requested step number", async () => {
  const gold = SavedManual.parse(JSON.parse(readFileSync("fixtures/kallax.gold.json", "utf8")));
  const generate = vi.fn<Generate>().mockResolvedValueOnce(reply({ stepNumber: 999, kind: "info",
    instruction: "Read the original diagram carefully.", actions: [], confidence: "high" }))
    .mockResolvedValueOnce(reply({ stepNumber: 2, kind: "info", instruction: "Read the original diagram carefully.", actions: [], confidence: "high" }));
  const result = await analyzeStep({ image: "YWJj", stepNumber: 2, parts: gold.layout.parts, placedPartIds: [], previousInstructions: [] }, { generate });
  expect(result).toMatchObject({ ok: true, attempts: 2 });
  expect(generate.mock.calls[0][0].model).toBe(MODELS.fast);
  expect(generate.mock.calls[0][0].prompt).toContain(JSON.stringify(gold.layout.parts, null, 2));
  expect(generate.mock.calls[1][0].prompt).toContain("stepNumber must be 2");
});

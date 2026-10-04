import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PageIndex, PartsLayout, Step } from "@/schema";
import { callStructured, toGeminiSchema, type Generate } from "@/pipeline/gemini";

// A fake Gemini: hands back the given answers in order and remembers every prompt it was sent.
function fakeModel(answers: string[]) {
  const prompts: string[] = [];
  const generate: Generate = async ({ prompt }) => {
    prompts.push(prompt);
    return { text: answers.shift() ?? "", inputTokens: 100, outputTokens: 20 };
  };
  return { generate, prompts };
}

const Answer = z.object({ stepNumber: z.number().int() });
const ask = (generate: Generate, semanticCheck?: (data: { stepNumber: number }) => string[]) =>
  callStructured({ prompt: "Which step is this?", images: [], schema: Answer, semanticCheck, model: "fast", generate });

beforeEach(() => { vi.spyOn(console, "log").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe("callStructured", () => {
  it("logs a failed request with its duration and rethrows the original error without retrying", async () => {
    const error = new Error("sensitive SDK error details");
    const generate = vi.fn<Generate>().mockRejectedValue(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1042);

    await expect(ask(generate)).rejects.toBe(error);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(
      /^\[gemini\] \S+ attempt 1\/3: request failed, 42 ms$/,
    ));
    expect(console.log).not.toHaveBeenCalled();
  });

  it("returns the answer when the first try is valid", async () => {
    const { generate, prompts } = fakeModel(['{"stepNumber": 3}']);
    const result = await ask(generate);
    expect(result).toMatchObject({ ok: true, data: { stepNumber: 3 }, attempts: 1 });
    expect(result.usage).toHaveLength(1);
    expect(prompts).toEqual(["Which step is this?"]);
  });

  it("sends the rejection reasons back and succeeds on the second try", async () => {
    const { generate, prompts } = fakeModel(['{"stepNumber": "three"}', '{"stepNumber": 3}']);
    const result = await ask(generate);
    expect(result).toMatchObject({ ok: true, data: { stepNumber: 3 }, attempts: 2 });
    expect(prompts[1]).toContain("Your previous answer was rejected");
    expect(prompts[1]).toContain("stepNumber: Invalid input: expected number, received string");
  });

  it("gives up after 3 tries and returns the last errors", async () => {
    const { generate, prompts } = fakeModel(["not json", '{"stepNumber": 4}', '{"stepNumber": 4}']);
    const result = await ask(generate, data => (data.stepNumber === 3 ? [] : [`step ${data.stepNumber} is not on this page`]));
    expect(result).toMatchObject({ ok: false, errors: ["step 4 is not on this page"], attempts: 3 });
    expect(result.usage).toHaveLength(3);
    expect(prompts[1]).toContain("The answer was not valid JSON.");
  });
});

describe("toGeminiSchema", () => {
  it("only sends JSON Schema rules Gemini supports", () => {
    const supported = new Set(["type", "enum", "items", "prefixItems", "minItems", "maxItems", "minimum", "maximum",
      "anyOf", "properties", "required"]);
    const used = new Set<string>();
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      for (const [key, value] of Object.entries(node)) {
        used.add(key);
        if (key === "properties") Object.values(value as object).forEach(walk);
        else walk(value);
      }
    };
    for (const schema of [PageIndex, PartsLayout, Step]) walk(toGeminiSchema(z.toJSONSchema(schema, { io: "input" })));
    expect([...used].filter(key => !supported.has(key))).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/parts/route";
import type { Generate } from "@/pipeline/gemini";
import { partsLayout } from "@/pipeline/partsLayout";
import type { PartsRequest } from "@/schema";
import { layout } from "./helpers/schemaFixtures";

const request: PartsRequest = { title: "KALLAX", productSizeCm: [77, 147, 39], partsPages: ["PARTS"], cover: "COVER", stepThumbs: ["T1", "T2"] };

// A fake Gemini: hands back the given answers in order and records what it was sent.
function fakeModel(answers: unknown[]) {
  const sent: { prompt: string; images: string[] }[] = [];
  const generate: Generate = async ({ prompt, images }) => {
    sent.push({ prompt, images });
    return { text: JSON.stringify(answers.shift()), inputTokens: 100, outputTokens: 20 };
  };
  return { generate, sent };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("partsLayout", () => {
  it("accepts the gold KALLAX layout and sends cover, parts pages, then step thumbnails", async () => {
    const { generate, sent } = fakeModel([layout]);
    const result = await partsLayout(request, { generate });
    expect(result).toMatchObject({ ok: true, attempts: 1 });
    expect(result.ok && result.data.parts).toHaveLength(13);
    expect(sent[0].images).toEqual(["COVER", "PARTS", "T1", "T2"]);
    expect(sent[0].prompt).toContain("77 × 147 × 39 cm");
    expect(sent[0].prompt).toContain("None.");
  });

  it("asks again when the layout breaks a parts rule", async () => {
    const broken = { ...layout, parts: layout.parts.map(p => (p.id === "S1" ? { ...p, sizeFrac: undefined } : p)) };
    const { generate, sent } = fakeModel([broken, layout]);
    const result = await partsLayout(request, { generate });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(sent[1].prompt).toContain('part "S1": non-hardware needs sizeFrac and homeFrac');
  });

  it("passes the browser's previousErrors (from snapLayout) into the prompt", async () => {
    const { generate, sent } = fakeModel([layout]);
    await partsLayout({ ...request, previousErrors: ["shelf_2 overlaps shelf_3"] }, { generate });
    expect(sent[0].prompt).toContain("Fix these problems:\n- shelf_2 overlaps shelf_3");
  });
});

describe("POST /api/parts", () => {
  it("answers 400 without any parts pages", async () => {
    const body = JSON.stringify({ ...request, partsPages: [] });
    expect((await POST(new Request("http://localhost/api/parts", { method: "POST", body }))).status).toBe(400);
  });

  it("answers 503 without Google Cloud settings, and never reaches the network", async () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
    vi.stubGlobal("fetch", async () => { throw new Error("network is forbidden in tests"); });
    const response = await POST(new Request("http://localhost/api/parts", { method: "POST", body: JSON.stringify(request) }));
    expect(response.status).toBe(503);
  });
});

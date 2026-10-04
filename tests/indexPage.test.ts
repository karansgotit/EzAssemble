import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { POST } from "@/app/api/index-page/route";
import type { Generate } from "@/pipeline/gemini";
import { indexPage } from "@/pipeline/indexPage";
import { handleAiRoute } from "@/pipeline/route";
import { VertexConfigError } from "@/pipeline/vertex";

const post = (body: unknown) =>
  new Request("http://localhost/api/index-page", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

// A fake Gemini that hands back the given answers in order.
const fakeModel = (answers: unknown[]): Generate => async () =>
  ({ text: JSON.stringify(answers.shift()), inputTokens: 100, outputTokens: 20 });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("indexPage", () => {
  const request = { image: "/9j/", pageNumber: 9 };
  const page9 = { pageType: "steps", steps: [
    { stepNumber: 3, box: [35, 20, 340, 980], variant: null, subassembly: null },
    { stepNumber: 4, box: [370, 20, 725, 980], variant: null, subassembly: null },
  ] };

  it("returns the page index and drops the 'none' fields", async () => {
    const result = await indexPage(request, { generate: fakeModel([page9]) });
    expect(result).toMatchObject({ ok: true, attempts: 1 });
    expect(result.ok && result.data.steps[0]).toEqual({ stepNumber: 3, box: [35, 20, 340, 980] });
  });

  it("asks again when the same step is boxed twice", async () => {
    const twice = { ...page9, steps: [page9.steps[0], page9.steps[0]] };
    const result = await indexPage(request, { generate: fakeModel([twice, page9]) });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
  });

  it("retries an empty steps page with actionable feedback", async () => {
    const generate = vi.fn(fakeModel([{ pageType: "steps", steps: [] }, page9]));
    const result = await indexPage(request, { generate });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(generate.mock.calls[1][0].prompt).toContain("must contain at least one numbered step box");
  });

  it("fails after three empty steps pages rather than silently accepting them", async () => {
    const empty = { pageType: "steps", steps: [] };
    const result = await indexPage(request, { generate: fakeModel([empty, empty, empty]) });
    expect(result).toMatchObject({ ok: false, attempts: 3 });
  });

  it("still accepts non-step pages without boxes", async () => {
    const result = await indexPage(request, { generate: fakeModel([{ pageType: "tools", steps: [] }]) });
    expect(result).toMatchObject({ ok: true, attempts: 1, data: { pageType: "tools", steps: [] } });
  });

  it("rejects step boxes on a page that is not a steps page", async () => {
    const wrong = { ...page9, pageType: "parts" };
    const result = await indexPage(request, { generate: fakeModel([wrong, wrong, wrong]) });
    expect(result).toMatchObject({ ok: false, attempts: 3 });
  });
});

describe("handleAiRoute", () => {
  const Body = z.object({ n: z.number() });
  const call = (body: unknown, run: () => Promise<unknown>) => handleAiRoute(post(body), Body, run);

  it("answers 400 for a body that is not JSON or does not fit the request schema", async () => {
    expect((await call("not json", async () => ({}))).status).toBe(400);
    const bad = await call({ n: "two" }, async () => ({}));
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ ok: false, error: expect.stringContaining("n:") });
  });

  it("answers 200 with the result, including ok: false from the AI", async () => {
    const result = { ok: false, errors: ["step 3 appears twice"], attempts: 3, usage: [] };
    const response = await call({ n: 1 }, async () => result);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
  });

  it("answers 503 when Vertex AI is unavailable or not configured, 500 for anything else", async () => {
    expect((await call({ n: 1 }, async () => { throw new VertexConfigError("GOOGLE_CLOUD_PROJECT is not set."); })).status).toBe(503);
    expect((await call({ n: 1 }, async () => { throw new ApiError({ message: "busy", status: 429 }); })).status).toBe(503);
    expect((await call({ n: 1 }, async () => { throw new ApiError({ message: "down", status: 503 }); })).status).toBe(503);
    const crash = await call({ n: 1 }, async () => { throw new Error("secret details"); });
    expect(crash.status).toBe(500);
    expect(JSON.stringify(await crash.json())).not.toContain("secret details");
  });
});

describe("POST /api/index-page", () => {
  it("answers 503 without Google Cloud settings, and never reaches the network", async () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
    vi.stubGlobal("fetch", async () => { throw new Error("network is forbidden in tests"); });
    const response = await POST(post({ image: "/9j/", pageNumber: 1 }));
    expect(response.status).toBe(503);
  });

  it("answers 400 for a page number below 1", async () => {
    expect((await POST(post({ image: "/9j/", pageNumber: 0 }))).status).toBe(400);
  });
});

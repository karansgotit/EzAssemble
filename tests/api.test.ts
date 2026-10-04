import { describe, expect, it } from "vitest";
import { type ApiDeps, createApi } from "@/client/api";
import { createMockApi } from "@/client/api.mock";
import { saved as gold } from "./helpers/schemaFixtures";

const page = { pageType: "steps", steps: [{ stepNumber: 3, box: [35, 20, 340, 980] }] };
const okBody = { ok: true, data: page, attempts: 1, usage: [{ model: "m", inputTokens: 10, outputTokens: 5, ms: 900 }] };
const request = { image: "abc", pageNumber: 9 };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A fetch that answers from a queue; an Error entry is thrown like a network failure. */
function fakeDeps(...answers: (Response | Error)[]) {
  const calls: { url: string; body: unknown }[] = [];
  const sleeps: number[] = [];
  const deps: ApiDeps = {
    fetch: async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      const answer = answers.shift();
      if (!answer) throw new Error("no answer queued");
      if (answer instanceof Error) throw answer;
      return answer;
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  };
  return { deps, calls, sleeps };
}

describe("createApi", () => {
  it("posts the request and returns the validated data", async () => {
    const { deps, calls } = fakeDeps(json(okBody));
    const result = await createApi(deps).indexPage(request);
    expect(result).toEqual(okBody);
    expect(calls).toEqual([{ url: "/api/index-page", body: request }]);
  });

  it("retries once after 2 s on a 5xx, then succeeds", async () => {
    const { deps, calls, sleeps } = fakeDeps(json({}, 500), json(okBody));
    const result = await createApi(deps).indexPage(request);
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it("retries once on a network error", async () => {
    const { deps, calls, sleeps } = fakeDeps(new TypeError("fetch failed"), json(okBody));
    expect((await createApi(deps).indexPage(request)).ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(sleeps).toEqual([2000]);
  });

  it("gives up after the second failure, without throwing", async () => {
    const { deps, calls } = fakeDeps(json({}, 503), json({}, 503));
    const result = await createApi(deps).indexPage(request);
    expect(result).toMatchObject({ ok: false, errors: ["The AI service is unavailable right now."] });
    expect(calls).toHaveLength(2);
  });

  it("does not retry an AI failure (ok: false)", async () => {
    const aiFailure = { ok: false, errors: ["action 2: target \"L3\" is not a known part id"], attempts: 3, usage: [] };
    const { deps, calls, sleeps } = fakeDeps(json(aiFailure));
    expect(await createApi(deps).indexPage(request)).toEqual(aiFailure);
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it("does not retry a 400", async () => {
    const { deps, calls } = fakeDeps(json({ error: "bad body" }, 400));
    const result = await createApi(deps).indexPage(request);
    expect(result).toMatchObject({ ok: false, errors: ["The server rejected the request (400): bad body"] });
    expect(calls).toHaveLength(1);
  });

  it("rejects an invalid request without calling the server", async () => {
    const { deps, calls } = fakeDeps();
    const result = await createApi(deps).indexPage({ image: "", pageNumber: 0 });
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("rejects data that does not match the schema", async () => {
    const { deps } = fakeDeps(json({ ...okBody, data: { pageType: "steps", steps: [{ stepNumber: 3, box: [500, 20, 340, 980] }] } }));
    const result = await createApi(deps).indexPage(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toBe("The server sent data in an unexpected shape.");
  });

  it("times out without retrying", async () => {
    const calls: number[] = [];
    const deps: ApiDeps = {
      fetch: (_input, init) =>
        new Promise((_resolve, reject) => {
          calls.push(1);
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
      sleep: async () => {},
    };
    const result = await createApi(deps).analyzeStep(
      { image: "abc", stepNumber: 1, parts: [], placedPartIds: [], previousInstructions: [] },
      { timeoutMs: 20 },
    );
    expect(result).toMatchObject({ ok: false, errors: ["The request timed out after 0 s."] });
    expect(calls).toHaveLength(1);
  });

  it("stops when the caller cancels", async () => {
    const { deps, calls } = fakeDeps(json(okBody));
    const controller = new AbortController();
    controller.abort();
    expect(await createApi(deps).indexPage(request, { signal: controller.signal })).toMatchObject({ ok: false, errors: ["Cancelled."] });
    expect(calls).toHaveLength(0);
  });

  it("sends a parts request that already fits the budget unchanged", async () => {
    const layout = { ok: true, data: gold.layout, attempts: 1, usage: [] };
    const { deps, calls } = fakeDeps(json(layout));
    const parts = { title: "KALLAX", productSizeCm: [77, 147, 39] as [number, number, number], partsPages: ["p"], cover: "c", stepThumbs: ["t"] };
    expect((await createApi(deps).parts(parts)).ok).toBe(true);
    expect(calls).toEqual([{ url: "/api/parts", body: parts }]);
  });

  it("explains that saving only works locally on a 404", async () => {
    const { deps } = fakeDeps(new Response("", { status: 404 }));
    const result = await createApi(deps).saveManual({ manual: gold, crops: [] });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("only works when running locally");
  });
});

describe("createApi with a development fallback", () => {
  const fallback = () => ({ api: createMockApi(gold, { delay: async () => {} }), missing: new Set<string>() });

  it("answers from the fallback when the route is not built (404), and asks the server only once", async () => {
    const { deps, calls } = fakeDeps(new Response("", { status: 404 }));
    const route = fallback();
    const api = createApi(deps, route);
    expect(await api.indexPage({ image: "abc", pageNumber: 9 })).toMatchObject({ ok: true, data: gold.pages[8] });
    expect(await api.indexPage({ image: "abc", pageNumber: 10 })).toMatchObject({ ok: true, data: gold.pages[9] });
    expect(calls).toHaveLength(1);
    expect([...route.missing]).toEqual(["/api/index-page"]);
  });

  it("uses the real answer when the route exists, and falls back per route", async () => {
    const { deps, calls } = fakeDeps(json(okBody), new Response("", { status: 404 }));
    const route = fallback();
    const api = createApi(deps, route);
    expect(await api.indexPage(request)).toEqual(okBody);
    expect(await api.analyzeStep({ image: "abc", stepNumber: 2, parts: [], placedPartIds: [], previousInstructions: [] })).toMatchObject({ ok: true, data: { stepNumber: 2 } });
    expect(calls.map((call) => call.url)).toEqual(["/api/index-page", "/api/analyze-step"]);
    expect([...route.missing]).toEqual(["/api/analyze-step"]);
  });

  it("does not fall back on other failures", async () => {
    const { deps } = fakeDeps(json({}, 503), json({}, 503));
    const route = fallback();
    expect((await createApi(deps, route).indexPage(request)).ok).toBe(false);
    expect(route.missing.size).toBe(0);
  });

  it("treats a 404 as a failure when there is no fallback (production)", async () => {
    const { deps } = fakeDeps(new Response("", { status: 404 }));
    expect(await createApi(deps).indexPage(request)).toMatchObject({ ok: false, errors: ["The server rejected the request (404)"] });
  });
});

describe("createMockApi", () => {
  const instant = { delay: async () => {} };
  const stepRequest = (stepNumber: number) => ({ image: "abc", stepNumber, parts: [], placedPartIds: [], previousInstructions: [] });

  it("answers each call from the saved manual", async () => {
    const api = createMockApi(gold, instant);
    expect(await api.indexPage({ image: "abc", pageNumber: 9 })).toMatchObject({ ok: true, data: gold.pages[8] });
    expect(await api.parts({ title: "x", productSizeCm: [1, 1, 1], partsPages: ["p"], cover: "c", stepThumbs: [] })).toMatchObject({ ok: true, data: gold.layout });
    expect(await api.analyzeStep(stepRequest(2))).toMatchObject({ ok: true, data: { stepNumber: 2 } });
  });

  it("fails the step named by mockFail, and only that one", async () => {
    const api = createMockApi(gold, { ...instant, failStep: 2 });
    expect((await api.analyzeStep(stepRequest(2))).ok).toBe(false);
    expect((await api.analyzeStep(stepRequest(1))).ok).toBe(true);
  });

  it("returns ok: false for a page or step the manual does not have", async () => {
    const api = createMockApi(gold, instant);
    expect((await api.indexPage({ image: "abc", pageNumber: 99 })).ok).toBe(false);
    expect((await api.analyzeStep(stepRequest(99))).ok).toBe(false);
  });
});

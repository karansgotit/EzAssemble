import { describe, expect, it } from "vitest";
import type { Api } from "@/client/api";
import { createMockApi } from "@/client/api.mock";
import { ProcessError, type ProcessEvent, processManual } from "@/client/processManual";
import { countUnits, listNumbers, mapLimit, missingStepNumbers, pickSteps, planSteps, subassemblyMessage, totalUsage } from "@/client/processSteps";
import type { PageIndex, SavedManual } from "@/schema";
import { saved as gold } from "./helpers/schemaFixtures";

const instant = { delay: async () => {} };
const input = { file: new File(["%PDF-"], "kallax.pdf"), title: gold.title, id: "kallax", productSizeCm: gold.productSizeCm };

/** Stand-ins for the canvas work: one fake image per gold page, and crops that name what was cut. */
const browserless = {
  rasterize: async () => gold.pages.map((_, i) => ({ pageNumber: i + 1, jpegBase64: `page-${i + 1}`, width: 1131, height: 1600 })),
  cropBox: async (page: { jpegBase64: string }, box: number[], opts?: { maxLongSide?: number }) =>
    `${opts?.maxLongSide ? "thumb" : "crop"}:${page.jpegBase64}:${box.join(",")}`,
};

async function run(api: Api, options = {}) {
  const events: ProcessEvent[] = [];
  const manual = await processManual(input, (event) => events.push(event), api, { ...browserless, ...options });
  return { manual, events };
}

const okSteps = (manual: SavedManual) => manual.steps.flatMap((s) => (s.status === "ok" ? [s.step] : []));

describe("processManual on gold KALLAX through the mock API", () => {
  it("produces a saved manual whose pages, layout and steps equal gold", async () => {
    const { manual } = await run(createMockApi(gold, instant));
    expect(manual.pages).toEqual(gold.pages);
    expect(manual.layout).toEqual(gold.layout);
    expect(okSteps(manual)).toEqual(okSteps(gold));
    expect(manual.steps.map((s) => (s.status === "ok" ? s.crop : ""))).toEqual(gold.steps.map((s) => (s.status === "ok" ? s.crop : "")));
    expect(manual).toMatchObject({ schemaVersion: 1, id: "kallax", title: gold.title, productSizeCm: gold.productSizeCm });
  });

  it("keeps one path through the branching steps 15–19", async () => {
    const { manual } = await run(createMockApi(gold, instant));
    expect(okSteps(manual).map((step) => step.stepNumber)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
  });

  it("reports the stages in order and streams the manual after every step", async () => {
    const { events } = await run(createMockApi(gold, instant));
    const stages = events.flatMap((e) => (e.type === "stage" && !e.detail ? [e.stage] : []));
    expect(stages).toEqual(["rasterize", "index", "parts", "steps", "done"]);
    const manuals = events.flatMap((e) => (e.type === "manual" ? [e.manual.steps.length] : []));
    expect(manuals).toEqual([...Array.from({ length: 19 }, (_, i) => i + 1), 19]);
    expect(events.filter((e) => e.type === "error")).toEqual([]);
  });

  it("hands over one named crop per analysed step", async () => {
    const { events } = await run(createMockApi(gold, instant));
    const crops = events.flatMap((e) => (e.type === "crops" ? e.crops : []));
    expect(crops).toHaveLength(19);
    expect(crops[0]).toEqual({ name: "step-01.jpg", base64: "crop:page-8:" + gold.pages[7].steps.find((s) => s.stepNumber === 1)?.box.join(",") });
  });

  it("counts every call in the usage totals", async () => {
    const { manual } = await run(createMockApi(gold, instant));
    expect(manual.usage).toMatchObject({ calls: 24 + 1 + 19 });
  });

  it("tells each step call what is already built and said", async () => {
    const mock = createMockApi(gold, instant);
    const requests: { stepNumber: number; placedPartIds: string[]; previousInstructions: string[]; image: string }[] = [];
    const api: Api = { ...mock, analyzeStep: (req, opts) => (requests.push(req), mock.analyzeStep(req, opts)) };
    await run(api);
    expect(requests.map((r) => r.stepNumber)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
    expect(requests[0]).toMatchObject({ placedPartIds: [], previousInstructions: [] });
    expect(requests[2].previousInstructions).toEqual(okSteps(gold).slice(0, 2).map((step) => step.instruction));
    expect(requests[2].placedPartIds.length).toBeGreaterThan(0);
    expect(requests[2].image).toMatch(/^crop:page-9:/);
  });

  it("turns a failed step into a fallback without stopping the run", async () => {
    const { manual, events } = await run(createMockApi(gold, { ...instant, failStep: 7 }));
    expect(manual.steps).toHaveLength(19);
    expect(manual.steps[6]).toMatchObject({ status: "failed", stepNumber: 7, crop: "crops/step-07.jpg", attempts: 3 });
    expect(manual.steps[7].status).toBe("ok");
    expect(events.filter((e) => e.type === "error")).toEqual([]);
  });
});

describe("processManual when things go wrong", () => {
  it("skips a page that can't be indexed and says which steps are missing", async () => {
    const mock = createMockApi(gold, instant);
    const api: Api = { ...mock, indexPage: (req, opts) => (req.pageNumber === 10 ? Promise.resolve({ ok: false, errors: ["x"], attempts: 3, usage: [] }) : mock.indexPage(req, opts)) };
    const { manual, events } = await run(api);
    expect(manual.pages[9]).toEqual({ pageType: "other", steps: [] });
    expect(okSteps(manual).map((step) => step.stepNumber)).not.toContain(6);
    expect(events).toContainEqual({ type: "stage", stage: "index", detail: "Page 10 couldn't be read. Steps 6 and 7 not found." });
  });

  it("stops with a readable error when the parts can't be identified", async () => {
    const mock = createMockApi(gold, instant);
    const api: Api = { ...mock, parts: async () => ({ ok: false, errors: ["x"], attempts: 3, usage: [] }) };
    const events: ProcessEvent[] = [];
    await expect(processManual(input, (e) => events.push(e), api, browserless)).rejects.toBeInstanceOf(ProcessError);
    expect(events.at(-1)).toEqual({ type: "error", message: "Couldn't identify the parts in this manual." });
  });

  it("passes a PDF problem through in its own words", async () => {
    const events: ProcessEvent[] = [];
    const broken = { ...browserless, rasterize: async () => Promise.reject(new Error("This PDF is password-protected. Upload a copy without a password.")) };
    await expect(processManual(input, (e) => events.push(e), createMockApi(gold, instant), broken)).rejects.toThrow("password-protected");
    expect(events.at(-1)).toMatchObject({ type: "error" });
  });

  it("stops when no steps are found", async () => {
    const mock = createMockApi(gold, instant);
    const api: Api = { ...mock, indexPage: async () => ({ ok: true, data: { pageType: "other", steps: [] }, attempts: 1, usage: [] }) };
    await expect(run(api)).rejects.toThrow("No assembly steps were found");
  });

  it("asks for the parts once more, with the errors, when the layout can't be made sound", async () => {
    const mock = createMockApi(gold, instant);
    const broken = { ...gold.layout, parts: gold.layout.parts.map((part) => (part.id === "S1" ? { ...part, homeFrac: [0.5, 0.5, 0.5] as [number, number, number], sizeFrac: [0.5, 1, 0.9] as [number, number, number] } : part)) };
    const seen: (string[] | undefined)[] = [];
    const api: Api = {
      ...mock,
      parts: async (req, opts) => {
        seen.push(req.previousErrors);
        return seen.length === 1 ? { ok: true, data: broken, attempts: 1, usage: [] } : mock.parts(req, opts);
      },
    };
    const { manual } = await run(api);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBeUndefined();
    expect(seen[1]?.length).toBeGreaterThan(0);
    expect(manual.layout).toEqual(gold.layout);
  });

  it("stops when cancelled", async () => {
    const controller = new AbortController();
    const mock = createMockApi(gold, instant);
    const api: Api = { ...mock, parts: (req, opts) => (controller.abort(), mock.parts(req, opts)) };
    await expect(run(api, { signal: controller.signal })).rejects.toThrow("Cancelled.");
  });
});

describe("step planning helpers", () => {
  const page = (...steps: PageIndex["steps"]): PageIndex => ({ pageType: "steps", steps });
  const box: [number, number, number, number] = [0, 0, 500, 1000];

  it("keeps the first variant of a repeated step number", () => {
    const refs = pickSteps([page({ stepNumber: 15, box, variant: "vertical" }), page({ stepNumber: 15, box, variant: "horizontal" })]);
    expect(refs).toEqual([{ stepNumber: 15, pageNumber: 1, box }]);
  });

  it("orders steps by number even when pages list them out of order", () => {
    const refs = pickSteps([page({ stepNumber: 2, box: [500, 0, 900, 1000] }, { stepNumber: 1, box }), page({ stepNumber: 3, box })]);
    expect(refs.map((r) => [r.stepNumber, r.pageNumber])).toEqual([[1, 1], [2, 1], [3, 2]]);
  });

  it("finds gaps in the step numbers", () => {
    expect(missingStepNumbers(pickSteps([page({ stepNumber: 1, box }, { stepNumber: 4, box })]))).toEqual([2, 3]);
  });

  it("collapses a run of sub-assembly steps into one card", () => {
    const refs = pickSteps([
      page({ stepNumber: 1, box }, { stepNumber: 2, box, subassembly: "drawer" }, { stepNumber: 3, box, subassembly: "drawer" }),
      page({ stepNumber: 4, box }, { stepNumber: 5, box, subassembly: "door" }),
    ]);
    expect(planSteps(refs).map((p) => (p.kind === "analyse" ? p.ref.stepNumber : `${p.label}:${p.sourceSteps}`))).toEqual([1, "drawer:2,3", 4, "door:5"]);
  });

  it("writes the sub-assembly message from the template", () => {
    expect(subassemblyMessage("drawer", [20, 21, 22], 2)).toBe("The 2 drawers are assembled separately (manual steps 20–22). Follow the manual for those, then continue here.");
    expect(subassemblyMessage("drawer", [20], 1)).toBe("The drawer is assembled separately (manual step 20). Follow the manual for those, then continue here.");
    expect(subassemblyMessage("drawer", [20, 21], 0)).toBe("The drawers are assembled separately (manual steps 20–21). Follow the manual for those, then continue here.");
  });

  it("counts finished units by label", () => {
    const part = (id: string, kind: "other" | "panel") => ({ id, label: id, kind, count: 1, shape: "box" as const, features: [] });
    expect(countUnits("drawer", [part("drawer_1", "other"), part("drawer_2", "other"), part("drawer_front", "panel")])).toBe(2);
  });

  it("puts a sub-assembly card in the saved manual without analysing those steps", async () => {
    const pages: PageIndex[] = [{ pageType: "cover", steps: [] }, { pageType: "parts", steps: [] }, page({ stepNumber: 1, box }, { stepNumber: 2, box: [500, 0, 900, 1000], subassembly: "drawer" }, { stepNumber: 3, box: [900, 0, 1000, 1000], subassembly: "drawer" })];
    const source: SavedManual = { ...gold, pages };
    const analysed: number[] = [];
    const mock = createMockApi(source, instant);
    const api: Api = { ...mock, analyzeStep: (req, opts) => (analysed.push(req.stepNumber), mock.analyzeStep(req, opts)) };
    const manual = await processManual(input, () => {}, api, { ...browserless, rasterize: async () => pages.map((_, i) => ({ pageNumber: i + 1, jpegBase64: `page-${i + 1}`, width: 1131, height: 1600 })) });
    expect(analysed).toEqual([1]);
    expect(manual.steps[1]).toMatchObject({ status: "subassembly", stepNumber: 2, sourceSteps: [2, 3], label: "drawer" });
  });
});

describe("small helpers", () => {
  it("lists numbers readably", () => {
    expect([listNumbers([7]), listNumbers([7, 8]), listNumbers([7, 8, 12])]).toEqual(["7", "7 and 8", "7, 8 and 12"]);
  });

  it("mapLimit keeps order and never runs more than the limit at once", async () => {
    let running = 0;
    let peak = 0;
    const results = await mapLimit([30, 5, 20, 1, 10], 2, async (ms, i) => {
      peak = Math.max(peak, ++running);
      await new Promise((resolve) => setTimeout(resolve, ms));
      running--;
      return i;
    });
    expect(results).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it("totals usage and prices known models", () => {
    const totals = totalUsage([
      { model: "gemini-3.8-flash", inputTokens: 1_000_000, outputTokens: 100_000, ms: 1 },
      { model: "mock", inputTokens: 5, outputTokens: 5, ms: 1 },
    ]);
    expect(totals).toEqual({ calls: 2, inputTokens: 1_000_005, outputTokens: 100_005, estUsd: 1.125 });
  });
});

// Cross-team chain: Karan's schema and checks → Ajit's layout and scene → Smit's player and mock API.
// Each area has its own tests; this file only checks that the pieces accept each other's output.
// It runs on the gold KALLAX fixtures (fixtures/kallax.gold.json and kallax.scene.json, via tests/helpers).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createMockApi } from "@/client/api.mock";
import { fakeManual } from "@/fake-data/manual";
import { partsForStep } from "@/player/stepView";
import { snapLayout } from "@/scene/layout";
import { resolveScene } from "@/scene/resolveScene";
import { buildTracks } from "@/scene/tracks";
import { checkCumulativeCounts, checkPartsLayout, checkStep, LibraryIndex, placedPartsAfterStep, SceneManual, type Step } from "@/schema";
import { saved, scene } from "./helpers/schemaFixtures";

const BUILD_SIZE: [number, number, number] = [147, 39, 77];

/** What AJI-03's buildSceneManual will do, reduced to the fields this test needs. */
function toSceneManual() {
  const snapped = snapLayout(saved.layout, BUILD_SIZE);
  const steps = saved.steps.flatMap((s) =>
    s.status === "ok"
      ? [{ stepNumber: s.step.stepNumber, kind: s.step.kind, instruction: s.step.instruction, actions: s.step.actions, confidence: s.step.confidence }]
      : [],
  );
  return { snapped, manual: SceneManual.parse({ id: saved.id, title: saved.title, buildSizeCm: BUILD_SIZE, buildOrientation: saved.layout.buildOrientation, parts: snapped.parts, steps }) };
}

describe("saved manual → scene → player", () => {
  it("the saved KALLAX manual passes the semantic checks", () => {
    expect(checkPartsLayout(saved.layout)).toEqual([]);
    let placed: string[] = [];
    const steps: Step[] = [];
    for (const s of saved.steps) {
      if (s.status !== "ok") continue;
      expect(checkStep(s.step, saved.layout.parts, placed)).toEqual([]);
      placed = placedPartsAfterStep(s.step, saved.layout.parts, placed);
      steps.push(s.step);
    }
    expect(checkCumulativeCounts(steps, saved.layout.parts)).toEqual([]);
  });

  it("snapLayout turns the saved fractions back into the hand-made geometry", () => {
    const { snapped } = toSceneManual();
    expect(snapped.ok).toBe(true);
    for (const part of snapped.parts) {
      const reference = scene.parts.find((p) => p.id === part.id);
      for (const key of ["homeCm", "sizeCm"] as const) {
        part[key]?.forEach((value, i) => expect(Math.abs(value - (reference?.[key]?.[i] ?? NaN))).toBeLessThan(0.5));
      }
    }
  });

  it("the scene resolves and animates every step of the manual built from saved data", () => {
    const { manual } = toSceneManual();
    for (let n = 1; n <= manual.steps.length; n++) {
      expect(() => buildTracks(manual, resolveScene(manual, n - 1), resolveScene(manual, n))).not.toThrow();
    }
    const kinds = new Map<string, number>();
    for (const piece of resolveScene(manual, manual.steps.length).placed.values()) {
      const kind = manual.parts.find((p) => p.id === piece.partId)?.kind ?? "unknown";
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    }
    expect(Object.fromEntries(kinds)).toEqual({ panel: 11, dowel: 22, screw: 8 });
  });

  it("the player's parts tray reads the built manual", () => {
    const { manual } = toSceneManual();
    expect(partsForStep(manual.parts, manual.steps[2]).map((item) => `${item.id}×${item.count}`)).toEqual(["dowel×2", "S1×1"]);
  });
});

describe("fake data stays valid against the real schema", () => {
  it("fakeManual is a SceneManual", () => {
    expect(SceneManual.safeParse(fakeManual).error?.issues ?? []).toEqual([]);
  });

});

describe("mock API on a saved manual", () => {
  it("answers parts and steps from the saved KALLAX manual", async () => {
    const api = createMockApi(saved, { delay: async () => {} });
    expect((await api.parts({ title: "x", productSizeCm: [77, 147, 39], partsPages: ["p"], cover: "c", stepThumbs: [] })).ok).toBe(true);
    expect(await api.analyzeStep({ image: "x", stepNumber: 3, parts: [], placedPartIds: [], previousInstructions: [] })).toMatchObject({ ok: true, data: { stepNumber: 3 } });
  });

  it("answers indexPage for every page of the PDF, and finds all 19 steps", async () => {
    const api = createMockApi(saved, { delay: async () => {} });
    const stepNumbers = new Set<number>();
    for (let pageNumber = 1; pageNumber <= saved.pages.length; pageNumber++) {
      const result = await api.indexPage({ image: "x", pageNumber });
      expect(result.ok).toBe(true);
      if (result.ok) result.data.steps.forEach((step) => stepNumbers.add(step.stepNumber));
    }
    expect([...stepNumbers].sort((a, b) => a - b)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1));
  });
});

describe("the library files the app serves", () => {
  const publicDir = new URL("../public/manuals/", import.meta.url);

  it("every gold step has a crop named crops/step-NN.jpg that exists on disk", () => {
    for (const step of saved.steps) {
      if (step.status === "subassembly") continue;
      expect(step.crop).toMatch(/^crops\/step-\d{2}\.jpg$/);
      expect(existsSync(new URL(`kallax/${step.crop}`, publicDir))).toBe(true);
    }
  });

  it("the scene fixture points at the same crops the player will request", () => {
    for (const step of scene.steps) {
      if (step.crop) expect(existsSync(new URL(`.${step.crop.replace("/manuals", "")}`, publicDir))).toBe(true);
    }
  });

  it("index.json lists KALLAX with the right step count and an existing thumbnail", () => {
    const index = LibraryIndex.parse(JSON.parse(readFileSync(new URL("index.json", publicDir), "utf8")));
    const entry = index.find((manual) => manual.id === saved.id);
    expect(entry?.stepCount).toBe(saved.steps.length);
    expect(existsSync(new URL(`kallax/${entry?.thumbnail}`, publicDir))).toBe(true);
  });
});

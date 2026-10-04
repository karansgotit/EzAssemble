import { readFileSync, readdirSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LibraryIndex, SavedManual, SceneManual, checkCumulativeCounts, checkPartsLayout, checkStep, placedPartsAfterStep } from "@/schema";
import { snapLayout } from "@/scene/layout";
import { resolveScene } from "@/scene/resolveScene";
import { layout, saved, scene, steps } from "./helpers/schemaFixtures";

const root = new URL("../", import.meta.url);
const json = (path: string): unknown => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const numbers = Array.from({ length: 19 }, (_, i) => i + 1);
const cropName = (n: number) => `step-${String(n).padStart(2, "0")}.jpg`;
const prototype = json("reference/prototype/src/fixtures/kallax.json") as {
  parts: SceneManual["parts"];
  steps: { stepNumber: number; kind: string; instruction: string; actions: unknown[];
    confidence: string; orientationTrap?: { part: string; mustFace: string; wrong: string; hint: string } }[];
};

describe("KAR-02 generated KALLAX fixtures", () => {
  it("loads both actual fixture files through their schemas", () => {
    expect(SavedManual.safeParse(json("fixtures/kallax.gold.json")).success).toBe(true);
    expect(SceneManual.safeParse(json("fixtures/kallax.scene.json")).success).toBe(true);
    expect(saved.id).toBe("kallax");
    expect(scene.id).toBe(saved.id);
    expect(scene.title).toBe(saved.title);
    expect(saved.productSizeCm).toEqual([77, 147, 39]);
    expect(scene.buildSizeCm).toEqual([147, 39, 77]);
    expect(layout.buildOrientation).toBe("on-back");
    expect(scene.buildOrientation).toBe("on-back");
    expect(scene.parts).toEqual(prototype.parts);
    expect(scene.steps.map(step => step.stepNumber)).toEqual(numbers);
    expect(steps.map(step => step.stepNumber)).toEqual(numbers);
    expect(saved.steps.every(step => step.status === "ok" && step.attempts === 1)).toBe(true);
  });

  it("preserves the prototype's actions, instructions, confidence and manual traps", () => {
    for (const original of prototype.steps) {
      const converted = scene.steps[original.stepNumber - 1];
      const stored = steps[original.stepNumber - 1];
      for (const step of [converted, stored]) {
        expect(step.kind).toBe(original.kind);
        expect(step.instruction).toBe(original.instruction);
        expect(step.confidence).toBe(original.confidence);
        expect(step.actions).toEqual(original.actions);
      }
      const trap = original.orientationTrap;
      if (trap) {
        const fields = { part: trap.part, mustFace: trap.mustFace, wrong: trap.wrong, hint: trap.hint, source: "manual" };
        expect(converted.trap).toEqual({ ...fields, autoplay: true });
        expect(stored.orientationTrap).toEqual(fields);
      } else {
        expect(converted.trap).toBeUndefined();
        expect(stored.orientationTrap).toBeUndefined();
      }
    }
    expect(scene.steps.slice(0, 15).every(step => step.kind === "assembly")).toBe(true);
    expect(scene.steps.slice(15).every(step => step.kind === "info" && step.actions.length === 0)).toBe(true);
  });

  it("stores build-frame fractions that snap back to the exact scene geometry", () => {
    expect(layout.parts.map(part => part.id)).toEqual(scene.parts.map(part => part.id));
    for (const part of scene.parts) {
      const fractional = layout.parts.find(p => p.id === part.id)!;
      if (part.sizeCm && part.homeCm) {
        for (let axis = 0; axis < 3; axis++) {
          expect(fractional.sizeFrac![axis]).toBeCloseTo(part.sizeCm[axis] / scene.buildSizeCm[axis], 4);
          expect(fractional.homeFrac![axis]).toBeCloseTo(part.homeCm[axis] / scene.buildSizeCm[axis], 4);
        }
      } else {
        expect(fractional.hardwareMm).toEqual(part.hardwareMm);
        expect(fractional.sizeFrac).toBeUndefined();
        expect(fractional.homeFrac).toBeUndefined();
      }
    }
    const snapped = snapLayout(layout, scene.buildSizeCm);
    expect(snapped.errors).toEqual([]);
    expect(snapped.ok).toBe(true);
    for (const part of scene.parts) {
      const result = snapped.parts.find(p => p.id === part.id)!;
      for (const field of ["sizeCm", "homeCm"] as const) {
        if (!part[field]) continue;
        expect(result[field]).toBeDefined();
        for (let axis = 0; axis < 3; axis++) expect(Math.abs(result[field]![axis] - part[field]![axis])).toBeLessThanOrEqual(0.5);
      }
    }
  });

  it("passes semantic checks in order and resolves every scene step without warnings", () => {
    expect(checkPartsLayout(layout)).toEqual([]);
    let placed: string[] = [];
    steps.forEach((step, index) => {
      expect(checkStep(step, layout.parts, placed), `step ${step.stepNumber}`).toEqual([]);
      placed = placedPartsAfterStep(step, layout.parts, placed);
      expect(resolveScene(scene, index).warnings).toEqual([]);
    });
    expect(checkCumulativeCounts(steps, layout.parts)).toEqual([]);
    const assembled = [...resolveScene(scene, 13).placed.values()];
    expect(assembled.filter(p => p.kind === "panel")).toHaveLength(11);
    expect(assembled.filter(p => p.partId === "dowel")).toHaveLength(22);
    expect(assembled.filter(p => p.partId === "screw")).toHaveLength(8);
  });

  it("indexes all 24 pages and selects the 19-step vertical branch first", () => {
    expect(saved.pages).toHaveLength(24);
    expect(saved.pages[0].pageType).toBe("cover");
    expect(saved.pages.some(page => page.pageType === "parts")).toBe(true);
    const all = saved.pages.flatMap(page => page.steps);
    expect(all).toHaveLength(24); // 19 vertical steps plus five horizontal alternatives
    const first = new Map<number, (typeof all)[number]>();
    for (const step of all) if (!first.has(step.stepNumber)) first.set(step.stepNumber, step);
    expect([...first.keys()]).toEqual(numbers);
    for (let n = 15; n <= 19; n++) {
      expect(first.get(n)?.variant).toBe("vertical");
      expect(all.filter(step => step.stepNumber === n).map(step => step.variant)).toEqual(["vertical", "horizontal"]);
    }
  });
});

describe("KALLAX public library assets", () => {
  it("publishes the gold unchanged and points the library index at an existing thumbnail", () => {
    expect(json("public/manuals/kallax/manual.json")).toEqual(saved);
    const index = LibraryIndex.parse(json("public/manuals/index.json"));
    const entries = index.filter(entry => entry.id === saved.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ id: saved.id, title: saved.title, stepCount: 19,
      thumbnail: "crops/step-01.jpg", createdAt: saved.createdAt });
    expect(readFileSync(new URL(`public/manuals/kallax/${entries[0].thumbnail}`, root)).length).toBeGreaterThan(0);
  });

  it("ships exactly the 19 JPEGs referenced by both fixture formats", () => {
    expect(readdirSync(new URL("public/manuals/kallax/crops/", root)).sort()).toEqual(numbers.map(cropName));
    saved.steps.forEach((entry, i) => {
      expect(entry.status).toBe("ok");
      if (entry.status !== "ok") throw new Error("Expected a successful gold step.");
      expect(entry.crop).toBe(`crops/${cropName(i + 1)}`);
      expect(scene.steps[i].crop).toBe(`/manuals/kallax/${entry.crop}`);
    });
  });

  it.each(numbers)("step %i is a decodable JPEG within the size limit", async n => {
    const bytes = readFileSync(new URL(`public/manuals/kallax/crops/${cropName(n)}`, root));
    const image = sharp(bytes);
    const metadata = await image.metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
    expect(Math.max(metadata.width!, metadata.height!)).toBeLessThanOrEqual(1600);
    const decoded = await image.raw().toBuffer();
    expect(decoded.length).toBeGreaterThan(0);
  });
});

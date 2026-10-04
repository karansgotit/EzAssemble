import { describe, expect, it } from "vitest";
import { fakeManual } from "@/fake-data/manual";
import { resolveFakeData } from "@/fake-data/toggle";

describe("resolveFakeData", () => {
  it("follows the env default when there is no override", () => {
    expect(resolveFakeData(true, null, true)).toBe(true);
    expect(resolveFakeData(false, null, true)).toBe(false);
  });

  it("lets the override win in either direction", () => {
    expect(resolveFakeData(false, "1", true)).toBe(true);
    expect(resolveFakeData(true, "0", true)).toBe(false);
  });

  it("ignores the override when it is not allowed (production)", () => {
    expect(resolveFakeData(false, "1", false)).toBe(false);
    expect(resolveFakeData(true, "0", false)).toBe(true);
  });

  it("ignores a junk override", () => {
    expect(resolveFakeData(true, "yes", true)).toBe(true);
    expect(resolveFakeData(false, "", true)).toBe(false);
  });
});

describe("fakeManual", () => {
  it("has one step of every kind the player handles", () => {
    expect(new Set(fakeManual.steps.map((s) => s.kind))).toEqual(new Set(["assembly", "info", "subassembly", "failed"]));
    expect(fakeManual.steps.some((s) => s.confidence === "low" && s.kind === "assembly")).toBe(true);
    expect(fakeManual.steps.some((s) => s.trap?.source === "manual")).toBe(true);
    expect(fakeManual.steps.some((s) => s.trap?.source === "geometry")).toBe(true);
  });

  it("only uses part ids that exist, and says it is fake", () => {
    const ids = new Set(fakeManual.parts.map((p) => p.id));
    for (const step of fakeManual.steps) {
      for (const action of step.actions) {
        if (action.part !== "assembly") expect(ids.has(action.part)).toBe(true);
      }
    }
    expect(fakeManual.title.toLowerCase()).toContain("fake");
  });
});

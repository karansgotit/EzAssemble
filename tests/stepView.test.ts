import { describe, expect, it } from "vitest";
import { clampStepIndex, hasAnimation, markerDescription, partsForStep, shouldAutoplayTrap, stepMarkers, trapButtonLabel } from "@/player/stepView";
import type { ScenePart, SceneStep, SceneTrap } from "@/schema";

const parts: ScenePart[] = [
  { id: "L1", label: "Long panel", kind: "panel", count: 1, shape: "box", features: [] },
  { id: "S1", label: "Shelf 1", kind: "panel", count: 1, shape: "box", features: [] },
  { id: "dowel", ikeaNumber: "101339", label: "Wooden dowel", kind: "dowel", count: 22, shape: "cylinder", features: [] },
];

function step(overrides: Partial<SceneStep> = {}): SceneStep {
  return { stepNumber: 3, kind: "assembly", instruction: "Tap 2 dowels in.", actions: [], confidence: "high", ...overrides };
}

const trap: SceneTrap = { part: "S1", mustFace: "front", wrong: "flipped-vertical", hint: "Holes face inward", source: "manual", autoplay: true };

describe("partsForStep", () => {
  it("lists each part once with its total count, in first-use order", () => {
    const items = partsForStep(
      parts,
      step({
        actions: [
          { verb: "insert", part: "dowel", count: 2, target: "L1", face: "front", for: "S1" },
          { verb: "place", part: "S1", count: 1, target: "L1", face: "front" },
          { verb: "insert", part: "dowel", count: 2, target: "S1", face: "top" },
        ],
      }),
    );
    expect(items).toEqual([
      { id: "dowel", label: "Wooden dowel", ikeaNumber: "101339", kind: "dowel", count: 4 },
      { id: "S1", label: "Shelf 1", ikeaNumber: undefined, kind: "panel", count: 1 },
    ]);
  });

  it("leaves out the whole-assembly flip", () => {
    expect(partsForStep(parts, step({ actions: [{ verb: "flip", part: "assembly", count: 1, flipMode: "stand-up" }] }))).toEqual([]);
  });

  it("keeps an unknown part id instead of throwing", () => {
    expect(partsForStep(parts, step({ actions: [{ verb: "place", part: "ghost_part", count: 1 }] }))).toEqual([
      { id: "ghost_part", label: "ghost_part", kind: "unknown", count: 1 },
    ]);
  });

  it("is empty for a step with no actions", () => {
    expect(partsForStep(parts, step({ kind: "info" }))).toEqual([]);
  });
});

describe("hasAnimation", () => {
  it("is true only for assembly steps", () => {
    expect(hasAnimation(step())).toBe(true);
    for (const kind of ["info", "subassembly", "failed"] as const) expect(hasAnimation(step({ kind }))).toBe(false);
  });
});

describe("shouldAutoplayTrap", () => {
  it("plays the first time an autoplay trap step opens", () => {
    expect(shouldAutoplayTrap(step({ trap }), new Set())).toBe(true);
  });

  it("does not play again once the step has been seen", () => {
    expect(shouldAutoplayTrap(step({ trap }), new Set([3]))).toBe(false);
  });

  it("does not play a trap that is not marked autoplay", () => {
    expect(shouldAutoplayTrap(step({ trap: { ...trap, source: "geometry", autoplay: false } }), new Set())).toBe(false);
  });

  it("does not play when there is no trap or no animation", () => {
    expect(shouldAutoplayTrap(step(), new Set())).toBe(false);
    expect(shouldAutoplayTrap(step({ kind: "failed", trap }), new Set())).toBe(false);
  });
});

describe("trapButtonLabel", () => {
  it("names the source honestly", () => {
    expect(trapButtonLabel(trap)).toBe("Show the mistake");
    expect(trapButtonLabel({ ...trap, source: "geometry" })).toBe("Show possible mistake");
  });

  it("gives no button without a trap", () => {
    expect(trapButtonLabel(undefined)).toBeNull();
  });
});

describe("clampStepIndex", () => {
  it("keeps the index inside the manual", () => {
    expect(clampStepIndex(-1, 6)).toBe(0);
    expect(clampStepIndex(9, 6)).toBe(5);
    expect(clampStepIndex(2, 6)).toBe(2);
    expect(clampStepIndex(0, 0)).toBe(0);
  });
});

describe("stepMarkers", () => {
  const markers = stepMarkers([
    step({ stepNumber: 1, trap }),
    step({ stepNumber: 2, confidence: "low" }),
    step({ stepNumber: 3, kind: "subassembly" }),
    step({ stepNumber: 8, kind: "failed", confidence: "low", trap }),
    step({ stepNumber: 16, kind: "info" }),
  ]);

  it("labels each marker with the manual's own step number", () => {
    expect(markers.map((m) => m.label)).toEqual(["1", "2", "3", "8", "16"]);
  });

  it("flags warnings and unsure steps only on animated steps", () => {
    expect(markers.map((m) => [m.warning, m.unsure])).toEqual([[true, false], [false, true], [false, false], [false, false], [false, false]]);
  });

  it("describes each marker in words", () => {
    expect(markers.map(markerDescription)).toEqual([
      "Step 1, has a warning",
      "Step 2, the AI was unsure",
      "Step 3, assembled separately",
      "Step 8, could not be read",
      "Step 16, information only",
    ]);
  });
});

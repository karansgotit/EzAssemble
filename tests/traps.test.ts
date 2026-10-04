import { describe, expect, it } from "vitest";
import { deriveTraps } from "@/scene/traps";
import type { SceneManual, SceneStep } from "@/scene/types";
import { loadKallaxScene } from "./helpers/kallaxScene";

const kallax = loadKallaxScene();
const edited = (edit: (m: SceneManual) => void): SceneStep[] => {
  const copy = structuredClone(kallax);
  edit(copy);
  return deriveTraps(copy.parts, copy.steps);
};
const derived = deriveTraps(kallax.parts, kallax.steps);
const trapOf = (steps: SceneStep[], stepNumber: number) => steps.find((s) => s.stepNumber === stepNumber)?.trap;

describe("deriveTraps on gold KALLAX", () => {
  it("keeps the warnings the manual itself draws (steps 1 and 13)", () => {
    expect(trapOf(derived, 1)).toEqual(kallax.steps[0].trap);
    expect(trapOf(derived, 1)).toMatchObject({ part: "L1", source: "manual", autoplay: true });
    expect(trapOf(derived, 13)).toMatchObject({ part: "L2", source: "manual", autoplay: true });
  });

  it("warns about the first shelf, and plays it automatically", () => {
    expect(trapOf(derived, 3)).toEqual({
      part: "S1",
      mustFace: "right",
      wrong: "flipped-horizontal",
      hint: "Drilled holes face the divider piece",
      source: "geometry",
      autoplay: true,
    });
  });

  it("offers the same warning on later shelves without playing it", () => {
    expect(trapOf(derived, 6)).toMatchObject({ part: "S2", source: "geometry", autoplay: false });
    expect(trapOf(derived, 9)).toMatchObject({ part: "S3", source: "geometry", autoplay: false });
  });

  it("gives no trap to dowel-only steps, hole-less dividers, the flip or info steps", () => {
    for (const stepNumber of [2, 4, 5, 7, 8, 10, 11, 12, 15, 16, 17, 18, 19]) {
      expect(trapOf(derived, stepNumber), `step ${stepNumber}`).toBeUndefined();
    }
  });

  it("warns about E2's hole side when it is swung on in step 14", () => {
    expect(trapOf(derived, 14)).toMatchObject({ part: "E2", mustFace: "left", source: "geometry", autoplay: false });
  });

  it("does not change its input", () => {
    const before = structuredClone(kallax.steps);
    deriveTraps(kallax.parts, kallax.steps);
    expect(kallax.steps).toEqual(before);
  });
});

const shelf1 = (m: SceneManual) => m.parts.find((p) => p.id === "S1")!;

describe("deriveTraps needs evidence", () => {
  it("gives none to a panel with holes on two faces", () => {
    const steps = edited((m) => { shelf1(m).features = [{ type: "holes", face: "right" }, { type: "holes", face: "left" }]; });
    expect(trapOf(steps, 3)).toBeUndefined();
    expect(trapOf(steps, 6)).toMatchObject({ part: "S2", autoplay: false }); // still not the first shelf
  });

  it("gives none when nothing ever goes into or against the holed face", () => {
    expect(trapOf(edited((m) => { shelf1(m).features = [{ type: "holes", face: "left" }]; }), 3)).toBeUndefined();
  });

  it("gives none to a cylinder or a part with no geometry", () => {
    expect(trapOf(edited((m) => { shelf1(m).shape = "cylinder"; }), 3)).toBeUndefined();
    const steps = edited((m) => { delete m.parts.find((p) => p.id === "L2")!.homeCm; delete m.steps[12].trap; });
    expect(trapOf(steps, 13)).toBeUndefined();
  });
});

describe("deriveTraps from the panel a part is placed against", () => {
  it("warns when the holes must face the target, if the manual drew no warning of its own", () => {
    const steps = edited((m) => { delete m.steps[0].trap; delete m.steps[12].trap; });
    // Step 1: the end panel's holes face the long panel it is screwed onto.
    expect(trapOf(steps, 1)).toEqual({
      part: "E1", mustFace: "right", wrong: "flipped-horizontal", hint: "Drilled holes face the long side panel", source: "geometry", autoplay: true,
    });
    // Step 13: the second long panel's holes face down onto the shelves.
    expect(trapOf(steps, 13)).toMatchObject({ part: "L2", mustFace: "back", hint: "Drilled holes face the shelf", autoplay: true });
  });

  it("turns top or bottom holes over, and side holes around", () => {
    const steps = edited((m) => {
      // Lay shelf 1 flat on the floor of a made-up build: holes on top, a divider standing on it.
      Object.assign(shelf1(m), { sizeCm: [69.4, 1.6, 39], homeCm: [38.5, 0.8, 19.5], features: [{ type: "holes", face: "top" }] });
      m.steps[3].actions[0].face = "top";
    });
    expect(trapOf(steps, 3)).toMatchObject({ mustFace: "top", wrong: "flipped-vertical" });
  });
});

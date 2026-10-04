import { describe, expect, it } from "vitest";
import { FAILED_STEP_TEXT, buildSceneManual, toBuildSize } from "@/scene/buildSceneManual";
import { resolveScene } from "@/scene/resolveScene";
import { SceneManual, type SavedManual } from "@/schema";
import { saved, scene } from "./helpers/schemaFixtures";

const CROP_BASE = "/manuals/kallax/";
const edited = (edit: (m: SavedManual) => void): SavedManual => {
  const copy = structuredClone(saved);
  edit(copy);
  return copy;
};

describe("buildSceneManual on gold KALLAX", () => {
  const { manual, layoutErrors } = buildSceneManual(saved, CROP_BASE);

  it("reproduces the hand-made scene geometry within 0.5 cm", () => {
    expect(layoutErrors).toEqual([]);
    expect(manual.parts.map((p) => p.id)).toEqual(scene.parts.map((p) => p.id));
    for (const reference of scene.parts) {
      const part = manual.parts.find((p) => p.id === reference.id);
      for (const key of ["sizeCm", "homeCm"] as const) {
        expect(part?.[key] === undefined, `${reference.id}.${key}`).toBe(reference[key] === undefined);
        reference[key]?.forEach((cm, i) => expect(Math.abs((part?.[key]?.[i] ?? NaN) - cm)).toBeLessThanOrEqual(0.5));
      }
      expect(part?.hardwareMm).toEqual(reference.hardwareMm);
      expect(part?.features).toEqual(reference.features);
    }
  });

  it("produces the same header and steps as the scene fixture", () => {
    expect(manual.buildSizeCm).toEqual([147, 39, 77]);
    expect(manual.buildOrientation).toBe("on-back");
    expect(manual.id).toBe(scene.id);
    // The fixture holds only what the manual says; the "possible mistake" traps are added here.
    const withoutDerived = manual.steps.map(({ trap, ...step }) => (trap?.source === "geometry" ? step : { ...step, ...(trap && { trap }) }));
    expect(withoutDerived).toEqual(scene.steps);
  });

  it("is a valid SceneManual that plays every step with no skipped action", () => {
    expect(SceneManual.safeParse(manual).success).toBe(true);
    const end = resolveScene(manual, manual.steps.length - 1);
    expect(end.warnings).toEqual([]);
    expect(end.placed.size).toBe(41);
  });

  it("keeps the manual's own warnings and plays them automatically", () => {
    expect(manual.steps[0].trap).toEqual({
      part: "L1", mustFace: "front", wrong: "flipped-horizontal", hint: "Drilled holes face inward", source: "manual", autoplay: true,
    });
    expect(manual.steps[1].trap).toBeUndefined();
  });

  it("adds the possible mistakes the geometry proves (AJI-05)", () => {
    expect(manual.steps[2].trap).toMatchObject({ part: "S1", source: "geometry", autoplay: true });
    expect(manual.steps[5].trap).toMatchObject({ part: "S2", source: "geometry", autoplay: false });
  });

  it("builds crop URLs whether or not the base ends with a slash", () => {
    expect(manual.steps[0].crop).toBe("/manuals/kallax/crops/step-01.jpg");
    expect(buildSceneManual(saved, "/manuals/kallax").manual.steps[0].crop).toBe("/manuals/kallax/crops/step-01.jpg");
  });
});

describe("buildSceneManual on other saved steps and bad data", () => {
  it("turns a failed step into a diagram-only step", () => {
    const { manual } = buildSceneManual(
      edited((m) => { m.steps[4] = { status: "failed", stepNumber: 5, crop: "crops/step-05.jpg", errors: ["bad"], attempts: 3 }; }),
      CROP_BASE,
    );
    expect(manual.steps[4]).toEqual({
      stepNumber: 5, kind: "failed", instruction: FAILED_STEP_TEXT, actions: [], confidence: "low", crop: "/manuals/kallax/crops/step-05.jpg",
    });
    expect(() => resolveScene(manual, 18)).not.toThrow();
  });

  it("turns a sub-assembly step into a message card with no diagram", () => {
    const message = "The 2 drawers are assembled separately (manual steps 20–31). Follow the manual for those, then continue here.";
    const { manual } = buildSceneManual(
      edited((m) => { m.steps[18] = { status: "subassembly", stepNumber: 19, sourceSteps: [19, 20], label: "drawer", message }; }),
      CROP_BASE,
    );
    expect(manual.steps[18]).toEqual({ stepNumber: 19, kind: "subassembly", instruction: message, actions: [], confidence: "high" });
  });

  it("reports a broken layout and marks the assembly steps low confidence", () => {
    const { manual, layoutErrors } = buildSceneManual(
      edited((m) => { m.layout.parts[5].homeFrac = m.layout.parts[4].homeFrac; }), // shelf 2 on top of shelf 1
      CROP_BASE,
    );
    expect(layoutErrors).toContain("S1 overlaps S2 by 1.6 cm");
    expect(manual.steps[2].confidence).toBe("low");
    expect(manual.steps[15]).toEqual(scene.steps[15]); // info steps are untouched
  });

  it("never throws, even on something that is not a saved manual", () => {
    const { manual, layoutErrors } = buildSceneManual({ id: "x" } as unknown as SavedManual, CROP_BASE);
    expect(manual.steps).toEqual([]);
    expect(layoutErrors[0]).toContain("could not be turned into a scene");
  });
});

describe("toBuildSize (CONTRACTS §4.1)", () => {
  it("maps the upright product size into each build frame", () => {
    expect(toBuildSize([77, 147, 39], "on-back")).toEqual([147, 39, 77]);
    expect(toBuildSize([77, 147, 39], "on-side")).toEqual([147, 77, 39]);
    expect(toBuildSize([55, 45, 55], "upright")).toEqual([55, 45, 55]);
    expect(toBuildSize([55, 45, 55], "upside-down")).toEqual([55, 45, 55]);
  });
});

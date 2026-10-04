import { describe, expect, it } from "vitest";
import { checkCumulativeCounts, checkPartsLayout, checkStep, placedPartsAfterStep, type PartsLayout, type Step } from "@/schema";
import { resolveScene } from "@/scene/resolveScene";
import { layout, scene, steps } from "./helpers/schemaFixtures";

describe("KALLAX foundations across validation and rendering", () => {
  it("accepts every gold step with the same placed-part state as the renderer", () => {
    expect(checkPartsLayout(layout)).toEqual([]);
    let placed: string[] = [];
    steps.forEach((step, index) => {
      expect(checkStep(step, layout.parts, placed)).toEqual([]);
      placed = placedPartsAfterStep(step, layout.parts, placed);
      const resolved = resolveScene(scene, index);
      const solids = [...new Set([...resolved.placed.values()].filter(p => p.kind === "panel").map(p => p.partId))];
      expect([...placed].sort()).toEqual(solids.sort());
    });
    expect(checkCumulativeCounts(steps, layout.parts)).toEqual([]);
  });
  it("introduces E1 and L1 in step 1 and does not duplicate an explicitly attached foundation", () => {
    expect(placedPartsAfterStep(steps[0], layout.parts)).toEqual(["E1", "L1", "E2"]);
    const state = resolveScene(scene, 0);
    expect([...state.placed.values()].filter(p => p.partId === "E1")).toHaveLength(1);
    expect(state.warnings).toEqual([]);
  });
  it("does not advance placement for failed, info or subassembly steps", () => {
    for (const kind of ["failed", "info", "subassembly"]) {
      expect(placedPartsAfterStep({ ...steps[0], kind }, layout.parts, ["L1"])).toEqual(["L1"]);
    }
  });
});

describe("parts semantics", () => {
  const cases: [string, (m: PartsLayout) => void][] = [
    ["duplicate id", m => { m.parts[1].id = m.parts[0].id; }],
    ["reserved", m => { m.parts[0].id = "assembly"; }],
    ["hardware needs", m => { delete m.parts.find(p => p.id === "dowel")!.hardwareMm; }],
    ["no layout fractions", m => { m.parts.find(p => p.id === "dowel")!.homeFrac = [.5, .5, .5]; }],
    ["count 1", m => { m.parts[0].count = 2; }],
    ["must not have hardwareMm", m => { m.parts[0].hardwareMm = { length: 20, diameter: 5 }; }],
    ["needs sizeFrac", m => { delete m.parts[0].sizeFrac; }],
    ["sizeFrac values", m => { m.parts[0].sizeFrac = [0, 1, 2]; }],
    ["homeFrac values", m => { m.parts[0].homeFrac = [1, .5, .5]; }],
  ];
  it.each(cases)("rejects %s", (message, edit) => {
    const copy = structuredClone(layout); edit(copy);
    expect(checkPartsLayout(copy).join(" ")).toContain(message);
  });
});

describe("step semantics", () => {
  const cases: [string, (s: Step) => void][] = [
    ["at least one action", s => { s.actions = []; }],
    ["requires no actions", s => { s.kind = "info"; }],
    ["not a known part id", s => { s.actions[0].part = "missing"; }],
    ["not a known part id", s => { s.actions[0].target = "missing"; }],
    ["not a known part id", s => { s.actions[0].for = "missing"; }],
    ["needs hardware", s => { s.actions[0].part = "E1"; }],
    ["needs a non-hardware", s => { s.actions[1].part = "dowel"; }],
    ["target and a face", s => { delete s.actions[0].face; }],
    ["one distinct piece", s => { s.actions[1].count = 2; }],
    ["cannot target itself", s => { s.actions[1].target = "E1"; }],
    ["refer to non-hardware", s => { s.actions[0].target = "dowel"; }],
    ["fields do not apply", s => { s.actions[1].flipMode = "stand-up"; }],
    ["flip must use", s => { s.actions = [{ verb: "flip", part: "E1", count: 1 }]; delete s.orientationTrap; }],
    ["does not appear", s => { s.orientationTrap!.part = "S3"; }],
    ["not a known part id", s => { s.orientationTrap!.part = "missing"; }],
  ];
  it.each(cases)("rejects %s", (message, edit) => {
    const copy = structuredClone(steps[0]); edit(copy);
    expect(checkStep(copy, layout.parts, []).join(" ")).toContain(message);
  });
  it("allows a standalone foundation placement, info steps and whole-assembly flips", () => {
    const foundation: Step = { ...steps[0], actions: [{ verb: "place", part: "L1", count: 1 }], orientationTrap: undefined };
    expect(checkStep(foundation, layout.parts, [])).toEqual([]);
    expect(checkStep(steps[14], layout.parts, [])).toEqual([]);
    expect(checkStep(steps[15], layout.parts, [])).toEqual([]);
  });
  it("only introduces foundations in the opening step, so a mixed-up panel is caught later", () => {
    // Step 7 with L2 (placed at step 13) mistaken for L1: must fail so Gemini retries.
    const placedBeforeStep7 = ["E1", "L1", "E2", "D1", "S1", "D2", "S2"];
    const mixedUp: Step = { ...steps[6], orientationTrap: undefined, actions: [
      { verb: "insert", part: "dowel", count: 2, target: "L2", face: "front", for: "S3" },
      { verb: "place", part: "S3", count: 1, target: "L2", face: "front" },
    ] };
    expect(checkStep(mixedUp, layout.parts, placedBeforeStep7).join(" ")).toContain('target "L2" has not been placed yet');
    expect(checkStep(mixedUp, layout.parts, [...placedBeforeStep7, "L2"])).toEqual([]);
  });
  it("requires lock targets to be present rather than inventing a foundation", () => {
    const lock: Step = { ...steps[1], actions: [{ verb: "lock", part: "dowel", count: 2, target: "E1", face: "right" }] };
    expect(checkStep(lock, layout.parts, []).join(" ")).toContain("has not been placed");
    expect(checkStep(lock, layout.parts, ["E1"])).toEqual([]);
  });
});

describe("physical inventory", () => {
  it("does not count locks as extra hardware, but requires prior insertion", () => {
    const insert = steps[1];
    const lock: Step = { ...insert, actions: [{ ...insert.actions[0], verb: "lock" }] };
    expect(checkCumulativeCounts([insert, lock], layout.parts)).toEqual([]);
    expect(checkCumulativeCounts([lock], layout.parts)[0].message).toContain("before locking");
  });
  it("reports excess hardware on the step that exceeds inventory", () => {
    const copy = structuredClone(steps);
    copy[1].actions[0].count = 23;
    expect(checkCumulativeCounts(copy, layout.parts)[0]).toEqual({ stepNumber: 2, message: "dowel: 23 instances used, but only 22 available" });
  });
});

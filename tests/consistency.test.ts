import { describe, expect, it } from "vitest";
import { buildSceneManual } from "@/scene/buildSceneManual";
import { checkConsistency } from "@/scene/consistency";
import type { SceneManual } from "@/scene/types";
import { loadKallaxScene } from "./helpers/kallaxScene";
import { saved } from "./helpers/schemaFixtures";

const gold = loadKallaxScene();
const edited = (edit: (m: SceneManual) => void): SceneManual => {
  const copy = structuredClone(gold);
  edit(copy);
  return copy;
};
const part = (m: SceneManual, id: string) => m.parts.find((p) => p.id === id)!;

describe("checkConsistency", () => {
  it("finds no problems in gold KALLAX, as a fixture or built from the saved manual", () => {
    expect(checkConsistency(gold)).toEqual([]);
    expect(checkConsistency(buildSceneManual(saved, "/manuals/kallax/").manual)).toEqual([]);
  });

  it("reports the step whose shelf was moved 5 cm away from the panel it joins", () => {
    const manual = edited((m) => { part(m, "S2").homeCm![2] += 5; });
    expect(checkConsistency(manual)).toEqual([{ stepNumber: 6, problem: "S2 does not touch L1: they are 5 cm apart" }]);
  });

  it("allows a gap of up to 0.5 cm", () => {
    expect(checkConsistency(edited((m) => { part(m, "S2").homeCm![2] += 0.5; }))).toEqual([]);
    expect(checkConsistency(edited((m) => { part(m, "S2").homeCm![2] += 0.6; }))).toHaveLength(1);
  });

  it("reports the last long panel floating above the shelves it is lowered onto", () => {
    const problems = checkConsistency(edited((m) => { part(m, "L2").homeCm![2] += 10; }));
    expect(problems).toEqual([{ stepNumber: 13, problem: "L2 does not touch S2: they are 10 cm apart" }]);
  });

  it("reports a step that names the wrong target", () => {
    const manual = edited((m) => { m.steps[4].actions[0].target = "E2"; }); // D2 is nowhere near E2
    const [problem] = checkConsistency(manual);
    expect(problem.stepNumber).toBe(5);
    expect(problem.problem).toMatch(/^D2 does not touch E2: they are [\d.]+ cm apart$/);
  });

  it("does not count parts that only meet along an edge", () => {
    // L2 spans x 3.8–143.2 and z 73.2–77. This divider sits just outside its corner: flush
    // with it in both x and z, so the two share one edge and no face.
    const manual = edited((m) => {
      part(m, "D1").sizeCm = [10, 39, 1.6];
      part(m, "D1").homeCm = [-1.2, 19.5, 77.8];
      m.steps[1].actions[1].target = "L2";
    });
    expect(checkConsistency(manual)).toEqual([{ stepNumber: 2, problem: "D1 does not touch L2: they only meet at an edge" }]);
  });

  it("ignores hardware, flips, and steps with nothing to animate", () => {
    const manual = edited((m) => {
      part(m, "S2").homeCm![2] += 5;
      m.steps[5].kind = "failed";
    });
    expect(checkConsistency(manual)).toEqual([]);
  });

  it("never throws, and leaves unknown ids and missing geometry to the scene's own warnings", () => {
    const manual = edited((m) => {
      m.steps[2].actions[1].target = "nope";
      delete part(m, "D2").homeCm;
      m.steps[7].actions = null as never;
    });
    expect(checkConsistency(manual)).toEqual([]);
    for (const junk of [null, {}, { parts: "x", steps: 3 }, { parts: [null], steps: [null] }]) {
      expect(checkConsistency(junk as never)).toEqual([]);
    }
  });
});

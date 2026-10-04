import { describe, expect, it } from "vitest";
import { scoreActions, scoreStep } from "@/pipeline/eval/reviewScoring";
import { nativeStepSchema } from "@/pipeline/eval/nativeStepSchema";
import type { Action, Step } from "@/schema";

const a: Action = { verb: "insert", part: "dowel", target: "S1", face: "front", for: "L2", count: 2 };
const b: Action = { ...a, target: "S2" };
describe("review scoring", () => {
  it("matches repeated hardware actions one-to-one, regardless of order", () => {
    expect(scoreActions([a, b], [b, a])).toMatchObject({ correct: 12, total: 12, exact: 2 });
  });
  it("does not reuse a prediction to reward missing actions", () => {
    expect(scoreActions([a, b], [a])).toMatchObject({ correct: 6, total: 12, exact: 1 });
  });
  it("penalizes hallucinated extra actions", () => {
    expect(scoreActions([a], [a, b])).toMatchObject({ correct: 6, total: 12, predicted: 2 });
  });
  it("scores failures as zero rather than skipping them", () => {
    expect(scoreActions([a, b], [])).toMatchObject({ correct: 0, total: 12 });
  });
  it("does not grant active-field credit for absent optional fields", () => {
    const flip: Action = { verb: "flip", part: "assembly", count: 1, flipMode: "stand-up" };
    expect(scoreActions([flip], [flip])).toMatchObject({ activeCorrect: 3, activeTotal: 3 });
    expect(scoreActions([flip], [{ ...flip, flipMode: "turn-over" }]).exact).toBe(0);
  });
  it("checks info kind and traps even when there are no actions", () => {
    const info: Step = { stepNumber: 16, kind: "info", actions: [], instruction: "Fix to the wall.", confidence: "high" };
    expect(scoreStep(info, info).exactStep).toBe(true);
    expect(scoreStep(info).exactStep).toBe(false);
    expect(scoreStep(info, { ...info, orientationTrap: { part: "S1", mustFace: "front", wrong: "flipped-horizontal", source: "manual", hint: "Bad" } }).exactStep).toBe(false);
  });
  it("breaks assignment ties using complete action equality", () => {
    const one: Action = { verb: "flip", part: "assembly", count: 1, flipMode: "stand-up" };
    const two: Action = { ...one, flipMode: "turn-over" };
    expect(scoreActions([one, two], [two, one]).exact).toBe(2);
  });
  it("keeps optional fields optional in the diagnostic native-schema ablation", () => {
    expect(nativeStepSchema()).toMatchObject({
      required: ["stepNumber", "kind", "instruction", "actions", "confidence"],
      properties: { actions: { items: { required: ["verb", "part", "count"],
        properties: { face: { type: "string", enum: ["top", "bottom", "left", "right", "front", "back"] } } } } },
    });
  });
});

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeReport, type StepRecord } from "@/pipeline/eval/report";
import { scoreStep } from "@/pipeline/eval/reviewScoring";
import { steps } from "./helpers/schemaFixtures";

function record(ai: typeof steps[number] | undefined): StepRecord {
  const gold = steps[2]; // step 3: dowels into L1 for S1, then place S1
  return { stepNumber: 3, cropFile: "public/manuals/kallax/crops/step-03.jpg", gold, ai, ok: Boolean(ai), attempts: 1,
    ms: 4200, usage: [], errors: ai ? [] : ["action 1: hardware needs a target and a face"], score: scoreStep(gold, ai) };
}

const render = (r: StepRecord) => {
  const file = join(mkdtempSync(join(tmpdir(), "eval-")), "kallax.html");
  writeReport(file, "KALLAX", [r]);
  return readFileSync(file, "utf8");
};

describe("eval report", () => {
  it("shows a correct step without red marks", () => {
    const html = render(record(steps[2]));
    expect(html).toContain("data:image/jpeg;base64,");
    expect(html).not.toContain('class="bad"');
  });

  it("marks only the mismatching fields red: the wrong panel D1 instead of L1", () => {
    const wrong = { ...steps[2], actions: steps[2].actions.map(a => ({ ...a, target: "D1" })) };
    const html = render(record(wrong));
    expect(html).toContain('<span class="bad">D1</span>');
    expect(html).toContain('<span class="bad">L1</span>');
    expect(html).not.toContain('<span class="bad">insert</span>');
  });

  it("shows a failed step with its errors", () => {
    expect(render(record(undefined))).toContain("failed: action 1: hardware needs a target and a face");
  });
});

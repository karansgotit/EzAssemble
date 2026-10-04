// KAR-08 check: all 19 KALLAX steps through analyzeStep (the route's code path; real AI calls, roughly 10 cents).
// Gold context: each step gets gold's placed parts and previous instructions, as the browser would after correct steps.
// Reports ok/attempts/latency per step, field agreement, info steps and manual traps (steps 1 and 13).
// Run from the repo root: npx tsx --conditions=react-server --env-file=.env.local pipeline/scripts/analyzeKallax.ts

import "server-only";

import { readFileSync } from "node:fs";
import { SavedManual, placedPartsAfterStep } from "@/schema";
import { ANALYZE_STEP_MODEL, MODELS, PRICES } from "../config";
import { analyzeStep } from "../analyzeStep";
import { scoreStep } from "../eval/reviewScoring";

const gold = SavedManual.parse(JSON.parse(readFileSync("fixtures/kallax.gold.json", "utf8")));
const goldSteps = gold.steps.flatMap(entry => (entry.status === "ok" ? [entry.step] : []));
const parts = gold.layout.parts;

async function main() {
  const model = MODELS[ANALYZE_STEP_MODEL];
  const rows: string[] = [];
  let okCount = 0, correct = 0, total = 0, inputTokens = 0, outputTokens = 0, slowest = 0;

  for (const expected of goldSteps) {
    const { stepNumber } = expected;
    const before = goldSteps.filter(step => step.stepNumber < stepNumber);
    const placedPartIds = before.reduce<string[]>((placed, step) => placedPartsAfterStep(step, parts, placed), []);
    const started = Date.now();
    const result = await analyzeStep({
      parts, placedPartIds, previousInstructions: before.map(step => step.instruction), stepNumber,
      image: readFileSync(`public/manuals/kallax/crops/step-${String(stepNumber).padStart(2, "0")}.jpg`).toString("base64"),
    }, { onRejected: (_, errors) => console.log(`  rejected step ${stepNumber}: ${errors.join("; ")}`) });
    const seconds = (Date.now() - started) / 1000;
    slowest = Math.max(slowest, seconds);
    for (const use of result.usage) { inputTokens += use.inputTokens; outputTokens += use.outputTokens; }

    const score = scoreStep(expected, result.ok ? result.data : undefined);
    correct += score.correct;
    total += score.total;
    if (result.ok) okCount++;
    const got = result.ok ? result.data : undefined;
    const trap = got?.orientationTrap ? `${got.orientationTrap.part} ${got.orientationTrap.mustFace}` : "-";
    const goldTrap = expected.orientationTrap ? `${expected.orientationTrap.part} ${expected.orientationTrap.mustFace}` : "-";
    rows.push(`| ${stepNumber} | ${result.ok ? "ok" : "failed"} | ${result.attempts} | ${seconds.toFixed(1)} s | ${expected.kind} → ${got?.kind ?? "?"} | `
      + `${score.total ? `${score.correct}/${score.total}` : "n/a"} | ${goldTrap} → ${trap} |`);
    if (!result.ok) console.log(`step ${stepNumber} failed:`, result.errors);
  }

  const price = PRICES[model];
  console.log(`\n${model}, gold context\n\n| Step | Result | Tries | Time | Kind (gold → AI) | Fields | Trap (gold → AI) |\n|---|---|---|---|---|---|---|`);
  for (const row of rows) console.log(row);
  console.log(`\nok: ${okCount}/19 · field agreement ${Math.round((correct / Math.max(total, 1)) * 100)}% · slowest step ${slowest.toFixed(1)} s · `
    + `$${((inputTokens * price.input + outputTokens * price.output) / 1e6).toFixed(3)}`);
}

main().catch(error => {
  console.error(`Analyze run failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}`);
  process.exitCode = 1;
});

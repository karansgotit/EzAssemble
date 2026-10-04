// KAR-04 spike: can Gemini fill our step form? Sends KALLAX steps 2–5 to both models and marks each field against gold.
// Real, billed AI calls: 4 steps × 2 models, up to 3 tries each. Cost depends on token usage.
// Run from the repo root: npx tsx --conditions=react-server --env-file=.env.local pipeline/scripts/spike.ts

import "server-only";

import { readFileSync } from "node:fs";
import { SavedManual, placedPartsAfterStep } from "@/schema";
import { MODELS, PRICES, type ModelTier } from "../config";
import { analyzeStep } from "../analyzeStep";
import { FIELDS, scoreStep } from "../eval/reviewScoring";

const STEPS = [2, 3, 4, 5];

const gold = SavedManual.parse(JSON.parse(readFileSync("fixtures/kallax.gold.json", "utf8")));
const goldSteps = gold.steps.flatMap(entry => (entry.status === "ok" ? [entry.step] : []));
const parts = gold.layout.parts;

async function runModel(tier: ModelTier): Promise<string[]> {
  const model = MODELS[tier];
  const rows: string[] = [];
  let correct = 0, total = 0, ms = 0, inputTokens = 0, outputTokens = 0;

  for (const stepNumber of STEPS) {
    const before = goldSteps.filter(step => step.stepNumber < stepNumber);
    const placedPartIds = before.reduce<string[]>((placed, step) => placedPartsAfterStep(step, parts, placed), []);
    const expected = goldSteps.find(step => step.stepNumber === stepNumber)!;
    const result = await analyzeStep({
      parts, placedPartIds, previousInstructions: before.map(step => step.instruction), stepNumber,
      image: readFileSync(`public/manuals/kallax/crops/step-${String(stepNumber).padStart(2, "0")}.jpg`).toString("base64"),
    }, {
      model: tier,
      onRejected: (answer, errors) => console.log(`  rejected step ${stepNumber}: ${answer}\n  because: ${errors.join("; ")}`),
    });

    for (const use of result.usage) { ms += use.ms; inputTokens += use.inputTokens; outputTokens += use.outputTokens; }
    const score = scoreStep(expected, result.ok ? result.data : undefined);
    const cells = FIELDS.map(field => `${score.fields[field]}/${Math.max(score.expected, score.predicted)}`);
    correct += score.correct;
    total += score.total;
    rows.push(`| ${stepNumber} | ${model} | ${cells.join(" | ")} | ${result.attempts} | ${result.ok ? `ok; exact=${score.exactStep}` : "failed"} |`);
    if (result.ok) console.log(`step ${stepNumber} (${tier}):`, JSON.stringify(result.data.actions));
    else console.log(`step ${stepNumber} (${tier}) failed:`, result.errors);
  }

  const price = PRICES[model];
  const cost = price ? (inputTokens * price.input + outputTokens * price.output) / 1_000_000 : NaN;
  rows.push(`| **all** | ${model} | **${Math.round((correct / total) * 100)}% of fields** | | | | | | ${(ms / 1000).toFixed(1)} s | $${cost.toFixed(4)} |`);
  return rows;
}

async function main() {
  console.log("Gold-context perception test, not end-to-end accuracy. Disputed fixture labels remain unchanged.");
  const rows = [...(await runModel("fast")), ...(await runModel("strong"))];
  console.log(`\n| Step | Model | ${FIELDS.join(" | ")} | Tries | Result |`);
  console.log(`|---|---|${FIELDS.map(() => "---").join("|")}|---|---|`);
  for (const row of rows) console.log(row);
}

main().catch(error => {
  console.error(`Spike failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}`);
  process.exitCode = 1;
});

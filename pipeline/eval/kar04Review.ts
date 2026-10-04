import "server-only";
// Paid, opt-in diagnostic. Does not change production prompts, fixtures or model defaults.
// tsx --conditions=react-server --env-file=.env.local pipeline/eval/kar04Review.ts RUN VARIANT STEPS TIERS THINKING REPEATS
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { ThinkingLevel } from "@google/genai";
import { SavedManual, Step, checkStep, placedPartsAfterStep, type Step as StepType } from "@/schema";
import { MODELS, type ModelTier } from "../config";
import { callStructured, type Generate } from "../gemini";
import { getVertexClient } from "../vertex";
import { loadPrompt } from "../prompts";
import { scoreStep } from "./reviewScoring";
import { nativeStepSchema } from "./nativeStepSchema";

const [run = "baseline", variant = "baseline", selection = "all", tiersArg = "fast,strong", thinkingArg = "LOW", repeatsArg = "1", temperatureArg = "0"] = process.argv.slice(2);
if (!/^[\w-]+$/.test(run)) throw new Error("Invalid run name");
if (!["baseline", "layout", "previous", "fewshot", "rollout", "native"].includes(variant)) throw new Error("Invalid variant");
const tiers = tiersArg.split(",") as ModelTier[];
if (tiers.some(t => !["fast", "strong"].includes(t))) throw new Error("Invalid tier");
const thinking = ThinkingLevel[thinkingArg as keyof typeof ThinkingLevel];
if (![ThinkingLevel.LOW, ThinkingLevel.MEDIUM, ThinkingLevel.HIGH].includes(thinking)) throw new Error("Invalid thinking level");
const repeats = Number(repeatsArg);
const temperature = Number(temperatureArg);
if (![0, 1].includes(temperature)) throw new Error("Invalid diagnostic temperature");
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 5) throw new Error("Invalid repeats");
const out = "eval/out/kar04-review";
mkdirSync(out, { recursive: true });
const ledgerPath = `${out}/ledger.jsonl`;
type LedgerEntry = { id: string; reserved: number; settled?: number; outputAllowance?: number };
const ledger: LedgerEntry[] = existsSync(ledgerPath) ? readFileSync(ledgerPath, "utf8").trim().split("\n").filter(Boolean).map(s => JSON.parse(s)) : [];
const charges = new Map(ledger.map(e => [e.id, e.settled ?? e.reserved]));
const spent = () => [...charges.values()].reduce((a, b) => a + b, 0);
function recordCharge(entry: LedgerEntry) {
  charges.set(entry.id, entry.settled ?? entry.reserved);
  appendFileSync(ledgerPath, JSON.stringify(entry) + "\n");
}
// Conservative standard rates: do not count Flash promotional credits or cache discounts.
const prices = { fast: { input: 1.5, output: 7.5 }, strong: { input: 2, output: 12 } };
// Google documents non-200 HTTP responses as unbilled. Reconcile only recorded, numeric error statuses.
const knownUnbilled = new Set<string>();
for (const filename of readdirSync(out).filter(f => /-r\d+-s\d+\.json$/.test(f))) {
  const row = JSON.parse(readFileSync(`${out}/${filename}`, "utf8"));
  row.attempts.forEach((attempt: { httpStatus?: number }, i: number) => {
    if (attempt.httpStatus && attempt.httpStatus >= 400 && attempt.httpStatus <= 599) {
      const prefix = `${row.run}-${row.tier}-${row.repeat}-${row.stepNumber}-${i}-`;
      for (const entry of ledger) if (entry.id.startsWith(prefix)) knownUnbilled.add(entry.id);
    }
  });
}
// For unknown/aborted requests, reserve the full model output limit, not just the requested cap.
// This is intentionally much more pessimistic than the observed usage.
for (const entry of new Map(ledger.map(e => [e.id, e])).values()) {
  if (entry.settled === undefined && knownUnbilled.has(entry.id)) {
    recordCharge({ ...entry, settled: 0 });
    continue;
  }
  if (entry.settled === undefined && entry.outputAllowance !== 65536) {
    const outputPrice = entry.id.includes("-strong-") ? prices.strong.output : prices.fast.output;
    recordCharge({ ...entry, reserved: entry.reserved + (65536 - (entry.outputAllowance ?? 8192)) * outputPrice / 1e6, outputAllowance: 65536 });
  }
}
const budget = 9; // $1 buffer within the user's $10 ceiling.
class ReviewBudgetError extends Error {}
const gold = SavedManual.parse(JSON.parse(readFileSync("fixtures/kallax.gold.json", "utf8")));
const goldSteps = gold.steps.flatMap(s => s.status === "ok" ? [s.step] : []);
const steps = selection === "all" ? goldSteps.map(s => s.stepNumber) : selection.split(",").map(Number);
if (steps.some(s => !goldSteps.some(g => g.stepNumber === s))) throw new Error("Invalid step selection");
const parts = gold.layout.parts;
const crop = (n: number) => readFileSync(`public/manuals/kallax/crops/step-${String(n).padStart(2, "0")}.jpg`).toString("base64");
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
const jobs = tiers.flatMap(tier => Array.from({ length: repeats }, (_, repeat) => ({ tier, repeat })));

async function runSeries({ tier, repeat }: (typeof jobs)[number]) {
  const predicted: StepType[] = [];
  for (const n of steps) {
    const dest = `${out}/${run}-${tier}-r${repeat + 1}-s${String(n).padStart(2, "0")}.json`;
    if (existsSync(dest)) {
      const prior = JSON.parse(readFileSync(dest, "utf8"));
      if (prior.result?.ok) predicted.push(prior.result.data);
      continue;
    }
    const before = variant === "rollout" ? predicted : goldSteps.filter(s => s.stepNumber < n);
    const placed = before.reduce<string[]>((a, s) => placedPartsAfterStep(s, parts, a), []);
    const images = variant === "previous" && n > 1 ? [crop(n - 1), crop(n)] : [crop(n)];
    const promptParts = variant === "baseline" ? parts.map(({ id, label, kind, count }) => ({ id, label, kind, count })) : parts;
    let prompt = loadPrompt(variant === "baseline" ? "analyze-step" : "analyze-step-review", {
      parts: promptParts, placedPartIds: placed, previousInstructions: before.map(s => s.instruction), stepNumber: n,
    });
    if (variant === "previous" && n > 1) prompt += `\nImage 1: previous step ${n - 1}, context only. Image 2: current step ${n}.`;
    if (variant === "fewshot") {
      if (n === 3) throw new Error("Step 3 is the few-shot training example, not an evaluation case");
      prompt += `\nExample only, from a DIFFERENT step (3). Do not repeat it: ${JSON.stringify(goldSteps.find(s => s.stepNumber === 3))}`;
    }
    const start = Date.now();
    const attempts: unknown[] = [];
    const rejections: unknown[] = [];
    const generate: Generate = async request => {
      const id = `${run}-${tier}-${repeat}-${n}-${attempts.length}-${Date.now()}`;
      const price = prices[tier];
      const maxOutputTokens = 8192;
      // UTF-8 bytes upper-bound our ASCII prompt tokens; image allowance is deliberately generous.
      const maxInput = Buffer.byteLength(request.prompt + JSON.stringify(request.jsonSchema)) + images.length * 8192;
      const reserved = (maxInput * price.input + 65536 * price.output) / 1e6;
      if (spent() + reserved > budget) throw new ReviewBudgetError("Diagnostic budget exhausted");
      const remainingMs = 55000 - (Date.now() - start);
      if (remainingMs <= 0) throw new Error("Step deadline exhausted");
      recordCharge({ id, reserved, outputAllowance: 65536 });
      const begun = Date.now();
      try {
        const response = await getVertexClient().models.generateContent({
          model: request.model,
          contents: [{ role: "user", parts: [...images.map(data => ({ inlineData: { mimeType: "image/jpeg", data } })), { text: request.prompt }] }],
          config: { responseMimeType: "application/json", responseJsonSchema: variant === "native" ? nativeStepSchema() : request.jsonSchema, temperature,
            maxOutputTokens, thinkingConfig: { thinkingLevel: thinking },
            httpOptions: { timeout: remainingMs, retryOptions: { attempts: 1 } }, abortSignal: AbortSignal.timeout(remainingMs) },
        });
        const usage = response.usageMetadata;
        const inputTokens = usage?.promptTokenCount ?? 0;
        const outputTokens = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
        const cost = (inputTokens * price.input + outputTokens * price.output) / 1e6;
        recordCharge({ id, reserved, settled: usage ? cost : reserved, outputAllowance: 65536 });
        const reply = { text: response.text ?? "", inputTokens, outputTokens };
        attempts.push({ ...reply, ms: Date.now() - begun, cost, thoughts: usage?.thoughtsTokenCount,
          finish: response.candidates?.[0]?.finishReason, modelVersion: response.modelVersion });
        return reply;
      } catch (error) {
        const status = error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : undefined;
        if (status && status >= 400 && status <= 599) recordCharge({ id, reserved, settled: 0, outputAllowance: 65536 });
        attempts.push({ ms: Date.now() - begun, error: error instanceof Error ? error.name : "Error", httpStatus: status, reserved });
        // Unknown/cancelled requests remain reserved: cancelling doesn't guarantee no server-side billing.
        throw error;
      }
    };
    let result;
    let failure;
    try {
      result = await callStructured({ prompt, images, schema: Step, model: tier, generate,
        semanticCheck: s => checkStep(s, parts, placed),
        onRejected: (answer, errors) => rejections.push({ answer, errors }) });
      if (result.ok) predicted.push(result.data);
    } catch (error) {
      if (error instanceof ReviewBudgetError) throw error; // Unrun cases must not count as model failures.
      failure = error instanceof Error ? error.name : "Error";
    }
    const expected = goldSteps.find(s => s.stepNumber === n)!;
    const score = scoreStep(expected, result?.ok ? result.data : undefined);
    const record = { run, variant, tier, model: MODELS[tier], thinking, temperature, maxOutputTokens: 8192, deadlineMs: 55000, repeat, stepNumber: n,
      context: variant === "rollout" ? "predicted" : "gold", prompt, promptHash: digest(prompt),
      imageHashes: images.map(digest), schemaHash: digest(readFileSync("schema/ai/step.ts", "utf8")),
      elapsedMs: Date.now() - start, result, failure, attempts, rejections, score,
      conservativeSpendToDate: spent() };
    writeFileSync(dest, JSON.stringify(record, null, 2) + "\n");
    console.log(`REVIEW ${run} ${tier} step ${n}: ${score.correct}/${score.total}, exact=${score.exactStep}, ok=${result?.ok ?? false}, ${(record.elapsedMs / 1000).toFixed(1)}s, ledger=$${spent().toFixed(4)}`);
  }
}

// Two independent series at most; sequential inside each series, including rollout state.
async function main() {
  for (let i = 0; i < jobs.length; i += 2) await Promise.all(jobs.slice(i, i + 2).map(runSeries));
  console.log(`Review complete; conservative settled/reserved spend: $${spent().toFixed(4)}`);
}
main().catch(() => { console.error("Review failed; inspect saved per-step records. No credentials logged."); process.exitCode = 1; });

// Pure helpers for the upload orchestrator (client/processManual.ts). No network, no canvas.
import type { AiPart, PageIndex, StepBox, Usage } from "@/schema";

/** One step found by call 1, with the page it is on. */
export type StepRef = { stepNumber: number; pageNumber: number; box: StepBox; subassembly?: string };

/** What the player will show, in order: a step to analyse, or a run of sub-assembly steps collapsed into one card. */
export type PlannedStep =
  | { kind: "analyse"; ref: StepRef }
  | { kind: "subassembly"; label: string; sourceSteps: number[] };

/**
 * Every step in the manual, once, in step-number order.
 * Branching manuals repeat step numbers (KALLAX 15–19 vertical / horizontal): the first one seen wins (D-14).
 */
export function pickSteps(pages: readonly PageIndex[]): StepRef[] {
  const byNumber = new Map<number, StepRef>();
  pages.forEach((page, index) => {
    const inReadingOrder = [...page.steps].sort((a, b) => a.box[0] - b.box[0]);
    for (const step of inReadingOrder) {
      if (byNumber.has(step.stepNumber)) continue;
      byNumber.set(step.stepNumber, {
        stepNumber: step.stepNumber,
        pageNumber: index + 1,
        box: step.box,
        ...(step.subassembly && { subassembly: step.subassembly }),
      });
    }
  });
  return [...byNumber.values()].sort((a, b) => a.stepNumber - b.stepNumber);
}

/** Step numbers missing between 1 and the highest one found. */
export function missingStepNumbers(steps: readonly StepRef[]): number[] {
  const found = new Set(steps.map((step) => step.stepNumber));
  const highest = Math.max(0, ...found);
  return Array.from({ length: highest }, (_, i) => i + 1).filter((n) => !found.has(n));
}

/** Consecutive steps with the same sub-assembly label become one card; they are never analysed (D-12). */
export function planSteps(steps: readonly StepRef[]): PlannedStep[] {
  const plan: PlannedStep[] = [];
  for (const ref of steps) {
    const last = plan[plan.length - 1];
    if (!ref.subassembly) plan.push({ kind: "analyse", ref });
    else if (last?.kind === "subassembly" && last.label === ref.subassembly) last.sourceSteps.push(ref.stepNumber);
    else plan.push({ kind: "subassembly", label: ref.subassembly, sourceSteps: [ref.stepNumber] });
  }
  return plan;
}

/** How many finished units with this label the parts list has, e.g. drawer_1 and drawer_2 → 2. */
export function countUnits(label: string, parts: readonly AiPart[]): number {
  const needle = label.toLowerCase();
  return parts.filter((part) => part.kind === "other" && (part.id.toLowerCase().includes(needle) || part.label.toLowerCase().includes(needle))).length;
}

/** The template text for a sub-assembly card (CONTRACTS §3). Not AI output. */
export function subassemblyMessage(label: string, sourceSteps: readonly number[], count: number): string {
  const first = sourceSteps[0];
  const last = sourceSteps[sourceSteps.length - 1];
  const steps = first === last ? `manual step ${first}` : `manual steps ${first}–${last}`;
  const subject = count === 1 ? `The ${label} is` : count > 1 ? `The ${count} ${label}s are` : `The ${label}s are`;
  return `${subject} assembled separately (${steps}). Follow the manual for those, then continue here.`;
}

/** Readable list: [7] → "7", [7, 8] → "7 and 8", [7, 8, 12] → "7, 8 and 12". */
export function listNumbers(numbers: readonly number[]): string {
  if (numbers.length <= 1) return numbers.join("");
  return `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;
}

/** Runs `task` over every item, at most `limit` at a time, keeping results in input order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, worker));
  return results;
}

// USD per 1M tokens. A browser copy of PRICES in pipeline/config.ts, which is server-only; keep the two in step.
const PRICES: Record<string, { input: number; output: number }> = {
  "gemini-3.8-flash": { input: 0.75, output: 3.75 },
};

export type UsageTotals = { calls: number; inputTokens: number; outputTokens: number; estUsd: number };

/** Totals for the cost readout. A model with no known price counts its tokens but adds no cost. */
export function totalUsage(usage: readonly Usage[]): UsageTotals {
  let inputTokens = 0;
  let outputTokens = 0;
  let estUsd = 0;
  for (const call of usage) {
    inputTokens += call.inputTokens;
    outputTokens += call.outputTokens;
    const price = PRICES[call.model];
    if (price) estUsd += (call.inputTokens * price.input + call.outputTokens * price.output) / 1_000_000;
  }
  return { calls: usage.length, inputTokens, outputTokens, estUsd: Math.round(estUsd * 10_000) / 10_000 };
}

export function cropName(stepNumber: number): string {
  return `step-${String(stepNumber).padStart(2, "0")}.jpg`;
}

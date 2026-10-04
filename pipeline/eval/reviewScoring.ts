import "server-only";
import type { Action, Step } from "@/schema";

export const FIELDS = ["verb", "part", "target", "count", "face", "for"] as const;
const EXACT_FIELDS = [...FIELDS, "at", "flipMode"] as const;
const sameAction = (a: Action, b: Action) => EXACT_FIELDS.every(f => a[f] === b[f]);
// One-to-one, maximum-agreement assignment. No prediction can explain two gold actions.
// Unmatched extra/missing actions cost six fields. Also report exact action precision/recall.
export function scoreActions(expected: Action[], actual: Action[]) {
  let best: number[] = [], bestScore = -1, bestExact = -1;
  function visit(i: number, used: Set<number>, mapping: number[], score: number, exact: number) {
    if (i === expected.length) {
      if (score > bestScore || (score === bestScore && exact > bestExact)) { best = [...mapping]; bestScore = score; bestExact = exact; }
      return;
    }
    visit(i + 1, used, [...mapping, -1], score, exact);
    actual.forEach((got, j) => {
      if (used.has(j)) return;
      used.add(j);
      visit(i + 1, used, [...mapping, j], score + FIELDS.filter(f => expected[i][f] === got[f]).length, exact + Number(sameAction(expected[i], got)));
      used.delete(j);
    });
  }
  visit(0, new Set(), [], 0, 0);
  const fields = Object.fromEntries(FIELDS.map(f => [f, expected.reduce((n, want, i) =>
    n + Number(best[i] >= 0 && actual[best[i]][f] === want[f]), 0)]));
  const exact = expected.filter((want, i) => best[i] >= 0 && sameAction(want, actual[best[i]])).length;
  // Active-only prevents absent optional fields from inflating the accuracy.
  let activeCorrect = 0, activeTotal = 0;
  expected.forEach((want, i) => {
    const got = best[i] >= 0 ? actual[best[i]] : undefined;
    for (const f of FIELDS) {
      if (want[f] === undefined && got?.[f] === undefined) continue;
      activeTotal++;
      if (got && want[f] === got[f]) activeCorrect++;
    }
  });
  const used = new Set(best.filter(i => i >= 0));
  actual.forEach((got, i) => { if (!used.has(i)) activeTotal += FIELDS.filter(f => got[f] !== undefined).length; });
  return { fields, correct: Math.max(0, bestScore), total: Math.max(expected.length, actual.length) * FIELDS.length,
    activeCorrect, activeTotal, exact, expected: expected.length, predicted: actual.length, mapping: best };
}

export function scoreStep(expected: Step, actual?: Step) {
  const actions = scoreActions(expected.actions, actual?.actions ?? []);
  const trapKeys = ["part", "mustFace", "wrong", "source"] as const;
  const trapCorrect = Boolean(actual) && (expected.orientationTrap
    ? Boolean(actual?.orientationTrap) && trapKeys.every(k => expected.orientationTrap?.[k] === actual?.orientationTrap?.[k])
    : !actual?.orientationTrap);
  return { ...actions, kindCorrect: expected.kind === actual?.kind,
    numberCorrect: expected.stepNumber === actual?.stepNumber, trapCorrect,
    exactStep: Boolean(actual) && expected.kind === actual?.kind && expected.stepNumber === actual?.stepNumber &&
      trapCorrect && actions.exact === actions.expected && actions.exact === actions.predicted };
}

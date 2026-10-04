import "server-only";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { SavedManual, checkCumulativeCounts, type Step } from "@/schema";
import { buildSceneManual } from "@/scene/buildSceneManual";
import { resolveScene } from "@/scene/resolveScene";
import { FIELDS, scoreStep } from "./reviewScoring";

type Row = { run: string; tier: string; repeat: number; stepNumber: number; elapsedMs: number;
  result?: { ok: boolean; data?: Step; attempts: number }; score: ReturnType<typeof scoreStep>;
  attempts: { inputTokens?: number; outputTokens?: number; cost?: number; ms: number; reserved?: number }[] };
const dir = "eval/out/kar04-review";
const rows: Row[] = readdirSync(dir).filter(f => /-r\d+-s\d+\.json$/.test(f)).map(f => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));
const groups = new Map<string, Row[]>();
for (const r of rows) {
  const key = `${r.run}/${r.tier}`;
  groups.set(key, [...groups.get(key) ?? [], r]);
}
const sum = (r: Row[], f: (r: Row) => number) => r.reduce((n, r) => n + f(r), 0);
const pct = (n: number, d: number) => d ? `${(100 * n / d).toFixed(1)}%` : "n/a";
const quantile = (r: Row[], p: number) => {
  const times = r.map(r => r.elapsedMs).sort((a, b) => a - b);
  return (times[Math.max(0, Math.ceil(times.length * p) - 1)] / 1000).toFixed(1);
};
const lines = ["# KAR-04 diagnostic measurements", "", "Generated from saved responses. These are agreement metrics against the existing, partly disputed fixture, not verified physical correctness.", "",
  "| Run / model | Cases | Valid | First try | Field agreement | Active fields | Exact actions (P / R) | Exact steps | p50 / p95 / max sec | Recorded USD* |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"];
for (const [name, r] of groups) {
  const exact = sum(r, x => x.score.exact);
  lines.push(`| ${name} | ${r.length} | ${r.filter(r => r.result?.ok).length} | ${r.filter(r => r.result?.ok && r.result.attempts === 1).length} | ${pct(sum(r, x => x.score.correct), sum(r, x => x.score.total))} | ${pct(sum(r, x => x.score.activeCorrect), sum(r, x => x.score.activeTotal))} | ${pct(exact, sum(r, x => x.score.predicted))} / ${pct(exact, sum(r, x => x.score.expected))} | ${r.filter(r => r.score.exactStep).length}/${r.length} | ${quantile(r, .5)} / ${quantile(r, .95)} / ${quantile(r, 1)} | $${sum(r, x => x.attempts.reduce((n, a) => n + (a.cost ?? 0), 0)).toFixed(4)} |`);
}
lines.push("", "*Recorded cost uses conservative pre-credit Flash $1.50/$7.50 and standard Pro $2/$12 per million input/output tokens, including thought tokens. Unknown/timed-out requests are additionally reserved in ledger.jsonl.", "",
  "## Sensitivity: exclude disputed gold steps 1, 12, 14, 15", "", "| Run / model | Cases | Field agreement | Exact steps |", "|---|---:|---:|---:|");
for (const [name, all] of groups) {
  const r = all.filter(r => ![1, 12, 14, 15].includes(r.stepNumber));
  lines.push(`| ${name} | ${r.length} | ${pct(sum(r, x => x.score.correct), sum(r, x => x.score.total))} | ${r.filter(r => r.score.exactStep).length}/${r.length} |`);
}
const common = [2, 4, 6, 9, 12, 13, 14, 15, 16];
lines.push("", "## Matched-case comparison", "", `Same step identities in every row: ${common.join(", ")}. Repeats count as separate predictions, not independent manuals.`, "",
  "| Run / model | Predictions | Field agreement | Exact steps | p50 / p95 sec |", "|---|---:|---:|---:|---:|");
for (const [name, all] of groups) {
  if (!common.every(n => all.some(r => r.stepNumber === n))) continue;
  const r = all.filter(r => common.includes(r.stepNumber));
  lines.push(`| ${name} | ${r.length} | ${pct(sum(r, x => x.score.correct), sum(r, x => x.score.total))} | ${r.filter(r => r.score.exactStep).length}/${r.length} | ${quantile(r, .5)} / ${quantile(r, .95)} |`);
}
lines.push("", "## Per-step six-field table", "", "Each cell is correct fields / gold action count. Extra predicted actions are penalized in aggregate metrics above. No-action info steps use kind/trap/exact-step metrics.", "",
  `| Run / model | Repeat | Step | ${FIELDS.join(" | ")} | Exact | Valid | Seconds |`, `|---|---:|---:|${FIELDS.map(() => "---:").join("|")}|---|---|---:|`);
for (const r of rows.sort((a, b) => a.run.localeCompare(b.run) || a.tier.localeCompare(b.tier) || a.repeat - b.repeat || a.stepNumber - b.stepNumber)) {
  lines.push(`| ${r.run}/${r.tier} | ${r.repeat + 1} | ${r.stepNumber} | ${FIELDS.map(f => `${r.score.fields[f]}/${r.score.expected}`).join(" | ")} | ${r.score.exactStep} | ${r.result?.ok ?? false} | ${(r.elapsedMs / 1000).toFixed(1)} |`);
}
const gold = SavedManual.parse(JSON.parse(readFileSync("fixtures/kallax.gold.json", "utf8")));
lines.push("", "## Replay diagnostics (complete 19-step series only)", "");
for (const [name, r] of groups) {
  for (const repeat of new Set(r.map(x => x.repeat))) {
    const all = r.filter(x => x.repeat === repeat).sort((a, b) => a.stepNumber - b.stepNumber);
    if (all.length !== 19) continue;
    const steps = all.flatMap(x => x.result?.ok && x.result.data ? [x.result.data] : []);
    const saved = SavedManual.parse({ ...gold, steps: all.map(x => x.result?.ok
      ? { status: "ok", step: x.result.data, crop: `crops/step-${x.stepNumber}.jpg`, attempts: x.result.attempts }
      : { status: "failed", stepNumber: x.stepNumber, errors: ["Diagnostic failure"], crop: `crops/step-${x.stepNumber}.jpg`, attempts: 3 }) });
    const scene = buildSceneManual(saved, "/manuals/kallax");
    const state = resolveScene(scene.manual, 18);
    lines.push(`- ${name} repeat ${repeat + 1}: cumulative=${JSON.stringify(checkCumulativeCounts(steps, gold.layout.parts))}; scene warnings=${JSON.stringify(state.warnings)}; solids=${[...state.placed.values()].filter(p => p.kind === "panel").length}/11.`);
  }
}
writeFileSync(`${dir}/measurements.md`, lines.join("\n") + "\n");
console.log(lines.slice(0, 7 + groups.size).join("\n"));

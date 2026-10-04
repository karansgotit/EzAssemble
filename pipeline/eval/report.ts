import "server-only";

import { readFileSync, writeFileSync } from "node:fs";
import type { Action, Step, Usage } from "@/schema";
import { FIELDS, type scoreStep } from "./reviewScoring";

export type StepRecord = {
  stepNumber: number; cropFile: string; gold: Step; ai?: Step; ok: boolean; attempts: number; ms: number;
  usage: Usage[]; errors: string[]; score: ReturnType<typeof scoreStep>;
};

const escape = (text: string) => text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// One action as "verb part ×count → target.face (for X)", with fields that differ from the other side in red.
function action(a: Action | undefined, other: Action | undefined): string {
  if (!a) return '<span class="bad">(missing)</span>';
  const cell = (field: (typeof FIELDS)[number], text: string) =>
    other && a[field] === other[field] ? escape(text) : `<span class="bad">${escape(text)}</span>`;
  return [
    cell("verb", a.verb), cell("part", a.part), cell("count", `×${a.count}`),
    a.target || other?.target ? `→ ${cell("target", a.target ?? "–")}.${cell("face", a.face ?? "–")}` : "",
    a.for || other?.for ? `(for ${cell("for", a.for ?? "–")})` : "",
  ].filter(Boolean).join(" ");
}

// One table row per step. Crops are embedded so the report works wherever it is opened or shared.
function stepRow(r: StepRecord): string {
  const mapping = r.score.mapping;
  const aiActions = r.ai?.actions ?? [];
  const pairs = r.gold.actions.map((want, i) => [want, mapping[i] >= 0 ? aiActions[mapping[i]] : undefined] as const);
  const extras = aiActions.filter((_, j) => !mapping.includes(j));
  const goldCell = [...pairs.map(([w, g]) => action(w, g)), ...extras.map(() => '<span class="bad">(none)</span>')];
  const aiCell = [...pairs.map(([w, g]) => action(g, w)), ...extras.map(e => action(e, undefined))];
  const trap = (s?: Step) => (s?.orientationTrap ? `${s.orientationTrap.part} must face ${s.orientationTrap.mustFace}` : "–");
  const status = r.ok ? `ok · ${r.attempts} ${r.attempts === 1 ? "try" : "tries"} · ${(r.ms / 1000).toFixed(1)} s` : `<span class="bad">failed: ${escape(r.errors.join("; "))}</span>`;
  const kind = r.score.kindCorrect ? r.gold.kind : `<span class="bad">${r.gold.kind} → ${r.ai?.kind ?? "?"}</span>`;
  const trapCell = r.score.trapCorrect ? trap(r.gold) : `<span class="bad">${escape(trap(r.gold))} → ${escape(trap(r.ai))}</span>`;
  return `<tr class="${r.score.exactStep ? "exact" : ""}">
  <td><b>${r.stepNumber}</b><br><img src="data:image/jpeg;base64,${readFileSync(r.cropFile).toString("base64")}" alt="step ${r.stepNumber}"></td>
  <td>${kind}<br><small>${status}</small></td>
  <td>${goldCell.join("<br>") || "–"}<br><small>${escape(r.gold.instruction)}</small></td>
  <td>${aiCell.join("<br>") || "–"}<br><small>${escape(r.ai?.instruction ?? "")}</small></td>
  <td>${trapCell}</td></tr>`;
}

export function writeReport(file: string, title: string, records: StepRecord[]): void {
  const exact = records.filter(r => r.score.exactStep).length;
  writeFileSync(file, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Eval: ${escape(title)}</title><style>
body{font:14px/1.4 system-ui,sans-serif;margin:16px;background:#fff;color:#111}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;vertical-align:top;text-align:left}
img{max-width:260px;display:block;margin-top:4px}.bad{color:#c00;font-weight:600}tr.exact td:first-child{background:#e8f6ea}
small{color:#555}</style></head><body>
<h1>Eval: ${escape(title)}</h1><p>${records.filter(r => r.ok).length}/${records.length} steps valid · ${exact} exact · mismatches in red · gold context</p>
<table><tr><th>Step</th><th>Kind / result</th><th>Gold</th><th>AI</th><th>Manual warning</th></tr>
${records.map(stepRow).join("\n")}
</table></body></html>\n`);
}

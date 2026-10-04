// KAR-09: `npm run eval -- <manualId> [--index] [--parts]`. Real, billed AI calls (KALLAX ≈ 10 cents for steps).
// Scores call 3 on every gold step (gold context), and optionally call 1 (page index, incl. sub-assembly
// detection) and call 2 (parts). Prints a summary and writes eval/out/<id>.json + eval/out/<id>.html.
// Page images for --index/--parts come from manuals-src/<id>/pages/page-NN.jpg (git-ignored), e.g.
//   pdftoppm -jpeg -jpegopt quality=85 -scale-to 1600 <manual.pdf> manuals-src/<id>/pages/page

import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import sharp from "sharp";
import { HARDWARE_KINDS, SavedManual, placedPartsAfterStep, type Step, type Usage } from "@/schema";
import { toBuildSize } from "@/scene/buildSceneManual";
import { analyzeStep } from "../analyzeStep";
import { MODELS, PRICES, ANALYZE_STEP_MODEL } from "../config";
import { indexPage } from "../indexPage";
import { partsLayout } from "../partsLayout";
import { writeReport, type StepRecord } from "./report";
import { FIELDS, scoreStep } from "./reviewScoring";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

// 4 at once slowed each Vertex request to 40–55 s (2 timeouts); one at a time takes ~3 min for KALLAX.
const CONCURRENCY = 2;
const nn = (n: number) => String(n).padStart(2, "0");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");
const cost = (usage: Usage[]) => usage.reduce((n, u) => n + (u.inputTokens * (PRICES[u.model]?.input ?? 0) + u.outputTokens * (PRICES[u.model]?.output ?? 0)) / 1e6, 0);

// Run jobs a few at a time: gold-context steps are independent, so this keeps a manual well under 5 minutes.
async function pool<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < items.length) { const i = next++; results[i] = await run(items[i]); }
  }));
  return results;
}

async function evalSteps(id: string, gold: SavedManual): Promise<StepRecord[]> {
  const parts = gold.layout.parts;
  const goldSteps = gold.steps.flatMap(entry => (entry.status === "ok" ? [{ step: entry.step, crop: entry.crop }] : []));
  return pool(goldSteps, async ({ step: expected, crop }) => {
    const before = goldSteps.map(g => g.step).filter(s => s.stepNumber < expected.stepNumber);
    const placedPartIds = before.reduce<string[]>((placed, s) => placedPartsAfterStep(s, parts, placed), []);
    const cropFile = `public/manuals/${id}/${crop}`;
    const started = Date.now();
    const result = await analyzeStep({
      parts, placedPartIds, previousInstructions: before.map(s => s.instruction), stepNumber: expected.stepNumber,
      image: readFileSync(cropFile).toString("base64"),
    });
    const ai: Step | undefined = result.ok ? result.data : undefined;
    return { stepNumber: expected.stepNumber, cropFile, gold: expected, ai, ok: result.ok, attempts: result.attempts,
      ms: Date.now() - started, usage: result.usage, errors: result.ok ? [] : result.errors, score: scoreStep(expected, ai) };
  });
}

function summarizeSteps(records: StepRecord[]) {
  const fieldRight = Object.fromEntries(FIELDS.map(f => [f, 0])) as Record<(typeof FIELDS)[number], number>;
  let actionSlots = 0, trapTp = 0, trapFp = 0, trapFn = 0, kindRight = 0;
  for (const r of records) {
    actionSlots += Math.max(r.score.expected, r.score.predicted);
    for (const f of FIELDS) fieldRight[f] += r.score.fields[f];
    if (r.score.kindCorrect) kindRight++;
    const want = r.gold.orientationTrap, got = r.ai?.orientationTrap;
    if (want && got && want.part === got.part && want.mustFace === got.mustFace) trapTp++;
    else { if (got) trapFp++; if (want) trapFn++; }
  }
  const usage = records.flatMap(r => r.usage);
  console.log(`\n## Call 3: steps (${MODELS[ANALYZE_STEP_MODEL]}, gold context)\n`);
  console.log("| Metric | Result |\n|---|---|");
  console.log(`| Schema pass (valid within 3 tries) | ${records.filter(r => r.ok).length}/${records.length} (first try: ${records.filter(r => r.ok && r.attempts === 1).length}) |`);
  console.log(`| Step kind (assembly/info) | ${pct(kindRight, records.length)} |`);
  for (const f of FIELDS) console.log(`| ${f} | ${pct(fieldRight[f], actionSlots)} |`);
  console.log(`| Manual warnings: recall / precision | ${pct(trapTp, trapTp + trapFn)} / ${pct(trapTp, trapTp + trapFp)} |`);
  console.log(`| Exact steps | ${records.filter(r => r.score.exactStep).length}/${records.length} |`);
  console.log(`| Slowest step | ${(Math.max(...records.map(r => r.ms)) / 1000).toFixed(1)} s |`);
  console.log(`| Tokens / USD | ${usage.reduce((n, u) => n + u.inputTokens, 0)} in, ${usage.reduce((n, u) => n + u.outputTokens, 0)} out / $${cost(usage).toFixed(3)} |`);
}

async function evalIndex(id: string, gold: SavedManual) {
  const pages = gold.pages.map((_, i) => `manuals-src/${id}/pages/page-${nn(i + 1)}.jpg`);
  if (!pages.every(existsSync)) return console.log(`\n(--index skipped: page images missing in manuals-src/${id}/pages/)`);
  const results = await pool(pages.map((file, i) => ({ file, pageNumber: i + 1 })), ({ file, pageNumber }) =>
    indexPage({ image: readFileSync(file).toString("base64"), pageNumber }));
  let typeRight = 0, subTp = 0, subFp = 0, subFn = 0;
  const found = new Set<number>();
  results.forEach((result, i) => {
    const want = gold.pages[i];
    if (!result.ok) return;
    if (result.data.pageType === want.pageType) typeRight++;
    for (const s of result.data.steps) found.add(s.stepNumber);
    const wantSub = new Set(want.steps.filter(s => s.subassembly).map(s => s.stepNumber));
    const gotSub = new Set(result.data.steps.filter(s => s.subassembly).map(s => s.stepNumber));
    for (const n of gotSub) wantSub.has(n) ? subTp++ : subFp++;
    for (const n of wantSub) if (!gotSub.has(n)) subFn++;
  });
  const goldNumbers = [...new Set(gold.pages.flatMap(p => p.steps.map(s => s.stepNumber)))];
  const usage = results.flatMap(r => r.usage);
  console.log(`\n## Call 1: page index\n\n| Metric | Result |\n|---|---|`);
  console.log(`| Pages answered | ${results.filter(r => r.ok).length}/${results.length} |`);
  console.log(`| Page type | ${pct(typeRight, results.length)} |`);
  console.log(`| Gold step numbers found | ${goldNumbers.filter(n => found.has(n)).length}/${goldNumbers.length} |`);
  console.log(`| Sub-assembly steps: recall / precision | ${subTp + subFn ? pct(subTp, subTp + subFn) : "n/a (none in gold)"} / ${subTp + subFp ? pct(subTp, subTp + subFp) : "n/a"} |`);
  console.log(`| USD | $${cost(usage).toFixed(3)} |`);
}

async function evalParts(id: string, gold: SavedManual) {
  const page = (n: number) => `manuals-src/${id}/pages/page-${nn(n)}.jpg`;
  const partsPages = gold.pages.flatMap((p, i) => (p.pageType === "parts" ? [i + 1] : []));
  const coverPage = Math.max(gold.pages.findIndex(p => p.pageType === "cover"), 0) + 1;
  if (![coverPage, ...partsPages].map(page).every(existsSync)) return console.log(`\n(--parts skipped: page images missing in manuals-src/${id}/pages/)`);
  const stepThumbs = await Promise.all(gold.steps.flatMap(s => (s.status === "subassembly" ? [] : [s.crop])).map(async crop =>
    (await sharp(`public/manuals/${id}/${crop}`).resize(512, 512, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer()).toString("base64")));
  const result = await partsLayout({ title: gold.title, productSizeCm: gold.productSizeCm, stepThumbs,
    cover: readFileSync(page(coverPage)).toString("base64"), partsPages: partsPages.map(n => readFileSync(page(n)).toString("base64")) });
  console.log(`\n## Call 2: parts\n\n| Metric | Gold | AI |\n|---|---|---|`);
  if (!result.ok) return console.log(`| result | ok | failed: ${result.errors.join("; ")} |`);
  const ai = result.data;
  const kinds = [...new Set([...gold.layout.parts, ...ai.parts].map(p => p.kind))];
  console.log(`| buildOrientation | ${gold.layout.buildOrientation} | ${ai.buildOrientation} |`);
  for (const kind of kinds) {
    const count = (l: typeof ai) => l.parts.filter(p => p.kind === kind).reduce((n, p) => n + p.count, 0);
    console.log(`| ${kind} | ${count(gold.layout)} | ${count(ai)} |`);
  }
  const solids = (l: typeof ai) => l.parts.filter(p => !HARDWARE_KINDS.includes(p.kind)).length;
  console.log(`| solid parts | ${solids(gold.layout)} | ${solids(ai)} |`);
  console.log(`| build size (cm) | ${toBuildSize(gold.productSizeCm, gold.layout.buildOrientation).join(" × ")} | ${toBuildSize(gold.productSizeCm, ai.buildOrientation).join(" × ")} |`);
  console.log(`| USD | | $${cost(result.usage).toFixed(3)} |`);
}

async function main() {
  const id = process.argv.slice(2).find(a => !a.startsWith("--")) ?? "kallax";
  const flags = new Set(process.argv.slice(2).filter(a => a.startsWith("--")));
  const file = `fixtures/${id}.gold.json`;
  if (!existsSync(file)) throw new Error(`No gold fixture at ${file}.`);
  const gold = SavedManual.parse(JSON.parse(readFileSync(file, "utf8")));
  const started = Date.now();

  console.log(`# Eval: ${gold.title} (${id})`);
  const records = await evalSteps(id, gold);
  summarizeSteps(records);
  if (flags.has("--index")) await evalIndex(id, gold);
  if (flags.has("--parts")) await evalParts(id, gold);

  mkdirSync("eval/out", { recursive: true });
  writeFileSync(`eval/out/${id}.json`, JSON.stringify(records, null, 2));
  writeReport(`eval/out/${id}.html`, gold.title, records);
  console.log(`\nTotal ${((Date.now() - started) / 1000).toFixed(0)} s · report: eval/out/${id}.html`);
}

main().catch(error => {
  console.error(`Eval failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}`);
  process.exitCode = 1;
});

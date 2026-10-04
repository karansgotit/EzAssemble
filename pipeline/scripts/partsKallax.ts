// KAR-07 check: sends KALLAX's cover, parts page and 19 step thumbnails to partsLayout (real AI calls,
// a few cents per model) and compares the answer with gold: counts, orientation, homeFrac error, hole faces,
// and whether Ajit's snapLayout accepts it.
// Needs the pages as images first (git-ignored):
//   pdftoppm -jpeg -jpegopt quality=85 -scale-to 1600 <kallax.pdf> manuals-src/kallax/pages/page
// Run from the repo root (tiers optional, default both):
//   npx tsx --conditions=react-server --env-file=.env.local pipeline/scripts/partsKallax.ts strong,fast

import "server-only";

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { HARDWARE_KINDS, SavedManual, type AiPart, type PartsLayout, type Vec3 } from "@/schema";
import { toBuildSize } from "@/scene/buildSceneManual";
import { snapLayout } from "@/scene/layout";
import { MODELS, PRICES, type ModelTier } from "../config";
import { partsLayout } from "../partsLayout";

const gold = SavedManual.parse(JSON.parse(readFileSync("fixtures/kallax.gold.json", "utf8")));
const base64 = (file: string) => readFileSync(file).toString("base64");
const isSolid = (part: AiPart) => !HARDWARE_KINDS.includes(part.kind);

function countBy(layout: PartsLayout, kind: string) {
  return layout.parts.filter(p => p.kind === kind).reduce((n, p) => n + p.count, 0);
}

// Pair each gold solid with the nearest unused AI solid (by homeFrac) and measure how far off it is.
function compareSolids(ai: PartsLayout) {
  const unused = ai.parts.filter(isSolid);
  let axisError = 0, axes = 0, holesRight = 0, holesTotal = 0;
  for (const want of gold.layout.parts.filter(isSolid)) {
    if (!unused.length) break;
    const distance = (p: AiPart) => p.homeFrac!.reduce((sum, v, i) => sum + (v - want.homeFrac![i]) ** 2, 0);
    const got = unused.splice(unused.indexOf(unused.reduce((a, b) => (distance(b) < distance(a) ? b : a))), 1)[0];
    got.homeFrac!.forEach((v, i) => { axisError += Math.abs(v - want.homeFrac![i]); axes++; });
    const wantHoles = want.features.find(f => f.type === "holes")?.face;
    if (wantHoles) { holesTotal++; if (got.features.some(f => f.type === "holes" && f.face === wantHoles)) holesRight++; }
  }
  return { homeFracError: axes ? axisError / axes : NaN, holesRight, holesTotal };
}

async function main() {
  const tiers = (process.argv[2] ?? "strong,fast").split(",") as ModelTier[];
  const thumbs = await Promise.all(gold.steps.map(async (_, i) => (await sharp(`public/manuals/kallax/crops/step-${String(i + 1).padStart(2, "0")}.jpg`)
    .resize(512, 512, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer()).toString("base64")));
  const request = {
    title: gold.title, productSizeCm: gold.productSizeCm, cover: base64("manuals-src/kallax/pages/page-01.jpg"),
    partsPages: [base64("manuals-src/kallax/pages/page-07.jpg")], stepThumbs: thumbs,
  };

  const rows: string[] = [];
  for (const tier of tiers) {
    const model = MODELS[tier];
    const result = await partsLayout(request, {
      model: tier, onRejected: (_, errors) => console.log(`  rejected (${tier}): ${errors.join("; ")}`),
    });
    const ms = result.usage.reduce((n, u) => n + u.ms, 0);
    const price = PRICES[model];
    const cost = result.usage.reduce((n, u) => n + (u.inputTokens * price.input + u.outputTokens * price.output) / 1e6, 0);
    if (!result.ok) { rows.push(`| ${model} | failed after ${result.attempts}: ${result.errors.join("; ")} | | | | | | | ${(ms / 1000).toFixed(1)} s | $${cost.toFixed(3)} |`); continue; }

    const ai = result.data;
    mkdirSync("manuals-src/kallax/parts-runs", { recursive: true });
    writeFileSync(`manuals-src/kallax/parts-runs/${model}-${Date.now()}.json`, JSON.stringify(ai, null, 2)); // git-ignored, for inspection
    const buildSize: Vec3 = toBuildSize(gold.productSizeCm, ai.buildOrientation);
    const snapped = snapLayout(ai, buildSize);
    const { homeFracError, holesRight, holesTotal } = compareSolids(ai);
    console.log(`\n${model} parts:`, ai.parts.map(p => `${p.id}(${p.kind}×${p.count})`).join(" "));
    if (snapped.errors.length) console.log(`${model} snapLayout errors:`, snapped.errors);
    rows.push(`| ${model} | ${ai.buildOrientation} | ${countBy(ai, "panel")}/11 | ${countBy(ai, "dowel")}/22 | ${countBy(ai, "screw")}/8 | `
      + `${homeFracError.toFixed(3)} (${(homeFracError * 100).toFixed(1)}%) | ${holesRight}/${holesTotal} | ${snapped.ok ? "ok" : `${snapped.errors.length} errors`} | `
      + `${(ms / 1000).toFixed(1)} s, ${result.attempts} tries | $${cost.toFixed(3)} |`);
  }

  console.log("\n| Model | Orientation | Panels | Dowels | Screws | Avg homeFrac error | Hole faces | snapLayout | Time | Cost |");
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  for (const row of rows) console.log(row);
  console.log("Gold: on-back, 11 panels, 22 dowels, 8 screws.");
}

main().catch(error => {
  console.error(`Parts run failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}`);
  process.exitCode = 1;
});

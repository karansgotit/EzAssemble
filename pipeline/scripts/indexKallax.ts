// KAR-06 check: runs all 24 KALLAX pages through indexPage (real AI calls, about 5 cents) and compares
// page types and step numbers with the gold page list. Crops every returned box so you can eyeball them.
// Needs the pages as images first (git-ignored):
//   pdftoppm -jpeg -jpegopt quality=85 -scale-to 1600 <kallax.pdf> manuals-src/kallax/pages/page
// Run from the repo root: npx tsx --conditions=react-server --env-file=.env.local pipeline/scripts/indexKallax.ts

import "server-only";

import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { SavedManual, type PageIndex } from "@/schema";
import { indexPage } from "../indexPage";
import { boxToPixelRect } from "@/client/crop";

const PAGES = "manuals-src/kallax/pages";
const CROPS = "manuals-src/kallax/index-crops";
const nn = (n: number) => String(n).padStart(2, "0");

const gold = SavedManual.parse(JSON.parse(readFileSync("fixtures/kallax.gold.json", "utf8")));
const stepsOf = (page: PageIndex) => page.steps.map(s => `${s.stepNumber}${s.variant ? `(${s.variant[0]})` : ""}`).join(" ");

async function cropBoxes(file: string, pageNumber: number, page: PageIndex) {
  const { width = 0, height = 0 } = await sharp(file).metadata();
  for (const { stepNumber, variant, box } of page.steps) {
    // Match the browser: 2% page padding preserves details near predicted edges.
    const { x: left, y: top, width: cropWidth, height: cropHeight } = boxToPixelRect(box, width, height);
    await sharp(file)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .toFile(`${CROPS}/p${nn(pageNumber)}-step-${nn(stepNumber)}${variant ? `-${variant}` : ""}.jpg`);
  }
}

async function main() {
  mkdirSync(CROPS, { recursive: true });
  const rows: string[] = [];
  const found = new Set<number>();
  let ms = 0, inputTokens = 0, outputTokens = 0, mismatches = 0;

  for (let pageNumber = 1; pageNumber <= 24; pageNumber++) {
    const file = `${PAGES}/page-${nn(pageNumber)}.jpg`;
    const result = await indexPage({ image: readFileSync(file).toString("base64"), pageNumber });
    for (const use of result.usage) { ms += use.ms; inputTokens += use.inputTokens; outputTokens += use.outputTokens; }
    const want = gold.pages[pageNumber - 1];
    if (!result.ok) {
      mismatches++;
      rows.push(`| ${pageNumber} | ${want.pageType} | failed: ${result.errors.join("; ")} | ${stepsOf(want)} | | ❌ |`);
      continue;
    }
    const got = result.data;
    for (const step of got.steps) if (step.variant !== "horizontal") found.add(step.stepNumber);
    const same = got.pageType === want.pageType && stepsOf(got) === stepsOf(want);
    if (!same) mismatches++;
    rows.push(`| ${pageNumber} | ${want.pageType} | ${got.pageType} | ${stepsOf(want)} | ${stepsOf(got)} | ${same ? "✅" : "❌"} |`);
    await cropBoxes(file, pageNumber, got);
  }

  console.log("\n| Page | Gold type | AI type | Gold steps | AI steps | Match |\n|---|---|---|---|---|---|");
  for (const row of rows) console.log(row);
  const missing = Array.from({ length: 19 }, (_, i) => i + 1).filter(n => !found.has(n));
  console.log(`\nVertical-branch steps found: ${found.size}/19${missing.length ? ` (missing ${missing.join(", ")})` : ""}`);
  console.log(`Pages differing from gold: ${mismatches}/24 · ${(ms / 1000).toFixed(1)} s · ${inputTokens} in / ${outputTokens} out tokens`);
  console.log(`Crops for a visual check: ${CROPS}/`);
}

main().catch(error => {
  console.error(`Index run failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}`);
  process.exitCode = 1;
});

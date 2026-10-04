// One-off (KAR-02): converts the prototype's hand-made KALLAX data into our gold fixtures.
// Run from anywhere: npx tsx fixtures/scripts/convertPrototype.ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { LibraryIndex, SavedManual, SceneManual, type Face, type PageIndex, type ScenePart, type Step, type Vec3, type WrongOrientation } from "../../schema";

type PrototypeTrap = { part: string; mustFace: Face; wrong: WrongOrientation; hint: string };
type PrototypeStep = Omit<Step, "orientationTrap"> & { orientationTrap?: PrototypeTrap };
type Prototype = { title: string; productSizeCm: Vec3; parts: ScenePart[]; steps: PrototypeStep[] };

const fromRepo = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));
const writeJson = (path: string, data: unknown) => writeFileSync(fromRepo(path), JSON.stringify(data, null, 2) + "\n");
const nn = (stepNumber: number) => String(stepNumber).padStart(2, "0");

const prototype = JSON.parse(readFileSync(fromRepo("reference/prototype/src/fixtures/kallax.json"), "utf8")) as Prototype;

// Corrections to the prototype, checked against the KALLAX drawings (KAR-04 review):
// the second end panel E2 is not in step 1's drawing; step 12's last two dowels go into divider D4
// (its end meets E2); step 14's inset swings E2 onto those dowels before the 6 screws.
// Step 15's stand-up flip stays: a deliberate transition so the 3D ends upright (vertical branch).
const CORRECTIONS: Record<number, Pick<PrototypeStep, "instruction" | "actions" | "confidence">> = {
  1: {
    instruction: "Lay the long panel on its edge on a soft surface. Screw the end panel onto its left end with 2 long screws, using the Allen key fitted into the handle tool.",
    actions: [
      { verb: "screw", part: "screw", count: 2, target: "E1", face: "left", for: "L1" },
      { verb: "attach", part: "E1", count: 1, target: "L1", face: "left" },
    ],
    confidence: "high",
  },
  12: {
    instruction: "Tap 8 dowels in: 2 into the front edge of each shelf and 2 into the end of the last divider piece.",
    actions: [
      { verb: "insert", part: "dowel", count: 2, target: "S1", face: "front", for: "L2" },
      { verb: "insert", part: "dowel", count: 2, target: "S2", face: "front", for: "L2" },
      { verb: "insert", part: "dowel", count: 2, target: "S3", face: "front", for: "L2" },
      { verb: "insert", part: "dowel", count: 2, target: "D4", face: "right", for: "E2" },
    ],
    confidence: "high",
  },
  14: {
    instruction: "Swing the second end panel onto the dowels, then fix the corners with the 6 remaining long screws, using the Allen key and handle tool.",
    actions: [
      { verb: "place", part: "E2", count: 1, target: "D4", face: "right" },
      { verb: "screw", part: "screw", count: 2, target: "E1", face: "left", for: "L2" },
      { verb: "screw", part: "screw", count: 2, target: "E2", face: "right", for: "L2" },
      { verb: "screw", part: "screw", count: 2, target: "E2", face: "right", for: "L1" },
    ],
    confidence: "high",
  },
};
const steps = prototype.steps.map(step => ({ ...step, ...CORRECTIONS[step.stepNumber] }));

const ID = "kallax";
const CREATED_AT = "2026-10-04T00:00:00Z";
const PRODUCT_SIZE_CM: Vec3 = [77, 147, 39];   // upright [width, height, depth]
const BUILD_SIZE_CM: Vec3 = [147, 39, 77];     // built lying on its back (CONTRACTS §4.1)

// ---- 1. Scene file: the prototype is already in cm, so mostly a straight copy ----
const scene = SceneManual.parse({
  id: ID,
  title: prototype.title,
  buildSizeCm: BUILD_SIZE_CM,
  buildOrientation: "on-back",
  parts: prototype.parts,
  steps: steps.map(({ orientationTrap, ...step }) => ({
    ...step,
    trap: orientationTrap && { ...orientationTrap, source: "manual", autoplay: true },
    crop: `/manuals/${ID}/crops/step-${nn(step.stepNumber)}.jpg`,
  })),
});
writeJson("fixtures/kallax.scene.json", scene);

// ---- 2. Gold file: what a perfect AI run would have saved ----
// Which steps start on which page, and how far down the page (0–1000), read from the KALLAX PDF.
// Pages 15–19 are the vertical build; 20–24 the horizontal variant (D-14: we only build vertical).
const STEP_STARTS: Record<number, [stepNumber: number, top: number][]> = {
  8: [[1, 83], [2, 649]], 9: [[3, 83], [4, 422], [5, 762]], 10: [[6, 83], [7, 535]], 11: [[8, 83], [9, 535]],
  12: [[10, 83], [11, 536]], 13: [[12, 83], [13, 535]], 14: [[14, 83]],
  15: [[15, 316]], 16: [[16, 537]], 17: [[17, 83]], 18: [[18, 83]], 19: [[19, 83]],
  20: [[15, 309]], 21: [[16, 538]], 22: [[17, 81]], 23: [[18, 83]], 24: [[19, 83]],
};
const pageType = (page: number): PageIndex["pageType"] =>
  page === 1 ? "cover" : page <= 5 ? "warning" : page === 6 ? "tools" : page === 7 ? "parts" : page >= 8 ? "steps" : "other";

const pages: PageIndex[] = Array.from({ length: 24 }, (_, i) => {
  const starts = STEP_STARTS[i + 1] ?? [];
  return {
    pageType: pageType(i + 1),
    steps: starts.map(([stepNumber, top], j) => ({
      stepNumber,
      box: [Math.max(30, top - 50), 20, j + 1 < starts.length ? starts[j + 1][1] - 60 : 950, 980],
      ...(i + 1 >= 15 && { variant: i + 1 >= 20 ? "horizontal" : "vertical" }),
    })),
  };
});

const fraction = (cm: Vec3): Vec3 => cm.map((n, i) => Math.round((n / BUILD_SIZE_CM[i]) * 10000) / 10000) as Vec3;

const gold = SavedManual.parse({
  schemaVersion: 1,
  id: ID,
  title: prototype.title,
  productSizeCm: PRODUCT_SIZE_CM,
  pages,
  layout: {
    buildOrientation: "on-back",
    parts: prototype.parts.map(({ sizeCm, homeCm, ...part }) => ({
      ...part,
      ...(sizeCm && { sizeFrac: fraction(sizeCm) }),
      ...(homeCm && { homeFrac: fraction(homeCm) }),
    })),
  },
  steps: steps.map(({ orientationTrap, ...step }) => ({
    status: "ok",
    step: { ...step, ...(orientationTrap && { orientationTrap: { ...orientationTrap, source: "manual" } }) },
    crop: `crops/step-${nn(step.stepNumber)}.jpg`,
    attempts: 1,
  })),
  createdAt: CREATED_AT,
});
writeJson("fixtures/kallax.gold.json", gold);

// ---- 3. Seed the app's library: manual.json, index.json, crops ----
mkdirSync(fromRepo(`public/manuals/${ID}/crops`), { recursive: true });
writeJson(`public/manuals/${ID}/manual.json`, gold);
writeJson("public/manuals/index.json", LibraryIndex.parse([
  { id: ID, title: gold.title, stepCount: gold.steps.length, thumbnail: "crops/step-01.jpg", createdAt: CREATED_AT },
]));

const crops = prototype.steps.map(({ stepNumber }) =>
  sharp(fromRepo(`assets/kallax-crops/step-${nn(stepNumber)}.png`))
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })   // long side ≤ 1600 px (CONTRACTS §5)
    .jpeg({ quality: 85 })
    .toFile(fromRepo(`public/manuals/${ID}/crops/step-${nn(stepNumber)}.jpg`)));

Promise.all(crops).then(() =>
  console.log(`Wrote ${scene.parts.length} parts, ${scene.steps.length} steps, ${pages.length} pages and ${crops.length} crops.`));
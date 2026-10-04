// KAR-03 smoke test: ONE real Gemini call (well under a cent) on KALLAX step 3, through callStructured.
// Run from the repo root: npx tsx --conditions=react-server --env-file=.env.local pipeline/scripts/smoke.ts

import "server-only";

import { readFileSync } from "node:fs";
import { z } from "zod";
import { StepBox } from "@/schema";
import { callStructured } from "../gemini";
import { loadPrompt } from "../prompts";

// Small on purpose, but it includes a 4-number box so we learn whether Gemini accepts tuple rules.
const SmokeAnswer = z.object({
  stepNumber: z.number().int().min(1),
  numberBox: StepBox,
  summary: z.string().max(200),
});

const image = readFileSync("public/manuals/kallax/crops/step-03.jpg").toString("base64");

callStructured({ prompt: loadPrompt("smoke"), images: [image], schema: SmokeAnswer, model: "fast" })
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  })
  .catch(error => {
    console.error(`Smoke test failed: ${error instanceof Error ? error.message.slice(0, 300) : "unknown error"}`);
    process.exitCode = 1;
  });

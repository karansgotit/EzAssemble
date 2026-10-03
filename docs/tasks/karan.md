# Karan: schemas, AI pipeline, prompts, routes, eval, gold fixtures

**You own:**
- `schema/**` (including `schema/checks.ts`), `pipeline/**`, `fixtures/**`, `pipeline/eval/**`;
- the AI routes: `app/api/index-page`, `app/api/parts`, `app/api/analyze-step`, `app/api/ask`.

**Read first:** `docs/CONTRACTS.md` (all of it), `docs/ARCHITECTURE.md` §4–7, `docs/DECISIONS.md`.

**How you'll know it's working:** `npm test` (schemas, checks, the retry wrapper with a fake model) and `npm run eval` (real AI vs gold).

---

### KAR-01 · Create `schema/` exactly as in CONTRACTS.md
**Labels:** contracts, P0 · **Hours:** 0:00–0:45 · **Depends on:** nothing (can start before SMI-01) · **Blocks:** almost everything

**Do**
- [ ] Create these files, copying the Zod code verbatim from `docs/CONTRACTS.md` §1–5:
  - `schema/common.ts`
  - `schema/ai/pageIndex.ts`, `schema/ai/partsLayout.ts`, `schema/ai/step.ts`
  - `schema/saved.ts`, `schema/scene.ts`, `schema/api.ts`
- [ ] Add the request schemas: `IndexPageRequest`, `PartsRequest`, `AnalyzeStepRequest`, `SaveManualRequest`, `AskRequest`.
- [ ] Add `schema/index.ts` re-exporting everything.
- [ ] Tests (`tests/schema.test.ts`):
  - one valid and one invalid example per schema (e.g. `box` out of range, unknown verb, `kind: "subassembly"` from AI rejected);
  - `SavedStep` accepts all 3 statuses.

**Acceptance criteria**
- [ ] `npm run typecheck && npm test` green.
- [ ] No field differs from CONTRACTS.md. A reviewer diffing them finds no drift.

---

### KAR-02 · Gold fixtures for KALLAX (stored + scene formats)
**Labels:** fixtures, P0 · **Hours:** 0:45–1:30 · **Depends on:** KAR-01 · **Blocks:** AJI-02/03, SMI-02/03/04

**Context:** `reference/prototype/src/fixtures/kallax.json` is correct, hand-made data in the old format (parts with `homeCm`/`sizeCm` in the build frame). We need it in the new formats.

**Do**
- [ ] Write a one-off script `fixtures/scripts/convertPrototype.ts` (run it with `tsx`) that produces:
  - `fixtures/kallax.scene.json`: a `SceneManual`, with near-direct field mapping. Steps `kind` assembly/info. Trap → `SceneTrap` with `source: "manual"`, `autoplay: true`. `crop: "/manuals/kallax/crops/step-NN.jpg"`. `buildOrientation: "on-back"`, `buildSizeCm: [147, 39, 77]`.
  - `fixtures/kallax.gold.json`: a `SavedManual`:
    - `productSizeCm: [77, 147, 39]`;
    - `layout.parts` with `sizeFrac = sizeCm / buildSizeCm` and `homeFrac = homeCm / buildSizeCm`;
    - steps wrapped as `{ status: "ok", step, crop: "crops/step-NN.jpg", attempts: 1 }`;
    - `pages` typed in by hand from SHR-02 notes (page types + approximate boxes are fine).
- [ ] Convert the 19 crops from `assets/kallax-crops/step-NN.png` into `public/manuals/kallax/crops/step-NN.jpg` (with `sharp` in the script), and write `public/manuals/kallax/manual.json` (= gold) plus `public/manuals/index.json`. This gives the library a working manual from hour 1.
- [ ] Test: both fixtures pass their schemas; gold passes the semantic checks once KAR-05 lands (mark that test `todo` until then).

**Acceptance criteria**
- [ ] Smit can load `/manuals/kallax/manual.json`; Ajit can load `fixtures/kallax.scene.json`.

---

### KAR-03 · Vertex AI client + `callStructured()` with validation, retries, usage logging
**Labels:** pipeline, P0 · **Hours:** 1:30–2:30 (Smit pairs for the first 30 min) · **Depends on:** KAR-01, SHR-01

**Do**
- [ ] `pipeline/config.ts`:
  - `MODELS = { fast: "<id>", strong: "<id>" }` (IDs from SHR-01);
  - `RETRIES = 2`, `TEMPERATURE = 0`;
  - `PRICES` (USD per 1M tokens, in/out) for cost estimates.
- [ ] `pipeline/vertex.ts`: create the `GoogleGenAI` client with `vertexai: true`, project, location, and credentials from `GOOGLE_SERVICE_ACCOUNT_JSON`. If env vars are missing, throw a clear error, which the routes turn into a `503`. **Verify the exact auth option names against the installed SDK version.**
- [ ] `pipeline/gemini.ts` `callStructured({ prompt, images, schema, semanticCheck, model })` → `ApiResult<T>`:
  - [ ] Calls the model with JSON output and the response schema from `z.toJSONSchema(schema)`. If the SDK rejects some schema features, strip them in a helper and **keep Zod as the final check**.
  - [ ] JSON parse → Zod `safeParse` → `semanticCheck`. On failure, re-prompt with "Your previous answer was rejected: …" plus the error list, at most 2 retries.
  - [ ] Records `usage` per attempt: model, input/output tokens from the response's usage metadata, and ms.
  - [ ] Logs one line per attempt to the server console.
- [ ] `pipeline/prompts.ts` `loadPrompt(name, vars)`: reads `pipeline/prompts/<name>.md` and fills `{{vars}}`; objects become pretty JSON.
- [ ] Every file starts with `import "server-only";`.
- [ ] Tests with a **fake model** (inject the generate function):
  - succeeds first time;
  - fails Zod then succeeds (assert the error text was included in prompt #2);
  - fails 3 times → `ok: false` with errors.

**Acceptance criteria**
- [ ] A real call from a tiny script (`pipeline/scripts/smoke.ts`) returns valid JSON for one crop.
- [ ] Unit tests green, with no network in tests.

---

### KAR-04 · SPIKE #1: analyze-step prompt v1 on KALLAX steps 2–5
**Labels:** spike, pipeline, P0 · **Hours:** 2:30–3:30 · **Depends on:** KAR-02, KAR-03

**Goal:** prove the riskiest assumption: that Gemini can fill our step form from a real IKEA crop.

**Do**
- [ ] Write `pipeline/prompts/analyze-step.md` v1, following `docs/ARCHITECTURE.md` §7. Include:
  - the verb meanings;
  - the face convention ("faces are in the build frame: top = up, front = toward the viewer");
  - the rule that orientation warnings come **only** from drawn details;
  - `info` for non-assembly steps.
- [ ] Script `pipeline/scripts/spike.ts`: for steps 2–5, send the crop + gold parts + gold placed parts + previous instructions; compare with gold (verb, part, target, count, face, `for`).
- [ ] Try both `fast` and `strong` models; record accuracy, latency and tokens.

**Acceptance criteria (report at H3 checkpoint)**
- [ ] A table: step × field correct/incorrect, for both models.
- [ ] **Decision rule:**
  - ≥ 60% field accuracy → continue.
  - Below that → spend up to 2 h on prompt fixes: few-shot example(s) from gold step 3, adding the previous step's crop, clearer face definitions.

---

### KAR-05 · Semantic checks (`schema/checks.ts`)
**Labels:** pipeline, P0 · **Hours:** 3:30–4:30 · **Depends on:** KAR-01

**Do**
- [ ] `checkPartsLayout(layout): string[]` and `checkStep(step, parts, placedPartIds): string[]`, implementing every rule in CONTRACTS.md §2.4, with messages written as plain sentences.
- [ ] `checkCumulativeCounts(steps, parts): { stepNumber, message }[]`, used by the orchestrator after all steps.
- [ ] Pure functions in `schema/checks.ts` (no `server-only`), so both the server routes and Smit's browser orchestrator can import them.
- [ ] Tests: one passing and one failing case per rule; gold KALLAX passes everything.

**Acceptance criteria**
- [ ] Every rule in §2.4 is covered by a test.

---

### KAR-06 · `/api/index-page` + index prompt
**Labels:** pipeline, route, P0 · **Hours:** 4:30–5:30 · **Depends on:** KAR-03, KAR-05

**Do**
- [ ] `pipeline/prompts/index-page.md`:
  - classify the page;
  - return a box per step **number region** (the number + its drawing);
  - `variant` for branching layouts;
  - `subassembly` label when the step builds a unit not yet attached to the main frame.
- [ ] `app/api/index-page/route.ts`: validate `IndexPageRequest` → `callStructured(PageIndex, model: fast)` → JSON. Set `runtime = "nodejs"` and `maxDuration = 60`; return a `503` when Vertex is unavailable.
- [ ] Script: run it on all 24 KALLAX pages; compare page types and step numbers with SHR-02 notes.

**Acceptance criteria**
- [ ] KALLAX: all 19 vertical-branch steps found with correct numbers. Crops made from the boxes contain the full step: check visually by cropping with `sharp` in the script.

---

### KAR-07 · `/api/parts` + parts-layout prompt
**Labels:** pipeline, route, P0 · **Hours:** 5:30–7:00 · **Depends on:** KAR-03, KAR-05

**Do**
- [ ] `pipeline/prompts/parts-layout.md`:
  - list every part (hardware numbers from the parts page);
  - invent stable snake_case ids for panels;
  - estimate `sizeFrac` / `homeFrac` in the **build frame** (explain the frames from CONTRACTS §4.1 in the prompt);
  - `features`: which face has drilled holes / finished edge;
  - `buildOrientation`;
  - sub-assembled units as one `other` box part.
  - If `previousErrors` is present, include them as "fix these problems".
- [ ] Route: `PartsRequest` → `callStructured(PartsLayout, model: strong, semanticCheck: checkPartsLayout)`.
- [ ] Script: compare the KALLAX result with gold: part count per kind, hardware counts, average `homeFrac` error, `features` faces.

**Acceptance criteria**
- [ ] KALLAX:
  - hardware counts correct (22 dowels, 8 screws);
  - all 11 panels present;
  - `buildOrientation: "on-back"`;
  - average `homeFrac` error reported. Ajit uses this number to tune `snapLayout`, so share it.

---

### KAR-08 · `/api/analyze-step` route + prompt v2
**Labels:** pipeline, route, P0 · **Hours:** 7:00–8:00 · **Depends on:** KAR-04, KAR-05

**Do**
- [ ] Route: `AnalyzeStepRequest` → `callStructured(Step, model: per KAR-04 decision, semanticCheck: s => checkStep(s, parts, placedPartIds))`.
- [ ] Prompt v2: fold in the KAR-04 learnings; ensure `info` steps (KALLAX 16–19) and manual warnings (KALLAX 1/13) behave.
- [ ] Test the route end to end from the browser with Smit (H8 checkpoint).

**Acceptance criteria**
- [ ] All 19 KALLAX steps return `ok: true` within ≤ 3 attempts each.
- [ ] Latency per step logged.

---

### KAR-09 · Evaluation runner (`npm run eval`)
**Labels:** eval, P0 · **Hours:** 8:00–10:00 · **Depends on:** KAR-06/07/08

**Do**
- [ ] `pipeline/eval/run-eval.ts <manualId>`: loads `fixtures/<id>.gold.json` + crops, runs call 3 per gold step (and optionally calls 1 and 2), and scores:
  - schema pass rate;
  - verb, part/target, count, face and `for` accuracy;
  - manual-warning recall/precision;
  - sub-assembly detection;
  - tokens and USD.
- [ ] `pipeline/eval/report.ts` → `eval/out/<id>.html`: per step, the crop, gold vs AI side by side, mismatches in red.
- [ ] Add the `"eval"` script to `package.json` (ask Smit, or add it in this PR and mention it).

**Acceptance criteria**
- [ ] `npm run eval -- kallax` runs in < 5 min and prints a summary table.

---

### KAR-10 · Gold fixtures for LACK and MALM
**Labels:** fixtures, P1 · **Hours:** 10:00–12:00 · **Depends on:** SHR-02, KAR-01

**Do**
- [ ] `fixtures/lack.gold.json` and `fixtures/malm.gold.json`: `SavedManual` with 5–8 representative steps each.
  - MALM must include its drawer-building steps as a `subassembly` step and a later `place drawer`.
  - Include crops.
- [ ] Both pass schemas and checks.

---

### KAR-11 · Prompt and model tuning to targets
**Labels:** pipeline, eval, P0 · **Hours:** 12:00–16:00 · **Depends on:** KAR-09

**Do**
- [ ] Loop: run eval on all 3 manuals → fix the biggest error class in the prompts → re-run. Log each iteration's numbers in `pipeline/eval/LOG.md`.
- [ ] Decide fast vs strong per call (D-20); update `config.ts`.
- [ ] Target: KALLAX verb+part ≥ 85%; LACK/MALM ≥ 70% animate correctly.

**Acceptance criteria**
- [ ] Final numbers recorded for the pitch (SHR-07).

---

### KAR-12 · Sub-assembly tagging on MALM
**Labels:** pipeline, P1 · **Hours:** within 12:00–16:00 · **Depends on:** KAR-06, KAR-10
- [ ] The index prompt reliably tags MALM drawer-building steps with the same `subassembly` label and doesn't tag frame steps.
- [ ] Measured in eval (sub-assembly detection).

---

### KAR-13 · (Stretch) `/api/ask`: Q&A about the current step
**Labels:** stretch, P2 · **Hours:** 16:00–18:00, only if everything P0 is done · **Depends on:** KAR-03
- [ ] `AskRequest` → `callStructured({ answer: string }, model: fast)`; short, friendly; says "I'm not sure, check the diagram" when it can't tell.
- [ ] Coordinate the UI with Smit (SMI-13).

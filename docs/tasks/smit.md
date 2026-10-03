# Smit: Next.js app, player UI, upload pipeline (browser), save, deploy

**You own:**
- `app/` pages, `app/layout.tsx`, `app/globals.css`, `app/api/save-manual`;
- `player/**`, `client/**`, `public/manuals/**`;
- the project config files (`package.json` etc.).

**Read first:** `docs/CONTRACTS.md` §3, §5–7; `docs/ARCHITECTURE.md` §5, §8, §13–16; `docs/CONVENTIONS.md`.

**You unblock everyone in the first 45 minutes (SMI-01).** Do that first, merge it, and tell the team.

**How you'll know it's working:** `npm test`; mock mode (`NEXT_PUBLIC_MOCK_AI=1`) for the full UI without AI; real mode once Karan's routes land.

---

### SMI-01 · Next.js skeleton + all dependencies (fresh, no prototype code)
**Labels:** setup, P0 · **Hours:** 0:00–0:45 · **Depends on:** SHR-04 · **Blocks:** everyone (they rebase onto it)

**Context:** the repo already has its folders, docs, `.gitignore` and `.env.example`. Add the Next.js app *into* this structure.
- `create-next-app` refuses non-empty folders. Generate it in a temp folder and move `package.json`, `next.config.*`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx` and `app/globals.css` in, **or** set those up by hand.
- Keep the existing folder `README.md`s.

**Do**
- [ ] Next.js (App Router, TypeScript strict, no Tailwind) at the repo root, using the existing `app/` folder.
- [ ] Install the **full dependency list** from `CONVENTIONS.md` §3, so nobody else touches `package.json`.
- [ ] **Scripts:** `dev`, `build`, `start`, `test` (vitest run), `typecheck` (tsc --noEmit), `eval` (`tsx pipeline/eval/run-eval.ts`).
- [ ] **Exclude `reference/`** from `tsconfig.json`, Vitest and the Next build (it's a separate Vite app; D-17).
- [ ] Vitest config: tests in `tests/**`, path alias `@/` = repo root, one trivial passing test so CI is green.
- [ ] Placeholder home page; empty dev page `app/dev/scene/page.tsx` that will render `<AssemblyScene>` once AJI-02 lands.
- [ ] Merge Next.js's default ignores into the existing `.gitignore` (keep ours).

**Acceptance criteria**
- [ ] `npm run typecheck && npm test && npm run build` green on `main`.
- [ ] Team notified to rebase.
---

### SMI-02 · Library page + manual loader
**Labels:** app, P0 · **Hours:** 0:45–2:00 · **Depends on:** SMI-01, KAR-02 (gold in `public/manuals/kallax/`) · **Reqs:** FR-01..03

**Do**
- [ ] `client/loadManual.ts`: fetch `/manuals/index.json` → `LibraryIndex.parse`; fetch `/manuals/<id>/manual.json` → `SavedManual.parse`. On failure, return a list of readable errors.
- [ ] `app/page.tsx`: manual cards (title, thumbnail, step count) plus an "Upload a manual" card.
- [ ] `app/m/[id]/page.tsx`: load → (until AJI-03 lands, use `fixtures/kallax.scene.json`) → `<StepPlayer>`. Invalid data → the red error screen.

---

### SMI-03 · Step player on `SceneManual`
**Labels:** player, P0 · **Hours:** 1:30–4:30 (build the UI shell first; plug in `<AssemblyScene>` when AJI-02 lands) · **Depends on:** SMI-01, AJI-02 for the 3D part · **Reqs:** FR-30..37, FR-54

**Do**
- [ ] Build the player fresh on `SceneManual` (the reference prototype shows the intended behaviour):
  - diagram panel;
  - parts tray;
  - instruction;
  - prev/next/dots;
  - play/pause/replay/speed/scrubber;
  - reset view;
  - keyboard ← → Space R.
- [ ] Layouts per step kind:
  - `assembly`: normal;
  - `info`: large diagram, no canvas;
  - `subassembly`: message card + Continue, no diagram;
  - `failed`: diagram + "Follow the original diagram for this step".
- [ ] Low-confidence banner when `confidence === "low"`.
- [ ] **Trap UI:**
  - autoplay `showTrap` the first time a step with `trap.autoplay` opens (track this in `seenTraps`);
  - otherwise, if the step has a trap, show a "Show possible mistake" (geometry) or "Show the mistake" (manual) button.
- [ ] After AJI-03: build the `SceneManual` via `buildSceneManual(saved, "/manuals/<id>/")`.

**Acceptance criteria**
- [ ] KALLAX 1–19 behaves like the reference prototype.
- [ ] Mock data with a failed step and a sub-assembly step renders correctly.

---

### SMI-04 · API client + mock
**Labels:** client, P0 · **Hours:** 4:00–5:00 · **Depends on:** KAR-01, KAR-02

**Do**
- [ ] `client/api.ts`: typed `fetch` wrappers for the 4 routes (CONTRACTS §5).
  - Retry once after 2 s on a network error or `5xx`; **don't** retry `ok: false`.
  - 60 s timeout (20 s for re-analyze, via a parameter).
- [ ] `client/api.mock.ts`: same interface, backed by gold fixtures.
  - `indexPage` returns gold `pages[n]`; `parts` returns gold `layout`; `analyzeStep` returns the gold step for `stepNumber`.
  - Adds a random 300–1500 ms delay.
  - A `?mockFail=7` query param makes step 7 return `ok: false` (to test fallbacks).
- [ ] `getApi()` picks the mock when `NEXT_PUBLIC_MOCK_AI === "1"`.

---

### SMI-05 · PDF rasterize + crop (browser)
**Labels:** client, P0 · **Hours:** 5:00–6:30 · **Depends on:** SMI-01 · **Reqs:** FR-10, FR-11, FR-15

**Do**
- [ ] `client/rasterize.ts`: pdf.js with the worker configured for Next.js. Each page renders to a canvas at long side ≤ 1600 px → JPEG base64 (quality 0.85, no `data:` prefix). Adapt the old repo's `lib/pdf-utils-client.ts` logic if useful.
- [ ] `client/crop.ts`: box (0–1000, `[ymin, xmin, ymax, xmax]`) → pixel rect with 2% padding, clamped to the page → JPEG base64; optional downscale (thumbs at 512 px). **Put the pure box→rect math in its own function with tests.**
- [ ] Errors: not a PDF, encrypted, zero pages → a readable message.

**Acceptance criteria**
- [ ] The KALLAX PDF → 24 images in < 10 s.
- [ ] Cropping with gold boxes gives sensible step images.
- [ ] The math tests are green.

---

### SMI-06 · `processManual()` orchestrator
**Labels:** client, P0 · **Hours:** 6:30–8:30 · **Depends on:** SMI-04, SMI-05, AJI-01 (snapLayout), KAR-05 (checks) · **Reqs:** FR-12..18

**Do** (ARCHITECTURE §5 has a sketch)
- [ ] Rasterize → index all pages (concurrency 4) → keep variant #1 of each step number → validate step numbers (report gaps).
- [ ] **Sub-assembly merge:** consecutive steps with the same `subassembly` label → one `SavedStep { status: "subassembly", sourceSteps, label, message }`, using the template from CONTRACTS §3. Those steps are not analysed.
- [ ] Crop the steps; make 512 px thumbs.
- [ ] `/api/parts` with the parts pages + cover + thumbs + size → `snapLayout` (product size mapped to the build frame). If not `ok`, re-call once with `previousErrors`.
- [ ] Analyse the remaining steps **in order**, passing `placedPartIds` (from previous ok steps' place/attach actions) and `previousInstructions`.
  - Emit a `manual` event after each step (streaming UI).
  - `ok: false` → a `failed` SavedStep.
- [ ] **Finish:**
  - `checkCumulativeCounts` + `checkConsistency` → set `confidence: "low"` on the offending steps;
  - fill `usage` totals and the estimated USD.
- [ ] Test with the mock API: KALLAX processes to a SavedManual equal to gold (in steps/actions); `mockFail` produces a failed step without breaking the run.

---

### SMI-07 · Upload page with streaming progress
**Labels:** app, P0 · **Hours:** 8:30–10:00 · **Depends on:** SMI-06 · **Reqs:** FR-10, FR-17, FR-20

**Do**
- [ ] `app/upload/page.tsx`:
  - drop zone / file picker;
  - title, id (slug auto-generated from the title) and W×H×D fields (pre-fill buttons for KALLAX / LACK / MALM sizes from SHR-02);
  - Start.
- [ ] Progress view:
  - the stage name;
  - "step N of M";
  - the running cost;
  - the step list filling in live.
- [ ] As soon as step 1 is ready, the user can open the player (`mode="processing"`) while the rest continues.
- [ ] Cancel button (aborts the remaining requests).

**Acceptance criteria (H8 checkpoint, real AI)**
- [ ] Upload KALLAX → the first step is playable in < 30 s; all steps finish.

---

### SMI-08 · "Re-analyze live" button
**Labels:** player, P0 · **Hours:** 10:00–11:00 · **Depends on:** SMI-04, KAR-08 · **Reqs:** FR-38

**Do**
- [ ] For the current step: fetch its crop → base64 → `analyzeStep` with the manual's parts, the placed parts before this step, and the previous instructions (20 s timeout).
- [ ] On `ok`: store it in `liveOverrides`, rebuild the scene manual with the override, and replay. Show a badge: "Live result · N attempts · X.X s".
- [ ] On failure or timeout: toast "Live analysis unavailable"; keep the current result.

---

### SMI-09 · Save to library (dev only)
**Labels:** app, P0 · **Hours:** 11:00–12:00 · **Depends on:** SMI-06 · **Reqs:** FR-19

**Do**
- [ ] `app/api/save-manual/route.ts`:
  - `404` unless `NODE_ENV === "development"`;
  - validate `SaveManualRequest`;
  - write `public/manuals/<id>/manual.json` and `crops/step-NN.jpg`;
  - upsert `public/manuals/index.json`.
- [ ] A "Save to library" button on the processing view, shown in dev only.

**Acceptance criteria**
- [ ] After saving and reloading, the manual opens from the library with zero AI calls.

---

### SMI-10 · Deploy to Vercel
**Labels:** deploy, P0 · **Hours:** 12:00–13:30 · **Depends on:** KAR-06/07/08
- [ ] Import the repo; set the env vars (CONVENTIONS §6); confirm the AI routes work in production (Vertex credentials parse correctly from the env var).
- [ ] Check the function timeout for the plan (we set `maxDuration = 60`); if the plan limits it lower, tell Karan (consider the fast model for live calls).
- [ ] Confirm **no credentials in the client bundle**: search the build output for the project id / key fragments.
- [ ] Write the "run locally offline" steps in the README (backup plan).

---

### SMI-11 · Apply the Claude Design design
**Labels:** design, P1 · **Hours:** 13:30–16:00 · **Depends on:** SHR-03
- [ ] Put the tokens in `app/globals.css`; restyle the library, upload, player and all states to match the designs.
- [ ] Coordinate with Ajit so the 3D colours read the same tokens (AJI-11).

---

### SMI-12 · States, polish, accessibility
**Labels:** app, P1 · **Hours:** 16:00–18:00
- [ ] Loading skeletons; every error state from ARCHITECTURE §15 has a designed message.
- [ ] Keyboard focus visible; contrast ≥ 4.5:1; buttons have labels.
- [ ] The demo path has no console errors.

---

### SMI-13 · (Stretch) Q&A panel
**Labels:** stretch, P2 · **Hours:** 18:00–19:00, only if all P0 is done · **Depends on:** KAR-13
- [ ] A small "Ask about this step" input under the instruction; the answer appears below; errors → "Couldn't answer right now".

# CONVENTIONS: how we work in one repo with three Claude Code sessions

## 1. Ownership (who may edit what)

| Path | Owner | Others may… |
|---|---|---|
| `schema/**` | **Karan** | read only; request changes via a `CONTRACT:` PR (§4) |
| `pipeline/**`, `app/api/index-page`, `app/api/parts`, `app/api/analyze-step`, `app/api/ask` | **Karan** | read only |
| `fixtures/**`, `pipeline/eval/**` | **Karan** | read only |
| `scene/**` | **Ajit** | read only |
| `app/` pages (`page.tsx`, `upload/`, `m/`), `app/layout.tsx`, `app/globals.css` | **Smit** | read only |
| `player/**`, `client/**`, `app/api/save-manual` | **Smit** | read only |
| `public/manuals/**` | **Smit** (via Save to library) | Karan may fix data by hand during review |
| `scripts/**` | **Smit** | read only |
| `package.json`, `next.config.*`, `tsconfig.json`, `vitest.config.*` | **Smit** | ask Smit; never add a dependency without a team OK |
| `docs/**`, `CLAUDE.md` | whole team | edit via PR, tell the team |
| `reference/**` | nobody | read only; never import from it (D-17) |
| `assets/**` | Karan | read only (source images for fixtures) |

**If your task needs a change in someone else's folder,** open an issue or message them. Don't edit it yourself. Exception: a one-line import-path fix after a merge is fine; mention it in the PR.

## 2. Git workflow

- `main` must always build and pass tests.
- **Branch per task:** `<name>/<TASK-ID>-short-slug`, e.g. `karan/KAR-03-call-structured`.
- **Small PRs** (ideally < 300 lines). Merge as soon as a task is done.
- **Before pushing:**
  ```bash
  npm run typecheck && npm test && npm run build
  ```
- **Merging:** the author may self-merge once checks pass. For contract changes, also follow §4.
- **Stay current:** pull/rebase from `main` at least every hour and before starting a new task:
  ```bash
  git pull --rebase origin main
  ```
- **Commit messages:** `KAR-03: add callStructured with retries`, prefixed with the task ID.
- **PR description:** what changed, how it was tested, which requirement IDs (FR-xx) it covers. End with `Closes <TASK-ID>`.
- **Never commit:** `.env.local`, service-account JSON, `node_modules`, `.next`, or large PDFs. IKEA PDFs go in `manuals-src/`, which is git-ignored; share them in team chat.

## 3. Dependencies (complete list; added once by SMI-01)

**Runtime:**
- `next`, `react@19`, `react-dom@19`
- `three`, `@react-three/fiber@9`, `@react-three/drei@10`
- `zod@4`, `@google/genai`, `pdfjs-dist`, `server-only`

**Dev:**
- `typescript`, `@types/react`, `@types/react-dom`, `@types/three`, `@types/node`
- `vitest`, `tsx`, `sharp`

`tsx` runs eval scripts. `sharp` is used only by eval/scripts, never in the app.

Use versions compatible with React 19.2 (the reference prototype used R3F 9.4 / drei 10.7 / three 0.180 / zod 4.1, a known-good combination). **Adding anything else needs a team OK in chat.**

## 4. Changing a contract (`docs/CONTRACTS.md` / `schema/`)

1. Only Karan merges changes to `schema/`.
2. Open a PR titled `CONTRACT: <what>` that updates **both** `docs/CONTRACTS.md` and `schema/`, plus fixtures/tests if affected.
3. Post in team chat: what changed and who's affected.
4. Prefer **additive** changes (new optional fields). Renames and removals need everyone's OK.

## 5. Code conventions

- TypeScript `strict`, no `any` (use `unknown` + Zod). Named exports. Files ≤ ~250 lines.
- **Pure logic is separate from components:** `scene/*.ts` (not `.tsx`), `schema/checks.ts`, `client/crop.ts` math. Pure functions get Vitest tests.
- **Server-only code:** every file in `pipeline/` starts with `import "server-only";`. The browser never imports `pipeline/`.
- **Client components:** start with `"use client"`. The R3F `<Canvas>` is loaded via `next/dynamic(() => import(...), { ssr: false })`.
- **pdf.js in Next.js:** set `GlobalWorkerOptions.workerSrc` to the worker file shipped with `pdfjs-dist`. Verify the exact import path for the installed version.
- **Errors:** AI and route failures never throw into React. Use `ApiResult` objects; the UI renders a fallback.
- **Validation at boundaries:** routes validate requests with Zod; the browser validates loaded JSON with Zod.
- **Prompts** live in `pipeline/prompts/*.md` with `{{placeholders}}`; no prompt text inside `.ts` files.
- **Styling:** plain CSS + CSS variables (design tokens from Claude Design in `app/globals.css`). `scene/constants.ts` reads colours from the same tokens.
- **Names:** components `PascalCase.tsx`, logic `camelCase.ts`, part ids `snake_case`.

## 6. Environment variables

| Name | Where | Purpose |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` | server | Project with the credits |
| `GOOGLE_CLOUD_LOCATION` | server | e.g. `global` (preview models) or a region |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | server | Service-account key (Vertex AI User role), one line |
| `NEXT_PUBLIC_MOCK_AI` | browser | `1` → `getApi()` returns `client/api.mock.ts` (saved KALLAX answers, no AI calls). Read at build time, so restart or rebuild after changing it |

`.env.example` (committed) lists these names with empty values; real values go in `.env.local` and in Vercel's settings.

## 7. Testing

| Command | What |
|---|---|
| `npm test` | Vitest: schema/fixture validity, checks, snapLayout, resolveScene, tracks, traps, crop math, orchestrator with mock API |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Next.js production build |
| `npm run check:vertex` | One real Gemini call to confirm the credentials in `.env.local` work; lists the available model ids (a fraction of a cent) |
| `npm run eval -- kallax` | Runs real AI calls on a manual's crops, scores vs gold, writes `eval/out/kallax.html` (costs money: ~$0.5–1.2 per run) |

**Mock mode** (`NEXT_PUBLIC_MOCK_AI=1`) lets Smit and Ajit build the full UI and 3D without credentials or cost.

## 8. Integration checkpoints (everyone stops and syncs, ~10 min)

| Hour | Checkpoint | Proof |
|---|---|---|
| H3 | Spikes done; Next app plays gold KALLAX | Demo on Smit's machine; Karan's 4-step accuracy; Ajit's noisy-layout test green |
| H8 | KALLAX processed end to end by real AI, playing in the player | Upload → steps stream → plays |
| H12 | 3 manuals processed; eval numbers | `eval.html` for each |
| H16 | Deployed; live re-analyze; design applied | Public URL works |
| H19 | **Feature freeze**; saved library regenerated from final code | Demo rehearsal #1 |

## 9. Rules for Claude Code sessions

- Read `CLAUDE.md`, then `docs/README.md`, then **your own task file** in `docs/tasks/`.
- Work on **one task ID at a time**, on its own branch; tick its checkboxes in the PR description.
- Stay inside your owned paths (§1). If you need something from another area, write it down as a question for your human.
- **Never change a contract silently.** Never weaken validation to make a test pass.
- **Don't re-open decisions** in `docs/DECISIONS.md`.
- Run `npm run typecheck && npm test` before saying a task is done. Report anything that didn't pass, honestly.

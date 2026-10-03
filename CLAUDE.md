# CLAUDE.md: EzAssemble (StormHacks 2026)

You are one of **three Claude Code sessions** working in parallel on this repo, each driven by a different teammate. Shared context lives in `docs/`. Read it before writing code.

## What we're building (one paragraph)

A web app that takes an **IKEA assembly manual PDF** and turns each step into:
- the original diagram;
- a plain-English instruction;
- a short interactive 3D animation of which piece moves where;
- where there's evidence, a "wrong vs right" ghost.

**Gemini (via Vertex AI) only fills in strict JSON forms.** Our own code validates them, computes all geometry and animation, and renders with three.js / React Three Fiber in a Next.js app. For the demo, processed manuals are saved as static files; live re-analyze and live upload prove the AI is real.

## Before you start any work

1. Read `docs/README.md` and follow its reading order. At minimum read `docs/DECISIONS.md`, `docs/CONTRACTS.md` and `docs/CONVENTIONS.md`.
2. Ask your human **which person they are** (Karan, Ajit or Smit) and which task ID to work on, then open `docs/tasks/<name>.md` and find that task.
3. Work on **one task ID at a time**, on branch `<name>/<TASK-ID>-slug`.

## Hard rules

- **Stay in your owned paths** (`docs/CONVENTIONS.md` §1). Need something elsewhere? Tell your human; don't edit it.
- **Contracts are sacred.** Shapes in `docs/CONTRACTS.md` / `schema/` change only via a `CONTRACT:` PR by Karan. Never change one silently, and never weaken validation to make something pass.
- **Don't re-open decisions** in `docs/DECISIONS.md`. Examples:
  - IKEA only;
  - the AI fills forms and never writes code or per-step coordinates;
  - Vertex AI;
  - sub-assemblies collapse to one "assembled separately" step;
  - wrong-vs-right only with evidence.
- **Every Gemini call goes through `pipeline/gemini.ts` `callStructured`** (schema → Zod → semantic checks → ≤ 2 retries).
- **`pipeline/` is server-only** (`import "server-only"`). Credentials never reach the browser.
- **The scene never fetches and never throws on bad data.** Pure logic goes in `scene/*.ts` with tests; `.tsx` files only render.
- **`reference/prototype/` is reference only.** Read it to understand look and behaviour; never copy, move or import its code (D-17).
- **No new dependencies** beyond `docs/CONVENTIONS.md` §3 without a team OK.
- **Don't commit** `.env.local`, credentials, PDFs, `.next`, or `node_modules`.

## Commands

```bash
npm run dev
```
```bash
npm run typecheck && npm test && npm run build
```
```bash
npm run eval -- kallax
```
- `npm run dev` runs the app at localhost:3000. Use `NEXT_PUBLIC_MOCK_AI=1` for no-AI mode.
- The second line must be green before you push or claim a task is done.
- `npm run eval` makes real AI calls and costs money. Ask your human first.

## Definition of done for any task

- Every checkbox in the task's "Do" and "Acceptance criteria" is met. Say explicitly which ones aren't.
- Typecheck, tests and build are green.
- A PR titled `<TASK-ID>: <summary>` that lists how it was tested and the FR-xx IDs covered.
- Report results honestly: if something didn't work or was skipped, say so.

## Where things are

| Path | What | Owner |
|---|---|---|
| `schema/` | Zod contracts + shared semantic checks | Karan |
| `pipeline/` | Vertex client, `callStructured`, prompts (`prompts/*.md`), eval | Karan |
| `app/api/{index-page,parts,analyze-step,ask}` | AI routes | Karan |
| `fixtures/` | gold data | Karan |
| `scene/` | snapLayout, buildSceneManual, resolveScene, tracks, traps, R3F components | Ajit |
| `app/` pages, `player/`, `client/`, `app/api/save-manual`, config files | UI, browser pipeline, deploy | Smit |
| `public/manuals/` | saved manuals for the demo | Smit |
| `docs/` | all shared context | team |

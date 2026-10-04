# EzAssemble

**Turn a confusing furniture assembly manual into clear, animated 3D steps.**

Flat-pack furniture manuals often have no words. Each step is a line drawing with arrows and tiny zoomed-in details, and it is easy to use the wrong piece or put a panel in the wrong way round. EzAssemble takes the manual PDF and, for every step, shows:

- the original diagram from the manual;
- one plain-English sentence saying what to do;
- a 3D animation of which piece moves where, which you can rotate and replay;
- where the manual gives evidence for it, the likely mistake: a red ghost in the wrong orientation that turns into the right one.

Built in 24 hours at **StormHacks 2026** by Ajitsingh Chauhan, Smit Sanghvi and Karan Passi.

## How it works

Gemini only fills in strict forms. It never writes code or 3D coordinates. Our own code checks every answer and builds all the geometry and animation.

1. **Read the PDF in the browser.** Each page is turned into an image with pdf.js.
2. **Index the pages.** Gemini says what is on each page: steps, the parts list, or something else, and where each step's drawing sits so we can cut it out.
3. **Read the parts.** Gemini lists the panels and hardware, where each panel sits in the finished piece, and which way up the furniture is built.
4. **Read each step.** Gemini fills one form per step: the instruction, which part goes onto which, how many, and on which face. Steps go in order, each told what is already built, and appear on screen as they finish.
5. **Check, then build.** Every answer is validated against a Zod schema and a set of rules (e.g. a part can't be attached to something that isn't placed yet). A bad answer is retried, at most twice. Then the scene code turns the forms into a 3D layout and animation tracks.

All AI calls go through Vertex AI using Gemini 3.8 Flash, from server-only code, so the credentials never reach the browser. Each step costs a fraction of a cent.

## What works

- **Library.** A saved, pre-processed KALLAX 2×4 shelf (19 steps) opens instantly, with no AI calls.
- **Upload.** Drop in an assembly manual PDF and watch the steps appear. You can cancel part way. In development, a finished manual can be saved into the library.
- **Step player.** Diagram, instruction and 3D scene side by side; arrow keys move between steps; a "show the mistake" replay where there is one; a warning on steps the AI was unsure about; and a single "assembled separately" card for sub-assemblies.
- **Light and dark themes.**
- **Accuracy eval.** `npm run eval -- kallax` scores the AI against a hand-checked "gold" copy of the KALLAX manual (`fixtures/kallax.gold.json`).
## Tech stack

Next.js 16 (App Router) · React 19 · three.js with React Three Fiber and drei · Zod 4 · pdf.js · Google Gen AI SDK on Vertex AI (Gemini) · Vitest · Vercel

## Running it locally

```bash
npm install
```
```bash
cp .env.example .env.local
```

Fill in the three Google Cloud values in `.env.local`. To run without any AI calls instead, set `NEXT_PUBLIC_MOCK_AI=1`; uploads then answer with the saved KALLAX data.

```bash
npm run dev
```

Open http://localhost:3000.

Other commands:

| Command | What it does |
|---|---|
| `npm run typecheck && npm test && npm run build` | Type check, unit tests, production build |
| `npm run check:vertex` | One small real AI call to confirm your Google Cloud credentials work |
| `npm run eval -- kallax` | Score the AI against the gold KALLAX manual (real, billed AI calls) |


## Repository layout

| Path | What | Owner |
|---|---|---|
| `app/` | Next.js pages (library, upload, player) and API routes | Smit (pages) · Karan (AI routes) |
| `app/api/` | `index-page`, `parts`, `analyze-step` (AI); `health`, `save-manual` (dev only) | Karan · Smit |
| `schema/` | Zod data contracts and the shared rule checks | Karan |
| `pipeline/` | Vertex AI client, `callStructured`, prompts, eval | Karan |
| `client/` | In-browser PDF reading and cropping, API client and mock, upload orchestrator | Smit |
| `scene/` | 3D engine: layout, scene building, animation, wrong-vs-right ghosts | Ajit |
| `player/` | Step player UI | Smit |
| `fixtures/` | Hand-checked gold KALLAX manual for tests and eval | Karan |
| `public/manuals/` | Saved, pre-processed manuals shown in the library | Smit |
| `tests/` | Vitest tests | everyone |
| `reference/prototype/` | Early visual prototype, reference only | — |
| `docs/` | PRD, decisions, data contracts, architecture, conventions, tasks | everyone |

Start with [`docs/README.md`](docs/README.md) for the project docs in reading order.

## Deploying to Vercel

1. Import the GitHub repository into Vercel. The defaults are right (framework Next.js, root directory the repo root).
2. Under **Settings → Environment Variables**, add:
   - `GOOGLE_CLOUD_PROJECT`
   - `GOOGLE_CLOUD_LOCATION` (`global`)
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: the key as one line, pasted as is, with no quotes around it
3. Deploy, then open `/api/health`. `{"ok":true,...}` means the server can read the credentials; anything else names the setting to fix. It makes no AI call and shows no values.
4. The AI routes need up to 60 seconds each (`maxDuration = 60`), so check your plan's function time limit.

On the deployed site, the `/dev/*` pages and `/api/save-manual` answer "not found" on purpose. To run the deployed site without AI calls, set `NEXT_PUBLIC_MOCK_AI=1` and redeploy.

## Demo with no internet (backup plan)

The library and the full KALLAX walkthrough are served from files in this repo, so they work with Wi-Fi off. Run the first two commands while you still have a connection.

```bash
npm install
```
```bash
npm run build
```
```bash
npm start
```

Then open http://localhost:3000. Uploading a new manual needs Gemini, so it does not work offline unless `NEXT_PUBLIC_MOCK_AI=1` was set in `.env.local` before the build; uploads then use the saved KALLAX answers.

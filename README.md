# EzAssemble

**Turn a confusing IKEA assembly manual into clear, animated 3D steps.**

Upload an IKEA manual PDF. For each step, EzAssemble shows the original diagram, a plain-English instruction, and a short interactive 3D animation of which piece moves where. Where there's evidence, it also shows a "wrong vs right" ghost of the likely mistake. Gemini (via Vertex AI) reads the diagrams and fills in strict forms; our own code validates them and generates all the geometry and animation.

Built at **StormHacks 2026** by Ajitsingh Chauhan, Smit Sanghvi and Karan Passi.

## Status

🚧 **In progress.** Working today: the manual library, the step player with the 3D scene on KALLAX, PDF rasterizing and cropping, the API client with a mock, and the upload page with live progress (so far run only against the mock). Any saved manual opens from the library, and in development an uploaded manual can be saved into it. Not built yet: the AI routes and re-analyze. Tasks are in [`docs/tasks/`](docs/tasks/README.md).

## Start here

1. Read [`docs/README.md`](docs/README.md) (reading order for all project docs).
2. Find your task file: [`karan.md`](docs/tasks/karan.md) · [`ajit.md`](docs/tasks/ajit.md) · [`smit.md`](docs/tasks/smit.md) · [`shared.md`](docs/tasks/shared.md).
3. Using Claude Code? It loads [`CLAUDE.md`](CLAUDE.md) automatically.

## Repository layout

| Path | What | Owner |
|---|---|---|
| `app/` | Next.js pages + API routes | Smit (pages, save-manual) · Karan (AI routes) |
| `schema/` | Zod contracts + shared semantic checks | Karan |
| `pipeline/` | Vertex AI client, `callStructured`, prompts, eval | Karan |
| `client/` | Browser-side PDF rasterize, crop, API client, upload orchestrator | Smit |
| `scene/` | 3D: layout snapping, scene resolution, animation, wrong-vs-right | Ajit |
| `player/` | Step player UI | Smit |
| `fixtures/` | Gold (hand-checked) manuals for tests and eval | Karan |
| `public/manuals/` | Saved, pre-processed manuals for the demo | Smit |
| `fake-data/` | Stand-in data and the fake-data on/off switch for development | Smit |
| `scripts/` | One-off checks (`check-vertex.ts`) | Smit |
| `tests/` | Vitest tests | each owner |
| `assets/` | Source images (KALLAX step crops) | Karan |
| `reference/prototype/` | Visual prototype, **reference only, never import** | — |
| `docs/` | PRD, contracts, architecture, decisions, conventions, tasks | team |

## Getting started

```bash
npm install
```
```bash
cp .env.example .env.local
```
Fill in the Google Cloud values in `.env.local` (see `docs/CONVENTIONS.md` §6), or set `NEXT_PUBLIC_MOCK_AI=1` to work without AI.

```bash
npm run dev
```
```bash
npm run typecheck && npm test && npm run build
```

To confirm your Google Cloud credentials work (one small real AI call):

```bash
npm run check:vertex
```

In development, the **Fake data** badge in the top-right corner switches between the mock and the real API without a restart.

IKEA manual PDFs go in `manuals-src/` (git-ignored; shared in team chat).

## Deploying to Vercel

1. In Vercel, import the GitHub repository. The defaults are right: framework Next.js, root directory the repo root.
2. Under **Settings → Environment Variables**, add the same three values as in `.env.local`:
   - `GOOGLE_CLOUD_PROJECT`
   - `GOOGLE_CLOUD_LOCATION` (`global`)
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: the key as one line, pasted as is, with no quotes around it
3. Deploy, then open `/api/health` on the deployed site. `{"ok":true,...}` means the server can read the credentials; anything else names the setting to fix. It makes no AI call and shows no values.
4. Check the plan's function time limit against the routes' `maxDuration = 60`.

On the deployed site the `/dev/*` pages and `/api/save-manual` answer "not found" by design, and the Fake data badge is not shown. To run the deployed site without AI calls, set `NEXT_PUBLIC_MOCK_AI=1` there and redeploy.

## Running the demo with no internet (backup plan)

Everything on the demo path (library → KALLAX → every step) is served from files in this repo, so it works with Wi-Fi off. Do steps 1 and 2 while you still have a connection.

1. ```bash
   npm install
   ```
2. ```bash
   npm run build
   ```
3. ```bash
   npm start
   ```
4. Open http://localhost:3000.

What does not work offline: uploading a manual and "Re-analyze live", since both call Gemini. With `NEXT_PUBLIC_MOCK_AI=1` in `.env.local` before step 2, uploads run on saved KALLAX answers instead.

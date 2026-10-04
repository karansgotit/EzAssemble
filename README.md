# EzAssemble

**Turn a confusing IKEA assembly manual into clear, animated 3D steps.**

Upload an IKEA manual PDF. For each step, EzAssemble shows the original diagram, a plain-English instruction, and a short interactive 3D animation of which piece moves where. Where there's evidence, it also shows a "wrong vs right" ghost of the likely mistake. Gemini (via Vertex AI) reads the diagrams and fills in strict forms; our own code validates them and generates all the geometry and animation.

Built at **StormHacks 2026** by Ajitsingh Chauhan, Smit Sanghvi and Karan Passi.

## Status

🚧 **In progress.** Working today: the manual library, the step player with the 3D scene on KALLAX, PDF rasterizing and cropping, the API client with a mock, and the upload page with live progress (so far run only against the mock). Not built yet: the AI routes, re-analyze, save to library. Tasks are in [`docs/tasks/`](docs/tasks/README.md).

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

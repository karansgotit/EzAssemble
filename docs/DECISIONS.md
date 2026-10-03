# DECISIONS: what's settled (don't re-open without the team)

Claude Code sessions: treat these as fixed. If a task seems to conflict with one, stop and ask your human. Don't work around it.

| # | Decision | Why |
|---|---|---|
| D-01 | **Scope: IKEA assembly manuals only.** Tested on KALLAX 2×4 (hero), LACK, MALM. | Consistent drawing style makes the pipeline reliable in 24 h |
| D-02 | **The AI fills in forms; our code does geometry and animation.** No AI-generated code, no per-step coordinates from AI. | Validatable, deterministic, can't crash the app |
| D-03 | Fixed vocabulary: 6 verbs (`insert attach screw lock place flip`), 6 faces. | Small, checkable output |
| D-04 | Hardware positions are computed from the target face + the `for` part. | Positions are what AI is worst at |
| D-05 | Panel layout: the AI gives rough fractions once per manual; `snapLayout` makes it exact. | Needed for any manual; the prototype hand-typed it |
| D-06 | Three AI calls only: index page, parts & layout, analyze step (+ Q&A stretch). | Cost, simplicity |
| D-07 | **Gemini via Vertex AI** (Google Cloud credits, $300 CAD), `@google/genai` with `vertexai: true`. | That's where the credits are |
| D-08 | Every AI call goes through `callStructured`: JSON schema → Zod → semantic checks → ≤ 2 retries with errors fed back. | Reliability |
| D-09 | Store **raw AI output**; recompute geometry on load. | Geometry fixes improve saved manuals with no new AI calls |
| D-10 | **Demo uses saved results** (`public/manuals/`), plus live re-analyze and live streaming upload as proof. | The demo is ~3 min; a manual takes ~2–3 min to process; network risk |
| D-11 | One code path: saved manuals are produced by the normal upload flow + a dev-only "Save to library". | No separate script to maintain |
| D-12 | **Sub-assemblies are not built.** Their steps collapse into one "assembled separately" card (template text, no AI, no diagram, no 3D); the finished unit then appears as one box. | Different manual, different pipeline |
| D-13 | **Wrong-vs-right is kept**, only with evidence: (a) the manual draws it (call 3, `source: "manual"`), or (b) geometry proves it's possible (plain panel, holes on one face, must face the joined part). No evidence → no ghost. Labels: "From the manual" / "Possible mistake". | Honest, explainable differentiator |
| D-14 | Branching steps (e.g. KALLAX 15–19 vertical/horizontal): keep the first variant only (MVP). | Simplicity |
| D-15 | Stack: Next.js (App Router) + React 19 + TypeScript strict + three.js + R3F + drei + Zod v4 + pdf.js + Vitest, deployed on Vercel. Nothing else without team agreement. | Team skills, minimal dependencies |
| D-16 | No database, no auth, no queues, no global state library, no CSS framework, no animation library. | Hackathon scope; the prototype proved these aren't needed |
| D-17 | **Everything is written fresh** in this repo during the hackathon. `reference/prototype/` (the Vite visual prototype) is **reference only**: look at it for look, behaviour and algorithms, but never copy, move or import its files. Its *data* (the hand-made KALLAX fixture) may be converted into gold fixtures. | Clean codebase built against the new contracts; the prototype still shows what "good" looks like |
| D-18 | Ownership: Karan = `schema/`, `pipeline/`, AI routes, fixtures, eval · Ajit = `scene/` · Smit = `app/` pages, `player/`, `client/`, save-manual route, deploy. | Parallel work without conflicts |
| D-19 | Image format to the API: base64 JPEG, long side ≤ 1600 px (thumbnails 512 px). | Under Vercel's request size limit, enough detail |
| D-20 | Model choice decided by eval: start with Flash for everything; switch parts/steps to Pro only if accuracy needs it. Model IDs are pinned in `pipeline/config.ts`. | Cost/latency vs accuracy, decided by data |

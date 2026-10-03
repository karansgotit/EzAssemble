# pipeline/: server-only AI code

**Owner:** Karan

`vertex.ts` (Vertex AI client), `gemini.ts` (`callStructured`), `prompts.ts`, `config.ts` (pinned model IDs, prices).
Every file starts with `import "server-only";`. See `docs/ARCHITECTURE.md` §6–7, tasks KAR-03..KAR-13.

# pipeline/: server-only AI code

**Owner:** Karan

`vertex.ts` (Vertex AI client), `gemini.ts` (`callStructured`), `prompts.ts`, `config.ts` (pinned model IDs, prices).
Every file starts with `import "server-only";`. See `docs/ARCHITECTURE.md` §6–7, tasks KAR-03..KAR-13.

To debug parts extraction, temporarily set the server environment variable `DEBUG_AI_PARTS=1`
(on Vercel, redeploy after setting it). Search server/function logs for `[ai:parts:`.
Each request has a correlation ID, rejected model answers with validation errors, and its final
result including accepted data, attempts and usage. Rejected answers are capped at 16,000 characters
and marked when truncated. Transport failures have a safe marker; the route log supplies the status.
Prompts, input images and raw SDK errors are not logged. Model output can contain manual content:
disable this flag after debugging and keep these logs private. Nothing is added to browser responses.

# app/api/: server routes

**Owner:** Karan (`index-page`, `parts`, `analyze-step`, `ask`) · Smit (`save-manual`)

Thin routes: validate the request with Zod, then call `pipeline/`, then return `ApiResult`. Exact contracts: `docs/CONTRACTS.md` §5.
Every route: `export const runtime = "nodejs"; export const maxDuration = 60;`

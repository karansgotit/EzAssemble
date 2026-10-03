# Docs index: read in this order

| # | File | What it gives you | Who must read it |
|---|---|---|---|
| 1 | [`PRD.md`](PRD.md) | What we're building, for whom, the demo, success metrics | everyone |
| 2 | [`DECISIONS.md`](DECISIONS.md) | Everything already settled. Don't re-open. | everyone |
| 3 | [`CONTRACTS.md`](CONTRACTS.md) | Exact data shapes, API endpoints, component props: the glue between the three of us | everyone (fully) |
| 4 | [`CONVENTIONS.md`](CONVENTIONS.md) | Folder ownership, git workflow, code rules, env vars, testing, checkpoints | everyone |
| 5 | [`ARCHITECTURE.md`](ARCHITECTURE.md) | How it all works end to end, with KALLAX examples and code sketches | everyone; deep-read your sections |
| 6 | [`REQUIREMENTS.md`](REQUIREMENTS.md) | Numbered requirements (FR-xx / NFR-xx) with acceptance criteria | when doing a task that cites them |
| 7 | [`SPEC.md`](SPEC.md) | Original build plan: demo script, 24 h schedule, failure plan, API cost estimate | reference |
| 8 | [`tasks/`](tasks/README.md) | Issue-style tasks per person, timeline, dependencies | your own file + `shared.md` |

**Precedence when documents disagree:** CONTRACTS > DECISIONS > REQUIREMENTS > ARCHITECTURE > SPEC. Fix the lower one in a PR.

**Other assets:**
- `public/manuals/kallax/crops/`: the 19 real KALLAX step images (created by KAR-02).
- `fixtures/`: gold (hand-checked) data.
- `docs/design/`: Claude Design output (added in SHR-03).
- `reference/prototype/`: the visual prototype (Vite app), **reference only** (D-17). Never copy or import from it; it's excluded from the app's TypeScript, tests and build. To see it run: `cd reference/prototype && npm install && npm run dev`.
- `assets/kallax-crops/`: the 19 KALLAX step images cut from the real manual (input for KAR-02).

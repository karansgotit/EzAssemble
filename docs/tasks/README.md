# Task board

Every task is written like a GitHub issue. The IDs are used in branch names, commit messages and PRs.

| File | Owner | Area |
|---|---|---|
| [`shared.md`](shared.md) | everyone | pre-event setup, integration checkpoints, demo prep |
| [`karan.md`](karan.md) | Karan | schemas, AI pipeline, prompts, routes, eval, gold fixtures |
| [`ajit.md`](ajit.md) | Ajit | 3D scene: layout snapping, geometry, animation, wrong-vs-right |
| [`smit.md`](smit.md) | Smit | Next.js app, player UI, upload pipeline (browser), save, deploy |

**Priority labels:** `P0` demo-critical · `P1` should have · `P2` stretch.

## Timeline at a glance

| Hours | Smit | Karan | Ajit |
|---|---|---|---|
| 0–1 | SMI-01 skeleton (merge by 0:45) → SMI-02 | KAR-01 schema → KAR-02 gold | AJI-01 **spike #2** snapLayout |
| 1–3 | SMI-02 library, SMI-03 player | KAR-03 Vertex + callStructured → KAR-04 **spike #1** | AJI-01 (cont.) |
| **H3** | **checkpoint** | | |
| 3–6 | SMI-03, SMI-04 api+mock, SMI-05 pdf | KAR-04, KAR-05 checks, KAR-06 index route | AJI-02 scene engine (fresh) |
| 6–8 | SMI-06 orchestrator | KAR-07 parts route, KAR-08 step route | AJI-02 → AJI-03 buildSceneManual |
| **H8** | **checkpoint: KALLAX end to end with real AI** | | |
| 8–12 | SMI-07 upload UI, SMI-08 re-analyze, SMI-09 save | KAR-09 eval, KAR-10 LACK/MALM gold | AJI-04 orientations, AJI-05 traps, AJI-06 ghost |
| **H12** | **checkpoint: 3 manuals + eval numbers** | | |
| 12–16 | SMI-10 deploy, SMI-11 design | KAR-11 tuning, KAR-12 sub-assemblies (+ AJI-09 if Ajit is behind) | AJI-07 part kinds, AJI-08 robustness, AJI-10 hardening |
| **H16** | **checkpoint: deployed** | | |
| 16–19 | SMI-12 polish (SMI-13 stretch) | (KAR-13 stretch), SHR-06 final library | AJI-10 (cont.), AJI-11 visual polish |
| **H19** | **feature freeze** | | |
| 19–24 | SHR-07 backup video | SHR-07 eval slide | SHR-07 Devpost |

## Dependency map (what blocks what)

```
SHR-01 (Vertex setup, pre-event) ──► KAR-03 ──► KAR-04 ──► KAR-06/07/08 ──► SMI-06 (real) ──► H8
SMI-01 (skeleton, ~45 min) ──► everyone rebases onto it
KAR-01 (schema) ──► KAR-02 (gold) ──► AJI-02/03, SMI-02/03, SMI-04 (mock)
AJI-01 (snapLayout) ──► AJI-03 (buildSceneManual) ──► SMI-03 (player uses SceneManual)
```

**Everything is written fresh (D-17).** `reference/prototype/` shows the target look and behaviour; it's not a source of code. Ajit's scene engine (AJI-02) is the longest task, so Smit builds the player UI shell first and plugs the scene in when it lands.

**How the three of you avoid waiting on each other:**
- **Before SMI-01 merges:** Karan works in `schema/` + `pipeline/` and Ajit in `scene/layout.ts`. These are plain TypeScript files with their own tests, needing nothing from Next.js.
- **Smit builds against mock mode** (`NEXT_PUBLIC_MOCK_AI=1` + gold fixtures) until Karan's routes land.
- **Ajit builds against gold fixtures** until real AI output exists.

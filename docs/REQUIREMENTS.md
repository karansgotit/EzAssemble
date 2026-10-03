# REQUIREMENTS

Numbered and testable. Issue files in `tasks/` reference these IDs. **P0** = needed for the demo; **P1** = should have; **P2** = stretch.

---

## Functional requirements

### Library and navigation
| ID | Pri | Requirement | Acceptance |
|---|---|---|---|
| FR-01 | P0 | The home page lists manuals from `public/manuals/index.json` | 3 cards (KALLAX, LACK, MALM) with title, thumbnail, step count; clicking opens `/m/<id>` |
| FR-02 | P0 | Opening a manual loads `manual.json`, validates it with Zod, and builds the scene manual | An invalid file shows a red error screen listing the problems, never a blank page |
| FR-03 | P0 | The home page links to Upload | Visible "Upload a manual" card |

### Upload and processing
| ID | Pri | Requirement | Acceptance |
|---|---|---|---|
| FR-10 | P0 | User uploads a PDF and enters title + product size (W×H×D cm) | Non-PDF or unreadable PDF → a clear message; size fields required, numeric, 1–400 |
| FR-11 | P0 | The browser rasterizes pages (pdf.js), long side ≤ 1600 px | A 24-page manual rasterizes in < 10 s on a laptop |
| FR-12 | P0 | Each page is indexed via `/api/index-page`, 4 at a time | Page types and step boxes come back for every page, or the page is reported as skipped |
| FR-13 | P0 | Branching steps: keep the first `variant` of each step number | KALLAX shows one step 15–19 path, not two |
| FR-14 | P0 | Steps tagged with the same consecutive `subassembly` become one sub-assembly step with the template message | MALM drawer-building steps appear as one card |
| FR-15 | P0 | Each step is cropped from its page with 2% padding | Crops visually contain the whole step and its number |
| FR-16 | P0 | Parts and layout come from `/api/parts` once | A layout that passes the checks; `snapLayout` errors trigger one re-call with `previousErrors` |
| FR-17 | P0 | Steps are analysed in order via `/api/analyze-step`, with placed parts and previous instructions | Each finished step appears in the UI immediately |
| FR-18 | P0 | After all steps: cumulative count check + consistency check | Offending steps are marked `confidence: "low"` |
| FR-19 | P0 | Dev only: "Save to library" writes `manual.json`, crops and the `index.json` entry | After saving and reloading, the manual opens from the library with no AI calls |
| FR-20 | P1 | The processing view shows the stage, progress and running cost estimate | e.g. "Analysing step 7 of 19 · $0.21" |

### Step player
| ID | Pri | Requirement | Acceptance |
|---|---|---|---|
| FR-30 | P0 | Layout: original diagram, 3D scene, instruction, controls | Matches the Claude Design layout (reference prototype as fallback) |
| FR-31 | P0 | Controls: prev/next, step dots, play/pause, replay, speed 0.5/1/2×, scrubber, reset view | All work by mouse; ← → Space R work by keyboard |
| FR-32 | P0 | Each step's animation plays automatically when the step opens | Going back and forth any number of times always shows the correct state |
| FR-33 | P0 | The 3D view highlights current-step parts; previous parts recede; dashed motion arrows | Visual check on KALLAX steps 1–15 |
| FR-34 | P0 | Info steps show a large diagram with no 3D | KALLAX 16–19 |
| FR-35 | P0 | Sub-assembly steps show only the message card + Continue | MALM drawers |
| FR-36 | P0 | Failed steps show the diagram + "Follow the original diagram for this step" | Force a failure in mock mode; the player still works |
| FR-37 | P0 | Low-confidence banner when `confidence === "low"` | Visible on such steps |
| FR-38 | P0 | "Re-analyze live" re-runs call 3 for the current step and replays the result | < 20 s; on error or timeout, a toast appears and the old result stays |
| FR-39 | P1 | Parts tray: parts used in this step, with counts and IKEA numbers | Matches the actions |

### Wrong vs right
| ID | Pri | Requirement | Acceptance |
|---|---|---|---|
| FR-50 | P0 | Manual-sourced warning only when the step image draws the mistake / orientation detail | KALLAX steps 1 and/or 13 flagged; plain dowel steps not flagged |
| FR-51 | P0 | Geometry-sourced warning when: plain box panel + holes on one face only + holes must face the joined part | Unit test on gold KALLAX |
| FR-52 | P0 | Ghost sequence: red wrong pose (hole dots on the wrong side) → rotates to green correct pose → fades, then the step plays | Visual check |
| FR-53 | P0 | Labels say "From the manual" or "Possible mistake", never "Common mistake" | Visual check |
| FR-54 | P0 | Autoplay rules: manual warnings always on first view; geometry warnings only on the first placement of each panel type; otherwise a "Show possible mistake" button | Visual check on KALLAX shelves |
| FR-55 | P0 | No evidence → no ghost, no button | Visual check |

### AI pipeline (server)
| ID | Pri | Requirement | Acceptance |
|---|---|---|---|
| FR-60 | P0 | All Gemini calls go through `callStructured` (JSON mode + schema, Zod parse, semantic checks, ≤ 2 retries with errors fed back) | Unit test with a fake model that fails twice then succeeds |
| FR-61 | P0 | Gemini is called via Vertex AI with server-side credentials | No credential ever appears in browser bundles (`grep` the build output) |
| FR-62 | P0 | Every call logs model, tokens in/out, latency | Visible in the server console and returned in `usage` |
| FR-63 | P0 | Prompts live in `pipeline/prompts/*.md`, not in code | — |
| FR-64 | P0 | `npm run eval` scores AI output against gold (schema pass, verb, part, count, warning recall, sub-assembly detection) and writes `eval.html` | Runs on KALLAX in < 5 min |
| FR-65 | P2 | Q&A route answers a question about the current step | — |

### Geometry and animation (browser)
| ID | Pri | Requirement | Acceptance |
|---|---|---|---|
| FR-70 | P0 | `snapLayout` turns the AI's fractional layout into exact cm with no overlaps; every panel touches another | The noisy gold KALLAX (±8%) snaps back within 0.5 cm |
| FR-71 | P0 | `buildOrientation` maps the product size into the build frame (CONTRACTS §4.1) | KALLAX `on-back` → [147, 39, 77] |
| FR-72 | P0 | Hardware positions come from target face + `for` part (or `at` fallback) | Unit tests: KALLAX dowels for S1 at x ≈ 38.25 on L1's front face |
| FR-73 | P0 | Supported hardware: dowel, screw, cam, camBolt, nail; non-hardware: panel, leg, other (boxes) | Each renders and animates |
| FR-74 | P0 | Flip `stand-up` / `turn-over` as a whole-assembly rotation | KALLAX step 15 ends upright |
| FR-75 | P0 | Renderer never throws on bad data: unknown ids are skipped and logged | Unit test with corrupted actions |
| FR-76 | P1 | Camera auto-frames objects from 30 cm to 200 cm | LACK and MALM framed well |

---

## Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Security:** Google Cloud credentials only on the server (env vars). `pipeline/` imports `"server-only"`. `.env.local` is never committed. |
| NFR-02 | **Reliability:** the demo path (library → KALLAX → all steps) works with Wi-Fi off when run locally. |
| NFR-03 | **Performance:** 3D runs smoothly (no visible stutter) on a 2020+ laptop in Chrome; scene ≤ 400 meshes. |
| NFR-04 | **Latency:** see PRD §7 targets. |
| NFR-05 | **Cost:** usage logged per call; per-manual estimate shown in dev; whole-hackathon spend < $100 USD. |
| NFR-06 | **Browser support:** latest Chrome (demo); Safari / Firefox best effort. |
| NFR-07 | **Code quality:** TypeScript strict, no `any`; pure logic in `scene/*.ts` and `schema/checks.ts` with Vitest tests; files ≤ ~250 lines. |
| NFR-08 | **Accessibility:** all controls keyboard-reachable with visible focus; text contrast ≥ 4.5:1. |
| NFR-09 | **Determinism:** with the same `SavedManual`, the 3D output is identical every time. |

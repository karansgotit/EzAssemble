# PRD: EzAssemble

**Event:** StormHacks 2026 (24 hours) · **Team:** Ajitsingh Chauhan, Smit Sanghvi, Karan Passi · **Status:** approved for build

---

## 1. Problem

IKEA manuals are wordless. Each step is a line drawing with arrows, part numbers and tiny zoomed details. People misread them all the time:
- they use the wrong piece;
- they put a panel in the wrong way round;
- they only discover the mistake five steps later, and have to take it apart.

## 2. Solution

Upload an IKEA assembly manual (PDF). For every step, the app shows:
- the **original diagram**;
- a **plain-English instruction** ("Tap 2 dowels into the long panel and push the first shelf onto them");
- a **short interactive 3D animation** of exactly which piece moves where;
- **where there is evidence**, a "wrong vs right" animation of the likely mistake: a red ghost in the wrong orientation that turns into the correct one.

Gemini reads the diagrams and fills in a strict form for each step. Our own code turns that form into geometry and animation. **The AI never writes code or coordinates for individual steps.**

## 3. Users

- **Primary:** a person assembling IKEA furniture at home, laptop or tablet nearby, stuck on a step.
- **Demo audience:** hackathon judges. They need to understand the value in under 3 minutes and see that it's real AI, not a scripted video.

## 4. Goals and non-goals

**Goals (hackathon):**
- G1. One polished, reliable demo on the IKEA KALLAX 2×4 manual.
- G2. The **same pipeline**, with no per-manual code, also works on LACK and MALM.
- G3. A visible proof it's real: re-analyze a step live, and upload a manual live.
- G4. Measured accuracy against hand-made gold answers, to show judges.

**Non-goals:**
- Non-IKEA manuals.
- Sub-assembly instructions (e.g. building a drawer). The app says the unit is assembled separately, then shows it finished.
- Accounts, login, database, saving user uploads.
- Exact CAD accuracy or photorealistic models.
- AI-generated code.
- AR, voice, mobile app.
- A "common mistakes" database; warnings only come from the manual or the geometry.

## 5. User stories

| ID | As a… | I want… | So that… |
|---|---|---|---|
| US-1 | user | to pick a manual from a library | I can start immediately |
| US-2 | user | to upload an IKEA manual PDF and enter the product size | the app works on my furniture |
| US-3 | user | to watch steps appear as they're processed | I'm not staring at a spinner for 3 minutes |
| US-4 | user | to see the original diagram next to the 3D version | I can compare and trust it |
| US-5 | user | a one-sentence instruction for each step | I know what to do without decoding arrows |
| US-6 | user | to replay, pause, scrub, slow down and orbit the animation | I can study a tricky step |
| US-7 | user | to see the wrong way vs the right way where it matters | I don't make the classic mistake |
| US-8 | user | a clear warning when the AI is unsure | I know to double-check the diagram |
| US-9 | user | a clear message for steps the app can't animate | I can still follow the original diagram |
| US-10 | user | to be told when a part is assembled separately (e.g. drawers) | I know to follow the manual for that bit |
| US-11 | judge | to press "re-analyze live" and see a fresh AI result | I believe it's real |
| US-12 | team | to save a processed manual into the library (dev only) | the demo is instant and reliable |

## 6. Demo narrative (about 3 minutes)

1. **The hook:** show a confusing KALLAX page. "IKEA tells you what. We show you how, and the mistake before you make it."
2. Library → **KALLAX 2×4**.
3. **Step 1:** the diagram on the left; on the right, a ghost labelled "Possible mistake" (holes facing out) turns into the correct one; then the end panel slides in and the screws spin in.
4. Steps 2–5, quickly: dowels tap in, pieces slide on. Orbit the model.
5. **Step 13:** a warning sourced "From the manual", then the long panel lowers onto 8 dowels.
6. **Step 15:** the whole shelf stands up.
7. **Live proof:** "Re-analyze live" on a step returns a fresh Gemini result in seconds.
8. **Upload:** drop the KALLAX PDF and the first steps stream in. "Here's the fully processed version."
9. **Close:** LACK and MALM go through the same pipeline (show the MALM "drawers assembled separately" card), plus the accuracy numbers.

## 7. Success metrics (measured before demo freeze)

| Metric | Target |
|---|---|
| KALLAX steps with valid AI output (schema + checks within 2 retries) | 100% of steps, or a clean fallback |
| KALLAX verb + part accuracy vs gold | ≥ 85% |
| LACK / MALM steps that animate correctly | ≥ 70% each; the rest fall back cleanly |
| Live re-analyze latency | < 20 s |
| First streamed step after upload | < 30 s |
| Crashes / blank screens on the demo path | 0 |
| Gemini spend for the whole hackathon | < $100 USD (credit: $300 CAD) |

## 8. Scope summary

- **MVP (P0):** library; step player (diagram, 3D, instruction, controls); wrong-vs-right where justified; low-confidence and failure fallbacks; sub-assembly card; AI pipeline (index → crops → parts/layout → steps, validated with retries); live re-analyze; streaming upload; save-to-library; Vercel deploy.
- **P1:** design polish from Claude Design; LACK and MALM gold fixtures and eval; sub-assembly detection tuning.
- **P2 / stretch, in order:** Q&A about the current step; branch picker (e.g. KALLAX vertical/horizontal); "check my work" photo; image-to-3D models.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Gemini misreads steps | Strict schema, semantic checks, retries; eval loop with gold; fallback UI |
| Rough panel layout from AI is wrong | `snapLayout` cleans it; consistency check; human review before saving |
| Geometry-based warnings are wrong (holes face recorded incorrectly) | Reviewed in the parts check; measured in eval; honest "Possible mistake" label |
| Vertex AI setup or quota issues | Test before the event; log usage; saved results for the demo |
| Three people editing one repo | Folder ownership, contracts file, small PRs (see `CONVENTIONS.md`) |
| Demo-time network failure | Everything for the demo is static files; local run; backup video |

## 10. Related documents

- `SPEC.md`: build plan, demo, schedule, cost estimate
- `ARCHITECTURE.md`: how it works end to end
- `CONTRACTS.md`: exact shared interfaces
- `REQUIREMENTS.md`: numbered requirements with acceptance criteria
- `DECISIONS.md`: what is decided and why
- `CONVENTIONS.md`: git, code, testing rules
- `tasks/`: everyone's issues

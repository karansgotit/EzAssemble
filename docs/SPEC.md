# EzAssemble: Build Specification

_Status: approved. Code is written fresh in this repo; `reference/prototype/` is reference only (D-17)._

_Decided: IKEA manuals only · sub-assemblies are not built (one "assembled separately" step, then the finished unit appears) · wrong-vs-right kept, only where it can be justified (§7b) · the demo uses saved results plus live proof · Gemini via **Google Cloud / Vertex AI** credits · reusing the prototype is allowed._

---

## 1. Product

**One-liner:** Upload an IKEA assembly manual and get each step back as a plain-English instruction plus a short 3D animation that shows which piece moves where, and, where the manual or the geometry shows a likely mistake, what the wrong way looks like.

**Target user:** Someone assembling IKEA furniture who gets stuck on a wordless IKEA diagram.

**Scope (decided): IKEA furniture manuals only.**
- The same pipeline runs, with no per-manual code, on any **IKEA assembly manual** built from panels, legs, dowels, screws and cam locks.
- It is **tested on 3 manuals**: KALLAX 2×4 (hero), LACK, and MALM.
- An untested manual is processed by the same code. Steps the pipeline can't understand fall back to "follow the original diagram" instead of breaking.
- **Non-IKEA manuals are out of scope.** Within IKEA, we do not promise curved/upholstered products (sofas, armchairs) or products with electronics.
- **Sub-assemblies (decided):** when a manual builds something separately (e.g. MALM drawers over many steps), that whole sequence is shown as **one step**; see §8.

---

## 2. The demo a judge sees (about 3 minutes)

1. **Library:** three processed manuals. Open **KALLAX 2×4**.
2. **Step 1:** the real IKEA diagram on the left; on the right, a red ghost of the long panel with its drilled holes facing outward is labelled "Possible mistake", then rotates to the correct way and turns green ("Drilled holes face inward"). Then the end panel slides in and two screws spin in.
3. **Steps 2–5, quickly:** dowels tap in, divider and shelf pieces slide on. The judge can drag to orbit.
4. **Step 13:** the second wrong-vs-right moment (this one comes from the manual's own zoomed hole-position drawing), then the long panel lowers onto all 8 dowels.
5. **Step 15:** the whole shelf stands up.
6. **Proof it's real:** press **"Re-analyze live"** on a step. Gemini returns a fresh result in a few seconds and the animation replays from it.
7. **Upload:** drop in the KALLAX PDF. Steps 1–2 appear live, and we say "here's the fully processed version" and switch.
8. **Close:** "Same pipeline, also running on LACK and MALM", and open one of them.

---

## 3. Scope

**MVP (required for the demo above)**
- Library of 3 pre-processed manuals
- Step player: original diagram, 3D animation, instruction, previous/next/replay/scrub
- Wrong-vs-right ghost, only on steps where it can be justified (§7b)
- Low-confidence banner and "follow the diagram" fallback for steps the pipeline can't handle
- AI pipeline: page index → step crops → parts and layout → per-step actions, with validation and retries
- "Re-analyze live" button
- Upload that streams steps in, with the cached-result switch

**Non-goals (we refuse to build these)**
- Accounts, login, database, saving user uploads between sessions
- Universal instruction manuals (electronics, Lego, cooking)
- Exact CAD accuracy or photorealistic 3D models
- AI-generated JavaScript that gets executed (the old repo's `eval` approach)
- Mobile-native app, AR
- A database of "common mistakes" from reviews or forums (we only use what the manual and the geometry show)
- Non-IKEA manuals
- Sub-assembly instructions (e.g. how to build a drawer); we say "assembled separately" and move on
- Voice

**Stretch goals, in order of value for effort**
1. Q&A about the current step (text in, one Gemini call)
2. Horizontal/vertical branch picker (the KALLAX step-15 fork)
3. "Check my work" photo comparison
4. Image-to-3D models (Meshy/Tripo) for hero parts

---

## 4. Architecture (the whole system)

```
                ┌────────────────────────────── Browser ──────────────────────────────┐
  PDF ─────────►│ 1. Rasterize (pdf.js)  →  page images                                │
                │ 2. For each page: POST /api/index-page  ──────────────┐              │
                │ 3. Crop each step from its page (canvas)               │              │
                │ 4. POST /api/parts   (parts page + cover + steps)  ────┤              │
                │ 5. For each step: POST /api/analyze-step  ─────────────┤              │
                │    (steps appear in the player one by one)             │              │
                │                                                        ▼              │
                │                               ┌───────── Next.js server routes ─────┐ │
                │                               │ Gemini call → JSON → Zod check →    │ │
                │                               │ semantic checks → retry w/ errors   │ │
                │                               │ (Cloud credentials live only here)  │ │
                │                               └─────────────────────────────────────┘ │
                │ 6. Player: resolveScene → buildTracks → React Three Fiber renders     │
                │ 7. (dev only) "Save to library" → writes JSON + crops into /public    │
                └───────────────────────────────────────────────────────────────────────┘
  Cached demo data: public/manuals/<id>/{manual.json, steps/*.json, crops/*.png}
```

**Key decision: one code path.** The "offline pre-processing" is not a separate script. We run the normal upload flow ourselves, before judging, and press a dev-only **"Save to library"** button that writes the results into `public/manuals/`. The demo's cached data and the live upload are therefore produced by exactly the same code.

**Folder layout** (written fresh; the reference prototype shows behaviour):

```
app/                      Next.js pages + API routes                  (Smit)
  page.tsx                library
  m/[id]/page.tsx         step player
  upload/page.tsx         upload + streaming progress
  api/index-page/route.ts
  api/parts/route.ts
  api/analyze-step/route.ts
  api/save-manual/route.ts   dev only: writes to public/manuals
schema/                   Zod schemas: the contract                    (Karan owns)
pipeline/                 Gemini calls, prompts, checks — server only  (Karan)
  gemini.ts  config.ts  checks.ts
  prompts/index-page.md  parts-layout.md  analyze-step.md
  eval/                   accuracy vs hand-written gold fixtures
scene/                    3D: pure layout + animation + R3F components (Ajit)
  layout.ts               NEW: snapLayout() — turns rough AI layout into clean geometry
  resolveScene.ts  tracks.ts  geometry.ts  …(fresh; reference/prototype shows behaviour)
player/                   UI around the scene                          (Smit)
client/                   pdf.js rasterize, canvas crop, upload orchestrator (Smit)
fixtures/                 gold KALLAX fixture (converted from reference data) + LACK/MALM golds
public/manuals/           cached processed manuals for the demo
```

---

## 5. Where AI is used, and where it is NOT

### AI is used in exactly 3 places (plus 1 stretch)

| # | Call | When | Input | Output (validated by Zod) | Model tier |
|---|---|---|---|---|---|
| 1 | **Index page** | once per page | one page image | page type (`cover / warning / tools / parts / steps / other`), and for each step on the page: step number + bounding box + `variant` (for branches like KALLAX 15–19) | fast (Flash-class) |
| 2 | **Parts & layout** | once per manual | parts page(s), cover image (finished product), overall product size (typed in by us), all step crops at low resolution | parts list (id, label, kind, count, shape, sizes), **rough layout** of every panel in the finished product, build orientation | strongest available |
| 3 | **Analyze step** | once per step | the step crop, the parts list, which parts are already placed, previous steps' instructions | actions (verb, part, count, target, face, `for`), orientation warning **only if the manual draws one**, instruction sentence, confidence, `kind: assembly/info` | strongest available |
| 4 | _(stretch)_ Q&A | on demand | question + current step JSON + crop | short answer | fast |

Model IDs are pinned in one file (`pipeline/config.ts`) at hour 0 after checking Google's current model list. Temperature 0.

**How every AI call is protected:**
1. Gemini is asked for JSON and given our schema (Zod v4 can generate the JSON Schema with `z.toJSONSchema`; verify the exact SDK option in hour 0).
2. The reply is parsed and checked by Zod. Wrong shape means a retry with the Zod errors pasted into the prompt.
3. Semantic checks run next. Does every part id exist? Are more dowels used than are in the box? Is the verb valid for that kind of part? Failure means a retry with those errors.
4. After 2 retries, the result is marked `failed`. The player shows that step as "follow the original diagram". **A bad AI answer can never crash the app.**

### AI is NOT used for any of these (all deterministic code we write)
- Where a dowel or screw sits (computed from the target face plus the `for` part)
- Cleaning up the panel layout (snapping, overlap checks)
- Any animation, timing, easing, camera movement, colours, ghost effects
- "Possible mistake" ghosts derived from geometry (§7b)
- Rendering
- Validation

This split is what makes it reliable: **the AI decides _what_ happens; our code decides _where_ and _how it moves_.**

---

## 6. The forms the AI fills in (schemas)

These are the prototype schemas plus the changes needed for "any manual".

```ts
// Parts & layout (call 2)
Part = {
  id: string,                 // AI-invented if the manual has no number, e.g. "long_panel_1"
  ikeaNumber?: string,        // hardware numbers printed in the manual, e.g. "101339"
  label: string,
  kind: "panel" | "leg" | "dowel" | "screw" | "cam" | "camBolt" | "nail" | "other",
  count: number,
  shape: "box" | "cylinder",
  sizeFrac?: [x, y, z],       // panels/legs: size as fraction of the product's size
  hardwareMm?: { length, diameter },  // hardware is drawn 1:1 in IKEA manuals
  homeFrac?: [x, y, z],       // panels/legs: rough centre in the finished product (0–1)
  features: { type: "holes" | "finished-edge", face: Face }[],  // drilled holes / visible edge (from the parts page)
}
Manual = {
  productSizeCm: [w, h, d],   // typed in by us (from the product page) or by the uploader
  buildOrientation: "upright" | "on-back" | "upside-down" | "on-side",  // how the manual builds it
  parts: Part[], steps: Step[]
}

// Analyze step (call 3)
Action = { verb: "insert" | "attach" | "screw" | "lock" | "place" | "flip",
           part, count, target?, face?, for?, at?, flipMode? }
Step = { stepNumber, variant?, kind: "assembly" | "info" | "subassembly", instruction,
         actions: Action[], confidence: "high"|"medium"|"low",
         orientationTrap?: { part, mustFace, wrong, hint, source: "manual" },  // only if the manual shows it
         sourceSteps?: number[] }   // subassembly: the original step numbers it stands for
```

**The one big change from the reference prototype:** the prototype's panel positions (`homeCm`) were typed in by hand. For any manual, they must come from call 2. See §8.

---

## 7. How the animation is generated (step by step, with a real example)

Take **KALLAX step 3**. Call 3 returns:

```json
{ "actions": [
  { "verb": "insert", "part": "dowel", "count": 2, "target": "L1", "face": "front", "for": "S1" },
  { "verb": "place",  "part": "S1",    "count": 1, "target": "L1", "face": "front" } ] }
```

1. **`resolveScene(manual, stepIndex)`** replays every step up to this one and returns the exact position of every piece.
   - It picks the next two unused dowels, `dowel#3` and `dowel#4`.
   - It finds where `S1` will end up and projects that onto `L1`'s front face, which gives the strip where the shelf meets the panel. The two dowels are spaced along that strip.
   - `S1` goes to its home position from the layout.
   - **No AI is involved here.**
2. **`buildTracks(step, before, after)`** turns each action into motion using a fixed recipe per verb:
   - `insert`: start 6 cm out along the face's normal (the direction pointing straight out of the face), slide in over 0.8 s, then a small "tap" bounce.
   - `place`: start 35% of the part's size plus 10 cm away from the target face, glide in over 1.2 s.
   - `screw`: like insert, plus 3 turns. `lock`: a quarter turn. `flip`: rotate the whole assembly.
   - Actions play one after another; repeated pieces are staggered by 0.15 s.
3. **Every frame,** `sample(tracks, t)` works out each moving piece's position at time `t` with ease-in-out, and React Three Fiber draws it.
4. **Styling is applied by rules, not by AI:** current-step pieces are yellow, older pieces white, a dashed blue arrow follows each move, and the camera re-frames on the moving pieces.
5. **The ghost** (only on steps with evidence; see §7b): a red copy of the panel in the wrong orientation, holes visibly on the wrong side, rotates to the correct one and turns green before the step's main animation.

**Prev/next always works** because the scene is rebuilt from the data every time; nothing is mutated.

---

## 7b. Wrong vs right: where the "mistakes" come from

**We do not have a list of common mistakes for each manual,** and we don't invent one. A ghost is shown only when there is concrete evidence, from one of two sources:

**Source 1: the manual itself** (`source: "manual"`). IKEA sometimes draws the mistake:
- a small crossed-out drawing of the wrong way;
- a zoomed detail showing exactly which way the holes or edges must face.

Call 3 is told: *only* fill `orientationTrap` if the image contains such a drawing. These are the strongest cases.
- **KALLAX:** steps 1 and 13 have zoomed hole-position details, so a ghost is justified there.
- KALLAX's crossed-out drawings (pages 16 and 21) are about wall anchoring, not orientation, so they don't count.

**Source 2: the geometry** (`source: "geometry"`, computed by our code, no AI). A panel can go in the wrong way round when:
- it is a plain rectangular board, so it looks the same flipped; **and**
- its drilled holes are only on one face (the parts list records which face has holes); **and**
- in this step those holes must face the part they join (known from the step's `target` / `for`).

If all three are true, flipping the panel 180° would put the holes on the wrong side, so our code can draw that wrong version precisely. That is a real, physical way to get it wrong, not a guess about what people "commonly" do.

**Rules, to avoid crying wolf:**
- Manual-sourced warnings auto-play the first time the step is shown.
- Geometry-sourced warnings auto-play only on the **first** step where each kind of panel is placed (e.g. the first shelf). Later identical panels just get a small "Show possible mistake" button.
- **Labels are honest:** "From the manual" or "Possible mistake", never "Common mistake".
- **No evidence means no ghost.** The step just plays normally. Many steps (dowels, screws) will never have one.

**Accuracy risk:** source 2 depends on the parts list correctly saying which face has holes. That's checked in the parts-list review and measured in evaluation (§11).

## 8. Making it work for any manual: the full pipeline

| Stage | What happens | Who/what does it | Failure handling |
|---|---|---|---|
| 0. Upload | User drops a PDF; types product size (W×H×D cm), pre-filled for our 3 | Browser | — |
| 1. Rasterize | pdf.js renders each page at ~150 dpi | Browser | Unreadable PDF → error message |
| 2. Index | Call 1 per page → page types + step boxes | Gemini + checks | Duplicate/missing step numbers → flagged; branch steps get `variant` |
| 2b. Group sub-assemblies | Consecutive steps that call 1 tagged with the same `subassembly` label (e.g. "drawer") are merged into **one** step of kind `subassembly` | Our code | A wrongly tagged step can be untagged in the index check |
| 3. Crop | Cut each step box out (+2% padding) | Browser canvas | — |
| 4. Parts & layout | Call 2 → parts list + rough panel layout | Gemini + checks | Retry with errors |
| 5. **Snap layout** | `snapLayout()` cleans the rough layout (below) | Our code | Overlaps it can't fix → retry call 2 with the overlap list |
| 6. Analyze steps | Call 3 per step (sub-assembly steps are skipped), streamed to the player as each finishes | Gemini + checks | 2 retries → `failed` step → diagram fallback |
| 7. Consistency check | Every `place/attach` target must actually touch the placed part in the snapped layout | Our code | Mismatch → mark step low-confidence |
| 8. Play | resolveScene → buildTracks → render | Our code | Unknown references are skipped, not crashed |
| 9. Save (dev only) | Write JSON + crops to `public/manuals/<id>/` | Dev route | — |

### Stage 5, `snapLayout()`: the piece that makes "any manual" possible

Gemini is decent at roughly where panels go, judging from the finished-product picture, but not at exact numbers. So it gives rough fractions, and our code tidies them up:
1. **Scale:** fractions × product size → centimetres.
2. **Thickness classes:** each panel's thinnest dimension is snapped to the nearest common thickness (e.g. 1.6 / 1.8 / 3.8 cm).
3. **Snap to edges:** a face within ~4% of the product's outer boundary is pushed flush to it.
4. **Snap to neighbours:** a face within ~4% of another panel's face is pushed flush to it.
5. **Even spacing:** identical repeated parts (e.g. 3 shelves) are spaced evenly between their neighbours.
6. **Check:** no two panels overlap, every panel touches at least one other, everything sits inside the product boundary. Failures go back to call 2 as errors.

This is the riskiest new piece, and it is **not proven yet**. It's Spike #2 (§12). If it fails on LACK or MALM, the fallback is a human check of the layout for our 3 manuals in a small layout editor, while untested uploads show the diagram fallback for steps whose layout fails.

### Known manual quirks the pipeline must handle (found in the real KALLAX manual)
- Several steps per page (up to 3) → hence cropping.
- Non-step pages (cover, 4 pages of warnings, tools, parts) → page types.
- **Branches:** KALLAX steps 15–19 exist twice (upright vs. on its side) → `variant`; MVP plays the first variant.
- Steps with no assembly (wall anchoring) → `kind: "info"`.
- Built lying on its back, stood up at the end → `buildOrientation` + `flip`.
- Panels have **no part numbers** printed; only hardware does → the AI invents panel ids in call 2, and every call 3 receives that list so ids stay consistent.

### Sub-assemblies (decided: not built, one "assembled separately" step)

Some IKEA manuals build a separate unit across many steps and only attach it later. For example, MALM builds each drawer separately, then slides it into the frame. **We don't show how to build these.** Supporting them would change the pipeline, and they are effectively a different manual.

1. **Call 1 tags them.** For each step on a page, call 1 also returns `subassembly: "drawer"` when the step builds something that is not yet attached to the main frame.
2. **Our code replaces them.** Consecutive steps with the same tag become **one** step:
   - `kind: "subassembly"`;
   - `sourceSteps: [20, …, 31]`;
   - a template message, not AI: *"The 2 drawers are assembled separately (manual steps 20–31). Follow the manual for those, then continue here."*
   - No diagrams and no 3D for this step: just the message card and a "Continue" button.
3. **Call 2 lists the finished unit as a single part,** e.g. `{ id: "drawer", kind: "other", shape: "box", count: 2 }`.
4. **The next step shows it fully assembled.** For example, `place drawer` slides a finished box into the frame, animated normally.
5. **Bonus:** no call 3 runs for skipped steps, which saves time and cost.

## 9. Technologies and what each one contributes

| Technology | What it does for us |
|---|---|
| **TypeScript** | One language for the whole project; types shared between the AI forms, the 3D and the UI, so mismatches are caught before running |
| **Next.js** (App Router) | The web app plus small server endpoints (`/api/...`) where the Gemini key stays hidden; deploys to Vercel with no config. Chosen over Vite (used by the reference prototype) because we now need a server, and Smit already knows it. |
| **React 19** | Builds the screens out of components |
| **three.js** | The 3D engine: draws boxes and cylinders in the browser using the graphics card (WebGL) |
| **@react-three/fiber** | Lets us write the 3D scene as React components (`<PartMesh/>`), so changing step = changing props |
| **@react-three/drei** | Ready-made 3D helpers: black outline edges (the IKEA look), orbit/zoom controls, soft floor shadows, floating labels for the ghost |
| **Zod v4** | Checks every AI answer and every saved file against our forms; also produces the JSON Schema we send to Gemini |
| **@google/genai** | Google's official SDK for calling Gemini from our server routes, configured for **Vertex AI** (`vertexai: true`, project, location) because our credits are Google Cloud credits |
| **Google Cloud project + Vertex AI** | Where the Gemini calls are billed (against the $300 CAD credit). Credentials: a service-account key stored as a server-side environment variable (never in the browser). Verify the exact auth setup in the pre-event test. |
| **Gemini** (sponsor) | Reads the manual images: finds steps, lists parts, describes each step (§5) |
| **pdfjs-dist** | Turns PDF pages into images in the browser (adapted from the old repo) |
| **HTML canvas** | Crops each step out of its page, in the browser; no extra library |
| **Vitest** | Unit tests for the pure functions (layout, animation, checks) and the AI accuracy evaluation |
| **Vercel** | Hosting; the demo laptop can also run everything locally as a backup |
| **Claude Code** | Writes the code, driven by this spec and a repo `CLAUDE.md` |
| **Claude Design** | Produces the visual design: screens, components, design tokens (§13) |

Deliberately **not** used: databases, auth, queues, Docker, any animation library, any CSS framework. The prototype proved plain CSS is enough.

---

## 10. Team split (ownership; the boundaries are the folders)

| Person | Owns | Strengths it uses |
|---|---|---|
| **Karan** | `schema/`, `pipeline/`, the AI API routes (all 3 Gemini calls, prompts, validation and retries), `pipeline/eval/` (accuracy against gold fixtures), downloading and checking the manuals, hand-writing gold fixtures for LACK and MALM | Python/ML evaluation habits, pytest discipline, scikit-learn bug-hunting |
| **Ajit** | `scene/`: the renderer (written fresh), plus the new `snapLayout()`, `buildOrientation` handling, and performance | React; the 3D is React components now |
| **Smit** | `app/` pages, `player/`, `client/`, save-manual route: Next.js shell, upload + streaming, live re-analyze, library, implementing the Claude Design designs, Vercel deploy | Next.js/TypeScript/shadcn, data validation, deploys |

**Contracts that let everyone work in parallel from hour 1:**
- `schema/` is agreed first and changed only with a heads-up in team chat.
- The gold fixture `fixtures/kallax.json` lets Ajit and Smit build before Gemini produces anything.
- `<AssemblyScene manual stepIndex playKey playing speed scrubT showTrap onProgress onDone />` is the only boundary between Ajit and Smit.
- `analyzeStep(crop, parts, placed, previous) → Step` is the only boundary between Karan and Smit.

---

## 11. Evaluation (how we know the AI is good enough)

- **Gold fixtures:** the prototype's `kallax.json` is the correct answer for KALLAX. Karan hand-writes gold fixtures for 5–8 steps of LACK and MALM.
- **`npm run eval`** runs the pipeline on every crop and compares the result with gold, field by field:
  - **Schema pass rate:** % of steps valid within 2 retries
  - **Verb accuracy:** % of actions with the correct verb
  - **Part accuracy:** correct part and target
  - **Count accuracy:** correct number of dowels, screws, etc.
  - **Sub-assembly detection:** did it tag the right steps (MALM drawers)?
  - **Warning recall:** did it flag the steps where the manual draws an orientation warning?
- **The target before demo freeze:** KALLAX ≥ 85% verb+part accuracy, with every demo step either correct or showing a fallback.
- **Plus a contact sheet** (`eval.html`): each crop beside its 3D thumbnail and the AI's sentence, for a quick visual check.

This is also a good thing to show judges: "we measured it, and here's the accuracy."

---

## 12. Build order (24 hours)

**Hours 0–3: spikes (prove the risky parts first)**

| Who | Task | Done when |
|---|---|---|
| All (0:00–0:30) | Clone the EzAssemble repo, `CLAUDE.md`, Vertex AI credentials work on every laptop, confirm hackathon rules (§15) | Everyone runs it locally |
| **Karan** (Smit pairs for the first 30 min) | **Spike #1:** call 3 on KALLAX steps 2–5 crops with the gold parts list | Returns Zod-valid JSON; eval shows verb/part accuracy on 4 steps |
| **Ajit** | **Spike #2:** `snapLayout()` turns rough fractions (made by adding ±8% noise to the gold KALLAX layout) back into a valid layout | The noisy layout snaps back to near-gold with no overlaps |
| **Smit** | Next.js skeleton; player UI shell (fresh) on gold JSON via mock mode; library page | Player runs inside Next.js on gold data |

**Hour-3 checkpoint:** if Spike #1 is below ~60% on 4 steps, spend 2 hours on prompt fixes (send the previous step's crop, few-shot examples) before building more on top.

| Hours | Focus |
|---|---|
| 3–8 | Calls 1 and 2 working; full KALLAX run through the pipeline; the player plays **AI output**, not gold |
| 8–12 | LACK + MALM through the same pipeline; fix prompts and the snapper; info steps, branch `variant` |
| 12–16 | Live re-analyze, streaming upload, "Save to library"; apply the Claude Design design |
| 16–19 | Stretch: Q&A. Vercel deploy. Eval numbers for the pitch |
| **19** | **Feature freeze**: bug fixes only after this |
| 19–22 | Rehearse the demo 3×; record a backup demo video; re-generate the cached data from the final code |
| 22–24 | Devpost write-up, screenshots, buffer |

---

## 13. Design with Claude Design: what to ask for

**Give it:**
- Screenshots of the prototype.
- This list of screens and states.
- The rule that the 3D panel should feel like an IKEA drawing (white parts, black outlines, one accent colour).

**Screens and states:**
1. **Library:** 3 manual cards, plus an "Upload a manual" card
2. **Upload:** drop zone, product-size field, then a progress view where steps appear one by one
3. **Step player:** diagram | 3D | instruction + controls (the prototype layout)
4. **Info step:** large diagram, no 3D
5. **States:** loading a step, low confidence, step failed (diagram fallback), live re-analyze in progress / success / failed, Gemini unavailable, invalid PDF
6. _(stretch)_ Q&A panel

**Ask it to also output design tokens** (colours, type scale, spacing, radii) as CSS variables. The 3D colours in `scene/constants.ts` must read the same tokens, so the 3D and the UI match.

**Timing:** do the design **before** the hackathon or in hours 0–2, so Smit can implement it in hours 12–16 without blocking anyone.

---

## 14. Demo failure plan

| If… | Then… |
|---|---|
| Gemini is slow or down | Cached results are already on screen; the live button shows "Live analysis unavailable" and keeps the cached result |
| Upload takes too long | We say "here's the fully processed version" and switch to the cached manual (planned anyway) |
| A step's AI result is wrong | That step shows the diagram fallback; we skip it in the demo path |
| Venue Wi-Fi dies | Run `npm run start` on the laptop; all hero data is static files |
| Laptop or browser dies | Backup demo video (recorded at hour ~21) |

---

## 15. Things you might be missing

1. **Hackathon rules on pre-built code.** ✅ Confirmed allowed. We still write all code fresh during the event; the prototype is reference only.
2. **Google Cloud / Vertex AI setup before the event.** Apply the credits to a Google Cloud project, enable the Vertex AI API, set up credentials (§9), check that the chosen models are available in our region, and make one test call.
3. **Branding:** don't put IKEA's logo or name in our product name or styling. Using their public manuals as demo input is fine to show; just don't imply affiliation.
4. **Read the LACK and MALM manuals before the event** (15 min each). MALM is now a useful test of the sub-assembly rule (drawer building skipped).
5. **A repo `CLAUDE.md` for Claude Code:** folder ownership, "never let AI output skip Zod", "pure functions in `scene/` must have tests", run `npm test` before commits. Point each person's Claude Code session at their own folder, to avoid three agents editing the same files.
6. **Devpost submission and pitch:** the story ("IKEA tells you what; we show you the mistake before you make it"), the eval numbers, a 2-minute video.

---

## 16. Definition of done (demo-ready)

- [ ] KALLAX: all 19 steps produced by the **AI pipeline** (gold used only for scoring), human-checked, cached; steps 1–15 animate correctly, 16–19 show the info layout.
- [ ] LACK and MALM (or the replacement): processed by the same code; at least 70% of steps animate correctly, the rest fall back cleanly.
- [ ] MALM: the drawer-building steps collapse into one "assembled separately" step, then finished drawers slide in.
- [ ] Wrong-vs-right ghost on at least 2 KALLAX steps, each with its source shown (manual or geometry).
- [ ] Live re-analyze works on 3 different steps in under 20 s each.
- [ ] Upload shows the first step within 30 s.
- [ ] `npm test` and `npm run build` pass; no console errors on the demo path.
- [ ] Deployed URL works, **and** the local fallback works with Wi-Fi off.
- [ ] Demo rehearsed 3 times end to end; backup video recorded.

---

## 17. API cost estimate (Gemini)

_Prices from Google's Gemini API pricing page, October 2026, standard paid tier, USD per 1M tokens. Image size from Google's docs: a Gemini 3 image costs 1,120 tokens at the default resolution. Output prices include the model's "thinking" tokens, which are the biggest uncertainty below._

**Token estimate for one KALLAX-sized manual** (24 pages, 19 steps):

| Call | Calls | Input tokens (each) | Output incl. thinking (each) | Total in / out |
|---|---|---|---|---|
| 1. Index page | 24 | ~1.6k (1 image + prompt) | ~1.2k | 39k / 29k |
| 2. Parts & layout | 1 | ~25k (~21 images + prompt) | ~5.5k | 25k / 5.5k |
| 3. Analyze step | 19 | ~3.2k (1 image + parts list + context) | ~2.4k | 61k / 46k |
| **Total** | 44 | | | **~125k in / ~80k out** |

| Model choice | Price (in / out per 1M) | Cost per manual | With ~30% retries |
|---|---|---|---|
| All calls on `gemini-3.8-flash` | $0.75 / $3.75 | ~$0.39 | **~$0.50** |
| Index on Flash; parts + steps on `gemini-3.1-pro-preview` | $2.00 / $12.00 | ~$0.92 | **~$1.20** |
| One "Re-analyze live" click | — | ~$0.01 (Flash) to ~$0.04 (Pro) | |

**What the $300 CAD credit covers** (roughly $215 USD; check the current exchange rate):
- **About 180 full manual runs on the Pro mix, or about 400 on Flash.**
- A realistic hackathon load is 30–60 full runs plus a few hundred single-step test calls, about **$20–80 USD**. That leaves plenty of headroom.
- **Treat these as ±2× estimates:** thinking-token usage varies a lot. Measure it in hour 0. The API response includes token counts; log them per call.

**Billing:** through **Vertex AI on Google Cloud** (decided). Vertex list prices for these models are expected to match the Gemini API prices above, but confirm them on the Vertex AI pricing page during setup.

**Not yet confirmed:**
- That the exact model IDs above are available on Vertex AI in our chosen region. Preview models may only be offered in the `global` location.
- The rate limits on the account, since they affect how fast a manual processes.

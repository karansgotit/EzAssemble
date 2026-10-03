# EzAssemble: Full Technical Architecture

> **Exact field-by-field shapes live in `docs/CONTRACTS.md`; if this document and CONTRACTS ever disagree, CONTRACTS wins.**
>
> **Note for the AI assistant reading this (ChatGPT or similar):**
> The reader is a CS student learning ML engineering. They know Python and pandas, and are newer to TypeScript, React, web servers and 3D graphics. Please walk them through this document **one section at a time**, in order. For each section:
> - explain it in plain language;
> - tie each idea to the concrete KALLAX example used throughout;
> - check their understanding before moving on.
>
> Define any term before you use it; there is a glossary at the end (§17). Don't skip the example data: seeing the actual JSON at each stage is the point.

---

## 0. The whole app in one paragraph

A user uploads an IKEA assembly manual PDF (scope: IKEA only). **In the browser**, we turn each PDF page into an image. For each page, we ask **our own server** to ask **Gemini** "which assembly steps are on this page, and where?"; then we cut each step out of its page as its own small image. We ask Gemini once to list all the parts and roughly where each panel ends up in the finished furniture, and **our code** tidies that into clean 3D geometry. Then, for each step image, we ask Gemini to fill in a strict form describing the step ("insert 2 dowels into the long panel's front face, for shelf 1; place shelf 1 against it"). **Our code** checks every answer and asks again if it's invalid. Finally, **our 3D code** turns each form into an animation: it computes where every piece ends up, makes it glide or spin in, and draws it with three.js. For the demo, we run this once ahead of time and save the results as files, so judges see instant results, plus a button that re-runs one step live to prove it's real.

---

## 1. The three places code runs

```
┌─────────────────────────────┐      HTTPS (JSON)      ┌─────────────────────────────┐      HTTPS      ┌──────────────┐
│ 1. BROWSER (the user's      │  ───────────────────►  │ 2. OUR SERVER                │ ──────────────► │ 3. GEMINI    │
│    laptop, runs React)      │  ◄───────────────────  │    (Next.js API routes,      │ ◄────────────── │    (Google's │
│                             │                        │     on Vercel)               │                 │    AI API)   │
│ • reads the PDF (pdf.js)    │                        │ • holds the secret Google    │
│                             │                        │   Cloud credentials          │                 │ • looks at   │
│ • crops images (canvas)     │                        │ • builds prompts             │                 │   images,    │
│ • orchestrates the steps    │                        │ • calls Gemini               │                 │   returns    │
│ • runs ALL 3D + animation   │                        │ • validates with Zod         │                 │   JSON text  │
│ • shows the UI              │                        │ • retries on bad output      │                 │              │
└─────────────────────────────┘                        └─────────────────────────────┘                 └──────────────┘
```

**Why split it like this?**
- **Our Google Cloud credentials must never reach the browser.** Anyone can read code that runs in a browser, so all Gemini calls happen on the server. We call Gemini through **Vertex AI**, Google Cloud's AI service, because our $300 CAD of credits are Google Cloud credits.
- **Heavy image work stays in the browser** (PDF rendering, cropping). That keeps the server simple, and each request small enough for Vercel's limits (about 4.5 MB per request body).
- **3D runs in the browser,** because that's where the screen and the graphics card are.
- **The server is stateless:** it remembers nothing between requests. No database. Everything a request needs is sent with it.

---

## 2. Tech stack, and the job of each piece

| Piece | Where it runs | Its job in our app |
|---|---|---|
| **TypeScript** | everywhere | JavaScript with types. A typo like `step.actoins` is caught before the code runs. |
| **Next.js (App Router)** | browser + server | One project that contains both the web pages and the server endpoints (`app/api/.../route.ts`). Deploys to Vercel. |
| **React 19** | browser | Builds the UI from components; re-draws when state changes. |
| **three.js** | browser | The 3D engine: meshes (boxes and cylinders), camera, lights, WebGL drawing. |
| **@react-three/fiber (R3F)** | browser | Lets us write three.js scenes as React components: `<mesh position={[1,2,3]}>`. |
| **@react-three/drei** | browser | Ready-made R3F helpers: `<Edges>` (black outlines), `<OrbitControls>` (drag to rotate), `<ContactShadows>`, `<Html>` (labels in 3D). |
| **Zod v4** | browser + server | Defines our data "forms" (schemas) once; checks real data against them at runtime; also produces a JSON Schema to send to Gemini. |
| **@google/genai** | server | Google's official library for calling Gemini. |
| **pdfjs-dist (pdf.js)** | browser | Opens the PDF and draws each page onto a `<canvas>`. |
| **HTML Canvas** | browser | Draws images; we use it to crop step regions and export them as JPEG/PNG. |
| **Vitest** | dev machine | Runs unit tests and the AI-accuracy evaluation. |
| **Vercel** | cloud | Hosts the site and runs the API routes as serverless functions. |

---

## 3. Repository layout (every folder, every important file)

```
assembly-studio/
├── app/                                  ← Next.js: pages (Smit) + server routes (AI routes: Karan; save-manual: Smit)
│   ├── layout.tsx                        root HTML shell, fonts, global CSS
│   ├── page.tsx                          "/"         Library: list of processed manuals
│   ├── upload/page.tsx                   "/upload"   Upload a PDF + live processing view
│   ├── m/[id]/page.tsx                   "/m/kallax" Step player for one manual
│   └── api/
│       ├── index-page/route.ts           POST: one page image → steps on that page
│       ├── parts/route.ts                POST: parts page + cover + crops → parts & layout
│       ├── analyze-step/route.ts         POST: one step crop + context → Step form
│       └── save-manual/route.ts          POST (dev only): write a processed manual to /public
│
├── schema/                               ← The data contracts, shared by everyone        (Karan)
│   ├── common.ts                         Face, Vec3, Verb, PartKind, BuildOrientation
│   ├── ai/pageIndex.ts                   PageIndex (output of call 1)
│   ├── ai/partsLayout.ts                 PartsLayout (output of call 2)
│   ├── ai/step.ts                        Step / Action (output of call 3)
│   ├── saved.ts                          SavedManual / SavedStep / LibraryIndex (on disk)
│   ├── scene.ts                          SceneManual (what the 3D engine eats)
│   ├── api.ts                            request schemas + ApiResult
│   └── checks.ts                         semantic checks (pure; used by server AND browser)
│
├── pipeline/                             ← Server-only AI code                           (Karan)
│   ├── config.ts                         model names, temperature, retry count
│   ├── vertex.ts                         GoogleGenAI client configured for Vertex AI
│   ├── gemini.ts                         callStructured(): call → parse → validate → retry
│   ├── prompts.ts                        loadPrompt(): reads prompts/*.md, fills {{vars}}
│   ├── prompts/
│   │   ├── index-page.md                 instructions for call 1
│   │   ├── parts-layout.md               instructions for call 2
│   │   └── analyze-step.md               instructions for call 3
│   └── eval/
│       ├── run-eval.ts                   compares AI output to gold fixtures, prints scores
│       └── report.ts                     writes eval.html contact sheet
│
├── client/                               ← Browser-side processing                       (Smit)
│   ├── rasterize.ts                      PDF file → page images (pdf.js)
│   ├── crop.ts                           page image + box → cropped step image (canvas)
│   ├── api.ts                            typed fetch wrappers for our 4 routes
│   ├── api.mock.ts                       same interface, answers from gold fixtures (no AI)
│   ├── loadManual.ts                     fetch + validate library/manual JSON
│   └── processManual.ts                  the orchestrator: runs the whole upload pipeline
│
├── scene/                                ← 3D, pure logic + R3F components               (Ajit)
│   ├── geometry.ts                       face normals, face rectangles, projections, bounds
│   ├── layout.ts                         snapLayout(): rough AI layout → clean geometry
│   ├── buildSceneManual.ts               SavedManual → SceneManual (snap + steps + traps)
│   ├── consistency.ts                    does each placed part touch its target?
│   ├── resolveScene.ts                   data → exact pose of every piece at step N
│   ├── tracks.ts                         step → animation keyframes; sample(t)
│   ├── constants.ts                      colours, timings, HARDWARE_SCALE
│   ├── AssemblyScene.tsx                 the one component the player uses
│   ├── PartMesh.tsx                      one box/cylinder with outline edges
│   ├── MotionGuide.tsx                   dashed travel arrow
│   ├── CameraRig.tsx                     auto-framing + orbit controls
│   ├── Ghost.tsx                         wrong-vs-right ghost (red wrong → green right)
│   ├── FeatureMarker.tsx                 drilled-hole dots on panels
│   └── traps.ts                          PURE: finds geometry-based "possible mistakes" (§12b)
│
├── player/                               ← UI around the scene                           (Smit)
│   ├── StepPlayer.tsx                    page layout + all player state
│   ├── DiagramPanel.tsx                  shows the original manual crop
│   ├── PartsTray.tsx                     "what you'll use" list
│   ├── PlaybackBar.tsx                   play / pause / replay / speed / scrubber
│   ├── StepNav.tsx                       prev / next / step dots
│   ├── ConfidenceBanner.tsx              "AI is unsure" warning
│   ├── InfoStep.tsx                      diagram-only layout (no 3D)
│   └── ReanalyzeButton.tsx               "Re-analyze live"
│
├── fixtures/                             ← Hand-written correct answers (gold data)
│   ├── kallax.gold.json                  converted from the reference prototype's data
│   ├── lack.gold.json                    5–8 steps, written by Karan
│   └── malm.gold.json
│
├── public/manuals/                       ← Pre-processed manuals, served as static files
│   └── kallax/
│       ├── manual.json                   SavedManual (parts, layout, steps, index)
│       └── crops/step-01.jpg … step-19.jpg
│
├── tests/                                ← Vitest unit tests for pure functions
├── .env.local                            Google Cloud project, location, service-account key (never committed)
├── CLAUDE.md                             rules for Claude Code
└── package.json
```

**The rule that keeps three people from blocking each other:** folders have owners, and folders talk to each other only through the types in `schema/` and the one `<AssemblyScene />` component.

---

## 4. The data contracts (schemas), with real KALLAX examples

Everything flows through these shapes. Each is a Zod schema in `schema/`. `z.infer<>` turns each one into a TypeScript type, so the same definition is used for runtime checking *and* compile-time types.

### 4.1 Shared building blocks (`schema/common.ts`)

```ts
export const Face = z.enum(["top", "bottom", "left", "right", "front", "back"]);
export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export const Verb = z.enum(["insert", "attach", "screw", "lock", "place", "flip"]);
```

### 4.2 Call 1 output, the page index (`schema/pageIndex.ts`)

```ts
export const PageIndex = z.object({
  pageType: z.enum(["cover", "warning", "tools", "parts", "steps", "other"]),
  steps: z.array(z.object({
    stepNumber: z.number().int().min(1),
    box: z.tuple([z.number(), z.number(), z.number(), z.number()]), // [ymin, xmin, ymax, xmax], 0–1000
    variant: z.string().optional(),       // e.g. "vertical" / "horizontal" for branching steps
    subassembly: z.string().optional(),   // e.g. "drawer" if this step builds a separate unit
  })),
});
```
**Example (KALLAX page 9, which holds steps 3, 4 and 5):**
```json
{ "pageType": "steps",
  "steps": [
    { "stepNumber": 3, "box": [ 35, 20, 340, 980] },
    { "stepNumber": 4, "box": [370, 20, 725, 980] },
    { "stepNumber": 5, "box": [728, 20, 940, 980] } ] }
```
The box numbers are scaled 0–1000, the format Gemini natively uses for bounding boxes. To get pixels: `pixelY = ymin / 1000 * imageHeight`.

### 4.3 Call 2 output, parts and rough layout (`schema/parts.ts`)

```ts
export const Part = z.object({
  id: z.string(),                         // AI-invented, stable for the whole manual
  ikeaNumber: z.string().optional(),      // printed on hardware, e.g. "101339"
  label: z.string(),
  kind: z.enum(["panel", "leg", "dowel", "screw", "cam", "camBolt", "nail", "other"]),
  count: z.number().int().min(1),
  shape: z.enum(["box", "cylinder"]),
  sizeFrac: Vec3.optional(),              // panels: size as a fraction of the product size
  homeFrac: Vec3.optional(),              // panels: rough centre in the finished product, 0–1
  features: z.array(z.object({                // which face has drilled holes / the finished edge
    type: z.enum(["holes", "finished-edge"]), face: Face })).default([]),
  hardwareMm: z.object({ length: z.number(), diameter: z.number() }).optional(),
});
export const PartsLayout = z.object({
  buildOrientation: z.enum(["upright", "on-back", "upside-down", "on-side"]),
  parts: z.array(Part),
});
```
**Example (two KALLAX parts):**
```json
{ "buildOrientation": "on-back",
  "parts": [
    { "id": "S1", "label": "Shelf 1", "kind": "panel", "count": 1, "shape": "box",
      "sizeFrac": [0.02, 1.0, 0.9], "homeFrac": [0.26, 0.5, 0.5] },
    { "id": "dowel", "ikeaNumber": "101339", "label": "Wooden dowel", "kind": "dowel",
      "count": 22, "shape": "cylinder", "hardwareMm": { "length": 30, "diameter": 8 } } ] }
```
These are **rough** numbers. `snapLayout()` (§9) cleans them into exact centimetres.

### 4.4 Call 3 output, one step (`schema/step.ts`)

```ts
export const Action = z.object({
  verb: Verb,
  part: z.string(),                 // part id, or "assembly" for flip
  count: z.number().int().min(1),
  target: z.string().optional(),    // the part it goes into / against
  face: Face.optional(),            // which face OF THE TARGET
  for: z.string().optional(),       // hardware: which part these dowels/screws will hold
  at: z.enum(["start", "middle", "end", "all"]).optional(),
  flipMode: z.enum(["stand-up", "turn-over"]).optional(),
});
export const Step = z.object({
  stepNumber: z.number().int(),
  variant: z.string().optional(),
  kind: z.enum(["assembly", "info", "subassembly"]),
  sourceSteps: z.array(z.number()).optional(),   // subassembly: original manual step numbers
  instruction: z.string().min(10).max(220),
  actions: z.array(Action).max(4),
  orientationTrap: z.object({          // ONLY when the manual itself draws the mistake
    part: z.string(), mustFace: Face,
    wrong: z.enum(["flipped-vertical", "flipped-horizontal", "rotated-90"]),
    hint: z.string().max(80),
    source: z.literal("manual"),
  }).optional(),
  confidence: z.enum(["high", "medium", "low"]),
});
```
**Example (KALLAX step 3):**
```json
{ "stepNumber": 3, "kind": "assembly", "confidence": "high",
  "instruction": "Tap 2 dowels into the long panel and push the first shelf onto them.",
  "actions": [
    { "verb": "insert", "part": "dowel", "count": 2, "target": "L1", "face": "front", "for": "S1" },
    { "verb": "place",  "part": "S1",    "count": 1, "target": "L1", "face": "front" } ] }
```

### 4.5 What we save to disk (`schema/manual.ts`)

```ts
export const SavedManual = z.object({
  id: z.string(), title: z.string(),
  productSizeCm: Vec3,                         // typed in by the uploader
  pages: z.array(PageIndex),                   // raw call-1 output per page
  layout: PartsLayout,                         // raw call-2 output
  steps: z.array(Step.extend({                 // raw call-3 output per step
    status: z.enum(["ok", "failed"]),
    crop: z.string(),                          // "crops/step-03.jpg"
    attempts: z.number(),
  })),
  createdAt: z.string(),
});
```

**Important principle: we store the raw AI output, not the computed geometry.** Geometry (`snapLayout`, `resolveScene`) is recomputed in the browser every time a manual opens. So if Ajit improves the snapping code at hour 15, every saved manual improves automatically, without calling Gemini again.

---

## 5. Flow A: processing an uploaded manual (the full pipeline)

This is the heart of "works for any IKEA manual". `client/processManual.ts` runs it, in the browser.

```
USER drops kallax.pdf, types size 77 × 147 × 39 cm
        │
        ▼
[A1] rasterize(pdf)                                    (browser, pdf.js)
        24 pages → 24 JPEG images (~150 dpi, ~300 KB each)
        │
        ▼
[A2] for each page (4 at a time):  POST /api/index-page { image }
        server → Gemini (call 1) → Zod check → { pageType, steps[] }
        │   result: 1 cover, 4 warning, 1 tools, 1 parts, 17 step pages,
        │           19 steps (+5 "horizontal" variants)
        ▼
[A3] keep variant #1 of branching steps; check step numbers 1..19 are all there;
     replace consecutive steps tagged with the same `subassembly` (e.g. MALM drawers)
     with ONE step: kind "subassembly", sourceSteps [20..31], template message
     "assembled separately, follow the manual"; no diagrams, no 3D, no Gemini call
        ▼
[A4] for each step: crop(pageImage, box) → step-NN.jpg                  (browser, canvas)
        ▼
[A5] POST /api/parts { partsPages[], coverPage, smallCrops[], productSizeCm }
        server → Gemini (call 2) → Zod + semantic checks → PartsLayout
        ▼
[A6] snapLayout(PartsLayout, productSizeCm) → exact cm geometry          (browser, our code)
        if it reports overlaps → re-call /api/parts with the errors (max 2 times)
        ▼
[A7] for step 1..19, IN ORDER:  POST /api/analyze-step {
          image: crop, parts, placedPartIds, previousInstructions, stepNumber }
        server → Gemini (call 3) → Zod + semantic checks → Step   (or status "failed")
        └─► each finished step appears in the player immediately (streaming feel)
        ▼
[A8] consistency check (browser): does every place/attach target really touch
     the placed part in the snapped layout? If not → mark step confidence "low"
        ▼
[A9] Player shows the manual. (Dev only) "Save to library" → POST /api/save-manual
        writes public/manuals/kallax/manual.json + crops/
```

**Why are steps analysed in order and not all at once?** Each step call is given `placedPartIds`, the parts already built. That helps Gemini tell "shelf 2" from "shelf 1", since they look identical. The cost is time: about 19 steps × ~8 s ≈ 2.5 minutes. That's fine, because:
- we pre-process before judging;
- the live demo only shows the first 1–2 steps arriving.

Pages, in A2, have no such dependency, so they run 4 at a time.

**Where the time goes (rough estimates, to be measured in hour 0):**
- Rasterize: about 3 s.
- Index: 24 pages ÷ 4 at a time × ~4 s ≈ 25 s.
- Parts: about 10 s.
- Steps: about 2.5 min.

### Code sketch: the orchestrator (`client/processManual.ts`)

```ts
export async function processManual(file: File, productSizeCm: Vec3, onUpdate: (d: Draft) => void) {
  const pages = await rasterize(file);                                   // A1
  const index = await mapLimit(pages, 4, p => api.indexPage(p.jpegBase64)); // A2
  const stepRefs = pickVariantAndValidate(index);                        // A3
  const crops = await Promise.all(stepRefs.map(r => crop(pages[r.page], r.box))); // A4

  let layout = await api.parts({ partsPages: …, cover: …, smallCrops: …, productSizeCm }); // A5
  let snapped = snapLayout(layout, productSizeCm);                       // A6
  if (!snapped.ok) layout = await api.parts({ …, previousErrors: snapped.errors });

  const steps: SavedStep[] = [];
  for (const [i, c] of crops.entries()) {                                // A7
    const res = await api.analyzeStep({
      image: c.jpegBase64, parts: layout.parts,
      placedPartIds: placedSoFar(steps), previousInstructions: steps.map(s => s.instruction),
      stepNumber: stepRefs[i].stepNumber });
    steps.push(res.ok ? { ...res.data, status: "ok" } : failedStep(stepRefs[i]));
    onUpdate({ layout, steps, crops });                                  // UI re-renders
  }
  return markInconsistentSteps({ layout, steps, crops });                // A8
}
```

---

## 6. Inside an API route (server side)

All three AI routes follow the same pattern. Here is `/api/analyze-step`:

```ts
// app/api/analyze-step/route.ts
import { AnalyzeStepRequest } from "@/schema/requests";
import { Step } from "@/schema/step";
import { callStructured } from "@/pipeline/gemini";
import { checkStep } from "@/schema/checks";
import { loadPrompt } from "@/pipeline/prompts";

export const maxDuration = 60;            // seconds Vercel lets this function run (check plan limit)

export async function POST(req: Request) {
  const body = AnalyzeStepRequest.safeParse(await req.json());   // 1. validate what the browser sent
  if (!body.success) return Response.json({ error: body.error.message }, { status: 400 });

  const { image, parts, placedPartIds, previousInstructions, stepNumber } = body.data;
  const result = await callStructured({                          // 2. ask Gemini, validated + retried
    prompt: loadPrompt("analyze-step", { parts, placedPartIds, previousInstructions, stepNumber }),
    images: [image],
    schema: Step,
    semanticCheck: (step) => checkStep(step, parts, placedPartIds),
  });
  return Response.json(result);                                  // 3. { ok, data, attempts } or { ok:false, errors }
}
```

### The shared Gemini wrapper (`pipeline/gemini.ts`)

This one function is where **all** AI reliability lives:

```ts
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { MODELS, RETRIES } from "./config";

// Vertex AI (Google Cloud credits). VERIFY the exact auth options in the pre-event test.
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? "global",     // preview models may need "global"
  googleAuthOptions: { credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!) },
});

export async function callStructured<T>({ prompt, images, schema, semanticCheck, model = MODELS.strong }: {
  prompt: string; images: string[]; schema: z.ZodType<T>;
  semanticCheck?: (data: T) => string[]; model?: string;
}): Promise<{ ok: true; data: T; attempts: number } | { ok: false; errors: string[]; attempts: number }> {
  let errors: string[] = [];
  for (let attempt = 1; attempt <= RETRIES + 1; attempt++) {
    const fullPrompt = errors.length
      ? `${prompt}\n\nYour previous answer was rejected for these reasons. Fix them:\n- ${errors.join("\n- ")}`
      : prompt;
    const res = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [
        { text: fullPrompt },
        ...images.map(data => ({ inlineData: { mimeType: "image/jpeg", data } })) ] }],
      config: {
        temperature: 0,
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(schema),   // VERIFY exact option name in hour 0
      },
    });
    let json: unknown;
    try { json = JSON.parse(res.text ?? ""); }
    catch { errors = ["Response was not valid JSON."]; continue; }

    const parsed = schema.safeParse(json);
    if (!parsed.success) { errors = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`); continue; }

    errors = semanticCheck?.(parsed.data) ?? [];
    if (errors.length === 0) return { ok: true, data: parsed.data, attempts: attempt };
  }
  return { ok: false, errors, attempts: RETRIES + 1 };
}
```

### Semantic checks (`schema/checks.ts`), examples of what Zod alone can't catch

- `action.part` / `target` / `for` must be ids that exist in `parts`.
- `insert` / `screw` / `lock` only on hardware; `attach` / `place` only on panels.
- `target` must already be placed (in `placedPartIds`) or be placed earlier in this same step.
- An `assembly` step needs at least 1 action.
- `orientationTrap.part` must appear in this step's actions.
- Each failure is returned as a plain sentence, e.g. `"action 2: target 'L3' is not a known part id"`, which is exactly what we feed back to Gemini on retry.

---

## 7. The prompts (what we actually say to Gemini)

Prompts live in `pipeline/prompts/*.md`, separate from code, so Karan can iterate on them without touching TypeScript. `{{placeholders}}` get filled in by `loadPrompt()`.

**`analyze-step.md` (abridged):**
```
You are reading one step of a wordless IKEA furniture assembly manual.

PARTS IN THIS PRODUCT (use ONLY these ids):
{{parts}}                      ← JSON list: id, label, kind, count

ALREADY ASSEMBLED BEFORE THIS STEP: {{placedPartIds}}
PREVIOUS STEPS: {{previousInstructions}}
THIS IS STEP {{stepNumber}}.

Describe what happens in this step using ONLY these verbs:
- insert: push hardware (dowel, cam) into a part      - screw: drive a screw/bolt in
- lock: turn a cam lock                                - place/attach: move a panel into position
- flip: turn the whole assembly over / stand it up
For each action give: part, count (read "2x" labels), target part, which face of the target,
and for hardware, which part it is "for" (the part that will sit on it).

Faces are relative to the assembly as built in this step: top=up, front=toward the viewer.
If the image has no assembly action (warnings, wall fixing), set kind "info" and actions [].
Write "instruction" as one friendly sentence for a beginner, max 25 words.
ONLY if the image itself contains a crossed-out wrong way or a zoomed detail of which way
holes/edges must face, fill orientationTrap (source "manual"). Otherwise leave it out.
Set confidence "low" if you had to guess any part identity.
```

The other two prompts follow the same style.
- **`index-page.md`:** classify the page and box each step number region.
- **`parts-layout.md`:** list every part using the parts page; estimate each panel's size and rough centre as fractions of the product size, using the cover picture of the finished product; state the build orientation.

**Prompt-improvement loop (Karan):** edit prompt → `npm run eval` → compare scores against gold → repeat.

---

## 8. Flow B: opening a pre-processed manual (what judges see)

```
User clicks "KALLAX 2×4" in the library
   │
   ▼
app/m/[id]/page.tsx  →  fetch("/manuals/kallax/manual.json")   (static file, instant, no AI)
   │
   ▼
SavedManual.parse(json)          ← Zod check; if invalid → red error screen, never a blank page
   │
   ▼
const geometry = snapLayout(manual.layout, manual.productSizeCm)   ← deterministic, ~1 ms
   │
   ▼
<StepPlayer manual={manual} geometry={geometry} />
   ├─ <DiagramPanel src="/manuals/kallax/crops/step-03.jpg" />
   ├─ <AssemblyScene … stepIndex={2} />          ← all 3D (§10–§12)
   ├─ <ConfidenceBanner />, instruction text
   └─ <PlaybackBar />, <StepNav />, <ReanalyzeButton />
```

### Player state (in `StepPlayer.tsx`, plain React `useState`)

| State | Meaning |
|---|---|
| `stepIndex` | which step is shown (0-based) |
| `playKey` | a counter; incrementing it restarts the animation (Replay) |
| `playing`, `speed`, `scrubT` | playback controls |
| `seenTraps` | which warning steps already auto-played their ghost |
| `liveOverrides` | `Map<stepIndex, Step>` holding results from "Re-analyze live" for this session |

No global state library is needed: one component owns this state and passes it down as props.

---

## 9. `snapLayout()`: from rough AI guesses to clean geometry (`scene/layout.ts`)

**The problem:** Gemini says shelf 1's centre is at `[0.26, 0.5, 0.5]` of the product and its size is `[0.02, 1.0, 0.9]`. Raw, that gives a shelf that's slightly too thick, floats 3 mm away from the side panel, and pokes through the divider.

**The algorithm** (pure function, unit-tested):
1. **Scale:** `centreCm = homeFrac × productSizeCm`; `sizeCm = sizeFrac × productSizeCm`. These sizes are in the **build frame** (as built in the manual, e.g. lying on its back).
2. **Thickness classes:** each panel's thinnest dimension snaps to the nearest of `[1.2, 1.6, 1.8, 2.5, 3.8]` cm.
3. **Snap to the outer box:** if a panel face is within 4% of the product's boundary, move the panel flush to it.
4. **Snap to neighbours:** for every pair of panels, if facing faces are within 4% of the product size, close the gap. Repeat until nothing moves (at most 5 passes).
5. **Even spacing:** parts with the same label root (Shelf 1, 2, 3) that are parallel are respaced evenly between their outer neighbours.
6. **Validate** and return `{ ok, parts, errors }`:
   - No overlaps deeper than 0.2 cm.
   - Every panel touches at least one other panel.
   - Everything lies inside the product box.
   - Errors read like `"S2 overlaps D3 by 1.4 cm"` and are sent back to call 2.

**Output:** for every panel, an exact `sizeCm` and `homeCm`, the same numbers the prototype had typed in by hand.

**Status:** this is the least-proven piece. **Spike #2 in hours 0–3** tests it by adding ±8% random noise to the gold KALLAX layout and checking that it snaps back.

---

## 10. `resolveScene()`: where every piece is at step N (`scene/resolveScene.ts`)

A **pure function**: same input gives the same output, and nothing outside it changes.

```ts
resolveScene(geometry, steps, upToStep): {
  instances: Map<string, Instance>,      // "dowel#3" → { position, rotation, size, shape }
  stepActions: ResolvedAction[][],       // per step: which instances each action moved
  assemblyPose: Pose,                    // whole-assembly rotation (after flips)
}
```

**How it works:** it loops over steps 1..N and their actions:

| Verb | What resolveScene does |
|---|---|
| `place` / `attach` | Add the panel at its snapped `homeCm`. |
| `insert` / `screw` | Claim the next unused instances (`dowel#3`, `dowel#4`). Compute their position: take the target's face rectangle, project the `for` part's box onto it to get the **overlap strip** where the two parts meet, and spread the pieces evenly along that strip's long side. Dowels are half-sunk; screws are fully sunk. |
| `lock` | Reuse the last inserted cams; add a 90° turn. |
| `flip` | Set `assemblyPose` (e.g. stand-up: long axis vertical). |

**Worked example, step 3:**
- `L1`'s front face is the plane z = 3.8 cm, spanning x 3.8…143.2 and y 0…39.
- `S1`'s box projected onto that plane covers x 37.45…39.05 and y 0…39, so that's the overlap strip.
- The strip's long side runs along y, so the 2 dowels go at y = 25% and 75% of 39 cm, with x = 38.25 and z = 3.8.

**This is why the AI never has to output coordinates:** it only says "for S1", and the geometry does the rest.

---

## 11. `buildTracks()` and `sample()`: turning a step into motion (`scene/tracks.ts`)

A **track** is one piece's movement: `{ instanceId, from: Pose, to: Pose, start, duration, kind }`.

```ts
const before = resolveScene(geometry, steps, n - 1);   // the world before this step
const after  = resolveScene(geometry, steps, n);       // the world after this step
const { tracks, totalDuration } = buildTracks(steps[n], before, after);
```

**Motion recipes, one per verb:**

| Verb | `from` pose | Duration | Extra |
|---|---|---|---|
| insert | 6 cm out along the face normal | 0.8 s | small "tap" bounce at the end |
| screw | 6 cm out along the normal | 1.4 s | 3 full turns around its axis |
| lock | same position | 0.5 s | 90° turn |
| place / attach | moved out along the target face's normal by 35% of its size + 10 cm | 1.2 s | dashed arrow shows the path |
| flip | the previous assemblyPose | 2.0 s | rotation is interpolated smoothly (slerp) |

**Timing:**
- Actions play one after another, with a 0.25 s gap between them.
- Several pieces in one action are staggered by 0.15 s each.
- 0.4 s hold at the end.

```ts
sample(tracks, t) → Map<instanceId, Pose>
// for each track: progress = clamp((t - start) / duration, 0, 1)
//                 eased    = easeInOutCubic(progress)
//                 position = lerp(from.position, to.position, eased)
//                 rotation = lerp/slerp(from.rotation, to.rotation, eased)
```

---

## 12. Rendering: what happens every frame (`scene/AssemblyScene.tsx`)

```
<Canvas>                                      ← R3F creates the WebGL canvas + render loop
  <CameraRig bounds={focus} />                ← fits camera to the moving parts on step change
  <OrbitControls />                           ← user drag/zoom
  <ambient/hemisphere/directional lights />
  <ContactShadows /> + floor
  <group rotation={assemblyPose}>             ← flips rotate this whole group
    {instances.map(i =>
      <PartMesh key={i.instanceId}            ← <mesh> box/cylinder + <Edges> outline
                pose={animatedPose(i)}        ← from sample(tracks, t) if moving, else resolved pose
                colour={isCurrentStep(i) ? yellow : white}
                opacity={…} />)}
    {moving → <MotionGuide />}                ← dashed arrows
    {holes → <FeatureMarker />}               ← drilled-hole dots
  </group>
  {trap && <Ghost />}                         ← red wrong → green right, before the main animation
</Canvas>
```

**Every frame (~60 times a second),** the R3F hook `useFrame((state, delta) => …)`:
1. advances the clock: `t += delta × speed` (unless paused; the scrubber overrides `t`);
2. calls `sample(tracks, t)` to get the current pose of every moving piece;
3. lets React update those meshes' positions; three.js then draws the frame on the graphics card.

**Sub-assembly steps** (`kind: "subassembly"`) have no 3D and no diagrams: just a message card ("The 2 drawers are assembled separately; follow manual steps 20–31") and a Continue button. In the next step, the finished unit (e.g. a drawer) appears as a single box and slides into the frame.

---

## 12b. Wrong vs right: where the ghost comes from

`scene/traps.ts` decides, for each step, whether to show a ghost. There are two sources of evidence, and with no evidence there's no ghost.

1. **From the manual** (`step.orientationTrap`, `source: "manual"`). Call 3 fills this only when the step image draws a crossed-out wrong way, or a zoomed detail of which way holes must face. Example: KALLAX steps 1 and 13.
2. **From the geometry** (pure function, no AI). For each `place` / `attach` of a panel, the step qualifies when:
   - the panel is a plain box (it looks identical when flipped); **and**
   - the parts list says it has holes on exactly one face; **and**
   - those holes face the part it joins.

   Then `wrong` = the 180° flip that moves the holes to the opposite face. The ghost auto-plays only on the first step that places each kind of panel; later steps get a "Show possible mistake" button.

**Ghost sequence** (before the main animation):
- 0–1.2 s: red, see-through copy of the panel in the `wrong` pose, with hole dots on the wrong side, labelled "✗ From the manual" or "✗ Possible mistake".
- 1.2–2.2 s: it rotates to the correct pose and fades to green, labelled "✓ " + hint.
- 2.2–2.6 s: it fades out, then the normal tracks start.

---

## 13. Flow C: "Re-analyze live" (proving it's real during judging)

```
Judge presses "Re-analyze live" on step 3
  │
  ▼ browser: fetch("/manuals/kallax/crops/step-03.jpg") → base64
  ▼ POST /api/analyze-step { image, parts, placedPartIds (from steps 1–2), previousInstructions, stepNumber: 3 }
  ▼ server: callStructured → Gemini → Zod → checks → (retry?) → { ok, data, attempts }
  │
  ├─ ok    → liveOverrides.set(2, data) → the scene rebuilds from the new Step → animation replays
  │          + small badge: "Live result · 1 attempt · 6.2 s"
  └─ error / >20 s timeout → toast "Live analysis unavailable"; the cached result stays on screen
```

The browser sends the image to the server rather than the server reading it from `public/`. That way the same route serves both uploads and re-analysis, and we don't depend on how Vercel lays out files.

---

## 14. Flow D: saving to the library (dev only)

After processing a manual locally, press **"Save to library"**. Then:
1. `POST /api/save-manual { manual, crops[] }`.
2. The route refuses unless `process.env.NODE_ENV === "development"`.
3. It writes `public/manuals/<id>/manual.json` and `crops/step-NN.jpg` to disk.
4. We review the files (the human check), fix anything by hand, and commit them to git.
5. On deploy, Vercel serves them as static files.

That's the entire "cache". No database.

---

## 15. Errors and fallbacks, layer by layer

| Where | What goes wrong | What the user sees |
|---|---|---|
| Upload | Not a PDF / can't open | "We couldn't read this PDF" |
| Index | A page fails twice | Page skipped; steps on it are missing → shown as "step N not found" in the list |
| Parts | Fails twice | Processing stops: "Couldn't identify the parts in this manual" |
| snapLayout | Overlaps it can't resolve | Retry call 2 with the errors; if it still fails, render with unsnapped geometry and confidence "low" everywhere |
| Analyze step | Fails twice | Step `status: "failed"` → diagram-only layout + "Follow the original diagram for this step" |
| Consistency check | Target not touching | Step confidence → "low" → amber banner |
| Renderer | Unknown id in an action | That action is skipped; the rest of the step still plays |
| Saved JSON | Fails Zod on load | Red error screen listing the problems |
| Gemini down during demo | — | Cached data still works; live button shows "unavailable" |
| No internet | — | Run locally (`npm run build && npm start`); all demo data is static files |

---

## 16. Running, testing, deploying

**Local setup**
```bash
npm install
```
```bash
cp .env.example .env.local
```
Then fill in `.env.local`:
- `GOOGLE_CLOUD_PROJECT`: the Google Cloud project that has the credits.
- `GOOGLE_CLOUD_LOCATION`: e.g. `global`.
- `GOOGLE_SERVICE_ACCOUNT_JSON`: the key file of a service account with the "Vertex AI User" role, pasted as one line.

**One-time Google Cloud setup** (before the event):
1. Apply the credits to a project.
2. Enable the Vertex AI API.
3. Create the service account and download its key.
4. Make one test call.

```bash
npm run dev
```
```bash
npm test
```
```bash
npm run eval
```
- `npm run dev` serves the app at http://localhost:3000.
- `npm test` runs the unit tests: layout, resolveScene, tracks, checks.
- `npm run eval` scores AI output against the gold fixtures.

**What the tests cover (pure functions only):**
- `snapLayout`: the noisy gold layout snaps back within 0.5 cm, with no overlaps.
- `resolveScene`: the dowels for S1 land at x ≈ 38.25; the totals come to 22 dowels and 8 screws.
- `tracks`: `sample` at t=0 returns `from`, at the end returns `to`; a screw ends with 3 turns.
- `checks`: bad ids, over-counted parts and wrong verbs are all rejected with readable messages.

**Deploy:** push to GitHub → import the repo in Vercel → add the three `GOOGLE_*` variables in Vercel's settings → it deploys on every push. Set `maxDuration` on the AI routes and check the plan's timeout on the first deploy.

**Working with Claude Code:** the repo's `CLAUDE.md` tells it:
- the folder owners;
- "AI output must always pass through `callStructured` and Zod";
- "functions in `scene/*.ts` (non-component) must stay pure and tested";
- "run `npm test` before committing".

Each teammate runs Claude Code in their own folder area to avoid edit conflicts.

---

## 17. Glossary

- **API route / route handler:** a function on our server that runs when the browser sends a request to a URL like `/api/analyze-step`.
- **Serverless function:** Vercel starts our route code on demand for each request; there's no always-on server to manage.
- **Stateless:** the server keeps no memory between requests; each request carries everything it needs.
- **Schema:** a formal description of the shape data must have ("`count` is a whole number ≥ 1").
- **Zod:** a TypeScript library for writing schemas and checking data against them at runtime.
- **JSON Schema:** a standard, language-neutral way to describe JSON shapes; we generate it from Zod and give it to Gemini.
- **Structured output:** asking the AI to return JSON matching a schema, instead of free text.
- **Semantic check:** a rule about *meaning* that a schema can't express, e.g. "this part id must exist".
- **Base64:** a way to encode an image's bytes as text so it can travel inside JSON.
- **Bounding box:** a rectangle around something in an image, given as `[ymin, xmin, ymax, xmax]`.
- **Rasterize:** turn a PDF page (vector drawing instructions) into a grid of pixels (an image).
- **Canvas:** an HTML element you can draw images on and export from; we use it for cropping.
- **Build frame:** the 3D coordinate system of the furniture *as the manual builds it* (KALLAX: lying on its back).
- **Face normal:** the direction pointing straight out of a flat face, e.g. the top face's normal points up `[0,1,0]`.
- **Pose:** a position plus a rotation.
- **Instance:** one physical copy of a part (`dowel#3` is the third dowel).
- **Pure function:** output depends only on input, and it changes nothing else; easy to test.
- **Deterministic:** same input always gives the same output (unlike AI calls).
- **Track / keyframe:** a description of how one piece moves from one pose to another over time.
- **Interpolation (lerp / slerp):** computing in-between values; lerp for positions, slerp for smooth rotations.
- **Easing:** making motion start slow, speed up, then slow down, so it looks natural.
- **Render loop / frame:** the browser redraws the 3D scene about 60 times a second; each redraw is a frame.
- **WebGL:** the browser's interface to the graphics card; three.js uses it to draw.
- **Gold fixture:** a hand-written, known-correct answer we compare AI output against.
- **Spike:** a short, throwaway experiment to prove a risky idea works before building on it.

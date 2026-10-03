# CONTRACTS: the interfaces everyone codes against

> **This file is the source of truth for every shared data shape, API endpoint and component prop.**
> Three people work in parallel. They stay compatible only if everyone uses exactly these shapes.
> - The Zod code below is copied verbatim into `schema/` by task **KAR-01**.
> - **Changing anything here** requires a PR titled `CONTRACT: …`, an update to this file in the same PR, and a message in team chat. See `CONVENTIONS.md` §4.
> - Claude Code sessions: **never change a contract silently.** If your task seems to need a change, stop and tell your human.

---

## 0. Big picture: which shape flows where

```
PDF ──► PageIndex (call 1, per page) ──► step crops
                                          │
          PartsLayout (call 2, once) ◄────┘
                │
                ▼
          Step (call 3, per step)
                │
                ▼
SavedManual  = { productSizeCm, pages: PageIndex[], layout: PartsLayout, steps: SavedStep[] }
                │   (stored in public/manuals/<id>/manual.json — RAW AI output, no geometry)
                ▼
buildSceneManual(saved)  ← scene/layout.ts (snapLayout + trap derivation)
                │
                ▼
SceneManual  = parts with exact cm geometry + steps + resolved traps   ← what the 3D engine eats
                │
                ▼
<AssemblyScene manual={SceneManual} … />
```

There are **three layers of shapes**:
1. **AI shapes** (`schema/ai/*`): what Gemini must return. These are kept small and use fractions instead of centimetres.
2. **Stored shape** (`schema/saved.ts`): exactly what we save to disk: the raw AI output plus metadata.
3. **Scene shape** (`schema/scene.ts`): what the renderer needs, computed from the stored shape every time a manual opens.

---

## 1. `schema/common.ts`

```ts
import { z } from "zod";

export const Face = z.enum(["top", "bottom", "left", "right", "front", "back"]);
export type Face = z.infer<typeof Face>;

export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3>;

export const Verb = z.enum(["insert", "attach", "screw", "lock", "place", "flip"]);
export type Verb = z.infer<typeof Verb>;

export const PartId = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/);

export const PartKind = z.enum(["panel", "leg", "dowel", "screw", "cam", "camBolt", "nail", "other"]);
export type PartKind = z.infer<typeof PartKind>;
export const HARDWARE_KINDS: PartKind[] = ["dowel", "screw", "cam", "camBolt", "nail"];

export const BuildOrientation = z.enum(["upright", "on-back", "upside-down", "on-side"]);
export type BuildOrientation = z.infer<typeof BuildOrientation>;

export const Confidence = z.enum(["high", "medium", "low"]);

export const WrongOrientation = z.enum(["flipped-vertical", "flipped-horizontal", "rotated-90"]);
```

---

## 2. AI shapes (`schema/ai/`)

### 2.1 Call 1: `PageIndex` (`schema/ai/pageIndex.ts`)

```ts
export const PageIndex = z.object({
  pageType: z.enum(["cover", "warning", "tools", "parts", "steps", "other"]),
  steps: z.array(z.object({
    stepNumber: z.number().int().min(1).max(200),
    box: z.tuple([z.number(), z.number(), z.number(), z.number()]),  // [ymin, xmin, ymax, xmax], 0–1000
    variant: z.string().max(30).optional(),       // branching steps, e.g. "vertical" | "horizontal"
    subassembly: z.string().max(30).optional(),   // e.g. "drawer" if this step builds a separate unit
  })),
});
```
**Rules:**
- `steps` is empty unless `pageType === "steps"`.
- Every box has `ymin < ymax` and `xmin < xmax`, with all values within 0–1000.

### 2.2 Call 2: `PartsLayout` (`schema/ai/partsLayout.ts`)

```ts
export const AiPart = z.object({
  id: PartId,                                  // stable for the whole manual, e.g. "long_panel_1"
  ikeaNumber: z.string().max(12).optional(),   // printed on hardware only, e.g. "101339"
  label: z.string().max(40),                   // "Long side panel"
  kind: PartKind,
  count: z.number().int().min(1).max(64),
  shape: z.enum(["box", "cylinder"]),
  sizeFrac: Vec3.optional(),                   // panel/leg/other: size in BUILD frame, as fraction of build-frame size (0–1]
  homeFrac: Vec3.optional(),                   // panel/leg/other: centre in BUILD frame, as fraction (0–1)
  hardwareMm: z.object({ length: z.number().positive(), diameter: z.number().positive() }).optional(),
  features: z.array(z.object({
    type: z.enum(["holes", "finished-edge"]),
    face: Face,                                // in BUILD frame
  })).default([]),
});
export type AiPart = z.infer<typeof AiPart>;

export const PartsLayout = z.object({
  buildOrientation: BuildOrientation,
  parts: z.array(AiPart).min(1).max(80),
});
export type PartsLayout = z.infer<typeof PartsLayout>;
```
**Rules:**
- Ids are unique.
- Hardware kinds have `hardwareMm` and no `sizeFrac`/`homeFrac`.
- Non-hardware kinds have `sizeFrac` and `homeFrac`.
- A finished sub-assembly (e.g. a drawer) is **one** part with `kind: "other"`, `shape: "box"`, and `count` = how many.

### 2.3 Call 3: `Step` (`schema/ai/step.ts`)

```ts
export const Action = z.object({
  verb: Verb,
  part: z.union([PartId, z.literal("assembly")]),  // "assembly" only for verb "flip"
  count: z.number().int().min(1).max(32),
  target: PartId.optional(),        // the part it goes into / against (not for flip)
  face: Face.optional(),            // face OF THE TARGET, in BUILD frame
  for: PartId.optional(),           // hardware only: the part this hardware will hold
  at: z.enum(["start", "middle", "end", "all"]).optional(),  // hardware fallback if no `for`
  flipMode: z.enum(["stand-up", "turn-over"]).optional(),    // flip only
});
export type Action = z.infer<typeof Action>;

export const ManualTrap = z.object({     // ONLY when the manual image itself draws the mistake
  part: PartId,
  mustFace: Face,                        // which way the holes/edge must face (BUILD frame)
  wrong: WrongOrientation,
  hint: z.string().max(80),              // "Drilled holes face inward"
  source: z.literal("manual"),
});

export const Step = z.object({
  stepNumber: z.number().int().min(1),
  variant: z.string().max(30).optional(),
  kind: z.enum(["assembly", "info"]),    // "subassembly" is never produced by AI; see SavedStep
  instruction: z.string().min(10).max(220),
  actions: z.array(Action).max(4),
  orientationTrap: ManualTrap.optional(),
  confidence: Confidence,
});
export type Step = z.infer<typeof Step>;
```

### 2.4 Semantic checks (`schema/checks.ts`: pure, shared by server and browser), which Zod can't express

`checkPartsLayout(layout)` and `checkStep(step, parts, placedPartIds)` return `string[]`; an empty array means valid. Each message is one plain sentence, because it gets pasted back to Gemini on retry.

| Rule | Example message |
|---|---|
| `part` / `target` / `for` / `orientationTrap.part` must exist in `parts` | `action 2: target "L3" is not a known part id` |
| insert / screw / lock only on hardware kinds | `action 1: "insert" needs hardware, but "shelf_1" is a panel` |
| attach / place only on non-hardware kinds | `action 1: "place" needs a panel, but "dowel" is hardware` |
| hardware actions need `target` and `face` | `action 1: hardware needs a target and a face` |
| `target` must be already placed or placed earlier in this step | `action 2: target "S2" has not been placed yet` |
| `assembly` steps need ≥ 1 action; `info` steps need 0 | `kind "assembly" requires at least one action` |
| flip: `part` is `"assembly"` and has a `flipMode` | `action 1: flip must use part "assembly" and a flipMode` |
| trap part appears in this step's actions | `orientationTrap.part "L1" does not appear in the actions` |
| (layout) ids unique; hardware vs panel fields as in §2.2; fractions in (0, 1] | `part "S1": panels need sizeFrac and homeFrac` |

**Cumulative count check** (all steps together): the orchestrator checks that total instances used per part ≤ `count`, after all steps are done. If a part is over-used, the offending steps are marked `confidence: "low"`.

---

## 3. Stored shapes (`schema/saved.ts`)

```ts
export const SavedStep = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), step: Step, crop: z.string(), attempts: z.number().int() }),
  z.object({ status: z.literal("failed"), stepNumber: z.number().int(), crop: z.string(),
             errors: z.array(z.string()), attempts: z.number().int() }),
  z.object({ status: z.literal("subassembly"), stepNumber: z.number().int(),   // = first source step
             sourceSteps: z.array(z.number().int()).min(1), label: z.string(),   // "drawer"
             message: z.string() }),                                              // template text, no AI
]);
export type SavedStep = z.infer<typeof SavedStep>;

export const SavedManual = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),     // "kallax", "lack", "malm"
  title: z.string(),                              // "KALLAX 2×4 shelving unit"
  productSizeCm: Vec3,                            // UPRIGHT [width, height, depth], typed by uploader
  pages: z.array(PageIndex),                      // raw call-1 output, index = page number - 1
  layout: PartsLayout,                            // raw call-2 output
  steps: z.array(SavedStep),                      // in display order
  createdAt: z.string(),                          // ISO date
  usage: z.object({ calls: z.number(), inputTokens: z.number(), outputTokens: z.number(),
                    estUsd: z.number() }).optional(),
});
export type SavedManual = z.infer<typeof SavedManual>;

export const LibraryIndex = z.array(z.object({
  id: z.string(), title: z.string(), stepCount: z.number().int(),
  thumbnail: z.string(),        // path relative to the manual folder, e.g. "crops/step-01.jpg"
  createdAt: z.string(),
}));
```

**Files on disk:**
```
public/manuals/index.json                 LibraryIndex
public/manuals/<id>/manual.json           SavedManual
public/manuals/<id>/crops/step-NN.jpg     one per non-subassembly step (NN = 2-digit stepNumber)
```

**The template message for a sub-assembly step** (built by `client/processManual.ts`, not AI):
`"The {count} {label}s are assembled separately (manual steps {first}–{last}). Follow the manual for those, then continue here."`

---

## 4. Scene shapes (`schema/scene.ts`): the 3D engine's input

The renderer (`scene/`, written fresh) consumes this. `buildSceneManual()` produces it.

```ts
export const ScenePart = z.object({
  id: PartId, ikeaNumber: z.string().optional(), label: z.string(),
  kind: PartKind, count: z.number().int(), shape: z.enum(["box", "cylinder"]),
  sizeCm: Vec3.optional(),        // non-hardware: exact size, BUILD frame
  homeCm: Vec3.optional(),        // non-hardware: exact centre, BUILD frame
  hardwareMm: z.object({ length: z.number(), diameter: z.number() }).optional(),
  features: z.array(z.object({ type: z.enum(["holes", "finished-edge"]), face: Face })),
});

export const SceneTrap = z.object({
  part: PartId, mustFace: Face, wrong: WrongOrientation, hint: z.string(),
  source: z.enum(["manual", "geometry"]),
  autoplay: z.boolean(),          // manual: true; geometry: true only on first placement of that panel type
});

export const SceneStep = z.object({
  stepNumber: z.number().int(),
  kind: z.enum(["assembly", "info", "subassembly", "failed"]),
  instruction: z.string(),        // for subassembly: the template message; for failed: "Follow the original diagram for this step."
  actions: z.array(Action),       // empty for info / subassembly / failed
  trap: SceneTrap.optional(),
  confidence: Confidence,
  crop: z.string().optional(),    // URL of the diagram, absent for subassembly
});

export const SceneManual = z.object({
  id: z.string(), title: z.string(),
  buildSizeCm: Vec3,              // product size mapped into BUILD frame (§4.1)
  buildOrientation: BuildOrientation,
  parts: z.array(ScenePart),
  steps: z.array(SceneStep),
});
export type SceneManual = z.infer<typeof SceneManual>;
```

### 4.1 Coordinate frames

- **Build frame:** how the manual builds the furniture. Units are cm. Origin is the bottom-left-back corner. **+x** goes right, **+y** goes up, **+z** goes toward the viewer.
- **Upright frame:** how it stands when finished. `productSizeCm = [width, height, depth]`.

| `buildOrientation` | `buildSizeCm` from `productSizeCm [w, h, d]` | Example |
|---|---|---|
| `upright` | `[w, h, d]` | LACK side table, built standing |
| `on-back` | `[h, d, w]` | KALLAX: lying on its back, length along x, open front facing up |
| `upside-down` | `[w, h, d]` | a table built with the top on the floor |
| `on-side` | `[h, w, d]` | a unit lying on its side |

`flip` with `flipMode: "stand-up"` rotates the build-frame assembly so it ends upright. `flipMode: "turn-over"` rotates it 180° about x. Both are display-only parent rotations; part poses stay in the build frame. (See `reference/prototype/src/scene/geometry.ts`, `uprightQuaternion`, for a working reference.)

### 4.2 Functions that produce or consume scene shapes (owner: Ajit, in `scene/`)

```ts
// scene/layout.ts
export function snapLayout(layout: PartsLayout, buildSizeCm: Vec3):
  { ok: boolean; parts: ScenePart[]; errors: string[]; moves: { id: string; deltaCm: number }[] };

export function buildSceneManual(saved: SavedManual, cropBaseUrl: string):
  { manual: SceneManual; layoutErrors: string[] };   // never throws; errors are shown as a dev warning

// scene/traps.ts
export function deriveTraps(parts: ScenePart[], steps: SceneStep[]): SceneStep[];  // fills `trap` (manual first, else geometry)

// scene/consistency.ts
export function checkConsistency(manual: SceneManual): { stepNumber: number; problem: string }[];
// e.g. a "place" target that does not touch the placed part → orchestrator marks that step confidence "low"

// scene/resolveScene.ts, scene/tracks.ts   (written fresh in AJI-02; see reference/prototype for behaviour)
```

---

## 5. HTTP API (Next.js route handlers; owner: Karan, except save-manual: Smit)

All bodies are JSON. Images are **base64 JPEG without the `data:` prefix**, at most about 1.5 MB each.

```ts
// schema/api.ts
export type Usage = { model: string; inputTokens: number; outputTokens: number; ms: number };
export type ApiResult<T> =
  | { ok: true;  data: T; attempts: number; usage: Usage[] }
  | { ok: false; errors: string[]; attempts: number; usage: Usage[] };
```

| Route | Request body | Response | Model tier |
|---|---|---|---|
| `POST /api/index-page` | `{ image: string, pageNumber: number }` | `ApiResult<PageIndex>` | fast |
| `POST /api/parts` | `{ title: string, productSizeCm: Vec3, partsPages: string[], cover: string, stepThumbs: string[], previousErrors?: string[] }` | `ApiResult<PartsLayout>` | strong |
| `POST /api/analyze-step` | `{ image: string, stepNumber: number, parts: AiPart[], placedPartIds: string[], previousInstructions: string[] }` | `ApiResult<Step>` | strong |
| `POST /api/save-manual` _(dev only)_ | `{ manual: SavedManual, crops: { name: string, base64: string }[] }` | `{ ok: true, path: string }` or `{ ok: false, error: string }` | — |
| `POST /api/ask` _(stretch)_ | `{ question: string, step: Step, image: string }` | `ApiResult<{ answer: string }>` | fast |

**Request schemas** live in `schema/api.ts` as Zod objects with the same names plus `Request`: `IndexPageRequest`, `PartsRequest`, `AnalyzeStepRequest`, `SaveManualRequest`. Routes validate them first.

**HTTP status codes:**
- `200` when the request was valid, **including AI failures** (`ok: false`).
- `400` for an invalid request body.
- `503` when Vertex AI is unreachable or credentials are missing.
- `500` for anything unexpected.
- `save-manual` returns `404` unless `NODE_ENV === "development"`.

**Route settings:** `export const runtime = "nodejs"; export const maxDuration = 60;`

**Retry policy:** done inside `callStructured`, at most 2 retries (3 attempts in total). The client does **not** retry `ok: false`. It retries a network error or a `5xx` once, after 2 s.

**Image sizes** (enforced by the client):

| Image | Long side |
|---|---|
| Page images | 1600 px |
| Step crops | 1600 px |
| `stepThumbs` | 512 px |
| JPEG quality | 0.85 |

---

## 6. Client functions (owner: Smit, in `client/`)

```ts
// client/rasterize.ts
export async function rasterize(file: File, opts?: { maxLongSide?: number }):
  Promise<{ pageNumber: number; jpegBase64: string; width: number; height: number }[]>;

// client/crop.ts
export async function cropBox(page: { jpegBase64: string; width: number; height: number },
  box: [number, number, number, number], opts?: { padFrac?: number; maxLongSide?: number }): Promise<string>;

// client/api.ts  — real implementation; client/api.mock.ts — same signatures, gold-backed
export interface Api {
  indexPage(req: IndexPageRequest): Promise<ApiResult<PageIndex>>;
  parts(req: PartsRequest): Promise<ApiResult<PartsLayout>>;
  analyzeStep(req: AnalyzeStepRequest): Promise<ApiResult<Step>>;
  saveManual(req: SaveManualRequest): Promise<{ ok: boolean; path?: string; error?: string }>;
}
export function getApi(): Api;   // returns mock when NEXT_PUBLIC_MOCK_AI === "1"

// client/processManual.ts
export type ProcessEvent =
  | { type: "stage"; stage: "rasterize" | "index" | "parts" | "steps" | "done"; detail?: string }
  | { type: "progress"; done: number; total: number }
  | { type: "manual"; manual: SavedManual }          // emitted after every finished step (streaming)
  | { type: "error"; message: string };
export async function processManual(input: { file: File; title: string; id: string; productSizeCm: Vec3 },
  onEvent: (e: ProcessEvent) => void, api?: Api): Promise<SavedManual>;
```

---

## 7. React component contracts

```tsx
// scene/AssemblyScene.tsx   (owner Ajit; client-only, load via next/dynamic with ssr:false)
<AssemblyScene
  manual={SceneManual}
  stepIndex={number}            // 0-based into manual.steps
  playKey={number}              // increment → restart animation
  playing={boolean}
  speed={0.5 | 1 | 2}
  scrubT={number | null}        // 0..1 overrides time; null = play
  showTrap={boolean}            // player decides (autoplay rules / "Show possible mistake" button)
  onProgress={(t: number) => void}
  onDone={() => void}
/>

// player/StepPlayer.tsx     (owner Smit)
<StepPlayer manual={SceneManual} saved={SavedManual} mode="library" | "processing" />
```

The player never imports three.js. The scene never fetches anything.

---

## 8. Gold fixtures (owner: Karan)

```
fixtures/kallax.gold.json    SavedManual (hand-made, correct), converted from reference/prototype's fixture data
fixtures/lack.gold.json      SavedManual, 5–8 steps
fixtures/malm.gold.json      SavedManual, 5–8 steps incl. a sub-assembly
```

- Gold files must pass `SavedManual.parse` and the semantic checks; a test enforces this.
- `buildSceneManual(kallaxGold)` must reproduce the reference KALLAX geometry within 0.5 cm; Ajit's test enforces this.

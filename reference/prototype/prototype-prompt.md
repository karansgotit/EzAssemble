# Build a visual prototype: animated 3D furniture-assembly step player (IKEA KALLAX 2×4)

You are building a **front-end-only prototype** that answers one question for a hackathon team:

> "If an AI turned a real IKEA manual into simple structured step data, would our own 3D renderer make those steps look clear and convincing — next to the original diagram?"

There is **no AI, no backend, no network calls, no database, no auth** in this prototype. All step data is hand-written in a JSON fixture (section 4), transcribed from the real IKEA KALLAX 2×4 shelving manual (document AA-1055145-11). The real manual's step images will sit next to the 3D view so viewers can compare.

Deliver a complete, runnable project. When I run `npm install && npm run dev`, it must work with zero further edits. `npm run build` and `npm test` must also pass.

---

## 1. Tech stack (use exactly this, nothing extra)

- Vite + React + TypeScript (`strict: true`)
- `three`, `@react-three/fiber`, `@react-three/drei` — pick mutually compatible current versions (e.g. React 19 ↔ R3F v9 ↔ drei v10, or React 18 ↔ R3F v8 ↔ drei v9). Verify they install together without peer-dependency errors.
- `zod` for validating the fixture at load time
- `vitest` for unit tests
- Plain CSS (one `styles.css` file) — no Tailwind, no UI library, no animation library, no state library (React state only)

Do not add any other runtime dependency.

---

## 2. Project structure (keep these boundaries — this code will be reused)

```
src/
  main.tsx
  App.tsx                     top-level layout + mode switch (Guide | Verb gallery)
  styles.css
  schema/
    parts.ts                  Zod schemas + inferred TS types for parts
    step.ts                   Zod schemas + inferred TS types for steps
    manual.ts                 Zod schema for the whole fixture + checkManual()
  fixtures/
    kallax.json               the hand-written data (section 4)
  scene/                      3D only. No fetching, no app state beyond props.
    AssemblyScene.tsx         the single component the player uses (section 6)
    resolveScene.ts           PURE: data → poses of every part instance
    tracks.ts                 PURE: build keyframe tracks, sample(t)
    geometry.ts               PURE helpers: face normals, face rects, projections
    PartMesh.tsx              renders one part instance (box or cylinder)
    FeatureMarker.tsx         draws hole dots / finished-edge stripe on a face
    Ghost.tsx                 the wrong-vs-right orientation ghost
    MotionGuide.tsx           dashed line + arrowhead showing travel path
    CameraRig.tsx             auto-framing camera + orbit controls
    constants.ts              colours, timings, HARDWARE_SCALE, etc.
  player/                     UI only. Never imports three directly.
    StepPlayer.tsx            layout: diagram panel | 3D | instruction + controls
    DiagramPanel.tsx          shows /crops/step-NN.png or a placeholder
    StepNav.tsx               prev / next / step dots
    PlaybackBar.tsx           play/pause, replay, speed, scrubber
    ConfidenceBanner.tsx
    PartsTray.tsx             parts used in this step, with counts
    InfoStep.tsx              layout for steps with no 3D (wall anchoring)
  dev/
    VerbGallery.tsx           plays each verb on a test part (section 9)
    DevPanel.tsx              sliders for HARDWARE_SCALE, speed, show axes
tests/
  resolveScene.test.ts
  tracks.test.ts
  schema.test.ts
public/
  crops/                      I will copy step-01.png … step-19.png here (real manual crops)
```

---

## 3. Data schemas (implement exactly; validate the fixture with Zod on load)

```ts
// schema/parts.ts
export const Face = z.enum(["top", "bottom", "left", "right", "front", "back"]);
// Faces are in the SCENE frame (section 4), not "front of the furniture".
export const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

export const Part = z.object({
  id: z.string(),                 // e.g. "L1", "dowel"
  ikeaNumber: z.string().optional(), // e.g. "101339"
  label: z.string(),              // "Long side panel"
  kind: z.enum(["panel", "dowel", "screw", "other"]),
  count: z.number().int().min(1).max(64),
  shape: z.enum(["box", "cylinder"]),
  sizeCm: Vec3.optional(),        // panels: size as placed in the scene frame [x,y,z]
  homeCm: Vec3.optional(),        // panels: centre in the scene frame (prototype only)
  hardwareMm: z.object({ length: z.number(), diameter: z.number() }).optional(),
  features: z.array(z.object({
    type: z.enum(["holes", "finished-edge"]),
    face: Face,
  })).default([]),
});

// schema/step.ts
export const Action = z.object({
  verb: z.enum(["insert", "attach", "screw", "lock", "place", "flip"]),
  part: z.string(),               // for "flip": "assembly"
  count: z.number().int().min(1),
  target: z.string().optional(),  // part receiving it; not used by "flip"
  face: Face.optional(),          // face OF THE TARGET
  for: z.string().optional(),     // hardware only: which part these dowels/screws are for
  at: z.enum(["start", "middle", "end", "all"]).optional(), // fallback if no "for"
  flipMode: z.enum(["stand-up", "turn-over"]).optional(),   // only for verb "flip"
});

export const OrientationTrap = z.object({
  part: z.string(),
  feature: z.enum(["holes", "finished-edge"]),
  mustFace: Face,                 // direction the feature must point when correct
  wrong: z.enum(["flipped-vertical", "flipped-horizontal", "rotated-90"]),
  hint: z.string().max(80),
});

export const Step = z.object({
  stepNumber: z.number().int(),
  kind: z.enum(["assembly", "info"]).default("assembly"), // info = no 3D, show diagram large
  instruction: z.string().min(10).max(220),
  actions: z.array(Action).max(4),   // must be ≥1 when kind = "assembly"
  orientationTrap: OrientationTrap.optional(),
  confidence: z.enum(["high", "medium", "low"]),
  note: z.string().optional(),       // e.g. "Same as step 3, next shelf"
});

// schema/manual.ts
export const Manual = z.object({
  id: z.string(),
  title: z.string(),
  productSizeCm: Vec3,            // assembled, upright: [width, height, depth]
  parts: z.array(Part),
  steps: z.array(Step),
});
```

Also write `checkManual(manual)` returning human-readable errors for:
- any `part`, `target`, `for` or `orientationTrap.part` that is not a part id (`"assembly"` is allowed as the `part` of a `flip`);
- total instances used for a part across all steps exceeding its `count`;
- `insert`/`screw`/`lock` on a non-hardware part, or `attach`/`place` on hardware;
- an `assembly` step with zero actions;
- `orientationTrap.part` not appearing as a `part` or `target` in that step's actions.

If Zod or `checkManual` fails, show a clear red error screen listing the problems (never a blank page).

---

## 4. The fixture: `fixtures/kallax.json` (from the real manual)

### How the real manual builds it
The KALLAX 2×4 (assembled 77 W × 147 H × 39 D cm) is built **lying on its back on the floor**, so every panel stands on its edge and you look down into the open cubes. Only at step 15 is it stood upright. Steps 16–19 are wall-anchoring (drill into wall, hang on bracket) — these are **info steps with no 3D**.

The manual has a branch at step 15 (use vertically vs horizontally). **This prototype follows only the vertical branch** (manual pages 15–19).

### Scene frame (the build-on-the-floor frame)
Centimetres. Origin = the corner at the far-left-back on the floor.
- **+x** = along the long length of the unit (147 cm), left → right as drawn in the manual
- **+y** = up (the unit's 39 cm depth, because it lies on its back)
- **+z** = toward the viewer (the unit's 77 cm width)

So `left`/`right` faces point −x/+x, `bottom`/`top` point −y/+y, `back`/`front` point −z/+z.

Panel thicknesses below are **approximations** (outer ≈ 3.8 cm, inner ≈ 1.6 cm) — they were not measured.

### Parts

| id | ikeaNumber | label | kind | count | sizeCm [x,y,z] | homeCm (centre) | features |
|---|---|---|---|---|---|---|---|
| `E1` | — | End panel (top when upright) | panel | 1 | [3.8, 39, 77] | [1.9, 19.5, 38.5] | holes on `right` |
| `E2` | — | End panel (bottom when upright) | panel | 1 | [3.8, 39, 77] | [145.1, 19.5, 38.5] | holes on `left` |
| `L1` | — | Long side panel (back in the drawings) | panel | 1 | [139.4, 39, 3.8] | [73.5, 19.5, 1.9] | holes on `front` |
| `L2` | — | Long side panel (placed last) | panel | 1 | [139.4, 39, 3.8] | [73.5, 19.5, 75.1] | holes on `back` |
| `S1` | — | Shelf 1 | panel | 1 | [1.6, 39, 69.4] | [38.25, 19.5, 38.5] | holes on `right` |
| `S2` | — | Shelf 2 | panel | 1 | [1.6, 39, 69.4] | [73.5, 19.5, 38.5] | holes on `right` |
| `S3` | — | Shelf 3 | panel | 1 | [1.6, 39, 69.4] | [108.75, 19.5, 38.5] | holes on `right` |
| `D1` | — | Divider piece 1 | panel | 1 | [33.65, 39, 1.6] | [20.625, 19.5, 38.5] | — |
| `D2` | — | Divider piece 2 | panel | 1 | [33.65, 39, 1.6] | [55.875, 19.5, 38.5] | — |
| `D3` | — | Divider piece 3 | panel | 1 | [33.65, 39, 1.6] | [91.125, 19.5, 38.5] | — |
| `D4` | — | Divider piece 4 | panel | 1 | [33.65, 39, 1.6] | [126.375, 19.5, 38.5] | — |
| `dowel` | 101339 | Wooden dowel | dowel | 22 | — | — | — |
| `screw` | 104321 | Long assembly screw | screw | 8 | — | — | — |

Hardware sizes (`hardwareMm`, approximate): dowel `{length: 30, diameter: 8}`, screw `{length: 50, diameter: 7}`.

Hand tools in the manual (hammer, Allen key 100092 inside the handle tool 121030) are **not** modelled in 3D; mention them in instruction text only.

### Steps (transcribe exactly; instructions are friendly plain English)

1. `screw` 2 `screw` into `E1` face `left`, for `L1`; `attach` `E1` to `L1` face `left`; `place` `E2` at `L1` face `right`. Instruction: "Lay the long panel on its edge on a soft surface. Screw the end panel onto its left end with 2 long screws, using the Allen key fitted into the handle tool. Stand the other end panel at the far end." **Orientation trap:** part `L1`, feature `holes`, mustFace `front`, wrong `flipped-horizontal`, hint "Drilled holes face inward". confidence **medium**, note "When E2 is placed is our reading of the drawings."
2. `insert` 2 `dowel` into `E1` face `right`, for `D1`; `place` `D1` against `E1` face `right`. Instruction: "Tap 2 dowels into the end panel, then slide the first divider piece onto them." confidence high.
3. `insert` 2 `dowel` into `L1` face `front`, for `S1`; `place` `S1` against `L1` face `front`. Instruction: "Tap 2 dowels into the long panel and push the first shelf onto them." confidence high.
4. `insert` 2 `dowel` into `S1` face `right`, for `D2`. Instruction: "Tap 2 dowels into the shelf, ready for the next divider piece." confidence high.
5. `place` `D2` against `S1` face `right`. Instruction: "Slide the second divider piece onto the dowels." confidence high.
6. `insert` 2 `dowel` into `L1` face `front`, for `S2`; `place` `S2` against `L1` face `front`. Instruction: "Tap 2 dowels into the long panel and push the second shelf on." confidence high, note "Same as step 3, next shelf".
7. `insert` 2 `dowel` into `S2` face `right`, for `D3`. Instruction: "Tap 2 dowels into the second shelf." confidence high.
8. `place` `D3` against `S2` face `right`. Instruction: "Slide the third divider piece on." confidence high.
9. `insert` 2 `dowel` into `L1` face `front`, for `S3`; `place` `S3` against `L1` face `front`. Instruction: "Tap 2 dowels into the long panel and push the third shelf on." confidence high.
10. `insert` 2 `dowel` into `S3` face `right`, for `D4`. Instruction: "Tap 2 dowels into the third shelf." confidence high.
11. `place` `D4` against `S3` face `right`. Instruction: "Slide the last divider piece on." confidence high.
12. `insert` 2 `dowel` into `S1` face `front`, for `L2`; `insert` 2 into `S2` face `front`, for `L2`; `insert` 2 into `S3` face `front`, for `L2`; `insert` 2 into `E2` face `left`, for `L2` (these land where L2's end will sit against E2's inner face). Instruction: "Tap 8 dowels into the exposed edges of the shelves and the end panel." confidence **low** (so the low-confidence banner can be seen).
13. `attach` `L2` to `S2` face `front`. Instruction: "Lower the second long panel onto all the dowels at once." **Orientation trap:** part `L2`, feature `holes`, mustFace `back`, wrong `flipped-horizontal`, hint "Drilled holes face down onto the dowels". confidence high.
14. `screw` 2 `screw` into `E1` face `left`, for `L2`; `screw` 2 into `E2` face `right`, for `L2`; `screw` 2 into `E2` face `right`, for `L1`. Instruction: "Fix the corners with the 6 remaining long screws, using the Allen key and handle tool." confidence high.
15. `flip` part `assembly`, count 1, `flipMode` `stand-up`. Instruction: "With a helper, stand the shelf upright and stick 4 felt pads under it." confidence high.
16. `kind: "info"`, no actions. Instruction: "This shelf must be fixed to the wall. Mark the bracket position under the top edge." confidence high.
17. `kind: "info"`. Instruction: "Hold the shelf against the wall, check it is level, and mark the drilling points through the brackets." confidence high.
18. `kind: "info"`. Instruction: "Fix 2 wall screws (not included — choose ones suitable for your wall)." confidence high.
19. `kind: "info"`. Instruction: "Hang the shelf on the brackets and snap on the covers." confidence high.

Totals must come to exactly 22 dowels and 8 screws.

---

## 5. `resolveScene.ts` — the deterministic layout engine (PURE, unit-tested)

```ts
resolveScene(manual, uptoStepIndexInclusive): {
  instances: Map<string, Instance>   // key like "dowel#3"
  stepActions: ResolvedAction[][]     // per step, which instance ids each action moved
}
Instance = { instanceId, partId, position: Vec3, rotation: Vec3 /* euler radians */, sizeCm: Vec3, shape }
```

Rules:
1. **Instance expansion:** each action with `count: k` claims the next `k` unused instances of that part, in order (`dowel#1`, `dowel#2`, …). `lock` does not claim new instances — it reuses the most recently inserted `k` of that part (unused by KALLAX, but implement it).
2. **Panels:** final pose = `homeCm`, rotation `[0,0,0]`.
3. **Hardware with `for` (the main rule):**
   - Take the target's face rectangle (from target `homeCm` ± `sizeCm/2`).
   - Project the `for` part's bounding box onto that face plane along the face normal, and intersect it with the face rectangle. This "overlap rectangle" is where the joint is.
   - Place the `count` instances along the **longer** axis of the overlap rectangle, evenly spaced between 25% and 75% of it; centred on the shorter axis.
   - Example: the dowels in step 3 sit on `L1`'s front face where shelf `S1` will land (x ≈ 38.25), spread along y.
4. **Hardware without `for`:** fall back to `at` along the face's longer axis (`start` 15%, `middle` 50%, `end` 85%, `all` = evenly spread 15–85%).
5. **Orientation:** cylinder axis along the face normal. Dowels are **half-sunk** (centre exactly on the face plane). Screws are **fully driven** (head flush with the face, shank inside).
6. **Visible hardware size** = real mm → cm × `HARDWARE_SCALE` (default 2.5, adjustable in the DevPanel) so it reads next to 140 cm panels.
7. **Flip (`stand-up`):** the assembly's final display transform makes the unit upright: long axis (+x) vertical with `E1` on top, `E2` on the floor, and the open front (+y in the floor frame) facing the camera (+z). Compute this as a quaternion that maps the floor-frame axes accordingly, rotating about the assembly's bounding-box centre, then lift so the lowest point sits on y = 0. All instance poses stay in the floor frame; the flip is a parent-group transform.
8. Instances not yet used by step ≤ N are not rendered. Info steps keep showing the last assembly state.

---

## 6. `AssemblyScene` component contract

```tsx
<AssemblyScene
  manual={Manual}
  stepIndex={number}          // 0-based current step
  playKey={number}            // increment to restart the animation
  playing={boolean}
  speed={number}              // 0.5 | 1 | 2
  scrubT={number | null}      // 0..1 to scrub; null = play normally
  showTrap={boolean}
  onProgress={(t: number) => void}   // 0..1, for the scrubber
  onDone={() => void}
/>
```

---

## 7. `tracks.ts` — animation (PURE, unit-tested, no animation library)

```ts
type Track = { instanceId: string; from: Pose; to: Pose; start: number; duration: number; kind: Verb }
buildTracks(step, posesBefore, posesAfter): { tracks: Track[]; totalDuration: number }
sample(tracks, tSeconds): Map<instanceId, Pose>   // ease-in-out cubic
```

Verb motions (seconds at speed 1):

| verb | from → to | duration |
|---|---|---|
| `insert` | start 6 cm (× HARDWARE_SCALE/2.5) outside the face along its normal → final; add a tiny 2-frame "tap" bounce at the end (it's hammered in) | 0.8 |
| `screw` | start outside along the normal → final **plus** 3 full turns around the insertion axis | 1.4 |
| `lock` | no translation; rotate 90° around its own axis | 0.5 |
| `attach` / `place` | start displaced along the **target face's outward normal** by 35% of the moving part's size on that axis + 10 cm → final | 1.2 |
| `flip` `stand-up` | from floor transform to upright transform (section 5 rule 7); slerp rotation; camera re-frames after | 2.0 |

- Actions within a step play **sequentially** in array order with a 0.25 s gap.
- Multiple instances in one action are **staggered** by 0.15 s.
- 0.4 s hold at the end.
- Before an action starts, its parts wait at their `from` pose at 40% opacity; while moving they are at full opacity.
- `useFrame` drives a clock; `playing=false` pauses; `scrubT` overrides time.

---

## 8. Visual design — make it look polished and IKEA-manual-like

- **Page background** `#f6f4ef`; 3D canvas background `#fbfaf7`.
- **Previous-step parts:** white `#ffffff`, edges `#9b9b9b` (drei `<Edges>`).
- **Current-step parts:** fill `#ffd23f`, edges black `#111`, visibly heavier edges.
- **Hardware:** dowels light wood `#d9b98a`; screws steel `#b8bec6`; black edges.
- **Feature markers:** `holes` = a row of 3–4 small dark `#333` circles slightly above the face surface (no z-fighting); `finished-edge` = a thin IKEA-blue `#0058a3` stripe along that face.
- **Motion guide:** while a part moves, a dashed line from start to end with a cone arrowhead in `#0058a3`, fading out after the move — like the arrows in IKEA drawings.
- **Floor:** while lying on the floor (steps 1–14), show a soft grey rug-shaped plane under the assembly (the manual shows a rug in step 1). drei `<ContactShadows>` under the assembly.
- **Lighting:** hemisphere light + one soft directional light. No textures, no environment maps that need network.
- **Camera (`CameraRig.tsx`):** perspective, fov 30. Default direction from front-left-above, matching the manual's view: looking at the floor-frame assembly from roughly `[-0.6, 1.0, 1.2]` (normalized) relative to its centre. On every step change or replay, smoothly (0.6 s) frame the bounding box of **the current step's moving parts plus their targets** with a 1.4× margin; for step 1 and step 15, frame the whole assembly. Orbit/zoom with drei `<OrbitControls>`; only re-frame on step change or replay. "Reset view" button.
- **Typography:** system UI font stack; instruction text 20px, semi-bold.

### Orientation-trap sequence (`Ghost.tsx`) — the hero moment, make it great
When `showTrap` is true and the step has an `orientationTrap`, before the normal animation:
1. (0–1.2 s) A **red** (`#e5484d`, opacity 0.45, red edges) ghost of the trap part appears at its home position in the **wrong** orientation, with its hole markers visibly on the wrong side. A floating label (drei `<Html>`) "✗ Wrong way round" with a subtle shake.
2. (1.2–2.2 s) The ghost rotates into the correct orientation and colour-lerps to **green** `#30a46c`; the label changes to "✓ " + `hint`.
3. (2.2–2.6 s) The ghost fades out and the normal step animation starts.
It plays automatically the first time a trap step is shown; a "Show the common mistake" button replays it.

---

## 9. UI layout (`StepPlayer.tsx`)

Desktop (≥ 1024 px):

```
┌───────────────────────────────────────────────────────────────┐
│ Header: "KALLAX 2×4 — Step 3 of 19"     [Guide | Verb gallery] │
├──────────────────────┬────────────────────────────────────────┤
│ DiagramPanel         │                                        │
│ (real manual crop)   │            3D AssemblyScene            │
│                      │                                        │
│ PartsTray            │                 [Reset view]           │
│ (icons + "×2")       │                                        │
├──────────────────────┴────────────────────────────────────────┤
│ ConfidenceBanner (only if low) · note (if any, small grey)     │
│ Instruction sentence (large)                                   │
│ [◀ Prev]  ●●●○○○…  [Next ▶]   [⟲ Replay] [▶/❚❚] [0.5× 1× 2×]   │
│ ─────────────── scrubber ───────────────                       │
└───────────────────────────────────────────────────────────────┘
```

- **DiagramPanel:** loads `/crops/step-NN.png` (NN = 2-digit step number). If the image fails to load, show a tasteful placeholder card with the big step number and "Original manual diagram goes here". Clicking the image opens it larger in a lightbox.
- **Info steps (16–19):** hide the 3D panel and the playback bar; show the manual crop large in the centre with the instruction underneath and a small label "No 3D for this step — follow the diagram". This also demonstrates our graceful-fallback behaviour.
- **PartsTray:** parts used in this step, with a tiny inline SVG icon per kind (panel = rectangle, dowel = capsule, screw = screw) and "×N", plus the IKEA number in small grey text if present.
- **ConfidenceBanner:** amber bar "The AI is unsure about this step — double-check the original diagram." when `confidence === "low"`.
- **Keyboard:** ← / → change step, Space play/pause, R replay.
- Changing step auto-plays the step from the start.
- Mobile (< 768 px): stack vertically, no horizontal page scroll.

### Verb gallery mode (`dev/VerbGallery.tsx`)
A second mode with a test panel `[40, 3, 30]` on the floor and one button per verb: insert, screw, lock, attach, place, flip (stand-up, using a small 3-panel test assembly), plus "Trap ghost". Each plays in isolation using the same `tracks.ts` code.

### DevPanel (collapsible, bottom-right)
Plain HTML controls: HARDWARE_SCALE (1–5), global speed, show axes helper, show motion guides, show feature markers.

---

## 10. Tests (`npm test`, Vitest)

- `schema.test.ts`: the fixture passes Zod and `checkManual`; totals are exactly 22 dowels and 8 screws; a copy with a bad part id and a copy using 23 dowels both fail with readable messages; an assembly step with zero actions fails.
- `resolveScene.test.ts`:
  - after step 3, `S1` is at `[38.25, 19.5, 38.5]`;
  - the 2 dowels from step 3 have x ≈ 38.25 and z ≈ 3.8 (on `L1`'s front face), and different y values;
  - the 2 dowels from step 2 have x ≈ 3.8 (on `E1`'s right face) and z ≈ 38.5 (where `D1` lands);
  - after step 14 there are 22 dowel and 8 screw instances.
- `tracks.test.ts`: `sample` at t=0 returns `from`, at the end returns `to`, midpoint is in between; `screw` rotation at the end = 3 full turns; staggering offsets start times by 0.15 s.

---

## 11. Acceptance checklist (verify every item before you finish)

- [ ] `npm install && npm run dev` works; `npm run build` and `npm test` pass; no TypeScript errors; no console errors in the browser.
- [ ] Stepping 1 → 15 visibly builds the KALLAX lying on its back exactly in the order of the manual (end panel + long panel, then alternating divider pieces and shelves, then the second long panel, screws, stand up). Going back/forward any number of times always shows the correct state.
- [ ] Each 3D step, placed next to its manual crop, is recognisably the same action from a similar viewing angle.
- [ ] Every verb reads as what it is (dowels tap in, screws spin in, panels glide in from the correct side, stand-up rotates the whole unit upright with E1 on top).
- [ ] Current-step parts are unmistakable; previous parts recede.
- [ ] Dowels and screws are clearly visible at the default HARDWARE_SCALE.
- [ ] The trap ghost in steps 1 and 13 clearly shows the holes on the wrong side, then the right side.
- [ ] Camera framing keeps the action in view on every step without manual adjustment.
- [ ] Step 12 shows the low-confidence banner; steps 16–19 show the info-step layout.
- [ ] Breaking the fixture (e.g. a typo in a part id) shows the red validation error screen.
- [ ] Code is small and readable: no file over ~250 lines, explicit types, pure functions in `resolveScene.ts` / `tracks.ts` / `geometry.ts`, no `any`.

At the end, output: the full file tree, every file's complete contents, and a short README explaining how to run it, where to put the crop images (`public/crops/step-01.png` … `step-19.png`), and how to edit `fixtures/kallax.json`.

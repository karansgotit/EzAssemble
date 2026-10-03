# Ajit: the 3D scene (layout snapping, geometry, animation, wrong-vs-right)

**You own:** `scene/**`, plus its tests.

**Read first:**
- `docs/CONTRACTS.md` §4 (scene shapes, frames) and §7 (component props);
- `docs/ARCHITECTURE.md` §9–12b;
- the reference prototype in `reference/prototype/src/scene/`. It shows working behaviour for KALLAX, but **write everything fresh; don't copy files** (D-17).

**Golden rule:** `scene/*.ts` files are **pure functions with tests**; `scene/*.tsx` files only render. The scene never fetches data and never throws on bad data.

**How you'll know it's working:** `npm test`, plus the dev page `/dev/scene?fixture=kallax`, which Smit sets up in SMI-01 and you may extend.

---

### AJI-01 · SPIKE #2: `snapLayout()`
**Labels:** spike, scene, P0 · **Hours:** 0:00–3:00 · **Depends on:** nothing. Write it as plain TS + Vitest; it can start before SMI-01 and KAR-01, using local copies of the types. **Blocks:** AJI-03

**Context:** the AI gives each panel a rough size and centre as fractions of the product. We turn that into exact centimetres with no gaps or overlaps. ARCHITECTURE §9 has the algorithm.

**Do**
- [ ] `scene/layout.ts` `snapLayout(layout: PartsLayout, buildSizeCm: Vec3)` → `{ ok, parts: ScenePart[], errors, moves }`:
  1. Scale fractions → cm.
  2. Snap each panel's thinnest dimension to the nearest of `[1.2, 1.6, 1.8, 2.5, 3.8]` cm.
  3. Snap faces within 4% of the outer box flush to it.
  4. Close gaps / remove overlaps between facing panels within 4% (iterate ≤ 5 passes).
  5. Evenly space parallel same-label-root panels (Shelf 1/2/3) between their neighbours.
  6. Validate: overlaps > 0.2 cm, panels touching nothing, panels outside the box → `errors` as sentences, e.g. `"S2 overlaps D3 by 1.4 cm"`.
- [ ] Hardware parts pass through unchanged (no geometry).
- [ ] Test (`tests/layout.test.ts`): take the reference KALLAX geometry (from `reference/prototype/src/fixtures/kallax.json`), convert to fractions, add **±8% random noise** (seeded), snap → every panel within 0.5 cm of the original, `ok: true`. Also test that a deliberately impossible layout returns readable errors.

**Acceptance criteria (report at H3)**
- [ ] The noise test passes for 20 different seeds.
- [ ] If it doesn't, report which step of the algorithm fails, so the team can decide on the fallback (human-reviewed layouts for our 3 manuals).

---

### AJI-02 · Build the scene engine fresh on `SceneManual`
**Labels:** scene, P0 · **Hours:** 3:00–6:30 (biggest task; start the pure parts during the spike if time allows) · **Depends on:** SMI-01, KAR-02 (`kallax.scene.json`)

**Do**
- [ ] Write fresh, against `SceneManual` / `ScenePart` / `SceneStep` from `schema/scene.ts`, using the reference prototype and ARCHITECTURE §10–12 for behaviour:
  - **Pure:** `geometry.ts` (face normals and rects, the projection/overlap strip, bounds, quaternions), `resolveScene.ts`, `tracks.ts` (`buildTracks`, `sample`, easing).
  - **Components:** `AssemblyScene.tsx`, `PartMesh.tsx`, `MotionGuide.tsx`, `CameraRig.tsx`, `constants.ts`.
  - Ghost and markers come in AJI-06; leave a stub.
- [ ] Make `AssemblyScene` match the props in CONTRACTS §7 exactly, as a `"use client"` component loaded with `next/dynamic(..., { ssr: false })` by the player.
- [ ] Tests (fresh): resolveScene positions (S1 dowels at x ≈ 38.25 on L1's front face; 22 dowels + 8 screws after step 14); `sample` at 0, middle and end; screw = 3 turns; 0.15 s stagger.

**Acceptance criteria**
- [ ] KALLAX plays in `/dev/scene`, matching the reference prototype's behaviour.

---

### AJI-03 · `buildSceneManual(saved)`: stored manual → scene manual
**Labels:** scene, P0 · **Hours:** 6:30–8:00 · **Depends on:** AJI-01, AJI-02, KAR-02

**Do**
- [ ] `scene/buildSceneManual.ts`:
  - map `productSizeCm` → `buildSizeCm` using the CONTRACTS §4.1 table;
  - `snapLayout`;
  - map `SavedStep`s:
    - `ok` → assembly/info, with the manual trap converted to a `SceneTrap`;
    - `failed` → kind `failed`, text "Follow the original diagram for this step.";
    - `subassembly` → kind `subassembly`, message, no crop;
  - crop URLs = `cropBaseUrl + crop`;
  - call `deriveTraps` (AJI-05; stub it until then).
- [ ] Never throws: problems go into `layoutErrors`.
- [ ] Test: `buildSceneManual(kallax.gold.json)` reproduces `kallax.scene.json` geometry within 0.5 cm.

**Acceptance criteria**
- [ ] Smit can switch the player from `kallax.scene.json` to `manual.json` + `buildSceneManual` with no visible change.

---

### AJI-04 · Build orientations and flips
**Labels:** scene, P0 · **Hours:** 8:00–9:00 · **Depends on:** AJI-03
- [ ] Support all four `buildOrientation`s.
- [ ] `flip` with `stand-up` ends upright from `on-back` and `on-side`; `turn-over` rotates 180° about x (for `upside-down` builds such as tables).
- [ ] If a manual ends without a flip but its orientation isn't upright, show it in the build frame (no auto-flip).
- [ ] Tests: upright end pose for `on-back` (KALLAX) and `on-side`; `turn-over` for `upside-down`.

---

### AJI-05 · `deriveTraps()`: wrong-vs-right evidence
**Labels:** scene, P0 · **Hours:** 9:00–11:00 · **Depends on:** AJI-03 · **Reqs:** FR-50..55, D-13

**Do**
- [ ] `scene/traps.ts` `deriveTraps(parts, steps)`:
  - **Manual traps** (already on the step from call 3) stay as they are, with `autoplay: true`.
  - **Geometry traps:** for each `place`/`attach` of a non-hardware part that is:
    - a box;
    - with `holes` on exactly one face;
    - where that face points toward the part it joins (`target`), or toward the hardware `for` it in this step;

    create `{ part, mustFace: <that face>, wrong: <180° flip that moves holes to the opposite face>, hint: "Drilled holes face <inward | the [target label]>", source: "geometry" }`.
  - **Autoplay:** `true` only on the first step that places a part with the same label root (e.g. the first shelf); otherwise `false`, and the player shows a "Show possible mistake" button.
  - A step never gets both kinds: manual wins.
- [ ] Tests on gold KALLAX:
  - step 1 (L1) gets a trap;
  - step 3 (S1, first shelf) autoplay true, step 6 (S2) autoplay false;
  - dowel-only steps get none;
  - a panel with holes on two faces gets none.

---

### AJI-06 · Ghost and feature markers update
**Labels:** scene, P0 · **Hours:** 11:00–12:00 · **Depends on:** AJI-05
- [ ] `Ghost.tsx` sequence:
  - 0–1.2 s: red wrong pose, with the label "✗ From the manual" or "✗ Possible mistake";
  - 1.2–2.2 s: rotate to the correct pose and fade to green, labelled "✓ " + hint;
  - 2.2–2.6 s: fade out, then the step's tracks start.
- [ ] Support all 3 `wrong` kinds.
- [ ] `FeatureMarker.tsx`: hole dots on the faces with `holes`, visible on the ghost so wrong vs right is obvious.
- [ ] Never use the words "common mistake".

---

### AJI-07 · All part kinds and hardware placement
**Labels:** scene, P0 · **Hours:** 12:00–13:30 · **Depends on:** AJI-03
- [ ] **Hardware kinds:**
  - `dowel` (half-sunk);
  - `screw` / `camBolt` (fully driven, spin);
  - `cam` (insert + `lock` quarter-turn);
  - `nail` (straight push, no spin).
- [ ] **Non-hardware:** `panel`, `leg` (box or cylinder) and `other` (a finished sub-assembly such as a drawer, rendered as a box) all use `place`/`attach` motion.
- [ ] The `at` fallback works when `for` is missing.
- [ ] Tests per kind (position on face, final pose).

---

### AJI-08 · Robustness: the scene never crashes
**Labels:** scene, P0 · **Hours:** 13:30–14:30 · **Depends on:** AJI-03 · **Reqs:** FR-75
- [ ] Unknown part/target/for ids, missing geometry, over-used counts: skip that action, `console.warn` once, keep rendering the rest.
- [ ] `info` / `subassembly` / `failed` steps: no tracks; the scene shows the assembly state as of the previous step. (The player may hide the canvas, but the scene must still be correct if shown.)
- [ ] Test with a deliberately corrupted copy of gold: no exceptions, and the valid actions still produce tracks.

---

### AJI-09 · Consistency check
**Labels:** scene, P1 · **Hours:** handed to Karan if Ajit is behind at H12 (pure function, no rendering) · **Depends on:** AJI-03
- [ ] `scene/consistency.ts` `checkConsistency(manual)`: for every `place`/`attach`, does the moved part touch its `target` in the snapped layout (within 0.5 cm)? Return `{ stepNumber, problem }[]`. The orchestrator (Smit) marks those steps low confidence.
- [ ] Tests: gold → no problems; move one shelf 5 cm → a problem is reported.

---

### AJI-10 · Real-data hardening on LACK and MALM
**Labels:** scene, P0 · **Hours:** 14:30–17:00 (as AI output arrives) · **Depends on:** KAR-07/08, SMI-06
- [ ] Load the processed LACK and MALM manuals; fix geometry/animation problems in snapping, legs, tables built upside-down, and drawers as boxes.
- [ ] Camera framing works for small (LACK, ~55 cm) and tall objects; tune `HARDWARE_SCALE` per object size (e.g. scale it with `buildSizeCm`).
- [ ] Keep performance smooth: if meshes > 400, share geometries/materials (or use instancing for hardware).

---

### AJI-11 · Visual polish with design tokens
**Labels:** scene, design, P1 · **Hours:** 17:00–19:00 · **Depends on:** SHR-03
- [ ] `scene/constants.ts` reads colours from the CSS variables (Claude Design tokens) so 3D and UI match.
- [ ] Tune: edge thickness, highlight colour, motion-arrow style, shadows, and ghost colours (red/green that are still distinguishable for colour-blind viewers: add the ✗/✓ labels and a dashed outline on the wrong pose).
- [ ] Screenshot every KALLAX step for the team to review.
